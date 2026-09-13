// Diagnóstico puntual del error 500 en Robótica de Competencia.
// Conecta con las mismas credenciales de .env (la BD de producción) y
// corre exactamente las mismas consultas que usa la API, mostrando el
// error real de MySQL en vez del mensaje genérico que ve el navegador.
// Uso: node scripts/diagnose-robots.js
require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        console.log('--- Estructura de competition_robots ---');
        const [cols] = await connection.query('DESCRIBE competition_robots');
        console.table(cols.map(c => ({ Field: c.Field, Type: c.Type, Null: c.Null, Key: c.Key })));

        console.log('\n--- Estructura de competition_robot_files ---');
        const [cols2] = await connection.query('DESCRIBE competition_robot_files');
        console.table(cols2.map(c => ({ Field: c.Field, Type: c.Type, Null: c.Null, Key: c.Key })));

        console.log('\n--- Tenants existentes ---');
        const [tenants] = await connection.query('SELECT id, name FROM tenants LIMIT 5');
        console.table(tenants);

        const tenantId = tenants[0]?.id ?? 1;

        console.log(`\n--- Probando el SELECT exacto de getByTenant (tenant_id=${tenantId}) ---`);
        try {
            const [robots] = await connection.query(
                `SELECT cr.*, u.full_name as created_by_name,
                        COUNT(crf.id) as file_count
                 FROM competition_robots cr
                 LEFT JOIN users u ON cr.created_by = u.id
                 LEFT JOIN competition_robot_files crf ON crf.robot_id = cr.id
                 WHERE cr.tenant_id = ? AND cr.is_active = 1
                 GROUP BY cr.id ORDER BY cr.created_at DESC`,
                [tenantId]
            );
            console.log('OK. Filas:', robots.length);
        } catch (e) {
            console.log('FALLÓ el SELECT. Error real:', e.code, '-', e.message);
        }

        console.log(`\n--- Probando el INSERT exacto de create() (tenant_id=${tenantId}) ---`);
        const [users] = await connection.query('SELECT id FROM users WHERE tenant_id = ? LIMIT 1', [tenantId]);
        const userId = users[0]?.id ?? null;
        console.log('created_by de prueba:', userId);
        try {
            const [result] = await connection.query(
                `INSERT INTO competition_robots (tenant_id, name, description, category, external_link, created_by)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [tenantId, '__TEST_DIAGNOSTICO__', null, null, null, userId]
            );
            console.log('OK. insertId:', result.insertId);
            // limpiar la fila de prueba
            await connection.query('DELETE FROM competition_robots WHERE id = ?', [result.insertId]);
            console.log('Fila de prueba borrada.');
        } catch (e) {
            console.log('FALLÓ el INSERT. Error real:', e.code, '-', e.message);
        }

        console.log('\n--- sql_mode actual ---');
        const [mode] = await connection.query('SELECT @@sql_mode as mode, @@version as version');
        console.log(mode[0]);

    } finally {
        await connection.end();
    }
}

run().catch((err) => {
    console.error('Error de conexión:', err.message);
    process.exit(1);
});
