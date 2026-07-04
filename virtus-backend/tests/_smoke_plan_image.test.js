// Verifica que el nuevo endpoint de subida de imagen para la
// planificacion (POST /api/curriculum/lessons/:id/plan-image) este
// protegido y correctamente montado.
process.env.JWT_SECRET = 'test-secret';

jest.mock('../src/config/database', () => ({
    pool: { query: jest.fn() }
}));

const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const curriculumRoutes = require('../src/routes/curriculumRoutes');

function buildApp() {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/curriculum', curriculumRoutes);
    return app;
}

test('POST /api/curriculum/lessons/1/plan-image sin auth -> 401', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/curriculum/lessons/1/plan-image');
    expect(res.status).toBe(401);
});
