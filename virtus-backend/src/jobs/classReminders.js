const cron = require('node-cron');
const db = require('../config/database');
const Notification = require('../models/Notification');
const { todayDayName } = require('../models/TeacherSummary');

const DAY_LABEL = {
    monday: 'lunes', tuesday: 'martes', wednesday: 'miércoles',
    thursday: 'jueves', friday: 'viernes', saturday: 'sábado', sunday: 'domingo'
};

// Trae, para cada docente con clase hoy, la lista de sus paralelos de hoy
// ordenados por hora. Un docente puede aparecer varias veces (una fila por
// paralelo); se agrupan en JS.
async function getTeachersWithClassesToday(dayName) {
    const [rows] = await db.pool.query(
        `SELECT c.teacher_id, c.name as class_name, c.schedule_time, g.name as grade_name
         FROM classes c
         LEFT JOIN grades g ON c.grade_id = g.id
         WHERE c.is_active = 1 AND c.teacher_id IS NOT NULL AND c.schedule_day = ?
         ORDER BY c.teacher_id, c.schedule_time`,
        [dayName]
    );
    return rows;
}

// Evita notificar dos veces el mismo dia si el proceso se reinicia (redeploy,
// crash, etc.) mientras el cron ya corrio hoy para ese docente.
async function alreadyRemindedToday(teacherId) {
    const [[row]] = await db.pool.query(
        `SELECT 1 FROM notifications
         WHERE user_id = ? AND type = 'class_reminder' AND DATE(created_at) = CURDATE()
         LIMIT 1`,
        [teacherId]
    );
    return !!row;
}

async function runClassReminders() {
    try {
        const dayName = todayDayName();
        if (dayName === 'saturday' || dayName === 'sunday') return;

        const rows = await getTeachersWithClassesToday(dayName);
        if (rows.length === 0) return;

        const byTeacher = {};
        rows.forEach(r => {
            if (!byTeacher[r.teacher_id]) byTeacher[r.teacher_id] = [];
            byTeacher[r.teacher_id].push(r);
        });

        for (const teacherId of Object.keys(byTeacher)) {
            if (await alreadyRemindedToday(teacherId)) continue;

            const classes = byTeacher[teacherId];
            const parts = classes.map(c => {
                const time = c.schedule_time ? c.schedule_time.slice(0, 5) : '';
                const label = c.grade_name ? `${c.grade_name} - ${c.class_name}` : c.class_name;
                return time ? `${label} (${time})` : label;
            });

            const message = classes.length === 1
                ? `Hoy (${DAY_LABEL[dayName]}) tienes clase: ${parts[0]}`
                : `Hoy (${DAY_LABEL[dayName]}) tienes ${classes.length} clases: ${parts.join(', ')}`;

            await Notification.create({
                user_id: teacherId,
                type: 'class_reminder',
                message,
                related_type: null,
                related_id: null
            });
        }
    } catch (error) {
        console.error('Error al generar recordatorios de clase:', error.message);
    }
}

// Corre todos los dias a las 6:00 AM hora Ecuador. Se registra como
// "0 6 * * *" con zona horaria fija para que no dependa de la zona del
// servidor (Render corre en UTC).
function scheduleClassReminders() {
    cron.schedule('0 6 * * *', runClassReminders, { timezone: 'America/Guayaquil' });
}

module.exports = { scheduleClassReminders, runClassReminders };
