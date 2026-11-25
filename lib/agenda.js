// Agenda public : morceaux partagés par les pages /agenda/tarn, /agenda/haute-garonne et /evenement/<adresse>.
// Les événements viennent de la fonction site_agenda() (lib/compo.js). Rien n'y est échappé : tout passe par echapper().
const fs = require('fs');
const path = require('path');
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

// ---- Une page d'agenda par ville : /agenda/<édition>/<ville> ----
// L'adresse vient du nom de la commune saisi dans le formulaire (même règle que Compo : sans accents, tirets) ; « Albi » et « albi » donnent la même page.
// Nom de ville nettoyé : sans code postal, sans « (81) », sans « cedex », « St » / « Ste » écrits en entier (« Albi 81000 » = « Albi » ; « St Juéry » = « Saint-Juéry »)
const nomVille = (nom) => String(nom || '').replace(/\(.*?\)/g, ' ').replace(/\b\d{5}\b/g, ' ').replace(/\bcedex\s*\d*\b/gi, ' ')
  .replace(/\bSte\.?(?=[\s-])/gi, 'Sainte').replace(/\bSt\.?(?=[\s-])/gi, 'Saint').replace(/[,;]+/g, ' ').replace(/\s+/g, ' ').trim();
const slugVille = (nom) => nomVille(nom).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
const cheminVille = (edition, slug) => `/agenda/${edition}/${slug}`;
const soigne = (n) => (/[a-zà-ÿ]/.test(n) && /[A-ZÀ-Ý]/.test(n) ? 2 : 1);
// { slug → { slug, nom, edition, items:[événements à venir] } } pour une édition
function villes(evenements, edition) {
  const res = new Map();
  (evenements || []).filter((e) => e && e.edition === edition).forEach((e) => {
    const slug = slugVille(e.commune);
    if (!/^[a-z0-9-]{2,80}$/.test(slug)) return;
    let v = res.get(slug);
    if (!v) { v = { slug, nom: nomVille(e.commune), edition, items: [] }; res.set(slug, v); }
    else if (soigne(nomVille(e.commune)) > soigne(v.nom)) v.nom = nomVille(e.commune);   // on garde l'écriture « Albi » plutôt que « albi » ou « ALBI »
    v.items.push(e);
  });
  return res;
}
// Villes déjà vues avec des événements : leur page reste en ligne (sans référencement) entre deux événements, au lieu de disparaître.
// Mémoire gardée d'une génération à l'autre avec le même dossier que les dimensions d'images ; facultative.
const FICHIER_VILLES = path.join(process.env.IPSUM_CACHE_DIR || path.join(__dirname, '..', '.cache'), 'agenda-villes.json');
function villesConnues() { try { const j = JSON.parse(fs.readFileSync(FICHIER_VILLES, 'utf8')); return j && typeof j === 'object' ? j : {}; } catch (e) { return {}; } }
function retenirVilles(parEdition) {
  try {
    const m = villesConnues();
    Object.keys(parEdition).forEach((ed) => { m[ed] = m[ed] || {}; parEdition[ed].forEach((v) => { m[ed][v.slug] = v.nom; }); });
    fs.mkdirSync(path.dirname(FICHIER_VILLES), { recursive: true }); fs.writeFileSync(FICHIER_VILLES, JSON.stringify(m));
    return m;
  } catch (e) { return villesConnues(); }
}
// Le week-end à venir (ou en cours), en dates « AAAA-MM-JJ » à Paris
function weekend(maintenant) {
  const d = maintenant || new Date();
  const cle = (x) => x.toLocaleDateString('fr-CA', { timeZone: TZ });
  const jour = new Date(d.toLocaleString('en-US', { timeZone: TZ })).getDay();   // 0 dimanche … 6 samedi
  const versSam = jour === 0 ? -1 : 6 - jour;
  const sam = new Date(d.getTime() + versSam * 86400000), dim = new Date(d.getTime() + (versSam + 1) * 86400000);
  return [cle(jour === 0 ? d : sam), cle(dim)];
}

const PUB = `  <!-- Publicité : le cadre garde sa place (logo en gris) tant qu'il n'y a pas d'annonce ; assets/pub.js l'anime -->
  <aside class="pub-zone pub-haut pub-milieu" data-encart="partenaire" aria-label="Publicité">
    <div class="wrap">
      <span class="ad-slot-label">Publicité</span>
      <div class="pub-boite">
        <img class="pub-logo" src="/assets/logo.png" alt="">
        <ins class="adsbygoogle"
             style="display:block"
             data-ad-client="ca-pub-7695287329907050"
             data-ad-slot="4713288084"
             data-ad-format="horizontal"
             data-full-width-responsive="true"></ins>
      </div>
    </div>
  </aside>
  <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
  <script src="/assets/pub.js?v=20261501"></script>
`;

module.exports = { PUB, nomVille, slugVille, cheminVille, villes, villesConnues, retenirVilles, weekend, contexte: { communesActus: new Set() }, EDITIONS, CATEGORIES, jourCle, jourLong, dateLongue, heure, horaire, nomPhoto, urlPhoto, lienEvenement, carte, lienGoogleAgenda };
