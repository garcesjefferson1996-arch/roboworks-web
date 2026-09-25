import { openDb, id, one, transaction } from "./db.js";
import { saveProduct, saveCategory } from "./catalog.js";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
export function seed(db) {
  if (one(db, "SELECT id FROM products LIMIT 1"))
    throw new Error(
      "El catálogo ya contiene productos. La carga demo solo se permite en una base vacía.",
    );
  const categories = [
    ["arduino", "Arduino", "El inicio de grandes ideas.", "uno"],
    ["esp32", "ESP32 & IoT", "Conecta tu próximo proyecto.", "esp32"],
    ["sensores", "Sensores", "Dale sentidos a tus creaciones.", "sensor"],
    ["robotica", "Robótica", "Ideas que se ponen en movimiento.", "kit"],
    ["kits", "Kits educativos", "Aprende haciendo, paso a paso.", "kit"],
    ["impresion-3d", "Impresión 3D", "De la pantalla al mundo real.", "hero"],
    ["motores", "Motores", "Movimiento con precisión.", "kit"],
    ["servomotores", "Servomotores", "Controla cada movimiento.", "kit"],
    ["drivers", "Drivers", "Potencia bajo control.", "esp32"],
    ["pantallas", "Pantallas", "Visualiza tus ideas.", "esp32"],
    ["comunicacion", "Comunicación", "Conecta dispositivos.", "esp32"],
    ["herramientas", "Herramientas", "Tu espacio maker.", "kit"],
    ["cables", "Cables y conectores", "Todo está conectado.", "kit"],
    ["energia", "Energía y baterías", "Energía para crear.", "uno"],
    ["componentes", "Componentes", "Cada detalle cuenta.", "sensor"],
  ];
  const cats = {};
  categories.forEach(([slug, name, description, img], position) => {
    const c = saveCategory(db, {
      slug,
      name,
      description,
      image: `/assets/${img}.webp`,
      position,
      active: 1,
    });
    cats[slug] = c.id;
  });
  const brand = id();
  db.prepare("INSERT INTO brands VALUES(?,?)").run(
    brand,
    "Catálogo demostrativo",
  );
  const samples = [
    [
      "arduino-uno-r3",
      "Arduino Uno R3",
      "arduino",
      1850,
      2200,
      38,
      "uno",
      "Tu primera idea empieza aquí. Una placa de desarrollo versátil para explorar programación y electrónica.",
      "5 V",
      "Inicial",
    ],
    [
      "esp32-devkit",
      "ESP32 DevKit V1",
      "esp32",
      950,
      0,
      54,
      "esp32",
      "Conecta tus ideas. Una plataforma compacta para explorar proyectos de Internet de las cosas.",
      "3.3 V",
      "Intermedio",
    ],
    [
      "kit-maker-inicio",
      "Kit Maker · Primeros pasos",
      "kits",
      4990,
      5990,
      12,
      "kit",
      "Todo un mundo por descubrir en una sola caja. Un punto de partida para aprender creando circuitos.",
      "5 V",
      "Inicial",
    ],
    [
      "sensor-ultrasonico-hc-sr04",
      "Sensor ultrasónico HC-SR04",
      "sensores",
      250,
      0,
      65,
      "sensor",
      "Añade percepción de distancia a tu próximo proyecto de robótica.",
      "5 V",
      "Inicial",
    ],
    [
      "arduino-nano",
      "Arduino Nano compatible",
      "arduino",
      690,
      0,
      24,
      "uno",
      "Un formato compacto para proyectos donde cada milímetro importa.",
      "5 V",
      "Inicial",
    ],
    [
      "kit-robot-explorador",
      "Kit Robot Explorador",
      "robotica",
      6490,
      7490,
      8,
      "kit",
      "Diseña, programa y experimenta con un robot móvil educativo.",
      "5 V",
      "Intermedio",
    ],
    [
      "servo-sg90",
      "Micro servomotor SG90",
      "servomotores",
      350,
      0,
      45,
      "kit",
      "Explora mecanismos y control de posición en proyectos educativos.",
      "5 V",
      "Inicial",
    ],
    [
      "servo-mg996r",
      "Servomotor MG996R",
      "servomotores",
      1290,
      0,
      14,
      "kit",
      "Control de movimiento para tus prototipos de mecanismos.",
      "6 V",
      "Intermedio",
    ],
    [
      "driver-motores",
      "Driver de motores L298N",
      "drivers",
      490,
      0,
      23,
      "esp32",
      "Controla el movimiento de tu robot desde un microcontrolador.",
      "5 V",
      "Intermedio",
    ],
    [
      "protoboard-830",
      "Protoboard de 830 puntos",
      "cables",
      390,
      0,
      50,
      "kit",
      "Experimenta con conexiones sin necesidad de soldadura.",
      "No aplica",
      "Inicial",
    ],
    [
      "filamento-pla",
      "Filamento PLA · 1 kg",
      "impresion-3d",
      1990,
      0,
      0,
      "hero",
      "Material para transformar modelos digitales en objetos tangibles.",
      "No aplica",
      "Inicial",
    ],
    [
      "kit-laboratorio-steam",
      "Kit Laboratorio STEAM",
      "kits",
      8990,
      0,
      6,
      "kit",
      "Una selección de componentes para aprender en equipo y desarrollar proyectos en el aula.",
      "5 V",
      "Intermedio",
    ],
  ];
  const products = samples.map(
    (
      [
        slug,
        name,
        cat,
        price,
        compare_price,
        stock,
        img,
        description,
        voltage,
        level,
      ],
      i,
    ) =>
      saveProduct(
        db,
        {
          slug,
          name,
          sku: `DEMO-${String(i + 1).padStart(4, "0")}`,
          category_id: cats[cat],
          brand_id: brand,
          price,
          compare_price,
          stock,
          active: 1,
          featured: i < 4 ? 1 : 0,
          demo: 1,
          description,
          images: [
            {
              url: `/assets/${img}.webp`,
              alt: `Ilustración conceptual de ${name}`,
            },
          ],
          details: {
            voltage,
            level,
            compatibility: "Arduino IDE",
            age: "14+ con supervisión",
            technology: cat === "esp32" ? "Wi-Fi / Bluetooth" : "Electrónica",
            type: cat === "kits" ? "Kit" : "Componente",
            use: "Educación y prototipado",
            kit: cat === "kits" || cat === "robotica",
            includes:
              cat === "kits"
                ? [
                    "Placa de desarrollo",
                    "Protoboard",
                    "Cables de conexión",
                    "Selección de sensores y componentes",
                  ]
                : ["Unidad de demostración del producto"],
            features: [
              "Diseñado para experimentar",
              "Recursos técnicos en una sola ficha",
              "Ideal para proyectos educativos",
            ],
            applications: [
              "Prototipado de circuitos",
              "Aprendizaje de programación",
              "Proyectos STEAM",
            ],
            note: "Ficha demostrativa. Verificar especificaciones, contenido e imágenes con el fabricante antes de publicar el producto real.",
            students: cat === "kits" ? "1–2" : "",
            software: "Arduino IDE",
            projects:
              cat === "kits"
                ? [
                    "Semáforo programable",
                    "Medición de distancia",
                    "Control de un servomotor",
                  ]
                : [],
            specifications: { Voltaje: voltage, Nivel: level },
            quantityDiscounts: [],
          },
          resources: [],
        },
        null,
        null,
      ),
  );
  const aid = id();
  db.prepare(
    "INSERT INTO articles(id,slug,title,excerpt,body,image,tag,active) VALUES(?,?,?,?,?,?,?,1)",
  ).run(
    aid,
    "tu-primer-proyecto",
    "Tu primera idea merece un circuito.",
    "Una guía para elegir los componentes de tu primer proyecto y empezar a experimentar.",
    "Todo comienza con una pregunta: ¿qué quieres construir?\n\nAntes de conectar\nIdentifica la placa, revisa su documentación oficial y confirma los voltajes de cada componente. Trabaja con la alimentación desconectada al modificar el circuito.\n\nUn proyecto pequeño, un gran comienzo\nEmpieza por controlar un LED con el ejemplo básico de tu entorno de programación. Después, incorpora un sensor y observa cómo responde el sistema.\n\nConstruye paso a paso\nPrueba cada componente por separado y documenta tus conexiones. Cuando todo funcione, reúne los módulos en tu propio proyecto.\n\nContenido editorial de demostración. Sustituye esta guía por un tutorial validado antes de publicarla como documentación técnica.",
    "/assets/kit.webp",
    "PARA EMPEZAR",
  );
  for (const p of [products[0], products[3], products[9]])
    db.prepare("INSERT INTO article_products VALUES(?,?)").run(aid, p.id);
  db.prepare("UPDATE settings SET value=? WHERE key='demo'").run("true");
  console.log(
    "Catálogo demo creado. No se han creado usuarios ni ventas ficticias.",
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const db = openDb();
  try {
    seed(db);
  } finally {
    db.close();
  }
}
