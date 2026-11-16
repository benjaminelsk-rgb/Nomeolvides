// Sugerencias "inteligentes" simples: rama, ramita y título a partir del texto.
// (En la etapa 4 esto se puede reemplazar por IA.)

const PISTAS = {
  negocio: ['negocio', 'emprend', 'vender', 'venta', 'cliente', 'precio', 'producto', 'tienda', 'local', 'marca', 'ganar', 'plata', 'costo', 'servicio', 'empresa', 'cafeter'],
  cancion: ['canción', 'cancion', 'letra', 'estribillo', 'melod', 'acorde', 'verso', 'estrofa', 'música', 'musica', 'cantar', 'tema', 'ritmo', 'guitarra', 'piano'],
  clase: ['clase', 'alumn', 'inglés', 'ingles', 'actividad', 'juego', 'vocabul', 'gramát', 'gramat', 'speaking', 'curso', 'enseñ', 'estudiant', 'aula', 'taller'],
  viaje: ['viaje', 'viajar', 'vuelo', 'hotel', 'playa', 'vacacion', 'excursi', 'pasaje', 'conocer', 'recorrer', 'ruta', 'isla']
};

const sinAcentos = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function familiaDe(nombre) {
  const n = sinAcentos(nombre);
  if (n.includes('negoc') || n.includes('emprend') || n.includes('trabajo')) return 'negocio';
  if (n.includes('cancion') || n.includes('music') || n.includes('tema')) return 'cancion';
  if (n.includes('clase') || n.includes('ensen') || n.includes('escuela')) return 'clase';
  if (n.includes('viaj') || n.includes('vacac')) return 'viaje';
  return null;
}

export function sugerirRama(texto, tipo, ramas) {
  if (!ramas.length) return null;
  const t = sinAcentos(texto || '');
  let mejor = null;
  let puntaje = 0;
  for (const r of ramas) {
    let p = 0;
    if (t && t.includes(sinAcentos(r.nombre))) p += 3;
    for (const m of r.ramitas || []) if (t && t.includes(sinAcentos(m))) p += 4;
    const fam = familiaDe(r.nombre);
    if (fam) {
      for (const pista of PISTAS[fam]) if (t.includes(sinAcentos(pista))) p += 1;
      if (tipo === 'melodia' && fam === 'cancion') p += 5;
    }
    if (p > puntaje) { puntaje = p; mejor = r; }
  }
  return mejor ? mejor.id : null;
}

export function sugerirRamita(texto, rama) {
  if (!rama) return null;
  const t = sinAcentos(texto || '');
  for (const m of rama.ramitas || []) if (t && t.includes(sinAcentos(m))) return m;
  return null;
}

export function tituloAutomatico(texto, tipo) {
  const limpio = (texto || '').replace(/\s+/g, ' ').trim();
  if (limpio) {
    const primera = limpio.split(/[.!?\n]/)[0];
    const palabras = primera.split(' ');
    let t = palabras.slice(0, 8).join(' ');
    if (palabras.length > 8) t += '…';
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  const hoy = new Date();
  const fecha = hoy.getDate() + '/' + (hoy.getMonth() + 1);
  if (tipo === 'melodia') return 'Melodía del ' + fecha;
  if (tipo === 'voz') return 'Nota de voz del ' + fecha;
  return 'Idea del ' + fecha;
}
