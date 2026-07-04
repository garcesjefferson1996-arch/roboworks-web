const db = require('../config/database');

// Registro de auditoría para acciones sensibles: quién (actor), qué (action),
// sobre qué (targetType/targetId), y desde dónde (ip). No lanza si falla -
// un problema de auditoría no debe tumbar la operación real del usuario,
// pero sí se loguea en consola para que no pase inadvertido.
async function logAction({ tenantId, actorId, actorRole, action, targetType, targetId, metadata, ip }) {
    try {
        await db.pool.query(
            `INSERT INTO audit_logs (tenant_id, actor_id, actor_role, action, target_type, target_id, metadata, ip_address)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                tenantId ?? null,
                actorId ?? null,
                actorRole ?? null,
                action,
                targetType ?? null,
                targetId ? String(targetId) : null,
                metadata ? JSON.stringify(metadata) : null,
                ip ?? null
            ]
        );
    } catch (error) {
        console.error('No se pudo escribir el log de auditoría:', error.message);
    }
}

module.exports = { logAction };
