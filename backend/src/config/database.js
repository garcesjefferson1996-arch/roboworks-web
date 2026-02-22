const mysql = require('mysql2');

// Configuración mejorada con timeout y debug
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    connectTimeout: 10000, // 10 segundos de timeout
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
    } : undefined,
    // Agregamos debug para ver más detalles
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
});

const promisePool = pool.promise();

// Versión mejorada de testConnection con diagnóstico detallado
const testConnection = async () => {
    console.log('\n🔍 DIAGNÓSTICO DE CONEXIÓN A MySQL:');
    console.log(`   Host: ${process.env.DB_HOST}`);
    console.log(`   Puerto: ${process.env.DB_PORT}`);
    console.log(`   Usuario: ${process.env.DB_USER}`);
    console.log(`   Base de datos: ${process.env.DB_NAME}`);
    console.log(`   Modo SSL: ${process.env.NODE_ENV === 'production' ? '✅ Activado' : '❌ Desactivado'}`);
    
    try {
        // Intento 1: Conexión simple
        console.log('   ⏳ Intentando conectar...');
        const [rows] = await promisePool.query('SELECT 1 + 1 as result');
        console.log('   ✅ CONEXIÓN EXITOSA!');
        console.log(`   📊 Resultado de prueba: ${rows[0].result}`);
        return true;
        
    } catch (error) {
        console.error('   ❌ ERROR DE CONEXIÓN:');
        console.error(`   📌 Código de error: ${error.code}`);
        console.error(`   📌 Mensaje: ${error.message}`);
        console.error(`   📌 Errno: ${error.errno}`);
        console.error(`   📌 SQL State: ${error.sqlState}`);
        
        // Análisis adicional según el tipo de error
        if (error.code === 'ETIMEDOUT') {
            console.error('\n   🔍 ANÁLISIS: Timeout - Posibles causas:');
            console.error('      • El puerto puede estar bloqueado por firewall');
            console.error('      • La IP de Render no está autorizada en Aiven');
            console.error('      • El host o puerto son incorrectos');
        } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('\n   🔍 ANÁLISIS: Acceso denegado - Posibles causas:');
            console.error('      • Usuario o contraseña incorrectos');
            console.error('      • El usuario no tiene permisos para esta base de datos');
        } else if (error.code === 'ENOTFOUND') {
            console.error('\n   🔍 ANÁLISIS: Host no encontrado - Posibles causas:');
            console.error('      • El nombre del host es incorrecto');
            console.error('      • Problema de DNS en Render');
        }
        
        return false;
    }
};

module.exports = {
    pool: promisePool,
    query: (sql, params) => promisePool.query(sql, params),
    testConnection
};