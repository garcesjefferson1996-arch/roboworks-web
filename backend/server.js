const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const path = require('path');

// Cargar variables de entorno
dotenv.config();

// Importamos la conexión a MySQL
const db = require('./src/config/database');

// 👈 PRIMERO: Inicializar app
const app = express();

// Detectar si estamos en producción
const isProduction = process.env.NODE_ENV === 'production';

// Middlewares
app.use(express.json());
app.use(cookieParser());

// Configuración de CORS mejorada para producción/desarrollo
app.use(cors({
    origin: isProduction 
        ? ['https://garcesjefferson1996-arch.github.io', 'https://roboworks.site']
        : ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

// Middleware para manejar preflight requests
app.options('*', cors());

// Servir archivos estáticos (para GitHub Pages / frontend)
app.use(express.static(path.join(__dirname, '../')));

// Middleware para debug de cookies (solo en desarrollo)
if (!isProduction) {
    app.use((req, res, next) => {
        console.log('🍪 Cookies recibidas:', req.cookies);
        console.log('📝 Headers:', {
            origin: req.headers.origin,
            cookie: req.headers.cookie ? '✅ Presente' : '❌ No hay cookie'
        });
        next();
    });
}

// 👈 AHORA: Importar y usar las rutas
const authRoutes = require('./src/routes/authRoutes');
const studentRoutes = require('./src/routes/studentRoutes');
const classRoutes = require('./src/routes/classRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const studentDashboardRoutes = require('./src/routes/studentDashboardRoutes');
const uploadRoutes = require('./src/routes/uploadRoutes');
const whatsappRoutes = require('./src/routes/whatsappRoutes');
const materialRoutes = require('./src/routes/materialRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/student', studentDashboardRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/materials', materialRoutes);

// Ruta de prueba
app.get('/api/health', async (req, res) => {
    try {
        const [result] = await db.pool.query('SELECT 1 + 1 as solution');
        res.json({ 
            status: 'OK', 
            message: 'RoboWorks API funcionando',
            environment: isProduction ? 'production' : 'development',
            database: result[0].solution === 2 ? '✅ Conectado a MySQL' : '❌ Error en MySQL',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'ERROR', 
            message: 'Error de conexión con la base de datos',
            error: error.message
        });
    }
});

// Ruta para servir el frontend (para SPA - Single Page Application)
app.get('*', (req, res) => {
    // Solo enviar el index.html si la ruta no es una API
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, '../plataforma/login.html'));
    }
});

// Middleware para rutas no encontradas (API)
app.use((req, res) => {
    res.status(404).json({ 
        message: 'Ruta no encontrada',
        path: req.path,
        method: req.method
    });
});

// Manejo de errores global
app.use((err, req, res, next) => {
    console.error('❌ Error:', err.stack);
    res.status(500).json({ 
        message: 'Error interno del servidor',
        error: isProduction ? {} : err.message // Solo mostrar detalles en desarrollo
    });
});

// Iniciar servidor (AHORA CON MANEJO DE ERRORES MEJORADO)
const startServer = async () => {
    try {
        // PRIMERO: Iniciamos el servidor (SIEMPRE)
        const PORT = process.env.PORT || 3000;
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log('\n=================================');
            console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
            console.log(`🌍 Modo: ${isProduction ? 'PRODUCCIÓN' : 'DESARROLLO'}`);
            console.log(`🔗 Ruta de prueba: http://localhost:${PORT}/api/health`);
            console.log('=================================\n');
            
            // DESPUÉS: Probamos la conexión a DB (pero no detenemos el server)
            setTimeout(async () => {
                console.log('🔌 Verificando conexión a base de datos...');
                const connected = await db.testConnection();
                
                if (connected) {
                    console.log('✅ Conexión a MySQL establecida correctamente\n');
                    console.log('📦 Rutas API disponibles:');
                    console.log('   ✅ POST  /api/auth/login');
                    console.log('   ✅ GET   /api/auth/verify');
                    console.log('   ✅ POST  /api/auth/logout');
                    console.log('   ✅ POST  /api/auth/change-password');
                    console.log('   ✅ GET   /api/admin/programs');
                    console.log('   ✅ POST  /api/admin/programs');
                    console.log('   ✅ GET   /api/admin/codeworks-courses');
                    console.log('   ✅ POST  /api/admin/codeworks-courses');
                    console.log('   ✅ GET   /api/admin/classes');
                    console.log('   ✅ POST  /api/admin/classes');
                    console.log('   ✅ GET   /api/admin/students');
                    console.log('   ✅ POST  /api/admin/students');
                    console.log('   ✅ GET   /api/student/*');
                    console.log('   ✅ POST  /api/upload/*');
                    console.log('   ✅ GET   /api/whatsapp/*');
                    console.log('   ✅ GET   /api/materials/*');
                    console.log('=================================\n');
                } else {
                    console.error('\n⚠️  ADVERTENCIA: No se pudo conectar a MySQL.');
                    console.error('   La aplicación funcionará, pero las funciones que requieren base de datos fallarán.');
                    console.error('\n📊 Diagnóstico de conexión:');
                    console.error(`   - DB_HOST: ${process.env.DB_HOST || 'no definido'}`);
                    console.error(`   - DB_PORT: ${process.env.DB_PORT || 'no definido'}`);
                    console.error(`   - DB_USER: ${process.env.DB_USER || 'no definido'}`);
                    console.error(`   - DB_NAME: ${process.env.DB_NAME || 'no definido'}`);
                    console.error('   ⚠️ La contraseña no se muestra por seguridad');
                    console.error('\n🔍 Para solucionar el problema:');
                    console.error('   1. Verifica que MySQL esté corriendo:');
                    console.error('      - Windows: Revisa servicios (services.msc)');
                    console.error('      - Linux/Mac: Ejecuta "sudo systemctl status mysql"');
                    console.error('   2. Verifica las credenciales en el archivo .env');
                    console.error('   3. Comprueba que el host y puerto sean accesibles');
                    console.error('   4. Asegúrate que la base de datos existe');
                    console.error('\n⚠️  El servidor web sigue funcionando en el puerto ' + PORT);
                    console.error('   Puedes acceder a /api/health para verificar el estado\n');
                }
            }, 1000); // Pequeño delay para no bloquear el inicio
        });

    } catch (error) {
        console.error('❌ Error CRÍTICO al iniciar servidor:', error);
        process.exit(1);
    }
};

startServer();