/* FDI v3, accueil : bande épinglée avec la scène 3D (v2 conservée), frise à point actif, filets des chiffres.
   Navigation, pied de page, thème et mode léger : ../commun/commun.js. Tout est un enrichissement. */
(function () {
  'use strict';
  var d = document, root = d.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var HEAD = 80; /* = --head-h de commun.css */
  function clamp(v) { return Math.max(0, Math.min(1, v)); }
  function $(s, c) { return (c || d).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); }
  function lite() { return root.hasAttribute('data-lite'); }

  $$('[data-age]').forEach(function (e) { e.textContent = new Date().getFullYear() - 1981; });

  var band = $('#chiffres'), track = $('#track'), stick = $('#stick'), stage = $('#stage');
  var scene = null, replaying = false, figsDone = false;
  function figsGo() { if (!figsDone) { figsDone = true; band.classList.add('figs-go'); } }
  function pinned() { return band.classList.contains('is-pinned'); }
  function progress() {
    var vh = window.innerHeight;
    if (pinned()) {
      var tr = track.getBoundingClientRect();
      var range = tr.height - stick.offsetHeight;
      return clamp((HEAD - tr.top) / (range * 0.88)); /* les 12 derniers % : logo assemblé, maintenu */
    }
    var r = stage.getBoundingClientRect();
    var c = r.top + r.height / 2, start = vh - r.height / 2 - 8, end = vh * 0.42;
    return clamp((start - c) / (start - end));
  }
  function canPin() { return window.innerHeight >= 700; }
  function setPin() { band.classList.toggle('is-pinned', !!scene && canPin() && !reduce.matches); }
  function loadScene() {
    if (reduce.matches || lite()) return;
    var sc = d.createElement('script');
    sc.src = '../3d/dist/fdi-scene.iife.js';
    sc.onload = function () {
      try {
        var force = /[?&]force3d=1/.test(location.search); /* tests en rendu logiciel seulement */
        var s = window.FDIScene.mount(stage, { progression: 0, force: force });
        if (stage.getAttribute('data-fdi3d') === 'on') { scene = s; band.classList.add('has-3d'); setPin(); queue(); }
      } catch (e) { /* le SVG assemblé reste */ }
    };
    d.head.appendChild(sc);
  }
  if (d.readyState === 'complete') loadScene(); else window.addEventListener('load', loadScene);
  /* Mode léger choisi en cours de visite : la scène s'éteint, le SVG assemblé revient */
  d.addEventListener('fdi:lite', function (e) {
    if (e.detail && scene) { try { scene.destroy(); } catch (x) {} scene = null; band.classList.remove('has-3d', 'is-pinned'); stage.removeAttribute('data-fdi3d'); }
    figsGo();
  });

  /* Sans scène (repli SVG, mouvement réduit, mode léger) : les filets se tracent à 50 % de visibilité de la bande */
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting && !scene) figsGo(); }, { threshold: 0.5 });
    io.observe(band);
  } else figsGo();

  /* Frise : trait tracé au défilement, un seul jalon actif (bande de lecture) */
  var frise = $('#frise'), jalons = $$('.jalon');
  function setFrise() {
    var r = frise.getBoundingClientRect(), vh = window.innerHeight, line = vh * 0.62;
    frise.style.setProperty('--t', clamp((line - r.top) / r.height).toFixed(4));
    var act = null, zl = vh * 0.40, zh = vh * 0.45; /* rootMargin -40 % / -55 % : la bande 40 % à 45 % */
    jalons.forEach(function (j) {
      var jr = j.getBoundingClientRect();
      j.classList.toggle('is-on', jr.top + 14 < line);
      if (jr.top <= vh * 0.5 && jr.bottom >= vh * 0.4) act = j; /* celui qui traverse la bande de lecture */
    });
    if (focusJ) act = focusJ;
    jalons.forEach(function (j) { j.classList.toggle('is-act', j === act); });
  }
  var focusJ = null;
  jalons.forEach(function (j) {
    j.addEventListener('focusin', function () { focusJ = j; queue(); });
    j.addEventListener('focusout', function () { focusJ = null; queue(); });
  });

  var queued = false;
  function frame() {
    queued = false;
    if (reduce.matches) {
      frise.style.setProperty('--t', 1);
      jalons.forEach(function (j) { j.classList.add('is-on'); j.classList.remove('is-act'); });
      return;
    }
    var p = progress();
    if (scene && !replaying) {
      /* La scène rattrape le défilement en douceur (constante de temps 220 ms) : un cran de molette ne saute plus. */
      var now = performance.now(), dt = Math.min(now - lastT, 64);
      lastT = now;
      shown += (p - shown) * (1 - Math.exp(-dt / 220));
      if (Math.abs(p - shown) < 0.0008) shown = p; else queue();
      scene.setProgress(shown);
      if (shown >= 0.985) figsGo();
    }
    setFrise();
  }
  var shown = 0, lastT = performance.now();
  function queue() { if (!queued) { queued = true; requestAnimationFrame(frame); } }
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', function () { setPin(); queue(); });
  reduce.addEventListener && reduce.addEventListener('change', function () { setPin(); queue(); });
  frame();

  $('#replay').addEventListener('click', function () {
    if (!scene || replaying) return;
    replaying = true;
    scene.setProgress(0);
    scene.play();
    setTimeout(function () { replaying = false; shown = progress(); lastT = performance.now(); queue(); }, 3000);
  });
})();
