const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

// Validaciones
const loginValidation = [
    body('username').notEmpty().withMessage('Usuario requerido'),
    body('password').notEmpty().withMessage('Contraseña requerida')
];

const changePasswordValidation = [
    body('currentPassword').notEmpty().withMessage('Contraseña actual requerida'),
    body('newPassword').isLength({ min: 6 }).withMessage('La nueva contraseña debe tener al menos 6 caracteres')
];

// Rutas públicas
router.post('/login', loginValidation, authController.login);
router.post('/logout', authController.logout);

// Rutas protegidas (requieren autenticación)
router.get('/verify', authMiddleware, authController.verifySession);
router.post('/change-password', authMiddleware, changePasswordValidation, authController.changePassword);

module.exports = router;