const db = require('../config/database');

// Resumen de inicio del docente: lo urgente de un vistazo (clases de hoy,
// tareas con entregas sin calificar, alertas de asistencia). Todo filtrado
// a los grados/paralelos que el docente realmente tiene asignados.
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function todayDayName(timeZone = 'America/Guayaquil') {
    const formatter = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone });
    return formatter.format(new Date()).toLowerCase();
}

async function getTodayClasses(teacherId, dayName) {
    const [rows] = await db.pool.query(
        `SELECT c.id, c.name, c.schedule_time, c.zoom_link,
                g.name as grade_name
         FROM classes c
         LEFT JOIN grades g ON c.grade_id = g.id
         WHERE c.is_active = 1
           AND c.schedule_day = ?
           AND (
               c.teacher_id = ?
               OR (c.grade_id IS NOT NULL AND c.grade_id IN (
                   SELECT grade_id FROM teacher_grades WHERE teacher_id = ?
               ))
           )
         ORDER BY c.schedule_time`,
        [dayName, teacherId, teacherId]
    );
    return rows;
}

async function getPendingGrading(teacherId) {
    const [rows] = await db.pool.query(
        `SELECT t.id as task_id, t.title, t.due_date, c.id as class_id, c.name as class_name,
                COUNT(ts.id) as pending_count
         FROM tasks t
         JOIN classes c ON t.class_id = c.id
         JOIN task_submissions ts ON ts.task_id = t.id AND ts.score IS NULL
         WHERE t.is_active = 1 AND c.is_active = 1
           AND (
               c.teacher_id = ?
               OR (c.grade_id IS NOT NULL AND c.grade_id IN (
                   SELECT grade_id FROM teacher_grades WHERE teacher_id = ?
               ))
           )
         GROUP BY t.id, c.id
         ORDER BY t.due_date IS NULL, t.due_date ASC`,
        [teacherId, teacherId]
    );
    return rows;
}

async function getAttendanceAlerts(teacherId, minAbsences = 3) {
    const [rows] = await db.pool.query(
        `SELECT c.id as class_id, c.name as class_name, u.id as student_id, u.full_name,
                COUNT(*) as absences
         FROM attendance a
         JOIN classes c ON a.class_id = c.id
         JOIN users u ON a.student_id = u.id
         WHERE a.status = 'absent' AND c.is_active = 1
           AND (
               c.teacher_id = ?
               OR (c.grade_id IS NOT NULL AND c.grade_id IN (
                   SELECT grade_id FROM teacher_grades WHERE teacher_id = ?
               ))
           )
         GROUP BY c.id, u.id
         HAVING COUNT(*) >= ?
         ORDER BY absences DESC
         LIMIT 20`,
        [teacherId, teacherId, minAbsences]
    );
    return rows;
}

async function getSummary(teacherId) {
    const dayName = todayDayName();
    const [todayClasses, pendingGrading, attendanceAlerts] = await Promise.all([
        getTodayClasses(teacherId, dayName),
        getPendingGrading(teacherId),
        getAttendanceAlerts(teacherId)
    ]);

    const pendingGradingTotal = pendingGrading.reduce((sum, t) => sum + t.pending_count, 0);

    return {
        day_name: dayName,
        today_classes: todayClasses,
        pending_grading: pendingGrading,
        pending_grading_total: pendingGradingTotal,
        attendance_alerts: attendanceAlerts
    };
}

module.exports = { getSummary, todayDayName, DAY_NAMES };
