const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const path = require('path');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Fotos de perfil: carpeta propia de Virtus (independiente de roboworks-profiles)
const profileStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'virtus-profiles',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        transformation: [
            { width: 300, height: 300, crop: 'limit' },
            { quality: 'auto' }
        ]
    }
});

const uploadProfilePhoto = multer({
    storage: profileStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten imágenes'), false);
        }
    }
});

// Materiales de clase: permite documentos, no solo imágenes
const materialStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'virtus-materials',
        resource_type: 'auto', // permite pdf, doc, ppt, imágenes, etc.
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'zip']
    }
});

const uploadMaterial = multer({
    storage: materialStorage,
    limits: { fileSize: 25 * 1024 * 1024 } // 25MB, ajustar según necesidad real
});

// Archivos de Robótica de Competencia: STL, código fuente, diagramas de conexión.
// resource_type 'raw' porque Cloudinary no reconoce .stl/.ino/.cpp/.py como
// "allowed_formats" de imagen/documento; con 'raw' acepta cualquier extensión
// y la validación real de tipo la hace el fileFilter de abajo.
const robotFileStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'virtus-robotics',
        resource_type: 'raw',
        use_filename: true,
        unique_filename: true
    }
});

const ALLOWED_ROBOT_FILE_EXT = [
    '.stl', '.obj', '.step', '.stp',
    '.ino', '.cpp', '.c', '.h', '.py', '.txt', '.md',
    '.pdf', '.jpg', '.jpeg', '.png', '.webp', '.zip', '.fzz'
];

const uploadRobotFile = multer({
    storage: robotFileStorage,
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ALLOWED_ROBOT_FILE_EXT.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de archivo no permitido. Usa STL/OBJ/STEP, código (.ino/.cpp/.c/.h/.py/.txt), PDF, imágenes, .zip o .fzz'), false);
        }
    }
});

module.exports = { cloudinary, uploadProfilePhoto, uploadMaterial, uploadRobotFile };
