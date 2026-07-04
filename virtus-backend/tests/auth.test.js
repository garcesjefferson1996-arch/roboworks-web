const jwt = require('jsonwebtoken');
const authMiddleware = require('../src/middleware/auth');

function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

describe('authMiddleware', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
        process.env = { ...OLD_ENV, JWT_SECRET: 'secreto-actual', JWT_SECRET_PREVIOUS: 'secreto-anterior' };
    });

    afterEach(() => {
        process.env = OLD_ENV;
    });

    test('sin cookie de sesion responde 401', () => {
        const req = { cookies: {} };
        const res = mockRes();
        const next = jest.fn();

        authMiddleware(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
    });

    test('con un token valido firmado con JWT_SECRET, deja pasar y llena req.user', () => {
        const token = jwt.sign({ id: 1, role: 'student' }, 'secreto-actual');
        const req = { cookies: { token } };
        const res = mockRes();
        const next = jest.fn();

        authMiddleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.user.id).toBe(1);
        expect(req.user.role).toBe('student');
    });

    test('un token firmado con un secreto viejo NO soportado (rotacion) es rechazado', () => {
        const token = jwt.sign({ id: 1, role: 'student' }, 'secreto-que-no-es-ninguno-de-los-dos');
        const req = { cookies: { token } };
        const res = mockRes();
        const next = jest.fn();

        authMiddleware(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
    });

    test('un token firmado con JWT_SECRET_PREVIOUS (rotacion) todavia es aceptado', () => {
        const token = jwt.sign({ id: 2, role: 'teacher' }, 'secreto-anterior');
        const req = { cookies: { token } };
        const res = mockRes();
        const next = jest.fn();

        authMiddleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.user.id).toBe(2);
    });

    test('un token expirado es rechazado', () => {
        const token = jwt.sign({ id: 1, role: 'student' }, 'secreto-actual', { expiresIn: -10 });
        const req = { cookies: { token } };
        const res = mockRes();
        const next = jest.fn();

        authMiddleware(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
    });
});
