import { db, nuevoId } from './db.js';
import { Grabadora, puedeGrabar, puedeTranscribir, formatoTiempo } from './recorder.js';
import { describir, pendientes, crearICS, ORDEN_SEMANA, NOMBRES_DIA } from './reminders.js';
import { sugerirRama, sugerirRamita, tituloAutomatico } from './suggest.js';
import * as sync from './sync.js';

/* =====================================================================
   Utilidades
   ===================================================================== */
const $app = document.getElementById('app');
const h = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const PALETA = [['#4F7FE6', 'Azul'], ['#3BA7D9', 'Celeste'], ['#2E9C8A', 'Turquesa'], ['#5F8A3F', 'Verde'], ['#8DB33A', 'Verde lima'], ['#E3B126', 'Amarillo'],
  ['#C9821A', 'Ámbar'], ['#E8743B', 'Naranja'], ['#E05A47', 'Coral'], ['#D9558C', 'Rosa'], ['#7B5CD6', 'Violeta'], ['#8A6A4F', 'Marrón']];

const ESTADOS = { semilla: 'Semilla', brote: 'Brote', flor: 'Flor' };
const PLURAL = { todas: 'Todas', semilla: 'Semillas', brote: 'Brotes', flor: 'Flores' };

const I = {
  atras: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  chevron: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  x: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  xs: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  mas: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  lapiz: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  tacho: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  texto: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  voz: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  melodia: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>',
  stop: '<svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  chispa: (c = '#C9961E', s = 14) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${c}" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>`,
  campana: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C9961E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/></svg>',
  calendario: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  puntos: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  engranaje: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  lupa: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5A6478" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
  semilla: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20c-3.5 0-6-2.8-6-6.5S9 6 12 4c3 2 6 5.8 6 9.5S15.5 20 12 20z"/><path d="M12 9v7"/></svg>',
  brote: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21v-9"/><path d="M12 12c0-4-3-6-7-6 0 4 3 6 7 6z"/><path d="M12 11c0-3 2-5 6-5 0 3-2 5-6 5z"/></svg>',
  flor: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="2.2"/><circle cx="12" cy="6" r="3"/><circle cx="17.7" cy="10.1" r="3"/><circle cx="15.5" cy="16.9" r="3"/><circle cx="8.5" cy="16.9" r="3"/><circle cx="6.3" cy="10.1" r="3"/></svg>',
  camara: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/></svg>',
  logo: '<svg width="36" height="36" viewBox="0 0 40 40" aria-hidden="true"><path d="M20 38V25M20 27l-6-6M20 27l6-6" stroke="#7E7165" stroke-width="3.2" stroke-linecap="round" fill="none"/><path d="M3 19C3 9 11 4 20 4s17 5 17 15c-7-1.5-27-1.5-34 0z" fill="#4C7034"/><circle cx="12" cy="12.5" r="2.6" fill="#4F7FE6"/><circle cx="21" cy="8.5" r="2.6" fill="#4F7FE6"/><circle cx="28.5" cy="13" r="2.6" fill="#4F7FE6"/></svg>'
};

function hace(ts) {
  const dias = Math.floor((startOfDay(Date.now()) - startOfDay(ts)) / 86400000);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 7) return 'hace ' + dias + ' días';
  if (dias < 14) return 'hace 1 semana';
  if (dias < 30) return 'hace ' + Math.floor(dias / 7) + ' semanas';
  if (dias < 60) return 'hace 1 mes';
  if (dias < 365) return 'hace ' + Math.floor(dias / 30) + ' meses';
  return 'hace más de un año';
}
function startOfDay(ts) { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
function fechaLarga(ts) {
  return new Date(ts).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
}
function fechaNota(ts) {
  return new Date(ts).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', '');
}
function hoyISO(offsetDias = 0) {
  const d = new Date(); d.setDate(d.getDate() + offsetDias);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

let urlsVista = [];
function urlDe(blob) { const u = URL.createObjectURL(blob); urlsVista.push(u); return u; }
function liberarUrls() { urlsVista.forEach((u) => URL.revokeObjectURL(u)); urlsVista = []; }

async function comprimirFoto(file) {
  const max = 1600;
  let img;
  try { img = await createImageBitmap(file); } catch (e) {
    img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  }
  const w = img.width || img.naturalWidth, hh = img.height || img.naturalHeight;
  const esc = Math.min(1, max / Math.max(w, hh));
  const c = document.createElement('canvas');
  c.width = Math.round(w * esc); c.height = Math.round(hh * esc);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob((b) => res(b || file), 'image/jpeg', 0.82));
}

let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('ver');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('ver'), 2600);
}

/* =====================================================================
   Datos
   ===================================================================== */
const S = { ramas: [], ideas: [], nombre: '' };

const RAMAS_INICIALES = [
  { nombre: 'Negocios', color: '#C9821A' },
  { nombre: 'Canciones', color: '#4F7FE6' },
  { nombre: 'Clases', color: '#5F8A3F' },
  { nombre: 'Viajes', color: '#E05A47' }
];

async function cargar() {
  S.ramas = (await db.todos('ramas')).sort((a, b) => a.orden - b.orden);
  if (!S.ramas.length && !(await db.meta('iniciado'))) {
    S.ramas = RAMAS_INICIALES.map((r, i) => ({ id: nuevoId() + i, nombre: r.nombre, color: r.color, ramitas: [], orden: i }));
    for (const r of S.ramas) await db.guardar('ramas', r);
    await db.setMeta('iniciado', true);
  }
  S.ideas = await db.todos('ideas');
  S.nombre = await db.meta('nombre', '');
}

const rama = (id) => S.ramas.find((r) => r.id === id) || null;
async function guardarIdea(idea) {
  idea.actualizada = Date.now();
  await db.guardar('ideas', idea);
  sync.marcarSucio('idea', idea.id);
  const i = S.ideas.findIndex((x) => x.id === idea.id);
  if (i >= 0) S.ideas[i] = idea; else S.ideas.push(idea);
}
async function guardarRama(r) {
  r.actualizada = Date.now();
  await db.guardar('ramas', r);
  sync.marcarSucio('rama', r.id);
  const i = S.ramas.findIndex((x) => x.id === r.id);
  if (i >= 0) S.ramas[i] = r; else S.ramas.unshift(r);
}
function ubicacion(idea) {
  const r = rama(idea.ramaId);
  if (!r) return 'Sin rama';
  return idea.ramita && r.ramitas.includes(idea.ramita) ? r.nombre + ' › ' + idea.ramita : r.nombre;
}

/* =====================================================================
   Router
   ===================================================================== */
let grabadora = null;
let limpiarVista = null;
const UI = {
  inicio: { riegoIdx: 0 },
  ideas: { q: '', rama: 'todas', ramita: 'todas', estado: 'todas', verRamitas: false },
  ramas: { nueva: false, nuevaNombre: '', nuevaColor: '#7B5CD6', editando: null, confirmando: null, agregando: null, colorDe: null },
  nueva: null,
  detalle: {}
};

const enVista = (v) => ruta().vista === v;

function ruta() {
  const partes = (location.hash || '#/inicio').slice(2).split('/');
  return { vista: partes[0] || 'inicio', id: partes[1] ? decodeURIComponent(partes[1]) : null };
}

function render() {
  const { vista, id } = ruta();
  if (limpiarVista) { limpiarVista(); limpiarVista = null; }
  liberarUrls();
  cerrarSheet();
  document.body.classList.toggle('sin-tabbar', vista === 'nueva');
  document.querySelectorAll('#tabbar .tab').forEach((t) => t.classList.toggle('activa', t.dataset.tab === vista || (vista === 'idea' && t.dataset.tab === 'ideas') || (vista === 'ramas' && t.dataset.tab === 'ideas')));
  const vistas = { inicio: vInicio, nueva: vNueva, ideas: vIdeas, idea: vDetalle, ramas: vRamas, ajustes: vAjustes };
  (vistas[vista] || vInicio)(id);
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', render);

/* Acciones por delegación: data-a="nombre" */
const A = {};
$app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]');
  if (!el || !$app.contains(el)) return;
  const fn = A[el.dataset.a];
  if (fn) { e.preventDefault(); fn(el, e); }
});
$app.addEventListener('change', (e) => {
  const el = e.target.closest('[data-ch]');
  if (!el) return;
  const fn = A[el.dataset.ch];
  if (fn) fn(el, e);
});
$app.addEventListener('input', (e) => {
  const el = e.target.closest('[data-in]');
  if (!el) return;
  const fn = A[el.dataset.in];
  if (fn) fn(el, e);
});

/* =====================================================================
   Sheet (panel que sube desde abajo)
   ===================================================================== */
let capa = null;
function abrirSheet(html, acciones = {}) {
  cerrarSheet();
  capa = document.createElement('div');
  capa.innerHTML = `<div class="velo" data-sa="cerrar"></div><div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(capa);
  capa.addEventListener('click', (e) => {
    const el = e.target.closest('[data-sa]');
    if (!el) return;
    if (el.dataset.sa === 'cerrar') { cerrarSheet(); return; }
    if (acciones[el.dataset.sa]) { e.preventDefault(); acciones[el.dataset.sa](el, e); }
  });
  capa.addEventListener('input', (e) => {
    const el = e.target.closest('[data-si]');
    if (el && acciones[el.dataset.si]) acciones[el.dataset.si](el, e);
  });
  const foco = capa.querySelector('[autofocus]');
  if (foco) setTimeout(() => foco.focus(), 50);
  return capa.querySelector('.sheet');
}
function cerrarSheet() { if (capa) { capa.remove(); capa = null; } }
function actualizarSheet(html) { if (capa) capa.querySelector('.sheet').innerHTML = html; }

function confirmarSheet({ titulo, texto, si = 'Borrar', peligro = true }) {
  return new Promise((resolve) => {
    abrirSheet(`<span class="asa"></span>
      <div class="col" style="gap:6px"><span class="titulo-pant" style="font-size:20px">${h(titulo)}</span><span class="ayuda" style="font-size:15px">${h(texto)}</span></div>
      <div class="fila"><button class="btn borde grow" data-sa="no">Cancelar</button><button class="btn grow ${peligro ? 'peligro' : ''}" data-sa="si">${h(si)}</button></div>`,
    { no: () => { cerrarSheet(); resolve(false); }, si: () => { cerrarSheet(); resolve(true); } });
  });
}

/* =====================================================================
   Componentes compartidos
   ===================================================================== */
function htmlChipsRamas({ seleccionada, sugerida, accion, accionNueva, extra = '' }) {
  return S.ramas.map((r) => `<button type="button" class="chip ${r.id === seleccionada ? 'on' : ''}" data-a="${accion}" data-id="${r.id}">
      <span class="dot" style="background:${r.color}"></span>${r.id === sugerida ? I.chispa() : ''}${h(r.nombre)}${r.ramitas.length ? I.chevron : ''}</button>`).join('') +
    (accionNueva ? `<button type="button" class="chip nueva" data-a="${accionNueva}">+ Nueva</button>` : '') + extra;
}

function htmlRecs(recs, { conCalendario = false } = {}) {
  const filas = recs.map((rc) => {
    const d = describir(rc);
    return `<div class="rec-row ${rc.on ? '' : 'off'}">
      <div class="grow col" style="gap:1px"><span class="t">${h(d.titulo)}</span><span class="meta">${h(d.sub)}</span></div>
      ${conCalendario ? `<button type="button" class="icon-btn plano" aria-label="Agregar al calendario" data-a="recCal" data-id="${rc.id}">${I.calendario}</button>` : ''}
      <button type="button" class="switch" role="switch" aria-checked="${rc.on}" aria-label="Activar este recordatorio" data-a="recToggle" data-id="${rc.id}"><span></span></button>
      <button type="button" class="icon-btn plano" aria-label="Borrar recordatorio" data-a="recBorrar" data-id="${rc.id}">${I.x}</button>
    </div>`;
  }).join('');
  return `<div class="lista-recs">${filas || '<div class="vacio" style="padding:14px;text-align:left;font-weight:600">Sin recordatorios por ahora.</div>'}
    <button type="button" class="agregar-rec" data-a="recAgregar">${I.mas}Agregar recordatorio</button></div>`;
}

function sheetRecordatorio(onGuardar) {
  const st = { tipo: 'una', fecha: hoyISO(1), hora: '09:00', dias: [new Date().getDay()] };
  const html = () => `<span class="asa"></span>
    <div class="fila entre"><span class="titulo-pant" style="font-size:20px">Nuevo recordatorio</span>
      <button class="icon-btn" style="background:#F2F4F9;border:none" data-sa="cerrar" aria-label="Cerrar">${I.x}</button></div>
    <div class="seg" role="group" aria-label="Tipo de recordatorio">
      <button type="button" class="${st.tipo === 'una' ? 'on' : ''}" data-sa="una">Una vez</button>
      <button type="button" class="${st.tipo === 'repite' ? 'on' : ''}" data-sa="repite">Se repite</button></div>
    ${st.tipo === 'una' ? `<div class="col"><label class="label" for="r-fecha">Día</label>
      <input id="r-fecha" class="input" type="date" value="${st.fecha}" min="${hoyISO()}" data-si="fecha" style="height:50px;font-weight:700;font-size:17px"></div>`
    : `<div class="col"><span class="label">Qué días</span><div class="dias" role="group" aria-label="Días de la semana">
      ${ORDEN_SEMANA.map((d, i) => `<button type="button" class="dia ${st.dias.includes(d) ? 'on' : ''}" aria-label="${NOMBRES_DIA[d]}" aria-pressed="${st.dias.includes(d)}" data-sa="dia" data-d="${d}">${'LMMJVSD'[i]}</button>`).join('')}
      </div></div>`}
    <div class="col"><label class="label" for="r-hora">Hora</label>
      <input id="r-hora" class="input" type="time" value="${st.hora}" data-si="hora" style="height:50px;font-weight:700;font-size:17px"></div>
    <button type="button" class="btn" data-sa="guardar">Guardar recordatorio</button>`;
  const acc = {
    una: () => { st.tipo = 'una'; actualizarSheet(html()); },
    repite: () => { st.tipo = 'repite'; actualizarSheet(html()); },
    dia: (el) => { const d = Number(el.dataset.d); st.dias = st.dias.includes(d) ? st.dias.filter((x) => x !== d) : st.dias.concat([d]); actualizarSheet(html()); },
    fecha: (el) => { st.fecha = el.value; },
    hora: (el) => { st.hora = el.value; },
    guardar: () => {
      if (!st.hora) { toast('Elegí una hora'); return; }
      if (st.tipo === 'repite' && !st.dias.length) { toast('Elegí al menos un día'); return; }
      if (st.tipo === 'una' && !st.fecha) { toast('Elegí un día'); return; }
      const rec = { id: nuevoId(), tipo: st.tipo, fecha: st.fecha, hora: st.hora, dias: st.dias.slice(), on: true, creado: Date.now() };
      cerrarSheet();
      onGuardar(rec);
    }
  };
  abrirSheet(html(), acc);
}

function exportarCalendario(idea, rec) {
  const url = location.href.split('#')[0] + '#/idea/' + encodeURIComponent(idea.id);
  const ics = crearICS(idea, rec, url);
  if (esIOS) {
    // En iPhone, abrir el .ics muestra directamente "Agregar al calendario".
    location.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
    return;
  }
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'nomeolvides-' + (idea.titulo || 'idea').slice(0, 30).replace(/[^\w\-áéíóúñ ]/gi, '') + '.ics';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast('Abrí el archivo descargado para sumarlo a tu calendario');
}

/* =====================================================================
   INICIO
   ===================================================================== */
function saludo() {
  const hr = new Date().getHours();
  const base = hr < 6 ? 'Buenas noches' : hr < 13 ? 'Buen día' : hr < 20 ? 'Buenas tardes' : 'Buenas noches';
  return S.nombre ? 'Hola, ' + S.nombre : base;
}

function candidatasRiego() {
  return S.ideas.filter((i) => i.estado !== 'flor')
    .sort((a, b) => (a.actualizada || a.creada) - (b.actualizada || b.creada));
}

function vInicio() {
  const cuenta = { semilla: 0, brote: 0, flor: 0 };
  S.ideas.forEach((i) => { cuenta[i.estado] = (cuenta[i.estado] || 0) + 1; });
  const pend = pendientes(S.ideas);
  const cand = candidatasRiego();
  const riego = cand.length ? cand[UI.inicio.riegoIdx % cand.length] : null;

  $app.innerHTML = `
    <div class="fila entre header">
      <div class="fila">${I.logo}<span class="marca">nomeolvides</span></div>
      <a href="#/ajustes" class="icon-btn" aria-label="Ajustes">${I.engranaje}</a>
    </div>
    <div class="col" style="gap:6px;margin-top:4px">
      <div class="saludo">${h(saludo())}</div>
      <div class="sub" style="font-size:17px">¿Qué se te ocurrió hoy?</div>
    </div>
    ${pend.length ? `<div class="col" style="gap:8px">
      <div class="aviso-banner">${I.campana}<span class="grow" style="font-size:15px;font-weight:800">${pend.length === 1 ? 'Tenés 1 idea para retomar' : 'Tenés ' + pend.length + ' ideas para retomar'}</span>
        <button class="link-btn" data-a="verTodosAvisos">Listo</button></div>
      ${pend.slice(0, 3).map((p) => `<a class="idea-card" href="#/idea/${encodeURIComponent(p.idea.id)}" style="padding:12px">
        <div class="tipo-ico t-${p.idea.tipo}">${I[p.idea.tipo]}</div>
        <div class="grow col" style="gap:2px"><span class="t">${h(p.idea.titulo)}</span><span class="meta">${h(describir(p.rec).titulo)}</span></div></a>`).join('')}
    </div>` : ''}
    <div class="card col" style="gap:14px;padding:20px;border-radius:24px">
      <span style="font-size:15px;font-weight:800;color:var(--ink-2)">Tu árbol</span>
      <div class="stats">
        <div class="stat" style="background:var(--seed-bg);color:var(--seed-ink)"><b>${cuenta.semilla}</b><span>${cuenta.semilla === 1 ? 'semilla' : 'semillas'}</span></div>
        <div class="stat" style="background:var(--sprout-bg);color:var(--sprout-ink)"><b>${cuenta.brote}</b><span>${cuenta.brote === 1 ? 'brote' : 'brotes'}</span></div>
        <div class="stat" style="background:var(--flower-bg);color:var(--flower-ink)"><b>${cuenta.flor}</b><span>${cuenta.flor === 1 ? 'flor' : 'flores'}</span></div>
      </div>
    </div>
    ${riego ? `<div class="card-oscura">
      <div class="eyebrow">${I.chispa('#F2C14E', 16)}PARA UN RATO LIBRE</div>
      <div class="riego-titulo">${h(riego.titulo)}</div>
      <div style="font-size:14px;font-weight:600;color:#C9D6F5">${h(ubicacion(riego))} · guardada ${hace(riego.creada)}</div>
      <div class="fila" style="margin-top:6px">
        <a class="btn-azul" href="#/idea/${encodeURIComponent(riego.id)}">La retomo</a>
        ${cand.length > 1 ? '<button class="btn-claro-borde" data-a="otraRiego">Mostrame otra</button>' : ''}
      </div></div>`
    : `<div class="card-oscura"><div class="eyebrow">${I.chispa('#F2C14E', 16)}TU PRIMERA SEMILLA</div>
      <div class="riego-titulo">${S.ideas.length ? '¡Todas tus ideas florecieron!' : 'Todavía no guardaste ninguna idea'}</div>
      <div style="font-size:15px;font-weight:600;color:#C9D6F5">Tocá el botón + de abajo para guardar una idea, una nota de voz o una melodía.</div></div>`}
  `;
}
A.otraRiego = () => { UI.inicio.riegoIdx++; vInicio(); };
A.verTodosAvisos = async () => {
  const ahora = Date.now();
  for (const p of pendientes(S.ideas)) {
    const idea = S.ideas.find((i) => i.id === p.idea.id);
    idea.recordatorios = idea.recordatorios.map((r) => r.id === p.rec.id ? { ...r, visto: ahora } : r);
    await guardarIdea(idea);
  }
  if (enVista('inicio')) vInicio();
};

/* =====================================================================
   NUEVA IDEA
   ===================================================================== */
function nuevoBorrador() {
  return { tipo: 'texto', texto: '', titulo: '', ramaId: null, ramaElegida: false, ramita: null, recs: [], audio: null, fotos: [],
    verRamitas: false, creandoRama: false, creandoRamita: false, grabando: false, segundos: 0, transcripcion: '' };
}

function vNueva() {
  if (!UI.nueva) UI.nueva = nuevoBorrador();
  const B = UI.nueva;
  $app.innerHTML = `
    <div class="fila entre header">
      <a href="#/inicio" class="icon-btn" aria-label="Volver al inicio" data-a="salirNueva">${I.atras}</a>
      <span class="titulo-pant">Nueva idea</span><span style="width:44px"></span>
    </div>
    <div class="seg" role="group" aria-label="Cómo guardar la idea">
      <button type="button" class="${B.tipo === 'texto' ? 'on' : ''}" data-a="tipo" data-t="texto">${I.texto}Escribir</button>
      <button type="button" class="${B.tipo === 'voz' ? 'on' : ''}" data-a="tipo" data-t="voz">${I.voz}Voz</button>
      <button type="button" class="${B.tipo === 'melodia' ? 'on' : ''}" data-a="tipo" data-t="melodia">${I.melodia}Melodía</button>
    </div>
    <div id="n-captura">${htmlCaptura()}</div>
    <div id="n-fotos">${htmlFotosNueva()}</div>
    <div class="col">
      <label class="label" for="n-titulo">Título <span style="font-weight:600;color:var(--muted-2)">(opcional)</span></label>
      <input id="n-titulo" class="input" type="text" placeholder="Si no le ponés, la app le pone uno" value="${h(B.titulo)}" data-in="nTitulo" maxlength="120">
    </div>
    <div class="col" style="gap:10px" id="n-rama">${htmlSeccionRama()}</div>
    <div class="col" style="gap:10px">
      <div class="col" style="gap:2px"><span class="label">Recordámela</span><span class="ayuda">Poné los avisos que quieras, como alarmas.</span></div>
      <div id="n-recs">${htmlRecs(B.recs)}</div>
    </div>
    <div class="guardar-bar"><button type="button" class="btn" data-a="guardarNueva" id="btn-guardar">Guardar idea</button></div>
  `;
  limpiarVista = () => { if (grabadora) { grabadora.cancelar(); grabadora = null; UI.nueva.grabando = false; } };
  actualizarSugerencia(false);
}

function htmlCaptura() {
  const B = UI.nueva;
  if (B.tipo === 'texto') {
    return `<div class="col"><label class="label" for="n-texto">Tu idea</label>
      <textarea id="n-texto" class="textarea" placeholder="Contá la idea como te salga, después la ordenás." data-in="nTexto">${h(B.texto)}</textarea>
      ${esIOS ? '<span class="ayuda">Tip: para dictar, tocá el micrófono del teclado del iPhone.</span>' : ''}</div>`;
  }
  const melodia = B.tipo === 'melodia';
  if (!puedeGrabar) {
    return `<div class="grabador"><span class="ayuda" style="text-align:center;font-size:15px">Este navegador no permite grabar audio. Probá desde Safari en el iPhone o Chrome en la compu.</span></div>`;
  }
  if (B.audio && !B.grabando) {
    return `<div class="grabador">
      <audio controls src="${urlDe(B.audio.blob)}"></audio>
      <span class="meta">${melodia ? 'Melodía' : 'Nota de voz'} de ${formatoTiempo(B.audio.duracion)}</span>
      ${!melodia ? htmlTranscripcion() : ''}
      <button type="button" class="btn borde chico" data-a="regrabar">Grabar de nuevo</button></div>`;
  }
  const ayuda = B.grabando ? 'Grabando… tocá para terminar.' :
    melodia ? 'Tarareá o cantá. Se guarda el audio tal cual.' :
      puedeTranscribir ? 'Tocá y hablá. Lo paso a texto solo.' : 'Tocá y hablá. Se guarda tu nota de voz.';
  return `<div class="grabador">
    <button type="button" class="rec-btn ${melodia ? 'melodia' : 'voz'} ${B.grabando ? 'grabando' : ''}" data-a="grabar" aria-label="${B.grabando ? 'Terminar grabación' : 'Empezar a grabar'}">${B.grabando ? I.stop : (melodia ? I.melodia : I.voz).replace(/width="20" height="20"/, 'width="32" height="32"')}</button>
    ${B.grabando ? `<div class="fila"><div class="nivel" id="nivel">${'<i></i>'.repeat(18)}</div><span id="reloj" style="font-size:16px;font-weight:800;color:var(--melody-ink)">${formatoTiempo(B.segundos)}</span></div>` : ''}
    <span style="font-size:15px;font-weight:700;color:var(--ink-2);text-align:center">${ayuda}</span>
    ${!melodia && B.grabando && puedeTranscribir ? `<div class="transcripcion" id="trans">${h(B.transcripcion) || 'Te escucho…'}</div>` : ''}
    ${!melodia && !B.grabando && esIOS ? '<span class="ayuda" style="text-align:center">En el iPhone se guarda el audio. Si preferís texto, usá "Escribir" y el micrófono del teclado.</span>' : ''}
  </div>`;
}
function htmlFotos(fotos, { quitar, agregar, ver }) {
  return `<div class="fotos">${fotos.map((f) => `<div class="foto-mini">
      <button type="button" style="all:unset;display:block;width:100%;height:100%;cursor:pointer" ${ver ? `data-a="${ver}" data-id="${f.id}" aria-label="Ver foto"` : 'tabindex="-1"'}><img src="${f.url}" alt=""></button>
      <button type="button" class="quitar" aria-label="Quitar foto" data-a="${quitar}" data-id="${f.id}">${I.xs}</button></div>`).join('')}
    <label class="foto-add">${I.camara}Agregar<input type="file" accept="image/*" multiple class="sr-only" data-ch="${agregar}"></label></div>`;
}
function htmlFotosNueva() {
  const B = UI.nueva;
  if (B.tipo === 'melodia') return '';
  const fotos = B.fotos.map((f) => ({ id: f.id, url: urlDe(f.blob) }));
  return `<div class="col"><span class="label">Fotos <span style="font-weight:600;color:var(--muted-2)">(opcional)</span></span>
    ${htmlFotos(fotos, { quitar: 'nQuitarFoto', agregar: 'nAgregarFotos' })}</div>`;
}
const repintarFotosNueva = () => { document.getElementById('n-fotos').innerHTML = htmlFotosNueva(); };
A.nAgregarFotos = async (el) => {
  const files = [...el.files];
  if (!files.length) return;
  toast(files.length === 1 ? 'Agregando foto…' : 'Agregando fotos…');
  for (const f of files) {
    try { UI.nueva.fotos.push({ id: 'f-' + nuevoId(), blob: await comprimirFoto(f) }); } catch (e) { toast('No pude abrir una de las fotos'); }
  }
  if (enVista('nueva')) repintarFotosNueva();
};
A.nQuitarFoto = (el) => { UI.nueva.fotos = UI.nueva.fotos.filter((f) => f.id !== el.dataset.id); repintarFotosNueva(); };

function htmlTranscripcion() {
  const B = UI.nueva;
  if (!puedeTranscribir && !B.transcripcion) {
    return `<div class="col" style="align-self:stretch"><label class="label" for="n-nota">Notas (opcional)</label>
      <textarea id="n-nota" class="textarea" style="height:90px" placeholder="Algo para acordarte de qué se trata" data-in="nTrans">${h(B.transcripcion)}</textarea></div>`;
  }
  return `<div class="col" style="align-self:stretch"><label class="label" for="n-nota">Lo que dijiste <span style="font-weight:600;color:var(--muted-2)">(podés corregirlo)</span></label>
    <textarea id="n-nota" class="textarea" style="height:110px" data-in="nTrans">${h(B.transcripcion)}</textarea></div>`;
}

function htmlSeccionRama() {
  const B = UI.nueva;
  const sel = rama(B.ramaId);
  if (B.verRamitas && sel) {
    return `<div class="fila entre"><span class="label">Rama</span><a href="#/ramas" class="link-btn" style="display:flex;align-items:center">Editar ramas</a></div>
    <div class="panel-ramitas">
      <div class="fila"><button type="button" class="chip sm volver claro" data-a="volverRamas">${I.atras.replace(/20/g, '16')}Ramas</button>
        <span class="punto" style="background:${sel.color}"></span><span style="font-size:16px;font-weight:800">${h(sel.nombre)}</span></div>
      <span class="ayuda">¿De qué parte de ${h(sel.nombre)}? Por ejemplo, a cuál de tus proyectos va.</span>
      <div class="fila wrap" style="gap:8px">
        <button type="button" class="chip sm ${!B.ramita ? 'on' : ''}" data-a="elegirRamita" data-m="">General</button>
        ${sel.ramitas.map((m) => `<button type="button" class="chip sm ${B.ramita === m ? 'on' : ''}" data-a="elegirRamita" data-m="${h(m)}">${h(m)}</button>`).join('')}
        <button type="button" class="chip sm nueva" data-a="abrirRamita">+ Nueva</button>
      </div>
      ${B.creandoRamita ? `<div class="fila" style="gap:8px"><label for="n-ramita" class="sr-only">Nombre de la nueva ramita</label>
        <input id="n-ramita" class="input" style="height:44px" placeholder="Ej: Cafetería, Banda, Curso…" maxlength="40" autofocus>
        <button type="button" class="btn chico" data-a="crearRamita">Crear</button></div>` : ''}
      <button type="button" class="btn chico" data-a="volverRamas" style="align-self:flex-end">Listo</button>
    </div>`;
  }
  return `<div class="fila entre"><span class="label">Rama</span><a href="#/ramas" class="link-btn" style="display:flex;align-items:center">Editar ramas</a></div>
    ${B.ramaSugerida && !B.ramaElegida ? `<div class="fila" style="gap:6px;font-size:13px;font-weight:700;color:var(--muted-2)">${I.chispa()}La app sugiere una rama; tocá otra si querés.</div>` : ''}
    ${sel ? `<span class="meta">Elegida: <b style="color:var(--ink)">${h(sel.nombre)}${B.ramita ? ' › ' + h(B.ramita) : ''}</b></span>` : ''}
    <div class="fila wrap" style="gap:8px">${htmlChipsRamas({ seleccionada: B.ramaId, sugerida: B.ramaElegida ? null : B.ramaSugerida, accion: 'elegirRama', accionNueva: 'abrirRama' })}</div>
    ${B.creandoRama ? `<div class="fila" style="gap:8px;padding:10px;border-radius:16px;background:#FFF;border:1.5px solid var(--blue)">
      <label for="n-rama-nombre" class="sr-only">Nombre de la nueva rama</label>
      <input id="n-rama-nombre" class="input" style="height:44px" placeholder="Nombre de la rama" maxlength="40" autofocus>
      <button type="button" class="btn chico" data-a="crearRama">Crear</button>
      <button type="button" class="icon-btn plano" style="background:#F2F4F9" data-a="cerrarRama" aria-label="Cancelar">${I.x}</button></div>` : ''}`;
}
function repintarRama() {
  document.getElementById('n-rama').innerHTML = htmlSeccionRama();
  const f = document.querySelector('#n-rama [autofocus]');
  if (f) f.focus();
}
function repintarCaptura() { document.getElementById('n-captura').innerHTML = htmlCaptura(); }

let sugerirTimer;
function actualizarSugerencia(repintar = true) {
  const B = UI.nueva;
  if (!B || !enVista('nueva') || B.ramaElegida) return;
  const texto = [B.titulo, B.texto, B.transcripcion].join(' ');
  const id = sugerirRama(texto, B.tipo, S.ramas);
  if (id !== B.ramaSugerida || (id && B.ramaId !== id)) {
    B.ramaSugerida = id;
    B.ramaId = id;
    B.ramita = id ? sugerirRamita(texto, rama(id)) : null;
    if (repintar) repintarRama(); else document.getElementById('n-rama').innerHTML = htmlSeccionRama();
  }
}
const sugerirLuego = () => { clearTimeout(sugerirTimer); sugerirTimer = setTimeout(() => actualizarSugerencia(), 500); };

A.nTexto = (el) => { UI.nueva.texto = el.value; sugerirLuego(); };
A.nTitulo = (el) => { UI.nueva.titulo = el.value; sugerirLuego(); };
A.nTrans = (el) => { UI.nueva.transcripcion = el.value; sugerirLuego(); };
A.tipo = (el) => {
  const B = UI.nueva;
  if (B.grabando) { toast('Primero terminá la grabación'); return; }
  if (B.tipo === el.dataset.t) return;
  if (B.audio && el.dataset.t !== B.tipo && el.dataset.t !== 'texto') { /* se mantiene el audio solo para su tipo */ }
  B.tipo = el.dataset.t;
  if (B.audio && B.audio.tipo !== B.tipo) B.audio = null;
  document.querySelectorAll('.seg [data-a="tipo"]').forEach((b) => b.classList.toggle('on', b.dataset.t === B.tipo));
  repintarCaptura();
  repintarFotosNueva();
  actualizarSugerencia();
};
A.grabar = async () => {
  const B = UI.nueva;
  if (!B.grabando) {
    try {
      grabadora = new Grabadora({
        transcribir: B.tipo === 'voz',
        esMelodia: B.tipo === 'melodia',
        onNivel: (n) => {
          const barras = document.querySelectorAll('#nivel i');
          barras.forEach((b, i) => {
            const k = 0.35 + 0.65 * Math.abs(Math.sin((Date.now() / 140) + i));
            b.style.height = Math.max(5, Math.round(32 * n * k)) + 'px';
          });
        },
        onTiempo: (s) => { B.segundos = s; const r = document.getElementById('reloj'); if (r) r.textContent = formatoTiempo(s); },
        onTexto: (t) => { B.transcripcion = t; const el = document.getElementById('trans'); if (el) el.textContent = t || 'Te escucho…'; }
      });
      B.transcripcion = '';
      B.segundos = 0;
      await grabadora.empezar();
      B.grabando = true;
      repintarCaptura();
    } catch (e) {
      grabadora = null;
      toast('No pude usar el micrófono. Revisá los permisos.');
    }
  } else {
    const res = await grabadora.terminar();
    grabadora = null;
    B.grabando = false;
    if (res.blob.size < 200) { toast('La grabación quedó vacía, probá de nuevo'); repintarCaptura(); return; }
    B.audio = { blob: res.blob, duracion: res.duracion, tipo: B.tipo };
    if (res.texto) B.transcripcion = res.texto;
    repintarCaptura();
    actualizarSugerencia();
  }
};
A.regrabar = () => { const B = UI.nueva; B.audio = null; B.transcripcion = ''; repintarCaptura(); };
A.elegirRama = (el) => {
  const B = UI.nueva;
  const r = rama(el.dataset.id);
  if (B.ramaId !== r.id) B.ramita = null;
  B.ramaId = r.id; B.ramaElegida = true; B.creandoRama = false; B.creandoRamita = false;
  B.verRamitas = true;
  repintarRama();
};
A.volverRamas = () => { UI.nueva.verRamitas = false; UI.nueva.creandoRamita = false; repintarRama(); };
A.elegirRamita = (el) => { UI.nueva.ramita = el.dataset.m || null; repintarRama(); };
A.abrirRama = () => { UI.nueva.creandoRama = true; repintarRama(); };
A.cerrarRama = () => { UI.nueva.creandoRama = false; repintarRama(); };
A.crearRama = async () => {
  const inp = document.getElementById('n-rama-nombre');
  const nombre = inp.value.trim();
  if (!nombre) { inp.focus(); return; }
  let r = S.ramas.find((x) => x.nombre.toLowerCase() === nombre.toLowerCase());
  if (!r) {
    const usados = S.ramas.map((x) => x.color);
    const color = (PALETA.find(([c]) => !usados.includes(c)) || PALETA[0])[0];
    r = { id: nuevoId(), nombre, color, ramitas: [], orden: S.ramas.length };
    await guardarRama(r);
    S.ramas = S.ramas.filter((x) => x.id !== r.id).concat([r]);
  }
  const B = UI.nueva;
  B.ramaId = r.id; B.ramita = null; B.ramaElegida = true; B.creandoRama = false; B.verRamitas = true;
  repintarRama();
  toast('Rama "' + nombre + '" creada');
};
A.abrirRamita = () => { UI.nueva.creandoRamita = !UI.nueva.creandoRamita; repintarRama(); };
A.crearRamita = async () => {
  const inp = document.getElementById('n-ramita');
  const m = inp.value.trim();
  if (!m) { inp.focus(); return; }
  const r = rama(UI.nueva.ramaId);
  if (!r.ramitas.includes(m)) { r.ramitas.push(m); await guardarRama(r); }
  UI.nueva.ramita = m; UI.nueva.creandoRamita = false;
  repintarRama();
};
A.salirNueva = () => { location.hash = '#/inicio'; };
A.guardarNueva = async () => {
  const B = UI.nueva;
  if (B.grabando) { toast('Primero terminá la grabación'); return; }
  const texto = B.tipo === 'texto' ? B.texto.trim() : (B.transcripcion || '').trim();
  if (B.tipo === 'texto' && !texto && !B.titulo.trim() && !B.fotos.length) { toast('Escribí algo de tu idea'); document.getElementById('n-texto').focus(); return; }
  if (B.tipo !== 'texto' && !B.audio) { toast('Primero grabá ' + (B.tipo === 'melodia' ? 'la melodía' : 'la nota de voz')); return; }
  const btn = document.getElementById('btn-guardar');
  btn.disabled = true;
  const id = nuevoId();
  let audioId = null;
  if (B.audio) {
    audioId = 'a-' + id;
    await db.guardar('audios', { id: audioId, blob: B.audio.blob, tipo: B.audio.blob.type });
  }
  const fotos = B.tipo === 'melodia' ? [] : B.fotos;
  for (const f of fotos) await db.guardar('fotos', { id: f.id, blob: f.blob, tipo: f.blob.type, ideaId: id });
  const idea = {
    id, titulo: B.titulo.trim() || tituloAutomatico(texto, B.tipo), texto, tipo: B.tipo, audioId, fotos: fotos.map((f) => f.id),
    duracion: B.audio ? B.audio.duracion : 0, ramaId: B.ramaId, ramita: B.ramita, estado: 'semilla',
    notas: [], recordatorios: B.recs, creada: Date.now()
  };
  await guardarIdea(idea);
  UI.nueva = null;
  toast('¡Idea guardada! 🌱');
  location.hash = '#/idea/' + encodeURIComponent(id);
};

/* recordatorios: compartidos entre Nueva y Detalle */
function recsActuales() {
  const { vista, id } = ruta();
  if (vista === 'nueva') return { lista: UI.nueva.recs, guardar: async (l) => { UI.nueva.recs = l; document.getElementById('n-recs').innerHTML = htmlRecs(l); } };
  const idea = S.ideas.find((i) => i.id === id);
  return { idea, lista: idea.recordatorios || [], guardar: async (l) => { idea.recordatorios = l; await guardarIdea(idea); document.getElementById('d-recs').innerHTML = htmlRecs(l, { conCalendario: true }); } };
}
A.recAgregar = () => {
  const c = recsActuales();
  sheetRecordatorio(async (rec) => {
    await c.guardar(c.lista.concat([rec]));
    if (c.idea) {
      const ok = await confirmarSheet({ titulo: '¿Lo sumo a tu calendario?', texto: 'Así el aviso te llega con la alarma del calendario, aunque la app esté cerrada.', si: 'Sí, agregar', peligro: false });
      if (ok) exportarCalendario(c.idea, rec);
    } else toast('Recordatorio agregado');
  });
};
A.recToggle = async (el) => { const c = recsActuales(); await c.guardar(c.lista.map((r) => r.id === el.dataset.id ? { ...r, on: !r.on } : r)); };
A.recBorrar = async (el) => { const c = recsActuales(); await c.guardar(c.lista.filter((r) => r.id !== el.dataset.id)); };
A.recCal = (el) => { const c = recsActuales(); const rec = c.lista.find((r) => r.id === el.dataset.id); if (rec) exportarCalendario(c.idea, rec); };

/* =====================================================================
   MIS IDEAS
   ===================================================================== */
function vIdeas() {
  $app.innerHTML = `
    <div class="fila entre header" style="align-items:baseline"><h1 class="h1">Mis ideas</h1><span class="meta" id="i-cuenta" style="font-size:14px"></span></div>
    <div style="position:relative"><label for="buscar" class="sr-only">Buscar ideas</label>
      <span style="position:absolute;left:14px;top:14px">${I.lupa}</span>
      <input id="buscar" class="input" type="search" placeholder="Buscar en tus ideas" style="padding-left:44px" value="${h(UI.ideas.q)}" data-in="buscar"></div>
    <div id="i-filtros"></div>
    <div class="seg" role="group" aria-label="Filtrar por estado" id="i-estados"></div>
    <div class="col" style="gap:10px" id="i-lista"></div>`;
  pintarFiltros();
  pintarLista();
}
function pintarFiltros() {
  const U = UI.ideas;
  const sel = rama(U.rama);
  const sinRama = S.ideas.some((i) => !rama(i.ramaId));
  let html;
  if (U.verRamitas && sel) {
    html = `<div class="scroll-x" role="group" aria-label="Filtrar por ramita">
      <button type="button" class="chip volver" data-a="iVolver">${I.atras.replace(/20/g, '16')}${h(sel.nombre)}</button>
      <button type="button" class="chip ${U.ramita === 'todas' ? 'on' : ''}" data-a="iRamita" data-m="">Todas</button>
      ${sel.ramitas.map((m) => `<button type="button" class="chip ${U.ramita === m ? 'on' : ''}" data-a="iRamita" data-m="${h(m)}">${h(m)}</button>`).join('')}</div>`;
  } else {
    html = `<div class="scroll-x" role="group" aria-label="Filtrar por rama">
      <button type="button" class="chip ${U.rama === 'todas' ? 'on' : ''}" data-a="iRama" data-id="todas">Todas</button>
      ${htmlChipsRamas({ seleccionada: U.rama, accion: 'iRama' })}
      ${sinRama ? `<button type="button" class="chip ${U.rama === 'sin' ? 'on' : ''}" data-a="iRama" data-id="sin">Sin rama</button>` : ''}
      <a href="#/ramas" class="chip nueva" style="color:var(--blue-link)">${I.lapiz.replace(/19/g, '16')}Editar</a></div>`;
  }
  document.getElementById('i-filtros').innerHTML = html;
  document.getElementById('i-estados').innerHTML = ['todas', 'semilla', 'brote', 'flor'].map((e) =>
    `<button type="button" class="${U.estado === e ? 'on' : ''}" data-a="iEstado" data-e="${e}" style="height:40px">${PLURAL[e]}</button>`).join('');
}
async function cargarMiniaturas() {
  for (const img of document.querySelectorAll('#i-lista img[data-foto]')) {
    const f = await db.obtener('fotos', img.dataset.foto);
    if (f && img.isConnected) img.src = urlDe(f.blob);
  }
}
function pintarLista() {
  const U = UI.ideas;
  const q = U.q.trim().toLowerCase();
  const lista = S.ideas
    .filter((i) => U.rama === 'todas' || (U.rama === 'sin' ? !rama(i.ramaId) : i.ramaId === U.rama))
    .filter((i) => U.ramita === 'todas' || i.ramita === U.ramita)
    .filter((i) => U.estado === 'todas' || i.estado === U.estado)
    .filter((i) => !q || [i.titulo, i.texto, ubicacion(i), ...(i.notas || []).map((n) => n.texto)].join(' ').toLowerCase().includes(q))
    .sort((a, b) => b.creada - a.creada);
  document.getElementById('i-cuenta').textContent = lista.length + (lista.length === 1 ? ' idea' : ' ideas');
  document.getElementById('i-lista').innerHTML = lista.length ? lista.map((i) => `
    <a class="idea-card" href="#/idea/${encodeURIComponent(i.id)}">
      <div class="tipo-ico t-${i.tipo}">${I[i.tipo]}</div>
      <div class="grow col" style="gap:4px">
        <span class="t">${h(i.titulo)}</span>
        ${i.texto && i.texto !== i.titulo ? `<span class="n">${h(i.texto)}</span>` : (i.tipo !== 'texto' ? `<span class="n">${i.tipo === 'melodia' ? 'Melodía' : 'Nota de voz'} de ${formatoTiempo(i.duracion || 0)}</span>` : '')}
        <div class="fila entre" style="margin-top:4px"><span class="meta">${h(ubicacion(i))} · ${hace(i.creada)}</span><span class="estado est-${i.estado}">${ESTADOS[i.estado]}</span></div>
      </div>${(i.fotos || []).length ? `<img class="mini-card" data-foto="${i.fotos[0]}" alt="">` : ''}</a>`).join('')
    : `<div class="vacio">${S.ideas.length ? 'No hay ideas con este filtro.' : 'Todavía no guardaste ideas. Tocá + para la primera.'}</div>`;
  cargarMiniaturas();
}
A.buscar = (el) => { UI.ideas.q = el.value; pintarLista(); };
A.iRama = (el) => {
  const U = UI.ideas;
  U.rama = el.dataset.id; U.ramita = 'todas';
  const r = rama(U.rama);
  U.verRamitas = !!(r && r.ramitas.length);
  pintarFiltros(); pintarLista();
};
A.iVolver = () => { UI.ideas.verRamitas = false; UI.ideas.ramita = 'todas'; pintarFiltros(); pintarLista(); };
A.iRamita = (el) => { UI.ideas.ramita = el.dataset.m || 'todas'; pintarFiltros(); pintarLista(); };
A.iEstado = (el) => { UI.ideas.estado = el.dataset.e; pintarFiltros(); pintarLista(); };

/* =====================================================================
   DETALLE
   ===================================================================== */
async function vDetalle(id) {
  const idea = S.ideas.find((i) => i.id === id);
  if (!idea) { $app.innerHTML = `<div class="fila header"><a href="#/ideas" class="icon-btn" aria-label="Volver">${I.atras}</a></div><div class="vacio">Esta idea ya no existe.</div>`; return; }
  // Al abrirla, los avisos que ya sonaron quedan vistos.
  const ahora = Date.now();
  if (pendientes([idea]).length) {
    idea.recordatorios = idea.recordatorios.map((r) => ({ ...r, visto: ahora }));
    await guardarIdea(idea);
  }
  const r = rama(idea.ramaId);
  $app.innerHTML = `
    <div class="fila entre header">
      <a href="#/ideas" class="icon-btn" aria-label="Volver a mis ideas">${I.atras}</a>
      <button type="button" class="icon-btn" aria-label="Más opciones" data-a="dMenu">${I.puntos}</button>
    </div>
    <div class="col">
      <button type="button" class="tag-rama" data-a="dRama">${r ? `<span class="punto" style="width:10px;height:10px;background:${r.color}"></span>` : ''}${h(ubicacion(idea))}${I.chevron}</button>
      <div style="font-size:26px;font-weight:800;letter-spacing:-.4px;line-height:1.2">${h(idea.titulo)}</div>
      <div class="meta" style="font-size:14px;font-weight:600">Guardada el ${fechaLarga(idea.creada)} · ${idea.tipo === 'melodia' ? 'melodía' : idea.tipo === 'voz' ? 'nota de voz' : 'texto'}</div>
    </div>
    ${idea.audioId ? '<div class="card" id="d-audio" style="padding:12px 14px"><span class="meta">Cargando audio…</span></div>' : ''}
    ${idea.texto && idea.texto !== idea.titulo ? `<div class="card" style="font-size:16px;font-weight:600;line-height:1.5;white-space:pre-wrap">${h(idea.texto)}</div>` : ''}
    ${idea.tipo !== 'melodia' || (idea.fotos || []).length ? `<div class="col" style="gap:10px"><span style="font-size:16px;font-weight:800">Fotos</span><div id="d-fotos"></div></div>` : ''}
    <div class="card col" style="gap:10px">
      <span class="label">¿En qué estado está?</span>
      <div class="estados" role="group" aria-label="Estado de la idea">
        ${['semilla', 'brote', 'flor'].map((e) => `<button type="button" class="${e} ${idea.estado === e ? 'on' : ''}" aria-pressed="${idea.estado === e}" data-a="dEstado" data-e="${e}">${I[e]}${ESTADOS[e]}</button>`).join('')}
      </div>
      <span class="ayuda" style="font-size:14px">${{ semilla: 'Recién guardada, todavía sin tocar.', brote: 'La estás trabajando. Seguí sumándole cosas.', flor: '¡La usaste! Suma una flor a tu árbol.' }[idea.estado]}</span>
    </div>
    <div class="col" style="gap:10px">
      <span style="font-size:16px;font-weight:800">Lo que le fuiste sumando</span>
      ${(idea.notas || []).map((n) => `<div class="nota"><div class="fila entre"><span class="f">${fechaNota(n.fecha)}</span>
        <button type="button" class="icon-btn plano" style="width:32px;height:32px;color:var(--muted-2)" aria-label="Borrar nota" data-a="dBorrarNota" data-id="${n.id}">${I.xs}</button></div><span class="x">${h(n.texto)}</span></div>`).join('')}
      <div class="fila" style="gap:8px"><label for="d-nota" class="sr-only">Agregar algo a esta idea</label>
        <input id="d-nota" class="input grow" placeholder="Agregá algo a esta idea" maxlength="1000">
        <button type="button" class="icon-btn" style="width:48px;height:48px;border-radius:14px;border:none;background:var(--blue);color:#FFF" aria-label="Agregar nota" data-a="dNota">${I.mas}</button></div>
    </div>
    <div class="col" style="gap:10px">
      <div class="col" style="gap:2px"><span style="font-size:16px;font-weight:800">Recordatorios</span>
      <span class="ayuda">Con ${I.calendario.replace(/19/g, '14')} lo sumás al calendario de tu celular para que te avise aunque la app esté cerrada.</span></div>
      <div id="d-recs">${htmlRecs(idea.recordatorios || [], { conCalendario: true })}</div>
    </div>`;
  document.getElementById('d-nota').addEventListener('keydown', (e) => { if (e.key === 'Enter') A.dNota(); });
  pintarFotosDetalle(idea);
  if (idea.audioId) {
    const a = await db.obtener('audios', idea.audioId);
    const cont = document.getElementById('d-audio');
    if (cont && a) {
      const url = urlDe(a.blob);
      cont.innerHTML = `<audio controls preload="metadata" src="${url}"></audio><span class="meta">${idea.tipo === 'melodia' ? 'Melodía' : 'Nota de voz'} · ${formatoTiempo(idea.duracion || 0)}</span>`;
      cont.classList.add('col');
    } else if (cont) cont.innerHTML = '<span class="meta">No encontré el audio.</span>';
  }
}
const ideaActual = () => S.ideas.find((i) => i.id === ruta().id);
async function pintarFotosDetalle(idea) {
  const cont = document.getElementById('d-fotos');
  if (!cont) return;
  const fotos = [];
  for (const id of idea.fotos || []) {
    const f = await db.obtener('fotos', id);
    if (f) fotos.push({ id, url: urlDe(f.blob) });
  }
  const c = document.getElementById('d-fotos');
  if (c && enVista('idea')) c.innerHTML = htmlFotos(fotos, { quitar: 'dQuitarFoto', agregar: 'dAgregarFotos', ver: 'dVerFoto' });
}
A.dAgregarFotos = async (el) => {
  const idea = ideaActual();
  const files = [...el.files];
  if (!files.length) return;
  toast(files.length === 1 ? 'Agregando foto…' : 'Agregando fotos…');
  for (const file of files) {
    try {
      const blob = await comprimirFoto(file);
      const id = 'f-' + nuevoId();
      await db.guardar('fotos', { id, blob, tipo: blob.type, ideaId: idea.id });
      idea.fotos = (idea.fotos || []).concat([id]);
    } catch (e) { toast('No pude abrir una de las fotos'); }
  }
  await guardarIdea(idea);
  if (enVista('idea')) pintarFotosDetalle(idea);
};
async function borrarFoto(idea, id) {
  idea.fotos = (idea.fotos || []).filter((x) => x !== id);
  await db.borrar('fotos', id);
  sync.borrarArchivoRemoto(id);
  await guardarIdea(idea);
  if (enVista('idea')) pintarFotosDetalle(idea);
}
A.dQuitarFoto = async (el) => {
  const ok = await confirmarSheet({ titulo: '¿Quitar esta foto?', texto: 'La foto se borra de esta idea.', si: 'Quitar' });
  if (ok) borrarFoto(ideaActual(), el.dataset.id);
};
A.dVerFoto = async (el) => {
  const idea = ideaActual();
  const f = await db.obtener('fotos', el.dataset.id);
  if (!f) return;
  const url = URL.createObjectURL(f.blob);
  abrirSheet(`<span class="asa"></span><div class="visor"><img src="${url}" alt="Foto de la idea"></div>
    <div class="fila"><button class="btn borde grow" style="color:var(--danger);border-color:#E2B5AD" data-sa="borrar">${I.tacho}Quitar</button><button class="btn grow" data-sa="cerrar">Cerrar</button></div>`, {
    borrar: async () => { cerrarSheet(); URL.revokeObjectURL(url); borrarFoto(idea, el.dataset.id); }
  });
};
A.dEstado = async (el) => {
  const idea = ideaActual();
  const antes = idea.estado;
  idea.estado = el.dataset.e;
  await guardarIdea(idea);
  if (idea.estado === 'flor' && antes !== 'flor') toast('¡Floreció! 🌸 Una flor más en tu árbol');
  if (enVista('idea')) vDetalle(idea.id);
};
A.dNota = async () => {
  const inp = document.getElementById('d-nota');
  const t = inp.value.trim();
  if (!t) { inp.focus(); return; }
  const idea = ideaActual();
  idea.notas = (idea.notas || []).concat([{ id: nuevoId(), fecha: Date.now(), texto: t }]);
  if (idea.estado === 'semilla') idea.estado = 'brote';
  await guardarIdea(idea);
  if (enVista('idea')) vDetalle(idea.id);
};
A.dBorrarNota = async (el) => {
  const idea = ideaActual();
  idea.notas = idea.notas.filter((n) => n.id !== el.dataset.id);
  await guardarIdea(idea);
  if (enVista('idea')) vDetalle(idea.id);
};
A.dMenu = () => {
  const idea = ideaActual();
  abrirSheet(`<span class="asa"></span>
    <button type="button" class="btn borde" data-sa="editar">${I.lapiz}Editar título y texto</button>
    <button type="button" class="btn borde" data-sa="rama">Cambiar rama</button>
    <button type="button" class="btn borde" style="color:var(--danger);border-color:#E2B5AD" data-sa="borrar">${I.tacho}Borrar idea</button>
    <button type="button" class="btn suave" data-sa="cerrar">Cancelar</button>`, {
    editar: () => sheetEditar(idea),
    rama: () => A.dRama(),
    borrar: async () => {
      const ok = await confirmarSheet({ titulo: '¿Borrar esta idea?', texto: '"' + idea.titulo + '" se borra para siempre, con sus notas y su audio.' });
      if (!ok) return;
      if (idea.audioId) { await db.borrar('audios', idea.audioId); sync.borrarArchivoRemoto(idea.audioId); }
      for (const fid of idea.fotos || []) { await db.borrar('fotos', fid); sync.borrarArchivoRemoto(fid); }
      await db.borrar('ideas', idea.id);
      sync.marcarSucio('idea', idea.id);
      S.ideas = S.ideas.filter((i) => i.id !== idea.id);
      toast('Idea borrada');
      location.hash = '#/ideas';
    }
  });
};
function sheetEditar(idea) {
  abrirSheet(`<span class="asa"></span><span class="titulo-pant" style="font-size:20px">Editar idea</span>
    <div class="col"><label class="label" for="e-titulo">Título</label><input id="e-titulo" class="input" value="${h(idea.titulo)}" maxlength="120"></div>
    <div class="col"><label class="label" for="e-texto">Texto</label><textarea id="e-texto" class="textarea">${h(idea.texto)}</textarea></div>
    <div class="fila"><button class="btn borde grow" data-sa="cerrar">Cancelar</button><button class="btn grow" data-sa="ok">Guardar</button></div>`, {
    ok: async () => {
      const t = document.getElementById('e-titulo').value.trim();
      idea.texto = document.getElementById('e-texto').value.trim();
      idea.titulo = t || tituloAutomatico(idea.texto, idea.tipo);
      await guardarIdea(idea);
      cerrarSheet();
      if (enVista('idea')) vDetalle(idea.id);
      toast('Cambios guardados');
    }
  });
}
A.dRama = () => {
  const idea = ideaActual();
  const st = { ramaId: idea.ramaId, ramita: idea.ramita, ver: false };
  const html = () => {
    const sel = rama(st.ramaId);
    const cuerpo = st.ver && sel ? `
      <div class="fila"><button type="button" class="chip sm volver claro" data-sa="volver">${I.atras.replace(/20/g, '16')}Ramas</button>
        <span class="punto" style="background:${sel.color}"></span><span style="font-size:16px;font-weight:800">${h(sel.nombre)}</span></div>
      <div class="fila wrap" style="gap:8px">
        <button type="button" class="chip sm ${!st.ramita ? 'on' : ''}" data-sa="ramita" data-m="">General</button>
        ${sel.ramitas.map((m) => `<button type="button" class="chip sm ${st.ramita === m ? 'on' : ''}" data-sa="ramita" data-m="${h(m)}">${h(m)}</button>`).join('')}</div>`
      : `<div class="fila wrap" style="gap:8px">${S.ramas.map((r) => `<button type="button" class="chip ${r.id === st.ramaId ? 'on' : ''}" data-sa="rama" data-id="${r.id}"><span class="dot" style="background:${r.color}"></span>${h(r.nombre)}${r.ramitas.length ? I.chevron : ''}</button>`).join('')}
        <button type="button" class="chip ${!st.ramaId ? 'on' : ''}" data-sa="rama" data-id="">Sin rama</button></div>`;
    return `<span class="asa"></span><span class="titulo-pant" style="font-size:20px">¿A qué rama va?</span>${cuerpo}
      <div class="fila"><button class="btn borde grow" data-sa="cerrar">Cancelar</button><button class="btn grow" data-sa="ok">Guardar</button></div>`;
  };
  abrirSheet(html(), {
    rama: (el) => { const id = el.dataset.id || null; if (id !== st.ramaId) st.ramita = null; st.ramaId = id; const r = rama(id); st.ver = !!(r && r.ramitas.length); actualizarSheet(html()); },
    volver: () => { st.ver = false; actualizarSheet(html()); },
    ramita: (el) => { st.ramita = el.dataset.m || null; actualizarSheet(html()); },
    ok: async () => { idea.ramaId = st.ramaId; idea.ramita = st.ramita; await guardarIdea(idea); cerrarSheet(); if (enVista('idea')) vDetalle(idea.id); }
  });
};

/* =====================================================================
   MIS RAMAS
   ===================================================================== */
function vRamas() {
  const U = UI.ramas;
  const cuenta = (r) => S.ideas.filter((i) => i.ramaId === r.id).length;
  const paleta = (sel, accion, extra = '') => `<div class="paleta" role="group" aria-label="Color de la rama">${PALETA.map(([c, n]) =>
    `<button type="button" class="color" style="background:${c};${sel === c ? 'box-shadow:0 0 0 2.5px ' + c : ''}" aria-label="${n}" aria-pressed="${sel === c}" data-a="${accion}" data-c="${c}" ${extra}></button>`).join('')}</div>`;
  $app.innerHTML = `
    <div class="fila entre header"><a href="#/ideas" class="icon-btn" aria-label="Volver a mis ideas">${I.atras}</a><span class="titulo-pant">Mis ramas</span><span style="width:44px"></span></div>
    <div style="font-size:15px;font-weight:600;color:var(--muted);line-height:1.45">Ordená tus ideas como quieras. Dentro de cada rama podés tener <b style="color:var(--ink)">ramitas</b>: por ejemplo, una por cada negocio o por cada canción.</div>
    <button type="button" class="chip nueva" style="height:52px;border-radius:16px;justify-content:center;color:var(--blue-link);font-size:16px" data-a="rNuevaToggle">${I.mas}Nueva rama</button>
    ${U.nueva ? `<div class="card col" style="gap:12px;border:1.5px solid var(--blue)">
      <label class="label" for="r-nombre">Nombre</label>
      <input id="r-nombre" class="input" placeholder="Ej: Recetas, Regalos, Podcast…" value="${h(U.nuevaNombre)}" data-in="rNombre" maxlength="40" autofocus>
      <span class="label">Color</span>${paleta(U.nuevaColor, 'rNuevaColor')}
      <button type="button" class="btn chico" style="height:48px;border-radius:24px" data-a="rCrear">Crear rama</button></div>` : ''}
    ${S.ramas.length ? '' : '<div class="vacio">No tenés ramas. Creá la primera.</div>'}
    ${S.ramas.map((r) => `<div class="rama-card">
      <div class="fila" style="gap:6px">
        <button type="button" class="icon-btn plano" style="width:40px" aria-label="Cambiar color de ${h(r.nombre)}" data-a="rColorToggle" data-id="${r.id}"><span class="punto" style="background:${r.color}"></span></button>
        ${U.editando === r.id ? `<label for="r-ren" class="sr-only">Nuevo nombre</label><input id="r-ren" class="input grow" style="height:44px;border-color:var(--blue);font-weight:700" value="${h(r.nombre)}" maxlength="40" autofocus>
          <button type="button" class="btn chico" data-a="rRenOk" data-id="${r.id}">Listo</button>`
        : `<div class="grow col" style="gap:0"><span style="font-size:17px;font-weight:800">${h(r.nombre)}</span><span class="meta">${cuenta(r) === 1 ? '1 idea' : cuenta(r) + ' ideas'}</span></div>
          <button type="button" class="icon-btn plano" aria-label="Cambiar nombre" data-a="rRen" data-id="${r.id}">${I.lapiz}</button>
          <button type="button" class="icon-btn plano" style="color:#B3402F" aria-label="Borrar rama" data-a="rBorrarPedir" data-id="${r.id}">${I.tacho}</button>`}
      </div>
      ${U.colorDe === r.id ? paleta(r.color, 'rColor', `data-id="${r.id}"`) : ''}
      ${U.confirmando === r.id ? `<div class="confirmar"><span>¿Borrar “${h(r.nombre)}”? Sus ideas no se borran: quedan sin rama.</span>
        <div class="fila"><button type="button" class="btn chico borde grow" style="background:#FFF" data-a="rBorrarNo">Cancelar</button><button type="button" class="btn chico peligro grow" data-a="rBorrarSi" data-id="${r.id}">Borrar</button></div></div>` : ''}
      <div class="fila wrap" style="gap:8px;padding-left:6px">
        ${r.ramitas.map((m) => `<span class="ramita-tag">${h(m)}<button type="button" aria-label="Quitar ramita ${h(m)}" data-a="rQuitarRamita" data-id="${r.id}" data-m="${h(m)}">${I.xs}</button></span>`).join('')}
        <button type="button" class="chip sm nueva" style="height:36px;color:var(--blue-link)" data-a="rRamitaToggle" data-id="${r.id}">+ Ramita</button>
      </div>
      ${U.agregando === r.id ? `<div class="fila" style="gap:8px;padding-left:6px"><label for="r-ramita" class="sr-only">Nombre de la ramita</label>
        <input id="r-ramita" class="input grow" style="height:44px" placeholder="Nombre de la ramita" maxlength="40" autofocus>
        <button type="button" class="btn chico" data-a="rRamitaOk" data-id="${r.id}">Agregar</button></div>` : ''}
    </div>`).join('')}`;
  const f = $app.querySelector('[autofocus]');
  if (f) f.focus();
  const ren = document.getElementById('r-ren');
  if (ren) ren.addEventListener('keydown', (e) => { if (e.key === 'Enter') A.rRenOk({ dataset: { id: U.editando } }); });
  const ram = document.getElementById('r-ramita');
  if (ram) ram.addEventListener('keydown', (e) => { if (e.key === 'Enter') A.rRamitaOk({ dataset: { id: U.agregando } }); });
}
A.rNuevaToggle = () => { UI.ramas.nueva = !UI.ramas.nueva; UI.ramas.nuevaNombre = ''; if (enVista('ramas')) vRamas(); };
A.rNombre = (el) => { UI.ramas.nuevaNombre = el.value; };
A.rNuevaColor = (el) => { UI.ramas.nuevaColor = el.dataset.c; if (enVista('ramas')) vRamas(); };
A.rCrear = async () => {
  const n = UI.ramas.nuevaNombre.trim();
  if (!n) { document.getElementById('r-nombre').focus(); return; }
  if (S.ramas.some((r) => r.nombre.toLowerCase() === n.toLowerCase())) { toast('Ya tenés una rama con ese nombre'); return; }
  const r = { id: nuevoId(), nombre: n, color: UI.ramas.nuevaColor, ramitas: [], orden: -Date.now() };
  await guardarRama(r);
  UI.ramas.nueva = false; UI.ramas.nuevaNombre = '';
  if (enVista('ramas')) vRamas();
  toast('Rama creada');
};
A.rColorToggle = (el) => { UI.ramas.colorDe = UI.ramas.colorDe === el.dataset.id ? null : el.dataset.id; if (enVista('ramas')) vRamas(); };
A.rColor = async (el) => { const r = rama(el.dataset.id); r.color = el.dataset.c; await guardarRama(r); UI.ramas.colorDe = null; if (enVista('ramas')) vRamas(); };
A.rRen = (el) => { UI.ramas.editando = el.dataset.id; UI.ramas.confirmando = null; if (enVista('ramas')) vRamas(); };
A.rRenOk = async (el) => {
  const r = rama(el.dataset.id);
  const n = document.getElementById('r-ren').value.trim();
  if (n) { r.nombre = n; await guardarRama(r); }
  UI.ramas.editando = null; if (enVista('ramas')) vRamas();
};
A.rBorrarPedir = (el) => { UI.ramas.confirmando = el.dataset.id; UI.ramas.editando = null; if (enVista('ramas')) vRamas(); };
A.rBorrarNo = () => { UI.ramas.confirmando = null; if (enVista('ramas')) vRamas(); };
A.rBorrarSi = async (el) => {
  const id = el.dataset.id;
  await db.borrar('ramas', id);
  sync.marcarSucio('rama', id);
  S.ramas = S.ramas.filter((r) => r.id !== id);
  for (const i of S.ideas.filter((x) => x.ramaId === id)) { i.ramaId = null; i.ramita = null; await guardarIdea(i); }
  UI.ramas.confirmando = null;
  if (UI.ideas.rama === id) { UI.ideas.rama = 'todas'; UI.ideas.verRamitas = false; }
  if (enVista('ramas')) vRamas();
  toast('Rama borrada');
};
A.rRamitaToggle = (el) => { UI.ramas.agregando = UI.ramas.agregando === el.dataset.id ? null : el.dataset.id; if (enVista('ramas')) vRamas(); };
A.rRamitaOk = async (el) => {
  const r = rama(el.dataset.id);
  const m = document.getElementById('r-ramita').value.trim();
  if (!m) return;
  if (!r.ramitas.includes(m)) { r.ramitas.push(m); await guardarRama(r); }
  UI.ramas.agregando = null; if (enVista('ramas')) vRamas();
};
A.rQuitarRamita = async (el) => {
  const r = rama(el.dataset.id);
  const m = el.dataset.m;
  r.ramitas = r.ramitas.filter((x) => x !== m);
  await guardarRama(r);
  for (const i of S.ideas.filter((x) => x.ramaId === r.id && x.ramita === m)) { i.ramita = null; await guardarIdea(i); }
  if (enVista('ramas')) vRamas();
};

/* =====================================================================
   AJUSTES
   ===================================================================== */
function vAjustes() {
  const notif = 'Notification' in window;
  $app.innerHTML = `
    <div class="fila entre header"><a href="#/inicio" class="icon-btn" aria-label="Volver al inicio">${I.atras}</a><span class="titulo-pant">Ajustes</span><span style="width:44px"></span></div>
    <div class="card col" style="gap:10px" id="a-cuenta">${htmlCuenta()}</div>
    <div class="card col" style="gap:10px">
      <label class="label" for="a-nombre">¿Cómo te llamás?</label>
      <div class="fila" style="gap:8px"><input id="a-nombre" class="input grow" value="${h(S.nombre)}" placeholder="Para saludarte en el inicio" maxlength="30">
      <button type="button" class="btn chico" data-a="aNombre">Guardar</button></div>
    </div>
    <div class="card col" style="gap:10px">
      <span class="label">Copia de seguridad</span>
      <span class="ayuda" style="font-size:14px">Un archivo con todas tus ideas, audios y fotos, por las dudas.</span>
      <button type="button" class="btn chico" data-a="aExportar">Descargar copia</button>
      <label class="btn chico borde" style="cursor:pointer">Cargar una copia<input type="file" accept="application/json,.json" class="sr-only" id="a-importar"></label>
    </div>
    ${notif ? `<div class="card col" style="gap:10px">
      <span class="label">Avisos en este dispositivo</span>
      <span class="ayuda" style="font-size:14px">Con la app abierta te avisa cuando llega la hora de un recordatorio. Para que te avise con la app cerrada, sumá el recordatorio al calendario.</span>
      <button type="button" class="btn chico borde" data-a="aNotif">${Notification.permission === 'granted' ? 'Avisos activados ✓' : 'Activar avisos'}</button>
    </div>` : ''}
    <div class="card col" style="gap:8px">
      <span class="label">Instalar la app</span>
      <span class="ayuda" style="font-size:14px"><b>iPhone:</b> abrila en Safari, tocá el botón Compartir y elegí "Agregar a pantalla de inicio".<br><b>Compu:</b> en Chrome o Edge, tocá el ícono de instalar en la barra de direcciones.</span>
    </div>
    <span class="meta" style="text-align:center">Nomeolvides · versión 2.0</span>`;
  document.getElementById('a-importar').addEventListener('change', importar);
}
function htmlCuenta() {
  const u = sync.usuarioActual();
  if (!sync.sb) return '<span class="label">Tu cuenta</span><span class="ayuda" style="font-size:14px">La sincronización no está disponible en este navegador.</span>';
  if (!u) {
    return `<span class="label">Tus ideas en todos lados</span>
      <span class="ayuda" style="font-size:14px">Entrá con tu mail para tener las mismas ideas en el celular y en la compu. Si no entrás, se guardan solo en este dispositivo.</span>
      <button type="button" class="btn chico" data-a="cuentaEntrar">Entrar o crear cuenta</button>`;
  }
  const e = sync.estado;
  const cuando = e.ultima ? new Date(e.ultima).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;
  const linea = e.sincronizando ? 'Sincronizando…' : e.error ? 'No se pudo sincronizar. Se reintenta solo cuando haya internet.' : cuando ? 'Sincronizado · ' + cuando : 'Todavía no se sincronizó.';
  return `<span class="label">Tu cuenta</span>
    <span style="font-size:15px;font-weight:700;word-break:break-all">${h(u.email)}</span>
    <span class="ayuda" style="font-size:14px">${h(linea)}</span>
    <div class="fila"><button type="button" class="btn chico borde grow" data-a="syncAhora">Sincronizar ahora</button>
    <button type="button" class="btn chico suave" data-a="cuentaSalir">Cerrar sesión</button></div>`;
}
function pintarCuenta() { const c = document.getElementById('a-cuenta'); if (c) c.innerHTML = htmlCuenta(); }
A.syncAhora = async () => { const p = sync.sincronizar(); pintarCuenta(); await p; pintarCuenta(); toast(sync.estado.error ? 'No se pudo sincronizar' : 'Todo sincronizado ✓'); };
A.cuentaSalir = async () => {
  const ok = await confirmarSheet({ titulo: '¿Cerrar sesión?', texto: 'Tus ideas quedan guardadas en este dispositivo y en tu cuenta. Los cambios nuevos no se van a sincronizar hasta que vuelvas a entrar.', si: 'Cerrar sesión' });
  if (!ok) return;
  await sync.salir();
  pintarCuenta();
  toast('Sesión cerrada');
};
A.cuentaEntrar = () => {
  const st = { email: '', clave: '', msg: '', error: '', cargando: false, modo: 'entrar' };
  const html = () => `<span class="asa"></span>
    <div class="fila entre"><span class="titulo-pant" style="font-size:20px">${st.modo === 'olvido' ? 'Recuperar contraseña' : 'Tu cuenta'}</span>
      <button class="icon-btn" style="background:#F2F4F9;border:none" data-sa="cerrar" aria-label="Cerrar">${I.x}</button></div>
    ${st.msg ? `<div class="aviso-banner" style="background:#E3F0D8;border-color:#C5DDB1;font-size:15px;font-weight:700;color:#355A22">${h(st.msg)}</div>` : ''}
    ${st.error ? `<div class="confirmar" role="alert">${h(st.error)}</div>` : ''}
    <div class="col"><label class="label" for="c-mail">Mail</label>
      <input id="c-mail" class="input" type="email" autocomplete="email" inputmode="email" value="${h(st.email)}" data-si="mail" autofocus></div>
    ${st.modo === 'olvido' ? `<button type="button" class="btn" data-sa="olvido" ${st.cargando ? 'disabled' : ''}>Mandarme un mail</button>
      <button type="button" class="link-btn" data-sa="volver">Volver</button>` : `
    <div class="col"><label class="label" for="c-clave">Contraseña</label>
      <input id="c-clave" class="input" type="password" autocomplete="current-password" value="${h(st.clave)}" data-si="clave" minlength="6"></div>
    <button type="button" class="btn" data-sa="entrar" ${st.cargando ? 'disabled' : ''}>${st.cargando ? 'Un momento…' : 'Entrar'}</button>
    <button type="button" class="btn borde" data-sa="crear" ${st.cargando ? 'disabled' : ''}>Crear cuenta nueva</button>
    <button type="button" class="link-btn" data-sa="irOlvido">Me olvidé la contraseña</button>`}`;
  const validar = () => {
    if (!/^\S+@\S+\.\S+$/.test(st.email.trim())) { st.error = 'Revisá el mail.'; actualizarSheet(html()); return false; }
    if (st.modo !== 'olvido' && st.clave.length < 6) { st.error = 'La contraseña tiene que tener al menos 6 caracteres.'; actualizarSheet(html()); return false; }
    return true;
  };
  const correr = async (fn) => {
    if (!validar()) return;
    st.cargando = true; st.error = ''; st.msg = ''; actualizarSheet(html());
    try { await fn(); } catch (err) { st.error = err.message; }
    st.cargando = false;
    if (capa) actualizarSheet(html());
  };
  abrirSheet(html(), {
    mail: (el) => { st.email = el.value; },
    clave: (el) => { st.clave = el.value; },
    irOlvido: () => { st.modo = 'olvido'; st.error = ''; st.msg = ''; actualizarSheet(html()); },
    volver: () => { st.modo = 'entrar'; st.error = ''; st.msg = ''; actualizarSheet(html()); },
    entrar: () => correr(async () => {
      await sync.entrar(st.email.trim(), st.clave);
      cerrarSheet(); toast('¡Listo! Tus ideas se sincronizan solas'); pintarCuenta();
    }),
    crear: () => correr(async () => {
      const r = await sync.crearCuenta(st.email.trim(), st.clave);
      if (r.listo) { cerrarSheet(); toast('¡Cuenta creada!'); pintarCuenta(); return; }
      st.msg = 'Te mandamos un mail a ' + st.email.trim() + '. Tocá el link para confirmar la cuenta y después volvé acá y tocá "Entrar".';
    }),
    olvido: () => correr(async () => {
      await sync.recuperarClave(st.email.trim());
      st.msg = 'Te mandamos un mail con un link para elegir una contraseña nueva.';
    })
  });
};
function sheetNuevaClave() {
  let clave = '';
  abrirSheet(`<span class="asa"></span><span class="titulo-pant" style="font-size:20px">Elegí una contraseña nueva</span>
    <div class="col"><label class="label" for="c-nueva">Contraseña nueva</label><input id="c-nueva" class="input" type="password" autocomplete="new-password" data-si="c" autofocus></div>
    <button type="button" class="btn" data-sa="ok">Guardar</button>`, {
    c: (el) => { clave = el.value; },
    ok: async () => {
      if (clave.length < 6) { toast('Al menos 6 caracteres'); return; }
      try { await sync.cambiarClave(clave); cerrarSheet(); toast('Contraseña cambiada ✓'); } catch (e) { toast(e.message); }
    }
  });
}

A.aNombre = async () => {
  S.nombre = document.getElementById('a-nombre').value.trim();
  await db.setMeta('nombre', S.nombre);
  sync.marcarSucio('perfil', 'nombre');
  toast('¡Listo' + (S.nombre ? ', ' + S.nombre : '') + '!');
};
A.aNotif = async () => {
  const p = await Notification.requestPermission();
  toast(p === 'granted' ? 'Avisos activados' : 'No se activaron los avisos');
  if (enVista('ajustes')) vAjustes();
};
function blobA64(blob) {
  return new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
}
A.aExportar = async () => {
  const audios = await db.todos('audios');
  const copia = {
    app: 'nomeolvides', version: 1, fecha: new Date().toISOString(), nombre: S.nombre,
    ramas: S.ramas, ideas: S.ideas,
    audios: await Promise.all(audios.map(async (a) => ({ id: a.id, tipo: a.tipo, datos: await blobA64(a.blob) }))),
    fotos: await Promise.all((await db.todos('fotos')).map(async (f) => ({ id: f.id, tipo: f.tipo, ideaId: f.ideaId, datos: await blobA64(f.blob) })))
  };
  const blob = new Blob([JSON.stringify(copia)], { type: 'application/json' });
  const nombre = 'nomeolvides-copia-' + hoyISO() + '.json';
  const file = new File([blob], nombre, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] }) && esIOS) {
    try { await navigator.share({ files: [file], title: 'Copia de Nomeolvides' }); return; } catch (e) { /* sigue con la descarga */ }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nombre;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast('Copia descargada');
};
async function importar(e) {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const copia = JSON.parse(await f.text());
    if (copia.app !== 'nomeolvides') throw new Error('formato');
    const ok = await confirmarSheet({ titulo: '¿Cargar esta copia?', texto: 'Se suman ' + copia.ideas.length + ' ideas y sus ramas. Si una idea ya existe, se reemplaza por la de la copia.', si: 'Cargar', peligro: false });
    if (!ok) return;
    for (const r of copia.ramas) { await db.guardar('ramas', r); sync.marcarSucio('rama', r.id); }
    for (const i of copia.ideas) { await db.guardar('ideas', i); sync.marcarSucio('idea', i.id); }
    for (const a of copia.audios || []) {
      const blob = await (await fetch(a.datos)).blob();
      await db.guardar('audios', { id: a.id, blob, tipo: a.tipo });
    }
    for (const f of copia.fotos || []) {
      const blob = await (await fetch(f.datos)).blob();
      await db.guardar('fotos', { id: f.id, blob, tipo: f.tipo, ideaId: f.ideaId });
    }
    if (copia.nombre && !S.nombre) await db.setMeta('nombre', copia.nombre);
    await cargar();
    toast('Copia cargada: ' + copia.ideas.length + ' ideas');
    location.hash = '#/inicio';
  } catch (err) {
    toast('Ese archivo no es una copia de Nomeolvides');
  }
}

/* =====================================================================
   Avisos con la app abierta
   ===================================================================== */
const avisados = new Set();
async function revisarAvisos() {
  const pend = pendientes(S.ideas);
  const nuevos = pend.filter((p) => !avisados.has(p.rec.id + p.cuando.getTime()));
  if (!nuevos.length) return;
  nuevos.forEach((p) => avisados.add(p.rec.id + p.cuando.getTime()));
  if ('Notification' in window && Notification.permission === 'granted') {
    const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
    for (const p of nuevos) {
      const opts = { body: 'Es momento de retomar esta idea', icon: 'icons/icon-192.png', tag: p.rec.id, data: { url: '#/idea/' + encodeURIComponent(p.idea.id) } };
      try { if (reg) reg.showNotification('💡 ' + p.idea.titulo, opts); else new Notification('💡 ' + p.idea.titulo, opts); } catch (e) { /* nada */ }
    }
  } else if (ruta().vista !== 'inicio') {
    toast('🔔 ' + nuevos[0].idea.titulo);
  }
  if (ruta().vista === 'inicio') vInicio();
}

/* =====================================================================
   Arranque
   ===================================================================== */
(async function iniciar() {
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* nada */ }
  await cargar();
  try { await sync.iniciarSesion(); } catch (e) { /* sin conexión */ }
  sync.alCambiar(async (c) => {
    if (c.recuperar) { sheetNuevaClave(); return; }
    if (c.datos) {
      await cargar();
      const v = ruta().vista;
      if (!capa && v !== 'nueva') render();
    }
    if (enVista('ajustes')) pintarCuenta();
  });
  render();
  sync.arrancarAutomatico();
  revisarAvisos();
  setInterval(revisarAvisos, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) revisarAvisos(); });
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
    navigator.serviceWorker.addEventListener('message', (e) => { if (e.data && e.data.ir) location.hash = e.data.ir; });
  }
})();
