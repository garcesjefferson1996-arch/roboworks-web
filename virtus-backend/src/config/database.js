const mysql = require('mysql2');

// Pool de conexiones. El límite viene de variable de entorno para poder
// ajustarlo según el plan de MySQL contratado (no todos los planes
// administrados permiten el mismo número de conexiones simultáneas).
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
    queueLimit: 0
});

const promisePool = pool.promise();

const testConnection = async () => {
    try {
        await promisePool.query('SELECT 1 + 1 AS result');
        console.log('✅ Conexión a MySQL exitosa');
        return true;
    } catch (error) {
        console.error('❌ Error de conexión a MySQL:', error.message);
        return false;
    }
};

module.exports = {
    pool: promisePool,
    query: (sql, params) => promisePool.query(sql, params),
    testConnection
};
