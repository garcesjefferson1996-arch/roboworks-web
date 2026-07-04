const { assertSameTenant, requireRole, requireAdminOrOwningTeacher } = require('../src/middleware/roles');

// db se mockea para no necesitar una base de datos real corriendo. Esto
// permite correr la suite en cualquier maquina (incluida CI) sin depender
// de MySQL.
jest.mock('../src/config/database', () => ({
    pool: { query: jest.fn() }
}));
const db = require('../src/config/database');

describe('assertSameTenant', () => {
    test('super_admin siempre pasa, sin importar el tenant del recurso', () => {
        expect(assertSameTenant({ role: 'super_admin', tenant_id: 1 }, 999)).toBe(true);
    });

    test('academy_admin solo pasa si el tenant coincide', () => {
        expect(assertSameTenant({ role: 'academy_admin', tenant_id: 1 }, 1)).toBe(true);
        expect(assertSameTenant({ role: 'academy_admin', tenant_id: 1 }, 2)).toBe(false);
    });

    test('teacher/student tambien se restringen por tenant_id', () => {
        expect(assertSameTenant({ role: 'teacher', tenant_id: 5 }, 5)).toBe(true);
        expect(assertSameTenant({ role: 'teacher', tenant_id: 5 }, 6)).toBe(false);
    });
});

describe('requireRole', () => {
    function mockRes() {
        const res = {};
        res.status = jest.fn().mockReturnValue(res);
        res.json = jest.fn().mockReturnValue(res);
        return res;
    }

    test('deja pasar si el rol esta permitido', () => {
        const req = { user: { role: 'teacher' } };
        const res = mockRes();
        const next = jest.fn();
        requireRole('teacher', 'academy_admin')(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    test('responde 403 si el rol no esta permitido', () => {
        const req = { user: { role: 'student' } };
        const res = mockRes();
        const next = jest.fn();
        requireRole('teacher', 'academy_admin')(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
    });

    test('responde 403 si no hay usuario en el request', () => {
        const req = {};
        const res = mockRes();
        const next = jest.fn();
        requireRole('teacher')(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
    });
});

describe('requireAdminOrOwningTeacher (proteccion IDOR sobre clases)', () => {
    function mockRes() {
        const res = {};
        res.status = jest.fn().mockReturnValue(res);
        res.json = jest.fn().mockReturnValue(res);
        return res;
    }

    beforeEach(() => {
        db.pool.query.mockReset();
    });

    test('academy_admin de OTRA institucion no puede acceder a la clase (403)', async () => {
        db.pool.query.mockResolvedValueOnce([[{ id: 10, tenant_id: 2, teacher_id: null }]]);

        const req = {
            user: { role: 'academy_admin', id: 5, tenant_id: 1 },
            params: { classId: '10' },
            body: {}
        };
        const res = mockRes();
        const next = jest.fn();

        await requireAdminOrOwningTeacher('classId')(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
    });

    test('academy_admin de la MISMA institucion si puede acceder', async () => {
        db.pool.query.mockResolvedValueOnce([[{ id: 10, tenant_id: 1, teacher_id: null }]]);

        const req = {
            user: { role: 'academy_admin', id: 5, tenant_id: 1 },
            params: { classId: '10' },
            body: {}
        };
        const res = mockRes();
        const next = jest.fn();

        await requireAdminOrOwningTeacher('classId')(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    test('un docente que NO es el dueño de la clase recibe 403', async () => {
        db.pool.query.mockResolvedValueOnce([[{ id: 10, tenant_id: 1, teacher_id: 99 }]]);

        const req = {
            user: { role: 'teacher', id: 42, tenant_id: 1 },
            params: { classId: '10' },
            body: {}
        };
        const res = mockRes();
        const next = jest.fn();

        await requireAdminOrOwningTeacher('classId')(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
    });

    test('super_admin siempre pasa sin importar el tenant', async () => {
        db.pool.query.mockResolvedValueOnce([[{ id: 10, tenant_id: 99, teacher_id: null }]]);

        const req = {
            user: { role: 'super_admin', id: 1, tenant_id: 1 },
            params: { classId: '10' },
            body: {}
        };
        const res = mockRes();
        const next = jest.fn();

        await requireAdminOrOwningTeacher('classId')(req, res, next);

        expect(next).toHaveBeenCalled();
    });

    test('responde 404 si la clase no existe', async () => {
        db.pool.query.mockResolvedValueOnce([[]]);

        const req = {
            user: { role: 'academy_admin', id: 5, tenant_id: 1 },
            params: { classId: '999' },
            body: {}
        };
        const res = mockRes();
        const next = jest.fn();

        await requireAdminOrOwningTeacher('classId')(req, res, next);

        expect(res.status).toHaveBeenCalledWith(404);
    });
});
