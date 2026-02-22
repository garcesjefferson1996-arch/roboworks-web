const bcrypt = require('bcryptjs');

async function testPassword() {
    const password = 'admin123';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    
    console.log('Contraseña:', password);
    console.log('Hash generado:', hash);
    
    // Verificar que funciona
    const isValid = await bcrypt.compare(password, hash);
    console.log('Verificación:', isValid ? '✅ CORRECTO' : '❌ ERROR');
}

testPassword();