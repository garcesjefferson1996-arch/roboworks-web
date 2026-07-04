// Verifica que los endpoints nuevos de navegacion por grado del docente
// (GET /api/teacher/grades y GET /api/teacher/grades/:id/lessons) esten
// correctamente protegidos por authMiddleware, igual que el resto del
// panel de docente.
process.env.JWT_SECRET = 'test-secret';

jest.mock('../src/config/database', () => ({
    pool: { query: jest.fn() }
}));

const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const teacherRoutes = require('../src/routes/teacherRoutes');

function buildApp() {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/teacher', teacherRoutes);
    return app;
}

test('GET /api/teacher/grades sin auth -> 401', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/teacher/grades');
    expect(res.status).toBe(401);
});

test('GET /api/teacher/grades/1/lessons sin auth -> 401', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/teacher/grades/1/lessons');
    expect(res.status).toBe(401);
});
