const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { upload } = require('../config/cloudinary');

// Subir foto de perfil
router.post('/profile-photo', authMiddleware, upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No se subió ninguna foto' });
        }

        const userId = req.user.id;
        const photoUrl = req.file.path; // Cloudinary ya devuelve la URL

        console.log(`📸 Subiendo foto para usuario ${userId}:`, photoUrl);

        // Obtener foto anterior para eliminarla (opcional)
        const [oldPhoto] = await db.pool.query(
            'SELECT profile_photo FROM users WHERE id = ?',
            [userId]
        );

        // Si tenía foto anterior y no es la misma, eliminarla de Cloudinary
        if (oldPhoto[0]?.profile_photo) {
            try {
                const publicId = oldPhoto[0].profile_photo.split('/').pop().split('.')[0];
                const folderPath = 'roboworks-profiles';
                await cloudinary.uploader.destroy(`${folderPath}/${publicId}`);
                console.log('🗑️ Foto anterior eliminada');
            } catch (e) {
                console.log('No se pudo eliminar foto anterior:', e.message);
            }
        }

        // Actualizar URL en la base de datos
        await db.pool.query(
            'UPDATE users SET profile_photo = ? WHERE id = ?',
            [photoUrl, userId]
        );

        res.json({ 
            message: 'Foto subida exitosamente',
            photoUrl: photoUrl
        });

    } catch (error) {
        console.error('❌ Error al subir foto:', error);
        res.status(500).json({ message: 'Error al subir foto: ' + error.message });
    }
});

// Eliminar foto de perfil
router.delete('/profile-photo', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        // Obtener foto actual
        const [user] = await db.pool.query(
            'SELECT profile_photo FROM users WHERE id = ?',
            [userId]
        );

        if (user[0]?.profile_photo) {
            // Extraer public_id de Cloudinary
            const publicId = user[0].profile_photo.split('/').pop().split('.')[0];
            
            // Eliminar de Cloudinary
            const cloudinary = require('../config/cloudinary').cloudinary;
            await cloudinary.uploader.destroy(`roboworks-profiles/${publicId}`);
            console.log('🗑️ Foto eliminada de Cloudinary');
        }

        // Actualizar base de datos
        await db.pool.query(
            'UPDATE users SET profile_photo = NULL WHERE id = ?',
            [userId]
        );

        res.json({ message: 'Foto eliminada exitosamente' });

    } catch (error) {
        console.error('❌ Error al eliminar foto:', error);
        res.status(500).json({ message: 'Error al eliminar foto' });
    }
});

module.exports = router;