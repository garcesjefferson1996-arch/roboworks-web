const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', (req, res) => {
    res.json({ message: 'Lista de clases - en construcción' });
});

module.exports = router;