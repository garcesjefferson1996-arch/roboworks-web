const whatsappService = require('./src/services/whatsappService');

async function connect() {
    console.log('📱 Conectando WhatsApp...');
    const result = await whatsappService.initializeInstance();
    console.log('Escanea el QR con WhatsApp para comenzar');
}

connect();