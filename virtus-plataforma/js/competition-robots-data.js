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
window.VIRTUS_COMPETITION_ROBOTS = [
  {
    id: 'soccer',
    name: 'Robot Soccer Virtus',
    category: 'Fútbol de robots',
    icon: 'fa-futbol',
    image: '',
    gallery: [],
    description: 'Contenido en preparación.',
    steps: [],
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
