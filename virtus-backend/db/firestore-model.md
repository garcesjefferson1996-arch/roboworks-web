# [DESCARTADO] Migración a Firestore evaluada y no adoptada

Se evaluó migrar la base de datos de Virtus a Firebase (Firestore + Auth +
Storage) para resolver la preocupación de escalar a 2000+ estudiantes.

Decisión final: **seguir con MySQL administrado**. Razones (detalladas en la
conversación con Jeff): el dominio es relacional (instituciones, clases,
inscripciones, materiales) y se necesitan reportes reales por institución;
Firestore no hace JOINs ni agregaciones entre colecciones, obliga a
denormalizar a mano y a resolver "joins" con varias consultas encadenadas, y
tiene un modelo de costos menos predecible. La preocupación original de
escalabilidad no era un límite real de MySQL sino de configuración (pool de
conexiones muy bajo, sin índices) - ya corregido en `db/schema.sql` y
`src/config/database.js`.

El modelo de datos vigente es el de `db/schema.sql`. Este archivo se deja solo
como registro de la evaluación, no como documentación activa.
