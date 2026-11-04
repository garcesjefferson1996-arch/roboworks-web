const { authenticator } = require('otplib');
const QRCode = require('qrcode');

const ISSUER = 'Virtus';

function generateSecret() {
    return authenticator.generateSecret();
}

function verifyToken(token, secret) {
    if (!token || !secret) return false;
    try {
        return authenticator.verify({ token: String(token).trim(), secret });
    } catch (error) {
        return false;
    }
}

async function buildQrCodeDataUrl(username, secret) {
    const otpauthUrl = authenticator.keyuri(username, ISSUER, secret);
    return QRCode.toDataURL(otpauthUrl);
}

// Valida el codigo y devuelve el "paso" de 30 s al que corresponde (o null).
// Sirve para impedir que un mismo codigo se reutilice (replay): el llamador
// guarda el ultimo paso aceptado y rechaza pasos <= a ese.
function verifyTokenStep(token, secret) {
    if (!token || !secret) return null;
    try {
        const delta = authenticator.checkDelta(String(token).trim(), secret);
        if (delta === null || delta === undefined) return null;
        const step = Math.floor(Date.now() / 1000 / (authenticator.options.step || 30));
        return step + delta;
    } catch (error) {
        return null;
    }
}

module.exports = { generateSecret, verifyToken, verifyTokenStep, buildQrCodeDataUrl };
