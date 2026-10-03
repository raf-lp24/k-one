// Genera las páginas públicas por tema (running, gimnasio, híbrido, solo nutrición)
// y su hoja de estilos. Cada una es HTML estático con su propio título, descripción,
// canonical y datos estructurados: la SPA de la portada es una sola URL y Google
// no puede posicionar "plan de running" o "dieta con alergias" con una sola página.
//
//   node scripts/generar-paginas.js
//
// Escribe en la raíz: running.html, gimnasio.html, hibrido.html, solo-nutricion.html
// y paginas.css. Vercel las sirve en /running, /gimnasio, /hibrido y /solo-nutricion
// (ver "rewrites" de vercel.json). Lo que dicen las páginas sale de lo que la app hace
// de verdad; si cambia una regla del motor o un precio, se cambia aquí y se regenera.
const fs = require('fs');
const path = require('path');
const raiz = path.join(__dirname, '..');
const SITIO = 'https://k-one.fit';

const PRECIOS = 'Primer mes gratis y sin tarjeta: no te pedimos ningún dato de pago para empezar. Después, plan completo 7,99 €/mes (o 14,99 € cada 3 meses) y solo nutrición 4,99 €/mes. Sin permanencia: cancelas desde tu perfil cuando quieras.';

const otras = [
  ['/gimnasio', 'Gimnasio', 'Hipertrofia, fuerza y definición con progresión de cargas.'],
  ['/running', 'Running', 'De 5 km a maratón, con ritmos y fases.'],
  ['/hibrido', 'Híbrido', 'Fuerza y resistencia repartidas sin que se pisen.'],
  ['/solo-nutricion', 'Solo nutrición', 'Alimentación personalizada desde 4,99 €/mes.'],
];

const PAGINAS = [
  {
    archivo: 'running.html', ruta: '/running', imagen: '/img/landing/running.webp', etiqueta: 'Running',
    title: 'Plan de running personalizado, de 5 km a maratón — K-ONE',
    desc: 'Plan de running con ritmos, distancias y fases, adaptado a tu nivel y lesiones, y con nutrición incluida. Primer mes gratis, sin tarjeta.',
    h1: 'Un plan de running que se adapta a ti, semana a semana',
    lead: 'De tu primer 5 km a un maratón: sesiones con ritmos, distancias y zonas de esfuerzo, y una alimentación que acompaña cada entreno.',
    incluye: [
      ['Fases con criterio', 'Una sesión de calidad por semana, una tirada larga desde los dos días de entreno y el resto de la semana en rodajes suaves. No es "corre más": cada semana tiene un porqué.'],
      ['Si empiezas de cero', 'Alternas correr y caminar y subes por escalones, contando el tiempo real de cada sesión, no una distancia que todavía no toca.'],
      ['Ritmos exactos en min/km', 'Dinos un tiempo reciente (5 km, 10 km, media maratón o maratón) y calculamos el ritmo de rodaje, umbral y series. Si no lo tienes, usamos referencias por sensación.'],
      ['Adaptado a tus lesiones', 'Si tienes rodilla, espalda u hombro tocados, el plan evita lo que los agrava y lo sustituye.'],
      ['Nutrición incluida', 'Cinco comidas al día con cinco opciones cada una, macros calculados, lista de la compra y comida de antes y después de entrenar según la hora a la que corres.'],
      ['Check-in cada semana', 'Cuentas cómo te fue —energía, descanso, adherencia— y el plan de la semana siguiente se ajusta.'],
    ],
    faq: [
      ['¿Sirve si soy principiante?', 'Sí. Si empiezas de cero, el plan arranca alternando correr y caminar y va subiendo por escalones, con el tiempo real de cada sesión.'],
      ['¿Puedo prepararme una media maratón o un maratón?', 'Sí. Eliges tu objetivo y la fecha de tu carrera en el cuestionario y la cuenta atrás aparece en tu panel.'],
      ['¿Y si también quiero hacer fuerza?', 'Para eso está el plan Híbrido, que reparte fuerza y carrera en la misma semana sin que se pisen.'],
      ['¿Cuánto cuesta?', PRECIOS],
    ],
  },
  {
    archivo: 'gimnasio.html', ruta: '/gimnasio', imagen: '/img/landing/gimnasio.webp', etiqueta: 'Gimnasio',
    title: 'Plan de gimnasio personalizado: hipertrofia y fuerza — K-ONE',
    desc: 'Rutina de gimnasio con progresión de cargas cada semana, fichas de cada ejercicio y nutrición incluida. En gimnasio o en casa. Primer mes gratis, sin tarjeta.',
    h1: 'Tu rutina de gimnasio, con la carga que te toca cada semana',
    lead: 'Hipertrofia, fuerza o definición: entrenamiento generado con tus datos reales, con progresión de cargas y una alimentación calculada para tu objetivo.',
    incluye: [
      ['Progresión semana a semana', 'El plan sube el peso de tus ejercicios cuando tu propio feedback dice que puedes, y baja el volumen si vienes fatigado. Anotas el peso de cada ejercicio y ves tu marca anterior.'],
      ['A tu tiempo y a tu nivel', 'De 2 a 5 o más días por semana y sesiones desde 15-20 minutos hasta más de 90, para principiante, intermedio o avanzado.'],
      ['En el gimnasio o en casa', 'Si entrenas en casa con material, el plan usa pesos libres reales, no la misma rutina de gimnasio recortada.'],
      ['Cada ejercicio, explicado', '"Cómo se hace": fotos de la posición inicial y final, músculos trabajados, pasos, consejos y vídeo de técnica, sin salir de la app.'],
      ['Adaptado a tus lesiones', 'Los ejercicios que afectan a tu rodilla, espalda u hombro se sustituyen o se quitan.'],
      ['Nutrición incluida', 'Cinco comidas con cinco opciones, macros por plato, lista de la compra y comida de antes y después de entrenar según tu horario.'],
    ],
    faq: [
      ['¿Qué objetivos puedo elegir?', 'Perder grasa, ganar músculo, ganar fuerza, mejorar resistencia, prepararte una competición o sentirte mejor en general. Cada uno cambia el entrenamiento y las calorías.'],
      ['¿Necesito ir al gimnasio?', 'No. Puedes elegir entrenar en casa con material y el plan se genera distinto.'],
      ['¿Cada cuánto cambia el plan?', 'Cada semana, después de tu check-in del domingo. No prometemos números: el plan se ajusta a tu progreso real.'],
      ['¿Cuánto cuesta?', PRECIOS],
    ],
  },
  {
    archivo: 'hibrido.html', ruta: '/hibrido', imagen: '/img/landing/hero.webp', etiqueta: 'Híbrido',
    title: 'Plan híbrido de fuerza y resistencia para correr — K-ONE',
    desc: 'Plan semanal que reparte fuerza y carrera sin que se pisen. Para maratón, media maratón o Hyrox sin perder lo ganado. Primer mes gratis, sin tarjeta.',
    h1: 'Fuerza y resistencia en la misma semana, sin que se pisen',
    lead: 'Si preparas un maratón o un Hyrox y no quieres perder lo ganado en el gimnasio, el plan híbrido reparte la carga para que cada sesión llegue descansada.',
    incluye: [
      ['Una semana con orden', 'Las sesiones de fuerza y de resistencia se reparten dentro de la misma semana para que no se pisen entre ellas.'],
      ['Sesiones por tiempo', 'Cada sesión se planifica por el tiempo que tienes, y con niveles distintos incluso entrenando solo dos o tres días.'],
      ['Adaptado a tus lesiones', 'Las lesiones de rodilla, espalda u hombro se tienen en cuenta en las plantillas de cada sesión.'],
      ['Carbohidratos por día', 'La nutrición sube los carbohidratos en los días de más carga y los baja en los de descanso, con la media semanal calculada para tu objetivo.'],
      ['Comida de antes y después', 'En los días de entreno, la toma de antes y la de recuperación se colocan según la hora a la que entrenas.'],
      ['Check-in semanal', 'Si vienes fatigado, baja el volumen; si vas sobrado, aprieta. El plan siguiente parte de lo que cuentas.'],
    ],
    faq: [
      ['¿Es lo mismo que un plan de Running con algo de fuerza?', 'No. En Híbrido la fuerza y la resistencia se planifican a la vez; en Running el plan es de carrera.'],
      ['¿Y si hago CrossFit o Hyrox en mi box?', 'Para eso existe Solo nutrición, que ajusta la alimentación a la carga que ya llevas en tu box.'],
      ['¿Cuánto cuesta?', PRECIOS],
    ],
  },
  {
    archivo: 'solo-nutricion.html', ruta: '/solo-nutricion', imagen: '/img/landing/nutricion-banner.webp', etiqueta: 'Solo nutrición',
    title: 'Plan de alimentación personalizado desde 4,99 €/mes — K-ONE',
    desc: 'Dieta personalizada con 5 opciones por comida, macros, lista de la compra y adaptada a alergias. Para quien ya entrena por su cuenta. Primer mes gratis, sin tarjeta.',
    h1: 'Tu alimentación calculada, sin cambiar cómo entrenas',
    lead: 'Si ya entrenas con tu entrenador, tu box o tu club, K-ONE te da solo la nutrición: un plan de comidas 100 % personalizado, adaptado a tus alergias y a tu objetivo.',
    incluye: [
      ['Cinco opciones por comida', 'Hasta cinco tomas al día con cinco platos entre los que elegir en cada una, con macros y calorías por plato y por día.'],
      ['Adaptado a lo que no puedes comer', 'Gluten, lactosa, frutos secos u otras alergias y los alimentos que prefieres evitar no aparecen en tu plan. Tampoco en los ingredientes ni en los pasos de cada receta.'],
      ['Para deportistas de box y club', 'Hyrox, CrossFit, gimnasio, running o híbrido: si nos dices tus días y la hora a la que entrenas, esos días llevan comida de antes y de recuperación.'],
      ['Calorías según tu vida real', 'Se calculan con tu edad, peso, altura, tu jornada de trabajo y tu objetivo. Si no entrenas, no te subimos las calorías como a un deportista.'],
      ['Lista de la compra automática', 'Eliges tus comidas de la semana y K-ONE suma todos los ingredientes y los ordena por categorías.'],
      ['Se actualiza contigo', 'Si cambias tu dieta, tus alergias o tu peso, el plan se recalcula y se revisa automáticamente para que no cuele nada que no debe.'],
    ],
    faq: [
      ['¿Incluye entrenamiento?', 'No. Este plan es solo alimentación, pensado para quien ya entrena por su cuenta.'],
      ['¿Sustituye a un dietista-nutricionista?', 'No. K-ONE genera el plan con un motor de reglas a partir de tus datos y no sustituye a un profesional sanitario; ante cualquier duda de salud, consúltalo.'],
      ['¿Cuántas comidas puedo hacer al día?', 'Cinco es lo recomendado. Si tu horario no da para tanto, puedes elegir cuatro, tres o dos.'],
      ['¿Cuánto cuesta?', 'Solo nutrición cuesta 4,99 €/mes y el primer mes es gratis. Cancelas desde tu perfil cuando quieras.'],
    ],
  },
];

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function pagina(p) {
  const url = SITIO + p.ruta;
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', '@id': url + '#pagina', url, name: p.title, description: p.desc, inLanguage: 'es-ES', isPartOf: { '@id': SITIO + '/#website' } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'K-ONE', item: SITIO + '/' },
        { '@type': 'ListItem', position: 2, name: p.etiqueta, item: url } ] },
      { '@type': 'FAQPage', mainEntity: p.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    ],
  };
  const enlaces = otras.filter(o => o[0] !== p.ruta)
    .map(([href, t, d]) => `<a class="otra" href="${href}"><strong>${esc(t)}</strong><span>${esc(d)}</span></a>`).join('\n        ');
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.desc)}">
<link rel="canonical" href="${url}">
<meta name="theme-color" content="#0a0a0a">
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(p.desc)}">
<meta property="og:locale" content="es_ES">
<meta property="og:image" content="${SITIO}/og-image-v2.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="/paginas.css">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body>
<a class="salto" href="#contenido">Saltar al contenido</a>
<header class="cab">
  <a class="logo" href="/" aria-label="K-ONE, ir a la portada">K-<b>ONE</b></a>
  <a class="btn" href="/?go=registro">Empieza gratis</a>
</header>
<main id="contenido">
  <section class="hero" style="--img:url('${p.imagen}')">
    <div class="hero-in">
      <p class="eyebrow">${esc(p.etiqueta)}</p>
      <h1>${esc(p.h1)}</h1>
      <p class="lead">${esc(p.lead)}</p>
      <div class="acciones">
        <a class="btn grande" href="/?go=registro">Empieza gratis, sin tarjeta</a>
        <a class="enlace" href="/#pricing">Ver precios</a>
      </div>
    </div>
  </section>

  <section class="bloque">
    <h2>Qué incluye</h2>
    <ul class="rejilla">
${p.incluye.map(([t, d]) => `      <li><h3>${esc(t)}</h3><p>${esc(d)}</p></li>`).join('\n')}
    </ul>
  </section>

  <section class="bloque">
    <h2>Cómo funciona</h2>
    <ol class="pasos">
      <li><strong>Cuestionario.</strong> Cuentas quién eres: cuerpo, salud, alimentación, objetivo y horarios. Cuantos más detalles, mejor el plan.</li>
      <li><strong>Tu plan, al momento.</strong> Lo genera un motor de reglas con criterio fijo y trazable, no una IA que improvisa.</li>
      <li><strong>Check-in semanal.</strong> Cada semana cuentas cómo te fue y el plan siguiente se ajusta.</li>
    </ol>
    <p class="nota">K-ONE no sustituye a un médico ni a un dietista-nutricionista. Si tienes una enfermedad, una lesión o tomas medicación, consúltalo con un profesional antes de empezar.</p>
  </section>

  <section class="bloque">
    <h2>Preguntas frecuentes</h2>
    <div class="faq">
${p.faq.map(([q, a]) => `      <details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n')}
    </div>
  </section>

  <section class="bloque">
    <h2>Otros planes</h2>
    <div class="otras">
        ${enlaces}
    </div>
  </section>

  <section class="cierre">
    <h2>Empieza hoy: primer mes gratis, sin tarjeta</h2>
    <p>${esc(PRECIOS)}</p>
    <a class="btn grande" href="/?go=registro">Crear mi plan</a>
  </section>
</main>
<footer class="pie">
  <a class="logo" href="/">K-<b>ONE</b></a>
  <nav aria-label="Legal">
    <a href="/#aviso-legal">Aviso legal</a>
    <a href="/#privacidad">Privacidad</a>
    <a href="/#terminos">Términos</a>
    <a href="/#cookies">Cookies</a>
  </nav>
  <p>© 2026 K-One · Esta plataforma es orientación personalizada, no consejo médico.</p>
</footer>
</body>
</html>
`;
}

const CSS = `/* Estilos de las páginas por tema de K-ONE (generado por scripts/generar-paginas.js).
   Mismos colores y tipografías que la app. */
:root {
  --negro: #0a0a0a; --carbon: #141414; --grafito: #1e1e1e; --humo: #3a3a3a;
  --brasa: #d1420e; --brasa-vivo: #e8490f; --blanco: #f0ede8; --metal: #a09a92;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin: 0; background: var(--negro); color: var(--blanco); font: 400 16px/1.65 Inter, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
a { color: inherit; }
:focus-visible { outline: 2px solid var(--brasa-vivo); outline-offset: 3px; }
.salto { position: absolute; left: -9999px; top: 8px; background: var(--blanco); color: var(--negro); padding: 8px 14px; z-index: 10; }
.salto:focus { left: 8px; }
.cab { display: flex; align-items: center; justify-content: space-between; padding: 16px clamp(16px, 4vw, 48px); border-bottom: 1px solid var(--grafito); position: sticky; top: 0; background: rgba(10,10,10,.92); backdrop-filter: blur(8px); z-index: 5; }
.logo { font: 400 30px/1 'Bebas Neue', Impact, sans-serif; letter-spacing: 3px; text-decoration: none; }
.logo b { color: var(--brasa-vivo); font-weight: 400; }
.btn { display: inline-block; background: var(--brasa); color: #fff; text-decoration: none; font: 600 13px/1 Inter, sans-serif; letter-spacing: 1px; text-transform: uppercase; padding: 13px 20px; border-radius: 8px; }
.btn:hover { background: var(--brasa-vivo); }
.btn.grande { padding: 16px 26px; font-size: 14px; }
.hero { position: relative; min-height: min(78vh, 640px); display: flex; align-items: flex-end; background: linear-gradient(180deg, rgba(10,10,10,.35), var(--negro) 96%), var(--img) center / cover no-repeat, var(--carbon); }
.hero-in { width: 100%; max-width: 900px; padding: clamp(96px, 16vh, 160px) clamp(16px, 4vw, 48px) clamp(40px, 7vh, 72px); }
.eyebrow { margin: 0 0 12px; font: 500 12px/1 'DM Mono', monospace; letter-spacing: 2.5px; text-transform: uppercase; color: var(--brasa-vivo); }
h1, h2 { font-family: 'Bebas Neue', Impact, sans-serif; font-weight: 400; letter-spacing: 1px; line-height: 1; margin: 0; text-wrap: balance; }
h1 { font-size: clamp(44px, 8vw, 84px); }
h2 { font-size: clamp(30px, 4.5vw, 46px); margin-bottom: 26px; }
h3 { font: 600 16px/1.3 Inter, sans-serif; margin: 0 0 8px; }
.lead { max-width: 60ch; margin: 22px 0 0; font-size: clamp(17px, 2.2vw, 20px); color: #d8d3cc; }
.acciones { display: flex; flex-wrap: wrap; align-items: center; gap: 22px; margin-top: 30px; }
.enlace { color: var(--metal); font: 500 13px/1 'DM Mono', monospace; letter-spacing: 1px; text-transform: uppercase; }
.enlace:hover { color: var(--blanco); }
.bloque { max-width: 1040px; margin: 0 auto; padding: clamp(40px, 8vw, 84px) clamp(16px, 4vw, 48px) 0; }
.rejilla { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); gap: 16px; }
.rejilla li { background: var(--carbon); border: 1px solid var(--grafito); border-radius: 12px; padding: 22px; }
.rejilla p { margin: 0; color: #c9c4bd; font-size: 15px; }
.pasos { margin: 0; padding-left: 22px; display: grid; gap: 14px; max-width: 70ch; }
.pasos li::marker { color: var(--brasa-vivo); font-weight: 600; }
.nota { margin: 26px 0 0; padding: 16px 18px; border-left: 3px solid var(--brasa); background: var(--carbon); color: #c9c4bd; font-size: 14px; max-width: 70ch; }
.faq { display: grid; gap: 10px; max-width: 780px; }
.faq details { background: var(--carbon); border: 1px solid var(--grafito); border-radius: 10px; padding: 0 18px; }
.faq summary { cursor: pointer; padding: 16px 0; font-weight: 600; list-style: none; }
.faq summary::-webkit-details-marker { display: none; }
.faq summary::after { content: '+'; float: right; color: var(--brasa-vivo); font-size: 22px; line-height: 1; }
.faq details[open] summary::after { content: '−'; }
.faq details p { margin: 0 0 18px; color: #c9c4bd; }
.otras { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 14px; }
.otra { display: block; text-decoration: none; background: var(--carbon); border: 1px solid var(--grafito); border-radius: 12px; padding: 18px 20px; }
.otra:hover { border-color: var(--brasa); }
.otra strong { display: block; font: 400 26px/1 'Bebas Neue', Impact, sans-serif; letter-spacing: 1px; margin-bottom: 6px; }
.otra span { color: var(--metal); font-size: 14px; }
.cierre { text-align: center; max-width: 720px; margin: 0 auto; padding: clamp(56px, 10vw, 110px) clamp(16px, 4vw, 48px); }
.cierre p { color: #c9c4bd; margin: 0 0 26px; }
.pie { border-top: 1px solid var(--grafito); padding: 32px clamp(16px, 4vw, 48px) 40px; display: grid; gap: 14px; justify-items: start; color: var(--metal); font-size: 13px; }
.pie nav { display: flex; flex-wrap: wrap; gap: 6px 22px; }
.pie nav a { text-decoration: none; padding: 5px 0; }
.pie nav a:hover { color: var(--blanco); }
.pie p { margin: 0; }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
`;

for (const p of PAGINAS) fs.writeFileSync(path.join(raiz, p.archivo), pagina(p));
fs.writeFileSync(path.join(raiz, 'paginas.css'), CSS);
console.log('generadas: ' + PAGINAS.map(p => p.archivo).join(', ') + ' y paginas.css');
