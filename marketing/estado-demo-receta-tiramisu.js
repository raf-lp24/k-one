// Para cdp-shot.mjs: cliente de demo (datos inventados) con el recetario abierto
// en «Tiramisú proteico en vaso» (carrusel de la receta, 27 oct 2026).
(async () => {
  const src = await (await fetch('/marketing/estado-demo-nutricion.js')).text();
  await eval(src);
  goTo('dashboard');
  document.querySelectorAll('[class*="pwa"], [id*="pwa"], [id*="Pwa"]').forEach(e => e.remove());
  abrirRecetario();
  await new Promise(r => setTimeout(r, 500));
  cambiarModoRecetario('todas');
  await new Promise(r => setTimeout(r, 400));
  const i = document.getElementById('recetarioBuscador');
  i.value = 'tiramis'; filtrarRecetario('tiramis');
  await new Promise(r => setTimeout(r, 400));
  document.querySelectorAll('#modalRecetario [id^=recSec]').forEach(s => { if (s.offsetParent) s.classList.add('open'); });
  await new Promise(r => setTimeout(r, 400));
  const t = [...document.querySelectorAll('#modalRecetario .receta-nombre')].find(e => /Tiramisú proteico/.test(e.textContent));
  if (t) { t.click(); await new Promise(r => setTimeout(r, 300)); t.closest('[class*="receta"]').parentElement.scrollIntoView({ block: 'center' }); }
  await new Promise(r => setTimeout(r, 500));
})();
