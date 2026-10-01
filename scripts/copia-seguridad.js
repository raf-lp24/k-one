// Descarga a TU ordenador las copias de seguridad que el cron diario guarda en Supabase Storage
// (bucket "backups"), para tener una copia FUERA de Supabase.
//
//   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... node scripts/copia-seguridad.js [dias]
//
// Las pone en la carpeta copias/ (no se sube a git) y no vuelve a bajar las que ya tiene.
// `dias` = cuántos días hacia atrás (por defecto 30). Hazlo una vez por semana.
// Cada copia lleva: clientes (con su cuestionario), suscripciones, mensajes, hitos, referidos,
// opiniones y leads. Los PLANES no van dentro: se regeneran con "Regenerar plan" en Jarvis
// o solos con el aviso diario a partir del cuestionario.
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (en Vercel → Settings → Environment Variables).'); process.exit(1); }
const dias = parseInt(process.argv[2], 10) || 30;
const destino = path.join(__dirname, '..', 'copias');
fs.mkdirSync(destino, { recursive: true });

(async () => {
  const supa = createClient(url, key);
  const { data, error } = await supa.storage.from('backups').list('', { limit: 1000, sortBy: { column: 'name', order: 'desc' } });
  if (error) { console.error('No se pudo listar el bucket:', error.message); process.exit(1); }
  const limite = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
  const nombres = (data || []).map(a => a.name).filter(n => /^backup-\d{4}-\d{2}-\d{2}\.json$/.test(n) && n.slice(7, 17) >= limite);
  if (!nombres.length) { console.log('No hay copias de los últimos ' + dias + ' días en el bucket. ¿Está corriendo el cron de las 9:00?'); process.exit(1); }
  let nuevas = 0;
  for (const n of nombres) {
    const f = path.join(destino, n);
    if (fs.existsSync(f)) continue;
    const r = await supa.storage.from('backups').download(n);
    if (r.error) { console.error('✘ ' + n + ': ' + r.error.message); continue; }
    fs.writeFileSync(f, Buffer.from(await r.data.arrayBuffer()));
    nuevas++; console.log('✔ ' + n + ' (' + Math.round(fs.statSync(f).size / 1024) + ' KB)');
  }
  const ultima = nombres[0];
  const j = JSON.parse(fs.readFileSync(path.join(destino, ultima), 'utf8'));
  console.log(`\n${nuevas} copias nuevas en ${destino}\nÚltima: ${ultima} · ${j.totalClientes} clientes · ${j.totalSuscripciones} suscripciones · tablas no guardadas: ${(j.tablasNoGuardadas || []).length || 'ninguna'}`);
})().catch(e => { console.error(e.message); process.exit(1); });
