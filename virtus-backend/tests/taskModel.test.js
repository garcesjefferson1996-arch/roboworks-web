jest.mock('../src/config/database', () => ({
    pool: { query: jest.fn() }
}));
const db = require('../src/config/database');
const { TaskSubmission } = require('../src/models/Task');

describe('TaskSubmission.upsert', () => {
    beforeEach(() => {
        db.pool.query.mockReset();
    });

    test('crea una entrega nueva si el estudiante no habia entregado antes', async () => {
        db.pool.query
            .mockResolvedValueOnce([[]]) // getByTaskAndStudent -> no existe
            .mockResolvedValueOnce([{ insertId: 55 }]); // INSERT

        const id = await TaskSubmission.upsert({
            task_id: 1, student_id: 7, submission_type: 'text', text_content: 'mi respuesta'
        });

        expect(id).toBe(55);
    });

    test('permite reemplazar una entrega que TODAVIA no fue calificada', async () => {
        db.pool.query
            .mockResolvedValueOnce([[{ id: 20, score: null }]]) // getByTaskAndStudent -> existe, sin nota
            .mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE

        const id = await TaskSubmission.upsert({
            task_id: 1, student_id: 7, submission_type: 'text', text_content: 'version corregida'
        });

        expect(id).toBe(20);
    });

    test('bloquea el re-envio si la entrega YA fue calificada (protege la nota del estudiante)', async () => {
        db.pool.query.mockResolvedValueOnce([[{ id: 20, score: 9.5 }]]); // getByTaskAndStudent -> ya calificada

        await expect(TaskSubmission.upsert({
            task_id: 1, student_id: 7, submission_type: 'text', text_content: 'intento de cambiar la respuesta'
        })).rejects.toMatchObject({ code: 'ALREADY_GRADED' });
    });
});
