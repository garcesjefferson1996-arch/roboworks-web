# Cambios de seguridad (oct 2026)

- Sesiones revocables: `token_version` en `users`; el JWT lleva `tv`. Cambiar contraseña (propia o por admin) cierra todas las sesiones. Usuarios desactivados/borrados pierden acceso de inmediato (cache de 10 s). El rol sale de la BD, no del token.
- Migración automática al arrancar (`src/config/migrations.js`) agrega `token_version` y `totp_last_step`. Antes de migrar, el middleware degrada a validar solo el JWT.
- 2FA: un código TOTP ya usado no se puede reutilizar (anti-replay).
- Contraseñas: 8–72 caracteres, letra + número, sin claves comunes.
- JWT fijado a HS256; secretos/códigos con `crypto` (no Math.random); chequeo de Origin en métodos que modifican datos; `/api/health` sin datos internos.
- Dependencias: `npm audit fix` aplicado. Pendientes (cambios mayores, probar con subidas reales): cloudinary 2.x, node-cron 4.x.
- Pendiente del dueño: rotar credenciales de Railway/Render/Cloudinary/JWT_SECRET, verificar backups de la BD, no guardar `.env` real en carpetas sincronizadas (OneDrive).
