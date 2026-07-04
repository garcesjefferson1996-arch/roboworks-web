// Prueba de integracion end-to-end (via supertest, sin servidor real ni
// base de datos real) del endpoint GET /api/classes/:classId - el mismo
// endpoint donde se encontro y corrigio la fuga IDOR original (un
// academy_admin podia leer clases de OTRA institucion con solo cambiar el
// id en la URL). Esto asegura que esa proteccion no se rompa sin que nos
// demos cuenta en un cambio futuro.
process.env.JWT_SECRET = 'test-secret';

jest.mock('../src/config/database', () => ({
    pool: { query: jest.fn() }
}));

const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const db = require('../src/config/database');
const classRoutes = require('../src/routes/classRoutes');

function buildApp() {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/classes', classRoutes);
    return app;
}

function tokenFor(user) {
    return jwt.sign(user, 'test-secret');
}

describe('GET /api/classes/:classId (aislamiento por institucion)', () => {
    beforeEach(() => {
        db.pool.query.mockReset();
    });

    test('academy_admin de la institucion 1 NO puede leer una clase de la institucion 2 (403)', async () => {
        db.pool.query.mockResolvedValueOnce([[{ id: 50, tenant_id: 2, teacher_id: null, name: 'Clase ajena' }]]);

        const app = buildApp();
        const token = tokenFor({ id: 5, role: 'academy_admin', tenant_id: 1 });

        const res = await request(app)
            .get('/api/classes/50')
            .set('Cookie', [`token=${token}`]);

        expect(res.status).toBe(403);
    });

    test('academy_admin de la MISMA institucion si puede leer la clase (200)', async () => {
        db.pool.query.mockResolvedValueOnce([[{ id: 51, tenant_id: 1, teacher_id: null, name: 'Clase propia' }]]);

        const app = buildApp();
        const token = tokenFor({ id: 5, role: 'academy_admin', tenant_id: 1 });

        const res = await request(app)
            .get('/api/classes/51')
            .set('Cookie', [`token=${token}`]);

        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Clase propia');
    });

    test('un docente que no dicta la clase recibe 403', async () => {
        db.pool.query.mockResolvedValueOnce([[{ id: 52, tenant_id: 1, teacher_id: 999, name: 'Clase de otro profe' }]]);

        const app = buildApp();
        const token = tokenFor({ id: 7, role: 'teacher', tenant_id: 1 });

        const res = await request(app)
            .get('/api/classes/52')
            .set('Cookie', [`token=${token}`]);

        expect(res.status).toBe(403);
    });

    test('sin cookie de sesion, responde 401 antes de tocar la base de datos', async () => {
        const app = buildApp();

        const res = await request(app).get('/api/classes/1');

        expect(res.status).toBe(401);
        expect(db.pool.query).not.toHaveBeenCalled();
    });
});
