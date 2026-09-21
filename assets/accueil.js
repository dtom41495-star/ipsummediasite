// Page d'accueil "journal" : la une, les dernières actus, l'actu de chaque commune et les
// dernières newsletters, à partir de la liste des articles Substack (fonction substack-feed).
// Les textes reçus de la fonction sont déjà échappés : on peut les insérer tels quels.
(function () {
  var zoneUne = document.getElementById('une-main');
  if (!zoneUne) return;

  var NB_SECONDAIRES = 2;   // articles à côté de la une
  var NB_FIL = 10;          // dernières actus (colonne de droite ; 6 seulement sur tablette et téléphone, voir le CSS)
  var NB_VILLES = 4;        // colonnes "commune"
  var PAR_VILLE = 3;        // articles par commune
  var MIN_VILLE = 2;        // il faut au moins 2 articles (hors la une) pour ouvrir la colonne d'une commune
  var NB_EDITIONS = 3;      // dernières newsletters

  var fil = document.getElementById('une-fil');
  var cote = document.getElementById('une-cote');
  var villes = document.getElementById('villes');
  var villesGrille = document.getElementById('villes-grille');
  var villesPastilles = document.getElementById('villes-pastilles');
  var editions = document.getElementById('editions');

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });
    } catch (e) { return ''; }
  }

  // "09h02" pour un article du jour, "Hier", sinon "16 sept."
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
      return d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short' });
    } catch (e) {
      return '';
    }
  }

  // Les articles récents ont leur page sur le site ; les plus anciens renvoient vers Substack
  function lien(item) {
    var m = item.link && item.link.match(/\/p\/([^/?#]+)/);
    var externe = !m || item.surLeSite === false;
    var href = externe ? (item.link || '#') : '/articles/' + m[1];
    return ' href="' + href.replace(/"/g, '&quot;') + '"' + (externe ? ' target="_blank" rel="noopener"' : '');
  }

  // "Castres · Culture", ou la rédaction quand l'article n'a ni commune ni rubrique
  function surtitre(item, sansCommune) {
    var parts = [];
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

  // La une : grande photo, voile sombre, titre en blanc, bouton ; le chapô juste dessous
  function htmlUne(a) {
    return '<a class="une-lead"' + lien(a) + '>' +
      '<div class="une-visuel">' + fond(a, true) + '<div class="voile"></div>' +
      '<div class="une-texte">' + pastille(a) +
      '<h2>' + a.title + '</h2>' +
      '<span class="une-meta-clair">' + (a.author ? 'Par ' + a.author + ' · ' : '') + formatDate(a.pubDate) + '</span>' +
      '<span class="btn btn-primary une-bouton">Lire l\'article</span>' +
      '</div></div>' +
      (a.description ? '<p class="une-lead-chapo">' + a.description + '</p>' : '') +
      '</a>';
  }

  // Tuile à côté de la une : photo, voile sombre, titre en blanc
  function htmlTuile(a) {
    return '<a class="une-tuile"' + lien(a) + '>' + fond(a) + '<div class="voile"></div>' +
      '<div class="une-texte">' + pastille(a) +
      '<h3>' + a.title + '</h3>' +
      '<span class="une-meta-clair">' + formatDate(a.pubDate) + '</span>' +
      '</div></a>';
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

  function afficher(items) {
    var articles = items.filter(function (i) { return i.kind !== 'newsletter'; });
    var newsletters = items.filter(function (i) { return i.kind === 'newsletter'; });
    if (!articles.length) {
      zoneUne.innerHTML = '<p class="feed-loading">Aucun article pour le moment.</p>';
      return;
    }

    // La une : le dernier article avec une vraie photo, puis les suivants à côté
    var avecPhoto = articles.filter(function (i) { return i.image && !i.coverGenerique; });
    var une = avecPhoto[0] || articles[0];
    var secondaires = avecPhoto.filter(function (i) { return i !== une; }).slice(0, NB_SECONDAIRES);
    var utilises = [une].concat(secondaires);

    zoneUne.innerHTML = htmlUne(une) +
      (secondaires.length ? '<div class="une-secondaires">' + secondaires.map(htmlTuile).join('') + '</div>' : '');

    // Dernières actus : la suite, dans l'ordre du temps
    var suite = articles.filter(function (i) { return utilises.indexOf(i) === -1; }).slice(0, NB_FIL);
    if (suite.length) {
      fil.innerHTML = suite.map(function (a) { return htmlLigne(a); }).join('');
    } else {
      // Peu d'articles : la une prend toute la largeur
      cote.hidden = true;
      cote.parentNode.classList.add('sans-cote');
    }

    afficherCommunes(articles, utilises);

    // Dernières newsletters
    if (newsletters.length) {
      editions.innerHTML = newsletters.slice(0, NB_EDITIONS).map(function (n) { return htmlLigne(n, true); }).join('');
      editions.parentNode.hidden = false;
    }
  }

  // L'actu de chaque commune : les communes les plus fournies, un article en photo puis des titres
  function afficherCommunes(articles, utilises) {
    var parCommune = Object.create(null);
    articles.forEach(function (a) {
      (a.communes || []).forEach(function (c) {
        var e = parCommune[c.slug] || (parCommune[c.slug] = { slug: c.slug, nom: c.nom, articles: [] });
        e.articles.push(a);
      });
    });
    var liste = Object.keys(parCommune).map(function (k) { return parCommune[k]; })
      .sort(function (x, y) { return y.articles.length - x.articles.length || (x.slug < y.slug ? -1 : 1); });
    if (!liste.length) return;   // pas d'étiquettes de commune (flux de secours) : on ne montre pas cette partie

    var colonnes = liste.map(function (c) {
      return { commune: c, dispo: c.articles.filter(function (a) { return utilises.indexOf(a) === -1; }).slice(0, PAR_VILLE) };
    }).filter(function (c) { return c.dispo.length >= MIN_VILLE; }).slice(0, NB_VILLES);
    if (!colonnes.length) return;   // pas assez d'articles par commune : les pastilles seules n'ont pas d'intérêt

    villesPastilles.innerHTML = liste.map(function (c) {
      return '<a href="articles.html?commune=' + c.slug + '">' + c.nom + '</a>';
    }).join('');

    villesGrille.innerHTML = colonnes.map(function (c) {
      return '<div class="ville">' +
        '<div class="ville-tete"><h3>' + c.commune.nom + '</h3><a href="articles.html?commune=' + c.commune.slug + '">Tout voir</a></div>' +
        htmlCarte(c.dispo[0], 'h4', true) +
        '<ul class="fil">' + c.dispo.slice(1).map(function (a) { return htmlLigne(a, true); }).join('') + '</ul>' +
        '</div>';
    }).join('');
    villes.hidden = false;
  }

  fetch('/.netlify/functions/substack-feed?tous=1')
    .then(function (r) { return r.json(); })
    .then(function (data) { afficher((data && data.items) || []); })
    .catch(function () {
      zoneUne.innerHTML = '<p class="feed-loading">Impossible de charger les articles pour le moment. <a href="https://ipsummedia.substack.com" target="_blank" rel="noopener">Voir sur Substack</a>.</p>';
    });
})();
