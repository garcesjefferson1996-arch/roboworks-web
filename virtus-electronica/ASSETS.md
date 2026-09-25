# Imágenes y procedencia

El logo oficial se copió sin alterar desde la imagen suministrada por el usuario a `public/assets/virtus-original.png`. La interfaz recorta el espacio blanco mediante CSS; no se redibujó la marca.

Se usó la herramienta integrada `image_gen` (no CLI ni API externa) para cinco imágenes conceptuales. Se conservaron los originales PNG en `public/assets/` y se generaron versiones WebP optimizadas para la web con Pillow, según el requisito de optimizar imágenes. Las versiones utilizadas suman aproximadamente 406 KB. Los PNG originales suman aproximadamente 9 MB. La imagen del logo pesa aproximadamente 966 KB y se conserva intacta.

Archivos usados: `public/assets/hero.webp`, `uno.webp`, `esp32.webp`, `kit.webp`, `sensor.webp`. Todos son ilustraciones de demostración y deben sustituirse por imágenes verificadas en las fichas comerciales.

## Prompt del hero

Create one premium photorealistic editorial website hero image for a sophisticated educational electronics store. Landscape 3:2. A teal blue Arduino-style microcontroller board with realistic gold pins, black integrated circuits and brushed metal USB connector, accompanied by a small black ESP32 board and a tiny ultrasonic sensor with two round silver eyes. A few curved black jumper wires as fine graphic lines. All objects arranged as a beautiful precise floating exploded still life above a large frosted translucent glass plinth, on very light warm gray seamless studio background. Main teal board large at center slightly rotated, three-quarter elevated view, tactile industrial materials, soft natural shadows, subtle blue-green refraction. Clean engineering product photography, refined Apple-like studio lighting, very high quality. No text, no lettering, no logos, no watermark. Composition fills frame with ample breathing room. This is conceptual editorial artwork, not a technical diagram.

## Prompts del catálogo

Se hizo una llamada independiente por imagen con esta plantilla exacta:

Premium isolated studio product photograph of **[subject]**. Single coherent product composition centered on seamless very light warm grey background #f5f6f6. Three-quarter elevated view, delicate grounding shadow, precise realistic electronic details, generous empty margin. Square 1:1 product catalog photograph. No added text, no logos, no watermark, no packaging. Conceptual demo catalog image.

Sustituciones de `[subject]`:

- `uno`: teal blue Arduino Uno style development board with metallic USB B connector, black female pin headers and gold details
- `esp32`: compact black ESP32 development board, central silver RF shield, black antenna trace and two neat rows of gold pins
- `kit`: educational electronics starter kit neatly arranged, teal microcontroller board, white breadboard, rainbow jumper wires, small blue servo, resistors and colorful LEDs
- `sensor`: ultrasonic distance sensor HC-SR04, blue small circuit board, two large round silver mesh transducers, four gold connector pins

No se utilizan imágenes remotas del catálogo. Los iconos de interfaz son SVG de trazos definidos en `public/ui.js`.
