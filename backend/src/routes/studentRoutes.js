const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

// Todas las rutas de estudiantes requieren autenticación
router.use(authMiddleware);

// Obtener perfil del estudiante
router.get('/profile', (req, res) => {
    res.json({ message: 'Perfil de estudiante - en construcción' });
});

// Obtener próxima clase
router.get('/next-class', (req, res) => {
    res.json({ message: 'Próxima clase - en construcción' });
});

// Obtener historial
router.get('/history', (req, res) => {
    res.json({ message: 'Historial - en construcción' });
});

module.exports = router;