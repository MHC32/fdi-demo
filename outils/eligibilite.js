/* Test d'éligibilité : interface de lib/eligibilite.js (via bundle.js). Aucun appel réseau.
   Clés de stockage local :
     fdi.eligibilite : { etape, reponses, historique, ts }  progression, relue à l'ouverture (30 jours)
     fdi.demande     : { eligibilite: {type_projet, type_financement_sollicite, montant..., monnaie...}, ts }
                       écrit par « Utiliser dans ma demande » ; outils/demande.html l'affiche. */
(function () {
  'use strict';
  var E = window.FDIOutils.eligibilite, d = document;
  function $(s, c) { return (c || d).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); }
  var K = 'fdi.eligibilite', K_DEM = 'fdi.demande', EXPIRE = 30 * 864e5;
  function get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  var ORDRE = ['secteur', 'taille', 'projet', 'besoin', 'montant'];
  var NOMS = { secteur: 'Secteur', taille: 'Taille', projet: 'Type de projet', besoin: 'Besoin', montant: 'Montant' };
  var nfi = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
  function nf(n) { return nfi.format(n).replace(/[ ]/g, ' '); }
  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  var e = E.demarrer(), dir = 1, started = false;
  var WARN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17.5v.5"/></svg>';
  var INFO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.5"/></svg>';
  var ERRI = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/></svg>';

  function save() { set(K, { etape: e.etape, reponses: e.reponses, historique: e.historique, ts: Date.now() }); }
  function q(id) { return E.QUESTIONS.filter(function (x) { return x.id === id; })[0]; }
  function libOpt(id, v) { var o = (q(id).options || []).filter(function (x) { return x.id === v; })[0]; return o ? o.libelle : String(v); }
  function resume(id) {
    var v = e.reponses[id]; if (v === undefined) return '';
    if (id === 'taille') return v + (v > 1 ? ' employés' : ' employé');
    if (id === 'montant') return nf(v.montant) + ' ' + v.devise;
    return libOpt(id, v);
  }
  function show(which) { ['intro', 'quest', 'resultat'].forEach(function (i) { $('#' + i).hidden = i !== which; }); }
  function txt(tag, cls, t) { var n = d.createElement(tag); if (cls) n.className = cls; if (t !== undefined) n.textContent = t; return n; }

  /* ---------- intro ---------- */
  function intro() {
    show('intro');
    var n = ORDRE.indexOf(e.etape) + 1, go = $('#go'), rs = $('#restart');
    if (e.etape === 'resultat') { go.textContent = 'Revoir mes résultats'; rs.hidden = false; }
    else if (e.historique.length) { go.textContent = 'Reprendre le test, question ' + n + ' sur 5'; rs.hidden = false; }
    else { go.textContent = 'Commencer'; rs.hidden = true; }
  }

  /* ---------- une question ---------- */
  function fil() {
    var ol = $('#fil'); ol.innerHTML = '';
    ORDRE.forEach(function (id) {
      var li = txt('li'), done = e.reponses[id] !== undefined && id !== e.etape;
      li.className = 'fil-i' + (done ? ' done' : '') + (id === e.etape ? ' cur' : '');
      if (id === e.etape) li.setAttribute('aria-current', 'step');
      var s = txt('span', 'fil-n', NOMS[id]); li.appendChild(s);
      if (done) {
        li.appendChild(txt('span', 'fil-a', resume(id)));
        var b = txt('button', 'link-btn', 'Modifier'); b.type = 'button'; b.setAttribute('aria-label', 'Modifier : ' + NOMS[id]);
        b.addEventListener('click', function () { goto(id); });
        li.appendChild(b);
      }
      ol.appendChild(li);
    });
    $$('#segs span').forEach(function (sp, i) { var id = ORDRE[i]; sp.className = (e.reponses[id] !== undefined && id !== e.etape ? 'on' : '') + (id === e.etape ? ' cur' : ''); });
  }
  function goto(id) {
    var i = ORDRE.indexOf(id);
    e = { etape: id, reponses: e.reponses, historique: ORDRE.slice(0, i).filter(function (x) { return e.reponses[x] !== undefined; }), erreur: null, resultat: null, options: e.options };
    dir = 1; save(); question(true);
  }
  function question(focus) {
    show('quest');
    var qq = q(e.etape), n = ORDRE.indexOf(e.etape) + 1, body = $('#q-body');
    $('#q-n').textContent = 'Question ' + n + ' sur 5';
    body.innerHTML = ''; setErr(e.erreur);
    var h = txt('h2', '', qq.libelle); h.id = 'q-h'; h.tabIndex = -1; body.appendChild(h);
    var cur = e.reponses[e.etape];
    if (qq.options) {
      var fs = txt('fieldset', 'chips opts' + (qq.options.length > 8 ? ' opts--long' : '')); var lg = txt('legend', 'sr', qq.libelle); fs.appendChild(lg);
      qq.options.forEach(function (o) {
        var lb = txt('label', 'chip2'), inp = d.createElement('input'); inp.type = 'radio'; inp.name = 'rep'; inp.value = o.id; if (cur === o.id) inp.checked = true;
        lb.appendChild(inp); lb.appendChild(txt('span', '', o.libelle)); fs.appendChild(lb);
      });
      body.appendChild(fs);
    } else if (e.etape === 'taille') {
      var f = txt('div', 'field'); var lb = txt('label', '', 'Nombre d’employés'); lb.htmlFor = 'rep-t';
      var inp = txt('input', 'in'); inp.id = 'rep-t'; inp.inputMode = 'numeric'; inp.value = cur !== undefined ? cur : ''; inp.style.maxWidth = '12rem';
      f.appendChild(lb); f.appendChild(inp); f.appendChild(txt('p', 'hint', 'Cette réponse sert à l’affichage seulement. Elle ne change pas les produits proposés.')); body.appendChild(f);
    } else {
      var g = txt('fieldset', 'chips'); g.appendChild(txt('legend', 'lbl', 'Monnaie'));
      ['HTG', 'USD'].forEach(function (dv) {
        var lb = txt('label', 'chip2'), inp = d.createElement('input'); inp.type = 'radio'; inp.name = 'dev'; inp.value = dv; if ((cur ? cur.devise : 'HTG') === dv) inp.checked = true;
        lb.appendChild(inp); lb.appendChild(txt('span', '', dv === 'HTG' ? 'HTG, gourde' : 'USD, dollar')); g.appendChild(lb);
      });
      body.appendChild(g);
      var f2 = txt('div', 'field'); var l2 = txt('label', '', 'Montant sollicité'); l2.htmlFor = 'rep-m';
      var w = txt('div', 'in-wrap'), i2 = txt('input', 'in'); i2.id = 'rep-m'; i2.inputMode = 'decimal'; i2.value = cur ? String(cur.montant).replace('.', ',') : '';
      w.appendChild(i2); f2.appendChild(l2); f2.appendChild(w); body.appendChild(f2);
      f2.style.marginTop = 'var(--sp-4)'; f2.style.maxWidth = '22rem';
    }
    $('#back').hidden = !e.historique.length;
    $('#next').textContent = e.etape === 'montant' ? 'Voir les produits' : 'Continuer';
    fil();
    var card = $('#qform'); card.classList.remove('enter-f', 'enter-b'); void card.offsetWidth;
    if (started && !reduce.matches) card.classList.add(dir > 0 ? 'enter-f' : 'enter-b');
    if (focus) { h.focus({ preventScroll: true }); h.scrollIntoView({ block: 'nearest' }); }
    started = true;
  }
  function setErr(m) {
    var b = $('#q-err'); b.hidden = !m; b.innerHTML = m ? ERRI + '<span></span>' : ''; if (m) $('span', b).textContent = m;
  }
  function value() {
    var id = e.etape;
    if (id === 'taille') return $('#rep-t').value;
    if (id === 'montant') { var dv = $('input[name=dev]:checked'); return { montant: $('#rep-m').value, devise: dv ? dv.value : '' }; }
    var c = $('input[name=rep]:checked'); return c ? c.value : undefined;
  }
  $('#qform').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var nx = E.repondre(e, value());
    if (nx.erreur) { e = nx; setErr(e.erreur); var f = $('#q-body input'); return; }
    e = nx; dir = 1; save();
    if (e.etape === 'resultat') resultat(); else question(true);
  });
  $('#back').addEventListener('click', function () { e = E.retour(e); dir = -1; save(); question(true); });

  /* ---------- résultat ---------- */
  function card(p) {
    var c = txt('article', 'card pcard'); var pr = txt('div', 'pair'); pr.setAttribute('aria-hidden', 'true'); pr.appendChild(txt('i')); pr.appendChild(txt('i')); c.appendChild(pr);
    c.appendChild(txt('h3', '', p.nom));
    if (p.aConfirmer) { var t = txt('span', 'ex', 'À confirmer par le FDI'); c.appendChild(t); }
    var why = txt('p'); var b = txt('strong', '', 'Pourquoi : '); why.appendChild(b); why.appendChild(d.createTextNode(p.raison)); c.appendChild(why);
    if (p.conditions.length) { var u = txt('ul', 'cond'); var lead = txt('p', 'hint', 'À vérifier'); c.appendChild(lead); p.conditions.forEach(function (x) { u.appendChild(txt('li', '', x)); }); c.appendChild(u); }
    p.avertissements.forEach(function (x) { var m = txt('p', 'msg msg--warn'); m.innerHTML = WARN + '<span></span>'; $('span', m).textContent = x; c.appendChild(m); });
    var r = txt('div', 'row');
    var s = txt('a', 'btn btn--secondary', 'Simuler un prêt'); s.href = 'simulateur.html'; r.appendChild(s);
    var u2 = txt('button', 'btn btn--primary', 'Utiliser dans ma demande'); u2.type = 'button';
    u2.addEventListener('click', function () {
      var cur = get(K_DEM) || {}; cur.eligibilite = E.preremplirDemande(e.reponses, p.slug); cur.ts = Date.now();
      var ok = set(K_DEM, cur), m = $('#r-ok'); m.hidden = false; m.innerHTML = '<span></span>';
      $('span', m).textContent = ok ? 'Enregistré sur cet appareil pour la demande en ligne. ' : 'Enregistrement impossible : le stockage de ce navigateur est bloqué. ';
      if (ok) { var a = txt('a', '', 'Ouvrir la demande.'); a.href = 'demande.html'; $('span', m).appendChild(a); }
    });
    r.appendChild(u2); c.appendChild(r);
    return c;
  }
  function resultat() {
    show('resultat');
    var r = e.resultat || E.recommander(e.reponses, e.options || {}); e.resultat = r;
    var msg = $('#r-msg'), cards = $('#r-cards'), via = $('#r-via'); msg.innerHTML = ''; cards.innerHTML = ''; via.innerHTML = ''; $('#r-ok').hidden = true;
    if (!r.produits.length) {
      var m = txt('p', 'msg msg--info'); m.innerHTML = INFO + '<span></span>'; $('span', m).textContent = 'Nous ne pouvons pas vous orienter vers un produit avec ces réponses. Contactez un bureau du FDI pour étudier votre projet.';
      msg.appendChild(m);
      if (r.aConfirmer) { var m2 = txt('p', 'hint', r.message); msg.appendChild(m2); }
    } else {
      var m0 = txt('p', '', r.message); msg.appendChild(m0);
      r.avertissementsGeneraux.forEach(function (x) { var m = txt('p', 'msg msg--warn'); m.innerHTML = WARN + '<span></span>'; $('span', m).textContent = x; msg.appendChild(m); });
      if (r.ordreAConfirmer) msg.appendChild(txt('p', 'hint', 'L’ordre des cartes n’est pas une hiérarchie : l’ordre de priorité reste à confirmer par le FDI.'));
      r.produits.forEach(function (p, i) { var c = card(p); c.style.setProperty('--i', i); cards.appendChild(c); });
      if (r.viaIntermediaire && r.viaIntermediaire.length) {
        var bx = txt('div', 'card'); bx.appendChild(txt('h3', '', 'Disponibles via votre banque partenaire'));
        var ul = txt('ul', 'cond'); r.viaIntermediaire.forEach(function (v) { ul.appendChild(txt('li', '', v.nom + ' : ' + v.note)); }); bx.appendChild(ul); via.appendChild(bx);
      }
    }
    var h = $('#t-res'); h.focus({ preventScroll: true }); h.scrollIntoView({ block: 'start' });
  }
  $('#edit').addEventListener('click', function () { goto('secteur'); });
  function recommencer() { del(K); e = E.demarrer(); started = false; dir = 1; question(true); }
  $('#again').addEventListener('click', recommencer);
  $('#restart').addEventListener('click', recommencer);
  $('#go').addEventListener('click', function () {
    if (e.etape === 'resultat') { e.resultat = null; resultat(); } else question(true);
  });

  /* reprise */
  var old = get(K);
  if (old && old.etape && Date.now() - old.ts < EXPIRE && ORDRE.concat('resultat').indexOf(old.etape) >= 0) {
    e = { etape: old.etape, reponses: old.reponses || {}, historique: old.historique || [], erreur: null, resultat: null, options: {} };
  }
  intro();
})();
