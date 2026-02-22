const mysql = require('mysql2');

// Lista de IPs de salida de Render (actualizadas)
const RENDER_OUTBOUND_IPS = [
    '54.173.175.145',
    '54.173.175.146',
    '54.173.175.147',
    '54.173.175.148',
    '54.173.175.149',
    '54.173.175.150',
    '54.173.175.151',
    '54.173.175.152'
];

let pool;
let promisePool;

// Configuración mejorada con timeout más largo y debug
if (process.env.DATABASE_URL) {
    // ✅ Usar URL de conexión completa (recomendado para evitar errores)
    console.log('\n📦 Usando DATABASE_URL para la conexión...');
    pool = mysql.createPool(process.env.DATABASE_URL, {
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 10,
        connectTimeout: 30000,
        enableKeepAlive: true,
        keepAliveInitialDelay: 30000,
        ssl: process.env.NODE_ENV === 'production' ? {
            rejectUnauthorized: false
        } : undefined
    });
} else {
    // ⚠️ Usar variables separadas (si no hay DATABASE_URL)
    console.log('\n📦 Usando variables separadas para la conexión...');
    pool = mysql.createPool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 10,
        connectTimeout: 30000,
        ssl: process.env.NODE_ENV === 'production' ? {
            rejectUnauthorized: false
        } : undefined,
        enableKeepAlive: true,
        keepAliveInitialDelay: 30000,
        acquireTimeout: 30000,
        timeout: 30000
    });
}

promisePool = pool.promise();

// Función para ejecutar queries con reintentos automáticos
async function queryWithRetry(sql, params, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`📊 Intento ${attempt}/${maxRetries} de query...`);
            const result = await promisePool.query(sql, params);
            if (attempt > 1) {
                console.log(`✅ Conexión exitosa en intento ${attempt}`);
            }
            return result;
        } catch (error) {
            lastError = error;
            console.log(`⚠️ Intento ${attempt} falló: ${error.message}`);
            
            if (attempt < maxRetries) {
                // Espera exponencial: 2s, 4s, 6s...
                const waitTime = attempt * 2000;
                console.log(`   Esperando ${waitTime/1000} segundos antes de reintentar...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }
    
    throw lastError;
}

// Versión mejorada de testConnection con diagnóstico detallado
const testConnection = async () => {
    console.log('\n🔍 DIAGNÓSTICO DE CONEXIÓN A MySQL:');
    
    if (process.env.DATABASE_URL) {
        console.log(`   Modo: Usando DATABASE_URL`);
        // No mostramos la URL completa por seguridad
    } else {
        console.log(`   Host: ${process.env.DB_HOST}`);
        console.log(`   Puerto: ${process.env.DB_PORT}`);
        console.log(`   Usuario: ${process.env.DB_USER}`);
        console.log(`   Base de datos: ${process.env.DB_NAME}`);
    }
    
    console.log(`   Modo SSL: ${process.env.NODE_ENV === 'production' ? '✅ Activado' : '❌ Desactivado'}`);
    
    if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
        console.log('\n🔒 IPs de Render que deben estar autorizadas en Aiven:');
        RENDER_OUTBOUND_IPS.forEach(ip => {
            console.log(`   • ${ip}/32`);
        });
    }
    
    try {
        // Intentar conectar con reintentos
        console.log('\n   ⏳ Intentando conectar (con reintentos automáticos)...');
        
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const [rows] = await promisePool.query('SELECT 1 + 1 as result');
                console.log('   ✅ CONEXIÓN EXITOSA!');
                console.log(`   📊 Resultado de prueba: ${rows[0].result}`);
                
                if (attempt > 1) {
                    console.log(`   ✨ Conexión lograda después de ${attempt} intentos`);
                }
                
                return true;
                
            } catch (error) {
                if (attempt === 3) throw error;
                
                console.log(`   ⚠️ Intento ${attempt} falló: ${error.message}`);
                console.log(`   ⏱️  Reintentando en ${attempt * 2} segundos...`);
                
                // Espera antes de reintentar: 2s, 4s
                await new Promise(resolve => setTimeout(resolve, attempt * 2000));
            }
        }
        
    } catch (error) {
        console.error('\n   ❌ ERROR DE CONEXIÓN DEFINITIVO:');
        console.error(`   📌 Código de error: ${error.code}`);
        console.error(`   📌 Mensaje: ${error.message}`);
        console.error(`   📌 Errno: ${error.errno}`);
        console.error(`   📌 SQL State: ${error.sqlState}`);
        
        // Análisis adicional según el tipo de error
        if (error.code === 'ETIMEDOUT') {
            console.error('\n   🔍 ANÁLISIS: Timeout - Posibles causas:');
            console.error('      • Las IPs de Render no están autorizadas en Aiven');
            console.error('      • Firewall bloqueando el puerto');
            console.error('      • Latencia entre regiones');
            console.error('\n   ✅ SOLUCIÓN: Agrega estas IPs en Aiven:');
            RENDER_OUTBOUND_IPS.forEach(ip => {
                console.error(`      • ${ip}/32`);
            });
            
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

// Función para verificar conectividad de red (sin SQL)
const checkNetworkConnectivity = async () => {
    return new Promise((resolve) => {
        const net = require('net');
        const socket = net.createConnection({
            host: process.env.DB_HOST || 'roboworks-db-eu-roboworks-db.b.aivencloud.com',
            port: parseInt(process.env.DB_PORT || 18273),
            timeout: 10000
        }, () => {
            console.log('✅ CONEXIÓN TCP EXITOSA al puerto');
            socket.destroy();
            resolve(true);
        });
        
        socket.on('error', (error) => {
            console.error('❌ ERROR TCP:', error.message);
            socket.destroy();
            resolve(false);
        });
        
        socket.on('timeout', () => {
            console.error('❌ TIMEOUT TCP');
            socket.destroy();
            resolve(false);
        });
    });
};

module.exports = {
    pool: promisePool,
    query: (sql, params) => promisePool.query(sql, params),
    queryWithRetry,
    testConnection,
    checkNetworkConnectivity,
    RENDER_OUTBOUND_IPS
};