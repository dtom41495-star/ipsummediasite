// Agenda public : morceaux partagés par les pages /agenda/tarn, /agenda/haute-garonne et /evenement/<adresse>.
// Les événements viennent de la fonction site_agenda() (lib/compo.js). Rien n'y est échappé : tout passe par echapper().
const { SITE, echapper } = require('./page');

const EDITIONS = {
  'tarn': { nom: 'Tarn', titre: 'Agenda du Tarn', de: 'du Tarn' },
  'haute-garonne': { nom: 'Haute-Garonne', titre: 'Agenda de la Haute-Garonne', de: 'de la Haute-Garonne' },
};
const CATEGORIES = { concert: 'Concert', sport: 'Sport', culture: 'Culture', marche_fete: 'Marché et fête', reunion_publique: 'Réunion publique', autre: 'Autre' };

const TZ = 'Europe/Paris';
const jourCle = (iso) => new Date(iso).toLocaleDateString('fr-CA', { timeZone: TZ });   // « 2026-12-04 »
function jourLong(iso) {
  const t = new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });
  return t.charAt(0).toUpperCase() + t.slice(1);
}
function dateLongue(iso) {
  const t = new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ });
  return t.charAt(0).toUpperCase() + t.slice(1);
}
const heure = (iso) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).replace(':', 'h');
function horaire(e) {
  const fin = e.date_fin && jourCle(e.date_fin) === jourCle(e.date_debut) ? ' – ' + heure(e.date_fin) : '';
  return heure(e.date_debut) + fin;
}

// La photo est copiée sur le site à chaque génération (scripts/generer.js) : aucune visite ne sollicite la base de données.
const nomPhoto = (e) => (e.photo ? String(e.photo).split('/').pop() : '');
const urlPhoto = (e) => (e.photo ? '/agenda/photos/' + encodeURIComponent(nomPhoto(e)) : '');
const lienEvenement = (e) => '/evenement/' + encodeURIComponent(e.slug);

// Carte d'un événement (même dessin que les cartes d'articles : photo ou aplat de couleur, étiquette, titre)
function carte(e) {
  const photo = urlPhoto(e);
  return `<a class="une-card ag-carte" href="${lienEvenement(e)}" data-cat="${echapper(e.categorie)}" data-commune="${echapper(e.commune)}">` +
    (photo ? `<span class="une-img"><img src="${echapper(photo)}" alt="" decoding="async" loading="lazy"></span>` : '') +
    `<span class="kicker">${echapper(CATEGORIES[e.categorie] || 'Événement')} · ${echapper(e.commune)}</span>` +
    `<h3>${echapper(e.titre)}</h3>` +
    `<span class="une-meta">${echapper(horaire(e))} · ${echapper(e.lieu)}</span></a>`;
}

// Lien « Ajouter à mon agenda » (Google Agenda)
function lienGoogleAgenda(e) {
  const f = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const fin = e.date_fin || new Date(new Date(e.date_debut).getTime() + 2 * 3600000).toISOString();
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(e.titre) +
    '&dates=' + f(e.date_debut) + '/' + f(fin) + '&location=' + encodeURIComponent(e.lieu + ', ' + e.commune) +
    '&details=' + encodeURIComponent(SITE + lienEvenement(e));
}

module.exports = { EDITIONS, CATEGORIES, jourCle, jourLong, dateLongue, heure, horaire, nomPhoto, urlPhoto, lienEvenement, carte, lienGoogleAgenda };
