// Motor común de los reels de K-ONE (1080x1920).
//
// Lo usan reel-hoy.html y reel-alta.html: cada uno solo declara su lista de
// bloques (window.REEL_BEATS) y de dónde salen sus capturas
// (window.REEL_CARPETA). Estaba duplicado en los dos archivos y son ~200 líneas
// de canvas: cualquier arreglo tendría que hacerse dos veces y una de las dos
// se quedaría atrás.
//
// La animación NO usa CSS ni requestAnimationFrame: todo se dibuja en función
// de render(t), para que la captura fotograma a fotograma sea determinista y
// repetible (ver cdp-frames.mjs).
//
// Cada bloque de REEL_BEATS:
//   { img, t0, t1, sup, tit, pie }   · img null = pantalla de solo texto
//   tit acepta \n para partir en dos líneas
//   Un bloque con tit 'K-ONE' se pinta como cierre de marca.

(function () {
  const W = 1080, H = 1920;
  const ctx = document.getElementById('c').getContext('2d');
  const NEGRO = '#000000', HUESO = '#F0EDE8', BRASA = '#D1420E', GRIS = '#8A8A8A';

  const BEATS = window.REEL_BEATS || [];
  const CARPETA = window.REEL_CARPETA || '/marketing/_tmp-shots/';

  const IMGS = {};
  [...new Set(BEATS.map(b => b.img).filter(Boolean))].forEach(n => {
    const im = new Image();
    im.src = CARPETA + n + '.png';
    IMGS[n] = im;
  });

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const salida = p => 1 - Math.pow(1 - clamp(p, 0, 1), 3);

  // Ancho máximo de línea: se mide y se reduce hasta que quepa. Sin esto, un
  // rótulo largo se sale por los lados.
  const MARGEN = 90, UTIL = W - MARGEN * 2;
  const cache = new Map();
  function tamanoQueCabe(txt, deseado, esp, fuente) {
    const k = txt + '|' + deseado + '|' + esp + '|' + fuente;
    if (cache.has(k)) return cache.get(k);
    let s = deseado;
    for (let i = 0; i < 40; i++) {
      ctx.font = s + 'px ' + fuente;
      ctx.letterSpacing = esp + 'px';
      if (ctx.measureText(txt).width + esp <= UTIL) break;
      s -= 4;
    }
    cache.set(k, s);
    return s;
  }
  function texto(txt, deseado, esp, y, color, alpha, dx, fuente, peso) {
    if (alpha <= 0.003) return;
    const s = tamanoQueCabe(txt, deseado, esp, fuente);
    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.font = (peso ? peso + ' ' : '') + s + 'px ' + fuente;
    ctx.letterSpacing = esp + 'px';
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.fillText(txt, W / 2 + esp / 2 + dx, y);
    ctx.restore();
  }

  // Móvil con la captura dentro, recortada al alto del marco.
  function movil(im, cx, cy, alto, alpha, avance) {
    if (!im || !im.complete || !im.naturalWidth) return;
    const rel = 1170 / 2532;
    const h = alto, w = h * rel;
    const x = cx - w / 2, y = cy - h / 2, r = w * 0.075;

    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.shadowColor = 'rgba(209,66,14,0.5)';
    ctx.shadowBlur = 90;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = '#0A0A0A'; ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.clip();
    // Recorrido vertical lento por la captura: es mucho más alta que el hueco,
    // así que se desplaza en vez de escalarse.
    const escala = w / im.naturalWidth;
    const altoImg = im.naturalHeight * escala;
    const recorrido = Math.max(0, altoImg - h);
    ctx.drawImage(im, x, y - recorrido * clamp(avance, 0, 1), w, altoImg);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1) * 0.85;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    ctx.strokeStyle = 'rgba(240,237,232,0.16)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
  }

  function fondo(t) {
    ctx.fillStyle = NEGRO;
    ctx.fillRect(0, 0, W, H);
    const latido = 0.55 + 0.45 * Math.sin(t * 1.5);
    const g = ctx.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, 900);
    g.addColorStop(0, 'rgba(209,66,14,' + (0.16 * latido).toFixed(3) + ')');
    g.addColorStop(0.5, 'rgba(209,66,14,' + (0.05 * latido).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function render(t) {
    fondo(t);
    const b = BEATS.find(x => t >= x.t0 && t < x.t1) || BEATS[BEATS.length - 1];
    if (!b) return;
    const dur = b.t1 - b.t0, p = (t - b.t0) / dur;
    const entra = salida((t - b.t0) / 0.5);
    const sale = 1 - salida((t - (b.t1 - 0.35)) / 0.35);
    const a = entra * sale;
    const dx = (1 - entra) * 50;

    if (b.img) {
      texto(b.sup, 40, 7, 268, BRASA, a, dx, "'Inter',sans-serif", '600');
      // El rótulo NO puede invadir el móvil. Con dos líneas a 132px la segunda
      // caía justo sobre el borde superior del marco (bug real: "MARCAR
      // COMPLETADO" y "TU ALIMENTACIÓN" salían pisando la captura). Con dos
      // líneas se baja el cuerpo y se sube el bloque, dejando aire por encima
      // del móvil. El ajuste automático de ancho ya estaba; faltaba el de ALTO.
      const lineas = b.tit.split('\n');
      const dos = lineas.length > 1;
      const cuerpo = dos ? 118 : 132;
      const salto = dos ? 112 : 124;
      const primera = dos ? 366 : 400;
      lineas.forEach((linea, i) => {
        texto(linea, cuerpo, 4, primera + i * salto, HUESO, a, dx, "'Bebas Neue',sans-serif");
      });
      // Alto y centro medidos: con menos alto quedaba un hueco muerto entre el
      // rótulo y el móvil, y la captura se leía peor de lo necesario.
      movil(IMGS[b.img], W / 2, 1105, 1170, a, p * 0.85);
      texto(b.pie, 34, 0, 1790, GRIS, a, dx, "'Inter',sans-serif", '400');
    } else if (b.tit === 'K-ONE') {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = '210px "Bebas Neue", sans-serif';
      ctx.letterSpacing = '14px';
      const k = 'K-', one = 'ONE';
      ctx.textAlign = 'left';
      const wk = ctx.measureText(k).width, wo = ctx.measureText(one).width;
      const x0 = W / 2 - (wk + wo) / 2;
      ctx.fillStyle = HUESO; ctx.fillText(k, x0, H / 2 + 20);
      ctx.fillStyle = BRASA; ctx.fillText(one, x0 + wk, H / 2 + 20);
      ctx.restore();
      texto(b.pie, 40, 6, H / 2 + 130, GRIS, a, 0, "'Inter',sans-serif", '400');
    } else {
      texto(b.sup, 40, 8, 700, BRASA, a, dx, "'Inter',sans-serif", '600');
      b.tit.split('\n').forEach((linea, i) => {
        texto(linea, 190, 5, 900 + i * 180, HUESO, a, dx, "'Bebas Neue',sans-serif");
      });
      const pf = salida((t - b.t0 - 0.7) / 0.6) * a;
      if (pf > 0) {
        const anc = 340 * pf;
        const lin = ctx.createLinearGradient(W / 2 - anc, 0, W / 2 + anc, 0);
        lin.addColorStop(0, 'rgba(209,66,14,0)');
        lin.addColorStop(0.5, 'rgba(255,138,61,' + pf.toFixed(3) + ')');
        lin.addColorStop(1, 'rgba(209,66,14,0)');
        ctx.fillStyle = lin;
        ctx.fillRect(W / 2 - anc, 1230, anc * 2, 4);
      }
      texto(b.pie, 36, 0, 1330, GRIS, a, dx, "'Inter',sans-serif", '400');
    }
  }
  window.render = render;

  // Cada espera con su propio tope: img.decode() puede quedarse colgado sin
  // resolver ni rechazar, y dejaba la promesa entera pendiente para siempre.
  const conTope = (pr, ms) => Promise.race([pr, new Promise(r => setTimeout(r, ms))]);
  window.listo = Promise.all([
    conTope(document.fonts.load('132px "Bebas Neue"'), 8000),
    conTope(document.fonts.load('600 40px "Inter"'), 8000),
    ...Object.values(IMGS).map(im => conTope(
      new Promise(res => { if (im.complete && im.naturalWidth) return res(); im.onload = res; im.onerror = res; }),
      8000
    ))
  ]).then(() => { cache.clear(); render(0); return true; });
  render(0);
})();
