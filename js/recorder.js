// Grabación de audio (notas de voz y melodías) y transcripción cuando el navegador lo permite.

export const puedeGrabar = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
const Reconocimiento = window.SpeechRecognition || window.webkitSpeechRecognition;
// En iPhone el reconocimiento dentro de una app web no es confiable: solo lo usamos en compu / Android.
const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const puedeTranscribir = !!Reconocimiento && !esIOS;

function tipoAudio() {
  const opciones = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  for (const t of opciones) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

export class Grabadora {
  constructor({ transcribir = false, esMelodia = false, onNivel, onTexto, onTiempo } = {}) {
    this.transcribir = transcribir && puedeTranscribir;
    this.esMelodia = esMelodia;
    this.onNivel = onNivel || (() => {});
    this.onTexto = onTexto || (() => {});
    this.onTiempo = onTiempo || (() => {});
    this.partes = [];
    this.textoFinal = '';
    this.grabando = false;
  }

  async empezar() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: !this.esMelodia } });
    const tipo = tipoAudio();
    this.rec = new MediaRecorder(this.stream, tipo ? { mimeType: tipo } : undefined);
    this.partes = [];
    this.rec.ondataavailable = (e) => { if (e.data && e.data.size) this.partes.push(e.data); };
    this.rec.start(250);
    this.inicio = Date.now();
    this.grabando = true;
    this._medidor();
    this.reloj = setInterval(() => this.onTiempo(Math.floor((Date.now() - this.inicio) / 1000)), 250);
    if (this.transcribir) this._reconocer();
  }

  _medidor() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      const src = this.ctx.createMediaStreamSource(this.stream);
      const an = this.ctx.createAnalyser();
      an.fftSize = 256;
      src.connect(an);
      const datos = new Uint8Array(an.frequencyBinCount);
      const paso = () => {
        if (!this.grabando) return;
        an.getByteTimeDomainData(datos);
        let max = 0;
        for (let i = 0; i < datos.length; i++) max = Math.max(max, Math.abs(datos[i] - 128));
        this.onNivel(Math.min(1, max / 64));
        this.raf = requestAnimationFrame(paso);
      };
      paso();
    } catch (e) { /* el medidor es opcional */ }
  }

  _reconocer() {
    try {
      const r = new Reconocimiento();
      r.lang = 'es-AR';
      r.continuous = true;
      r.interimResults = true;
      r.onresult = (ev) => {
        let parcial = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const res = ev.results[i];
          if (res.isFinal) this.textoFinal += (this.textoFinal ? ' ' : '') + res[0].transcript.trim();
          else parcial += res[0].transcript;
        }
        this.onTexto((this.textoFinal + (parcial ? ' ' + parcial : '')).trim());
      };
      r.onend = () => { if (this.grabando) { try { r.start(); } catch (e) { /* ya terminó */ } } };
      r.onerror = () => {};
      r.start();
      this.reco = r;
    } catch (e) { this.reco = null; }
  }

  terminar() {
    return new Promise((resolve) => {
      this.grabando = false;
      clearInterval(this.reloj);
      cancelAnimationFrame(this.raf);
      if (this.reco) { try { this.reco.stop(); } catch (e) { /* nada */ } }
      const cerrar = () => {
        if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
        if (this.ctx) this.ctx.close().catch(() => {});
        const tipo = (this.rec && this.rec.mimeType) || 'audio/mp4';
        const blob = new Blob(this.partes, { type: tipo });
        resolve({ blob, duracion: Math.round((Date.now() - this.inicio) / 1000), texto: this.textoFinal });
      };
      if (this.rec && this.rec.state !== 'inactive') {
        this.rec.onstop = cerrar;
        this.rec.stop();
      } else cerrar();
    });
  }

  cancelar() {
    this.grabando = false;
    clearInterval(this.reloj);
    cancelAnimationFrame(this.raf);
    try { if (this.reco) this.reco.stop(); } catch (e) { /* nada */ }
    try { if (this.rec && this.rec.state !== 'inactive') this.rec.stop(); } catch (e) { /* nada */ }
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    if (this.ctx) this.ctx.close().catch(() => {});
  }
}

export function formatoTiempo(seg) {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return m + ':' + String(s).padStart(2, '0');
}
