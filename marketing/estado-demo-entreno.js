// Prepara la sección de ENTRENAMIENTO para capturarla, función por función.
// Cliente inventado ("Marcos"), nunca los datos de un cliente real.
//
// Se le pasa a cdp-shot.mjs. La vista se elige con la global __VISTA.
(async () => {
  // La app está lista cuando `userData` está inicializada: comprobar que existe
  // buildPlanFromData no vale, porque las funciones se crean al ANALIZAR el
  // archivo y dan true desde el primer instante.
  const listo = () => { try { userData; return typeof buildPlanFromData === 'function'; } catch (e) { return false; } };
  for (let i = 0; i < 240 && !listo(); i++) await new Promise(r => setTimeout(r, 250));
  if (!listo()) return 'ERROR: la app no terminó de cargar';

  // Guías de primera vez marcadas como vistas: si no, el modal tapa la captura.
  ['hoy', 'semana', 'nutricion', 'checkin', 'progreso', 'notas', 'contacto']
    .forEach(s => { try { localStorage.setItem('kone_guia_' + s, '1'); } catch (e) {} });
  document.querySelectorAll('button').forEach(b => {
    if (/ACEPTAR|Solo necesarias/i.test(b.textContent || '')) b.click();
  });
  [...document.querySelectorAll('div')].forEach(d => {
    if (/Instala K-ONE como app/.test(d.textContent || '') && d.children.length < 6) d.remove();
  });

  const demo = {
    nombre: 'Marcos Ruiz', email: 'demo@k-one.fit', edad: 29, sexo: 'Hombre',
    peso: 84, altura: 179, objetivo: 'Ganar músculo', deporte: 'Gimnasio / Fuerza',
    diasEntreno: '4 días', tiempoSesion: '45-60 min', nivel: 'Llevo algo de tiempo',
    lugar: 'Gimnasio', lesion: 'No', alergia: 'No', dieta: 'Como de todo',
    noComida: '', comidas: '4-5 veces', onboardingCompletado: true,
    tipoPlan: 'Plan completo: entrenamiento + nutrición', rotacionMenu: 'semanal',
    progreso: { semana: 3, diasEntrenados: 2, ajuste: 0 },
    // Un peso ya guardado en el press banca: así la tarjeta no sale a 0 y se ve
    // para qué sirve el histórico ("Anterior: X kg").
    historialEntrenos: [], entrenosCompletados: [],
    pesosEjercicios: {}
  };

  // Asignación DIRECTA: userData y generatedPlan son `let` del ámbito global
  // léxico y NO son propiedades de window (window.userData crea otra distinta).
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
    // El stepper de peso vive DENTRO de la tarjeta: centrar el peso concreto,
    // no la tarjeta entera, para que la captura sea del control en sí.
    pos = irA('.peso-stepper', 200);
  }

  if (vista === 'comosehace') {
    const btn = document.querySelector('.ejercicio-info-btn, .ejercicio-thumb');
    if (!btn) return 'AVISO: no hay ningún ejercicio con ficha en este plan';
    try { btn.click(); } catch (e) { return 'ERROR abriendo la ficha: ' + e.message; }
    await new Promise(r => setTimeout(r, 700));
    // Si el ejercicio no tiene ficha propia, abrirInfoEjercicio() abre el vídeo
    // en una pestaña nueva y no hay modal que capturar.
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
  }

  await new Promise(r => setTimeout(r, 500));
  return 'ok · ' + vista + ' · scrollY=' + Math.round(window.scrollY) + ' · destino=' + pos;
})();
