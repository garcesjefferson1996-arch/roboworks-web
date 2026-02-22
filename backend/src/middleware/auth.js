const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    // Obtener token de la cookie
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({ message: 'No autorizado - Token no proporcionado' });
    }

    try {
        // Verificar token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'No autorizado - Token inválido' });
    }
};

module.exports = authMiddleware;