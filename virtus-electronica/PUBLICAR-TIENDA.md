# Publicación de VIRTUS Electrónica (web estática)

Carpeta publicable: virtus-electronica/static.
Contiene HTML, CSS, JavaScript, products.json y assets. No necesita base de datos ni servidor de aplicación.

Para añadirla al MISMO sitio que ya usa virtusrobotica.com:
1. En el repositorio que publica ese dominio, copia el contenido de static dentro de una carpeta tienda.
2. Conserva el index.html y CNAME originales de la web principal. No reemplaces el dominio con el de esta tienda.
3. Añade a la página principal un enlace hacia /tienda/ con el texto «VIRTUS Electrónica».
4. Publica con el mecanismo que ya usa la web principal. La dirección será https://virtusrobotica.com/tienda/.

Los enlaces internos usan fragmentos (#/catalogo, #/producto/...) para funcionar en alojamiento estático y subcarpetas.

Edición del catálogo: static/products.json. Los precios se indican en centavos de USD; null significa consultar precio.
Logo, fondo y WhatsApp: static/config.js. Imágenes: static/assets.
Los ejemplos anteriores están en products-demo-backup.json, fuera de la carpeta publicable.
El backend anterior permanece en src, public y data. No subas data, .env ni node_modules.

El repositorio general tiene virtus-landing ignorado por Git. Confirma cuál es el repositorio que publica el dominio antes de copiar o hacer push; no basta con subir archivos a cualquier repositorio.
