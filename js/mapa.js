/* mapa.js: portada de RoboWorks, mapa del tesoro */
(function () {
  'use strict';
  document.documentElement.classList.remove('no-js');

  var KEY = 'rw-mapa-letras';
  var stops = [].slice.call(document.querySelectorAll('[data-stop]'));
  var bricks = [].slice.call(document.querySelectorAll('.bricks i'));
  var barTxt = document.getElementById('bar-txt');
  var seen = [];
  try { seen = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { seen = []; }

  function paint() {
    var next = -1;
    stops.forEach(function (s, i) {
      var done = seen.indexOf(i) >= 0;
      if (!done && next < 0) next = i;
      s.querySelector('.piece-num').textContent = done ? '✓' : (i === stops.length - 1 ? 'X' : String(i + 1));
      s.classList.remove('pulse');
      var b = bricks[i];
      b.style.background = done ? b.getAttribute('data-color') : '';
      b.style.color = done ? '#2e1f15' : '';
    });
    if (next >= 0) stops[next].classList.add('pulse');
    var faltan = stops.length - seen.length;
    document.body.classList.toggle('mapa-completo', faltan <= 0);
    var falta = document.getElementById('falta');
    if (falta) falta.textContent = faltan === 1 ? 'Esta es tu última letra.' : 'Te faltan ' + faltan + ' letras para ganar tu clase de prueba gratis.';
    barTxt.textContent = seen.length >= stops.length ? '¡Mapa completo!' : seen.length + ' de ' + stops.length + ' letras';
  }

  function mark(id) {
    stops.forEach(function (s, i) {
      if (s.getAttribute('href') === '#' + id && seen.indexOf(i) < 0) seen.push(i);
    });
    try { localStorage.setItem(KEY, JSON.stringify(seen)); } catch (e) {}
    paint();
  }

  function current() { return document.querySelector('dialog[open]'); }

  function openPanel(d, keepHash) {
    var c = current();
    if (c) c.close();
    d.showModal();
    if (d.classList.contains('parada')) {
      mark(d.id);
      if (!keepHash) history.replaceState(null, '', '#' + d.id);
    }
    var body = d.querySelector('.panel-body');
    if (body) body.scrollTop = 0;
  }

  /* Enlaces internos: abren su parada; #programas baja al mapa */
  document.addEventListener('click', function (e) {
    var close = e.target.closest('[data-close]');
    if (close) { close.closest('dialog').close(); return; }
    if (e.target.matches('dialog')) { e.target.close(); return; }
    if (e.target.closest('[data-menu]')) { openPanel(document.getElementById('menu')); return; }

    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href').slice(1);
    var target = id && document.getElementById(id);
    if (!target) return;
    if (target.tagName === 'DIALOG') { e.preventDefault(); openPanel(target); return; }
    var c = current();
    if (c) { e.preventDefault(); c.close(); target.scrollIntoView(); }
  });

  [].forEach.call(document.querySelectorAll('dialog.parada'), function (d) {
    d.addEventListener('close', function () {
      if (location.hash === '#' + d.id) history.replaceState(null, '', location.pathname + location.search);
    });
  });

  /* Selector de los tres caminos */
  var progs = [
    { fill: '#d9582a', ink: '#b8430f', name: 'RoboEnglish', motto: 'Build. Discover. Create.', hook: 'Aprender tecnología también puede ser una aventura en otro idioma.', href: 'roboenglish.html' },
    { fill: '#0077a8', ink: '#006d99', name: 'RoboCode', motto: 'Think. Code. Create.', hook: 'Las grandes ideas también se programan.', href: 'robocode.html' },
    { fill: '#04704f', ink: '#04704f', name: 'RoboAI', motto: 'Imagine. Innovate. Transform.', hook: 'El futuro necesita mentes curiosas y creativas.', href: 'roboai.html' }
  ];
  var chips = [].slice.call(document.querySelectorAll('[data-prog]'));
  function setProg(n) {
    var p = progs[n];
    chips.forEach(function (c, i) {
      var on = i === n;
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
      c.style.background = on ? progs[i].fill : 'transparent';
      c.style.color = on ? '#fff' : '#2e1f15';
    });
    document.getElementById('prog-hook').textContent = p.hook;
    document.getElementById('prog-name').textContent = p.name;
    var m = document.getElementById('prog-motto');
    m.textContent = p.motto;
    m.style.color = p.ink;
    document.getElementById('prog-link').setAttribute('href', p.href);
  }
  chips.forEach(function (c, i) { c.addEventListener('click', function () { setProg(i); }); });
  setProg(1);

  /* Enlaces antiguos desde otras páginas: index.html#esencia, #contacto, #confianza */
  var alias = { confianza: 'esencia', vertientes: 'programas', metodo: 'metodologia' };
  function fromHash() {
    var id = location.hash.slice(1);
    id = alias[id] || id;
    var t = id && document.getElementById(id);
    if (!t) return;
    if (t.tagName === 'DIALOG' && !t.open) openPanel(t, true);
    else if (t.tagName !== 'DIALOG') { var c = current(); if (c) c.close(); t.scrollIntoView(); }
  }
  window.addEventListener('hashchange', fromHash);

  /* La barra de letras aparece recién al llegar al mapa */
  var bar = document.querySelector('.bar');
  var map = document.getElementById('programas');
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) {
      bar.classList.toggle('is-on', en[0].isIntersecting);
    }, { rootMargin: '0px 0px -40% 0px' }).observe(map);
  } else {
    bar.classList.add('is-on');
  }

  paint();
  fromHash();

  [].forEach.call(document.querySelectorAll('[data-year]'), function (el) { el.textContent = new Date().getFullYear(); });
})();
