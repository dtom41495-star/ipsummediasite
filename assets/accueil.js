// Page d'accueil "journal" : la une, les dernières actus, l'actu de chaque commune et les
// dernières newsletters, à partir de la liste des articles Substack (fonction substack-feed).
// Les textes reçus de la fonction sont déjà échappés : on peut les insérer tels quels.
(function () {
  var zoneUne = document.getElementById('une-main');
  if (!zoneUne) return;

  var NB_DIAPOS = 5;        // articles du bandeau (le dernier publié en premier)
  var NB_MINI = 3;          // mini cartes fixes à droite du bandeau
  var DUREE_DIAPO = 10000;  // 10 secondes par article
  var SB_URL = (window.IPSUM_CONFIG || {}).SUPABASE_URL;
  var SB_CLE = (window.IPSUM_CONFIG || {}).SUPABASE_CLE;   // clé publique (anon), la même que dans les autres pages
  var NB_SUITE = 8;         // la suite des actus, sous le bandeau
  var NB_VILLES = 4;        // colonnes "commune"
  var PAR_VILLE = 3;        // articles par commune
  var MIN_VILLE = 2;        // il faut au moins 2 articles (hors la une) pour ouvrir la colonne d'une commune
  var NB_EDITIONS = 3;      // dernières newsletters

  var fil = document.getElementById('une-fil');
  var cote = document.getElementById('une-cote');
  var haut = document.getElementById('une-haut');
  var suiteSection = document.getElementById('suite');
  var plusLus = document.getElementById('plus-lus');
  var plusLusListe = document.getElementById('plus-lus-liste');
  var villes = document.getElementById('villes');
  var villesGrille = document.getElementById('villes-grille');
  var villesPastilles = document.getElementById('villes-pastilles');
  var editions = document.getElementById('editions');
  var rubriques = document.getElementById('rubriques');
  var ongletsEditions = document.getElementById('editions-onglets');
  var national = document.getElementById('national');
  var nationalGrille = document.getElementById('national-grille');
  var nationalPastilles = document.getElementById('national-pastilles');
  var cartesEditions = document.getElementById('editions-cartes');
  var rubriquesGrille = document.getElementById('rubriques-grille');
  var NB_RUBRIQUES = 3;     // blocs "rubrique"
  var NB_NATIONAL = 4;      // colonnes (rubriques) du bloc « L'actu nationale »
  // Les éditions : l'identifiant vient de la fonction substack-feed (item.edition). Le jour d'envoi
  // n'est affiché que quand il est connu (null : pas encore décidé).
  var EDITIONS = [
    { slug: 'tarn', nom: 'Tarn', base: 'https://ipsummedia.substack.com', jour: 'Chaque jeudi' },
    { slug: 'haute-garonne', nom: 'Haute-Garonne', base: 'https://ipsummediahautegaronne.substack.com', jour: null },
    { slug: 'national', nom: 'National', base: 'https://ipsummedianational.substack.com', jour: 'Chaque lundi' }
  ];
  // Le jour d'envoi vient de Compo (réglage de chaque rédaction, via la fonction redactions-publiques) ; les valeurs ci-dessus ne servent
  // que si Compo ne répond pas.
  var JOURS_SEMAINE = ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  function slugRedaction(nom) {
    var c = String(nom || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return c === 'nationale' ? 'national' : c;
  }
  var PAR_RUBRIQUE = 4;     // articles par rubrique

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });
    } catch (e) { return ''; }
  }

  // "09h02" pour un article du jour, "Hier", sinon "16 sept." (avec l'année pour un article d'une autre année)
  function quand(iso) {
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      var jour = function (t) { return new Date(t).toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' }); };
      var j = jour(d);
      if (j === jour(Date.now())) {
        return d.toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
      }
      if (j === jour(Date.now() - 86400000)) return 'Hier';
      return d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', year: j.slice(0, 4) === jour(Date.now()).slice(0, 4) ? undefined : 'numeric' });
    } catch (e) {
      return '';
    }
  }

  // Les articles récents ont leur page sur le site ; les plus anciens renvoient vers Substack
  function lien(item) {
    var m = item.link && item.link.match(/\/(?:p|articles)\/([^/?#]+)/);
    var externe = !m || item.surLeSite === false;
    var href = externe ? (item.link || '#') : '/articles/' + m[1];
    return ' href="' + href.replace(/"/g, '&quot;') + '"' + (externe ? ' target="_blank" rel="noopener"' : '');
  }

  // "Castres · Culture", ou la rédaction quand l'article n'a ni commune ni rubrique
  function surtitre(item, sansCommune) {
    var parts = [];
    if (!sansCommune && item.edition === 'national') parts.push('National');
    if (!sansCommune && item.communes && item.communes.length) parts.push(item.communes[0].nom);
    if (item.rubriques && item.rubriques.length) parts.push(item.rubriques[0].nom);
    if (!parts.length && !sansCommune) parts.push(item.redaction || '');
    return parts.join(' · ');
  }

  function kicker(item, sansCommune) {
    var s = surtitre(item, sansCommune);
    return s ? '<span class="kicker">' + s + '</span>' : '';
  }

  // Photo qui remplit son cadre (la une et les tuiles). Pour la une, le navigateur choisit la
  // version de 720 ou de 1600 pixels selon l'écran.
  function fond(item, grande) {
    if (!item.image) return '';
    var attrs = 'class="fond" alt="" decoding="async"';
    if (grande) {
      var large = item.imageLarge || item.image;
      return '<img ' + attrs + ' src="' + large + '" srcset="' + item.image + ' 720w, ' + large + ' 1600w" sizes="(min-width: 1024px) 690px, 100vw" fetchpriority="high">';
    }
    return '<img ' + attrs + ' src="' + item.image + '" loading="lazy">';
  }

  // Photo au-dessus du texte (colonnes des communes)
  function image(item) {
    return item.image ? '<span class="une-img"><img src="' + item.image + '" alt="" decoding="async" loading="lazy"></span>' : '';
  }

  // Pastille dégradée avec la commune et la rubrique
  function pastille(item) {
    var s = surtitre(item);
    return s ? '<span class="pastille">' + s + '</span>' : '';
  }

  // ===== Bandeau « à la une » : slider façon stories (10 s par article), le dernier article publié toujours en premier =====
  function sansPhoto(a) { return !a.image || a.coverGenerique; }

  // Une diapositive : photo (si elle existe) sous le dégradé orange, étiquette, titre sur bandes blanches, signature, bouton
  function htmlDiapo(a, premier) {
    var photo = !sansPhoto(a);
    var s = surtitre(a);
    var img = '';
    if (photo) {
      var large = a.imageLarge || a.image;
      img = '<img class="fond" alt="" decoding="async" src="' + large + '" srcset="' + a.image + ' 720w, ' + large + ' 1600w" sizes="100vw"' + (premier ? ' fetchpriority="high"' : ' loading="lazy"') + '>';
    }
    return '<article class="diapo' + (photo ? '' : ' sans-photo') + '" aria-roledescription="diapositive">' + img + '<div class="teinte"></div>' +
      (photo ? '' : '<div class="marque" aria-hidden="true"></div>') +
      '<div class="diapo-contenu">' + (s ? '<span class="etiquette">' + s + '</span>' : '') +
      '<h2 class="diapo-titre"><a' + lien(a) + '><span>' + a.title + '</span></a></h2>' +
      '<div class="signature">' + (a.author ? 'Par ' + a.author + ' · ' : '') + formatDate(a.pubDate) + '</div>' +
      (a.description ? '<p class="diapo-chapeau">' + a.description + '</p>' : '') +
      '<a class="lire"' + lien(a) + ' tabindex="-1" aria-hidden="true">Lire l\'article</a>' +
      '</div></article>';
  }

  // Mini carte du côté : même dessin que le bandeau (photo, dégradé orange, titre sur bande blanche)
  function htmlMini(a) {
    var s = surtitre(a);
    return '<a class="mini' + (sansPhoto(a) ? ' sans-photo' : '') + '"' + lien(a) + '>' +
      (sansPhoto(a) ? '' : '<img class="fond" alt="" loading="lazy" decoding="async" src="' + a.image + '">') + '<span class="teinte"></span>' +
      (s ? '<span class="etiquette">' + s + '</span>' : '') +
      '<h3><span>' + a.title + '</span></h3><span class="quand">' + quand(a.pubDate) + '</span></a>';
  }

  var slider = { courant: 0, n: 0, pauseManuelle: false, survol: false, onglet: true, x0: null };
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) slider.pauseManuelle = true;   // moins d'animations demandé : pas de défilement tout seul

  function monterBandeau(liste) {
    slider.n = liste.length;
    slider.courant = 0;
    zoneUne.style.setProperty('--duree', DUREE_DIAPO / 1000 + 's');
    var h = '';
    if (liste.length > 1) {
      h += '<div class="progres" role="group" aria-label="Choisir un article">' + liste.map(function (a, i) {
        return '<button type="button" data-aller="' + i + '" aria-label="Article ' + (i + 1) + ' sur ' + liste.length + '"><i><b></b></i></button>';
      }).join('') + '</div>';
    }
    h += liste.map(function (a, i) { return htmlDiapo(a, i === 0); }).join('');
    if (liste.length > 1) {
      h += '<button type="button" class="zone g" data-act="prec" aria-label="Article précédent"></button>' +
        '<button type="button" class="zone d" data-act="suiv" aria-label="Article suivant"></button>' +
        '<button type="button" class="fleche g" data-act="prec" aria-label="Article précédent">‹</button>' +
        '<button type="button" class="fleche d" data-act="suiv" aria-label="Article suivant">›</button>' +
        '<button type="button" class="lecture" data-act="pause"><svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" class="ico-pause"><rect x="3" y="2" width="3.5" height="12" rx="1"/><rect x="9.5" y="2" width="3.5" height="12" rx="1"/></svg>' +
        '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" class="ico-lire"><path d="M4 2l10 6-10 6z"/></svg><span class="lecture-texte"></span></button>';
    }
    zoneUne.innerHTML = h;
    zoneUne.classList.toggle('un-seul', liste.length < 2);
    aller(0);
  }

  function majPause() {
    var stop = slider.pauseManuelle || slider.survol || !slider.onglet;
    zoneUne.classList.toggle('pause', stop);
    var bouton = zoneUne.querySelector('.lecture');
    if (bouton) {
      bouton.classList.toggle('en-pause', slider.pauseManuelle);
      bouton.setAttribute('aria-label', slider.pauseManuelle ? 'Reprendre le défilement' : 'Mettre en pause le défilement');
      bouton.querySelector('.lecture-texte').textContent = slider.pauseManuelle ? 'Lecture' : 'Pause';
    }
  }

  function aller(i) {
    if (!slider.n) return;
    slider.courant = (i + slider.n) % slider.n;
    var diapos = zoneUne.querySelectorAll('.diapo'), barres = zoneUne.querySelectorAll('.progres button');
    Array.prototype.forEach.call(diapos, function (d, k) { d.classList.toggle('actif', k === slider.courant); d.setAttribute('aria-hidden', k === slider.courant ? 'false' : 'true'); });
    Array.prototype.forEach.call(barres, function (b, k) { b.classList.remove('en-cours'); b.classList.toggle('fait', k < slider.courant); b.removeAttribute('aria-current'); });
    if (barres.length) {
      void zoneUne.offsetWidth;   // relance l'animation de la barre
      barres[slider.courant].classList.add('en-cours');
      barres[slider.courant].setAttribute('aria-current', 'true');
    }
    majPause();
  }

  // Commandes : branchées une seule fois (le contenu du bandeau est refait à chaque changement d'édition)
  zoneUne.addEventListener('click', function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('[data-aller], [data-act]') : null;
    if (!b || !zoneUne.contains(b)) return;
    if (b.hasAttribute('data-aller')) aller(Number(b.getAttribute('data-aller')));
    else if (b.getAttribute('data-act') === 'prec') aller(slider.courant - 1);
    else if (b.getAttribute('data-act') === 'suiv') aller(slider.courant + 1);
    else if (b.getAttribute('data-act') === 'pause') { slider.pauseManuelle = !slider.pauseManuelle; majPause(); }
  });
  zoneUne.addEventListener('animationend', function (ev) {
    if (ev.target && ev.target.parentNode && ev.target.parentNode.parentNode && ev.target.parentNode.parentNode.classList.contains('en-cours')) aller(slider.courant + 1);
  });
  // Plus de pause au survol de la souris : les diapositives défilent même quand le pointeur est dessus (on voyait toujours la même).
  // Le bouton « Pause » reste là pour s'arrêter volontairement ; au clavier (focus visible), le défilement s'arrête le temps de la navigation.
  // Un clic à la souris sur une flèche ou un bouton ne fige plus le bandeau : seul le focus au clavier le fait.
  zoneUne.addEventListener('focusin', function (ev) {
    var cible = ev.target;
    var auClavier = false;
    try { auClavier = !!(cible && cible.matches && cible.matches(':focus-visible')); } catch (e) { auClavier = true; }
    if (auClavier) { slider.survol = true; majPause(); }
  });
  zoneUne.addEventListener('focusout', function () { slider.survol = false; majPause(); });
  zoneUne.addEventListener('keydown', function (ev) {
    if (ev.key === 'ArrowLeft') aller(slider.courant - 1); else if (ev.key === 'ArrowRight') aller(slider.courant + 1);
  });
  zoneUne.addEventListener('touchstart', function (ev) { slider.x0 = ev.touches[0].clientX; slider.survol = true; majPause(); }, { passive: true });
  zoneUne.addEventListener('touchend', function (ev) {
    slider.survol = false;
    var dx = slider.x0 == null ? 0 : ev.changedTouches[0].clientX - slider.x0;
    slider.x0 = null;
    if (Math.abs(dx) > 40) aller(slider.courant + (dx < 0 ? 1 : -1)); else majPause();
  });
  document.addEventListener('visibilitychange', function () { slider.onglet = !document.hidden; majPause(); });


  // ===== Bandeau du jour (date, saint, météo mini) et météo sur 4 jours =====
  // Les données sont calculées côté serveur toutes les 2 heures (table site_meteo, lecture publique) : la page n'appelle aucun service météo.
  var LIEU_EDITION = { 'tarn': 'albi', 'haute-garonne': 'toulouse', 'national': 'paris' };   // « Toutes » : Albi
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
  function afficherJourEtMeteo() {
    var bandeau = document.getElementById('jour-bandeau');
    if (!bandeau) return;
    var dateTxt = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });
    document.getElementById('jour-date').textContent = dateTxt.charAt(0).toUpperCase() + dateTxt.slice(1);
    var saint = saintDuJour();
    var elSaint = document.getElementById('jour-saint');
    elSaint.textContent = saint ? 'Saint du jour : ' + saint : '';
    bandeau.hidden = false;
    var lieu = LIEU_EDITION[editionActive] || 'albi';
    chargerMeteo().then(function (par) {
      var d = par[lieu], mini = document.getElementById('jour-meteo'), vig = document.getElementById('jour-vigilance'), sect = document.getElementById('meteo');
      var frais = d && d.donnees && d.donnees.jours && d.donnees.jours.length && (Date.now() - new Date(d.maj_le).getTime() < 12 * 3600 * 1000);   // données trop vieilles : on n'affiche rien
      if (!frais) { mini.hidden = true; vig.hidden = true; if (sect) sect.hidden = true; return; }
      var dn = d.donnees, a = dn.actuel || {}, ic = CODES_METEO(a.code, a.jour !== false);
      mini.innerHTML = '<span aria-hidden="true">' + ic[0] + '</span> ' + echapper(dn.nom) + ' <b>' + (a.temp != null ? a.temp : dn.jours[0].max) + '°</b>';
      mini.setAttribute('aria-label', 'Météo à ' + dn.nom + ' : ' + ic[1] + ', ' + (a.temp != null ? a.temp : dn.jours[0].max) + ' degrés. Voir les prévisions sur 4 jours');
      mini.hidden = false;

      // Vigilance : la plus haute des phénomènes d'aujourd'hui (jaune, orange, rouge)
      var aujourdhui = (dn.vigilance && dn.vigilance[0] && dn.vigilance[0].phenomenes) || [];
      var demain = (dn.vigilance && dn.vigilance[1] && dn.vigilance[1].phenomenes) || [];
      var pire = aujourdhui.reduce(function (m, p) { return Math.max(m, p.niveau || 0); }, 0);
      var noms = aujourdhui.filter(function (p) { return p.niveau === pire; }).map(function (p) { return p.nom; });
      vig.hidden = !pire;
      if (pire) {
        vig.className = 'jour-vigilance vig-' + (pire === 4 ? 'rouge' : pire === 3 ? 'orange' : 'jaune');
        vig.innerHTML = '<span aria-hidden="true">⚠</span> Vigilance ' + (pire === 4 ? 'rouge' : pire === 3 ? 'orange' : 'jaune') + ' : ' + echapper(noms.join(', '));
      }

      if (!sect) return;
      document.getElementById('meteo-titre').textContent = 'La météo à ' + dn.nom;
      document.getElementById('meteo-maj').textContent = 'mise à jour à ' + new Date(d.maj_le).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).replace(':', ' h ');
      var zv = document.getElementById('meteo-vigilance'), lignesVig = [];
      [['aujourd\'hui', aujourdhui], ['demain', demain]].forEach(function (x) {
        x[1].filter(function (p) { return p.niveau >= 2; }).forEach(function (p) { lignesVig.push('<li class="vig-' + (p.niveau === 4 ? 'rouge' : p.niveau === 3 ? 'orange' : 'jaune') + '"><b>Vigilance ' + echapper(p.couleur) + '</b> · ' + echapper(p.nom) + ' · ' + x[0] + '</li>'); });
      });
      zv.hidden = !lignesVig.length;
      zv.innerHTML = lignesVig.length ? '<ul>' + lignesVig.join('') + '</ul><a href="https://vigilance.meteofrance.fr/" target="_blank" rel="noopener">Détails et consignes sur vigilance.meteofrance.fr</a>' : '';
      var auj = jourParis();
      document.getElementById('meteo-jours').innerHTML = dn.jours.slice(0, 4).map(function (j) {
        var ico = CODES_METEO(j.code, true);
        var nomJour = j.date === auj ? 'Aujourd\'hui' : new Date(j.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', timeZone: 'Europe/Paris' });
        nomJour = nomJour.charAt(0).toUpperCase() + nomJour.slice(1);
        return '<li><span class="mj-nom">' + echapper(nomJour) + '</span><span class="mj-ico" aria-hidden="true">' + ico[0] + '</span><span class="mj-lib">' + echapper(ico[1]) + '</span>' +
          '<span class="mj-temp"><b>' + j.max + '°</b> <span>' + j.min + '°</span></span>' +
          '<span class="mj-det">' + (j.pluie != null ? 'Pluie ' + j.pluie + ' %' : '') + (j.rafales >= 50 ? ' · rafales ' + j.rafales + ' km/h' : '') + '</span></li>';
      }).join('');
      sect.hidden = false;
    });
  }

  // ===== Les plus lus : classement des 7 derniers jours calculé chaque nuit (table site_vues, lecture publique) =====
  var plusLusDonnees = null, jetonPlusLus = 0;
  function chargerPlusLus() {
    if (!plusLusDonnees) {
      plusLusDonnees = fetch(SB_URL + '/rest/v1/rpc/site_plus_lus', {
        method: 'POST', headers: { apikey: SB_CLE, Authorization: 'Bearer ' + SB_CLE, 'Content-Type': 'application/json' }, body: '{}'
      }).then(function (r) { return r.ok ? r.json() : []; }).then(function (l) { return Array.isArray(l) ? l : []; }).catch(function () { return []; });
    }
    return plusLusDonnees;
  }
  function afficherPlusLus(articles) {
    if (!plusLus || !plusLusListe) return;
    var jeton = ++jetonPlusLus;
    chargerPlusLus().then(function (lignes) {
      if (jeton !== jetonPlusLus) return;   // l'édition a changé entre-temps
      var vues = Object.create(null);
      lignes.forEach(function (l) { if (l && l.slug) vues[l.slug] = Number(l.vues) || 0; });
      var classes = articles.map(function (a) {
        var m = a.link && a.link.match(/\/(?:p|articles)\/([^/?#]+)/);
        return { a: a, v: m && vues[m[1]] ? vues[m[1]] : 0 };
      }).filter(function (x) { return x.v > 0; })
        .sort(function (x, y) { return y.v - x.v || new Date(y.a.pubDate) - new Date(x.a.pubDate); }).slice(0, 5);
      if (classes.length < 3) { plusLus.hidden = true; return; }   // pas assez de données pour un classement utile
      plusLusListe.innerHTML = classes.map(function (x, i) {
        var s = surtitre(x.a);
        var photo = i === 0 && x.a.image ? '<span class="pl-img"><img src="' + x.a.image + '" alt="" decoding="async" loading="lazy" onerror="this.parentNode.hidden=true"></span>' : '';
        return '<li class="pl-' + (i + 1) + '"><a' + lien(x.a) + '>' + photo +
          '<span class="pl-corps"><span class="rang">' + (i + 1) + '</span><span class="plus-lus-texte">' +
          (s ? '<span class="kicker">' + s + '</span>' : '') + '<span class="plus-lus-titre">' + x.a.title + '</span></span></span></a></li>';
      }).join('');
      plusLus.hidden = false;
    });
  }

  // Carte avec photo au-dessus du texte (tête d'une colonne commune)
  function htmlCarte(a, titreH, sansCommune) {
    return '<a class="une-card"' + lien(a) + '>' +
      image(a) +
      kicker(a, sansCommune) +
      '<' + titreH + '>' + a.title + '</' + titreH + '>' +
      '<span class="une-meta">' + formatDate(a.pubDate) + '</span>' +
      '</a>';
  }

  // Ligne de liste : date (ou heure), commune, titre
  function htmlLigne(a, sansCommune) {
    var s = surtitre(a, sansCommune);
    return '<li><a' + lien(a) + '>' +
      '<span class="fil-meta"><span>' + quand(a.pubDate) + '</span>' + (s ? '<span>' + s + '</span>' : '') + '</span>' +
      '<span class="fil-titre">' + a.title + '</span>' +
      '</a></li>';
  }

  // ===== Édition choisie (/tarn, /haute-garonne, /national) : l'accueil ne montre que ses articles =====
  // Même page statique pour toutes les adresses : Netlify sert index.html, ce script lit l'adresse et filtre (rien à payer côté serveur).
  var tousItems = null;
  var editionActive = null;
  var TITRES_EDITION = { 'tarn': 'du Tarn', 'haute-garonne': 'de la Haute-Garonne', 'national': 'nationale' };
  var h1Accueil = document.querySelector('#accueil h1.sr-only');
  var canonique = document.querySelector('link[rel="canonical"]');
  var titreOrigine = document.title, h1Origine = h1Accueil ? h1Accueil.textContent : '';
  var toutVoirFil = cote ? cote.querySelector('.journal-tete a') : null;

  function editionDepuisAdresse() {
    var m = location.pathname.match(/^\/(tarn|haute-garonne|national)\/?$/);
    var slug = m ? m[1] : new URLSearchParams(location.search).get('edition');
    return EDITIONS.some(function (e) { return e.slug === slug; }) ? slug : null;
  }

  // Éditions qui ont au moins un article (la Haute-Garonne apparaît dès qu'elle publie)
  function editionsDispo(items) {
    return EDITIONS.filter(function (e) {
      return items.some(function (i) { return i.kind !== 'newsletter' && i.edition === e.slug; });
    });
  }

  function lienEdition(href, nom, slug, actif) {
    return '<a href="' + href + '" data-edition="' + slug + '"' + (actif ? ' class="actif" aria-current="page"' : '') + '>' + nom + '</a>';
  }

  // Le bandeau du haut. « Toutes » : les éditions. Une édition choisie : son nom (pour revenir) puis ses communes
  // (ou ses rubriques pour la nationale, qui n'a pas de communes), comme le menu d'un journal régional.
  function afficherBarre(dispo, base) {
    if (!ongletsEditions) return;
    var conteneur = ongletsEditions.querySelector('.wrap');
    if (dispo.length < 2 || !conteneur) { ongletsEditions.hidden = true; return; }
    var h = '';
    if (!editionActive) {
      h += lienEdition('/', 'Toutes', '', true);
      dispo.forEach(function (e) { h += lienEdition('/' + e.slug, e.nom, e.slug, false); });
    } else {
      var edition = EDITIONS.filter(function (e) { return e.slug === editionActive; })[0];
      var national = editionActive === 'national';
      var cle = national ? 'rubriques' : 'communes';
      var compte = Object.create(null), noms = {};
      base.forEach(function (a) {
        if (a.kind === 'newsletter') return;
        (a[cle] || []).forEach(function (t) { compte[t.slug] = (compte[t.slug] || 0) + 1; noms[t.slug] = t.nom; });
      });
      var liste = Object.keys(compte).sort(function (x, y) { return compte[y] - compte[x] || (noms[x] < noms[y] ? -1 : 1); });
      h += '<a href="/" data-edition="" class="actif edition-retour" aria-current="page" title="Revenir à toutes les éditions"><span aria-hidden="true">‹</span> ' + edition.nom + '</a>';
      if (liste.length) h += '<span class="edition-sep" aria-hidden="true"></span>';
      h += liste.map(function (slug) { return '<a href="/' + (national ? 'rubrique' : 'commune') + '/' + slug + '">' + noms[slug] + '</a>'; }).join('');
    }
    conteneur.innerHTML = h;
    ongletsEditions.setAttribute('aria-label', editionActive ? 'Communes de l\'édition' : 'Choisir une édition');
    ongletsEditions.hidden = false;
  }

  function majTitres() {
    var titre = editionActive ? 'Ipsum Média | L\'actualité ' + TITRES_EDITION[editionActive] : titreOrigine;
    document.title = titre;
    if (h1Accueil) h1Accueil.textContent = editionActive ? titre : h1Origine;
    if (canonique) canonique.href = 'https://ipsummedia.fr/' + (editionActive || '');
    if (toutVoirFil) toutVoirFil.href = editionActive ? 'articles.html?edition=' + editionActive : 'articles.html';
  }

  function afficher(items) {
    tousItems = items;
    editionActive = editionDepuisAdresse();
    rendre();
  }

  function rendre() {
    var items = tousItems || [];
    // Remise à zéro : on peut changer d'édition sans recharger la page
    cote.hidden = false;
    haut.classList.remove('sans-cote');
    cote.innerHTML = '';
    fil.innerHTML = '';
    if (suiteSection) suiteSection.hidden = true;
    if (plusLus) plusLus.hidden = true;
    [rubriques, villes, national].forEach(function (b) { if (b) b.hidden = true; });
    [rubriquesGrille, villesGrille, villesPastilles, nationalGrille, nationalPastilles].forEach(function (b) { if (b) b.innerHTML = ''; });

    var dispo = editionsDispo(items);
    // Une édition sans article (ex. /haute-garonne avant sa première publication) : on montre tout
    if (editionActive && !dispo.some(function (e) { return e.slug === editionActive; })) {
      editionActive = null;
      try { if (location.pathname !== '/') history.replaceState(null, '', '/'); } catch (e) { /* adresse inchangée */ }
    }
    var base = editionActive ? items.filter(function (i) { return i.edition === editionActive; }) : items;
    majTitres();
    afficherBarre(dispo, base);

    var articles = base.filter(function (i) { return i.kind !== 'newsletter'; });
    var newsletters = base.filter(function (i) { return i.kind === 'newsletter'; });
    if (!articles.length) {
      zoneUne.innerHTML = '<p class="feed-loading">Aucun article pour le moment.</p>';
      cote.hidden = true; haut.classList.add('sans-cote');   // efface le squelette de chargement, sinon il reste figé
      return;
    }

    // Le bandeau : les 5 derniers articles, le plus récent d'abord (avec ou sans photo). À droite, les 4 suivants ; la suite sous le bandeau.
    var diapos = articles.slice(0, NB_DIAPOS);
    var minis = articles.slice(NB_DIAPOS, NB_DIAPOS + NB_MINI);
    var suite = articles.slice(NB_DIAPOS + NB_MINI, NB_DIAPOS + NB_MINI + NB_SUITE);
    var utilises = diapos.concat(minis);
    monterBandeau(diapos);
    cote.removeAttribute('aria-hidden');
    if (minis.length) {
      cote.style.setProperty('--n', minis.length);
      cote.innerHTML = minis.map(htmlMini).join('');
    } else {
      // Peu d'articles : le bandeau prend toute la largeur
      cote.hidden = true;
      haut.classList.add('sans-cote');
    }
    if (suite.length) {
      fil.innerHTML = suite.map(function (a) { return htmlCarte(a, 'h3'); }).join('');
      if (suiteSection) suiteSection.hidden = false;
    }
    afficherPlusLus(articles);
    afficherJourEtMeteo();

    // Le national a son propre bloc : « Par rubrique » et « Près de chez vous » restent locaux
    var locaux = articles.filter(function (i) { return i.edition !== 'national'; });
    var nationaux = articles.filter(function (i) { return i.edition === 'national'; });
    var enNational = editionActive === 'national';   // l'accueil est déjà national : « Par rubrique » suffit, pas de bloc en plus

    // Les blocs rubrique ne reprennent pas ce que la une et la colonne « Dernières actus » montrent déjà
    afficherRubriques(enNational ? nationaux : locaux, utilises.concat(suite));
    afficherCommunes(locaux, utilises);
    if (!enNational) afficherNational(nationaux, utilises.concat(suite));
    afficherEditions(items, items.some(function (i) { return i.kind !== 'newsletter' && i.edition === 'national'; }));

    // Dernières newsletters
    newsletters = items.filter(function (i) { return i.kind === 'newsletter'; });
    if (newsletters.length) {
      editions.innerHTML = newsletters.slice(0, NB_EDITIONS).map(function (n) { return htmlLigne(n, true); }).join('');
      editions.parentNode.hidden = !!(cartesEditions && !cartesEditions.hidden);   // remplacé par les cartes quand il y a plusieurs éditions
    }
  }


  // L'actu nationale : même présentation que « Près de chez vous », avec les rubriques à la place des communes.
  // Le bloc n'apparaît qu'une fois la rédaction nationale lancée (au moins un article).
  function afficherNational(nationaux, utilises) {
    if (!national || !nationaux.length) return;
    var par = Object.create(null);
    nationaux.forEach(function (a) {
      var r = (a.rubriques && a.rubriques[0]) || { slug: 'actu', nom: 'Actualité' };
      var e = par[r.slug] || (par[r.slug] = { slug: r.slug, nom: r.nom, articles: [], derniere: 0 });
      e.articles.push(a);
      e.derniere = Math.max(e.derniere, new Date(a.pubDate).getTime() || 0);
    });
    var liste = Object.keys(par).map(function (k) { return par[k]; })
      .sort(function (x, y) { return y.derniere - x.derniere || y.articles.length - x.articles.length; });
    // On évite de répéter ce que la une et « Dernières actus » montrent déjà, sauf s'il n'y a presque rien d'autre
    var colonnes = liste.map(function (r) {
      var neufs = r.articles.filter(function (a) { return utilises.indexOf(a) === -1; });
      return { rubrique: r, dispo: (neufs.length ? neufs : r.articles).slice(0, PAR_VILLE) };
    }).slice(0, NB_NATIONAL);
    if (!colonnes.length) return;

    nationalPastilles.innerHTML = liste.map(function (r) {
      return '<a href="articles.html?edition=national&rubrique=' + r.slug + '">' + r.nom + '</a>';
    }).join('');
    nationalGrille.innerHTML = colonnes.map(function (c) {
      return '<div class="ville">' +
        '<div class="ville-tete"><h3>' + c.rubrique.nom + '</h3><a href="articles.html?edition=national&rubrique=' + c.rubrique.slug + '">Tout voir</a></div>' +
        htmlCarte(c.dispo[0], 'h4', true) +
        '<ul class="fil">' + c.dispo.slice(1).map(function (a) { return htmlLigne(a, true); }).join('') + '</ul>' +
        '</div>';
    }).join('');
    national.hidden = false;
  }

  // Onglets d'édition et newsletters par édition : seulement quand il y a plusieurs éditions à choisir,
  // donc dès que la rédaction nationale a publié. Avant, l'accueil reste exactement comme il était.
  function afficherEditions(items, plusieurs) {
    if (!plusieurs) return;
    if (!cartesEditions) return;
    var titre = document.getElementById('newsletter-titre');
    var texte = document.getElementById('newsletter-texte');
    if (titre) titre.textContent = 'Une newsletter par édition, dans votre boîte mail';
    if (texte) texte.textContent = 'Les articles de la semaine, les infos près de chez vous et les coulisses de la rédaction. Choisissez les éditions qui vous intéressent : elles ne partent pas le même jour. Et en plus, c\'est gratuit.';
    var icone = '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="4.5" width="15" height="11" rx="2"/><path d="M3 6l7 5 7-5"/></svg>';
    cartesEditions.innerHTML = EDITIONS.filter(function (e) {
      return e.slug === 'tarn' || items.some(function (i) { return i.edition === e.slug; });
    }).map(function (e) {
      return '<div class="edition-carte" data-edition="' + e.slug + '">' +
        '<span class="edition-pastille">' + icone + '</span>' +
        '<div class="edition-carte-texte"><strong>' + e.nom + '</strong>' + (e.jour ? '<span>' + e.jour + '</span>' : '') + '</div>' +
        '<a class="btn btn-primary" href="' + e.base + '/subscribe" target="_blank" rel="noopener">S\'abonner</a>' +
        '</div>';
    }).join('');
    cartesEditions.hidden = false;
    var dernieres = editions && editions.parentNode;
    if (dernieres) dernieres.hidden = true;
  }

  // Un bloc par rubrique (les plus récemment alimentées) : un article en photo puis des titres
  function afficherRubriques(articles, utilises) {
    var par = Object.create(null);
    articles.forEach(function (a) {
      if (utilises.indexOf(a) !== -1 || !a.rubriques || !a.rubriques.length) return;
      var r = a.rubriques[0];
      var e = par[r.slug] || (par[r.slug] = { slug: r.slug, nom: r.nom, articles: [], derniere: 0 });
      e.articles.push(a);
      e.derniere = Math.max(e.derniere, new Date(a.pubDate).getTime() || 0);
    });
    var blocs = Object.keys(par).map(function (k) { return par[k]; })
      .filter(function (r) { return r.articles.length >= 3; })
      .sort(function (x, y) { return y.derniere - x.derniere; })
      .slice(0, NB_RUBRIQUES);
    if (!blocs.length) return;
    rubriquesGrille.innerHTML = blocs.map(function (r) {
      var liste = r.articles.slice(0, PAR_RUBRIQUE);
      return '<div class="ville rubrique">' +
        '<div class="ville-tete"><h3>' + r.nom + '</h3><a href="/rubrique/' + r.slug + '">Tout voir</a></div>' +
        htmlCarte(liste[0], 'h4') +
        '<ul class="fil">' + liste.slice(1).map(function (a) { return htmlLigne(a); }).join('') + '</ul>' +
        '</div>';
    }).join('');
    rubriques.hidden = false;
  }

  // L'actu de chaque commune : un article en photo puis des titres, pour les communes où l'on a publié
  // le plus récemment. On classe par date du dernier article et non par nombre d'articles : sinon les
  // mêmes communes, les plus fournies depuis toujours, gardent leur place et une commune qui vient de
  // faire l'actu n'apparaît jamais.
  function afficherCommunes(articles, utilises) {
    var parCommune = Object.create(null);
    articles.forEach(function (a) {
      (a.communes || []).forEach(function (c) {
        var e = parCommune[c.slug] || (parCommune[c.slug] = { slug: c.slug, nom: c.nom, articles: [], derniere: 0 });
        e.articles.push(a);
        e.derniere = Math.max(e.derniere, new Date(a.pubDate).getTime() || 0);
      });
    });
    var liste = Object.keys(parCommune).map(function (k) { return parCommune[k]; })
      .sort(function (x, y) { return y.derniere - x.derniere || y.articles.length - x.articles.length || (x.slug < y.slug ? -1 : 1); });
    if (!liste.length) return;   // pas d'étiquettes de commune (flux de secours) : on ne montre pas cette partie

    var colonnes = liste.map(function (c) {
      return { commune: c, dispo: c.articles.filter(function (a) { return utilises.indexOf(a) === -1; }).slice(0, PAR_VILLE) };
    }).filter(function (c) { return c.dispo.length >= MIN_VILLE; }).slice(0, NB_VILLES);
    if (!colonnes.length) return;   // pas assez d'articles par commune : les pastilles seules n'ont pas d'intérêt

    villesPastilles.innerHTML = liste.map(function (c) {
      return '<a href="/commune/' + c.slug + '">' + c.nom + '</a>';
    }).join('');

    villesGrille.innerHTML = colonnes.map(function (c) {
      return '<div class="ville">' +
        '<div class="ville-tete"><h3>' + c.commune.nom + '</h3><a href="/commune/' + c.commune.slug + '">Tout voir</a></div>' +
        htmlCarte(c.dispo[0], 'h4', true) +
        '<ul class="fil">' + c.dispo.slice(1).map(function (a) { return htmlLigne(a, true); }).join('') + '</ul>' +
        '</div>';
    }).join('');
    villes.hidden = false;
  }

  fetch(SB_URL + '/functions/v1/redactions-publiques', { headers: { apikey: SB_CLE, Authorization: 'Bearer ' + SB_CLE } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !Array.isArray(d.redactions)) return;
      d.redactions.forEach(function (r) {
        var e = EDITIONS.filter(function (x) { return x.slug === slugRedaction(r.nom); })[0];
        if (e) e.jour = r.jour_newsletter >= 1 && r.jour_newsletter <= 7 ? 'Chaque ' + JOURS_SEMAINE[r.jour_newsletter] : null;
      });
      if (tousItems) afficherEditions(tousItems, tousItems.some(function (i) { return i.kind !== 'newsletter' && i.edition === 'national'; }));
    })
    .catch(function () { /* on garde les jours prévus dans la page */ });

  // Un clic sur une édition change l'accueil sans recharger la page ; l'adresse suit (bouton « retour » du navigateur compris).
  // Sans JavaScript, ou clic avec Ctrl / clic du milieu : le lien /tarn s'ouvre normalement.
  if (ongletsEditions) ongletsEditions.addEventListener('click', function (ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest('a[data-edition]') : null;
    if (!a || ev.defaultPrevented || ev.button || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || !tousItems) return;
    ev.preventDefault();
    editionActive = a.getAttribute('data-edition') || null;
    try { history.pushState(null, '', a.getAttribute('href')); } catch (e) { /* l'adresse ne change pas */ }
    rendre();
  });
  window.addEventListener('popstate', function () {
    if (!tousItems) return;
    editionActive = editionDepuisAdresse();
    rendre();
  });

  fetch('/.netlify/functions/substack-feed?tous=1')
    .then(function (r) { return r.json(); })
    .then(function (data) { afficher((data && data.items) || []); })
    .catch(function () {
      editionActive = editionDepuisAdresse();
      afficherJourEtMeteo();   // le bandeau du jour et la météo ne dépendent pas des articles
      cote.hidden = true; haut.classList.add('sans-cote');
      zoneUne.innerHTML = '<p class="feed-loading">Impossible de charger les articles pour le moment. <a href="https://ipsummedia.substack.com" target="_blank" rel="noopener">Voir sur Substack</a>.</p>';
      fil.innerHTML = '';   // efface le squelette de chargement, sinon il reste figé
    });
})();
