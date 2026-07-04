const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const User = require('../models/User');
const { generateSecret, verifyToken, buildQrCodeDataUrl } = require('../utils/totp');
const { logAction } = require('../utils/audit');

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Demasiados intentos de inicio de sesion. Intenta de nuevo en unos minutos.' }
});

const sensitiveActionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Demasiados intentos. Intenta de nuevo en unos minutos.' }
});

const loginValidation = [
    body('username').trim().notEmpty().withMessage('Usuario requerido'),
    body('password').notEmpty().withMessage('Contrasena requerida'),
    body('totp_code').optional({ checkFalsy: true }).isLength({ min: 6, max: 6 }).isNumeric()
];

const changePasswordValidation = [
    body('currentPassword').notEmpty().withMessage('Contrasena actual requerida'),
    body('newPassword')
        .isLength({ min: 8 }).withMessage('La nueva contrasena debe tener al menos 8 caracteres')
        .matches(/\d/).withMessage('La nueva contrasena debe incluir al menos un numero')
];

router.post('/login', loginLimiter, loginValidation, authController.login);
router.post('/logout', authController.logout);

router.get('/verify', authMiddleware, authController.verifySession);
router.post('/change-password', authMiddleware, sensitiveActionLimiter, changePasswordValidation, authController.changePassword);

router.post(
    '/2fa/setup',
    authMiddleware,
    requireRole('super_admin', 'academy_admin'),
    sensitiveActionLimiter,
    async (req, res) => {
        try {
            const secret = generateSecret();
            await User.setTotpSecret(req.user.id, secret);
            const qrCode = await buildQrCodeDataUrl(req.user.username, secret);
            res.json({ secret, qrCode });
        } catch (error) {
            console.error('Error generando 2FA:', error.message);
            res.status(500).json({ message: 'Error al generar la verificacion en dos pasos' });
        }
    }
);

router.post(
    '/2fa/verify-setup',
    authMiddleware,
    requireRole('super_admin', 'academy_admin'),
    sensitiveActionLimiter,
    [body('code').isLength({ min: 6, max: 6 }).isNumeric()],
    async (req, res) => {
        try {
            const user = await User.findById(req.user.id, true);
            if (!user?.totp_secret) {
                return res.status(400).json({ message: 'Primero solicita /2fa/setup' });
            }

            const valid = verifyToken(req.body.code, user.totp_secret);
            if (!valid) {
                return res.status(401).json({ message: 'Codigo incorrecto' });
            }

            await User.enableTotp(req.user.id);
            await logAction({
                tenantId: user.tenant_id, actorId: user.id, actorRole: user.role,
                action: '2fa_enabled', targetType: 'user', targetId: user.id, ip: req.ip
            });
            res.json({ message: 'Verificacion en dos pasos activada' });
        } catch (error) {
            console.error('Error verificando 2FA:', error.message);
            res.status(500).json({ message: 'Error al verificar el codigo' });
        }
    }
);

module.exports = router;
