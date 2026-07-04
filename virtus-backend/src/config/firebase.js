// [DESCARTADO] Se evaluo migrar Virtus a Firebase (Firestore + Auth + Storage)
// y se decidio NO hacerlo: para una plataforma institucional con datos
// relacionales (instituciones, clases, inscripciones, materiales) y necesidad
// de reportes reales, MySQL administrado es la opcion mas profesional y
// predecible. Nos quedamos con MySQL (ver src/config/database.js).
// Se deja vacio intencionalmente para que quede claro que no debe usarse.
module.exports = {};
