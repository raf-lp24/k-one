// Textos de los reels «la app grabada en movimiento» (31 oct 2026). Rafa: K-ONE no es
// «un entrenador con IA» (sonaría a persona) sino «la app que te entrena con IA». Género neutro y
// nada que la app no haga de verdad: cada rótulo se comprobó contra la grabación.
//   gancho: líneas del principio (las palabras entre *asteriscos* van en naranja)
//   rotulos(T): [desde, hasta, ojo, título, 'verde'?] en segundos de la GRABACIÓN (T = tiempos.json)
//   notas(T):   [desde, hasta, texto] píldora pequeña abajo (p. ej. «tiempo acelerado»)
window.TEXTOS = {
  reventado: {
    gancho: ['Le digo', 'a mi *app*', 'que esta semana', '*no puedo más*'],
    rotulos: T => [
      [T.hoy + 0.25, T.checkin, 'Lunes · mi entreno', 'Mi entreno<br>de hoy'],
      [T.checkin, T.respuesta, 'El check-in de cada semana', 'Energía:<br>*2* de 5'],
      [T.respuesta, T.despues, 'Me contesta', 'Bajamos<br>el *volumen*'],
      [T.despues, T.despues + 2.4, 'Al momento', 'Una serie menos<br>en cada *ejercicio*', 'verde'],
      [T.despues + 2.4, T.total, 'Para que recuperes', 'No para que<br>lo *dejes*', 'verde']
    ]
  },
  nocomo: {
    gancho: ['Le digo', 'a mi *app*', 'que no como', '*pescado*', 'ni *brócoli*'],
    rotulos: T => [
      [T.menu + 0.25, T.cambio, 'Mi menú del martes', 'Pescado en el<br>desayuno y la *cena*'],
      [T.cambio, T.escribe, 'Y yo no como pescado', 'Se lo<br>*digo*'],
      [T.escribe, T.despues, 'Lo escribo tal cual', '«Pescado,<br>*brócoli*»'],
      [T.despues, T.despues + 3.4, 'Al momento', 'Pavo en vez<br>de *salmón*', 'verde'],
      [T.despues + 3.4, T.total, 'Y sin descuadrar nada', 'Mismo objetivo<br>de *calorías*', 'verde']
    ]
  },
  recetas: {
    gancho: ['Mi *app*', 'tiene más de', '*1.100*', 'recetas'],
    rotulos: T => [
      [T.hoy + 0.25, T.opciones, 'Mi menú de hoy', 'Ya viene<br>*hecho*'],
      [T.opciones, T.elige, 'En cada comida', '5 opciones<br>a tu *medida*'],
      [T.elige, T.recetario, '¿No te apetece?', 'Eliges<br>*otra*'],
      [T.recetario, T.receta, '¿Buscas algo?', 'Todo el<br>*recetario*'],
      [T.receta, T.total, 'Paso a paso', 'Con tus<br>*cantidades*', 'verde']
    ]
  },
  carrera: {
    gancho: ['Mi *app*', 'me dice', 'cuándo *correr*', 'y cuándo *andar*'],
    rotulos: T => [
      [T.hoy + 0.25, T.calienta, 'Empiezo a correr', 'Mi entreno<br>de *hoy*'],
      [T.calienta, T.corre, 'Primero', 'Calienta<br>5 *minutos*'],
      [T.corre, T.camina, 'Y me avisa', '¡A *correr*!'],
      [T.camina, T.calma, 'Luego', 'A caminar<br>2 *minutos*', 'verde'],
      [T.calma, T.resumen, '8 rondas después', 'Vuelta<br>a la *calma*'],
      [T.resumen, T.total, 'Queda guardado', 'Sesión<br>*hecha*', 'verde']
    ],
    notas: T => [[T.calienta + 0.3, T.resumen, 'Tiempo acelerado']]
  }
};
