// Prepara la app en la pantalla "Hoy" con un cliente de DEMO para poder
// capturarla. Los datos son inventados a proposito: nunca se usa el perfil de
// un cliente real para material de marketing.
//
// Se le pasa a cdp-shot.mjs como ultimo argumento. Acepta una variable global
// __VISTA (inyectada antes) para decidir que trozo dejar preparado.
(async () => {
  // Esperar a que la app este cargada DE VERDAD, en vez de fiarse del tiempo
  // fijo de cdp-shot. Ojo: no vale comprobar `typeof buildPlanFromData ===
  // "function"`, porque las declaraciones de funcion se crean al analizar el
  // archivo y dan true desde el primer instante, cuando el script todavia no ha
  // ejecutado ni una linea. Lo que de verdad indica que ha terminado es que
  // `userData` (un `let`) ya este inicializada: hasta entonces, tocarla lanza
  // "Cannot access 'userData' before initialization".
  const listo = () => { try { userData; return typeof buildPlanFromData === 'function'; } catch (e) { return false; } };
  for (let i = 0; i < 120 && !listo(); i++) await new Promise(r => setTimeout(r, 250));
  if (!listo()) return 'ERROR: la app no terminó de cargar';

  // Las guias de primera vez ("Tu entrenamiento de hoy") se marcan como vistas
  // ANTES de entrar en la seccion: si no, se abre el modal encima y tapa la
  // pantalla entera en la captura.
  ['hoy', 'semana', 'nutricion', 'checkin', 'progreso', 'notas', 'contacto']
    .forEach(s => { try { localStorage.setItem('kone_guia_' + s, '1'); } catch (e) {} });

  // Cerrar cookies y banners que taparian la captura.
  document.querySelectorAll('button').forEach(b => {
    if (/ACEPTAR|Solo necesarias/i.test(b.textContent || '')) b.click();
  });
  [...document.querySelectorAll('div')].forEach(d => {
    if (/Instala K-ONE como app/.test(d.textContent || '') && d.children.length < 6) d.remove();
  });

  const demo = {
    nombre: 'Marcos', email: 'demo@k-one.fit', edad: 29, sexo: 'Hombre',
    peso: 79, altura: 179, objetivo: 'Ganar músculo', deporte: 'Gimnasio / Fuerza',
    diasEntreno: '4', experiencia: 'Intermedio', lugar: 'Gimnasio', lesion: 'Ninguna',
    alergia: 'No', dieta: 'Como de todo', noComida: '', comidas: '5 veces',
    onboardingCompletado: true, tipoPlan: 'Plan completo: entrenamiento + nutrición',
    rotacionMenu: 'semanal',
    // Racha y adherencia con datos: si van a cero, las tarjetas del lateral
    // salen vacias y no se ve para que sirven.
    progreso: { semana: 6, diasEntrenados: 3, ajuste: 0 },
    // La adherencia se mide sobre la SEMANA EN CURSO (lunes a hoy), asi que el
    // historial tiene que incluir dias de esta semana o la tarjeta sale al 0% y
    // en un video de funciones eso no ensena nada.
    historialEntrenos: (() => {
      const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const hoy = new Date(), f = [];
      // Lunes de esta semana (getDay: 0=domingo)
      const lunes = new Date(hoy); lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
      // 3 dias entrenados esta semana, incluido ayer: adherencia alta y racha viva
      for (let i = 0; i < 7; i++) {
        const d = new Date(lunes.getTime() + i * 86400000);
        if (d > hoy) break;
        if (i === 2 || i === 5) continue;              // huecos: creible, no perfecto
        f.push(iso(d));
      }
      // Cuatro semanas previas, para que el historial no empiece de la nada
      for (let i = 8; i <= 30; i++) {
        if (i % 7 === 3 || i % 7 === 6) continue;
        f.push(iso(new Date(hoy.getTime() - i * 86400000)));
      }
      return [...new Set(f)];
    })(),
    pesosEjercicios: {}
  };

  // La tarjeta de ADHERENCIA no mira historialEntrenos, sino
  // `entrenosCompletados` filtrado desde el lunes de esta semana (ver
  // buildDashboard). Sin esto la tarjeta sale al 0% y en un video de funciones
  // eso no ensena nada. Se rellena con los dias de esta semana que ya estan en
  // el historial, para que las dos tarjetas cuenten lo mismo.
  {
    const hoy = new Date();
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
    lunes.setHours(0, 0, 0, 0);
    demo.entrenosCompletados = demo.historialEntrenos.filter(f => new Date(f) >= lunes);
  }

  // OJO: asignacion DIRECTA, no `window.userData`. La app declara userData y
  // generatedPlan con `let` en el ambito global lexico, y esas variables NO son
  // propiedades de window: `window.userData = x` crea otra distinta y el panel
  // se queda con los valores de relleno ("Semana 1 · Bienvenido/a").
  userData = demo;
  generatedPlan = buildPlanFromData(demo);

  // Sesion activa simulada: sin esto el panel se queda en el paywall.
  try {
    setCurrentUser({
      nombre: demo.nombre, email: demo.email, creado: new Date(Date.now() - 40 * 86400000).toISOString(),
      suscripcionActiva: true, fechaPago: new Date(Date.now() + 22 * 86400000).toISOString(),
      inicioPeriodo: new Date(Date.now() - 8 * 86400000).toISOString(),
      pagoPendiente: false
    });
  } catch (e) {}

  document.getElementById('landing') && (document.getElementById('landing').style.display = 'none');
  const dash = document.getElementById('dashboard');
  if (dash) { dash.style.display = 'block'; dash.classList.add('visible'); }

  try { buildDashboard(); } catch (e) { return 'ERROR buildDashboard: ' + e.message; }
  try { showSection('hoy'); } catch (e) {}

  // Los banners de aviso (pago, renovacion, recalculo, feedback, referidos) se
  // ocultan: son estados excepcionales y en un video de funciones despistan.
  ['avisoPagoPendiente', 'avisoRenovacion', 'bannerRecalculo', 'bannerFeedback', 'bannerReferidos']
    .forEach(id => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });

  await new Promise(r => setTimeout(r, 600));

  const vista = window.__VISTA || 'arriba';
  // scrollIntoView no vale aqui: si el elemento ya esta dentro del viewport no
  // mueve nada (la lista de ejercicios salia identica a la primera captura).
  // Se calcula la posicion absoluta y se hace scroll a mano, con un margen
  // arriba para que el bloque no quede pegado al borde.
  const irA = (sel, margen = 24) => {
    const e = document.querySelector(sel);
    if (!e) return 'no existe ' + sel;
    const y = e.getBoundingClientRect().top + window.scrollY - margen;
    window.scrollTo(0, Math.max(0, y));
    return Math.round(y);
  };

  let pos = 0;
  if (vista === 'arriba')      { window.scrollTo(0, 0); pos = 0; }
  if (vista === 'ejercicios')  pos = irA('#todayPlan');
  if (vista === 'completar')   pos = irA('#btnCompletado', 220);
  if (vista === 'feedback')    { try { toggleFeedback(); } catch (e) {} await new Promise(r => setTimeout(r, 500)); pos = irA('#feedbackPanel'); }
  if (vista === 'rail')        pos = irA('.hoy-rail');
  // Registro de pesos: esta dentro de las tarjetas de ejercicio, mas abajo.
  if (vista === 'pesos')       pos = irA('.peso-stepper', 260);

  await new Promise(r => setTimeout(r, 500));
  return 'ok · vista=' + vista + ' · scrollY=' + Math.round(window.scrollY) + ' · destino=' + pos;
})();
