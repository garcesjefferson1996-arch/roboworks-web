const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const db = require('./src/config/database');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            // El frontend usa <script> inline en cada pagina (login, dashboards).
            // Se permite explicitamente en vez de moverlo a archivos externos
            // por ahora; ya se sanitiza toda salida dinamica (escapeHtml/escAttr
            // + virtusSafeUrl) para mitigar el riesgo de XSS que esto reabre.
            "script-src": ["'self'", "'unsafe-inline'"],
            // Los onclick="..." inline (botones, pestañas, modales) tambien
            // caen bajo una directiva CSP distinta a script-src.
            "script-src-attr": ["'unsafe-inline'"],
            // Fotos de perfil y materiales subidos se sirven desde Cloudinary.
            "img-src": ["'self'", "data:", "https:"],
        },
    },
}));

const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api', globalLimiter);

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

const allowedOrigins = (isProduction
    ? (process.env.FRONTEND_URL_PROD || '').split(',')
    : (process.env.FRONTEND_URL_DEV || '').split(',')
).map(o => o.trim()).filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        callback(new Error('Origen no permitido por CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

const authRoutes = require('./src/routes/authRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const teacherRoutes = require('./src/routes/teacherRoutes');
const studentRoutes = require('./src/routes/studentRoutes');
const classRoutes = require('./src/routes/classRoutes');
const materialRoutes = require('./src/routes/materialRoutes');
const uploadRoutes = require('./src/routes/uploadRoutes');
const curriculumRoutes = require('./src/routes/curriculumRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');
const roboticsRoutes = require('./src/routes/roboticsRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/curriculum', curriculumRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/robotics', roboticsRoutes);

app.get('/api/health', async (req, res) => {
    try {
        const [result] = await db.pool.query('SELECT 1 + 1 as solution');
        res.json({
            status: 'OK',
            message: 'Virtus API funcionando',
            environment: isProduction ? 'production' : 'development',
            database: result[0].solution === 2 ? 'conectado' : 'error',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: 'Error de conexion con la base de datos' });
    }
});

app.use('/virtus-plataforma', express.static(path.join(__dirname, '../virtus-plataforma')));
app.use('/images', express.static(path.join(__dirname, '../images')));

app.use('/api', (req, res) => {
    res.status(404).json({ message: 'Ruta de API no encontrada' });
});

app.use((err, req, res, next) => {
    console.error('Error no manejado:', err.message);
    if (err.message === 'Origen no permitido por CORS') {
        return res.status(403).json({ message: 'Origen no permitido' });
    }
    res.status(500).json({
        message: 'Error interno del servidor',
        error: isProduction ? undefined : err.message
    });
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, async () => {
    console.log(`Virtus API corriendo en puerto ${PORT} (${isProduction ? 'produccion' : 'desarrollo'})`);
    await db.testConnection();
});
