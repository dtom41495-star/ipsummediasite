// Bandeau "en direct" sous le menu : les 5 derniers articles défilent, chacun renvoie
// vers son article. Les articles viennent de la même fonction que l'accueil (substack-feed).
// Si elle ne répond pas ou ne renvoie aucun article, le bandeau disparaît.
(function () {
  var bandeau = document.getElementById('ticker');
  var piste = document.getElementById('ticker-track');
  var bouton = document.getElementById('ticker-pause');
  if (!bandeau || !piste || !bouton) return;

  var NB_ARTICLES = 5;   // nombre d'articles qui défilent
  var VITESSE = 60;      // vitesse du défilement, en pixels par seconde

  var fenetre = piste.parentNode;
  // Pour les visiteurs qui ont demandé moins d'animations : pas de défilement automatique
  var immobile = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var ICONE_PAUSE = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
  var ICONE_LECTURE = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';

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

  function adresse(article) {
    var m = article.link && article.link.match(/\/p\/([^/?#]+)/);
    var url = m ? '/articles/' + m[1] : (article.link || '/articles.html');
    return url.replace(/"/g, '&quot;');
  }

  // Le titre arrive déjà échappé par la fonction : on peut l'insérer tel quel
  function jeu(articles) {
    return '<div class="ticker-set">' + articles.map(function (a) {
      var q = quand(a.pubDate);
      return '<a class="ticker-item" href="' + adresse(a) + '">' +
        (q ? '<span class="ticker-when">' + q + '</span>' : '') +
        '<span class="ticker-titre">' + a.title + '</span></a>';
    }).join('') + '</div>';
  }

  // Répète la liste assez de fois pour que le défilement ne laisse jamais de vide, et règle
  // la vitesse d'après la longueur de la liste
  function disposer() {
    var premier = piste.querySelector('.ticker-set');
    if (!premier) return;
    var anciennes = piste.querySelectorAll('.ticker-set[data-copie]');
    for (var i = 0; i < anciennes.length; i++) piste.removeChild(anciennes[i]);

    var largeur = premier.getBoundingClientRect().width;
    if (!largeur) return;
    var n = Math.max(2, Math.ceil(fenetre.clientWidth / largeur) + 1);
    for (var k = 1; k < n; k++) {
      var copie = premier.cloneNode(true);
      copie.setAttribute('aria-hidden', 'true');   // les lecteurs d'écran ne lisent la liste qu'une fois
      copie.setAttribute('data-copie', '');
      var liens = copie.querySelectorAll('a');
      for (var j = 0; j < liens.length; j++) liens[j].setAttribute('tabindex', '-1');
      piste.appendChild(copie);
    }
    piste.style.setProperty('--copies', n);
    piste.style.setProperty('--duree', Math.max(10, Math.round(largeur / VITESSE)) + 's');
  }

  function afficher(articles) {
    piste.innerHTML = jeu(articles);
    if (immobile) {
      bandeau.classList.add('is-static');   // la liste reste en place, on la fait défiler à la main
      return;
    }
    disposer();
    bandeau.classList.add('is-ready');
    bouton.innerHTML = ICONE_PAUSE;
    bouton.hidden = false;

    // Une fois les polices chargées, la largeur du texte peut changer
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(disposer);
    var attente;
    window.addEventListener('resize', function () {
      clearTimeout(attente);
      attente = setTimeout(disposer, 200);
    });
  }

  bouton.addEventListener('click', function () {
    var enPause = bandeau.classList.toggle('is-paused');
    var libelle = enPause ? 'Reprendre le défilement' : 'Mettre en pause le défilement';
    bouton.innerHTML = enPause ? ICONE_LECTURE : ICONE_PAUSE;
    bouton.setAttribute('aria-label', libelle);
    bouton.setAttribute('title', libelle);
  });

  fetch('/.netlify/functions/substack-feed')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      // Les vrais articles, pas les newsletters
      var articles = ((data && data.items) || [])
        .filter(function (i) { return i.kind !== 'newsletter'; })
        .slice(0, NB_ARTICLES);
      if (!articles.length) { bandeau.hidden = true; return; }
      afficher(articles);
    })
    .catch(function () { bandeau.hidden = true; });
})();
