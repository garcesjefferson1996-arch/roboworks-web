# Mi negocio · VIRTUS Electrónica

Primera versión de gestión privada para el propietario. Comparte el servidor, las sesiones y el inventario de la tienda existente. Los registros se guardan en SQLite, no en el navegador. Moneda: USD; fecha inicial del formulario: Ecuador (America/Guayaquil).

## Abrir

Para publicar en Render y crear tu usuario en un formulario web protegido, consulta [SUBIR-MI-NEGOCIO.md](SUBIR-MI-NEGOCIO.md). Este asistente admite un solo propietario; las cuentas de clientes no dan acceso a la gestión.

Desde `virtus-electronica`, ejecuta `npm start` y abre http://localhost:3100/gestion.html. La administración incluye un enlace «Mi negocio · Finanzas». Si aún no tienes cuenta de propietario, ejecuta `npm run admin` y escribe tu nombre, correo y contraseña en la terminal privada. No se crea una contraseña predeterminada. No compartas tu contraseña en el chat.

Solo `super_admin` accede al módulo completo, incluidos los datos personales. Administradores de tienda, vendedores y clientes no tienen acceso a estos endpoints. Para varios propietarios con información personal separada hace falta extender este modelo de permisos: esta versión es para un solo negocio y propietario.

## Primer uso

1. Crea Caja del local, Banco del negocio y tu Cuenta personal en **Mis cuentas**. Introduce los saldos que tienen antes de empezar a registrar operaciones. Los saldos iniciales no son ingresos.
2. Revisa productos, precios, stock y variantes en **Administrar la tienda**. Los productos marcados como demostración no se pueden vender desde este módulo.
3. Registra tus robots por unidad en **Alquileres → Robot**, por ejemplo Abito y Unitree Go2, con su identificador.
4. Crea ventas presenciales, servicios de impresión 3D o corte láser y reservas. Cada operación crea un saldo pendiente; registrar la operación no inventa un pago.
5. Usa **Cobrar** sobre la operación para ingresar abonos o su liquidación. Usa **Pagar** sobre una cuenta por pagar. El sistema actualiza el saldo pendiente y la cuenta elegida.
6. Registra los demás gastos e ingresos en **Movimientos**. Para retirar dinero para ti, usa una transferencia desde el negocio a una cuenta personal. Para aportar dinero, haz lo inverso.
7. Revisa **Por cobrar y pagar**, la agenda, los saldos y **Reportes**. Puedes filtrar movimientos por fechas y ámbito y exportarlos en CSV.

## Reglas de operación

- Ventas presenciales: precios calculados en el servidor, stock compartido con la tienda, variantes obligatorias cuando existen. Cancelar restituye el inventario una sola vez. La venta y el cobro son dos pasos distintos.
- Alquileres: fechas inclusivas por día. Una unidad no admite reservas abiertas con fechas superpuestas; marcar devuelto la libera. No hay reservas por hora, garantías reembolsables ni contratos automáticos.
- Trabajos: precio y costo estimado para referencia, cliente, teléfono, entrega y notas. El costo estimado no afecta caja; registra los pagos reales de materiales o mano de obra como gastos.
- Completar un trabajo no liquida su deuda. La cuenta por cobrar permanece hasta cobrarla.
- Los abonos no pueden exceder la deuda ni ir a cuentas personales. Transferencias entre cuentas no se consideran ingresos/gastos operativos.
- Los importes se guardan en centavos. Identificadores de solicitud evitan repetir cobros, pagos y ventas cuando se reintenta la misma solicitud.
- Los movimientos no se borran. Una anulación requiere motivo, revierte su efecto y conserva registro y auditoría. **No realiza una devolución bancaria**. Para cancelar una operación pagada, primero resuelve la devolución real y anula sus cobros/pagos justificadamente.
- No hay edición posterior de cuentas/saldos iniciales ni de operaciones. Corrige mediante anulación y nuevo registro; operaciones cerradas no se reabren. Registra los datos con cuidado.

## Alcance financiero

Es un control operativo de caja, cuentas pendientes e inventario. El reporte de flujo neto **no es utilidad contable**. No se implementan contabilidad de partida doble, conciliación bancaria automática, valoración por costo promedio/FIFO, impuestos, retenciones, depreciaciones, nómina o emisión de comprobantes SRI. No es sustituto del sistema fiscal o de la revisión de tu contador.

Los pedidos de la tienda web permanecen en el módulo de pedidos existente y **no se importan automáticamente** al libro de caja de gestión. Registra manualmente sus cobros con la referencia del pedido, sin volver a crear una venta presencial (eso descontaría stock otra vez). Evita registrar un cobro tanto como ingreso libre como abono de la misma operación.

Los formularios de servicio y alquiler guardan notas de especificaciones, no archivos de diseño. Los contactos se registran por operación; no hay un directorio CRM independiente ni órdenes de compra con recepción automática de inventario.

## Respaldo y operación

Ejecuta `npm run backup` para crear `backups/<fecha>/store.sqlite` y una copia de uploads. La base se respalda con una instantánea coherente de SQLite. Para que los archivos subidos correspondan al mismo momento, haz el respaldo sin subidas en curso, preferiblemente con el servidor detenido. Incluye todos los usuarios y datos financieros: protege la carpeta y guarda otra copia fuera del equipo. El CSV es un reporte, **no un respaldo completo**.

Para restaurar: detén el servidor, conserva una copia íntegra del directorio de datos actual (incluidos sus archivos WAL/SHM si existen), y coloca la base respaldada y uploads en un directorio de datos vacío. Apunta DB_PATH a esa nueva base antes de iniciar. No combines el respaldo con WAL/SHM de otra base. Esta operación debe hacerla quien administra el servidor.

La versión local no está desplegada. Para acceso desde otros dispositivos usa el despliegue Node con HTTPS y almacenamiento persistente descrito en README. No publiques la base ni la carpeta de respaldos, y no copies solo el frontend a GitHub Pages.

## Verificación

`npm test` ejecuta las pruebas de tienda y gestión: permisos, separación de saldos, transferencias, idempotencia, abonos, anulaciones, fechas, reservas, stock, variantes, persistencia y respaldo recuperable. `npm run check` comprueba sintaxis.

La revisión de interfaz se hace con `node test/preview.js` en el puerto 3110: usa una base temporal en memoria y credenciales QA del archivo. Los datos escritos allí son solo de prueba y desaparecen al detener el proceso. Nunca uses ese servidor para gestionar dinero real.
