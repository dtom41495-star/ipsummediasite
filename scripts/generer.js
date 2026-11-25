// Générateur de pages statiques : sortie de Netlify (chantier « Indépendance », décision 11).
//
// Il fait tourner, en local, le MÊME code que les fonctions Netlify (netlify/functions/*.js, lib/*.js) et écrit leurs
// réponses dans un dossier (public/ par défaut) que GitHub Pages (ou n'importe quel serveur de fichiers) peut servir.
// Il ne modifie aucun fichier du site : tout est écrit dans le dossier de sortie.
//
// Usage : node scripts/generer.js [--sortie public] [--domaine ipsummedia.fr]
// Variables : COMPO_URL / COMPO_CLE_PUBLIQUE (comme pour lib/compo.js), SITE_DOMAINE (écrit un fichier CNAME).
//
// Limite connue : les en-têtes HTTP de netlify.toml (sécurité, cache de sw.js) ne peuvent pas être reproduits sur GitHub Pages.

const fs = require('fs');
const path = require('path');

const RACINE = path.resolve(__dirname, '..');
const arg = (nom, defaut) => { const i = process.argv.indexOf('--' + nom); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : defaut; };
const SORTIE = path.resolve(RACINE, arg('sortie', 'public'));
const DOMAINE = arg('domaine', process.env.SITE_DOMAINE || '');
const SITE = 'https://ipsummedia.fr';
const CONCURRENCE = 5;

// --- Fonctions Netlify servies en mémoire (évite que le code s'appelle lui-même à travers le réseau) ---
const FONCTIONS = {
  'substack-feed': require('../netlify/functions/substack-feed').handler,
  'youtube-feed': require('../netlify/functions/youtube-feed').handler,
  equipe: require('../netlify/functions/equipe').handler,
};
const fetchReel = global.fetch;
const cache = new Map();   // une même adresse n'est lue qu'une fois pendant la génération

function reponse(r) {
  return new Response(r.body, { status: r.statusCode, headers: r.headers || {} });
}

global.fetch = function (url, opts) {
  const u = String(url);
  const m = u.match(/\/\.netlify\/functions\/([a-z-]+)(?:\?(.*))?$/);
  const methode = ((opts && opts.method) || 'GET').toUpperCase();
  const cle = methode + ' ' + u + ' ' + ((opts && opts.body) || '');
  if (!cache.has(cle)) {
    cache.set(cle, (async () => {
      if (m && FONCTIONS[m[1]]) {
        const q = Object.fromEntries(new URLSearchParams(m[2] || ''));
        const r = await FONCTIONS[m[1]]({ path: '/.netlify/functions/' + m[1], httpMethod: 'GET', queryStringParameters: q, headers: {} });
        return { status: r.statusCode, headers: r.headers || {}, texte: r.body };
      }
      const res = await fetchReel(url, opts && { ...opts, signal: undefined });
      return { status: res.status, headers: Object.fromEntries(res.headers), texte: await res.text() };
    })());
  }
  return cache.get(cle).then((r) => new Response(r.texte, { status: r.status, headers: r.headers }));
};

// --- Écriture ---
const ecrites = [];
const problemes = [];
function ecrire(chemin, contenu) {
  const cible = path.join(SORTIE, chemin);
  fs.mkdirSync(path.dirname(cible), { recursive: true });
  fs.writeFileSync(cible, contenu);
  ecrites.push(chemin);
}

// Les pages générées parlent aux fonctions Netlify depuis le navigateur : on les remplace par des fichiers JSON
function reecrireAppels(texte) {
  return texte
    .replace(/\/\.netlify\/functions\/substack-feed\?tous=1/g, '/flux/substack-tous.json')
    .replace(/\/\.netlify\/functions\/substack-feed/g, '/flux/substack.json')
    .replace(/\/\.netlify\/functions\/youtube-feed/g, '/flux/youtube.json')
    .replace(/\/\.netlify\/functions\/equipe/g, '/flux/equipe.json');
}

async function page(chemin, handler, event) {
  try {
    const r = await handler({ httpMethod: 'GET', headers: {}, queryStringParameters: {}, ...event });
    if (r.statusCode === 200) return ecrire(chemin, reecrireAppels(r.body));
    if (r.statusCode === 302 && r.headers && r.headers.Location) {
      const l = r.headers.Location.replace(/"/g, '&quot;');
      return ecrire(chemin, `<!doctype html><meta charset="utf-8"><title>Redirection</title><link rel="canonical" href="${l}"><meta http-equiv="refresh" content="0;url=${l}"><a href="${l}">Lire l'article</a>`);
    }
    problemes.push(`${chemin} : réponse ${r.statusCode}, page ignorée`);
  } catch (e) {
    problemes.push(`${chemin} : ${e.message}`);
  }
}

async function enParallele(taches) {
  const file = taches.slice();
  await Promise.all(Array.from({ length: CONCURRENCE }, async () => { while (file.length) await file.shift()(); }));
}

function copierStatique() {
  const ignores = new Set(['.git', 'node_modules', 'netlify', 'netlify.toml', 'scripts', 'lib', 'public', 'sitemap.xml', 'package.json', 'package-lock.json', 'README.md']);
  const copier = (src, dst) => {
    for (const nom of fs.readdirSync(src)) {
      if (src === RACINE && (ignores.has(nom) || nom.startsWith('.'))) continue;
      const s = path.join(src, nom);
      const d = path.join(dst, nom);
      if (path.resolve(s) === SORTIE) continue;
      if (fs.statSync(s).isDirectory()) { fs.mkdirSync(d, { recursive: true }); copier(s, d); continue; }
      if (/\.(html|js)$/.test(nom)) fs.writeFileSync(d, reecrireAppels(fs.readFileSync(s, 'utf8')));
      else fs.copyFileSync(s, d);
      ecrites.push(path.relative(SORTIE, d));
    }
  };
  fs.mkdirSync(SORTIE, { recursive: true });
  copier(RACINE, SORTIE);
}

const slugDuLien = (l) => { const m = String(l || '').match(/\/(?:p|articles)\/([^/?#]+)/); return m ? m[1] : ''; };

async function main() {
  const t0 = Date.now();
  if (fs.existsSync(SORTIE)) fs.rmSync(SORTIE, { recursive: true });
  copierStatique();
  // La configuration des pages suit celle des fonctions (variables COMPO_URL / COMPO_CLE_PUBLIQUE si elles existent)
  const cfg = require('../lib/compo');
  ecrire('assets/config.js', `window.IPSUM_CONFIG = ${JSON.stringify({ SUPABASE_URL: cfg.COMPO_URL, SUPABASE_CLE: cfg.COMPO_CLE })};\n`);

  // Flux JSON lus par les scripts du navigateur
  const lire = async (nom, q) => {
    const r = await FONCTIONS[nom]({ httpMethod: 'GET', headers: {}, queryStringParameters: q || {} });
    return r;
  };
  const tous = await lire('substack-feed', { tous: '1' });
  const items = tous.statusCode === 200 ? (JSON.parse(tous.body).items || []) : [];
  // Garde-fou : sans la liste des articles, on ne publie surtout pas un site vide
  if (!items.length) { console.error('ERREUR : la liste des articles est vide ou injoignable, génération annulée.'); process.exit(1); }
  ecrire('flux/substack-tous.json', tous.body);
  for (const [fichier, nom, q] of [['substack.json', 'substack-feed'], ['youtube.json', 'youtube-feed'], ['equipe.json', 'equipe']]) {
    const r = await lire(nom, q);
    if (r.statusCode === 200) ecrire('flux/' + fichier, r.body); else problemes.push(`flux/${fichier} : réponse ${r.statusCode}`);
  }

  const compo = require('../lib/compo');
  const { regrouper } = require('../lib/themes');
  const publications = (await compo.listePublications(8000)) || [];
  const slugsArticles = new Set(publications.map((p) => p.slug).filter(Boolean));
  items.forEach((it) => { if (it.kind !== 'newsletter') { const s = slugDuLien(it.link); if (s) slugsArticles.add(s); } });
  const groupes = regrouper(items);
  const lignesEquipe = (await compo.equipe(6000)) || [];
  const { indexEquipe } = require('../lib/auteurs');
  const auteurs = [...indexEquipe(lignesEquipe).parSlug.keys()];

  const article = require('../netlify/functions/article').handler;
  const theme = require('../netlify/functions/theme').handler;
  const auteur = require('../netlify/functions/auteur').handler;
  const liste = require('../netlify/functions/articles-liste').handler;
  const sitemap = require('../netlify/functions/sitemap').handler;

  const taches = [];
  slugsArticles.forEach((s) => taches.push(() => page(`articles/${s}.html`, article, { path: '/.netlify/functions/article/' + s })));
  ['commune', 'rubrique'].forEach((type) => Object.keys(groupes[type + 's']).forEach((s) =>
    taches.push(() => page(`${type}/${s}.html`, theme, { path: `/.netlify/functions/theme/${type}/${s}` }))));
  auteurs.forEach((s) => taches.push(() => page(`auteurs/${s}.html`, auteur, { path: '/.netlify/functions/auteur/' + s })));
  taches.push(() => page('articles.html', liste, {}));

  // Agenda public : deux pages d'agenda, une page par événement à venir, la page du formulaire, et les photos copiées sur le site
  // (les visiteurs ne sollicitent jamais le stockage de Supabase). Si la base ne répond pas, on garde les pages d'agenda sans événements.
  const agendaEv = await compo.agenda(8000);
  if (!agendaEv) problemes.push('agenda : la base ne répond pas, pages d\'événements non générées');
  const agendaH = require('../netlify/functions/agenda').handler;
  const evenementH = require('../netlify/functions/evenement').handler;
  const proposerH = require('../netlify/functions/agenda-proposer').handler;
  ['tarn', 'haute-garonne'].forEach((e) => taches.push(() => page(`agenda/${e}.html`, agendaH, { path: '/agenda/' + e })));
  taches.push(() => page('agenda/proposer.html', proposerH, {}));
  (agendaEv || []).forEach((e) => {
    taches.push(() => page(`evenement/${e.slug}.html`, evenementH, { path: '/evenement/' + e.slug }));
    if (e.photo) taches.push(async () => {
      try {
        const r = await fetchReel(`${compo.COMPO_URL}/storage/v1/object/public/site-images/${e.photo.split('/').map(encodeURIComponent).join('/')}`);
        if (!r.ok) throw new Error('réponse ' + r.status);
        const nom = e.photo.split('/').pop();
        const cible = path.join(SORTIE, 'agenda', 'photos', nom);
        fs.mkdirSync(path.dirname(cible), { recursive: true });
        fs.writeFileSync(cible, Buffer.from(await r.arrayBuffer()));
        ecrites.push(path.join('agenda', 'photos', nom));
      } catch (err) { problemes.push(`photo de l'événement ${e.slug} : ${err.message}`); }
    });
  });
  await enParallele(taches);

  // Plan du site « actualités » pour Google Actualités (articles des 48 dernières heures)
  ecrire('sitemap-news.xml', require('../netlify/functions/sitemap').fabriquerSitemapActus(publications));

  const sm = await sitemap({});
  if (sm.statusCode === 200) ecrire('sitemap.xml', sm.body); else problemes.push('sitemap.xml : réponse ' + sm.statusCode);

  // Éditions : la même page d'accueil (le script filtre selon l'adresse), sans extension dans l'URL
  ['tarn', 'haute-garonne', 'national'].forEach((e) => ecrire(e + '.html', fs.readFileSync(path.join(SORTIE, 'index.html'), 'utf8')));
  ['membre', 'document'].forEach((p) => { /* membre.html et document.html sont déjà servis sans extension par GitHub Pages */ });

  ecrire('.nojekyll', '');
  if (DOMAINE) ecrire('CNAME', DOMAINE + '\n');

  console.log(`Terminé en ${Math.round((Date.now() - t0) / 1000)} s : ${ecrites.length} fichiers dans ${path.relative(process.cwd(), SORTIE) || '.'}`);
  console.log(`  articles : ${slugsArticles.size} · communes : ${Object.keys(groupes.communes).length} · rubriques : ${Object.keys(groupes.rubriques).length} · journalistes : ${auteurs.length} · événements : ${(agendaEv || []).length}`);
  if (problemes.length) { console.log(`${problemes.length} problème(s) :`); problemes.slice(0, 40).forEach((p) => console.log('  - ' + p)); }
  process.exit(0);
}

main().catch((e) => { console.error('ERREUR', e); process.exit(1); });
