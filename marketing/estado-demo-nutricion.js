// Prepara la sección de NUTRICIÓN para capturarla, función por función.
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
    peso: 84, altura: 179, objetivo: 'Perder grasa', deporte: 'Gimnasio / Fuerza',
    diasEntreno: '4 días', tiempoSesion: '45-60 min', nivel: 'Llevo algo de tiempo',
    lugar: 'Gimnasio', lesion: 'No', alergia: 'No', dieta: 'Como de todo',
    noComida: '', comidas: '4-5 veces', onboardingCompletado: true,
    tipoPlan: 'Plan completo: entrenamiento + nutrición', rotacionMenu: 'semanal',
    progreso: { semana: 2, diasEntrenados: 3, ajuste: 0 },
    historialEntrenos: [], entrenosCompletados: [], pesosEjercicios: {}
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
      inicioPeriodo: new Date(Date.now() - 8 * 86400000).toISOString(),
      pagoPendiente: false
    });
  } catch (e) {}

  document.getElementById('landing') && (document.getElementById('landing').style.display = 'none');
  const dash = document.getElementById('dashboard');
  if (dash) { dash.style.display = 'block'; dash.classList.add('visible'); }
  try { buildDashboard(); } catch (e) { return 'ERROR buildDashboard: ' + e.message; }
  try { showSection('nutricion'); } catch (e) {}
  await new Promise(r => setTimeout(r, 800));

  // scrollIntoView no vale: si el elemento ya está dentro del viewport no mueve
  // nada. Se calcula la posición absoluta y se hace scroll a mano.
  const irA = (sel, margen = 24) => {
    const e = document.querySelector(sel);
    if (!e) return 'no existe ' + sel;
    const y = e.getBoundingClientRect().top + window.scrollY - margen;
    window.scrollTo(0, Math.max(0, y));
    return Math.round(y);
  };

  const vista = window.__VISTA || 'cabecera';
  let pos = 0;

  if (vista === 'cabecera')  { window.scrollTo(0, 0); }
  if (vista === 'renovacion') pos = irA('#rotacionMenuBox');
  if (vista === 'carbos') {
    // El ciclado solo se enseña si el plan lo aplica de verdad (hacen falta
    // días de entreno Y de descanso). Si no está, no se fuerza: se avisa.
    const box = document.getElementById('cicloCarbsBox');
    if (!box || getComputedStyle(box).display === 'none') return 'AVISO: este perfil no tiene ciclado de carbohidratos';
    pos = irA('#cicloCarbsBox');
  }
  if (vista === 'herramientas') pos = irA('.btn-recetario', 60);
  if (vista === 'dias')         pos = irA('.nutri-dia', 90);

  if (vista === 'recetario') {
    try { abrirRecetario(); } catch (e) { return 'ERROR abrirRecetario: ' + e.message; }
    await new Promise(r => setTimeout(r, 900));
  }
  if (vista === 'alimentos') {
    try { abrirBuscadorAlimentos(); } catch (e) { return 'ERROR abrirBuscadorAlimentos: ' + e.message; }
    await new Promise(r => setTimeout(r, 700));
    // Con una búsqueda escrita se ve para qué sirve; vacío no dice nada.
    const inp = document.querySelector('#modalAlimentos input, #modalAlimentos input[type="text"]');
    if (inp) {
      inp.value = 'pollo';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 600));
    }
  }
  if (vista === 'listacompra') {
    // La lista de la compra necesita los 7 días confirmados. Se confirman a
    // mano para poder enseñar el resultado, que es el final del recorrido.
    try {
      for (let d = 0; d < 7; d++) {
        seleccionarDiaNutri(d);
        await new Promise(r => setTimeout(r, 120));
        confirmarDiaNutri();
        await new Promise(r => setTimeout(r, 120));
      }
    } catch (e) { return 'ERROR confirmando días: ' + e.message; }
    await new Promise(r => setTimeout(r, 500));
    try { generarListaCompra(); } catch (e) { return 'ERROR generarListaCompra: ' + e.message; }
    await new Promise(r => setTimeout(r, 1000));
  }

  await new Promise(r => setTimeout(r, 500));
  return 'ok · ' + vista + ' · scrollY=' + Math.round(window.scrollY) + ' · destino=' + pos;
})();
