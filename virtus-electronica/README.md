# VIRTUS Electrónica

## Gestión privada del negocio

Para publicarlo y crear tu usuario desde la web, sigue [SUBIR-MI-NEGOCIO.md](SUBIR-MI-NEGOCIO.md). Incluye el Blueprint de Render en `virtus-electronica/render.yaml`, distinto del backend de la raíz. No hay credenciales predeterminadas: la instalación web requiere `OWNER_SETUP_KEY` y se cierra tras crear al único propietario.

Nuevo módulo en **http://localhost:3100/gestion.html**: dinero del negocio y personal, ingresos/gastos, transferencias, ventas presenciales con inventario, trabajos 3D/láser, alquiler de robots, abonos, cuentas pendientes y reportes CSV. Acceso exclusivo de Super Admin. [Guía de uso, respaldo y alcance financiero](GESTION.md). La emisión fiscal y la contabilidad completa no están incluidas. Ejecuta `npm run backup` para respaldar la base y archivos.

Tienda independiente del sitio RoboWorks y del LMS Virtus. Frontend responsive, API Node.js y base de datos SQLite real. Los datos persisten en `data/store.sqlite`; no se guardan pedidos, usuarios ni inventario en localStorage. El navegador conserva solamente el carrito y las preferencias de visitantes.

## Abrir y ejecutar

Requisito: Node.js 22.23 o superior, con `node:sqlite` disponible. En Node 22 este módulo todavía emite una advertencia experimental. No hacen falta paquetes externos para ejecutar la aplicación; Prettier es una dependencia de desarrollo.

Desde esta carpeta:

```powershell
npm start
```

- Tienda: http://localhost:3100
- Administración: http://localhost:3100/admin

Para cambiar puerto, origen o ruta de datos, copia `.env.example` a `.env`. Los scripts npm cargan ese archivo. Si cambias el puerto, actualiza también `APP_ORIGIN`: las escrituras requieren el origen exacto por protección CSRF.

## Primer administrador

```powershell
npm run admin
```

El asistente solicita nombre, correo y contraseña de 12–128 caracteres. La contraseña se almacena mediante scrypt con salt aleatorio. No hay una contraseña predeterminada ni un acceso público de administrador. La entrada del asistente CLI es visible en la terminal; ejecútalo en una sesión privada. El registro de clientes nunca concede permisos administrativos.

La instalación local entregada contiene un catálogo demo y no tiene una cuenta de administrador comercial creada. Falta confirmar el correo de quien administrará la tienda.

## Datos de demostración

```powershell
npm run seed
```

Se permite únicamente sobre un catálogo vacío. Crea 15 categorías, 12 productos y un artículo; no crea ventas, clientes, reseñas ni métricas ficticias. El modo demo aparece en la tienda y en el checkout. Los pedidos demo se guardan y reservan inventario para probar el flujo, pero no generan cobros ni se contabilizan como ventas reales. Cancélalos desde Pedidos para restituir stock.

Las imágenes generadas son composiciones conceptuales, no fotografías verificadas de los modelos. Algunas fichas demo reutilizan ilustraciones. Sustituye fotografías, precios, existencias y especificaciones antes de publicar productos reales. En cada producto puedes desmarcar «Producto de demostración» después de validarlo.

## Funciones implementadas

- Portada blanca con logo oficial, imágenes WebP, contenido editable y navegación móvil.
- Catálogo paginado, filtros combinables, ordenación, búsqueda parcial con productos, categorías y artículos.
- Fichas con galería, zoom, videos por URL, variantes, especificaciones, compatibilidad y recursos técnicos.
- Comparación de hasta cuatro productos, favoritos locales y sincronizados con cuentas.
- Carrito lateral persistente, cantidades, checkout de invitado o usuario y direcciones guardadas.
- Validación de stock, precios calculados en servidor, descuentos por cantidad, cupones y totales en centavos USD.
- Idempotencia de pedidos, reserva de existencias y cancelación que devuelve stock una sola vez.
- Registro, inicio/cierre de sesión, perfil, direcciones, cambio de contraseña, pedidos y acceso a documentación.
- Facturas PDF adjuntadas por personal autorizado; descarga privada para el cliente. El resumen descargable es un comprobante de pedido, no una factura fiscal.
- Formularios de contacto e instituciones guardados en la base de datos; gestión de solicitudes en administración.
- WhatsApp configurable con mensaje por producto. Si no hay número configurado, se abre el formulario interno.
- Virtus Lab con editor de artículos y productos asociados, y compra de componentes del proyecto.
- CRUD de productos, duplicación, activación, categorías jerárquicas, marcas, variantes, documentación y relaciones.
- Inventario por producto o variante, entradas/salidas con motivo e historial, mínimos y alertas.
- Pedidos con transiciones controladas; información de cliente, dirección, líneas, pago e historial.
- Cupones porcentuales/fijos con mínimos, fechas y límite de uso; precio anterior y descuentos por volumen.
- Edición de portada, banners de kits, títulos de secciones, FAQ, información comercial y condiciones.
- Subida de PNG/JPG/WebP/PDF hasta 10 MB. Videos, repositorios, STL, código y software mediante enlaces HTTPS.
- Roles de Super Admin, Administrador, Ventas, Inventario, Editor y Soporte. Permisos configurables en API.
- Métricas de ingresos confirmados, pedidos reales, ticket promedio, clientes registrados, ventas diarias, más vendidos y bajo stock.
- URLs amigables, metadatos de producto generados en servidor, canonical, Open Graph, JSON-LD, sitemap dinámico, robots y 404.

## Operación real e integraciones pendientes

La aplicación está implementada y funciona localmente. No está desplegada ni certificada como lista para operación comercial a escala.

1. Confirma datos comerciales, administrador, WhatsApp, dirección de retiro, precios, inventario e imágenes reales.
2. Publica tus condiciones de venta, entrega, devoluciones y privacidad. El checkout real permanece bloqueado si faltan nombre comercial, correo o políticas.
3. Configura envío y/o retiro. La tarifa actual es fija para Ecuador con umbral de envío gratuito; no hay cotización por transportista ni guía automática.
4. Activa transferencia bancaria y añade instrucciones si vas a aceptar pedidos con envío. Los pagos se confirman manualmente después de comprobarlos; nunca por la declaración del comprador.
5. Para tarjetas o pagos online falta seleccionar proveedor, entregar credenciales e implementar su adaptador, creación de sesión, verificación de webhook firmado, conciliación e idempotencia. Actualmente la API devuelve 503 para `online`, sin simular cobros.
6. La emisión fiscal SRI, los reembolsos automáticos y los correos transaccionales no están integrados. Puedes adjuntar las facturas emitidas en tu sistema externo. Una cancelación de pedido pagado marca «refund_required» para seguimiento manual.
7. Los pedidos pendientes reservan stock hasta cancelación manual. Define y opera una política de vencimiento antes de aceptar grandes volúmenes.
8. El cambio de contraseña autenticado funciona. No se implementó recuperación por correo ni verificación de correo porque requieren un servicio de entrega real.
9. La base incluye relaciones para reseñas, pero no hay publicación ni moderación de reseñas en esta entrega. Las métricas están implementadas para el total y los últimos 30 días; todavía no hay selector arbitrario de períodos ni gráfica de categorías.

## Despliegue

La carpeta pública no debe publicarse sola en GitHub Pages: la tienda requiere el servidor y su base de datos.

- Un servidor Node con HTTPS mediante proxy y `APP_ORIGIN=https://tu-dominio`.
- `NODE_ENV=production` activa cookies Secure y HSTS; el servidor exige un origen HTTPS.
- `HOST=0.0.0.0` si el contenedor o proveedor lo requiere; por defecto solo escucha en loopback.
- Volumen persistente para `DB_PATH`, con el directorio `uploads` junto a la base. Las facturas privadas se almacenan dentro de la base.
- Hay un `Dockerfile`; monta `/app/data`. No se ha construido ni desplegado el contenedor en esta sesión.
- Copias de seguridad de la base y uploads, verificación de restauración, monitoreo, límites del proxy y pruebas de carga antes de lanzamiento.
- Un solo proceso/instancia de escritura. SQLite WAL resulta útil para el primer servidor; para múltiples instancias, usa una migración a PostgreSQL y almacenamiento de objetos. No se ha realizado una prueba de carga de miles de productos o usuarios concurrentes.
- El rate limiting es en memoria por proceso e IP del socket. Configura límites reales en el proxy si todos los visitantes comparten una IP upstream. No se confía en cabeceras `X-Forwarded-For` enviadas por el cliente.

## Pruebas

```powershell
npm test
npm run check
```

19 pruebas de integración: catálogo, búsqueda, registro/hash, sesiones, permisos, CSRF, direcciones, favoritos, stock, cupones, checkout, idempotencia, aislamiento de pedidos, cancelación, variantes, CRUD, solicitudes, contenido, carrera por última unidad, facturas privadas, formatos de archivo, validación CMS, SEO y errores.

La revisión manual en navegador cubrió portada a 1440 px y 390 px, búsqueda «servo», ficha, carrito, checkout móvil completado, inicio de sesión administrativo, dashboard y creación de un producto con precio y stock.

`node test/preview.js` levanta un servidor QA separado en http://localhost:3110 con base **en memoria** y credenciales de prueba explícitas en ese archivo. No lo publiques ni lo uses como servidor real. Se usó para pruebas sin introducir cuentas de prueba en la base comercial.

## Estructura

```text
src/schema.sql       Tablas, claves foráneas e índices
src/db.js            Conexión, configuración y consultas compartidas
src/security.js      Validaciones, hash y permisos
src/catalog.js       Escritura transaccional del catálogo
src/commerce.js      Cotización, pedidos y movimientos
src/api.js           Endpoints y autorización
src/uploads.js       Validación y almacenamiento de archivos
src/server.js        HTTP, seguridad, SEO y estáticos
public/app.js        Tienda, cuenta, carrito y checkout
public/admin.js      Administración
public/ui.js         Componentes y utilidades de interfaz
public/styles.css    Sistema visual y responsive
test/store.test.js   Integración sobre una base aislada
```

El diseño previo a la implementación está en `ARCHITECTURE.md`; los prompts y la procedencia de las imágenes están en `ASSETS.md`.
