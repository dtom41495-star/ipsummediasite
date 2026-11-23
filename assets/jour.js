// Bandeau du jour sur les pages autres que l'accueil (articles, listes, pages du site) : date, saint du jour, météo mini d'Albi
// et vigilance Météo-France, juste sous la barre « En direct ». L'accueil a son propre bandeau (assets/accueil.js).
// Les données viennent de la table site_meteo, mise à jour côté serveur toutes les 2 heures.
(function () {
  var ticker = document.getElementById('ticker');
  if (!ticker || document.getElementById('jour-bandeau')) return;
  var SB_URL = 'https://ctmekufqaxdelgfyjwly.supabase.co';
  var SB_CLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0bWVrdWZxYXhkZWxnZnlqd2x5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMDI1OTksImV4cCI6MjA5MDg3ODU5OX0.32wkp9NsqNTktvuC2Pb3S5EnAPPipt06DYLxfeyf5xE';   // clé publique (anon), la même que dans les autres pages
  var CODES_METEO = function (c, jour) {
    if (c === 0) return jour ? ['☀️', 'Soleil'] : ['🌙', 'Ciel dégagé'];
    if (c === 1) return jour ? ['🌤️', 'Plutôt dégagé'] : ['🌙', 'Plutôt dégagé'];
    if (c === 2) return ['⛅', 'Éclaircies'];
    if (c === 3) return ['☁️', 'Couvert'];
    if (c === 45 || c === 48) return ['🌫️', 'Brouillard'];
    if (c >= 51 && c <= 57) return ['🌦️', 'Bruine'];
    if (c === 61 || c === 63 || c === 65 || c === 66 || c === 67) return ['🌧️', c === 61 ? 'Pluie faible' : 'Pluie'];
    if (c >= 71 && c <= 77) return ['❄️', 'Neige'];
    if (c >= 80 && c <= 82) return ['🌦️', 'Averses'];
    if (c === 85 || c === 86) return ['🌨️', 'Averses de neige'];
    if (c >= 95) return ['⛈️', 'Orages'];
    return ['⛅', 'Variable'];
  };
  var meteoDonnees = null;
  function chargerMeteo() {
    if (!meteoDonnees) {
      meteoDonnees = fetch(SB_URL + '/rest/v1/rpc/site_meteo_lire', {
        method: 'POST', headers: { apikey: SB_CLE, Authorization: 'Bearer ' + SB_CLE, 'Content-Type': 'application/json' }, body: '{}'
      }).then(function (r) { return r.ok ? r.json() : []; }).then(function (l) {
        var par = Object.create(null);
        (Array.isArray(l) ? l : []).forEach(function (x) { if (x && x.lieu) par[x.lieu] = x; });
        return par;
      }).catch(function () { return Object.create(null); });
    }
    return meteoDonnees;
  }
  function echapper(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function jourParis() {   // date du jour à Paris, en « AAAA-MM-JJ »
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
  }
  function saintDuJour() {
    var t = jourParis().split('-'), m = +t[1] - 1, j = +t[2] - 1;
    var l = window.SAINTS_DU_JOUR;
    return l && l[m] && l[m][j] ? l[m][j] : '';
  }

  var bandeau = document.createElement('div');
  bandeau.className = 'jour-bandeau';
  bandeau.id = 'jour-bandeau';
  bandeau.hidden = true;
  bandeau.innerHTML = '<div class="wrap"><span class="jour-date"></span><span class="jour-saint"></span>' +
    '<a class="jour-meteo" href="/#meteo" hidden></a><a class="jour-vigilance" href="https://vigilance.meteofrance.fr/" target="_blank" rel="noopener" hidden></a></div>';
  ticker.parentNode.insertBefore(bandeau, ticker.nextSibling);

  function afficher() {
    var dateTxt = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });
    bandeau.querySelector('.jour-date').textContent = dateTxt.charAt(0).toUpperCase() + dateTxt.slice(1);
    var saint = saintDuJour();
    bandeau.querySelector('.jour-saint').textContent = saint ? 'Saint du jour : ' + saint : '';
    bandeau.hidden = false;
    chargerMeteo().then(function (par) {
      var d = par.albi, mini = bandeau.querySelector('.jour-meteo'), vig = bandeau.querySelector('.jour-vigilance');
      var frais = d && d.donnees && d.donnees.jours && d.donnees.jours.length && (Date.now() - new Date(d.maj_le).getTime() < 12 * 3600 * 1000);
      if (!frais) return;
      var dn = d.donnees, a = dn.actuel || {}, ic = CODES_METEO(a.code, a.jour !== false), t = a.temp != null ? a.temp : dn.jours[0].max;
      mini.innerHTML = '<span aria-hidden="true">' + ic[0] + '</span> ' + echapper(dn.nom) + ' <b>' + t + '°</b>';
      mini.setAttribute('aria-label', 'Météo à ' + dn.nom + ' : ' + ic[1] + ', ' + t + ' degrés. Voir les prévisions sur 4 jours');
      mini.hidden = false;
      var auj = (dn.vigilance && dn.vigilance[0] && dn.vigilance[0].phenomenes) || [];
      var pire = auj.reduce(function (m, p) { return Math.max(m, p.niveau || 0); }, 0);
      if (pire) {
        var nom = pire === 4 ? 'rouge' : pire === 3 ? 'orange' : 'jaune';
        vig.className = 'jour-vigilance vig-' + nom;
        vig.innerHTML = '<span aria-hidden="true">⚠</span> Vigilance ' + nom + ' : ' + echapper(auj.filter(function (p) { return p.niveau === pire; }).map(function (p) { return p.nom; }).join(', '));
        vig.hidden = false;
      }
    });
  }

  // La liste des saints est chargée à la demande (elle ne sert qu'ici et sur l'accueil)
  if (window.SAINTS_DU_JOUR) afficher();
  else {
    var s = document.createElement('script');
    s.src = '/assets/saints.js?v=20261117';
    s.onload = afficher;
    s.onerror = afficher;
    document.head.appendChild(s);
  }
})();
