// Liste des journalistes de la page « À propos » : lue dans Compo via /.netlify/functions/equipe.
// Tout est écrit avec textContent (jamais innerHTML) : un nom ne peut pas injecter de code dans la page.
(function () {
  var zone = document.getElementById('equipe-liste');
  var section = document.getElementById('journalistes');
  if (!zone || !section) return;

  function el(tag, classe, texte) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texte != null) e.textContent = texte;
    return e;
  }

  fetch('/.netlify/functions/equipe')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var equipe = (data && data.equipe) || [];
      if (!equipe.length) return;   // la section reste cachée : la page garde son contenu d'avant
      equipe.forEach(function (m) {
        var carte = el('div', 'equipe-carte');
        carte.appendChild(el('h3', null, m.prenom + ' ' + m.nom));
        if (m.fonction) carte.appendChild(el('p', 'equipe-fonction', m.fonction));
        if (m.redactions && m.redactions.length) {
          var liste = el('p', 'equipe-redactions');
          m.redactions.forEach(function (r) { liste.appendChild(el('span', 'feed-tag', r)); });
          carte.appendChild(liste);
        }
        if (m.email && /^[a-z0-9._+-]+@ipsummedia\.fr$/i.test(m.email)) {
          var a = el('a', 'equipe-mail', m.email);
          a.href = 'mailto:' + m.email;
          carte.appendChild(a);
        }
        zone.appendChild(carte);
      });
      section.hidden = false;
    })
    .catch(function () {});
})();
