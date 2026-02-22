const mysql = require('mysql2');

const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: process.env.MYSQL_PORT,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
    } : undefined,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0
});

const promisePool = pool.promise();

const testConnection = async () => {
    try {
        console.log('🔄 Verificando conexión a la base de datos...');
        const [rows] = await promisePool.query('SELECT 1 + 1 AS result');
        console.log('✅ Conexión exitosa a MySQL');
        return true;
    } catch (error) {
        console.error('❌ Error de conexión a MySQL:');
        console.error(error);
        return false;
    }
};

module.exports = {
    pool: promisePool,
    query: (sql, params) => promisePool.query(sql, params),
    testConnection
};