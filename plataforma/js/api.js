// Configuración de la API
const API = {
    baseURL: 'http://localhost:3000/api',
    
    // Headers por defecto
    getHeaders() {
        return {
            'Content-Type': 'application/json',
        };
    },

    // Manejar respuestas
    async handleResponse(response) {
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Error en la petición');
        }
        
        return data;
    },

    // Petición POST (con cookie incluida automáticamente)
    async post(endpoint, body) {
        const response = await fetch(`${this.baseURL}${endpoint}`, {
            method: 'POST',
            headers: this.getHeaders(),
            credentials: 'include', // Importante para enviar cookies
            body: JSON.stringify(body)
        });
        
        return this.handleResponse(response);
    },

    // Petición GET
    async get(endpoint) {
        const response = await fetch(`${this.baseURL}${endpoint}`, {
            method: 'GET',
            headers: this.getHeaders(),
            credentials: 'include'
        });
        
        return this.handleResponse(response);
    },

    // Petición POST para logout (sin body)
    async postLogout(endpoint) {
        const response = await fetch(`${this.baseURL}${endpoint}`, {
            method: 'POST',
            credentials: 'include'
        });
        
        return this.handleResponse(response);
    }
};