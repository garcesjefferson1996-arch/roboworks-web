const db = require('./database');

// Migraciones de seguridad idempotentes. Se ejecutan al arrancar el servidor
// para que desplegar el codigo nuevo no dependa de correr un script a mano.
// (MySQL no soporta ADD COLUMN IF NOT EXISTS, por eso se consulta antes.)
const SECURITY_COLUMNS = [
    {
        name: 'token_version',
        ddl: 'ALTER TABLE users ADD COLUMN token_version INT NOT NULL DEFAULT 0'
    },
    {
        name: 'totp_last_step',
        ddl: 'ALTER TABLE users ADD COLUMN totp_last_step BIGINT NULL'
    }
];

async function ensureSecuritySchema() {
    try {
        const [rows] = await db.pool.query(
            `SELECT COLUMN_NAME FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`
        );
        const existing = new Set(rows.map(r => r.COLUMN_NAME));

        for (const col of SECURITY_COLUMNS) {
            if (!existing.has(col.name)) {
                await db.pool.query(col.ddl);
                console.log(`Migracion de seguridad: columna users.${col.name} creada`);
            }
        }
        return true;
    } catch (error) {
        console.error('Error en migracion de seguridad:', error.message);
        return false;
    }
}

module.exports = { ensureSecuritySchema, SECURITY_COLUMNS };
