// Prepara la pantalla de ALTA y el CUESTIONARIO para poder capturarlos.
//
// NO REGISTRA NADA. El index.html apunta a la Supabase de produccion, asi que
// enviar el formulario crearia un cliente falso de verdad y dispararia sus
// emails. Aqui solo se rellenan los campos y se navega entre bloques: lo que se
// captura son las PANTALLAS, que es lo que hay que explicar en el video.
//
// Se le pasa a cdp-shot.mjs. La vista se elige con la global __VISTA.
(async () => {
  // Misma espera que en estado-demo-hoy.js: las funciones existen desde que se
  // analiza el archivo, asi que lo que dice que la app termino de cargar es que
  // `userData` ya este inicializada.
  const listo = () => { try { userData; return typeof goTo === 'function'; } catch (e) { return false; } };
  for (let i = 0; i < 240 && !listo(); i++) await new Promise(r => setTimeout(r, 250));
  if (!listo()) return 'ERROR: la app no terminó de cargar';

  document.querySelectorAll('button').forEach(b => {
    if (/ACEPTAR|Solo necesarias/i.test(b.textContent || '')) b.click();
  });
  [...document.querySelectorAll('div')].forEach(d => {
    if (/Instala K-ONE como app/.test(d.textContent || '') && d.children.length < 6) d.remove();
  });

  const set = (id, val) => {
    const e = document.getElementById(id);
    if (!e) return false;
    e.value = val;
    e.dispatchEvent(new Event('input', { bubbles: true }));
    e.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  };
  // Los radios del cuestionario son <div class="radio-opt"> con onclick, no
  // inputs: hay que pulsarlos para que el codigo marque la opcion y dispare los
  // campos condicionales (lesion, alergia "Otra"...).
  const radio = (grupo, etiqueta) => {
    const cont = document.getElementById(grupo);
    if (!cont) return false;
    const op = [...cont.querySelectorAll('.radio-opt')]
      .find(o => (o.textContent || '').trim().toLowerCase() === etiqueta.toLowerCase());
    if (op) { op.click(); return true; }
    return false;
  };

  const vista = window.__VISTA || 'registro';

  if (vista === 'landing') {
    goTo('landing');
    await new Promise(r => setTimeout(r, 700));
    window.scrollTo(0, 0);
    return 'ok · landing';
  }

  if (vista === 'registro') {
    goTo('registro');
    await new Promise(r => setTimeout(r, 700));
    // Datos de EJEMPLO. La contraseña se deja escrita para que se vea el
    // medidor de seguridad, que es parte de lo que hay que explicar.
    set('reg-nombre', 'Carlos García López');
    set('reg-email', 'carlos.garcia@email.com');
    // Los campos son reg-pass / reg-pass2 (no "reg-password"). Se rellenan las
    // dos para que se vea el medidor de seguridad y el check de coincidencia,
    // que es justo lo que suele atascar a la gente al darse de alta.
    set('reg-pass', 'Entreno2026!');
    set('reg-pass2', 'Entreno2026!');
    // Y se marcan las casillas obligatorias: forman parte de lo que hay que
    // explicar (sin ellas el boton no deja continuar).
    ['reg-terminos', 'reg-mayorEdad', 'reg-datosSalud'].forEach(id => {
      const c = document.getElementById(id);
      if (c && !c.checked) { c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); }
    });
    await new Promise(r => setTimeout(r, 700));
    window.scrollTo(0, 0);
    return 'ok · registro (SIN enviar)';
  }

  // ── CUESTIONARIO ───────────────────────────────────────────────────────────
  goTo('formulario');
  await new Promise(r => setTimeout(r, 700));

  // Se rellena TODO de una vez y luego se salta al bloque que toca: asi cada
  // captura sale con el cuestionario contestado, que explica mucho mejor que
  // los campos vacios.
  // Las etiquetas son EXACTAS: se sacaron leyendo los .radio-opt del DOM, no de
  // memoria. Escribir "5 veces" cuando la opcion pone "4-5 veces" deja el campo
  // sin marcar y la captura sale a medias (paso por eso con "sexo", que ademas
  // no es un grupo de radios sino un <select>).
  set('edad', '29'); set('altura', '179'); set('peso', '79');
  set('sexo', 'Hombre');                       // <select>, no radios
  radio('enfermedad', 'No');
  radio('lesion', 'No');
  radio('alergia', 'No');
  radio('jornada', 'Sentado todo el día');
  radio('estres', 'Medio');
  radio('sueno', '7-8 horas');
  radio('dieta', 'Como de todo');
  radio('comidas', '4-5 veces');
  radio('cocina', 'Casi siempre en casa');
  set('noComida', 'Hígado, casquería');
  // Bloque 4
  radio('tipoPlan', 'Plan completo: entrenamiento + nutrición');
  radio('objetivo', 'Ganar músculo');
  radio('enfoqueMacros', 'Alto en proteína');
  // Bloque 5 -- todos obligatorios menos la marca de carrera
  radio('deporteSolo', 'No entreno, llevo una vida sedentaria');
  radio('actividadSolo', 'No entreno / muy poca actividad');
  radio('deporte', 'Gimnasio / Fuerza');
  radio('diasEntreno', '4 días');
  radio('tiempoSesion', '45-60 min');
  radio('nivel', 'Llevo algo de tiempo');
  radio('lugar', 'Gimnasio');
  await new Promise(r => setTimeout(r, 500));

  const bloque = { cuerpo: 0, salud: 1, vida: 2, alimentacion: 3, objetivo: 4, entrenamiento: 5 }[vista];
  if (bloque === undefined) return 'ERROR: vista desconocida: ' + vista;

  // goToBlock() NO sirve para saltar: descarta cualquier destino por encima de
  // `maxBlockReached`, que empieza en 0, asi que solo llegaba al bloque 1 y
  // todas las capturas salian con "Tu cuerpo". Se avanza con nextBlock(), que
  // ademas VALIDA cada bloque -- es el mismo camino que hace un cliente, y si
  // faltara algo por rellenar se nota aqui en vez de en la captura.
  for (let i = 0; i < bloque; i++) {
    const antes = document.querySelector('.form-block.active')?.dataset.block;
    nextBlock();
    await new Promise(r => setTimeout(r, 350));
    const ahora = document.querySelector('.form-block.active')?.dataset.block;
    if (antes === ahora) return 'ERROR: el bloque ' + antes + ' no valida (falta algún campo)';
  }
  await new Promise(r => setTimeout(r, 600));
  window.scrollTo(0, 0);

  const act = document.querySelector('.form-block.active');
  const tit = act ? (act.querySelector('.form-block-title') || {}).textContent : '?';
  return 'ok · bloque ' + bloque + ' · ' + tit;
})();
