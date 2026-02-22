document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Verificar si ya hay sesión activa
    checkExistingSession();
});

async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('errorMessage');
    const submitBtn = document.querySelector('.btn-login');
    const btnText = document.querySelector('.btn-text');
    const btnLoader = document.querySelector('.btn-loader');
    
    try {
        // Mostrar loading
        submitBtn.disabled = true;
        btnText.style.display = 'none';
        btnLoader.style.display = 'inline-block';
        errorDiv.style.display = 'none';
        
        // Llamar al API
        const response = await API.post('/auth/login', { username, password });
        
        // Login exitoso
        console.log('Login exitoso:', response);
        
        // Verificar si debe cambiar contraseña
        if (response.user.temporary_password) {
            // Redirigir a página de cambio de contraseña
            window.location.href = 'change-password.html';
        } else {
            // Redirigir al dashboard según rol
            if (response.user.role === 'student') {
                window.location.href = 'dashboard.html';
            } else if (response.user.role === 'teacher') {
                window.location.href = 'profesor/dashboard.html';
            } else {
                window.location.href = 'admin/dashboard.html';
            }
        }
        
    } catch (error) {
        // Mostrar error
        errorDiv.textContent = error.message || 'Error al iniciar sesión';
        errorDiv.style.display = 'block';
        
        // Restaurar botón
        submitBtn.disabled = false;
        btnText.style.display = 'inline-block';
        btnLoader.style.display = 'none';
    }
}

async function checkExistingSession() {
    try {
        const response = await API.get('/auth/verify');
        
        // Si hay sesión, redirigir al dashboard apropiado
        if (response.user) {
            if (response.user.role === 'student') {
                window.location.href = 'dashboard.html';
            }
            // ... otros roles
        }
    } catch (error) {
        // No hay sesión activa, continuar en login
        console.log('No hay sesión activa');
    }
}

// Función para logout
async function logout() {
    try {
        await API.postLogout('/auth/logout');
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
    }
}