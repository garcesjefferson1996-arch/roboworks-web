/* ============================================================
   site.js — Interacciones del sitio RoboWorks Academy
   Menú móvil · header al hacer scroll · animaciones de entrada
   · carrusel de experiencias · año del footer
   ============================================================ */
(function () {
  'use strict';
  document.documentElement.classList.remove('no-js');

  // Header con sombra al hacer scroll
  var header = document.querySelector('.site-header');
  function onScroll() { if (header) header.classList.toggle('is-scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Menú móvil
  var toggles = document.querySelectorAll('.nav-toggle');
  var toggle = toggles[0];
  var menu = document.getElementById('mobile-menu');
  function setMenu(open) {
    if (!menu || !toggle) return;
    menu.classList.toggle('is-open', open);
    document.body.classList.toggle('menu-open', open);
    toggles.forEach(function (t) { t.setAttribute('aria-expanded', open ? 'true' : 'false'); });
    if (open) { var c = menu.querySelector('[data-menu-close]'); if (c) c.focus(); }
  }
  if (toggle && menu) {
    toggles.forEach(function (t) { t.addEventListener('click', function () { setMenu(!menu.classList.contains('is-open')); }); });
    document.querySelectorAll('[data-menu-close]').forEach(function (c) { c.addEventListener('click', function () { setMenu(false); }); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
  }

  // Animaciones de entrada
  var items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add('is-visible'); });
  }

  // Carrusel
  document.querySelectorAll('[data-carousel]').forEach(function (wrap) {
    var track = wrap.querySelector('.carousel');
    var prev = wrap.querySelector('[data-prev]');
    var next = wrap.querySelector('[data-next]');
    if (!track) return;
    function step() {
      var s = track.querySelector('.slide');
      return s ? s.getBoundingClientRect().width + 22 : 300;
    }
    function go(dir) {
      var max = track.scrollWidth - track.clientWidth - 4;
      if (dir > 0 && track.scrollLeft >= max) track.scrollTo({ left: 0, behavior: 'smooth' });
      else if (dir < 0 && track.scrollLeft <= 4) track.scrollTo({ left: track.scrollWidth, behavior: 'smooth' });
      else track.scrollBy({ left: dir * step(), behavior: 'smooth' });
    }
    if (prev) prev.addEventListener('click', function () { go(-1); });
    if (next) next.addEventListener('click', function () { go(1); });
  });

  // Oculta el WhatsApp flotante mientras se ve el botón de la portada
  var heroWa = document.querySelector('.hero2__wa');
  if (heroWa && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (en) {
      document.body.classList.toggle('hero-wa-visible', en[0].isIntersecting);
    }, { threshold: 0.2 }).observe(heroWa);
  }

  // Año actual
  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
