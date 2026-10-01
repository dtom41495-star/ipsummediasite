// Zones de publicité (.pub-zone).
//
// Tant que Google AdSense n'a pas rempli un emplacement (compte pas encore validé, pas de
// consentement aux cookies, pas d'annonce disponible), le cadre affiche un « encart maison » :
// une proposition d'Ipsum Média (don, newsletter, bénévolat) ou l'« Espace partenaire »
// pour les commerces locaux. Ce n'est PAS de la publicité et ça ne se présente pas comme telle.
//
// Dès que Google remplit l'emplacement (data-ad-status="filled"), l'encart disparaît tout seul
// et l'annonce prend sa place : rien à retirer le jour où AdSense valide.
// Pour couper les encarts avant : mettre ENCARTS_MAISON à false.
(function () {
  var ENCARTS_MAISON = true;

  var CONTACT = '/#contact';
  var ENCARTS = {
    partenaire: {
      etiquette: 'Espace partenaire',
      titre: 'Votre commerce ici',
      texte: 'Une place pour votre commerce, votre association ou votre événement devant les lecteurs du Tarn. Parlons-en.',
      bouton: 'Nous contacter',
      href: CONTACT,
      icone: '<path d="M4 9l1.5-5h13L20 9"/><path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"/><path d="M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9"/>'
    },
    don: {
      etiquette: 'Ipsum Média vous propose',
      titre: 'Faire un don',
      texte: 'Un média associatif indépendant, gratuit grâce à celles et ceux qui le soutiennent. Chaque don, même petit, nous aide à continuer.',
      bouton: 'Je fais un don',
      href: 'https://www.helloasso.com/associations/ipsum-media',
      externe: true,
      icone: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>'
    },
    newsletter: {
      etiquette: 'Ipsum Média vous propose',
      titre: 'Recevoir la newsletter du jeudi',
      texte: 'L\'actu du Tarn dans votre boîte mail, chaque jeudi. Gratuit, sans spam.',
      bouton: 'Je m\'inscris',
      href: '/#newsletter',
      icone: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'
    },
    benevole: {
      etiquette: 'Ipsum Média vous propose',
      titre: 'Devenir bénévole',
      texte: 'Reportage, écriture, photo, montage : rejoignez l\'équipe d\'un média associatif fait par et pour les Tarnais.',
      bouton: 'Nous rejoindre',
      href: '/nous-rejoindre.html',
      icone: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 14a4 4 0 0 1 4 4v2"/>'
    }
  };
  // Zones sans choix imposé (data-encart) : tirage au sort, l'espace partenaire plus souvent
  var ALTERNE = ['partenaire', 'don', 'newsletter', 'partenaire', 'benevole'];

  var zones = document.querySelectorAll('.pub-zone');
  for (var i = 0; i < zones.length; i++) surveiller(zones[i]);

  function creerEncart(cle) {
    var e = ENCARTS[cle];
    var div = document.createElement('div');
    div.className = 'encart-maison';
    div.setAttribute('data-encart-type', cle);
    div.innerHTML =
      '<svg class="encart-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + e.icone + '</svg>' +
      '<div class="encart-texte"><span class="encart-etiquette"></span><strong class="encart-titre"></strong><span class="encart-corps"></span></div>' +
      '<a class="btn btn-primary encart-bouton"></a>';
    div.querySelector('.encart-etiquette').textContent = e.etiquette;
    div.querySelector('.encart-titre').textContent = e.titre;
    div.querySelector('.encart-corps').textContent = e.texte;
    var a = div.querySelector('.encart-bouton');
    a.textContent = e.bouton;
    a.href = e.href;
    if (e.externe) { a.target = '_blank'; a.rel = 'noopener'; }
    return div;
  }

  function surveiller(zone) {
    var ins = zone.querySelector('ins.adsbygoogle');
    var boite = zone.querySelector('.pub-boite');
    var encart = null;

    if (ENCARTS_MAISON && boite) {
      var cle = zone.getAttribute('data-encart');
      if (!ENCARTS[cle]) cle = ALTERNE[Math.floor(Math.random() * ALTERNE.length)];
      encart = creerEncart(cle);
      boite.insertBefore(encart, boite.firstChild);
    }

    function maj() {
      var rempli = !!ins && ins.getAttribute('data-ad-status') === 'filled';
      zone.classList.toggle('is-filled', rempli);
      zone.classList.toggle('a-encart', !!encart && !rempli);
    }

    maj();
    if (ins && window.MutationObserver) {
      new MutationObserver(maj).observe(ins, { attributes: true, attributeFilter: ['data-ad-status'] });
    }
  }
})();
