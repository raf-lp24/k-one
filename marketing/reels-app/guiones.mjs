// Guiones de los reels «la app grabada en movimiento» (31 oct 2026, Rafa: de 25 a
// 30 s, ritmo del de «no puedo comer gluten»). Cada guion: fecha fija de la app,
// cambios sobre el cliente de demo (marketing/estado-demo-ia.js), clips de fondo y
// los pasos (tocar, escribir, bajar...) con sus marcas de tiempo. Los textos que
// salen encima van en textos.js. Graba grabar.mjs y monta montar.sh.
//
// En los pasos, h tiene: ev(js) · espera(ms) · marca(nombre) · pausa() / sigue()
// (lo que pasa entre medias no sale en el vídeo) · log(texto).
export const GUIONES = {
  // 19 · Check-in con poca energía: el plan de hoy baja una serie.
  reventado: {
    salida: '19-le-digo-a-mi-entrenador-con-ia-que-esta-semana-no-puedo-mas.mp4',
    fecha: '2026-11-02T08:30:00',
    cambios: {},
    gancho: ['ai-gym-hombro-raw.mp4'],
    fondo: ['ai-gym-remo-raw.mp4', 'ai-banco-raw.mp4', 'ai-gym-hombro-raw.mp4', 'ai-espalda-raw.mp4', 'ai-gym-remo-raw.mp4', 'ai-banco-raw.mp4'],
    async pasos(h) {
      const lista = () => h.ev(`[...document.querySelectorAll('#hdPanel .hd-ej')].map(e => e.innerText.replace(/\\n/g, ' ')).join(' | ')`);
      h.log('antes: ' + await lista());
      await h.ev(`(() => { hdTab('ent'); window.scrollTo(0, document.getElementById('hdTabs').getBoundingClientRect().top + scrollY - 12); return 'ok'; })()`);
      await h.espera(400);
      h.grabar();
      h.marca('hoy');
      await h.espera(1500);
      await h.ev(`__arriba(document.querySelector('#hdPanel .hd-ejs'), 300)`); await h.espera(1900);
      h.marca('checkin');
      await h.ev(`__toca(document.getElementById('hoyCheckin'))`); await h.espera(1500);
      for (const [g, v] of [['dias', '3'], ['fisico', 'Flojo'], ['energia', '2'], ['mente', 'Regular']]) {
        await h.ev(`__toca([...document.querySelectorAll('#rating-${g} .rating-btn')].find(x => x.textContent.trim().toLowerCase().startsWith('${v}'.toLowerCase())))`);
        await h.espera(1050);
      }
      await h.ev(`__toca([...document.querySelectorAll('#section-checkin button')].find(b => /submitCheckin/.test(b.getAttribute('onclick') || '')))`); await h.espera(600);
      h.marca('respuesta');
      await h.espera(2400);
      await h.ev(`__arriba(document.getElementById('checkinResponse'), 140)`); await h.espera(2600);
      h.marca('despues');
      await h.ev(`__toca(document.querySelector('.tabbar-item[data-sec="hoy"]'), false)`); await h.espera(900);
      await h.ev(`(() => { hdTab('ent'); window.scrollTo(0, document.querySelector('#hdPanel .hd-ejs').getBoundingClientRect().top + scrollY - 300); return 'ok'; })()`);
      await h.espera(3600);
      h.log('después: ' + await lista());
      h.marca('fin');
    }
  },

  // 20 · «No como pescado ni brócoli»: lo escribe y cambian los platos.
  nocomo: {
    salida: '20-no-como-pescado-ni-brocoli.mp4',
    fecha: '2026-11-02T09:30:00',
    cambios: {},
    gancho: ['ai-plato-raw.mp4'],
    fondo: ['ai-carrito-raw.mp4', 'ai-plato-raw.mp4', 'ai-carrito-raw.mp4', 'ai-plato-raw.mp4', 'ai-carrito-raw.mp4', 'ai-plato-raw.mp4'],
    async pasos(h) {
      const re = 'merluza|salm[oó]n|at[uú]n|pescado|bacalao|lubina|dorada|gamba|sardina|br[oó]coli|caballa|langostino|rape|trucha';
      // El día de la semana (hoy o el siguiente que lo tenga) con pescado o brócoli en el menú.
      const [d, j] = await h.ev(`(() => { for (let k = 0; k < 7; k++) { const d = (getIndiceDiaHoy() + k) % 7; const j = _comidasDelDia(d).findIndex(c => /${re}/i.test(c.nombre + ' ' + ((c.op && c.op.ingredientes) || ''))); if (j >= 0) return [d, j]; } return [-1, -1]; })()`);
      h.log('día ' + d + ' · comida ' + j + ' · ' + await h.ev(`(_comidasDelDia(${d})[${j}] || {}).nombre`));
      if (j < 0) throw new Error('esta semana no hay pescado ni brócoli en el menú');
      await h.ev(`hdDia(${d})`);
      await h.ev(`(() => { hdTab('com'); window.scrollTo(0, document.getElementById('hoyDia').getBoundingClientRect().top + scrollY - 12); return 'ok'; })()`);
      await h.espera(400);
      h.grabar();
      h.marca('menu');
      await h.espera(1400);
      await h.ev(`__arriba(document.querySelector('.hn-linea'), 120)`); await h.espera(1300);
      await h.ev(`__toca(document.querySelectorAll('#hdPanel .hn-toma')[${j}])`); await h.espera(1300);
      await h.ev(`__arriba(document.querySelector('.hn-fila.abierta'), 16)`); await h.espera(2300);
      h.marca('cambio');
      await h.ev(`__toca([...document.querySelectorAll('button')].find(b => /Cambiar objetivo o deporte/.test(b.textContent) && b.offsetParent))`); await h.espera(1400);
      await h.ev(`(() => { const g = document.getElementById('cp-noComida'); const caja = g.closest('.modal-overlay'); const box = caja.querySelector('.modal-box') || caja; const y = g.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 220; (box.scrollHeight > box.clientHeight ? box : caja).scrollTo({ top: y, behavior: 'smooth' }); return 'ok'; })()`); await h.espera(1200);
      h.marca('escribe');
      await h.ev(`__toca(document.getElementById('cp-noComida'), false)`); await h.espera(500);
      await h.ev(`__escribe(document.getElementById('cp-noComida'), 'pescado, brócoli', 95)`); await h.espera(1900);
      await h.ev(`(() => { const b = [...document.querySelectorAll('#cpStep1 .btn-primary')].pop(); b.scrollIntoView({ block: 'center', behavior: 'smooth' }); return 'ok'; })()`); await h.espera(900);
      await h.ev(`__toca([...document.querySelectorAll('#cpStep1 .btn-primary')].pop(), false)`); await h.espera(170);
      h.pausa(); // el paso de la periodicidad de pago no sale
      await h.espera(400);
      await h.ev(`(async () => { await guardarCambioPlan(); return 'ok'; })()`); await h.espera(1200);
      await h.ev(`(() => { hdDia(${d}); hdTab('com'); window.scrollTo(0, document.getElementById('hoyDia').getBoundingClientRect().top + scrollY - 12); return 'ok'; })()`); await h.espera(600);
      h.sigue();
      h.marca('despues');
      await h.espera(1200);
      await h.ev(`__arriba(document.querySelector('.hn-linea'), 120)`); await h.espera(1600);
      await h.ev(`__toca(document.querySelectorAll('#hdPanel .hn-toma')[${j}])`); await h.espera(1300);
      await h.ev(`__arriba(document.querySelector('.hn-fila.abierta'), 16)`); await h.espera(800);
      h.marca('receta');
      h.log('después: ' + await h.ev(`(_comidasDelDia(${d})[${j}] || {}).nombre`) + ' · noComida=' + await h.ev(`userData.noComida`));
      await h.espera(2800);
      h.marca('fin');
    }
  },

  // 21 · Más de 1.100 recetas: 5 opciones por comida y el recetario.
  recetas: {
    salida: '21-mas-de-1100-recetas.mp4',
    fecha: '2026-11-02T09:30:00',
    cambios: {},
    gancho: ['ai-carrito-raw.mp4'],
    fondo: ['ai-plato-raw.mp4', 'ai-carrito-raw.mp4', 'ai-plato-raw.mp4', 'ai-carrito-raw.mp4', 'ai-plato-raw.mp4', 'ai-carrito-raw.mp4'],
    async pasos(h) {
      await h.ev(`(() => { hdTab('com'); window.scrollTo(0, document.getElementById('hoyDia').getBoundingClientRect().top + scrollY - 12); return 'ok'; })()`);
      await h.espera(400);
      h.grabar();
      h.marca('hoy');
      await h.espera(1300);
      await h.ev(`__toca(document.querySelector('#hdPanel .hn-ver'))`); await h.espera(1600);
      h.marca('opciones');
      await h.ev(`(() => { const b = document.getElementById('mealBlock0'); if (!b.classList.contains('expanded')) __toca(b.querySelector('.meal-block-header'), false); return 'ok'; })()`); await h.espera(900);
      await h.ev(`__arriba(document.getElementById('mealBlock0'), 70)`); await h.espera(1500);
      await h.ev(`(() => { const ops = document.querySelectorAll('#mealBlock0 .meal-option'); ops[Math.min(3, ops.length - 1)].scrollIntoView({ block: 'center', behavior: 'smooth' }); return ops.length; })()`); await h.espera(1100);
      h.marca('elige');
      await h.ev(`(() => { const ops = document.querySelectorAll('#mealBlock0 .meal-option'); return __toca(ops[Math.min(3, ops.length - 1)], false); })()`); await h.espera(1700);
      h.marca('recetario');
      await h.ev(`__toca(document.querySelector('.btn-recetario'))`); await h.espera(1400);
      await h.ev(`(() => { try { cambiarModoRecetario('todas'); } catch (e) {} return 'ok'; })()`); await h.espera(500);
      await h.ev(`__toca(document.getElementById('recetarioBuscador'), false)`); await h.espera(400);
      await h.ev(`__escribe(document.getElementById('recetarioBuscador'), 'salmón', 120, true)`); await h.espera(1300);
      await h.ev(`(() => { document.querySelectorAll('#modalRecetario [id^=recSec]').forEach(s => { if (s.offsetParent) s.classList.add('open'); }); return 'ok'; })()`); await h.espera(500);
      h.marca('receta');
      await h.ev(`(() => { const t = [...document.querySelectorAll('#modalRecetario .receta-nombre')].find(e => e.offsetParent); if (!t) return 'sin receta'; t.click(); setTimeout(() => t.closest('.receta-card').scrollIntoView({ block: 'start', behavior: 'smooth' }), 200); return t.textContent; })()`).then(x => h.log('receta: ' + x));
      await h.espera(3800);
      h.marca('fin');
    }
  },

  // 22 · Modo carrera (run/walk de principiante): cuenta atrás, «¡a correr!», «camina» y resumen.
  // El tiempo se adelanta entre fases (se ve el cambio, no los minutos): se avisa en pantalla.
  carrera: {
    salida: '22-mi-entrenador-con-ia-me-dice-cuando-correr.mp4',
    lento: 1, // la cuenta atrás se ve: a cámara lenta los segundos no serían segundos
    fecha: '2026-11-02T18:30:00',
    cambios: { deporte: 'Running', lugar: 'Al aire libre', objetivo: 'Mejorar resistencia', nivel: 'Principiante', diasEntreno: '3 días', historialEntrenos: [], entrenosCompletados: [] },
    gancho: ['ai-cardio-conmovil-raw.mp4'],
    fondo: ['ai-hibrido-cardio-raw.mp4', 'ai-cardio-extendido-raw.mp4', 'ai-hibrido-cardio-raw.mp4', 'ai-cardio-extendido-raw.mp4', 'ai-hibrido-cardio-raw.mp4', 'ai-cardio-extendido-raw.mp4'],
    async pasos(h) {
      h.log('hoy: ' + await h.ev(`(_hdSesion(getIndiceDiaHoy()) || {}).resumen`));
      await h.ev(`(() => { localStorage.removeItem('kone_carrera_' + getFechaHoyISO()); hdTab('ent'); window.scrollTo(0, document.getElementById('hdTabs').getBoundingClientRect().top + scrollY - 12); return 'ok'; })()`);
      await h.espera(400);
      // Adelanta la fase actual hasta que le queden «quedan» segundos (y el total, lo mismo).
      await h.ev(`window.__adelanta = (quedan) => { const p = _cr.pasos[_cr.i]; const d = (_cr.faseInicio + p.seg * 1000 - Date.now()) - quedan * 1000; if (d > 0) { _cr.faseInicio -= d; _cr.inicio -= d; } _crTick(); return 'ok'; }; window.__saltaA = (i, quedan) => { let d = (_cr.faseInicio + _cr.pasos[_cr.i].seg * 1000 - Date.now()); for (let k = _cr.i + 1; k < i; k++) d += (_cr.pasos[k].seg || 60) * 1000; const p = _cr.pasos[i]; _cr.inicio -= d + (p.seg - quedan) * 1000; _cr.i = i; _cr.faseInicio = Date.now() - (p.seg - quedan) * 1000; _crGuardar(); _crPintar(); _crProgramar(); return 'ok'; }; 'ok'`);
      h.grabar();
      h.marca('hoy');
      await h.espera(1700);
      await h.ev(`__toca(document.querySelector('#hdPanel .today-hero-btn'))`); await h.espera(1500);
      h.marca('calienta');
      await h.espera(1000);
      await h.ev(`__adelanta(4)`); await h.espera(4300);
      h.marca('corre');
      await h.espera(1400);
      await h.ev(`__adelanta(3)`); await h.espera(3300);
      h.marca('camina');
      await h.espera(1600);
      await h.ev(`__saltaA(_cr.pasos.length - 1, 4)`); await h.espera(600);
      h.marca('calma');
      await h.espera(4100);
      h.marca('resumen');
      h.log('fin: ' + await h.ev(`JSON.stringify({ fin: !!_cr.fin, min: Math.round((_cr.fin - _cr.inicio) / 60000), hecho: (userData.entrenosCompletados || []).includes(getFechaHoyISO()) })`));
      await h.espera(2600);
      h.marca('fin');
    }
  }
};
