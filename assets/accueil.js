// Page d'accueil "journal" : la une, les dernières actus, l'actu de chaque commune et les
// dernières newsletters, à partir de la liste des articles Substack (fonction substack-feed).
// Les textes reçus de la fonction sont déjà échappés : on peut les insérer tels quels.
(function () {
  var zoneUne = document.getElementById('une-main');
  if (!zoneUne) return;

  var NB_EDITIONS = 3;      // dernières newsletters
  var R = window.AccueilRendu;   // le rendu des blocs d'articles est dans assets/accueil-rendu.js (le serveur l'utilise aussi)

  var fil = document.getElementById('une-fil');
  var cote = document.getElementById('une-cote');
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
  // Les éditions : l'identifiant vient de la fonction substack-feed (item.edition). Le jour d'envoi
  // n'est affiché que quand il est connu (null : pas encore décidé).
  var EDITIONS = [
    { slug: 'tarn', nom: 'Tarn', base: 'https://ipsummedia.substack.com', jour: 'Chaque jeudi' },
    { slug: 'haute-garonne', nom: 'Haute-Garonne', base: 'https://ipsummediahautegaronne.substack.com', jour: null },
    { slug: 'national', nom: 'National', base: 'https://ipsummedianational.substack.com', jour: null }
  ];

  function afficher(items) {
    var r = R.construire(items);
    if (r.vide) {
      zoneUne.innerHTML = '<p class="feed-loading">Aucun article pour le moment.</p>';
      fil.innerHTML = '';   // efface le squelette de chargement, sinon il reste figé
      return;
    }
    zoneUne.innerHTML = r.une;
    if (r.fil !== null) {
      fil.innerHTML = r.fil;
      fil.removeAttribute('aria-hidden');   // la liste est faite de vrais liens : visible des lecteurs d'écran (le squelette, lui, était caché)
    } else {
      // Peu d'articles : la une prend toute la largeur
      cote.hidden = true;
      cote.parentNode.classList.add('sans-cote');
    }
    if (r.rubriques !== null) { rubriquesGrille.innerHTML = r.rubriques; rubriques.hidden = false; }
    if (r.villes) { villesPastilles.innerHTML = r.villes.pastilles; villesGrille.innerHTML = r.villes.grille; villes.hidden = false; }
    if (r.national) { nationalPastilles.innerHTML = r.national.pastilles; nationalGrille.innerHTML = r.national.grille; national.hidden = false; }
    afficherEditions(items, r.nbNationaux > 0);

    // Dernières newsletters
    if (r.newsletters.length) {
      editions.innerHTML = r.newsletters.slice(0, NB_EDITIONS).map(function (n) { return R.ligne(n, true); }).join('');
      editions.parentNode.hidden = !!(cartesEditions && !cartesEditions.hidden);   // remplacé par les cartes quand il y a plusieurs éditions
    }
  }


  // Onglets d'édition et newsletters par édition : seulement quand il y a plusieurs éditions à choisir,
  // donc dès que la rédaction nationale a publié. Avant, l'accueil reste exactement comme il était.
  function afficherEditions(items, plusieurs) {
    if (!plusieurs) return;
    if (ongletsEditions) ongletsEditions.hidden = false;
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

  fetch('/.netlify/functions/substack-feed?tous=1')
    .then(function (r) { return r.json(); })
    .then(function (data) { afficher((data && data.items) || []); })
    .catch(function () {
      zoneUne.innerHTML = '<p class="feed-loading">Impossible de charger les articles pour le moment. <a href="https://ipsummedia.substack.com" target="_blank" rel="noopener">Voir sur Substack</a>.</p>';
      fil.innerHTML = '';   // efface le squelette de chargement, sinon il reste figé
    });
})();
