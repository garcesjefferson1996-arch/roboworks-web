const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({ message: 'No autorizado - sesion no iniciada' });
    }

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        return next();
    } catch (primaryError) {
        if (process.env.JWT_SECRET_PREVIOUS) {
            try {
                req.user = jwt.verify(token, process.env.JWT_SECRET_PREVIOUS);
                return next();
            } catch (fallbackError) {
                // cae al 401 de abajo
            }
        }
        return res.status(401).json({ message: 'No autorizado - sesion invalida o expirada' });
    }
};

module.exports = authMiddleware;
