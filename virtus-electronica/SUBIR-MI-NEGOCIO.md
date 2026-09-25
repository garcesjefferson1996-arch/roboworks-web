# Publicar VIRTUS · Mi negocio

El sistema es privado y tiene un solo propietario. Necesita un servidor Node y disco persistente. No funciona subiendo solamente HTML a GitHub Pages ni copiando la carpeta `static`: esa carpeta es otra versión de la tienda.

## 1. Subir el código al repositorio existente

En PowerShell, desde el proyecto:

```powershell
cd "C:\Users\HP\OneDrive\Desktop\RoboWorks\roboworks-web"
git status --short
git add -- virtus-electronica
git diff --cached --name-only
git commit --only -m "Agregar gestion privada VIRTUS y configuracion de publicacion" -- virtus-electronica
git push origin HEAD
```

Antes del commit revisa que la lista no contenga `.env`, bases `.sqlite`, `data`, `backups`, contraseñas ni documentos personales. Las exclusiones están configuradas en la carpeta. El commit incluye la carpeta VIRTUS existente completa, incluidas tienda y gestión. No usa `git add .` para evitar los otros trabajos del proyecto. No se ha hecho commit ni push automáticamente.

## 2. Publicar en Render

1. En https://dashboard.render.com abre **New → Blueprint** y conecta tu repositorio `garcesjefferson1996-arch/roboworks-web`.
2. Selecciona la rama que acabas de subir. En **Blueprint Path** escribe `virtus-electronica/render.yaml` (no el render.yaml de la raíz, que corresponde a otro backend).
3. Revisa el servicio `virtus-mi-negocio`, plan Starter y disco de 1 GB. **Es una configuración de pago:** confirma el precio que Render muestre antes de crearla.
4. Crea el servicio y espera el despliegue. El archivo configura Node, modo producción, disco persistente y una clave de instalación aleatoria. No modifica tu dominio ni el sitio existente.
5. Abre la URL HTTPS asignada por Render y añade `/gestion.html`.

El origen HTTPS se toma de `RENDER_EXTERNAL_URL`. Si más adelante añades un dominio propio, establece `APP_ORIGIN=https://tu-dominio` en Environment y entra siempre por ese mismo dominio.

Documentación: https://render.com/docs/blueprint-spec y https://render.com/docs/disks.

## 3. Crear tu único usuario (desde la web)

1. En Render abre el servicio → **Environment**. Copia el valor de `OWNER_SETUP_KEY` sin enviarlo por chat ni subirlo a GitHub.
2. En tu `/gestion.html`, pulsa **Crear mi usuario propietario**.
3. Escribe tu nombre, correo y una contraseña propia de al menos 12 caracteres. Repítela y pega la clave de instalación.
4. Pulsa **Crear mi usuario** e inicia sesión con el correo y contraseña que elegiste. La clave de instalación no es tu contraseña.
5. El formulario queda bloqueado después del primer propietario. Puedes eliminar `OWNER_SETUP_KEY` de Environment después de comprobar que puedes entrar; guarda el cambio y vuelve a desplegar si Render lo solicita.

No hay usuario ni contraseña predeterminados. La clave de instalación no permite restablecer una cuenta ya creada. No hay recuperación por correo; guarda tu contraseña en un gestor de contraseñas. La sesión se protege con una cookie HttpOnly y Secure en producción.

Alternativa local, sin Render: desde `virtus-electronica`, ejecuta `npm run admin` una sola vez, completa los datos en tu terminal privada y después `npm start`. El asistente de terminal muestra los caracteres de la contraseña; la opción web los oculta. Entra en http://localhost:3100/gestion.html. Una cuenta local no aparece en Render: son bases diferentes.

## 4. Empezar a trabajar

Crea las cuentas con tus saldos reales, registra productos y robots, y consulta `GESTION.md`. El despliegue comienza con una base vacía: no incluye registros reales de este equipo ni datos de prueba. Usa un solo servicio/instancia para esta base SQLite.

Para respaldar, abre Shell del servicio y ejecuta `npm run backup`. Los respaldos quedan en `/var/data/backups`; descarga y conserva otra copia protegida fuera de Render. Los datos financieros, usuarios y archivos subidos están en el disco, nunca en GitHub. Un respaldo en el mismo disco no te protege de eliminar el disco entero.

Si utilizas otro hosting, sube el código fuente, ejecuta `npm ci --omit=dev`, configura Node 22.23 o superior, `NODE_ENV=production`, `HOST=0.0.0.0`, `APP_ORIGIN`, `DB_PATH` persistente, `BACKUP_PATH` persistente y `OWNER_SETUP_KEY` aleatoria de al menos 32 caracteres. Arranca con `npm start` detrás de HTTPS. El Dockerfile es otra opción para proveedores con Docker.
