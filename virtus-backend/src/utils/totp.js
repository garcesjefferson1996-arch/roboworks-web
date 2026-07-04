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

module.exports = { generateSecret, verifyToken, buildQrCodeDataUrl };
