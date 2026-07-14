// Configuración central de la URL del backend de Virtus.
// En local apunta a tu servidor de desarrollo; en producción, al dominio del
// backend desplegado (Render u otro). Actualiza VIRTUS_API_BASE_PROD cuando
// tengas el dominio definitivo.
const VIRTUS_API_BASE = (function () {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
        return 'http://localhost:4000';
    }
    const VIRTUS_API_BASE_PROD = 'https://api.virtusrobotica.com';
    return VIRTUS_API_BASE_PROD;
})();
