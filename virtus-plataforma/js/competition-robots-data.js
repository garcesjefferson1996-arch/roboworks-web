// Robótica de Competencia — contenido estático (sin base de datos ni API).
// Cada robot es un objeto simple: nombre, categoría, ícono, imagen de
// portada, galería de fotos, descripción, paso a paso y el link de
// Google Drive para descargar todos los archivos.
//
// Para agregar o editar un robot: edita este arreglo y ya. No hace falta
// tocar el backend ni la base de datos.
//   image / gallery: URLs de imágenes (por ejemplo, subidas a Cloudinary,
//   Imgur, o un link "compartir imagen" de Google Drive).
//   driveLink: URL de la carpeta de Google Drive con los archivos
//   (STL, código, diagramas de conexión, etc.), con permiso "cualquiera
//   con el link puede ver".
//   specs: (opcional) lista de {label, value} con las especificaciones
//   técnicas/reglas de la categoría (tamaño, peso, motores permitidos, etc.).
window.VIRTUS_COMPETITION_ROBOTS = [
  {
    id: 'soccer',
    name: 'Robot Soccer Virtus',
    category: 'Fútbol de robots (2 vs 2)',
    icon: 'fa-futbol',
    image: '',
    gallery: [],
    specs: [
      { label: 'Modalidad', value: '2 vs 2' },
      { label: 'Tamaño máximo', value: '15 x 15 cm' },
      { label: 'Peso máximo', value: '500 g' },
      { label: 'Controlador', value: 'Libre (cualquier controlador/radiocontrol)' },
      { label: 'Motores (categoría colegial)', value: 'Obligatorio: motores amarillos TT' }
    ],
    description: 'Robot de competencia para la categoría Soccer, que se juega 2 vs 2. Se arma con las piezas impresas en 3D de esta página más los componentes electrónicos: 2 motores amarillos TT, un puente H Virtus Model 1, batería (Ion Litio o LiPo de hasta 3 celdas), receptor de radiocontrol e interruptor.',
    steps: [
      'Descarga los archivos de impresión 3D desde el botón de Google Drive de esta página.',
      'Imprime todas las piezas en 3D.',
      'Consigue los componentes electrónicos: 2 motores amarillos TT, un puente H Virtus Model 1, una batería (Ion Litio o LiPo de hasta 3 celdas), el receptor del radiocontrol y un interruptor.',
      'Arma la carcasa y la estructura con las piezas impresas.',
      'Conecta los componentes siguiendo el diagrama de conexiones de la galería de fotos.',
      'Verifica que el robot no supere los 15 x 15 cm ni los 500 g de peso.',
      'Prueba los motores y la respuesta del control remoto antes de la competencia.'
    ],
    driveLink: ''
  },
  {
    id: 'mini-sumo-rc',
    name: 'Robot Mini Sumo Virtus RC',
    category: 'Mini Sumo (control remoto)',
    icon: 'fa-gamepad',
    image: '',
    gallery: [],
    description: 'Contenido en preparación.',
    steps: [],
    driveLink: ''
  },
  {
    id: 'insecto',
    name: 'Robot Insecto Virtus',
    category: 'Robot caminante',
    icon: 'fa-spider',
    image: '',
    gallery: [],
    description: 'Contenido en preparación.',
    steps: [],
    driveLink: ''
  },
  {
    id: 'trepador',
    name: 'Robot Trepador Virtus',
    category: 'Trepador',
    icon: 'fa-arrow-up-right-dots',
    image: '',
    gallery: [],
    description: 'Contenido en preparación.',
    steps: [],
    driveLink: ''
  },
  {
    id: 'bailarin',
    name: 'Robot Bailarín Virtus',
    category: 'Bailarín',
    icon: 'fa-music',
    image: '',
    gallery: [],
    description: 'Contenido en preparación.',
    steps: [],
    driveLink: ''
  }
];
