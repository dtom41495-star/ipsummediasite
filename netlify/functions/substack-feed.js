// Liste des articles publiés sur Substack (rédactions du Tarn et d'Haute-Garonne),
// utilisée par l'accueil et par la page "Nos actus".
//
// Source principale : l'API d'archive publique de Substack. Contrairement au flux RSS
// (20 articles au maximum, sans étiquettes), elle remonte plus loin dans le temps et
// donne les étiquettes posées sur chaque article : "Newsletter" pour les newsletters,
// le nom de la commune pour les articles locaux, la rubrique (Culture, Économie...).
// Si l'API ne répond pas, on retombe sur le flux RSS, comme avant (sans étiquettes).
//
//   sans paramètre : les 20 plus récents, pour l'accueil
//   ?tous=1        : jusqu'à 75 par rédaction, pour la page "Nos actus" (filtres par type et par commune)

const REDACTIONS = [
  { nom: 'Tarn', base: 'https://ipsummedia.substack.com' },
  { nom: 'Haute-Garonne', base: 'https://ipsummediahautegaronne.substack.com' },
];

const NB_RECENTS = 20;      // accueil : les 20 plus récents des deux rédactions
const NB_FLUX_RSS = 20;     // le flux RSS de Substack ne contient que les 20 derniers articles
const TAILLE_PAGE = 25;     // taille d'une page de l'API d'archive (plafonnée à 25 par Substack)
const PAGES_TOUS = 3;       // page "Nos actus" : 3 pages de 25, donc les 75 derniers de chaque rédaction
const DELAI_API_MS = 5000;  // une réponse trop lente ne doit pas bloquer la fonction (limite de 10 s)
const DELAI_RSS_MS = 3500;
const AGENT = 'Mozilla/5.0 (compatible; IpsumMediaSite/1.0; +https://ipsummedia.fr)';

// Étiquettes qui ne sont ni une commune ni une rubrique : la rédaction, le type de publication.
const ETIQUETTES_IGNOREES = ['newsletter', 'tarn', 'haute-garonne', 'hautegaronne', 'occitanie', 'flash'];

// Les rubriques (identifiant de l'étiquette -> libellé affiché). Toute autre étiquette
// est considérée comme une commune : si une rubrique s'affiche par erreur parmi les
// communes, il suffit de l'ajouter ici.
const RUBRIQUES = {
  'actu': 'Actu',
  'actualite': 'Actualité',
  'actualites': 'Actualités',
  'agenda': 'Agenda',
  'agriculture': 'Agriculture',
  'associations': 'Associations',
  'cinema': 'Cinéma',
  'culture': 'Culture',
  'defense': 'Défense',
  'ecologie': 'Écologie',
  'economie': 'Économie',
  'education': 'Éducation',
  'emploi': 'Emploi',
  'energie': 'Énergie',
  'environnement': 'Environnement',
  'faits-divers': 'Faits divers',
  'histoire': 'Histoire',
  'insolite': 'Insolite',
  'interview': 'Interview',
  'interviews': 'Interviews',
  'jeunesse': 'Jeunesse',
  'justice': 'Justice',
  'meteo': 'Météo',
  'mobilite': 'Mobilité',
  'musique': 'Musique',
  'patrimoine': 'Patrimoine',
  'politique': 'Politique',
  'portrait': 'Portrait',
  'portraits': 'Portraits',
  'reportage': 'Reportage',
  'reportages': 'Reportages',
  'sante': 'Santé',
  'securite': 'Sécurité',
  'societe': 'Société',
  'solidarite': 'Solidarité',
  'special': 'Spécial',
  'sport': 'Sport',
  'sports': 'Sports',
  'tourisme': 'Tourisme',
  'transports': 'Transports',
  'video': 'Vidéo',
  'videos': 'Vidéos',
};

exports.handler = async function (event) {
  const params = (event && event.queryStringParameters) || {};
  const tous = params.tous === '1';

  try {
    const resultats = await Promise.all(REDACTIONS.map((r) => chargerRedaction(r, tous)));
    let items = [].concat(...resultats.map((r) => r.items));
    items.sort(function (a, b) { return new Date(b.pubDate) - new Date(a.pubDate); });
    if (!tous) items = items.slice(0, NB_RECENTS);

    // Couverture générique : la même image sur plusieurs articles (le logo, pour les
    // newsletters). Le site s'en sert pour choisir un vrai article avec photo à la une.
    const compte = {};
    items.forEach(function (it) { const id = idImage(it.image); if (id) compte[id] = (compte[id] || 0) + 1; });
    items.forEach(function (it) { const id = idImage(it.image); it.coverGenerique = !!id && compte[id] > 1; });

    // Pour le suivi : d'où viennent les données de chaque rédaction ('api', 'rss' ou 'vide')
    const sources = {};
    REDACTIONS.forEach(function (r, i) { sources[r.nom] = resultats[i].source; });

    // Le bandeau "en direct" appelle cette fonction depuis toutes les pages : la réponse est donc gardée
    // 15 minutes dans le navigateur et 5 minutes dans le cache partagé de Netlify ("durable", puis la
    // version un peu périmée est servie pendant qu'une nouvelle est récupérée). Ni la fonction ni Substack
    // ne sont ainsi sollicités à chaque page vue. Une liste vide (panne) n'est presque pas gardée.
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': items.length ? 'public, max-age=900' : 'public, max-age=60',
      'Access-Control-Allow-Origin': '*',
    };
    if (items.length) headers['Netlify-CDN-Cache-Control'] = 'public, max-age=300, stale-while-revalidate=600, durable';

    return { statusCode: 200, headers, body: JSON.stringify({ items, sources }) };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: String(e) }),
    };
  }
};

// Une rédaction en panne ou vide (ex : Haute-Garonne qui débute) ne doit jamais faire
// planter l'ensemble : on renvoie juste une liste vide pour celle-là.
async function chargerRedaction(redac, tous) {
  const items = await chargerApi(redac, tous ? PAGES_TOUS : 1);
  if (items && items.length) return { source: 'api', items };

  const rss = await chargerRss(redac);
  return { source: rss.length ? 'rss' : 'vide', items: rss };
}

async function recuperer(url, delaiMs, accept) {
  const res = await fetch(url, {
    headers: { 'User-Agent': AGENT, 'Accept': accept },
    signal: AbortSignal.timeout(delaiMs),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res;
}

// ---------- API d'archive ----------

// Renvoie null si l'API ne répond pas (le flux RSS prend alors le relais)
async function chargerApi(redac, nbPages) {
  const decalages = [];
  for (let i = 0; i < nbPages; i++) decalages.push(i * TAILLE_PAGE);
  const pages = await Promise.all(decalages.map((d) => pageArchive(redac, d)));
  if (!pages[0]) return null;

  const vus = new Set();
  const posts = [];
  pages.forEach(function (page) {
    (page || []).forEach(function (p) {
      if (p && p.slug && !vus.has(p.slug)) { vus.add(p.slug); posts.push(p); }
    });
  });
  posts.sort(function (a, b) { return new Date(b.post_date) - new Date(a.post_date); });

  // Le rang est compté avant d'écarter les articles réservés aux abonnés payants,
  // pour rester aligné sur le contenu du flux RSS (voir surLeSite plus bas).
  return posts.map(function (p, rang) { return depuisApi(p, redac, rang); }).filter(Boolean);
}

async function pageArchive(redac, decalage) {
  try {
    const url = redac.base + '/api/v1/archive?sort=new&limit=' + TAILLE_PAGE + '&offset=' + decalage;
    const res = await recuperer(url, DELAI_API_MS, 'application/json');
    const data = await res.json();
    return Array.isArray(data) ? data : null;
  } catch (e) {
    return null;
  }
}

function depuisApi(p, redac, rang) {
  // Un article payant n'a pas de contenu complet à afficher sur le site
  if (p.audience === 'only_paid' || p.audience === 'founding') return null;
  // Le site place l'identifiant dans ses adresses : on n'accepte que des lettres, chiffres et tirets
  if (!/^[a-z0-9-]{1,200}$/i.test(String(p.slug))) return null;

  const titre = nettoyer(p.title);
  const description = couper(p.description || p.subtitle || p.truncated_body_text, 160);
  const etiquettes = lireEtiquettes(p.postTags);
  const couverture = adresseSure(p.cover_image);
  const auteur = (p.publishedBylines || [])
    .map(function (b) { return b && b.name ? nomAuteur(b.name) : ''; })
    .filter(Boolean)
    .join(', ');

  return {
    title: echapper(titre),
    link: redac.base + '/p/' + p.slug,
    pubDate: p.post_date,
    description: echapper(description),
    // image : pour les cartes ; imageLarge : pour le bandeau "à la une" pleine largeur
    image: redimensionnerImage(couverture, 720),
    imageLarge: redimensionnerImage(couverture, 1600),
    author: auteur ? echapper(auteur) : null,
    redaction: redac.nom,
    kind: etiquettes.newsletter || ressembleAUneNewsletter(titre, description) ? 'newsletter' : 'article',
    communes: etiquettes.communes,
    rubriques: etiquettes.rubriques,
    // Seuls les 20 derniers articles ont une page sur le site (lue dans le flux RSS) ;
    // les plus anciens renvoient vers Substack.
    surLeSite: rang < NB_FLUX_RSS,
  };
}

// Sépare les étiquettes d'un article en : newsletter oui/non, communes, rubriques
function lireEtiquettes(postTags) {
  const res = { newsletter: false, communes: [], rubriques: [] };
  (postTags || []).forEach(function (t) {
    if (!t || !t.name || t.hidden) return;
    const nom = nettoyer(t.name);
    const slug = /^[a-z0-9-]+$/.test(t.slug || '') ? t.slug : slugifier(nom);
    if (!slug) return;
    // On reconnaît aussi l'étiquette d'après son nom, au cas où l'identifiant serait inhabituel
    const cles = [slug, slugifier(nom)];
    if (cles.indexOf('newsletter') !== -1) { res.newsletter = true; return; }
    if (cles.some(function (c) { return ETIQUETTES_IGNOREES.indexOf(c) !== -1; })) return;
    const rubrique = cles.filter(function (c) { return Object.prototype.hasOwnProperty.call(RUBRIQUES, c); })[0];
    if (rubrique) res.rubriques.push({ nom: RUBRIQUES[rubrique], slug: rubrique });
    else res.communes.push({ nom: echapper(nomCommune(nom)), slug });
  });
  return res;
}

// Filet de sécurité pour les articles sans étiquette (flux RSS de secours, anciens
// articles) : les newsletters ont un titre "Les actus du ..." et un sous-titre du
// genre "L'actualité du Tarn du 17 septembre 26. #65".
function ressembleAUneNewsletter(titre, description) {
  return /\bles actus? du\b/i.test(titre) || /^L.actualité du .{3,40}#\d+\s*$/i.test(description);
}

// Les noms de commune saisis à la main : traits d'union pour Saint(e), petits mots en minuscules
//   "Saint Lieux Lès Lavaur" -> "Saint-Lieux-lès-Lavaur", "Lisle-Sur-Tarn" -> "Lisle-sur-Tarn"
function nomCommune(nom) {
  let n = nom;
  if (/^sainte?\s/i.test(n)) n = n.replace(/\s+/g, '-');
  return n.replace(/([-\s])(Sur|Sous|Lès|Lez|Les|La|Le|De|Du|Des|En|Et|Aux|Au)(?=[-\s])/g, function (m, sep, mot) {
    return sep + mot.toLowerCase();
  });
}

// ---------- Flux RSS (secours) ----------

async function chargerRss(redac) {
  try {
    const res = await recuperer(redac.base + '/feed', DELAI_RSS_MS, 'application/rss+xml, application/xml, text/xml');
    const xml = await res.text();
    const blocks = xml.split('<item>').slice(1);

    return blocks.map(function (block, rang) {
      const itemXml = block.split('</item>')[0];
      const title = extractTag(itemXml, 'title');
      const link = extractTag(itemXml, 'link');
      const pubDate = extractTag(itemXml, 'pubDate');
      const description = stripHtml(extractTag(itemXml, 'description')).slice(0, 160).trim();
      const author = extractTag(itemXml, 'dc:creator') || null;

      // Pour un épisode audio ou vidéo, l'enclosure est le fichier média et non une image
      const typeEnclosure = extractAttr(itemXml, 'enclosure', 'type') || '';
      let image = /^(audio|video)\//i.test(typeEnclosure) ? null : extractAttr(itemXml, 'enclosure', 'url');
      if (!image) {
        const contentEncoded = extractTag(itemXml, 'content:encoded');
        const imgMatch = (contentEncoded || '').match(/<img[^>]+src="([^"]+)"/);
        image = imgMatch ? imgMatch[1] : null;
      }

      return {
        title,
        link,
        pubDate,
        description,
        image: redimensionnerImage(image, 720),
        imageLarge: redimensionnerImage(image, 1600),
        author,
        redaction: redac.nom,
        kind: ressembleAUneNewsletter(decoderEntites(title), decoderEntites(description)) ? 'newsletter' : 'article',
        communes: [],
        rubriques: [],
        surLeSite: rang < NB_FLUX_RSS,
      };
    });
  } catch (e) {
    return [];
  }
}

// ---------- Images ----------

// Les couvertures sont souvent les photos d'origine, parfois de 40 à 70 millions de
// pixels (4 à 10 Mo pour une seule carte) : le navigateur peinait à les décoder et les
// cartes s'affichaient par morceaux en défilant. On demande au CDN de Substack une
// version à la bonne largeur.
function redimensionnerImage(url, largeur) {
  if (!url) return url;
  // Adresse déjà signée par le CDN : on insère la largeur après la signature $s_!...!
  if (url.indexOf('substackcdn.com/image/fetch/') !== -1) {
    return url.replace(/(\/image\/fetch\/\$s_![^,\/]+!),(?!w_)/, '$1,w_' + largeur + ',c_limit,');
  }
  // Fichier brut du stockage de Substack : on le fait passer par le CDN (sauf les SVG, déjà légers)
  if (/^https:\/\/substack-(post-media|video)\.s3\.amazonaws\.com\//i.test(url) && !/\.svg(\?|$)/i.test(url)) {
    return 'https://substackcdn.com/image/fetch/w_' + largeur + ',c_limit,f_auto,q_auto:good,fl_progressive:steep/' + encodeURIComponent(url);
  }
  return url;
}

// Le site insère ces adresses telles quelles dans la page : uniquement du https, sans
// guillemet, espace ni chevron (qui permettraient de sortir de l'attribut HTML).
function adresseSure(url) {
  return typeof url === 'string' && /^https:\/\/[^\s"'<>\\]+$/i.test(url) ? url : null;
}

// Identifiant (uuid) du fichier image dans l'adresse Substack, ou null
function idImage(url) {
  const m = String(url || '').match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
  return m ? m[0].toLowerCase() : null;
}

// ---------- Textes ----------

function nettoyer(t) {
  return String(t == null ? '' : t).replace(/\s+/g, ' ').trim();
}

// Coupe à la fin d'un mot et ajoute "…" si le texte est plus long que `max`
function couper(texte, max) {
  const t = nettoyer(texte);
  if (t.length <= max) return t;
  const coupe = t.slice(0, max);
  const espace = coupe.lastIndexOf(' ');
  return (espace > max * 0.6 ? coupe.slice(0, espace) : coupe).replace(/[\s,;:.!?-]+$/, '') + '…';
}

// Le site insère ces textes tels quels dans la page (innerHTML) : on les échappe ici,
// comme le fait le flux RSS avec ses entités.
function echapper(t) {
  return String(t == null ? '' : t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Substack donne parfois un pseudo ("Monia_Haddad") : on en fait un nom lisible.
function nomAuteur(brut) {
  return nettoyer(String(brut || '').replace(/_+/g, ' '));
}

function slugifier(t) {
  return String(t || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function decoderEntites(s) {
  const cp = function (n) { try { return String.fromCodePoint(n); } catch (e) { return ''; } };
  return String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, function (m, h) { return cp(parseInt(h, 16)); })
    .replace(/&#(\d+);/g, function (m, d) { return cp(parseInt(d, 10)); })
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function extractTag(xml, tag) {
  const re = new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>', 'i');
  const m = xml.match(re);
  if (!m) return '';
  let val = m[1].trim();
  const cdata = val.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
  if (cdata) val = cdata[1];
  return val.trim();
}

function extractAttr(xml, tag, attr) {
  const re = new RegExp('<' + tag + '[^>]*\\b' + attr + '="([^"]*)"', 'i');
  const m = xml.match(re);
  return m ? m[1] : null;
}

function stripHtml(html) {
  return (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
