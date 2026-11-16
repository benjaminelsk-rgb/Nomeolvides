// Sincronización con Supabase: tus ideas en el celular y en la compu.
// Funciona "primero local": todo se guarda en el dispositivo y se sincroniza cuando hay internet.
import { db } from './db.js';

const SB_URL = 'https://ztjnyjlciqinihxvfply.supabase.co';
const SB_KEY = 'sb_publishable_plWW5UO7qFRBNyA6af6xQQ_4ELQy309';
const BUCKET = 'archivos';

export const sb = window.supabase
  ? window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'nomeolvides-auth', detectSessionInUrl: true } })
  : null;

let usuario = null;
let enCurso = null;
const oyentes = new Set();
export const estado = { sincronizando: false, ultima: null, error: null };

export function alCambiar(fn) { oyentes.add(fn); return () => oyentes.delete(fn); }
const avisar = (cambios) => oyentes.forEach((fn) => { try { fn(cambios); } catch (e) { /* nada */ } });

export const usuarioActual = () => usuario;

/* ---------------- cambios locales pendientes de subir ---------------- */
let sucios = null;
async function cargarSucios() { if (!sucios) sucios = new Set(await db.meta('sucios', [])); return sucios; }
async function guardarSucios() { await db.setMeta('sucios', [...sucios]); }

export async function marcarSucio(tipo, id) {
  await cargarSucios();
  sucios.add(tipo + ':' + id);
  await guardarSucios();
  programar();
}

export async function borrarArchivoRemoto(fileId) {
  const lista = await db.meta('archivosBorrar', []);
  lista.push(fileId);
  await db.setMeta('archivosBorrar', lista);
}

let timer = null;
function programar(ms = 2500) {
  if (!usuario) return;
  clearTimeout(timer);
  timer = setTimeout(() => sincronizar(), ms);
}

/* ---------------- sesión ---------------- */
export async function iniciarSesion() {
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  usuario = data.session ? data.session.user : null;
  estado.ultima = await db.meta('ultimaSync', null);
  sb.auth.onAuthStateChange((evento, sesion) => {
    const antes = usuario && usuario.id;
    usuario = sesion ? sesion.user : null;
    if (evento === 'PASSWORD_RECOVERY') avisar({ recuperar: true });
    if (usuario && usuario.id !== antes) primeraVez().then(() => sincronizar());
    if (!usuario && antes) avisar({ sesion: false });
  });
  return usuario;
}

async function primeraVez() {
  // La primera vez que este dispositivo entra con una cuenta, se sube todo lo que tenga.
  const cuenta = await db.meta('cuentaSync', null);
  if (cuenta === usuario.id) return;
  await cargarSucios();
  for (const i of await db.todos('ideas')) sucios.add('idea:' + i.id);
  for (const r of await db.todos('ramas')) sucios.add('rama:' + r.id);
  if (await db.meta('nombre', '')) sucios.add('perfil:nombre');
  await guardarSucios();
  await db.setMeta('cuentaSync', usuario.id);
  await db.setMeta('ultimoPull', null);
  await db.setMeta('subidos', []);
}

export async function entrar(email, clave) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password: clave });
  if (error) throw traducir(error);
  usuario = data.user;
  await primeraVez();
  await sincronizar();
  return usuario;
}

export async function crearCuenta(email, clave) {
  const { data, error } = await sb.auth.signUp({ email, password: clave, options: { emailRedirectTo: location.href.split('#')[0] } });
  if (error) throw traducir(error);
  if (data.session) {
    usuario = data.user;
    await primeraVez();
    await sincronizar();
    return { listo: true };
  }
  return { confirmar: true };
}

export async function recuperarClave(email) {
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.href.split('#')[0] });
  if (error) throw traducir(error);
}

export async function cambiarClave(clave) {
  const { error } = await sb.auth.updateUser({ password: clave });
  if (error) throw traducir(error);
}

export async function salir() {
  await sb.auth.signOut();
  usuario = null;
  await db.setMeta('cuentaSync', null);
}

function traducir(error) {
  const m = (error.message || '').toLowerCase();
  if (m.includes('invalid login')) return new Error('El mail o la contraseña no coinciden.');
  if (m.includes('email not confirmed')) return new Error('Todavía no confirmaste tu mail. Buscá el correo de Supabase y tocá el link.');
  if (m.includes('already registered') || m.includes('already been registered')) return new Error('Ya hay una cuenta con ese mail. Tocá "Entrar".');
  if (m.includes('password') && m.includes('6')) return new Error('La contraseña tiene que tener al menos 6 caracteres.');
  if (m.includes('rate limit') || m.includes('too many')) return new Error('Demasiados intentos. Esperá unos minutos y probá de nuevo.');
  if (m.includes('fetch') || m.includes('network')) return new Error('No hay conexión a internet.');
  return new Error(error.message || 'Algo salió mal.');
}

/* ---------------- sincronizar ---------------- */
export function sincronizar() {
  if (!sb || !usuario || !navigator.onLine) return Promise.resolve(false);
  if (enCurso) return enCurso;
  estado.sincronizando = true;
  avisar({ estado: true });
  enCurso = (async () => {
    let cambios = false;
    try {
      cambios = (await bajar()) || cambios;
      await subir();
      await borrarArchivos();
      estado.error = null;
      estado.ultima = Date.now();
      await db.setMeta('ultimaSync', estado.ultima);
      if (await bajarArchivosFaltantes()) cambios = true;
    } catch (e) {
      estado.error = e.message || String(e);
      console.warn('Sincronización:', e);
    } finally {
      estado.sincronizando = false;
      enCurso = null;
      avisar({ estado: true, datos: cambios });
    }
    return cambios;
  })();
  return enCurso;
}

const STORE = { idea: 'ideas', rama: 'ramas' };

async function bajar() {
  const desde = await db.meta('ultimoPull', null);
  let maximo = desde;
  let cambios = false;
  let pagina = 0;
  await cargarSucios();
  for (;;) {
    let q = sb.from('registros').select('*').order('modificado', { ascending: true }).range(pagina * 500, pagina * 500 + 499);
    if (desde) q = q.gt('modificado', new Date(new Date(desde).getTime() - 10000).toISOString());
    const { data, error } = await q;
    if (error) throw error;
    for (const fila of data) {
      if (await aplicar(fila)) cambios = true;
      if (!maximo || fila.modificado > maximo) maximo = fila.modificado;
    }
    if (data.length < 500) break;
    pagina++;
  }
  if (maximo) await db.setMeta('ultimoPull', maximo);
  await guardarSucios();
  return cambios;
}

async function aplicar(fila) {
  const clave = fila.tipo + ':' + fila.id;
  if (fila.tipo === 'perfil') {
    if (sucios.has(clave)) return false;
    const actual = await db.meta('nombre', '');
    const nuevo = fila.borrada ? '' : ((fila.datos && fila.datos.valor) || '');
    if (actual === nuevo) return false;
    await db.setMeta('nombre', nuevo);
    return true;
  }
  const store = STORE[fila.tipo];
  if (!store) return false;
  const local = await db.obtener(store, fila.id);
  // Borrada acá y todavía sin subir: no la traigas de vuelta.
  if (!local && sucios.has(clave)) return false;
  const tLocal = local ? (local.actualizada || 0) : -1;
  if (fila.borrada) {
    if (!local) { sucios.delete(clave); return false; }
    if (tLocal > fila.actualizada) return false; // lo local es más nuevo: gana lo local
    await db.borrar(store, fila.id);
    if (fila.tipo === 'idea') await borrarArchivosLocales(local);
    sucios.delete(clave);
    return true;
  }
  if (local && tLocal >= fila.actualizada) return false;
  if (fila.tipo === 'rama' && !local) await fusionarRamaRepetida(fila.datos);
  await db.guardar(store, fila.datos);
  sucios.delete(clave);
  return true;
}

// Si en este dispositivo había una rama con el mismo nombre (por ejemplo las que vienen
// de entrada), se juntan en una sola para no tener "Negocios" repetida.
async function fusionarRamaRepetida(remota) {
  const nombre = (remota.nombre || '').trim().toLowerCase();
  const ramas = await db.todos('ramas');
  const igual = ramas.find((r) => r.id !== remota.id && r.nombre.trim().toLowerCase() === nombre);
  if (!igual) return;
  for (const m of igual.ramitas || []) if (!remota.ramitas.includes(m)) remota.ramitas.push(m);
  remota.actualizada = Math.max(remota.actualizada || 0, Date.now());
  for (const idea of await db.todos('ideas')) {
    if (idea.ramaId === igual.id) {
      idea.ramaId = remota.id;
      idea.actualizada = Date.now();
      await db.guardar('ideas', idea);
      sucios.add('idea:' + idea.id);
    }
  }
  await db.borrar('ramas', igual.id);
  sucios.add('rama:' + igual.id);
  sucios.add('rama:' + remota.id);
}

async function borrarArchivosLocales(idea) {
  if (idea.audioId) await db.borrar('audios', idea.audioId);
  for (const f of idea.fotos || []) await db.borrar('fotos', f);
}

async function subir() {
  await cargarSucios();
  if (!sucios.size) return;
  const subidos = new Set(await db.meta('subidos', []));
  const claves = [...sucios];
  const filas = [];
  for (const clave of claves) {
    const [tipo, ...resto] = clave.split(':');
    const id = resto.join(':');
    if (tipo === 'perfil') {
      filas.push({ user_id: usuario.id, tipo, id, datos: { valor: await db.meta('nombre', '') }, actualizada: Date.now(), borrada: false });
      continue;
    }
    const local = await db.obtener(STORE[tipo], id);
    if (local && tipo === 'idea') {
      for (const archivo of [local.audioId, ...(local.fotos || [])].filter(Boolean)) {
        if (subidos.has(archivo)) continue;
        const reg = await db.obtener(archivo.startsWith('a-') ? 'audios' : 'fotos', archivo);
        if (!reg) continue;
        const { error } = await sb.storage.from(BUCKET).upload(usuario.id + '/' + archivo, reg.blob, { upsert: true, contentType: reg.tipo || reg.blob.type || 'application/octet-stream' });
        if (error) throw error;
        subidos.add(archivo);
      }
    }
    filas.push({
      user_id: usuario.id, tipo, id,
      datos: local || null,
      actualizada: local ? (local.actualizada || Date.now()) : Date.now(),
      borrada: !local
    });
  }
  for (let i = 0; i < filas.length; i += 200) {
    const { error } = await sb.from('registros').upsert(filas.slice(i, i + 200), { onConflict: 'user_id,tipo,id' });
    if (error) throw error;
  }
  await db.setMeta('subidos', [...subidos]);
  claves.forEach((c) => sucios.delete(c));
  await guardarSucios();
}

async function borrarArchivos() {
  const lista = await db.meta('archivosBorrar', []);
  if (!lista.length) return;
  const { error } = await sb.storage.from(BUCKET).remove(lista.map((f) => usuario.id + '/' + f));
  if (!error) await db.setMeta('archivosBorrar', []);
}

async function bajarArchivosFaltantes() {
  let alguno = false;
  const subidos = new Set(await db.meta('subidos', []));
  for (const idea of await db.todos('ideas')) {
    for (const archivo of [idea.audioId, ...(idea.fotos || [])].filter(Boolean)) {
      const store = archivo.startsWith('a-') ? 'audios' : 'fotos';
      if (await db.obtener(store, archivo)) continue;
      const { data, error } = await sb.storage.from(BUCKET).download(usuario.id + '/' + archivo);
      if (error || !data) continue;
      await db.guardar(store, { id: archivo, blob: data, tipo: data.type, ideaId: idea.id });
      subidos.add(archivo);
      alguno = true;
    }
  }
  await db.setMeta('subidos', [...subidos]);
  return alguno;
}

/* ---------------- cuándo sincronizar ---------------- */
export function arrancarAutomatico() {
  window.addEventListener('online', () => sincronizar());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sincronizar(); });
  setInterval(() => { if (!document.hidden) sincronizar(); }, 60000);
  sincronizar();
}
