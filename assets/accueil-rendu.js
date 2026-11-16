// Rendu des blocs d'articles de la page d'accueil « journal » : la une, les dernières actus, l'actu par rubrique,
// par commune et nationale. Un seul code pour deux usages :
//  - le navigateur (assets/accueil.js) l'applique à la page ;
//  - le serveur (netlify/functions/accueil.js) l'écrit dans le HTML, pour que Google voie les articles sans exécuter de JavaScript.
// Les textes reçus de la fonction substack-feed sont déjà échappés : on peut les insérer tels quels.
// Aucune dépendance au navigateur ni à Netlify : ne touche ni au document ni à window.
(function (racine, fabrique) {
  if (typeof module === 'object' && module.exports) module.exports = fabrique();
  else racine.AccueilRendu = fabrique();
})(typeof self !== 'undefined' ? self : this, function () {
  var NB_SECONDAIRES = 2;   // articles à côté de la une
  var NB_FIL = 10;          // dernières actus (colonne de droite ; 6 seulement sur tablette et téléphone, voir le CSS)
  var NB_VILLES = 4;        // colonnes "commune"
  var PAR_VILLE = 3;        // articles par commune
  var MIN_VILLE = 2;        // il faut au moins 2 articles (hors la une) pour ouvrir la colonne d'une commune
  var NB_RUBRIQUES = 3;     // blocs "rubrique"
  var NB_NATIONAL = 4;      // colonnes (rubriques) du bloc « L'actu nationale »
  var PAR_RUBRIQUE = 4;     // articles par rubrique

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });
    } catch (e) { return ''; }
  }

  // "09h02" pour un article du jour, "Hier", sinon "16 sept." (avec l'année pour un article d'une autre année)
  function quand(iso, maintenant) {
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      var now = maintenant == null ? Date.now() : maintenant;
      var jour = function (t) { return new Date(t).toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' }); };
      var j = jour(d);
      if (j === jour(now)) {
        return d.toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
      }
      if (j === jour(now - 86400000)) return 'Hier';
      return d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short', year: j.slice(0, 4) === jour(now).slice(0, 4) ? undefined : 'numeric' });
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
  function htmlLigne(a, sansCommune, maintenant) {
    var s = surtitre(a, sansCommune);
    return '<li><a' + lien(a) + '>' +
      '<span class="fil-meta"><span>' + quand(a.pubDate, maintenant) + '</span>' + (s ? '<span>' + s + '</span>' : '') + '</span>' +
      '<span class="fil-titre">' + a.title + '</span>' +
      '</a></li>';
  }

  // L'actu nationale : même présentation que « Près de chez vous », avec les rubriques à la place des communes.
  // Le bloc n'apparaît qu'une fois la rédaction nationale lancée (au moins un article). null : rien à montrer.
  function blocNational(nationaux, utilises, maintenant) {
    if (!nationaux.length) return null;
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
    if (!colonnes.length) return null;
    return {
      pastilles: liste.map(function (r) {
        return '<a href="articles.html?edition=national&rubrique=' + r.slug + '">' + r.nom + '</a>';
      }).join(''),
      grille: colonnes.map(function (c) {
        return '<div class="ville">' +
          '<div class="ville-tete"><h3>' + c.rubrique.nom + '</h3><a href="articles.html?edition=national&rubrique=' + c.rubrique.slug + '">Tout voir</a></div>' +
          htmlCarte(c.dispo[0], 'h4', true) +
          '<ul class="fil">' + c.dispo.slice(1).map(function (a) { return htmlLigne(a, true, maintenant); }).join('') + '</ul>' +
          '</div>';
      }).join('')
    };
  }

  // Un bloc par rubrique (les plus récemment alimentées) : un article en photo puis des titres. null : rien à montrer.
  function blocRubriques(articles, utilises, maintenant) {
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
    if (!blocs.length) return null;
    return blocs.map(function (r) {
      var liste = r.articles.slice(0, PAR_RUBRIQUE);
      return '<div class="ville rubrique">' +
        '<div class="ville-tete"><h3>' + r.nom + '</h3><a href="/rubrique/' + r.slug + '">Tout voir</a></div>' +
        htmlCarte(liste[0], 'h4') +
        '<ul class="fil">' + liste.slice(1).map(function (a) { return htmlLigne(a, false, maintenant); }).join('') + '</ul>' +
        '</div>';
    }).join('');
  }

  // L'actu de chaque commune : un article en photo puis des titres, pour les communes où l'on a publié
  // le plus récemment. On classe par date du dernier article et non par nombre d'articles : sinon les
  // mêmes communes, les plus fournies depuis toujours, gardent leur place et une commune qui vient de
  // faire l'actu n'apparaît jamais. null : rien à montrer.
  function blocCommunes(articles, utilises, maintenant) {
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
    if (!liste.length) return null;   // pas d'étiquettes de commune (flux de secours) : on ne montre pas cette partie

    var colonnes = liste.map(function (c) {
      return { commune: c, dispo: c.articles.filter(function (a) { return utilises.indexOf(a) === -1; }).slice(0, PAR_VILLE) };
    }).filter(function (c) { return c.dispo.length >= MIN_VILLE; }).slice(0, NB_VILLES);
    if (!colonnes.length) return null;   // pas assez d'articles par commune : les pastilles seules n'ont pas d'intérêt

    return {
      pastilles: liste.map(function (c) { return '<a href="/commune/' + c.slug + '">' + c.nom + '</a>'; }).join(''),
      grille: colonnes.map(function (c) {
        return '<div class="ville">' +
          '<div class="ville-tete"><h3>' + c.commune.nom + '</h3><a href="/commune/' + c.commune.slug + '">Tout voir</a></div>' +
          htmlCarte(c.dispo[0], 'h4', true) +
          '<ul class="fil">' + c.dispo.slice(1).map(function (a) { return htmlLigne(a, true, maintenant); }).join('') + '</ul>' +
          '</div>';
      }).join('')
    };
  }

  // items : la liste de substack-feed. Rend le HTML de chaque bloc (null quand le bloc ne doit pas apparaître).
  function construire(items, maintenant) {
    items = items || [];
    var articles = items.filter(function (i) { return i.kind !== 'newsletter'; });
    var newsletters = items.filter(function (i) { return i.kind === 'newsletter'; });
    var res = { vide: !articles.length, une: '', fil: null, sansCote: false, rubriques: null, villes: null, national: null, nbNationaux: 0, newsletters: newsletters };
    if (res.vide) return res;

    // La une : le dernier article avec une vraie photo, puis les suivants à côté
    var avecPhoto = articles.filter(function (i) { return i.image && !i.coverGenerique; });
    var une = avecPhoto[0] || articles[0];
    var secondaires = avecPhoto.filter(function (i) { return i !== une; }).slice(0, NB_SECONDAIRES);
    var utilises = [une].concat(secondaires);
    res.une = htmlUne(une) + (secondaires.length ? '<div class="une-secondaires">' + secondaires.map(htmlTuile).join('') + '</div>' : '');

    // Dernières actus : la suite, dans l'ordre du temps
    var suite = articles.filter(function (i) { return utilises.indexOf(i) === -1; }).slice(0, NB_FIL);
    if (suite.length) res.fil = suite.map(function (a) { return htmlLigne(a, false, maintenant); }).join('');
    else res.sansCote = true;   // peu d'articles : la une prend toute la largeur

    // Le national a son propre bloc : « Par rubrique » et « Près de chez vous » restent locaux
    var locaux = articles.filter(function (i) { return i.edition !== 'national'; });
    var nationaux = articles.filter(function (i) { return i.edition === 'national'; });
    res.nbNationaux = nationaux.length;

    // Les blocs rubrique ne reprennent pas ce que la une et la colonne « Dernières actus » montrent déjà
    res.rubriques = blocRubriques(locaux, utilises.concat(suite), maintenant);
    res.villes = blocCommunes(locaux, utilises, maintenant);
    res.national = blocNational(nationaux, utilises.concat(suite), maintenant);
    return res;
  }

  return { construire: construire, ligne: htmlLigne, quand: quand, formatDate: formatDate };
});
