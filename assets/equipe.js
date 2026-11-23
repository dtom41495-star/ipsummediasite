// Liste des journalistes de la page « À propos », rédaction par rédaction : « Nom Prénom — adresse e-mail ».
// Données : /flux/equipe.json (membres actifs, ni inactifs ni indisponibles, qui n'ont pas décoché leur apparition).
// Tout est écrit avec textContent (jamais innerHTML) : un nom ne peut pas injecter de code dans la page.
(function () {
  var zone = document.getElementById('equipe-liste');
  var section = document.getElementById('journalistes');
  if (!zone || !section) return;

  // Ordre des rédactions sur la page ; une rédaction inconnue passe après, par ordre alphabétique
  var ORDRE = ["La Rédac' du Tarn", "La Rédac' d'Haute-Garonne", "La Rédac' nationale"];

  function el(tag, classe, texte) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texte != null) e.textContent = texte;
    return e;
  }

  fetch('/flux/equipe.json')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var equipe = (data && data.equipe) || [];
      if (!equipe.length) return;   // la section reste cachée : la page garde son contenu d'avant

      // Une personne de plusieurs rédactions figure dans chacune
      var parRedac = {};
      equipe.forEach(function (m) {
        (m.redactions || []).forEach(function (r) { (parRedac[r] = parRedac[r] || []).push(m); });
      });
      var noms = Object.keys(parRedac).sort(function (a, b) {
        var ia = ORDRE.indexOf(a), ib = ORDRE.indexOf(b);
        if (ia === -1 && ib === -1) return a < b ? -1 : 1;
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });
      if (!noms.length) return;

      noms.forEach(function (redac) {
        var membres = parRedac[redac].slice().sort(function (a, b) {
          return (a.nom + ' ' + a.prenom).localeCompare(b.nom + ' ' + b.prenom, 'fr');
        });
        zone.appendChild(el('h3', 'equipe-redac', redac));
        var ul = el('ul', 'equipe-ul');
        membres.forEach(function (m) {
          var li = el('li');
          var libelle = m.nom + ' ' + m.prenom;   // « Nom Prénom »
          if (m.slug && m.nbArticles > 0 && /^[a-z0-9-]+$/.test(m.slug)) {
            var lien = el('a', 'equipe-nom', libelle);
            lien.href = '/auteurs/' + m.slug;
            li.appendChild(lien);
          } else {
            li.appendChild(el('span', 'equipe-nom', libelle));
          }
          if (m.email && /^[a-z0-9._+-]+@ipsummedia\.fr$/i.test(m.email)) {
            li.appendChild(document.createTextNode(' — '));
            var a = el('a', 'equipe-mail', m.email);
            a.href = 'mailto:' + m.email;
            li.appendChild(a);
          }
          ul.appendChild(li);
        });
        zone.appendChild(ul);
      });
      section.hidden = false;
    })
    .catch(function () {});
})();
