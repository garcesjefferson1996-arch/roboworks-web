/* ============================================================
   whatsapp.js — Botón flotante y enlaces de WhatsApp RoboWorks
   ------------------------------------------------------------
   CONFIGURACIÓN: cambia aquí el número y los mensajes.
   - El número va en formato internacional, sin "+" ni espacios.
   - Cualquier enlace con data-wa="clave" o data-wa-text="..."
     se completa automáticamente con el número y el mensaje.
   - Cada página puede definir su mensaje por defecto con
     <body data-wa-page="clave">.
   Funciona solo (no necesita site.css), así que puede añadirse
   a cualquier página del sitio con:
   <script src="js/whatsapp.js" defer></script>
   ============================================================ */
(function () {
  'use strict';

  var RW_WHATSAPP = {
    numero: '593993340103',
    mensajes: {
      general:     '¡Hola! Me interesa conocer más sobre RoboWorks Academy y sus programas.',
      info:        '¡Hola! Quisiera solicitar información sobre RoboWorks Academy.',
      programas:   '¡Hola! Quisiera consultar los programas de RoboWorks: RoboEnglish, RoboCode y RoboAI.',
      roboenglish: '¡Hola! Me interesa conocer más sobre RoboEnglish de RoboWorks Academy.',
      robocode:    '¡Hola! Me interesa conocer más sobre RoboCode de RoboWorks Academy.',
      roboai:      '¡Hola! Me interesa conocer más sobre RoboAI de RoboWorks Academy.'
    }
  };
  window.RW_WHATSAPP = RW_WHATSAPP;

  function link(texto) {
    return 'https://wa.me/' + RW_WHATSAPP.numero + '?text=' + encodeURIComponent(texto || RW_WHATSAPP.mensajes.general);
  }

  function pageKey() {
    var b = document.body;
    if (b && b.dataset && b.dataset.waPage) return b.dataset.waPage;
    var p = (location.pathname.split('/').pop() || '').replace('.html', '').toLowerCase();
    if (RW_WHATSAPP.mensajes[p]) return p;
    return 'general';
  }

  function pageMessage() {
    var b = document.body;
    if (b && b.dataset && b.dataset.waText) return b.dataset.waText;
    return RW_WHATSAPP.mensajes[pageKey()] || RW_WHATSAPP.mensajes.general;
  }

  function wireLinks() {
    var els = document.querySelectorAll('[data-wa], [data-wa-text]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var txt = el.getAttribute('data-wa-text');
      if (!txt) {
        var key = el.getAttribute('data-wa');
        txt = (key && RW_WHATSAPP.mensajes[key]) || pageMessage();
      }
      el.setAttribute('href', link(txt));
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener');
    }
  }

  function injectFloat() {
    if (document.querySelector('.rw-wa-float')) return;

    var css = '' +
      '.rw-wa-float{position:fixed;right:max(18px,env(safe-area-inset-right));bottom:max(18px,env(safe-area-inset-bottom));z-index:9990;display:flex;align-items:center;gap:0;height:60px;padding:0;border-radius:999px;background:#25d366;color:#fff;text-decoration:none;font-family:Nunito,Poppins,system-ui,sans-serif;font-weight:800;font-size:15px;box-shadow:0 12px 30px rgba(18,140,70,.35),0 2px 6px rgba(0,0,0,.08);transition:transform .35s cubic-bezier(.22,.8,.24,1),box-shadow .35s;}' +
      '.rw-wa-float:hover{transform:translateY(-3px);box-shadow:0 18px 38px rgba(18,140,70,.42);}' +
      '.rw-wa-float:focus-visible{outline:3px solid #ff7b42;outline-offset:3px;}' +
      '.rw-wa-float__icon{position:relative;width:60px;height:60px;display:grid;place-items:center;flex-shrink:0;}' +
      '.rw-wa-float__icon svg{width:30px;height:30px;fill:#fff;}' +
      '.rw-wa-float__icon::after{content:"";position:absolute;inset:0;border-radius:50%;box-shadow:0 0 0 0 rgba(37,211,102,.55);animation:rwWaPulse 2.8s ease-out infinite;}' +
      '.rw-wa-float__label{max-width:0;overflow:hidden;white-space:nowrap;opacity:0;transition:max-width .45s cubic-bezier(.22,.8,.24,1),opacity .3s,padding .45s;padding-right:0;}' +
      '.rw-wa-float:hover .rw-wa-float__label,.rw-wa-float.is-peek .rw-wa-float__label{max-width:220px;opacity:1;padding-right:22px;}' +
      '@keyframes rwWaPulse{0%{box-shadow:0 0 0 0 rgba(37,211,102,.5);}70%{box-shadow:0 0 0 16px rgba(37,211,102,0);}100%{box-shadow:0 0 0 0 rgba(37,211,102,0);}}' +
      '@media (max-width:600px){.rw-wa-float{height:56px;}.rw-wa-float__icon{width:56px;height:56px;}.rw-wa-float.is-peek .rw-wa-float__label{max-width:0;opacity:0;padding-right:0;}}' +
      '@media (prefers-reduced-motion:reduce){.rw-wa-float__icon::after{animation:none;}}';

    var style = document.createElement('style');
    style.id = 'rw-wa-style';
    style.textContent = css;
    document.head.appendChild(style);

    var a = document.createElement('a');
    a.className = 'rw-wa-float';
    a.href = link(pageMessage());
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('aria-label', 'Escríbenos por WhatsApp');
    a.innerHTML =
      '<span class="rw-wa-float__icon" aria-hidden="true">' +
      '<svg viewBox="0 0 32 32"><path d="M16.04 3C9.4 3 4 8.36 4 14.97c0 2.33.67 4.5 1.84 6.35L4 29l7.9-1.8a12.1 12.1 0 0 0 4.14.73C22.67 27.93 28 22.57 28 15.97 28 9.36 22.67 3 16.04 3zm0 22.73c-1.3 0-2.58-.24-3.78-.7l-.47-.18-4.68 1.07 1.1-4.48-.3-.48a9.7 9.7 0 0 1-1.6-5.4c0-5.4 4.4-9.79 9.73-9.79 5.35 0 9.72 4.6 9.72 10 0 5.38-4.37 9.96-9.72 9.96zm5.33-7.33c-.29-.15-1.73-.85-2-.95-.27-.1-.46-.15-.66.15-.19.29-.75.95-.92 1.14-.17.2-.34.22-.63.07-.29-.15-1.23-.45-2.34-1.44-.86-.77-1.45-1.72-1.62-2.01-.17-.29-.02-.45.13-.6.13-.13.29-.34.44-.51.15-.17.19-.29.29-.49.1-.19.05-.37-.02-.51-.07-.15-.66-1.58-.9-2.17-.24-.57-.48-.49-.66-.5h-.56c-.2 0-.51.07-.78.37-.27.29-1.02 1-1.02 2.43 0 1.43 1.05 2.82 1.2 3.01.15.2 2.06 3.14 4.99 4.4.7.3 1.24.48 1.67.62.7.22 1.34.19 1.84.12.56-.08 1.73-.71 1.97-1.39.24-.68.24-1.27.17-1.39-.07-.12-.27-.2-.56-.34z"/></svg>' +
      '</span><span class="rw-wa-float__label">¿Conversamos?</span>';
    document.body.appendChild(a);

    // Muestra la etiqueta unos segundos al cargar (solo escritorio)
    setTimeout(function () { a.classList.add('is-peek'); }, 1800);
    setTimeout(function () { a.classList.remove('is-peek'); }, 6500);
  }

  function init() { wireLinks(); injectFloat(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
