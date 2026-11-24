// Page d'un événement de l'agenda public : /evenement/<adresse>. Titre, date, lieu, description, aperçu pour les réseaux sociaux
// (photo, titre) et données structurées « Event » pour Google. Les coordonnées de l'organisateur n'y figurent jamais.
const compo = require('../../lib/compo');
const { SITE, echapper, enveloppe, reponseIndisponible } = require('../../lib/page');
const { EDITIONS, CATEGORIES, dateLongue, horaire, heure, urlPhoto, carte, lienGoogleAgenda, lienEvenement } = require('../../lib/agenda');

exports.handler = async function (event) {
  const m = String((event && event.path) || '').match(/evenement\/([a-z0-9-]{1,120})\/?$/);
  const slug = m ? m[1] : '';
  const tous = await compo.agenda();
  if (!tous) return reponseIndisponible();
  const e = tous.find((x) => x.slug === slug);
  if (!e) return introuvable();
  const ed = EDITIONS[e.edition] || EDITIONS.tarn;
  const url = SITE + lienEvenement(e);
  const photo = urlPhoto(e);
  const paragraphes = String(e.description || '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
    .map((p) => `<p>${echapper(p).replace(/\n/g, '<br>')}</p>`).join('');
  const autres = tous.filter((x) => x.edition === e.edition && x.slug !== e.slug).slice(0, 4);
  const quand = `${dateLongue(e.date_debut)} · ${horaire(e)}`;
  const aCarte = Number.isFinite(Number(e.lat)) && Number.isFinite(Number(e.lng)) && e.lat != null && e.lng != null;
  const lat = aCarte ? Number(e.lat) : null, lng = aCarte ? Number(e.lng) : null;

  const main = `
  <section class="page-bandeau">
    <div class="wrap">
      <nav class="theme-fil" aria-label="Fil d'Ariane"><a href="/index.html#accueil">Accueil</a> › <a href="/agenda/${e.edition}">${echapper(ed.titre)}</a> › <span aria-current="page">${echapper(e.titre)}</span></nav>
      <span class="page-bandeau-eyebrow">${echapper(CATEGORIES[e.categorie] || 'Événement')} · ${echapper(e.commune)}</span>
      <h1 class="ev-titre">${echapper(e.titre)}</h1>
      <p class="page-bandeau-lead">${echapper(quand)}<br>${echapper(e.lieu)}, ${echapper(e.commune)}</p>
    </div>
  </section>
  <section class="journal ev-corps"><div class="wrap ev-grille">
    <div class="ev-texte">
      ${photo ? `<img class="ev-photo" src="${echapper(photo)}" alt="" decoding="async">` : ''}
      ${paragraphes || '<p>Pas de description pour le moment.</p>'}
      ${e.lien ? `<p><a class="btn btn-outline" href="${echapper(e.lien)}" target="_blank" rel="noopener nofollow ugc">Plus d'informations</a></p>` : ''}
    </div>
    <aside class="ev-cote">
      <div class="ev-fiche">
        <div><span class="ev-label">Quand</span>${echapper(quand)}</div>
        <div><span class="ev-label">Où</span>${echapper(e.lieu)}<br>${echapper(e.commune)}</div>
        ${aCarte ? `<div class="ev-carte" id="ev-carte" data-lat="${lat}" data-lng="${lng}" hidden></div>
        <button type="button" class="btn btn-outline" id="ev-voir-carte">Voir sur la carte</button>
        <a class="btn btn-outline" href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" rel="noopener">Itinéraire</a>` : ''}
        <a class="btn btn-primary" href="${echapper(lienGoogleAgenda(e))}" target="_blank" rel="noopener">Ajouter à mon agenda</a>
        <button type="button" class="btn btn-outline" id="ev-partager">Partager</button>
      </div>
      <p class="ev-note">Cet événement est proposé par son organisateur et publié sur l'agenda d'Ipsum Média, sans promesse de couverture par la rédaction.</p>
    </aside>
  </div></section>
  ${autres.length ? `<section class="journal suite"><div class="wrap"><div class="journal-tete"><h2>Autres événements ${echapper(ed.de)}</h2><a href="/agenda/${e.edition}">Tout l'agenda</a></div><div class="suite-grille">${autres.map(carte).join('')}</div></div></section>` : ''}
  ${aCarte ? '<script src="/assets/agenda-carte.js"></script>' : ''}
  <script>
  (function () {
    // La carte (Plan IGN) ne se charge qu'à la demande du visiteur : aucune requête vers ces services avant son clic
    var voir = document.getElementById('ev-voir-carte'), carte = document.getElementById('ev-carte');
    if (voir && carte) voir.addEventListener('click', function () {
      carte.hidden = false; voir.hidden = true;
      window.IpsumCarte.afficher(carte, Number(carte.getAttribute('data-lat')), Number(carte.getAttribute('data-lng'))).catch(function () { carte.hidden = true; voir.hidden = false; voir.textContent = 'Carte indisponible'; });
    });
    var b = document.getElementById('ev-partager'); if (!b) return;
    b.addEventListener('click', function () {
      var lien = location.href.split('#')[0];
      if (navigator.share) { navigator.share({ title: document.title, url: lien }).catch(function () {}); return; }
      if (navigator.clipboard) navigator.clipboard.writeText(lien).then(function () { b.textContent = 'Lien copié'; }).catch(function () {});
    });
  })();
  </script>`;

  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Event', '@id': url + '#evenement', name: e.titre, url, startDate: e.date_debut, ...(e.date_fin ? { endDate: e.date_fin } : {}),
        eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: { '@type': 'Place', name: e.lieu, address: { '@type': 'PostalAddress', addressLocality: e.commune, addressCountry: 'FR' }, ...(aCarte ? { geo: { '@type': 'GeoCoordinates', latitude: lat, longitude: lng } } : {}) },
        ...(e.description ? { description: String(e.description).slice(0, 500) } : {}), ...(photo ? { image: SITE + photo } : {}) },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: ed.titre, item: SITE + '/agenda/' + e.edition },
        { '@type': 'ListItem', position: 3, name: e.titre, item: url } ] },
    ],
  };
  const description = (String(e.description || '').replace(/\s+/g, ' ').trim() || `${CATEGORIES[e.categorie] || 'Événement'} à ${e.commune}`).slice(0, 150);
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
    body: enveloppe({ titre: `${e.titre} · ${e.commune}, ${new Date(e.date_debut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' })} | Agenda Ipsum Média`, description: `${quand} · ${e.lieu}. ${description}`, canonical: url, jsonld, main, image: photo ? SITE + photo : undefined }),
  };
};

function introuvable() {
  const main = `<section class="page-bandeau"><div class="wrap"><span class="page-bandeau-eyebrow">Agenda</span><h1>Événement introuvable</h1>
  <p class="page-bandeau-lead">Cet événement n'existe pas ou est déjà passé.</p>
  <p><a class="btn btn-primary" href="/agenda/tarn">Agenda du Tarn</a> <a class="btn btn-light" href="/agenda/haute-garonne">Agenda de la Haute-Garonne</a></p></div></section>`;
  return { statusCode: 404, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60' }, body: enveloppe({ titre: 'Événement introuvable | Ipsum Média', robots: 'noindex', main }) };
}
