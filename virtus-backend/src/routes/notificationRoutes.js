const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const Notification = require('../models/Notification');

router.use(authMiddleware);

router.get('/', async (req, res) => {
    try {
        const notifications = await Notification.getForUser(req.user.id, 30);
        const unreadCount = await Notification.getUnreadCount(req.user.id);
        res.json({ notifications, unreadCount });
    } catch (error) {
        console.error('Error al obtener notificaciones:', error.message);
        res.status(500).json({ message: 'Error al obtener notificaciones' });
    }
});

router.put('/:id/read', async (req, res) => {
    try {
        const updated = await Notification.markRead(req.params.id, req.user.id);
        if (!updated) {
            return res.status(404).json({ message: 'Notificacion no encontrada' });
        }
        res.json({ message: 'Notificacion marcada como leida' });
    } catch (error) {
        console.error('Error al marcar notificacion:', error.message);
        res.status(500).json({ message: 'Error al marcar la notificacion' });
    }
});

router.put('/read-all', async (req, res) => {
    try {
        await Notification.markAllRead(req.user.id);
        res.json({ message: 'Notificaciones marcadas como leidas' });
    } catch (error) {
        console.error('Error al marcar notificaciones:', error.message);
        res.status(500).json({ message: 'Error al marcar las notificaciones' });
    }
});

module.exports = router;
