const jwt = require('jsonwebtoken');

jest.mock('../src/config/database', () => ({ pool: { query: jest.fn() } }));
const db = require('../src/config/database');
const authMiddleware = require('../src/middleware/auth');

function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

function dbUser(overrides = {}) {
    db.pool.query.mockResolvedValue([[{ id: 1, tenant_id: 1, role: 'student', is_active: 1, token_version: 0, ...overrides }]]);
}

async function run(token) {
    const req = { cookies: token ? { token } : {} };
    const res = mockRes();
    const next = jest.fn();
    await authMiddleware(req, res, next);
    return { req, res, next };
}

describe('authMiddleware', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
        process.env = { ...OLD_ENV, JWT_SECRET: 'secreto-actual', JWT_SECRET_PREVIOUS: 'secreto-anterior' };
        db.pool.query.mockReset();
        authMiddleware.invalidateUserCache(1);
        authMiddleware.invalidateUserCache(2);
    });

    afterEach(() => { process.env = OLD_ENV; });

    test('sin cookie de sesion responde 401', async () => {
        const { next, res } = await run(null);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
    });

    test('token valido: deja pasar y llena req.user', async () => {
        dbUser();
        const { req, next } = await run(jwt.sign({ id: 1, role: 'student', tv: 0 }, 'secreto-actual'));
        expect(next).toHaveBeenCalled();
        expect(req.user.id).toBe(1);
        expect(req.user.role).toBe('student');
    });

    test('token firmado con secreto desconocido es rechazado', async () => {
        const { next, res } = await run(jwt.sign({ id: 1 }, 'otro-secreto'));
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
    });

    test('token con JWT_SECRET_PREVIOUS (rotacion) sigue aceptado', async () => {
        dbUser({ id: 2, role: 'teacher' });
        const { req, next } = await run(jwt.sign({ id: 2, role: 'teacher', tv: 0 }, 'secreto-anterior'));
        expect(next).toHaveBeenCalled();
        expect(req.user.id).toBe(2);
    });

    test('token expirado es rechazado', async () => {
        const { next, res } = await run(jwt.sign({ id: 1 }, 'secreto-actual', { expiresIn: -10 }));
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
    });

    test('token con algoritmo "none" es rechazado', async () => {
        const forged = jwt.sign({ id: 1, role: 'super_admin' }, '', { algorithm: 'none' });
        const { next, res } = await run(forged);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
    });

    test('token_version distinta (sesion revocada) es rechazada', async () => {
        dbUser({ token_version: 3 });
        const { next, res } = await run(jwt.sign({ id: 1, role: 'student', tv: 2 }, 'secreto-actual'));
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
    });

    test('usuario desactivado es rechazado', async () => {
        dbUser({ is_active: 0 });
        const { next, res } = await run(jwt.sign({ id: 1, role: 'student', tv: 0 }, 'secreto-actual'));
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
    });

    test('usuario inexistente es rechazado', async () => {
        db.pool.query.mockResolvedValue([[]]);
        const { next, res } = await run(jwt.sign({ id: 1, tv: 0 }, 'secreto-actual'));
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
    });

    test('el rol sale de la BD, no del token (sin escalada de privilegios)', async () => {
        dbUser({ role: 'student' });
        const { req, next } = await run(jwt.sign({ id: 1, role: 'super_admin', tv: 0 }, 'secreto-actual'));
        expect(next).toHaveBeenCalled();
        expect(req.user.role).toBe('student');
    });

    test('antes de migrar (columna ausente) degrada a validar solo el JWT', async () => {
        db.pool.query.mockRejectedValue(Object.assign(new Error('x'), { code: 'ER_BAD_FIELD_ERROR' }));
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        const { req, next } = await run(jwt.sign({ id: 1, role: 'student' }, 'secreto-actual'));
        expect(next).toHaveBeenCalled();
        expect(req.user.id).toBe(1);
    });

    test('error de BD distinto responde 500 y no deja pasar', async () => {
        db.pool.query.mockRejectedValue(new Error('conexion'));
        jest.spyOn(console, 'error').mockImplementation(() => {});
        const { next, res } = await run(jwt.sign({ id: 1, tv: 0 }, 'secreto-actual'));
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(500);
    });
});
