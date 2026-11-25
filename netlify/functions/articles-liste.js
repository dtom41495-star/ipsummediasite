// Rend la page "Nos actus" (/articles.html) avec les 12 premières cartes déjà écrites dans le HTML,
// pour qu'un moteur de recherche les voie sans exécuter JavaScript (voir article.js, même principe
// pour une page d'article). Le script de la page prend ensuite le relais pour les filtres, exactement
// comme avant : cette fonction ne fait que remplacer l'affichage de départ, jamais le mécanisme de
// filtrage, qui reste écrit une seule fois dans ce fichier.
//
// Route (voir netlify.toml, redirection forcée car articles.html existe encore en fichier statique,
// gardé pour le moment comme copie de secours) : /articles.html -> cette fonction.

const SITE = 'https://ipsummedia.fr';
const PAS = 12;

const B = require('../../lib/blocs');
const { carte, blocUne, genre } = B;

exports.handler = async function () {
  try {
    const res = await fetch(SITE + '/.netlify/functions/substack-feed?tous=1', { signal: AbortSignal.timeout(8000) });
    const data = res.ok ? await res.json() : null;
    const items = (data && data.items) || [];
    return { statusCode: 200, headers: entetes(items.length > 0), body: rendrePage(items) };
  } catch (e) {
    return { statusCode: 200, headers: entetes(false), body: rendrePage([]) };
  }
};

function entetes(avecDonnees) {
  const headers = {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': avecDonnees ? 'public, max-age=120' : 'public, max-age=30',
  };
  if (avecDonnees) headers['Netlify-CDN-Cache-Control'] = 'public, max-age=120, stale-while-revalidate=60, durable';
  return headers;
}

function pluriel(n, mots) { return n + ' ' + (n > 1 ? mots[1] : mots[0]); }


// Rubriques et communes des articles (pas des newsletters), les plus fournies d'abord
function compter(items, champ) {
  const noms = {}, n = {};
  items.forEach((i) => (i[champ] || []).forEach((t) => { n[t.slug] = (n[t.slug] || 0) + 1; noms[t.slug] = noms[t.slug] || t.nom; }));
  return Object.keys(n).map((slug) => ({ slug, nom: noms[slug], n: n[slug] })).sort((a, b) => b.n - a.n || (a.slug < b.slug ? -1 : 1));
}

// Le corps de la page : la vue de départ, exactement ce que le script produit au premier rendu (la une, puis les cartes)
function corpsArticles(items) {
  if (!items.length) {
    return '<div id="articles-container"><p class="feed-loading">Impossible de charger les articles pour le moment. Réessayez dans un instant.</p></div>';
  }
  const articles = items.filter((i) => genre(i) === 'article');
  const nbNews = items.length - articles.length;
  const rubriques = compter(articles, 'rubriques');
  const communes = compter(articles, 'communes');
  const editions = [...new Set(articles.map((i) => i.edition).filter(Boolean))];
  const onglet = (cle, libelle, actif) => `<button type="button" class="na-onglet" data-rub="${cle}" aria-pressed="${actif}">${libelle}</button>`;

  const outils = '<div class="na-outils" id="feed-filters"><div class="wrap">' +
    '<div class="na-onglets" id="na-onglets" role="group" aria-label="Rubriques">' + onglet('', 'Tout', true) +
    rubriques.map((r) => onglet(r.slug, r.nom, false)).join('') + (nbNews ? onglet('newsletters', 'Newsletters', false) : '') + '</div>' +
    '<div class="na-selects">' +
    '<label class="na-select" id="na-commune-zone"' + (communes.length ? '' : ' hidden') + '><span>Commune</span><select id="na-commune"><option value="">Toutes les communes</option>' +
    communes.map((c) => `<option value="${c.slug}">${c.nom} (${c.n})</option>`).join('') + '</select></label>' +
    '<label class="na-select" id="na-edition-zone"' + (editions.length > 1 ? '' : ' hidden') + '><span>Édition</span><select id="na-edition"><option value="">Toutes les éditions</option>' +
    '<option value="tarn">Tarn</option><option value="haute-garonne">Haute-Garonne</option><option value="national">National</option></select></label>' +
    '</div></div></div>';

  const dessus = articles.slice(0, 4);
  const suite = articles.slice(4, 4 + PAS);
  const reste = articles.length - dessus.length - suite.length;
  return outils +
    '<div id="articles-container">' + blocUne(dessus) +
    '<section class="journal na-liste"><div class="wrap"><div class="journal-tete"><h2 id="na-titre">Les plus récents</h2><span class="na-statut" id="feed-status" aria-live="polite"></span></div>' +
    '<div class="suite-grille" id="na-grille">' + suite.map((i) => carte(i)).join('') + '</div>' +
    '<div class="feed-more" id="feed-more"' + (reste > 0 ? '' : ' hidden') + '><button type="button" class="btn btn-outline" id="feed-more-btn">Afficher plus (' + pluriel(reste, ['restant', 'restants']) + ')</button></div>' +
    '</div></section></div>';
}

function rendrePage(items) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<script src="/assets/config.js"></script>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Actualités du Tarn et de la Haute-Garonne | Ipsum Média</title>
<meta name="description" content="Tous les derniers articles d'Ipsum Média : reportages, interviews et actualités du Tarn et de la Haute-Garonne.">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE}/articles.html">
<meta property="og:title" content="Actualités du Tarn et de la Haute-Garonne | Ipsum Média">
<meta property="og:description" content="Tous les derniers articles d'Ipsum Média : reportages, interviews et actualités du Tarn et de la Haute-Garonne.">
<meta property="og:image" content="${SITE}/assets/logo-gradient.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Actualités du Tarn et de la Haute-Garonne | Ipsum Média">
<meta name="twitter:description" content="Tous les derniers articles d'Ipsum Média : reportages, interviews et actualités du Tarn et de la Haute-Garonne.">
<meta name="twitter:image" content="${SITE}/assets/logo-gradient.png">
<link rel="canonical" href="${SITE}/articles.html">
<link rel="icon" type="image/png" href="/assets/logo-carre.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bitter:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css?v=20261502">
<!-- Statistiques d'audience sans cookies (Umami, hébergé par Ipsum Média) -->
<script defer src="https://stats.ipsummedia.fr/script.js" data-website-id="02190f37-9db9-421b-b0c2-f71b803e2ccb" data-performance="true"></script>
</head>
<body>

<header class="site-header">
  <div class="wrap">
    <a href="/index.html#accueil" class="brand">
      <img src="/assets/logo.png" alt="Ipsum Média">
      <span class="brand-sous">Média associatif</span>
    </a>
    <nav class="main-nav" id="main-nav">
      <ul>
        <li><a href="/index.html#accueil">Accueil</a></li>
        <li class="nav-rubriques">
          <a href="/articles.html" class="active">Nos actus</a>
          <button type="button" class="nav-rubriques-toggle" aria-expanded="false" aria-controls="nav-rubriques-menu" aria-label="Rubriques" hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <ul class="nav-rubriques-menu" id="nav-rubriques-menu" hidden></ul>
        </li>
        <li class="nav-rubriques nav-agenda">
          <a href="/agenda/tarn">Agenda</a>
          <button type="button" class="nav-rubriques-toggle" aria-expanded="false" aria-controls="nav-agenda-menu" aria-label="Choisir un agenda">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <ul class="nav-rubriques-menu" id="nav-agenda-menu" hidden><li><a href="/agenda/tarn">Tarn</a></li><li><a href="/agenda/haute-garonne">Haute-Garonne</a></li></ul>
        </li>
        <li><a href="/a-propos.html">À propos</a></li>
        <li><a href="/index.html#contact">Contact</a></li>
      </ul>
    </nav>
    <div class="header-cta">
      <a class="btn btn-primary" href="https://ipsummedia.substack.com/subscribe" target="_blank" rel="noopener"><span class="long">Je m'inscris</span></a>
      <button class="nav-toggle" id="nav-toggle" aria-label="Menu">
        <span></span><span></span><span></span>
      </button>
    </div>
  </div>
</header>
<div class="ticker" id="ticker" role="region" aria-label="Dernières actualités en direct">
  <div class="ticker-inner">
    <span class="ticker-label"><span class="ticker-dot" aria-hidden="true"></span>En direct</span>
    <div class="ticker-viewport"><div class="ticker-track" id="ticker-track"><noscript><a class="ticker-item" href="/articles.html">Toutes nos actus</a></noscript></div></div>
    <button type="button" class="ticker-pause" id="ticker-pause" aria-label="Mettre en pause le défilement" title="Mettre en pause le défilement" hidden></button>
  </div>
</div>

<main>

  <section class="page-bandeau">
    <div class="wrap">
      <span class="page-bandeau-eyebrow">Nos actus</span>
      <h1>Tous nos articles</h1>
      <p class="page-bandeau-lead">Reportages, interviews et actualités du Tarn, de la Haute-Garonne et du national, publiés par la rédaction.</p>
    </div>
  </section>

  ${corpsArticles(items)}

</main>

<footer class="site-footer">
  <div class="wrap footer-top">
    <div class="footer-brand">
      <img src="/assets/logo-white.png" alt="Ipsum Média">
      <img src="/assets/logo-ess.png" alt="ESS — L'économie en mieux" class="logo-ess">
    </div>
    <div class="footer-social-group">
    <span class="footer-social-label">Suivez-nous</span>
    <div class="social-links">
      <a href="https://www.linkedin.com/company/106848404/" target="_blank" rel="noopener" aria-label="LinkedIn">
        <svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="9" width="4" height="13"/><circle cx="4" cy="4" r="2.5"/><path d="M10 9h4v2c1-1.5 2.5-2.4 4.5-2.4 4 0 5.5 2.5 5.5 6.5V22h-4v-6c0-1.8-.7-3-2.3-3-1.6 0-2.7 1.2-2.7 3v6h-4z"/></svg>
      </a>
      <a href="https://www.facebook.com/profile.php?id=61591708070712" target="_blank" rel="noopener" aria-label="Facebook">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-8h2.7l.4-3.1h-3.1V8c0-.9.2-1.5 1.6-1.5H17V3.6C16.6 3.5 15.5 3.4 14.2 3.4c-2.7 0-4.6 1.6-4.6 4.6v2h-3v3.1h3V21z"/></svg>
      </a>
      <a href="https://www.instagram.com/ipsum_media_" target="_blank" rel="noopener" aria-label="Instagram">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none"/></svg>
      </a>
      <a href="https://www.youtube.com/@ipsummedia-u2g" target="_blank" rel="noopener" aria-label="YouTube">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="5.5" width="20" height="13" rx="4"/><path d="M10 9.5l6 2.5-6 2.5z" fill="currentColor" stroke="none"/></svg>
      </a>
      <a href="https://www.threads.com/@ipsum_media_" target="_blank" rel="noopener" aria-label="Threads">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.263 11.097c-.03-3.486-1.92-5.586-5.111-5.586-2.13 0-3.922.963-4.863 2.499l2.062 1.438c.535-.843 1.272-1.543 2.628-1.543 1.528 0 2.318.85 2.544 2.431a15 15 0 0 0-2.236-.173c-4.125 0-6.068 1.867-6.068 4.336s1.943 3.99 4.804 3.99c3.139 0 5.013-2.115 5.781-4.735.798.361 1.348 1.204 1.348 2.47 0 3.387-3.907 5.232-7.22 5.232-4.885 0-8.077-3.207-8.077-8.424 0-6.392 4.223-10.487 9.9-10.487 3.808 0 5.69 1.671 6.97 3.914l2.108-1.475C21.44 2.078 18.331 0 13.663 0 6.227 0 1.168 5.277 1.168 12.934c0 7 4.953 11.066 10.856 11.066 4.878 0 9.809-2.846 9.809-7.716 0-2.545-1.46-4.231-3.569-5.187m-6.33 4.855c-1.077 0-2.026-.512-2.026-1.453 0-1.483 1.822-1.934 3.606-1.934.678 0 1.34.045 1.927.173-.422 1.927-1.671 3.215-3.508 3.214Z"/></svg>
      </a>
      <a href="https://www.tiktok.com/@ipsum.media" target="_blank" rel="noopener" aria-label="TikTok">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
      </a>
    </div>
    </div>
  </div>
  <div class="wrap">
    <span>© <span id="year"></span> Ipsum Média, association loi 1901</span>
    <span>
      <a href="https://compo.ipsummedia.fr/" target="_blank" rel="noopener">Espace bénévole</a>
      · <a href="mailto:contact@ipsummedia.fr">contact@ipsummedia.fr</a>
    </span>
  </div>
  <div class="wrap footer-legal">
    <p>Ipsum Média est une association loi 1901 immatriculée au Registre National des Associations sous le n°W812010251. SIRET 100 238 435 00018, code APE 58.13Y (Édition de revues et périodiques). <a href="/mentions-legales.html">Mentions légales</a> · <a href="/confidentialite.html">Confidentialité</a></p>
  </div>
</footer>

<script>
  document.getElementById('year').textContent = new Date().getFullYear();
  const toggle = document.getElementById('nav-toggle');
  const nav = document.getElementById('main-nav');
  toggle.addEventListener('click', () => nav.classList.toggle('open'));
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));
</script>

<script src="/assets/tarteaucitron/tarteaucitron.min.js"></script>
<script>
  tarteaucitron.init({
    privacyUrl: '/confidentialite.html',
    orientation: 'bottom',
    showAlertSmall: false,
    cookieslist: true,
    acceptAllCta: true,
    denyAllCta: true,
    highPrivacy: true,
    handleBrowserDNTRequest: false,
    removeCredit: true,
    moreInfoLink: false,
    useExternalCss: false,
    readmoreLink: ''
  });

  // Cartes de chaleur Umami (recorder.js) : enregistrent les clics et le défilement de chaque visite, donc seulement avec accord
  tarteaucitron.services.umamicartes = { key:'umamicartes', type:'analytic', name:'Umami (cartes de chaleur)', uri:'https://ipsummedia.fr/confidentialite.html', needConsent:true, cookies:[],
    js:function(){ 'use strict'; tarteaucitron.addScript('https://stats.ipsummedia.fr/recorder.js', '', null, null, 'data-website-id', '02190f37-9db9-421b-b0c2-f71b803e2ccb'); } };
  (tarteaucitron.job = tarteaucitron.job || []).push('umamicartes');

  tarteaucitron.user.adsensecapub = 'ca-pub-7695287329907050';
  (tarteaucitron.job = tarteaucitron.job || []).push('adsenseauto');
</script>

<script>
  (function() {
    var PAS = 12;   // cartes ajoutées à chaque « Afficher plus »
    // Les mêmes fonctions que le serveur (lib/blocs.js) : le premier affichage et les suivants sont identiques
    ${[B.formatDate, B.lienItem, B.attrsLien, B.surtitre, B.sansPhoto, B.carte, B.blocUne, B.genre].map((f) => f.toString()).join('\n    ')}

    var container = document.getElementById('articles-container');
    var onglets = document.getElementById('na-onglets');
    var selCommune = document.getElementById('na-commune'), zoneCommune = document.getElementById('na-commune-zone');
    var selEdition = document.getElementById('na-edition'), zoneEdition = document.getElementById('na-edition-zone');
    var statut = document.getElementById('feed-status');
    var NOMS_EDITIONS = { 'tarn': 'Tarn', 'haute-garonne': 'Haute-Garonne', 'national': 'National' };

    var tous = [];
    var etat = { newsletters: false, rubrique: '', commune: '', edition: '', nb: PAS };
    var COMPTEURS_FAITS = false;

    function aSlug(item, champ, slug) { return (item[champ] || []).some(function(t) { return t.slug === slug; }); }
    function pluriel(n, mots) { return n + ' ' + (n > 1 ? mots[1] : mots[0]); }

    // Les publications qui passent les choix faits
    function filtrer(sans) {
      return tous.filter(function(item) {
        if (etat.newsletters) return genre(item) === 'newsletter';
        if (genre(item) !== 'article') return false;
        if (etat.edition && item.edition !== etat.edition) return false;
        if (sans !== 'rubrique' && etat.rubrique && !aSlug(item, 'rubriques', etat.rubrique)) return false;
        if (sans !== 'commune' && etat.commune && !aSlug(item, 'communes', etat.commune)) return false;
        return true;
      });
    }

    function nomDe(champ, slug) {
      var nom = '';
      tous.forEach(function(item) { (item[champ] || []).forEach(function(t) { if (t.slug === slug) nom = t.nom; }); });
      return nom;
    }

    // Les communes proposées dans la liste : celles de la rubrique choisie, avec leur nombre d'articles
    function majCommunes() {
      var compte = {}, noms = {};
      filtrer('commune').forEach(function(item) {
        (item.communes || []).forEach(function(c) { compte[c.slug] = (compte[c.slug] || 0) + 1; noms[c.slug] = c.nom; });
      });
      var liste = Object.keys(compte).map(function(s) { return { slug: s, nom: noms[s], n: compte[s] }; })
        .sort(function(a, b) { return b.n - a.n || (a.slug < b.slug ? -1 : 1); });
      if (etat.commune && !compte[etat.commune]) etat.commune = '';
      selCommune.innerHTML = '<option value="">Toutes les communes</option>' + liste.map(function(c) {
        return '<option value="' + c.slug + '"' + (c.slug === etat.commune ? ' selected' : '') + '>' + c.nom + ' (' + c.n + ')</option>';
      }).join('');
      zoneCommune.hidden = etat.newsletters || !liste.length;
    }

    function majOnglets() {
      onglets.querySelectorAll('.na-onglet').forEach(function(b) {
        var cle = b.getAttribute('data-rub');
        b.setAttribute('aria-pressed', String(cle === 'newsletters' ? etat.newsletters : (!etat.newsletters && cle === etat.rubrique)));
      });
    }

    function dessiner(ajout) {
      var liste = filtrer();
      var filtre = etat.newsletters || etat.rubrique || etat.commune || etat.edition;
      var html = '';
      var depart = 0;
      // Sans filtre : le dernier article en grand, les trois suivants à côté, puis la suite
      if (!filtre && liste.length) { html += blocUne(liste.slice(0, 4)); depart = Math.min(4, liste.length); }
      var visibles = liste.slice(depart, depart + etat.nb);
      var restant = liste.length - depart - visibles.length;
      var titre = etat.newsletters ? 'Les newsletters' : (filtre ? 'Les articles' : 'Les plus récents');
      var etiquettes = [];
      if (!etat.newsletters && etat.rubrique) etiquettes.push(nomDe('rubriques', etat.rubrique));
      if (etat.commune) etiquettes.push(nomDe('communes', etat.commune));
      if (etat.edition) etiquettes.push(NOMS_EDITIONS[etat.edition]);
      html += '<section class="journal na-liste"><div class="wrap"><div class="journal-tete"><h2 id="na-titre">' + titre + (etiquettes.length ? ' · ' + etiquettes.join(' · ') : '') + '</h2>' +
        '<span class="na-statut" id="feed-status" aria-live="polite">' + (filtre ? pluriel(liste.length, etat.newsletters ? ['newsletter', 'newsletters'] : ['article', 'articles']) : '') + '</span></div>';
      if (!liste.length) {
        html += '<div class="feed-empty"><p>Aucun article pour ce choix.</p><button type="button" class="btn btn-outline" data-action="reinit">Tout afficher</button></div>';
      } else {
        html += '<div class="suite-grille" id="na-grille">' + visibles.map(function(i) { return carte(i); }).join('') + '</div>' +
          '<div class="feed-more" id="feed-more"' + (restant > 0 ? '' : ' hidden') + '><button type="button" class="btn btn-outline" id="feed-more-btn">Afficher plus (' + pluriel(restant, ['restant', 'restants']) + ')</button></div>';
      }
      html += '</div></section>';
      container.innerHTML = html;
    }

    // L'adresse garde les choix faits (?rubrique=culture&commune=castres) : on peut partager la vue
    function majAdresse() {
      if (!window.history || !history.replaceState) return;
      var q = [];
      if (etat.newsletters) q.push('type=newsletters');
      if (!etat.newsletters && etat.edition) q.push('edition=' + encodeURIComponent(etat.edition));
      if (!etat.newsletters && etat.commune) q.push('commune=' + encodeURIComponent(etat.commune));
      if (!etat.newsletters && etat.rubrique) q.push('rubrique=' + encodeURIComponent(etat.rubrique));
      try { history.replaceState(null, '', location.pathname + (q.length ? '?' + q.join('&') : '') + location.hash); } catch (e) {}
    }

    function toutMettreAJour() { etat.nb = PAS; majCommunes(); majOnglets(); dessiner(false); majAdresse(); }

    onglets.addEventListener('click', function(e) {
      var b = e.target.closest('.na-onglet');
      if (!b) return;
      var cle = b.getAttribute('data-rub');
      etat.newsletters = cle === 'newsletters';
      etat.rubrique = etat.newsletters ? '' : cle;
      if (etat.newsletters) etat.commune = '';
      toutMettreAJour();
    });
    selCommune.addEventListener('change', function() { etat.commune = selCommune.value; etat.nb = PAS; dessiner(false); majAdresse(); });
    selEdition.addEventListener('change', function() { etat.edition = selEdition.value; toutMettreAJour(); });

    container.addEventListener('click', function(e) {
      if (e.target.closest('[data-action="reinit"]')) { etat.newsletters = false; etat.rubrique = ''; etat.commune = ''; etat.edition = ''; selEdition.value = ''; toutMettreAJour(); return; }
      if (e.target.closest('#feed-more-btn')) {
        var avant = filtrer().length;
        etat.nb += PAS;
        var vus = container.querySelector('#na-grille').children.length;
        var liste = filtrer(), filtre = etat.newsletters || etat.rubrique || etat.commune || etat.edition;
        var depart = !filtre ? Math.min(4, liste.length) : 0;
        var visibles = liste.slice(depart, depart + etat.nb);
        container.querySelector('#na-grille').insertAdjacentHTML('beforeend', visibles.slice(vus).map(function(i) { return carte(i); }).join(''));
        var restant = liste.length - depart - visibles.length;
        var zone = container.querySelector('#feed-more');
        zone.hidden = restant <= 0;
        container.querySelector('#feed-more-btn').textContent = 'Afficher plus (' + pluriel(restant, ['restant', 'restants']) + ')';
      }
    });

    fetch('/.netlify/functions/substack-feed?tous=1')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        tous = (data && data.items) || [];
        if (!tous.length) { container.innerHTML = '<p class="feed-loading">Aucun article pour le moment.</p>'; return; }
        // Choix demandés dans l'adresse (liens partagés, menu des rubriques)
        var params = new URLSearchParams(location.search);
        var edition = params.get('edition');
        if (edition && Object.prototype.hasOwnProperty.call(NOMS_EDITIONS, edition)) { etat.edition = edition; selEdition.value = edition; }
        if (params.get('type') === 'newsletters' && tous.some(function(i) { return genre(i) === 'newsletter'; })) etat.newsletters = true;
        var rubrique = params.get('rubrique');
        if (!etat.newsletters && rubrique && nomDe('rubriques', rubrique)) etat.rubrique = rubrique;
        var commune = params.get('commune');
        if (!etat.newsletters && commune && nomDe('communes', commune)) etat.commune = commune;
        majCommunes(); majOnglets();
        if (etat.rubrique || etat.commune || etat.edition || etat.newsletters) dessiner(false);
      })
      .catch(function() {
        container.innerHTML = '<p class="feed-loading">Impossible de charger les articles pour le moment. Réessayez dans un instant.</p>';
      });
  })();
</script>

<script src="/assets/nav-rubriques.js"></script>
<script src="/assets/utm-substack.js"></script>
<script src="/assets/ticker.js"></script>
<script src="/assets/jour.js"></script>

</body>
</html>
`;
}


