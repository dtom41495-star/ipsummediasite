// Accueil : « Ça se passe chez vous » = les 5 prochains événements de l'agenda, ceux de la commune du visiteur d'abord (la même commune retenue
// pour « Près de chez vous »), dans l'édition affichée. Lit /flux/agenda.json (écrit à la génération du site) : aucune requête vers la base.
(function () {
  'use strict';
  var section = document.getElementById('chez-vous'), grille = document.getElementById('chez-vous-grille');
  if (!section || !grille) return;
  var memo = document.getElementById('chez-vous-memo'), tout = document.getElementById('chez-vous-tout');
  var CATEGORIES = { concert: 'Concert', sport: 'Sport', culture: 'Culture', marche_fete: 'Marché et fête', reunion_publique: 'Réunion publique', autre: 'Autre' };
  var CLE_COMMUNE = 'ipsum_ma_commune', NB = 5, evs = null;

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function slugVille(n) { return String(n || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
  function maCommune() { try { return localStorage.getItem(CLE_COMMUNE) || ''; } catch (e) { return ''; } }
  function edition() {
    var m = location.pathname.match(/^\/(tarn|haute-garonne|national)\/?$/);
    if (m) return m[1];
    var q = new URLSearchParams(location.search).get('edition');
    return q === 'tarn' || q === 'haute-garonne' || q === 'national' ? q : '';
  }
  function quand(e) {
    var d = new Date(e.date_debut);
    var jour = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Paris' }).replace(/\./g, '');
    var h = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).replace(':', 'h');
    return jour.charAt(0).toUpperCase() + jour.slice(1) + ' · ' + h;
  }
  function carte(e) {
    return '<a class="une-card ag-carte" href="/evenement/' + encodeURIComponent(e.slug) + '">' +
      (e.photo ? '<span class="une-img"><img src="' + esc(e.photo) + '" alt="" decoding="async" loading="lazy"></span>' : '') +
      '<span class="kicker">' + esc(CATEGORIES[e.categorie] || 'Événement') + ' · ' + esc(e.commune) + '</span>' +
      '<h3>' + esc(e.titre) + '</h3>' +
      '<span class="une-meta">' + esc(quand(e)) + ' · ' + esc(e.lieu) + '</span></a>';
  }

  function rendre() {
    if (!evs) return;
    var ed = edition(), ma = maCommune();
    var pool = evs.filter(function (e) { return !ed || ed === 'national' || e.edition === ed; });
    var chez = ma ? pool.filter(function (e) { return slugVille(e.commune) === ma; }) : [];
    var reste = pool.filter(function (e) { return chez.indexOf(e) === -1; });
    var liste = chez.concat(reste).slice(0, NB);
    if (!liste.length) { section.hidden = true; return; }
    grille.innerHTML = liste.map(carte).join('');
    var edLien = ed && ed !== 'national' ? ed : liste[0].edition;
    if (tout) {
      if (chez.length) { tout.href = '/agenda/' + chez[0].edition + '/' + ma; tout.textContent = 'Tout l’agenda à ' + chez[0].commune; }
      else { tout.href = '/agenda/' + edLien; tout.textContent = 'Tout l’agenda'; }
    }
    if (memo) {
      if (chez.length) { memo.hidden = false; memo.innerHTML = 'Les événements de <strong>' + esc(chez[0].commune) + '</strong> d’abord, votre commune retenue sur cet appareil.'; }
      else memo.hidden = true;
    }
    section.hidden = false;
  }

  fetch('/flux/agenda.json').then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) { if (Array.isArray(d)) { evs = d; rendre(); } }).catch(function () { /* pas d'agenda : la section reste cachée */ });
  // Changement d'édition (onglets, bouton « retour ») ou de commune (« Près de chez vous ») sans recharger la page
  window.addEventListener('popstate', rendre);
  document.addEventListener('click', function (ev) {
    var t = ev.target && ev.target.closest ? ev.target.closest('a[data-edition], #villes') : null;
    if (t) setTimeout(rendre, 50);
  });
})();
