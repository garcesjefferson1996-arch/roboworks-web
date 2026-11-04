// Respaldo manual de la base de datos en un archivo .sql.
//
// Uso (desde la carpeta virtus-backend):
//   node scripts/backup-db.js [carpeta_destino]
//
// Lee la conexion del mismo .env que usa el backend (DB_HOST, DB_PORT,
// DB_USER, DB_PASSWORD, DB_NAME). Si tu .env tiene otros nombres, ajusta
// las lineas marcadas con "AJUSTAR". Solo LEE la base de datos, no la modifica.
//
// IMPORTANTE: el archivo contiene datos personales de estudiantes y docentes.
// Guardalo en un lugar privado (no lo subas a GitHub ni lo compartas).

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function main() {
    const destDir = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'backups-db'));
    fs.mkdirSync(destDir, { recursive: true });

    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,          // AJUSTAR si tu .env usa otro nombre
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: process.env.DB_SSL === 'false' ? undefined : { rejectUnauthorized: false },
        multipleStatements: false
    });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const file = path.join(destDir, `virtus-backup-${stamp}.sql`);
    const out = fs.createWriteStream(file, { encoding: 'utf8' });
    const write = (s) => new Promise((res) => out.write(s, res));

    await write(`-- Respaldo Virtus ${new Date().toISOString()}\nSET FOREIGN_KEY_CHECKS=0;\nSET NAMES utf8mb4;\n\n`);

    const [tables] = await conn.query(
        `SELECT TABLE_NAME FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`
    );

    let totalRows = 0;
    for (const { TABLE_NAME: table } of tables) {
        const [[create]] = await conn.query(`SHOW CREATE TABLE \`${table}\``);
        await write(`DROP TABLE IF EXISTS \`${table}\`;\n${create['Create Table']};\n\n`);

        const [rows] = await conn.query(`SELECT * FROM \`${table}\``);
        totalRows += rows.length;
        const BATCH = 200;
        for (let i = 0; i < rows.length; i += BATCH) {
            const chunk = rows.slice(i, i + BATCH);
            const cols = Object.keys(chunk[0]).map((c) => `\`${c}\``).join(', ');
            const values = chunk
                .map((r) => '(' + Object.values(r).map((v) => conn.escape(v)).join(', ') + ')')
                .join(',\n');
            await write(`INSERT INTO \`${table}\` (${cols}) VALUES\n${values};\n`);
        }
        await write('\n');
        console.log(`  ${table}: ${rows.length} filas`);
    }

    await write('SET FOREIGN_KEY_CHECKS=1;\n');
    await new Promise((res) => out.end(res));
    await conn.end();

    const mb = (fs.statSync(file).size / 1024 / 1024).toFixed(2);
    console.log(`\nListo: ${tables.length} tablas, ${totalRows} filas, ${mb} MB`);
    console.log(`Archivo: ${file}`);
}

main().catch((e) => {
    console.error('Error en el respaldo:', e.message);
    process.exit(1);
});
