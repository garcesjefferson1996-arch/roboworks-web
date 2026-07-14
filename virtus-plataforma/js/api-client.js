// Cliente HTTP compartido para hablar con el backend de Virtus.
// Requiere que js/api-config.js se haya cargado antes (define VIRTUS_API_BASE).
//
// `credentials: 'include'` es lo que permite que la cookie httpOnly de sesión
// viaje en cada request - sin esto, el backend siempre respondería "no
// autorizado" aunque el login haya sido exitoso.
async function virtusApiFetch(path, options = {}) {
    const response = await fetch(`${VIRTUS_API_BASE}${path}`, {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        },
        ...options
    });

    let data = null;
    try {
        data = await response.json();
    } catch (_) {
        // respuestas sin cuerpo (ej. 204) - se ignora
    }

    // Sesión expirada o inválida: si no estamos ya en el login, redirige.
    if (response.status === 401 && !window.location.pathname.includes('login.html')) {
        window.location.href = '/login.html';
        return null;
    }

    return { ok: response.ok, status: response.status, data };
}

// Igual que virtusApiFetch pero para subir archivos (FormData, no JSON).
async function virtusApiUpload(path, formData) {
    const response = await fetch(`${VIRTUS_API_BASE}${path}`, {
        method: 'POST',
        credentials: 'include',
        body: formData
    });

    let data = null;
    try {
        data = await response.json();
    } catch (_) {}

    if (response.status === 401 && !window.location.pathname.includes('login.html')) {
        window.location.href = '/login.html';
        return null;
    }

    return { ok: response.ok, status: response.status, data };
}

// Solo permite abrir links http(s). Sin esto, un link guardado como
// "javascript:alert(document.cookie)" se ejecutaria al hacer click (XSS)
// en vez de simplemente navegar a una URL - los campos de link (video,
// recursos, entregas de estudiantes) son texto libre y no se valida su
// contenido mas que "no vacio" en varios puntos del backend.
function virtusSafeUrl(url) {
    if (!url) return null;
    const trimmed = String(url).trim();
    return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

// Redirige según el rol devuelto por /api/auth/verify o /api/auth/login.
function virtusRedirectForRole(role) {
    const routes = {
        super_admin: '/admin/dashboard.html',
        academy_admin: '/admin/dashboard.html',
        teacher: '/teacher/dashboard.html',
        student: '/dashboard.html'
    };
    window.location.href = routes[role] || '/login.html';
}

// ─────────────────────────────────────────────────────────────
// CAMPANITA DE NOTIFICACIONES (compartida por los 3 paneles)
// ─────────────────────────────────────────────────────────────
// Uso: llamar virtusInitNotificationBell('idDelContenedor') una vez que el
// usuario ya esta verificado (dentro de init()). Inyecta su propio HTML/CSS
// dentro del contenedor indicado y se refresca solo cada 30s.
function virtusEscapeForBell(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
}

function virtusTimeAgo(dateStr) {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'ahora mismo';
    if (mins < 60) return `hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `hace ${hours} h`;
    const days = Math.floor(hours / 24);
    return `hace ${days} d`;
}

let _virtusBellPollTimer = null;

function virtusInitNotificationBell(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!document.getElementById('virtus-bell-styles')) {
        const style = document.createElement('style');
        style.id = 'virtus-bell-styles';
        style.textContent = `
            .vb-wrap{position:relative;display:inline-block}
            .vb-btn{background:none;border:none;cursor:pointer;font-size:1.05rem;color:inherit;position:relative;padding:.4rem;opacity:.75}
            .vb-btn:hover{opacity:1}
            .vb-badge{position:absolute;top:-2px;right:-2px;background:#ef4444;color:#fff;border-radius:50px;font-size:.62rem;font-weight:800;padding:.05rem .35rem;line-height:1.3;min-width:16px;text-align:center}
            .vb-panel{position:absolute;top:calc(100% + 8px);right:0;width:320px;max-height:400px;overflow-y:auto;background:#fff;border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.18);border:1px solid #e2e8f0;z-index:300;display:none}
            .vb-panel.open{display:block}
            .vb-head{padding:.75rem 1rem;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;font-size:.8rem;font-weight:700;color:#1e293b}
            .vb-head a{font-size:.72rem;font-weight:600;color:#FF7B42;cursor:pointer;text-decoration:none}
            .vb-item{padding:.7rem 1rem;border-bottom:1px solid #f1f5f9;font-size:.8rem;color:#1e293b;cursor:pointer}
            .vb-item:hover{background:#f8fafc}
            .vb-item.unread{background:#fff7ed}
            .vb-item .vb-time{display:block;font-size:.68rem;color:#94a3b8;margin-top:.2rem}
            .vb-empty{padding:1.5rem 1rem;text-align:center;color:#94a3b8;font-size:.8rem}
        `;
        document.head.appendChild(style);
    }

    container.innerHTML = `
        <div class="vb-wrap">
            <button class="vb-btn" id="vbToggleBtn" title="Notificaciones">
                <i class="fas fa-bell"></i>
                <span class="vb-badge" id="vbBadge" style="display:none">0</span>
            </button>
            <div class="vb-panel" id="vbPanel">
                <div class="vb-head">
                    <span>Notificaciones</span>
                    <a id="vbMarkAll">Marcar todas como leidas</a>
                </div>
                <div id="vbList"><div class="vb-empty">Cargando...</div></div>
            </div>
        </div>
    `;

    const toggleBtn = document.getElementById('vbToggleBtn');
    const panel = document.getElementById('vbPanel');
    const markAllLink = document.getElementById('vbMarkAll');

    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const willOpen = !panel.classList.contains('open');
        panel.classList.toggle('open', willOpen);
        if (willOpen) virtusLoadNotifications();
    });

    document.addEventListener('click', (e) => {
        if (!panel.contains(e.target) && e.target !== toggleBtn) {
            panel.classList.remove('open');
        }
    });

    markAllLink.addEventListener('click', async (e) => {
        e.stopPropagation();
        await virtusApiFetch('/api/notifications/read-all', { method: 'PUT' });
        virtusLoadNotifications();
    });

    async function virtusLoadNotifications() {
        const res = await virtusApiFetch('/api/notifications');
        if (!res || !res.ok) return;

        const { notifications = [], unreadCount = 0 } = res.data;
        const badge = document.getElementById('vbBadge');
        badge.style.display = unreadCount > 0 ? 'block' : 'none';
        badge.textContent = unreadCount > 99 ? '99+' : unreadCount;

        const list = document.getElementById('vbList');
        if (notifications.length === 0) {
            list.innerHTML = '<div class="vb-empty">No tienes notificaciones todavia.</div>';
            return;
        }

        list.innerHTML = notifications.map(n => `
            <div class="vb-item ${n.is_read ? '' : 'unread'}" data-id="${n.id}">
                ${virtusEscapeForBell(n.message)}
                <span class="vb-time">${virtusTimeAgo(n.created_at)}</span>
            </div>
        `).join('');

        list.querySelectorAll('.vb-item').forEach(item => {
            item.addEventListener('click', async () => {
                const id = item.dataset.id;
                if (item.classList.contains('unread')) {
                    await virtusApiFetch(`/api/notifications/${id}/read`, { method: 'PUT' });
                    item.classList.remove('unread');
                    const currentCount = parseInt(badge.textContent) || 0;
                    const newCount = Math.max(0, currentCount - 1);
                    badge.textContent = newCount;
                    badge.style.display = newCount > 0 ? 'block' : 'none';
                }
            });
        });
    }

    virtusLoadNotifications();
    if (_virtusBellPollTimer) clearInterval(_virtusBellPollTimer);
    _virtusBellPollTimer = setInterval(virtusLoadNotifications, 30000);
}
