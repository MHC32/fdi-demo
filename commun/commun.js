/* FDI v3, script commun : capsule, indicateur, panneaux, tiroir, barre basse, pied de page, mode léger, reprise.
   Tout est un enrichissement : liens et texte restent utilisables sans JS. Aucun appel réseau. */
(function () {
  'use strict';
  var d = document, root = d.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  var desk = matchMedia('(min-width: 1024px)');
  function $(s, c) { return (c || d).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); }
  function clamp(v) { return Math.max(0, Math.min(1, v)); }
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  var CLES = { elig: 'fdi.eligibilite', chk: 'fdi.checklist', chkTs: 'fdi.checklist.ts', sim: 'fdi.simulateur', demande: 'fdi.demande' };
  var EXPIRE = 30 * 864e5;

  $$('[data-year]').forEach(function (e) { e.textContent = new Date().getFullYear(); });

  /* Thème */
  var tb = $('.theme-toggle');
  if (tb) {
    var paint = function () { var s = root.getAttribute('data-theme') === 'dark'; tb.setAttribute('aria-pressed', s ? 'true' : 'false'); tb.setAttribute('aria-label', s ? 'Thème clair' : 'Thème sombre'); };
    paint();
    tb.addEventListener('click', function () {
      var dark = root.getAttribute('data-theme') !== 'dark';
      if (dark) root.setAttribute('data-theme', 'dark'); else root.removeAttribute('data-theme');
      store.set('fdi-theme', dark ? 'dark' : 'light'); paint();
    });
  }

  /* Mode léger : coupe 3D, flou, transparence, mouvement. Jamais activé sans choix. */
  var lb = $('#lite-btn');
  function paintLite() {
    var on = root.hasAttribute('data-lite');
    if (!lb) return;
    lb.setAttribute('aria-pressed', on ? 'true' : 'false');
    $('[data-lite-etat]', lb).textContent = on ? 'activé' : 'désactivé';
  }
  if (lb) {
    paintLite();
    lb.addEventListener('click', function () {
      var on = !root.hasAttribute('data-lite');
      if (on) root.setAttribute('data-lite', ''); else root.removeAttribute('data-lite');
      store.set('fdi-lite', on ? '1' : '0'); paintLite();
      d.dispatchEvent(new CustomEvent('fdi:lite', { detail: on }));
    });
    var cn = navigator.connection;
    if (cn && cn.saveData && store.get('fdi-lite') === null) {
      var h = d.createElement('p'); h.className = 'lite-hint';
      h.textContent = 'Votre navigateur demande d’économiser les données. Le mode léger allège la page.';
      lb.parentNode.insertBefore(h, lb);
    }
  }

  var cap = $('.cap'), nav = $('#nav-main'), burger = $('.menu-toggle'), bar = $('.bar');
  if (!cap) return;

  /* Page courante : le groupe qui contient la page porte la marque */
  var curLink = $('.nav [aria-current="page"]');
  var curSum = null;
  if (curLink) { var g = curLink.closest('.dd'); if (g) { curSum = $('summary', g); curSum.setAttribute('aria-current', 'true'); } }

  /* Compaction : sentinelle de 1 px, aucun écouteur de défilement pour cet état */
  var sent = $('.cap-sentinel');
  if (sent && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      var out = !es[0].isIntersecting;
      if (out) cap.setAttribute('data-compact', ''); else cap.removeAttribute('data-compact');
    }).observe(sent);
  }

  /* Indicateur voyageur */
  var ind = $('.indic'), items = $$('.nav-t'), cur = curSum, leaveT, placed = null;
  function place(el, instant) {
    if (!ind || !el || !desk.matches) return;
    var c = cap.getBoundingClientRect(), r = el.getBoundingClientRect();
    var first = !ind.classList.contains('on');
    if (instant || first) ind.classList.add('no-t');
    cap.style.setProperty('--ix', (r.left - c.left + 10) + 'px');
    cap.style.setProperty('--iw', Math.max(0, r.width - 20) + 'px');
    cap.style.setProperty('--iy', (r.bottom - c.top - 12) + 'px');
    ind.classList.add('on'); placed = el;
    if (instant || first) { void ind.offsetWidth; requestAnimationFrame(function () { ind.classList.remove('no-t'); }); }
  }
  function rest() { if (cur) place(cur); else if (ind) { ind.classList.remove('on'); placed = null; } }
  items.forEach(function (el) {
    el.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') { clearTimeout(leaveT); place(el); } });
    el.addEventListener('focus', function () { clearTimeout(leaveT); place(el); });
  });
  var nl = $('.nav-list');
  if (nl) {
    nl.addEventListener('pointerleave', function () { clearTimeout(leaveT); leaveT = setTimeout(rest, 140); });
    nl.addEventListener('focusout', function (e) { if (!nl.contains(e.relatedTarget)) { clearTimeout(leaveT); leaveT = setTimeout(rest, 140); } });
  }
  if (cur) place(cur, true);
  if ('ResizeObserver' in window) new ResizeObserver(function () { if (placed && cur === placed) place(cur, true); placeBar(); }).observe(cap);

  /* Panneaux : un seul à la fois, sortie animée, Échap, clic extérieur */
  var dds = $$('.dd'), hoverT;
  function openDD(dd) {
    clearTimeout(dd._t);
    dds.forEach(function (o) { if (o !== dd) closeDD(o, true); });
    var wrap = $('.panel-wrap', dd), s = $('summary', dd);
    var c = cap.getBoundingClientRect(), t = s.getBoundingClientRect();
    var w = Math.min(parseFloat(wrap.style.getPropertyValue('--pw')) || 560, innerWidth - 24);
    var left = Math.min(Math.max(t.left - c.left, 12 - c.left), innerWidth - 12 - w - c.left);
    wrap.style.setProperty('--px', left + 'px');
    dd.open = true;
    requestAnimationFrame(function () { requestAnimationFrame(function () { dd.setAttribute('data-state', 'in'); }); });
  }
  function closeDD(dd, fast) {
    if (!dd.open) return;
    clearTimeout(dd._t);
    dd.setAttribute('data-state', 'out');
    dd._t = setTimeout(function () { dd.open = false; dd.removeAttribute('data-state'); }, fast ? 0 : 170);
  }
  function anyIn() { return dds.some(function (o) { return o.getAttribute('data-state') === 'in'; }); }
  dds.forEach(function (dd) {
    var s = $('summary', dd);
    s.addEventListener('click', function (e) {
      if (!desk.matches) return;
      e.preventDefault();
      if (dd.getAttribute('data-state') === 'in') closeDD(dd); else openDD(dd);
    });
    dd.addEventListener('toggle', function () { if (!desk.matches) { if (dd.open) dd.setAttribute('data-state', 'in'); else dd.removeAttribute('data-state'); } });
    $('summary', dd).parentNode.addEventListener('pointerenter', function (e) {
      if (e.pointerType !== 'mouse' || !desk.matches || !anyIn() || dd.getAttribute('data-state') === 'in') return;
      clearTimeout(hoverT); hoverT = setTimeout(function () { openDD(dd); }, 80);
    });
    dd.addEventListener('pointerleave', function () { clearTimeout(hoverT); });
    dd.addEventListener('focusout', function (e) {
      if (desk.matches && dd.open && e.relatedTarget && !dd.contains(e.relatedTarget)) closeDD(dd);
    });
  });
  d.addEventListener('click', function (e) { dds.forEach(function (dd) { if (desk.matches && dd.open && !dd.contains(e.target)) closeDD(dd); }); });

  /* Tiroir mobile */
  function setDrawer(open) {
    nav.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    $$('main, .pied, .top').forEach(function (e) { e.inert = open; });
    drawerOpen = open; barUpdate();
  }
  var drawerOpen = false;
  if (burger) burger.addEventListener('click', function () { setDrawer(!drawerOpen); });
  d.addEventListener('click', function (e) { if (drawerOpen && !cap.contains(e.target)) setDrawer(false); });
  desk.addEventListener && desk.addEventListener('change', function () { if (desk.matches && drawerOpen) setDrawer(false); });
  d.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var done = false;
    dds.forEach(function (dd) { if (dd.open && desk.matches) { closeDD(dd); $('summary', dd).focus(); done = true; } });
    if (!done && drawerOpen) { setDrawer(false); burger.focus(); }
  });

  /* Barre basse : indicateur, masquage selon le geste */
  var bind = $('.bar-ind'), barCur = bar && $('[aria-current="page"]', bar);
  function placeBar() {
    if (!bind) return;
    if (!barCur || getComputedStyle(bar).display === 'none') { bind.classList.remove('on'); return; }
    var b = bar.getBoundingClientRect(), r = barCur.getBoundingClientRect();
    bar.style.setProperty('--bx', (r.left - b.left + 14) + 'px'); bar.style.setProperty('--bw', (r.width - 28) + 'px');
    bind.classList.add('on');
  }
  addEventListener('resize', placeBar); placeBar();
  var lastY = scrollY, acc = 0, typing = false, barForce = false, actionVis = false, hidden = false, upward = false;
  function barUpdate() {
    if (!bar) return;
    var hide = drawerOpen || typing || actionVis || (hidden && !barForce);
    if (barForce && !drawerOpen) hide = false;
    if (scrollY < 120 && !drawerOpen && !typing && !actionVis) hide = false;
    bar.toggleAttribute('data-hidden', hide);
  }
  if (bar) {
    bar.addEventListener('focusin', function () { barForce = true; barUpdate(); });
    bar.addEventListener('focusout', function () { barForce = false; barUpdate(); });
  }
  d.addEventListener('focusin', function (e) { if (e.target.matches && e.target.matches('input:not([type=radio]):not([type=checkbox]),textarea,select') && matchMedia('(max-width:767px)').matches) { typing = true; barUpdate(); } });
  d.addEventListener('focusout', function (e) { if (typing) { typing = false; barUpdate(); } });
  var act = $('.action');
  if (act && 'IntersectionObserver' in window) new IntersectionObserver(function (es) { actionVis = es[0].isIntersecting; barUpdate(); updTop(); }, { threshold: 0.6 }).observe(act);

  /* Progression de lecture, retour en haut */
  var prog = $('.cap-prog'), top = $('.top'), pied = $('.pied'), piedVis = false;
  function updTop() {
    if (!top) return;
    var on = (scrollY > innerHeight * 1.5 && upward) || piedVis;
    top.classList.toggle('on', on);
    if (on) top.hidden = false;
  }
  function onScroll() {
    var y = scrollY, dy = y - lastY; lastY = y;
    var max = d.documentElement.scrollHeight - innerHeight, p = max > 0 ? clamp(y / max) : 0;
    if (prog) { prog.classList.toggle("on", max > innerHeight && y > 8); cap.style.setProperty('--p', p.toFixed(4)); }
    if (top) top.style.setProperty('--p', p.toFixed(4));
    if (dy !== 0) { if ((dy > 0) !== (acc > 0)) acc = 0; acc += dy; }
    if (acc >= 16) { hidden = true; upward = false; } else if (acc <= -8) { hidden = false; upward = true; }
    barUpdate(); updTop();
  }
  var q = false;
  addEventListener('scroll', function () { if (!q) { q = true; requestAnimationFrame(function () { q = false; onScroll(); }); } }, { passive: true });
  onScroll();
  if (top) top.addEventListener('click', function () {
    scrollTo({ top: 0, behavior: reduce.matches || root.hasAttribute('data-lite') ? 'auto' : 'smooth' });
    var h = $('h1'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  });

  /* Pied de page : emboîtement du logo et titre, une seule fois */
  var pp = $('.pied-panel');
  if (pied && pp && 'IntersectionObserver' in window) {
    var once = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { pied.classList.add('go'); once.disconnect(); } }, { threshold: 0.4 });
    once.observe(pp);
    new IntersectionObserver(function (es) { piedVis = es[0].isIntersecting; updTop(); }).observe(pied);
  } else if (pied) pied.classList.add('go');

  /* Bureaux */
  var BUR = { pap: 'Port-au-Prince', cap: 'Cap-Haïtien', cay: 'Les Cayes' };
  var radios = $$('input[name=bureau]'), det = $('.bur-detail'), marks = $$('.mk');
  function showBur(id, instant) {
    marks.forEach(function (m) { m.classList.toggle('is-on', m.getAttribute('data-o') === id); });
    if (!det) return;
    var fill = function () {
      $('[data-bn]', det).textContent = 'Bureau de ' + BUR[id];
      $('[data-ba]', det).textContent = '00, rue d’Exemple, ' + BUR[id];
      det.classList.remove('chg');
    };
    if (instant || reduce.matches) fill(); else { det.classList.add('chg'); setTimeout(fill, 150); }
  }
  radios.forEach(function (r) { r.addEventListener('change', function () { if (r.checked) showBur(r.value); }); });
  marks.forEach(function (m) { m.addEventListener('click', function () { var r = radios.filter(function (x) { return x.value === m.getAttribute('data-o'); })[0]; if (r) { r.checked = true; showBur(r.value); } }); });
  showBur('pap', true);
  if (location.hash === '#bureaux') { var bt = $('#bureaux'); if (bt) bt.focus({ preventScroll: true }); }

  /* Copier le courriel : clipboard, puis execCommand, puis sélection */
  var cb = $('#copy-mail'), st = $('#copy-status'), mt = $('#mail-txt');
  if (cb) {
    var ct;
    var done = function (okk) {
      var la = $('.l-a', cb), old = la.textContent;
      if (okk) { cb.setAttribute('data-ok', ''); st.textContent = 'Courriel copié'; }
      else { la.textContent = 'Sélectionnez et copiez'; st.textContent = 'Copie impossible. Sélectionnez et copiez.'; var r = d.createRange(); r.selectNodeContents(mt); var sl = getSelection(); sl.removeAllRanges(); sl.addRange(r); }
      clearTimeout(ct); ct = setTimeout(function () { cb.removeAttribute('data-ok'); la.textContent = 'Copier le courriel'; st.textContent = ''; }, 2000);
    };
    cb.addEventListener('click', function () {
      var t = mt.textContent.trim();
      var fb = function () {
        var ta = d.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0';
        d.body.appendChild(ta); ta.select(); var ok = false; try { ok = d.execCommand('copy'); } catch (e) {} ta.remove(); done(ok);
      };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(function () { done(true); }, fb); else fb();
    });
  }

  /* Reprendre là où vous étiez (état local, 30 jours) */
  $$('[data-resume],[data-resume-t],[data-resume-p],.drawer-card b,.drawer-card span').forEach(function (e) { e._o = e.textContent; });
  function lire(k, tsk) {
    var raw = store.get(k); if (!raw) return null;
    try {
      var o = JSON.parse(raw), ts = o.ts || (tsk && +store.get(tsk)) || 0;
      if (ts && Date.now() - ts > EXPIRE) { store.del(k); if (tsk) store.del(tsk); return null; }
      return o;
    } catch (e) { return null; }
  }
  function setTxt(sel, v) { $$(sel).forEach(function (e) { e.textContent = v === null ? e._o : v; }); }
  function resume() {
    var ORDRE = ['secteur', 'taille', 'projet', 'besoin', 'montant'];
    var e = lire(CLES.elig), c = lire(CLES.chk, CLES.chkTs), qn = null, n = 0;
    if (e && e.etape && e.etape !== 'resultat' && ORDRE.indexOf(e.etape) > 0) qn = ORDRE.indexOf(e.etape) + 1;
    var lbl = qn ? 'Reprendre le test, question ' + qn + ' sur 5' : null;
    setTxt('[data-resume-t="elig"]', qn ? 'Reprendre le test' : null);
    setTxt('[data-resume-p="elig"]', qn ? 'Question ' + qn + ' sur 5. Vos réponses restent sur cet appareil.' : null);
    setTxt('[data-resume="elig-btn"]', qn ? 'Reprendre' : null);
    setTxt('[data-resume-t="elig-lien"]', lbl);
    setTxt('[data-resume="elig-pied-btn"]', lbl);
    setTxt('.drawer-card b', qn ? 'Reprendre le test' : null);
    setTxt('.drawer-card span', qn ? 'Question ' + qn + ' sur 5.' : null);
    if (c && c.coches && c.coches.length) n = c.coches.length;
    setTxt('[data-resume-t="chk-lien"]', n ? 'Reprendre la checklist, ' + n + ' sur 43' : null);
    setTxt('[data-resume-p="chk-lien"]', n ? 'Vos cases cochées restent sur cet appareil.' : null);
    var ef = $('[data-resume-eff]'); if (ef) ef.hidden = !(qn || n);
  }
  resume();
  $$('[data-effacer]').forEach(function (b) { b.addEventListener('click', function () { [CLES.elig, CLES.chk, CLES.chkTs, CLES.sim, CLES.demande].forEach(store.del); resume(); b.parentNode.insertAdjacentHTML('beforeend', ' <span role="status">Données effacées.</span>'); }); });
  // Liens de démonstration sans destination : message au lieu d'un retour silencieux en haut de page.
  var hors = d.createElement('div');
  hors.className = 'hors-demo'; hors.setAttribute('role', 'status'); hors.hidden = true;
  hors.textContent = 'Cette page n’est pas incluse dans la démo.';
  d.body.appendChild(hors);
  var horsT;
  $$('a[href="#"]').forEach(function (a) { a.setAttribute('aria-disabled', 'true'); });
  d.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href="#"]');
    if (!a) return;
    e.preventDefault();
    hors.hidden = false; clearTimeout(horsT);
    horsT = setTimeout(function () { hors.hidden = true; }, 3500);
  });
  window.FDICommun = { cles: CLES, store: store, resume: resume };
})();
