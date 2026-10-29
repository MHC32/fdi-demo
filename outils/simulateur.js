/* Simulateur de prêt : interface de lib/simulateur.js (via bundle.js). Aucun appel réseau.
   Clés de stockage local :
     fdi.simulateur : { valeurs, ts }  dernier état saisi, relu à l'ouverture (30 jours)
     fdi.demande    : { simulateur: {monnaie_operation, montant_financement_sollicite, conditions}, ts }
                      écrit par « Utiliser dans ma demande », lu par le futur formulaire (outils/demande.html l'affiche). */
(function () {
  'use strict';
  var S = window.FDIOutils.simulateur;
  var d = document;
  function $(s, c) { return (c || d).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); }
  var K_SIM = 'fdi.simulateur', K_DEM = 'fdi.demande', EXPIRE = 30 * 864e5;
  function get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function del(k) { try { localStorage.removeItem(k); } catch (e) {} }

  var form = $('#sim'), reduce = matchMedia('(prefers-reduced-motion: reduce)');
  var nfi = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  /* Rubik n'a pas l'espace fine insécable de fr-FR : on la remplace par l'espace insécable ordinaire */
  var nf = { format: function (n) { return nfi.format(n).replace(/[\u202f]/g, '\u00a0'); } };
  var nf1 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  var F = { montant: $('#montant'), duree: $('#duree'), taux: $('#taux'), differe: $('#differe') };
  var DEF = { montant: '1 000 000', duree: '60', taux: '12,0', differe: '6', devise: 'HTG', besoin: 'immobilisations' };
  var MAP = { montant: 'montant', duree: 'duree', taux: 'taux', differe: 'differe' };
  var dirty = {}, shown = false, last = null, timer;

  function radio(n) { return $('input[name=' + n + ']:checked').value; }
  function read() { return { montant: F.montant.value, devise: radio('devise'), dureeMois: F.duree.value, tauxAnnuel: F.taux.value, differeMois: F.differe.value, besoin: radio('besoin') }; }
  function money(n, dev) { return nf.format(Math.round(n)) + ' ' + dev; }
  function pct(x) { return nf1.format(x * 100) + ' %'; }
  function show(which) { ['res-vide', 'res-err', 'res-ok'].forEach(function (i) { $('#' + i).hidden = i !== which; }); }
  var WARN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17.5v.5"/></svg>';
  var ERRI = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/></svg>';

  function setErrors(er, visible) {
    Object.keys(MAP).forEach(function (k) {
      var key = k === 'duree' ? 'duree' : k, msg = visible ? er[key] : '';
      var box = $('#e-' + k), fld = $('#f-' + k);
      box.hidden = !msg; box.innerHTML = msg ? ERRI + '<span></span>' : ''; if (msg) $('span', box).textContent = msg;
      fld.classList.toggle('field--err', !!msg);
      F[k].setAttribute('aria-invalid', msg ? 'true' : 'false');
    });
  }

  function table(c) {
    var b = $('#amort-b'), rows = c.resultat.lignes;
    $('#amort-t').textContent = 'Tableau d’amortissement (' + rows.length + ' lignes)';
    if (!$('#amort').open) { b.innerHTML = ''; b._stale = true; return; }
    fillTable(c);
  }
  function fillTable(c) {
    var html = '';
    c.resultat.lignes.forEach(function (l) {
      html += '<tr' + (l.differe ? ' class="differe"' : '') + '><td>' + l.mois + (l.differe ? ' (différé)' : '') + '</td><td>' + nf.format(Math.round(l.paiement)) + '</td><td>' + nf.format(Math.round(l.interets)) + '</td><td>' + nf.format(Math.round(l.capital)) + '</td><td>' + nf.format(Math.round(l.solde)) + '</td></tr>';
    });
    $('#amort-b').innerHTML = html; $('#amort-b')._stale = false;
  }

  function render(c) {
    var r = c.resultat, dev = c.devise, e = c.entree;
    show('res-ok'); $('#amort').hidden = false;
    var n = r.echeancesAmortissement;
    $('#men').textContent = nf.format(Math.round(r.mensualite)); $('#dev1').textContent = dev;
    $('#men-sub').textContent = 'pendant ' + n + ' mois';
    var df = $('#men-diff');
    df.hidden = !(e.differeMois > 0);
    if (!df.hidden) df.textContent = 'Pendant les ' + e.differeMois + ' premiers mois : ' + money(r.mensualiteDiffere, dev) + ' par mois, intérêts seulement.';
    $('#k-emp').textContent = money(e.montant, dev); $('#k-remb').textContent = money(r.totalRembourse, dev);
    var kp = e.montant / r.totalRembourse, cp = 1 - kp;
    var bar = $('#bar2'); bar.style.setProperty('--k', (kp * 100).toFixed(2)); bar.style.setProperty('--c', (cp * 100).toFixed(2));
    $('#p-k').textContent = pct(kp); $('#p-c').textContent = pct(cp);
    var phrase = 'Sur ' + money(r.totalRembourse, dev) + ' remboursés, ' + money(e.montant, dev) + ' sont le capital et ' + money(r.coutTotal, dev) + ' le coût du crédit (' + pct(cp) + ').';
    bar.setAttribute('aria-label', phrase);
    var al = $('#alertes'); al.innerHTML = '';
    c.alertes.forEach(function (t) { var p = d.createElement('p'); p.className = 'msg msg--warn'; p.innerHTML = WARN + '<span></span>'; $('span', p).textContent = t; al.appendChild(p); });
    table(c);
    $('#use-ok').hidden = true;
    clearTimeout(timer);
    timer = setTimeout(function () { $('#annonce').textContent = 'Mensualité estimée : ' + nf.format(Math.round(r.mensualite)) + (dev === 'HTG' ? ' gourdes' : ' dollars'); }, 300);
  }

  function run(showErr) {
    var c = S.calculer(read()); last = c;
    var bad = Object.keys(c.erreurs).length > 0;
    if (!bad) { shown = true; setErrors({}, false); render(c); persist(); return; }
    if (showErr) { setErrors(c.erreurs, true); show('res-err'); $('#amort').hidden = true; shown = true; }
    else if (shown && $('#res-err').hidden === false) { /* garde l'état d'erreur */ }
    else if (shown) { show('res-err'); $('#amort').hidden = true; }
  }
  function persist() { set(K_SIM, { valeurs: { montant: F.montant.value, duree: F.duree.value, taux: F.taux.value, differe: F.differe.value, devise: radio('devise'), besoin: radio('besoin') }, ts: Date.now() }); }

  /* événements */
  $$('.in', form).forEach(function (el) {
    el.addEventListener('input', function () { dirty[el.id] = true; var ex = $('[data-ex=' + el.id + ']'); if (ex) ex.hidden = true; run(false); });
    el.addEventListener('change', function () { run(true); });
  });
  $$('input[type=radio]', form).forEach(function (r) {
    r.addEventListener('change', function () { if (r.name === 'devise') $$('[data-devise]').forEach(function (u) { u.textContent = r.value; }); run(false); });
  });
  $$('[data-step]', form).forEach(function (b) {
    b.addEventListener('click', function () {
      var el = F[b.getAttribute('data-step')], v = parseInt(String(el.value).replace(/\s/g, ''), 10);
      if (isNaN(v)) v = 0;
      el.value = Math.max(el.id === 'duree' ? 1 : 0, v + parseInt(b.getAttribute('data-d'), 10));
      dirty[el.id] = true; run(true);
    });
  });
  form.addEventListener('submit', function (e) { e.preventDefault(); run(true); if (last && !Object.keys(last.erreurs).length) $('#res').scrollIntoView({ block: 'nearest', behavior: reduce.matches ? 'auto' : 'smooth' }); });
  $('#reset').addEventListener('click', function () {
    F.montant.value = DEF.montant; F.duree.value = DEF.duree; F.taux.value = DEF.taux; F.differe.value = DEF.differe;
    $('input[name=devise][value=HTG]').checked = true; $('input[name=besoin][value=immobilisations]').checked = true;
    $$('[data-devise]').forEach(function (u) { u.textContent = 'HTG'; }); $$('[data-ex]').forEach(function (x) { x.hidden = false; });
    dirty = {}; shown = false; last = null; setErrors({}, false); show('res-vide'); $('#amort').hidden = true; del(K_SIM); $('#annonce').textContent = 'Simulation réinitialisée.';
  });
  $('#amort').addEventListener('toggle', function () { if ($('#amort').open && last && last.resultat && $('#amort-b')._stale !== false) fillTable(last); });
  $('#print').addEventListener('click', function () { window.print(); });
  $('#use').addEventListener('click', function () {
    var pre = S.preremplirDemande(last); if (!pre) return;
    var cur = get(K_DEM) || {}; cur.simulateur = pre; cur.ts = Date.now();
    var ok = set(K_DEM, cur), m = $('#use-ok');
    m.hidden = false;
    m.innerHTML = '<span></span>';
    $('span', m).textContent = ok ? 'Enregistré sur cet appareil. Le formulaire de demande reprendra le montant, la devise et les conditions.' : 'Enregistrement impossible : le stockage de ce navigateur est bloqué. Notez les valeurs avant de quitter la page.';
    if (ok) { var a = d.createElement('a'); a.href = 'demande.html'; a.textContent = ' Ouvrir la demande.'; $('span', m).appendChild(a); }
  });

  /* reprise de la dernière saisie */
  var old = get(K_SIM);
  if (old && old.valeurs && Date.now() - old.ts < EXPIRE) {
    var v = old.valeurs;
    F.montant.value = v.montant; F.duree.value = v.duree; F.taux.value = v.taux; F.differe.value = v.differe;
    var rd = $('input[name=devise][value=' + (v.devise === 'USD' ? 'USD' : 'HTG') + ']'); rd.checked = true; $$('[data-devise]').forEach(function (u) { u.textContent = rd.value; });
    var rb = $('input[name=besoin][value=' + (v.besoin === 'fonds_de_roulement' ? 'fonds_de_roulement' : 'immobilisations') + ']'); rb.checked = true;
    $$('[data-ex]').forEach(function (x) { x.hidden = true; });
    run(false);
  }
})();
