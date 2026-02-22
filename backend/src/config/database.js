const mysql = require('mysql2');

// Crear el pool de conexiones
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'roboworks_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Convertir a promesas para usar async/await
const promisePool = pool.promise();

// Función para probar la conexión
const testConnection = async () => {
    try {
        const [rows] = await promisePool.query('SELECT 1 + 1 as result');
        console.log('✅ Conexión a MySQL establecida');
        console.log(`📊 Base de datos: ${process.env.DB_NAME || 'roboworks_db'}`);
        return true;
    } catch (error) {
        console.error('❌ Error conectando a MySQL:', error.message);
        return false;
    }
};

// Exportar TODO lo necesario
module.exports = {
    pool: promisePool,  // 👈 Esto es lo que necesitas para las queries
    query: (sql, params) => promisePool.query(sql, params), // 👈 Método helper
    testConnection
};