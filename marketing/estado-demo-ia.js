// Prepara la app con el cliente de demo («Marcos», datos inventados) para los
// vídeos de «tu entrenador personal con IA» (30 oct 2026). Se configura con la
// global __IA, que se inyecta antes (ver marketing/capturas-ia.mjs):
//   cambios:  campos del perfil que cambian respecto a la demo (alergia, noComida, progreso…)
//   seccion:  'nutricion' | 'hoy' | 'checkin' | 'recetario'
//   comida:   en nutrición, el bloque al que bajar ('Desayuno', 'Comida', 'Merienda', 'Cena')
//   checkin:  { dias, fisico, energia, mente } → deja marcadas esas respuestas
//   enviar:   true → pulsa «enviar» en el check-in y espera la respuesta
//   receta:   en el recetario, el nombre (o trozo) de la receta a abrir
(async () => {
  const cfg = window.__IA || {};
  const listo = () => { try { userData; return typeof buildPlanFromData === 'function'; } catch (e) { return false; } };
  for (let i = 0; i < 240 && !listo(); i++) await new Promise(r => setTimeout(r, 250));
  if (!listo()) return 'ERROR: la app no terminó de cargar';
  const dormir = ms => new Promise(r => setTimeout(r, ms));

  ['hoy', 'semana', 'nutricion', 'checkin', 'progreso', 'notas', 'contacto']
    .forEach(s => { try { localStorage.setItem('kone_guia_' + s, '1'); } catch (e) {} });
  document.querySelectorAll('button').forEach(b => { if (/ACEPTAR|Solo necesarias/i.test(b.textContent || '')) b.click(); });
  [...document.querySelectorAll('div')].forEach(d => { if (/Instala K-ONE como app/.test(d.textContent || '') && d.children.length < 6) d.remove(); });

  const demo = Object.assign({
    nombre: 'Marcos Ruiz', email: 'demo@k-one.fit', edad: 29, sexo: 'Hombre',
    peso: 84, altura: 179, objetivo: 'Perder grasa', deporte: 'Gimnasio / Fuerza',
    diasEntreno: '4 días', tiempoSesion: '45-60 min', nivel: 'Llevo algo de tiempo',
    lugar: 'Gimnasio', lesion: 'No', alergia: 'No', dieta: 'Como de todo',
    noComida: '', comidas: '4-5 veces', onboardingCompletado: true,
    tipoPlan: 'Plan completo: entrenamiento + nutrición', rotacionMenu: 'semanal',
    progreso: { semana: 2, diasEntrenados: 3, ajuste: 0 },
    historialEntrenos: [], entrenosCompletados: [], pesosEjercicios: {}
  }, cfg.cambios || {});
  userData = demo;
  generatedPlan = buildPlanFromData(demo);
  try {
    setCurrentUser({ nombre: demo.nombre, email: demo.email, creado: new Date(Date.now() - 60 * 86400000).toISOString(),
      suscripcionActiva: true, fechaPago: new Date(Date.now() + 20 * 86400000).toISOString(),
      inicioPeriodo: new Date(Date.now() - 8 * 86400000).toISOString(), pagoPendiente: false });
  } catch (e) {}
  document.getElementById('landing') && (document.getElementById('landing').style.display = 'none');
  const dash = document.getElementById('dashboard');
  if (dash) { dash.style.display = 'block'; dash.classList.add('visible'); }
  try { buildDashboard(); } catch (e) { return 'ERROR buildDashboard: ' + e.message; }
  // Nada de envíos reales a la base de datos desde una demo.
  try { window.guardarUserData = async () => {}; } catch (e) {}

  const seccion = cfg.seccion || 'nutricion';
  try { showSection(seccion === 'recetario' ? 'nutricion' : seccion); } catch (e) {}
  await dormir(900);
  const irA = (el, margen = 20) => { if (!el) return -1; const y = el.getBoundingClientRect().top + window.scrollY - margen; window.scrollTo(0, Math.max(0, y)); return Math.round(y); };

  let pos = 0;
  if (seccion === 'nutricion' && cfg.comida) {
    const b = [...document.querySelectorAll('#section-nutricion .meal-block')].find(e => (e.innerText || '').trim().startsWith(cfg.comida));
    pos = irA(b, 90);
  }
  if (seccion === 'hoy' && cfg.bajar) {
    const e = [...document.querySelectorAll('#section-hoy *')].find(x => x.children.length < 4 && new RegExp(cfg.bajar, 'i').test(x.textContent || '') && x.offsetHeight > 0);
    pos = irA(e, 140);
  }
  if (seccion === 'checkin') {
    const marcar = (grupo, valor) => {
      const op = [...document.querySelectorAll('#rating-' + grupo + ' .rating-btn')].find(x => (x.textContent || '').trim().toLowerCase().startsWith(String(valor).toLowerCase()));
      if (op) op.click();
      return !!op;
    };
    const c = cfg.checkin || {};
    const hechos = Object.entries(c).map(([g, v]) => g + ':' + marcar(g, v)).join(',');
    pos = irA(document.querySelector('#rating-' + (cfg.bajarA || 'dias')), 160);
    if (cfg.enviar) {
      try { submitCheckin(); } catch (e) { return 'ERROR submitCheckin: ' + e.message; }
      await dormir(2600);
      pos = irA(document.getElementById('checkinResponse'), 120);
    }
    if (!cfg.enviar) await dormir(300);
    if (hechos.includes('false')) return 'AVISO check-in: ' + hechos;
  }
  if (seccion === 'recetario') {
    try { abrirRecetario(); } catch (e) { return 'ERROR abrirRecetario: ' + e.message; }
    await dormir(800);
    try { cambiarModoRecetario('todas'); } catch (e) {}
    await dormir(400);
    if (cfg.receta) {
      const i = document.getElementById('recetarioBuscador');
      i.value = cfg.receta; filtrarRecetario(cfg.receta);
      await dormir(400);
      document.querySelectorAll('#modalRecetario [id^=recSec]').forEach(s => { if (s.offsetParent) s.classList.add('open'); });
      await dormir(300);
      const t = [...document.querySelectorAll('#modalRecetario .receta-nombre')].find(e => e.textContent.includes(cfg.receta));
      if (t) { t.click(); await dormir(400); t.closest('[class*="receta"]').parentElement.scrollIntoView({ block: 'start' }); }
    }
  }
  await dormir(500);
  return 'ok · ' + seccion + ' · y=' + pos;
})();
