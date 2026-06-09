const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function resetAdmin() {
    // Conectar a la base de datos en Aiven
    const connection = await mysql.createConnection({
        host: 'roboworks-db-roboworks-db.c.aivencloud.com',
        port: 18269,
        user: 'avnadmin',
        password: 'Misionero_9',
        database: 'roboworks_db',
        ssl: { rejectUnauthorized: false }
    });

    console.log('✅ Conectado a la base de datos');

    // Verificar si existe el admin
    const [admin] = await connection.execute(
        'SELECT * FROM users WHERE username = ?',
        ['admin']
    );

    // Hashear la nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);
    console.log('🔑 Nueva contraseña hasheada:', hashedPassword);

    if (admin.length > 0) {
        // Actualizar contraseña del admin existente
        await connection.execute(
            'UPDATE users SET password_hash = ?, temporary_password = false WHERE username = ?',
            [hashedPassword, 'admin']
        );
        console.log('✅ Contraseña de admin actualizada');
    } else {
        // Crear admin si no existe
        await connection.execute(
            'INSERT INTO users (tenant_id, username, password_hash, full_name, role, temporary_password) VALUES (?, ?, ?, ?, ?, ?)',
            [1, 'admin', hashedPassword, 'Administrador', 'super_admin', false]
        );
        console.log('✅ Usuario admin creado');
    }

    // Verificar que funcione
    const [verify] = await connection.execute(
        'SELECT id, username, role FROM users WHERE username = ?',
        ['admin']
    );
    console.log('📊 Admin en BD:', verify[0]);

    await connection.end();
}

resetAdmin().catch(console.error);