// Recordatorios: cálculo de fechas, avisos pendientes y exportación a calendario (.ics).

export const NOMBRES_DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const CORTOS_DIA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const ICS_DIA = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
// Orden de la semana como en Argentina: lunes primero.
export const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0];

const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const pad = (n) => String(n).padStart(2, '0');

export function fechaCorta(d) {
  return cap(CORTOS_DIA[d.getDay()] + ' ' + d.getDate() + ' ' + MESES[d.getMonth()]);
}

export function textoDias(dias) {
  const sel = ORDEN_SEMANA.filter((d) => dias.includes(d));
  if (sel.length === 7) return 'Todos los días';
  if (sel.length === 5 && sel.every((d) => d >= 1 && d <= 5)) return 'De lunes a viernes';
  if (sel.length === 2 && sel.includes(6) && sel.includes(0)) return 'Fines de semana';
  if (sel.length === 1) return 'Cada ' + NOMBRES_DIA[sel[0]];
  const c = sel.map((d) => CORTOS_DIA[d]);
  return cap(c.slice(0, -1).join(', ') + ' y ' + c[c.length - 1]);
}

export function describir(rec) {
  if (rec.tipo === 'repite') return { titulo: textoDias(rec.dias) + ' · ' + rec.hora, sub: 'Se repite' };
  const d = fechaDe(rec.fecha, rec.hora);
  const pasado = d < new Date();
  return { titulo: fechaCorta(d) + ' · ' + rec.hora, sub: pasado ? 'Una vez · ya pasó' : 'Una vez' };
}

function fechaDe(fecha, hora) {
  const [y, m, d] = fecha.split('-').map(Number);
  const [hh, mm] = hora.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0);
}

// Próxima vez que suena (o null si ya no va a sonar).
export function proxima(rec, desde = new Date()) {
  if (rec.tipo === 'una') {
    const d = fechaDe(rec.fecha, rec.hora);
    return d >= desde ? d : null;
  }
  const [hh, mm] = rec.hora.split(':').map(Number);
  for (let i = 0; i < 8; i++) {
    const d = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() + i, hh, mm, 0);
    if (rec.dias.includes(d.getDay()) && d >= desde) return d;
  }
  return null;
}

// Última vez que debió sonar, hasta ahora.
function ultima(rec, hasta = new Date()) {
  if (rec.tipo === 'una') {
    const d = fechaDe(rec.fecha, rec.hora);
    return d <= hasta ? d : null;
  }
  const [hh, mm] = rec.hora.split(':').map(Number);
  for (let i = 0; i < 8; i++) {
    const d = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate() - i, hh, mm, 0);
    if (rec.dias.includes(d.getDay()) && d <= hasta) return d;
  }
  return null;
}

// Recordatorios que ya sonaron y todavía no viste.
export function pendientes(ideas) {
  const ahora = new Date();
  const out = [];
  for (const idea of ideas) {
    for (const rec of idea.recordatorios || []) {
      if (!rec.on) continue;
      const u = ultima(rec, ahora);
      if (!u) continue;
      const desde = rec.visto || rec.creado || 0;
      if (u.getTime() > desde) out.push({ idea, rec, cuando: u });
    }
  }
  return out.sort((a, b) => b.cuando - a.cuando);
}

function icsFecha(d) {
  return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + 'T' + pad(d.getHours()) + pad(d.getMinutes()) + '00';
}
function icsTexto(t) {
  return String(t || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

export function crearICS(idea, rec, urlApp) {
  const inicio = proxima(rec) || fechaDe(rec.fecha || new Date().toISOString().slice(0, 10), rec.hora);
  const fin = new Date(inicio.getTime() + 15 * 60000);
  const ahora = new Date();
  const lineas = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Nomeolvides//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:' + idea.id + '-' + rec.id + '@nomeolvides',
    'DTSTAMP:' + ahora.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z'),
    'DTSTART:' + icsFecha(inicio),
    'DTEND:' + icsFecha(fin),
    'SUMMARY:' + icsTexto('💡 ' + (idea.titulo || 'Idea')),
    'DESCRIPTION:' + icsTexto((idea.texto ? idea.texto + '\n\n' : '') + 'Abrila en Nomeolvides: ' + urlApp)
  ];
  if (rec.tipo === 'repite') {
    lineas.push('RRULE:FREQ=WEEKLY;BYDAY=' + ORDEN_SEMANA.filter((d) => rec.dias.includes(d)).map((d) => ICS_DIA[d]).join(','));
  }
  lineas.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsTexto(idea.titulo || 'Idea'), 'TRIGGER:PT0M', 'END:VALARM');
  lineas.push('END:VEVENT', 'END:VCALENDAR');
  return lineas.join('\r\n');
}
