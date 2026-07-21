const db = require('../config/database');

// Campos de planificacion pedagogica que se guardan como JSON (arrays de
// texto libre: objetivos, competencias, etc, o el objeto de paso a paso).
// mysql2 NO serializa arrays/objetos JS automaticamente al insertarlos como
// bind param (un array se convierte en lista SQL "a,b,c", no en JSON) asi
// que hay que stringificarlos a mano antes de cada INSERT/UPDATE.
const JSON_FIELDS = [
    'objetivos', 'competencias', 'destrezas', 'indicadores_evaluacion',
    'recursos_necesarios', 'materiales', 'kits', 'software_requerido', 'paso_a_paso'
];
function toJsonParam(value) {
    if (value === undefined) return undefined;
    if (value === null) return null;
    return JSON.stringify(value);
}

// Catálogo de grados escolares (ej. "5to de Básica"). Igual patrón que
// programs: catálogo global de Virtus, no pertenece a una institución.
class Grade {
    static async getAll() {
        const [rows] = await db.pool.query(`
            SELECT g.*, (SELECT COUNT(*) FROM grade_lessons WHERE grade_id = g.id) as total_lessons
            FROM grades g ORDER BY g.display_order, g.name
        `);
        return rows;
    }

    static async getById(id) {
        const [rows] = await db.pool.query('SELECT * FROM grades WHERE id = ?', [id]);
        return rows[0];
    }

    static async create({ name, display_order, description }) {
        const [result] = await db.pool.query(
            'INSERT INTO grades (name, display_order, description) VALUES (?, ?, ?)',
            [name, display_order || 0, description || null]
        );
        return result.insertId;
    }
}

// Lecciones del año para un grado (lo que Jeff llama "cada clase": video +
// recursos). Se crean una vez y se reutilizan con cualquier cohorte/año que
// tenga ese grado activado.
class GradeLesson {
    static async getByGrade(gradeId, includeInactive = false) {
        let query = 'SELECT * FROM grade_lessons WHERE grade_id = ?';
        if (!includeInactive) query += ' AND is_active = 1';
        query += ' ORDER BY lesson_number ASC';
        const [rows] = await db.pool.query(query, [gradeId]);
        return rows;
    }

    static async getById(id) {
        const [rows] = await db.pool.query('SELECT * FROM grade_lessons WHERE id = ?', [id]);
        return rows[0];
    }

    static async create({
        grade_id, lesson_number, trimester, title, description, lesson_plan, video_link,
        objetivos, competencias, destrezas, indicadores_evaluacion, tiempo_estimado,
        recursos_necesarios, materiales, kits, software_requerido,
        actividades, proyecto_descripcion, evaluacion_descripcion, tarea_descripcion, paso_a_paso
    }) {
        const [result] = await db.pool.query(
            `INSERT INTO grade_lessons (
                grade_id, lesson_number, trimester, title, description, lesson_plan, video_link,
                objetivos, competencias, destrezas, indicadores_evaluacion, tiempo_estimado,
                recursos_necesarios, materiales, kits, software_requerido,
                actividades, proyecto_descripcion, evaluacion_descripcion, tarea_descripcion, paso_a_paso
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                grade_id, lesson_number, trimester || null, title, description || null, lesson_plan || null, video_link || null,
                toJsonParam(objetivos) ?? null, toJsonParam(competencias) ?? null, toJsonParam(destrezas) ?? null,
                toJsonParam(indicadores_evaluacion) ?? null, tiempo_estimado || null,
                toJsonParam(recursos_necesarios) ?? null, toJsonParam(materiales) ?? null,
                toJsonParam(kits) ?? null, toJsonParam(software_requerido) ?? null,
                actividades || null, proyecto_descripcion || null, evaluacion_descripcion || null,
                tarea_descripcion || null, toJsonParam(paso_a_paso) ?? null
            ]
        );
        return result.insertId;
    }

    static async update(id, {
        title, description, lesson_plan, video_link, lesson_number, trimester, is_active,
        objetivos, competencias, destrezas, indicadores_evaluacion, tiempo_estimado,
        recursos_necesarios, materiales, kits, software_requerido,
        actividades, proyecto_descripcion, evaluacion_descripcion, tarea_descripcion, paso_a_paso
    }) {
        const [result] = await db.pool.query(
            `UPDATE grade_lessons SET
                title = COALESCE(?, title),
                description = COALESCE(?, description),
                lesson_plan = COALESCE(?, lesson_plan),
                video_link = COALESCE(?, video_link),
                lesson_number = COALESCE(?, lesson_number),
                trimester = COALESCE(?, trimester),
                is_active = COALESCE(?, is_active),
                objetivos = COALESCE(?, objetivos),
                competencias = COALESCE(?, competencias),
                destrezas = COALESCE(?, destrezas),
                indicadores_evaluacion = COALESCE(?, indicadores_evaluacion),
                tiempo_estimado = COALESCE(?, tiempo_estimado),
                recursos_necesarios = COALESCE(?, recursos_necesarios),
                materiales = COALESCE(?, materiales),
                kits = COALESCE(?, kits),
                software_requerido = COALESCE(?, software_requerido),
                actividades = COALESCE(?, actividades),
                proyecto_descripcion = COALESCE(?, proyecto_descripcion),
                evaluacion_descripcion = COALESCE(?, evaluacion_descripcion),
                tarea_descripcion = COALESCE(?, tarea_descripcion),
                paso_a_paso = COALESCE(?, paso_a_paso)
             WHERE id = ?`,
            [
                title, description, lesson_plan, video_link, lesson_number, trimester, is_active,
                toJsonParam(objetivos), toJsonParam(competencias), toJsonParam(destrezas),
                toJsonParam(indicadores_evaluacion), tiempo_estimado,
                toJsonParam(recursos_necesarios), toJsonParam(materiales),
                toJsonParam(kits), toJsonParam(software_requerido),
                actividades, proyecto_descripcion, evaluacion_descripcion, tarea_descripcion,
                toJsonParam(paso_a_paso),
                id
            ]
        );
        return result.affectedRows > 0;
    }

    static async delete(id) {
        const [result] = await db.pool.query('DELETE FROM grade_lessons WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    // PDF (u otro archivo) de planificacion, aparte del texto libre en
    // lesson_plan y de los recursos sueltos de la leccion. Reemplaza el
    // archivo anterior si ya habia uno (Cloudinary conserva ambos, pero solo
    // el mas reciente queda enlazado desde la leccion).
    static async setPlanFile(id, { file_url, file_name }) {
        const [result] = await db.pool.query(
            'UPDATE grade_lessons SET lesson_plan_file_url = ?, lesson_plan_file_name = ? WHERE id = ?',
            [file_url, file_name, id]
        );
        return result.affectedRows > 0;
    }

    static async removePlanFile(id) {
        const [result] = await db.pool.query(
            'UPDATE grade_lessons SET lesson_plan_file_url = NULL, lesson_plan_file_name = NULL WHERE id = ?',
            [id]
        );
        return result.affectedRows > 0;
    }
}

// Recursos de una lección (imágenes, PDFs, links adicionales al video).
class LessonResource {
    static async getByLesson(lessonId) {
        const [rows] = await db.pool.query(
            'SELECT * FROM lesson_resources WHERE lesson_id = ? ORDER BY display_order ASC, id ASC',
            [lessonId]
        );
        return rows;
    }

    static async create({ lesson_id, title, resource_type, file_url, file_name, external_link, display_order }) {
        const [result] = await db.pool.query(
            `INSERT INTO lesson_resources (lesson_id, title, resource_type, file_url, file_name, external_link, display_order)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [lesson_id, title, resource_type, file_url || null, file_name || null, external_link || null, display_order || 0]
        );
        return result.insertId;
    }

    static async delete(id) {
        const [result] = await db.pool.query('DELETE FROM lesson_resources WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    static async getLessonOwner(resourceId) {
        const [rows] = await db.pool.query(
            'SELECT lesson_id FROM lesson_resources WHERE id = ?',
            [resourceId]
        );
        return rows[0] || null;
    }
}

// Devuelve las lecciones (con sus recursos) del grado activado en una clase.
// Se usa tanto para docente como para estudiante, ya con el chequeo de
// pertenencia/inscripción resuelto por el caller.
async function getLessonsForClass(classId) {
    const [classRows] = await db.pool.query('SELECT grade_id FROM classes WHERE id = ?', [classId]);
    if (classRows.length === 0 || !classRows[0].grade_id) return { grade: null, lessons: [] };

    const gradeId = classRows[0].grade_id;
    const grade = await Grade.getById(gradeId);
    const lessons = await GradeLesson.getByGrade(gradeId, false);

    for (const lesson of lessons) {
        lesson.resources = await LessonResource.getByLesson(lesson.id);
    }

    return { grade, lessons };
}

module.exports = { Grade, GradeLesson, LessonResource, getLessonsForClass };
