const mysql = require('mysql2');

// Crear el pool de conexiones
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,  // 👈 IMPORTANTE: Agregar puerto
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'roboworks_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // 👇 Configuración adicional para producción (Aiven)
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false  // Aiven requiere SSL
    } : undefined,
    connectTimeout: 10000, // 10 segundos de timeout
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

// Convertir a promesas para usar async/await
const promisePool = pool.promise();

// Función para probar la conexión
const testConnection = async () => {
    try {
        const [rows] = await promisePool.query('SELECT 1 + 1 as result');
        console.log('✅ Conexión a MySQL establecida');
        console.log(`📊 Base de datos: ${process.env.DB_NAME || 'roboworks_db'}`);
        console.log(`🌍 Host: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}`);
        return true;
    } catch (error) {
        console.error('❌ Error conectando a MySQL:');
        console.error('   📌 Código:', error.code);
        console.error('   📌 Mensaje:', error.message);
        console.error('   📌 Host:', process.env.DB_HOST);
        console.error('   📌 Puerto:', process.env.DB_PORT);
        console.error('   📌 Usuario:', process.env.DB_USER);
        console.error('   📌 Base de datos:', process.env.DB_NAME);
        return false;
    }
};

// Exportar TODO lo necesario
module.exports = {
    pool: promisePool,
    query: (sql, params) => promisePool.query(sql, params),
    testConnection
};