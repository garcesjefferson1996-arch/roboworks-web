const jwt = require('jsonwebtoken');
const db = require('../config/database');

const VERIFY_OPTIONS = { algorithms: ['HS256'] };

// Cache corto del estado del usuario para no consultar la BD en cada peticion.
// La revocacion de sesion tarda como maximo CACHE_TTL_MS en aplicarse (y es
// inmediata en la misma instancia porque se invalida al revocar).
const CACHE_TTL_MS = 10 * 1000;
const stateCache = new Map();

function invalidateUserCache(userId) {
    stateCache.delete(Number(userId));
}

function verifyJwt(token) {
    try {
        return jwt.verify(token, process.env.JWT_SECRET, VERIFY_OPTIONS);
    } catch (primaryError) {
        if (process.env.JWT_SECRET_PREVIOUS) {
            try {
                return jwt.verify(token, process.env.JWT_SECRET_PREVIOUS, VERIFY_OPTIONS);
            } catch (fallbackError) {
                // cae al null de abajo
            }
        }
        return null;
    }
}

async function loadUserState(userId) {
    const key = Number(userId);
    const cached = stateCache.get(key);
    if (cached && cached.expires > Date.now()) return cached.state;

    const [rows] = await db.pool.query(
        'SELECT id, tenant_id, role, is_active, token_version FROM users WHERE id = ?',
        [key]
    );
    const state = rows[0] || null;
    stateCache.set(key, { state, expires: Date.now() + CACHE_TTL_MS });
    return state;
}

const authMiddleware = async (req, res, next) => {
    const token = req.cookies && req.cookies.token;

    if (!token) {
        return res.status(401).json({ message: 'No autorizado - sesion no iniciada' });
    }

    const payload = verifyJwt(token);
    if (!payload) {
        return res.status(401).json({ message: 'No autorizado - sesion invalida o expirada' });
    }

    try {
        const state = await loadUserState(payload.id);

        // Usuario borrado o desactivado: la sesion deja de valer al instante.
        if (!state || !state.is_active) {
            return res.status(401).json({ message: 'No autorizado - cuenta inactiva' });
        }

        // Tokens emitidos antes de esta mejora no traen "tv": equivalen a la version 0.
        if ((payload.tv || 0) !== (state.token_version || 0)) {
            return res.status(401).json({ message: 'No autorizado - sesion revocada, inicia sesion de nuevo' });
        }

        // El rol y el tenant salen de la BD, no del token: un cambio de rol
        // aplica de inmediato y un token viejo no puede conservar privilegios.
        req.user = { ...payload, role: state.role, tenant_id: state.tenant_id };
        return next();
    } catch (error) {
        // Antes de aplicar la migracion la columna token_version no existe.
        // Solo en ese caso se degrada a validar el JWT, para no tumbar el login.
        if (error.code === 'ER_BAD_FIELD_ERROR') {
            console.warn('auth: falta users.token_version, validando solo JWT hasta migrar');
            req.user = payload;
            return next();
        }
        console.error('Error verificando sesion:', error.message);
        return res.status(500).json({ message: 'Error del servidor' });
    }
};

module.exports = authMiddleware;
module.exports.invalidateUserCache = invalidateUserCache;
module.exports.verifyJwt = verifyJwt;
