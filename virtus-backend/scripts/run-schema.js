// Ejecuta db/schema.sql contra la base de datos configurada en .env
// Uso: npm run migrate
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function run() {
    const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true
    });

    try {
        console.log('Aplicando schema.sql...');
        await connection.query(sql);
        console.log('Listo. Esquema aplicado sin errores.');
    } finally {
        await connection.end();
    }
}

run().catch((err) => {
    console.error('Error aplicando el esquema:', err.message);
    process.exit(1);
});
