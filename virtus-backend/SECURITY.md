# Virtus - Seguridad

Este documento resume la revisión de seguridad hecha antes de conectar el
frontend real, qué se encontró, qué se corrigió, y qué queda pendiente.

## 1. Hallazgos de la auditoría y corrección aplicada

Se revisó cada endpoint que recibe un id (`studentId`, `classId`, `teacherId`,
`materialId`, `categoryId`) para confirmar que un `academy_admin` de una
institución no pueda leer ni modificar datos de **otra** institución
adivinando o probando ids consecutivos (IDOR). Se encontraron y corrigieron
las siguientes fugas:

- `GET /api/classes/:classId` no verificaba nada - cualquier usuario
  autenticado podía leer cualquier clase de cualquier institución.
- `PUT /api/classes/:classId` y `GET /api/classes/:classId/students` dejaban
  pasar a cualquier admin sin comprobar la institución (solo se comprobó nunca
  la existencia de la clase para el rol admin).
- `GET /api/admin/students/:studentId` no filtraba por institución.
- Inscribir/desinscribir un estudiante de una clase (`POST`/`DELETE
  /api/admin/students/:studentId/classes/:classId`) no verificaba que la clase
  ni el estudiante fueran de la institución del admin.
- Crear un estudiante con clases asignadas (`POST /api/admin/students`) podía
  inscribirlo en una clase de otra institución si se enviaba ese id.
- Asignar un docente a una clase (`PUT
  /api/admin/classes/:classId/teacher`) no verificaba institución ni en la
  clase ni en el docente.
- Todos los endpoints de `materialRoutes.js` (leer/crear/editar/borrar
  materiales y categorías) no verificaban que la clase perteneciera a la
  institución del admin.
- El catálogo de programas/cursos (`POST /api/admin/programs`,
  `POST /api/admin/codeworks-courses`) permitía que cualquier `academy_admin`
  lo modificara, afectando a todas las demás instituciones - se restringió a
  `super_admin`.

Corrección aplicada en todos los casos: se agregó verificación de
`tenant_id` (`super_admin` puede cruzar instituciones a propósito;
`academy_admin` solo ve/modifica la suya). El middleware
`requireAdminOrOwningTeacher` (en `src/middleware/roles.js`) ahora hace esta
verificación en una sola consulta reusable, y se agregó el helper
`assertSameTenant` para los endpoints que reciben ids sueltos.

## 2. Controles de autenticación

- Contraseñas con bcrypt (nunca en texto plano).
- **Bloqueo de cuenta**: 5 intentos fallidos bloquean la cuenta 15 minutos
  (columnas `failed_login_attempts`, `locked_until`). Complementa al
  rate-limit por IP, que no protege si el ataque viene distribuido entre
  muchas IPs.
- **2FA (TOTP) obligatorio para `super_admin` y `academy_admin`**. Se activa
  desde la creación de la cuenta (`scripts/create-admin.js` obliga a escanear
  el código antes de terminar). Un admin no puede iniciar sesión sin el
  código de 6 dígitos de su app (Google Authenticator, Authy, etc.). Los
  docentes y estudiantes no requieren 2FA (es un balance costo/beneficio: son
  cuentas de menor privilegio y en el caso de estudiantes, muchas veces
  menores de edad sin un teléfono propio para una app de 2FA).
- Cookies de sesión `httpOnly`, `secure` en producción, `sameSite` correcto.
- **Rotación de `JWT_SECRET`** soportada sin desloguear a todos de golpe (ver
  comentario en `src/middleware/auth.js` y `JWT_SECRET_PREVIOUS` en
  `.env.example`).

## 3. Auditoría (quién hizo qué)

Tabla `audit_logs` (ver `db/schema.sql`) registra: creación de estudiantes y
docentes, asignación de docente a clase, inscripción/desinscripción de
estudiantes, cambios de contraseña, activación de 2FA, y intentos de login
fallidos/bloqueos. Cada registro guarda actor, rol, acción, objetivo, IP y
metadata. Útil para investigar un incidente o una disputa ("¿quién borró este
material?").

## 4. Rate limiting

| Endpoint | Límite |
|---|---|
| `POST /api/auth/login` | 10 / 15 min por IP |
| `POST /api/auth/change-password`, `/2fa/*` | 10 / 15 min por IP |
| `POST /api/admin/students`, `/teachers` | 30 / 15 min por IP |
| Subida de materiales (docente) | 40 / 15 min por IP |
| Subida de materiales (admin) | 60 / 15 min por IP |
| Foto de perfil | 20 / 15 min por IP |
| Global (`/api/*`) | 300 / 15 min por IP |

## 5. Otros controles ya presentes

- SQL siempre parametrizado (sin concatenar strings) - previene inyección SQL.
- Validación de entrada (`express-validator`) en todos los endpoints de escritura.
- CORS restringido a una lista explícita de orígenes.
- Cabeceras de seguridad HTTP con `helmet`.
- Mensajes de error genéricos al cliente en producción (no se filtran
  detalles internos ni se revela si un username existe o no).
- Creación de estudiantes en una transacción (evita estados inconsistentes).

## 6. Pendiente / recomendado antes de tener estudiantes reales

- **HTTPS obligatorio en producción** (Render lo da por defecto, confirmar
  que el dominio final también lo tenga vía Let's Encrypt/Cloudflare).
- **Backups automáticos** de la base de datos (la mayoría de los planes
  administrados los incluyen - confirmar frecuencia y probar una restauración
  al menos una vez antes de lanzar).
- **Un WAF/proxy delante** (ej. Cloudflare, gratis) agrega una capa extra
  contra bots y ataques volumétricos, más allá del rate-limit de la app.
- **Sanitización de contenido en el frontend**: los campos de texto libre
  (`title`, `description`) se guardan tal cual - el frontend debe escapar HTML
  al mostrarlos (no usar `innerHTML` directo) para evitar XSS almacenado.
- **Alta de `academy_admin` para nuevas instituciones**: hoy solo existe el
  script de CLI para crear el primer `super_admin`. Falta decidir el flujo
  para que Virtus dé de alta una nueva institución con su primer
  `academy_admin` (endpoint restringido a `super_admin`, con 2FA obligatorio
  igual que en el script).
- **Prueba de carga** antes del lanzamiento real (200-300 usuarios
  simultáneos, como se documentó en README.md).
- Considerar una revisión de seguridad externa (pentest ligero) antes de
  vender la plataforma a instituciones, dado que van a manejar datos de
  menores de edad.
