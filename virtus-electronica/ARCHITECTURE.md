# VIRTUS Electrónica — arquitectura y decisiones

## Alcance y separación

Aplicación independiente en `virtus-electronica`. No comparte credenciales, usuarios ni tablas con el LMS. Node 22.23+ sirve una API HTTP del mismo origen y un frontend ES modules sin dependencias de ejecución externas. SQLite con WAL, claves foráneas, índices y transacciones persiste datos en disco. Es apropiado para una primera instalación de un solo servidor; para múltiples instancias se deberá migrar el repositorio a PostgreSQL y usar almacenamiento de objetos para medios. No se presenta SQLite como un sistema distribuido.

## Modelo

Usuarios → roles → permisos; sesiones con tokens hash; direcciones y favoritos por usuario. Categorías jerárquicas, marcas, productos, variantes, imágenes, recursos técnicos y relaciones entre productos. Movimientos de inventario trazables. Pedidos → líneas con snapshot de precios → pagos e historial de estados. Cupones con fechas y límites; artículos y productos asociados; solicitudes institucionales; reseñas verificables; configuración editable. Valores monetarios en centavos USD, calculados exclusivamente en servidor.

## Diseño y componentes

Blanco cálido #f7f8f8, texto #172c30, acento #176b71. Cristal sutil en navegación, bordes de 1px, radios 16–28px, escala de espaciado de 4px. Componentes: iconos SVG, logo oficial en ventana recortada por CSS, tarjetas, etiquetas, filtros, galería, drawer, diálogo accesible, formularios y tablas. Portada editorial espaciosa y visual de producto. Respeto de reduced-motion. Mobile: navegación desplegable, búsqueda a ancho completo, catálogo de dos columnas, filtros compactos, drawer de ancho completo.

## Navegación

`/`, `/productos`, `/productos/:slug`, `/categoria/:slug`, `/kits`, `/instituciones`, `/lab`, `/lab/:slug`, `/contacto`, `/favoritos`, `/comparar`, `/cuenta`, `/checkout`, `/admin`. History API y fallback del servidor; metadatos y datos estructurados generados por servidor para productos. Sitemap dinámico y robots.

## Compra

Buscar/filtrar → ficha → carrito local persistente → checkout con validación → transacción que verifica stock/precios/cupón, crea pedido y reserva inventario → confirmación. Idempotencia evita pedidos dobles. Transferencia y retiro se configuran desde administración. Pago online permanece deshabilitado hasta registrar un proveedor real; nunca se simula un cobro exitoso. Cancelar devuelve stock una sola vez. Factura electrónica requiere integración fiscal posterior; el resumen de pedido no es factura.

## Administración

Acceso por sesión y permisos comprobados en API: métricas basadas en pedidos, CRUD de productos y categorías, inventario, pedidos, clientes, cupones, contenido y configuración, solicitudes, roles. Editor de producto incluye campos técnicos, recursos, variantes, medios, relaciones y SEO. Superadministrador creado por CLI, sin credenciales predeterminadas.

## Seguridad y despliegue

Scrypt con salt aleatorio, sesiones aleatorias almacenadas mediante SHA-256, cookies HttpOnly/SameSite/secure en producción, expiración y revocación. Escrituras con verificación de Origin; consultas parametrizadas; límites de cuerpo, rate limiting y autorización de cada recurso. Producción exige HTTPS mediante proxy, APP_ORIGIN, volumen persistente, copias de seguridad y datos comerciales verificados. El catálogo demo es opt-in y se indica globalmente.

## Validación

Pruebas de integración sobre base temporal: registro, permisos, stock, transacción de compra, idempotencia, cupones, cancelación y aislamiento de pedidos. Revisión visual desktop/móvil y flujo de compra. No inventar métricas de ventas, reseñas, marcas asociadas ni promesas de entrega.
