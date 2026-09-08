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

// Materiales de clase: permite documentos, no solo imágenes.
// Office (.pptx/.docx/.xlsx) y .zip van como resource_type 'raw' por el mismo
// motivo documentado abajo en los archivos de robótica: Cloudinary sube esos
// formatos como "raw" y ahí NO valida contra allowed_formats, así que la
// combinación 'auto' + allowed_formats los rechazaba. Imágenes y PDF se quedan
// en 'auto' (Cloudinary los trata como image) para no cambiar las URLs ya
// guardadas ni la transformación q_auto de los PDF de planificación.
const MATERIAL_RAW_EXT = ['.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.zip'];
const ALLOWED_MATERIAL_EXT = [
    '.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf',
    ...MATERIAL_RAW_EXT
];

const materialStorage = new CloudinaryStorage({
    cloudinary,
    params: (req, file) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const isRaw = MATERIAL_RAW_EXT.includes(ext);
        const params = {
            folder: 'virtus-materials',
            resource_type: isRaw ? 'raw' : 'auto'
        };
        // En 'raw' el public_id debe conservar la extensión, si no la URL
        // resultante no se puede abrir/descargar correctamente.
        if (isRaw) {
            params.use_filename = true;
            params.unique_filename = true;
        }
        return params;
    }
});

const uploadMaterial = multer({
    storage: materialStorage,
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB, ajustar según necesidad real
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ALLOWED_MATERIAL_EXT.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de archivo no permitido. Usa PDF, Word, PowerPoint, Excel, imágenes o .zip'), false);
        }
    }
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
