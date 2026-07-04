# Virtus - Backend

Backend de la plataforma educativa Virtus (robótica educativa para instituciones).
Proyecto **independiente** del backend de RoboWorks: no comparte base de datos,
servicio de hosting ni dominio. Está construido reutilizando el modelo probado
de RoboWorks, con seguridad reforzada y soporte para el rol de docente.

## 1. Requisitos

- Node.js 18+
- Una base de datos MySQL **administrada** (no un plan gratuito) - ver sección de escalamiento.
- Cuenta de Cloudinary (archivos y fotos de perfil).

## 2. Configuración local

```bash
npm install
cp .env.example .env
# Completa .env con tus credenciales reales
npm run migrate        # crea las tablas (db/schema.sql)
npm run create-admin   # crea el primer usuario super_admin
npm run dev            # levanta el servidor con nodemon
```

## 3. Roles del sistema

| Rol            | Acceso                                                              |
|----------------|----------------------------------------------------------------------|
| `super_admin`  | Todo el sistema, todas las instituciones                            |
| `academy_admin`| Todo dentro de su institución (tenant): programas, clases, docentes, estudiantes |
| `teacher`      | Solo sus propias clases: ver estudiantes, subir guía y recursos      |
| `student`      | Solo sus propias clases: ver guía, recursos, próxima clase, historial |

Cada clase tiene, desde su creación, una categoría fija **"Guía de la clase"**
(no se puede borrar) para que la guía oficial siempre esté en el mismo lugar,
separada de otros recursos.

## 4. Seguridad implementada

- Contraseñas con bcrypt (nunca en texto plano).
- JWT en cookie `httpOnly`, `secure` y `sameSite` configurados según entorno
  (en RoboWorks esto estaba fijo a `localhost`, lo cual rompe en producción).
- Rate limiting: 10 intentos de login por IP / 15 min, y límite global de 300
  peticiones de API por IP / 15 min.
- Cabeceras de seguridad HTTP con `helmet`.
- CORS restringido a una lista explícita de orígenes (no `*`).
- Validación de entrada (`express-validator`) en todos los endpoints de escritura.
- Consultas SQL siempre parametrizadas (sin concatenar strings) - previene inyección SQL.
- Mensajes de error genéricos al cliente en producción (no se filtran detalles internos).
- `.env` nunca se sube al repo (`.gitignore`); `.env.example` no tiene secretos reales.
- Creación de estudiantes en una transacción (evita estados inconsistentes si algo falla a medio camino).

Pendiente recomendado antes de escalar mucho más: 2FA para admins, rotación de
`JWT_SECRET`, y logging estructurado (ej. a un servicio externo) en vez de `console.log`.

## 5. Sobre la integración de WhatsApp (decisión pendiente)

RoboWorks usa `whatsapp-web.js`, una librería no oficial que automatiza WhatsApp
Web. Funciona, pero conlleva riesgo real de que Meta bloquee el número si detecta
uso automatizado, y no está pensada para el volumen de una plataforma de 2000+
estudiantes. No se incluyó en este backend por defecto. Si quieres notificaciones
por WhatsApp para Virtus, la opción profesional es la **WhatsApp Business
Platform (Cloud API)** oficial de Meta. Es una decisión de producto: avísame y
lo agregamos como su propio módulo.

## 6. Base de datos: qué plan elegir para 2000+ estudiantes

2000 estudiantes es poco volumen de datos (unas pocas miles de filas). El
riesgo real no es el tamaño, es:

1. **Conexiones simultáneas.** Ajusta `DB_CONNECTION_LIMIT` según el máximo que
   permita tu plan, dejando margen (si tu plan permite 30, usa 20-25).
2. **Plan gratuito vs. administrado.** Los free tiers casi siempre limitan
   conexiones (5-20) y almacenamiento. Para producción con instituciones reales,
   usa un plan de pago (Railway, PlanetScale, DigitalOcean Managed MySQL, Aiven -
   normalmente $10-25/mes es suficiente para este volumen).
3. **Concurrencia real, no el total.** 2000 estudiantes inscritos no significa
   2000 conexiones a la vez. El pico real suele ser 10-30% del total (200-600
   simultáneos en el peor momento) - dimensiona para eso.
4. **Índices.** El esquema (`db/schema.sql`) ya incluye índices en las columnas
   que se usan para relacionar (`tenant_id`, `class_id`, `teacher_id`,
   `student_id`), que es lo que evita que las consultas se vuelvan lentas
   cuando crece la cantidad de datos.

### Antes de lanzar con estudiantes reales

- [ ] Confirmar el proveedor y plan de MySQL de producción (no free tier).
- [ ] Correr `npm run migrate` contra esa base de datos.
- [ ] Prueba de carga simple: simular 200-300 logins/consultas simultáneas
      (por ejemplo con `autocannon` o `k6`) y confirmar que no hay errores ni
      tiempos de respuesta excesivos.
- [ ] Verificar que `NODE_ENV=production`, `COOKIE_DOMAIN` y `FRONTEND_URL_PROD`
      están bien configurados (si las cookies fallan, usualmente es por esto).

## 7. Despliegue (Render, como servicio separado del de RoboWorks)

1. Nuevo servicio web en Render apuntando a este directorio (`virtus-backend/`).
2. Configura las variables de entorno de `render.yaml` con tus valores reales.
3. Backend en su propio dominio/subdominio (ej. `api.virtusrobotica.com`) y
   frontend en otro (ej. `plataforma.virtusrobotica.com`) - o ambos bajo el
   mismo dominio si prefieres simplicidad, ajustando `COOKIE_DOMAIN` y CORS.
4. Compra del dominio: cualquier registrador (Namecheap, Google Domains,
   GoDaddy) - apunta el DNS al servicio de Render (CNAME) y a donde sirvas el
   frontend estático.
