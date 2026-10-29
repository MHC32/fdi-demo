/* Checklist du dossier : interface de lib/checklist.js (via bundle.js). Aucun appel réseau.
   Clés de stockage local :
     fdi.checklist    : { version, coches: [identifiants] }  écrit par la bibliothèque
     fdi.checklist.ts : horodatage du dernier changement, pour l'expiration à 30 jours (lu par commun.js) */
(function () {
  'use strict';
  var C = window.FDIOutils.checklist, d = document, root = d.documentElement;
  function $(s, c) { return (c || d).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); }
  var TS = 'fdi.checklist.ts', EXPIRE = 30 * 864e5;
  var store = null;
  try { store = window.localStorage; store.getItem('fdi.checklist'); } catch (e) { store = null; }
  if (store) { try { var ts = +store.getItem(TS); if (ts && Date.now() - ts > EXPIRE) { store.removeItem('fdi.checklist'); store.removeItem(TS); } } catch (e) {} }
  var k = C.creer({ stockage: store });
  var boxes = $$('input[data-id]'), cats = $$('.cat'), segs = $$('#gsegs span');
  var wasFull = {}, restoring = true;

  function update(announce) {
    var p = k.progression();
    $('#p-n').textContent = p.coche; $('#p-tot').textContent = p.total;
    var reste = p.total - p.coche;
    $('#p-reste').textContent = reste === 0 ? 'Tous les documents sont prêts.' : reste + (reste > 1 ? ' documents restent' : ' document reste') + ' à préparer.';
    var nFull = 0;
    p.parCategorie.forEach(function (pc, i) {
      var cat = cats[i], full = pc.coche === pc.total; if (full) nFull++;
      $('[data-n]', cat).textContent = pc.coche;
      cat.style.setProperty('--p', (pc.coche / pc.total).toFixed(3));
      $('.cat-full', cat).hidden = !full;
      cat.classList.toggle('is-full', full);
      segs[i].style.setProperty('--p', (pc.coche / pc.total).toFixed(3));
      segs[i].classList.toggle('full', full);
      if (announce && full && !wasFull[pc.id]) $('#cat-status').textContent = $('.cat-name', cat).textContent + ' : complet.';
      wasFull[pc.id] = full;
    });
    $('#all-ok').hidden = nFull !== p.parCategorie.length;
    $('#stock-ko').hidden = k.sauvegardeDisponible;
    $('#stock-ok').hidden = !k.sauvegardeDisponible;
  }
  boxes.forEach(function (b) {
    b.checked = k.estCoche(b.getAttribute('data-id'));
    b.addEventListener('change', function () {
      k.cocher(b.getAttribute('data-id'), b.checked);
      try { if (store) store.setItem(TS, String(Date.now())); } catch (e) {}
      update(true);
    });
  });
  update(false);
  /* première catégorie incomplète ouverte, les autres repliées (le HTML les livre toutes ouvertes pour le cas sans JS) */
  var firstOpen = cats.filter(function (c) { return !c.classList.contains('is-full'); })[0] || cats[0];
  cats.forEach(function (c) { c.open = c === firstOpen; });
  requestAnimationFrame(function () { requestAnimationFrame(function () { restoring = false; root.classList.remove('restoring'); }); });
  root.classList.add('restoring');

  /* impression : toutes les catégories ouvertes, puis retour à l'état précédent */
  var openState = [];
  window.addEventListener('beforeprint', function () { openState = cats.map(function (c) { return c.open; }); cats.forEach(function (c) { c.open = true; }); });
  window.addEventListener('afterprint', function () { cats.forEach(function (c, i) { c.open = openState[i]; }); });
  $('#print').addEventListener('click', function () { window.print(); });

  /* réinitialisation : fenêtre native (focus piégé, Échap, focus rendu) */
  var dlg = $('#dlg'), opener = null;
  $$('[data-ouvrir-dlg]').forEach(function (b) { b.addEventListener('click', function () { opener = b; if (dlg.showModal) dlg.showModal(); else if (confirm('Effacer toutes les cases cochées ?')) vider(); }); });
  function vider() {
    k.reinitialiser(); try { if (store) store.removeItem(TS); } catch (e) {}
    boxes.forEach(function (b) { b.checked = false; }); wasFull = {}; root.classList.add('restoring'); update(false);
    requestAnimationFrame(function () { root.classList.remove('restoring'); });
    $('#cat-status').textContent = 'Cases effacées.';
  }
  dlg.addEventListener('close', function () { if (dlg.returnValue === 'effacer') vider(); dlg.returnValue = ''; if (opener) opener.focus(); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close('annuler'); });
  if (window.FDICommun) window.FDICommun.resume();
})();
