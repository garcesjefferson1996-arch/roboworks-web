const axios = require('axios');
const qrcode = require('qrcode-terminal');

class WhatsAppService {
    constructor() {
        this.apiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
        this.apiKey = process.env.EVOLUTION_API_KEY;
        this.instanceName = 'roboworks';
        this.connectionStatus = 'disconnected';
    }

    // Inicializar y conectar WhatsApp
    async initialize() {
        try {
            console.log('🔄 Inicializando servicio de WhatsApp...');
            
            // 1. Verificar/Crear instancia
            await this.createInstance();
            
            // 2. Verificar estado de conexión
            const status = await this.getConnectionStatus();
            
            if (status.instance?.state === 'open') {
                console.log('✅ WhatsApp ya está conectado');
                this.connectionStatus = 'connected';
                return { status: 'connected', message: 'WhatsApp ya está conectado' };
            }
            
            // 3. Si no está conectado, generar QR
            console.log('📱 Generando QR para conectar WhatsApp...');
            const qrData = await this.getQR();
            
            if (qrData.qrcode) {
                // Mostrar QR en consola
                console.log('\n📱 ESCANEA ESTE QR CON WHATSAPP:\n');
                qrcode.generate(qrData.qrcode, { small: true });
                
                // También guardar QR en archivo temporal para la web
                const fs = require('fs');
                const path = require('path');
                const qrDir = path.join(__dirname, '../../public/qr');
                
                if (!fs.existsSync(qrDir)) {
                    fs.mkdirSync(qrDir, { recursive: true });
                }
                
                fs.writeFileSync(
                    path.join(qrDir, 'whatsapp-qr.txt'),
                    qrData.qrcode
                );
                
                this.connectionStatus = 'awaiting_scan';
                return { 
                    status: 'awaiting_scan', 
                    message: 'Escanea el QR con WhatsApp',
                    qrcode: qrData.qrcode
                };
            }
            
        } catch (error) {
            console.error('❌ Error inicializando WhatsApp:', error.message);
            return { status: 'error', message: error.message };
        }
    }

    // Crear instancia en Evolution API
    async createInstance() {
        try {
            // Verificar si la instancia ya existe
            try {
                const checkResponse = await axios.get(
                    `${this.apiUrl}/instance/connectionState/${this.instanceName}`,
                    { headers: { 'apikey': this.apiKey } }
                );
                
                if (checkResponse.data) {
                    console.log('✅ Instancia ya existe');
                    return checkResponse.data;
                }
            } catch (error) {
                // La instancia no existe, continuar a crearla
            }

            // Crear nueva instancia
            const response = await axios.post(`${this.apiUrl}/instance/create`, {
                instanceName: this.instanceName,
                token: this.apiKey,
                qrcode: true,
                number: null,
                business: false
            }, {
                headers: { 'apikey': this.apiKey }
            });

            console.log('✅ Instancia de WhatsApp creada');
            return response.data;
        } catch (error) {
            console.error('❌ Error al crear instancia:', error.message);
            throw error;
        }
    }

    // Obtener QR
    async getQR() {
        try {
            const response = await axios.get(
                `${this.apiUrl}/instance/connect/${this.instanceName}`,
                { headers: { 'apikey': this.apiKey } }
            );
            return response.data;
        } catch (error) {
            console.error('❌ Error al obtener QR:', error.message);
            throw error;
        }
    }

    // Verificar estado de conexión
    async getConnectionStatus() {
        try {
            const response = await axios.get(
                `${this.apiUrl}/instance/connectionState/${this.instanceName}`,
                { headers: { 'apikey': this.apiKey } }
            );
            
            this.connectionStatus = response.data.instance?.state || 'disconnected';
            return response.data;
        } catch (error) {
            console.error('❌ Error al verificar estado:', error.message);
            return { instance: { state: 'disconnected' } };
        }
    }

    // Enviar mensaje de texto
    async sendMessage(phone, message) {
        try {
            // Verificar conexión
            const status = await this.getConnectionStatus();
            if (status.instance?.state !== 'open') {
                throw new Error('WhatsApp no está conectado. Inicializa primero.');
            }

            // Formatear número (eliminar + y espacios, asegurar formato internacional)
            let formattedPhone = phone.replace(/\D/g, '');
            
            // Si no tiene código de país, asumir Venezuela (58)
            if (formattedPhone.length <= 10) {
                formattedPhone = '58' + formattedPhone;
            }
            
            // Asegurar que termine con @s.whatsapp.net
            const numberWithSuffix = formattedPhone.includes('@s.whatsapp.net') 
                ? formattedPhone 
                : `${formattedPhone}@s.whatsapp.net`;

            console.log(`📱 Enviando WhatsApp a: ${numberWithSuffix}`);
            
            const response = await axios.post(
                `${this.apiUrl}/message/sendText/${this.instanceName}`,
                {
                    number: numberWithSuffix,
                    text: message,
                    options: {
                        delay: 1200,
                        presence: 'composing',
                        linkPreview: true
                    }
                },
                {
                    headers: {
                        'apikey': this.apiKey,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log(`✅ Mensaje enviado a ${phone}`);
            return { 
                success: true, 
                data: response.data,
                phone: phone 
            };
            
        } catch (error) {
            console.error(`❌ Error enviando mensaje a ${phone}:`, error.message);
            
            // Si es error de conexión, intentar reconectar
            if (error.message.includes('no está conectado')) {
                await this.initialize();
            }
            
            return { 
                success: false, 
                error: error.message,
                phone: phone 
            };
        }
    }

    // Enviar mensaje con plantilla
    async sendTemplate(phone, templateName, variables) {
        const templates = {
            welcome: `🎓 *Bienvenido a RoboWorks Academy* 🎓

Hola *{nombre}*,

Tus credenciales de acceso a la plataforma son:

🔑 *Usuario:* ` + '`{usuario}`' + `
🔐 *Contraseña temporal:* ` + '`{password}`' + `
🎫 *Código de invitación:* ` + '`{codigo}`' + `

📌 *Primeros pasos:*
1. Ingresa a: https://roboworks.site/plataforma/login.html
2. Usa tu usuario y contraseña temporal
3. El sistema te pedirá cambiar tu contraseña
4. Guarda tu código de invitación

¡Prepárate para tu primera clase de robótica! 🤖

*RoboWorks Academy* - Donde la tecnología cobra vida`,

            class_reminder: `🤖 *Recordatorio de Clase* 🤖

Hola *{nombre}*,

Tu próxima clase está por comenzar:

📅 *Fecha:* {fecha}
⏰ *Hora:* {hora}
📚 *Clase:* {clase}
👨‍🏫 *Profesor:* {profesor}
🔗 *Enlace Zoom:* 
{zoom_link}

⚠️ *Recomendaciones:*
- Ingresa 5 minutos antes
- Ten tu material listo
- Micrófono y cámara preparados

¡Te esperamos! 🚀

*RoboWorks Academy*`,

            attendance: `✅ *Asistencia Registrada* ✅

Hola *{nombre}*,

Hemos registrado tu asistencia a la clase:

📚 *{clase}*
📅 *{fecha}*
⏰ *Hora:* {hora}

¡Excelente trabajo! Sigue así 🌟

*RoboWorks Academy*`,

            class_created: `🎉 *Nueva Clase Asignada* 🎉

Hola *{nombre}*,

Te hemos asignado una nueva clase:

📚 *{clase}*
📅 *Día:* {dia}
⏰ *Hora:* {hora}
🔗 *Zoom:* {zoom_link}

*Detalles de la clase:*
{descripcion}

Revisa la plataforma para más información:
https://roboworks.site/plataforma/dashboard.html

¡Nos vemos en clase! 🤖

*RoboWorks Academy*`,

            payment_reminder: `💰 *Recordatorio de Pago* 💰

Hola *{nombre}*,

Te recordamos que el pago de la mensualidad está próximo:

📚 *Clase:* {clase}
📅 *Fecha límite:* {fecha_limite}
💵 *Monto:* {monto}

Puedes realizar el pago por:
🟣 Pago Móvil
💳 Transferencia
💵 Efectivo en clase

Mantén al día tu inscripción para seguir disfrutando de la robótica 🚀

*RoboWorks Academy*`
        };

        // Verificar si la plantilla existe
        if (!templates[templateName]) {
            throw new Error(`Plantilla "${templateName}" no encontrada`);
        }

        // Reemplazar variables en la plantilla
        let message = templates[templateName];
        for (const [key, value] of Object.entries(variables)) {
            message = message.replace(new RegExp(`{${key}}`, 'g'), value || '');
        }

        return this.sendMessage(phone, message);
    }

    // Enviar mensaje a múltiples destinatarios
    async sendBulkMessages(phones, templateName, variables) {
        const results = {
            success: [],
            failed: []
        };

        for (const phone of phones) {
            try {
                const result = await this.sendTemplate(phone, templateName, variables);
                if (result.success) {
                    results.success.push(phone);
                } else {
                    results.failed.push({ phone, error: result.error });
                }
                
                // Esperar un poco entre mensajes para evitar bloqueos
                await new Promise(resolve => setTimeout(resolve, 1500));
                
            } catch (error) {
                results.failed.push({ phone, error: error.message });
            }
        }

        console.log(`📊 Resultados de envío masivo:`, results);
        return results;
    }

    // Cerrar sesión de WhatsApp
    async logout() {
        try {
            await axios.delete(
                `${this.apiUrl}/instance/logout/${this.instanceName}`,
                { headers: { 'apikey': this.apiKey } }
            );
            
            this.connectionStatus = 'disconnected';
            console.log('✅ Sesión de WhatsApp cerrada');
            return { success: true };
            
        } catch (error) {
            console.error('❌ Error al cerrar sesión:', error.message);
            return { success: false, error: error.message };
        }
    }

    // Obtener estado para mostrar en el panel
    async getStatus() {
        try {
            const status = await this.getConnectionStatus();
            
            return {
                connected: status.instance?.state === 'open',
                status: status.instance?.state || 'disconnected',
                phone: status.instance?.phone || null,
                name: status.instance?.name || null
            };
            
        } catch (error) {
            return {
                connected: false,
                status: 'error',
                error: error.message
            };
        }
    }
}

module.exports = new WhatsAppService();