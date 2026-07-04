const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

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

module.exports = { cloudinary, uploadProfilePhoto, uploadMaterial };
