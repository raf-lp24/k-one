// Prepara la sección de ENTRENAMIENTO (perfil Híbrido) para capturarla,
// función por función. Cliente inventado ("Laura"), nunca los datos de un
// cliente real. Copia de estado-demo-entreno.js con el perfil cambiado a
// Híbrido -- ver ese archivo para los comentarios completos de cada vista.
(async () => {
  const listo = () => { try { userData; return typeof buildPlanFromData === 'function'; } catch (e) { return false; } };
  for (let i = 0; i < 240 && !listo(); i++) await new Promise(r => setTimeout(r, 250));
  if (!listo()) return 'ERROR: la app no terminó de cargar';

  ['hoy', 'semana', 'nutricion', 'checkin', 'progreso', 'notas', 'contacto']
    .forEach(s => { try { localStorage.setItem('kone_guia_' + s, '1'); } catch (e) {} });
  const _ocultarBanners = () => {
    ['bannerRecalculo', 'bannerFeedback', 'bannerMotivoBaja', 'avisoRenovacion',
     'avisoPagoPendiente', 'pwaInstallBanner', 'pushBanner']
      .forEach(id => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
  };
  document.querySelectorAll('button').forEach(b => {
    if (/ACEPTAR|Solo necesarias/i.test(b.textContent || '')) b.click();
  });
  [...document.querySelectorAll('div')].forEach(d => {
    if (/Instala K-ONE como app/.test(d.textContent || '') && d.children.length < 6) d.remove();
  });

  const demo = {
    nombre: 'Laura Gómez', email: 'demo@k-one.fit', edad: 33, sexo: 'Mujer',
    peso: 62, altura: 167, objetivo: 'Mejorar resistencia', deporte: 'Híbrido',
    diasEntreno: '4 días', tiempoSesion: '45-60 min', nivel: 'Llevo algo de tiempo',
    lugar: 'Gimnasio + exterior', lesion: 'No', alergia: 'No', dieta: 'Como de todo',
    noComida: '', comidas: '4-5 veces', onboardingCompletado: true,
    tipoPlan: 'Plan completo: entrenamiento + nutrición', rotacionMenu: 'semanal',
    progreso: { semana: 3, diasEntrenados: 2, ajuste: 0 },
    historialEntrenos: [], entrenosCompletados: [],
    pesosEjercicios: {}
  };

  userData = demo;
  generatedPlan = buildPlanFromData(demo);

  try {
    setCurrentUser({
      nombre: demo.nombre, email: demo.email,
      creado: new Date(Date.now() - 60 * 86400000).toISOString(),
      suscripcionActiva: true,
      fechaPago: new Date(Date.now() + 20 * 86400000).toISOString(),
      inicioPeriodo: new Date(Date.now() - 15 * 86400000).toISOString(),
      pagoPendiente: false
    });
  } catch (e) {}

  document.getElementById('landing') && (document.getElementById('landing').style.display = 'none');
  const dash = document.getElementById('dashboard');
  if (dash) { dash.style.display = 'block'; dash.classList.add('visible'); }
  try { buildDashboard(); } catch (e) { return 'ERROR buildDashboard: ' + e.message; }
  try { showSection('hoy'); } catch (e) {}
  await new Promise(r => setTimeout(r, 800));
  _ocultarBanners();

  const irA = (sel, margen = 24) => {
    const e = document.querySelector(sel);
    if (!e) return 'no existe ' + sel;
    const y = e.getBoundingClientRect().top + window.scrollY - margen;
    window.scrollTo(0, Math.max(0, y));
    return Math.round(y);
  };

  const vista = window.__VISTA || 'hoy';
  let pos = 0;

  if (vista === 'hoy') { pos = irA('#todayPlan', 90); }

  if (vista === 'tarjeta') { pos = irA('.ejercicio-card', 60); }

  if (vista === 'peso') {
    pos = irA('.ejercicio-card .peso-stepper', 240);
  }

  if (vista === 'comosehace') {
    const btn = document.querySelector('.ejercicio-info-btn, .ejercicio-thumb');
    if (!btn) return 'AVISO: no hay ningún ejercicio con ficha en este plan';
    try { btn.click(); } catch (e) { return 'ERROR abriendo la ficha: ' + e.message; }
    await new Promise(r => setTimeout(r, 700));
    const modal = document.getElementById('modalInfoEjercicio');
    if (!modal || !modal.classList.contains('visible')) return 'AVISO: este ejercicio no tiene ficha con fotos, solo vídeo';
  }

  if (vista === 'feedback') {
    try { toggleFeedback(); } catch (e) { return 'ERROR toggleFeedback: ' + e.message; }
    await new Promise(r => setTimeout(r, 500));
    pos = irA('#feedbackPanel', 60);
  }

  if (vista === 'semana') {
    try { showSection('semana'); } catch (e) { return 'ERROR showSection semana: ' + e.message; }
    await new Promise(r => setTimeout(r, 700));
    // La semana por defecto (generatedPlan.semana, sin tocar ninguna pestaña)
    // ya trae fuerza y cardio alternados de verdad para un perfil Híbrido a
    // 4 días (Lunes fuerza, Martes cardio -- ver esCombinacion en index.html).
    // Cambiar de pestaña de semana no hacía falta y además era menos fiable
    // (selectSemanaTab() vuelve a pintar la lista y no siempre queda en el
    // mismo estado a tiempo para la captura). Basta con colapsar "hoy" si
    // sale expandido y anclar la captura en el primer día.
    const filasDe = () => [...document.querySelectorAll('.week-day-row')];
    let filas = filasDe();
    const hoyExpandido = filas.find(f => f.classList.contains('expanded'));
    if (hoyExpandido) { try { toggleWeekDay(hoyExpandido); } catch (e) {} await new Promise(r => setTimeout(r, 300)); filas = filasDe(); }
    const destino = filas[0];
    if (destino) {
      const y = destino.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo(0, Math.max(0, y));
      pos = Math.round(y);
    }
  }

  await new Promise(r => setTimeout(r, 500));
  return 'ok · ' + vista + ' · scrollY=' + Math.round(window.scrollY) + ' · destino=' + pos;
})();
