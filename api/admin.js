// TODO EL PANEL DE ADMINISTRACIÓN (Jarvis) EN UNA SOLA FUNCIÓN (4 oct 2026).
//
// El plan Hobby de Vercel admite como máximo 12 funciones y estábamos en 12:
// cualquier endpoint nuevo rompía todos los despliegues. Las cinco funciones de
// admin pasan a ser módulos con guion bajo (Vercel no los despliega como
// funciones) y esta las reparte según ?fn=. Cada módulo sigue comprobando por
// su cuenta que quien llama es admin, igual que antes.
//
// Las URL de siempre (/api/admin-clientes, /api/is-admin...) siguen funcionando
// por los rewrites de vercel.json, para las versiones de la web que el móvil
// tenga aún en caché.
const RUTAS = {
  'clientes':       () => require('./_admin-clientes'),
  'mensaje':        () => require('./_admin-mensaje'),
  'set-premium':    () => require('./_admin-set-premium'),
  'crear-cliente':  () => require('./_admin-crear-cliente'),
  'is-admin':       () => require('./_is-admin'),
};

module.exports = async (req, res) => {
  const fn = String((req.query && req.query.fn) || '');
  const cargar = Object.prototype.hasOwnProperty.call(RUTAS, fn) ? RUTAS[fn] : null;
  if (!cargar) return res.status(404).json({ error: 'No existe' });
  return cargar()(req, res);
};
