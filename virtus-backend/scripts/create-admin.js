require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcryptjs');
const db = require('../src/config/database');
const { generateSecret, verifyToken } = require('../src/utils/totp');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

async function main() {
    console.log('=== Crear usuario super_admin de Virtus ===');
    const tenantId = (await ask('ID de institucion (tenant_id, usa 1 para la demo): ')) || '1';
    const username = await ask('Usuario: ');
    const fullName = await ask('Nombre completo: ');
    const password = await ask('Contrasena (minimo 8 caracteres): ');

    if (!username || !fullName || password.length < 8) {
        console.error('Datos invalidos. Usuario, nombre y contrasena (min. 8 caracteres) son requeridos.');
        process.exit(1);
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const totpSecret = generateSecret();

    console.log('\n=== Verificacion en dos pasos (obligatoria para administradores) ===');
    console.log('Escanea este secreto en Google Authenticator / Authy / 1Password u otra app TOTP:');
    console.log(`  Secreto manual: ${totpSecret}`);
    console.log(`  Cuenta: ${username}   Emisor: Virtus\n`);

    let confirmed = false;
    while (!confirmed) {
        const code = await ask('Ingresa el codigo de 6 digitos de tu app para confirmar: ');
        confirmed = verifyToken(code, totpSecret);
        if (!confirmed) console.log('Codigo incorrecto, intenta de nuevo (o Ctrl+C para cancelar).');
    }

    await db.pool.query(
        `INSERT INTO users (tenant_id, username, password_hash, full_name, role, temporary_password, totp_secret, totp_enabled)
         VALUES (?, ?, ?, ?, 'super_admin', FALSE, ?, TRUE)`,
        [tenantId, username, hash, fullName, totpSecret]
    );

    console.log(`\nUsuario super_admin '${username}' creado exitosamente, con 2FA activo.`);
    rl.close();
    process.exit(0);
}

main().catch((err) => {
    console.error('Error creando el admin:', err.message);
    process.exit(1);
});
