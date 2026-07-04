const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { uploadProfilePhoto, cloudinary } = require('../config/cloudinary');

router.use(authMiddleware);

const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Demasiadas subidas en poco tiempo. Espera unos minutos.' }
});

router.post('/profile-photo', uploadLimiter, uploadProfilePhoto.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No se subio ninguna foto' });
        }

        const userId = req.user.id;
        const photoUrl = req.file.path;

        const [oldPhoto] = await db.pool.query('SELECT profile_photo FROM users WHERE id = ?', [userId]);

        if (oldPhoto[0]?.profile_photo) {
            try {
                const publicId = oldPhoto[0].profile_photo.split('/').pop().split('.')[0];
                await cloudinary.uploader.destroy(`virtus-profiles/${publicId}`);
            } catch (e) {
                console.warn('No se pudo eliminar la foto anterior:', e.message);
            }
        }

        await db.pool.query('UPDATE users SET profile_photo = ? WHERE id = ?', [photoUrl, userId]);

        res.json({ message: 'Foto subida exitosamente', photoUrl });
    } catch (error) {
        console.error('Error al subir foto:', error.message);
        res.status(500).json({ message: 'Error al subir la foto' });
    }
});

router.delete('/profile-photo', async (req, res) => {
    try {
        const userId = req.user.id;
        const [user] = await db.pool.query('SELECT profile_photo FROM users WHERE id = ?', [userId]);

        if (user[0]?.profile_photo) {
            const publicId = user[0].profile_photo.split('/').pop().split('.')[0];
            await cloudinary.uploader.destroy(`virtus-profiles/${publicId}`);
        }

        await db.pool.query('UPDATE users SET profile_photo = NULL WHERE id = ?', [userId]);
        res.json({ message: 'Foto eliminada exitosamente' });
    } catch (error) {
        console.error('Error al eliminar foto:', error.message);
        res.status(500).json({ message: 'Error al eliminar la foto' });
    }
});

module.exports = router;
