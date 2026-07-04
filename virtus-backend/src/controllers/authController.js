const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { verifyToken: verifyTotp } = require('../utils/totp');
const { logAction } = require('../utils/audit');

const isProd = process.env.NODE_ENV === 'production';
const ADMIN_ROLES = ['super_admin', 'academy_admin'];

function cookieOptions() {
    return {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/',
        domain: process.env.COOKIE_DOMAIN || undefined
    };
}

class AuthController {
    async login(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { username, password, totp_code } = req.body;

            const user = await User.findByUsername(username);
            if (!user) {
                return res.status(401).json({ message: 'Usuario o contrasena incorrectos' });
            }

            if (User.isLocked(user)) {
                const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
                return res.status(423).json({
                    message: `Cuenta bloqueada temporalmente por multiples intentos fallidos. Intenta de nuevo en ${minutesLeft} minuto(s).`
                });
            }

            const isValid = await User.validatePassword(password, user.password_hash);
            if (!isValid) {
                const result = await User.registerFailedLogin(user.id, user.failed_login_attempts);
                await logAction({
                    tenantId: user.tenant_id, actorId: user.id, actorRole: user.role,
                    action: result.locked ? 'login_locked' : 'login_failed',
                    targetType: 'user', targetId: user.id, ip: req.ip
                });
                return res.status(401).json({ message: 'Usuario o contrasena incorrectos' });
            }

            if (ADMIN_ROLES.includes(user.role)) {
                if (!user.totp_enabled) {
                    return res.status(428).json({
                        message: 'Tu cuenta requiere configurar verificacion en dos pasos antes de continuar.',
                        requiresTotpSetup: true
                    });
                }

                if (!totp_code) {
                    return res.status(200).json({ requiresTotp: true });
                }

                const totpValid = verifyTotp(totp_code, user.totp_secret);
                if (!totpValid) {
                    const result = await User.registerFailedLogin(user.id, user.failed_login_attempts);
                    await logAction({
                        tenantId: user.tenant_id, actorId: user.id, actorRole: user.role,
                        action: result.locked ? 'login_locked' : '2fa_failed',
                        targetType: 'user', targetId: user.id, ip: req.ip
                    });
                    return res.status(401).json({ message: 'Codigo de verificacion incorrecto' });
                }
            }

            await User.resetFailedLogins(user.id);

            const token = jwt.sign(
                {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    tenant_id: user.tenant_id
                },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
            );

            res.cookie('token', token, cookieOptions());

            await logAction({
                tenantId: user.tenant_id, actorId: user.id, actorRole: user.role,
                action: 'login_success', targetType: 'user', targetId: user.id, ip: req.ip
            });

            res.json({
                message: 'Login exitoso',
                user: {
                    id: user.id,
                    username: user.username,
                    full_name: user.full_name,
                    role: user.role,
                    profile_photo: user.profile_photo,
                    temporary_password: !!user.temporary_password
                }
            });
        } catch (error) {
            console.error('Error en login:', error.message);
            res.status(500).json({ message: 'Error en el servidor' });
        }
    }

    async logout(req, res) {
        try {
            res.clearCookie('token', cookieOptions());
            res.json({ message: 'Logout exitoso' });
        } catch (error) {
            console.error('Error en logout:', error.message);
            res.status(500).json({ message: 'Error en el servidor' });
        }
    }

    async changePassword(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { currentPassword, newPassword } = req.body;
            const userId = req.user.id;

            const user = await User.findById(userId, true);
            if (!user) {
                return res.status(404).json({ message: 'Usuario no encontrado' });
            }

            const isValid = await User.validatePassword(currentPassword, user.password_hash);
            if (!isValid) {
                return res.status(401).json({ message: 'Contrasena actual incorrecta' });
            }

            const changed = await User.changePassword(userId, newPassword);
            if (changed) {
                await logAction({
                    tenantId: user.tenant_id, actorId: user.id, actorRole: user.role,
                    action: 'password_changed', targetType: 'user', targetId: user.id, ip: req.ip
                });
                res.json({ message: 'Contrasena actualizada exitosamente' });
            } else {
                res.status(400).json({ message: 'No se pudo cambiar la contrasena' });
            }
        } catch (error) {
            console.error('Error en changePassword:', error.message);
            res.status(500).json({ message: 'Error en el servidor' });
        }
    }

    async verifySession(req, res) {
        try {
            if (!req.user?.id) {
                return res.status(401).json({ message: 'No autorizado' });
            }

            const user = await User.findById(req.user.id);
            if (!user) {
                return res.status(401).json({ message: 'Sesion no valida' });
            }

            res.json({
                user: {
                    id: user.id,
                    username: user.username,
                    full_name: user.full_name,
                    role: user.role,
                    profile_photo: user.profile_photo,
                    temporary_password: !!user.temporary_password
                }
            });
        } catch (error) {
            console.error('Error en verifySession:', error.message);
            res.status(500).json({ message: 'Error en el servidor' });
        }
    }
}

module.exports = new AuthController();
