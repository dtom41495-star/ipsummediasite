// Page d'accueil (/) écrite côté serveur : la une, le fil, les rubriques et les communes sont déjà dans le HTML,
// pour que Google les voie sans exécuter JavaScript. Le script de la page (assets/accueil.js) prend ensuite le relais
// et refait exactement le même rendu (même module, assets/accueil-rendu.js) : cette fonction ne change que l'affichage de départ.
//
// Garde-fous : en cas de panne (flux, page statique), la page est renvoyée telle quelle (le navigateur la remplit) ;
// jamais d'erreur 5xx sur l'accueil.
const { chargerItems } = require('../../lib/themes.js');
const Rendu = require('../../assets/accueil-rendu.js');

const HOTES = /^(ipsummedia\.fr|www\.ipsummedia\.fr|[a-z0-9-]+(--[a-z0-9-]+)?\.netlify\.app)$/i;

function baseDepuis(event) {
  const h = (event.headers || {});
  const hote = String(h['x-forwarded-host'] || h.host || '').split(',')[0].trim().toLowerCase();
  return HOTES.test(hote) ? 'https://' + hote : 'https://ipsummedia.fr';
}

// Remplace ce qui est entre <!--ssr-nom--> et <!--/ssr-nom--> (fonction de remplacement : pas de motif « $ »)
function injecter(html, nom, contenu) {
  const re = new RegExp('(<!--ssr-' + nom + '-->)[\\s\\S]*?(<!--/ssr-' + nom + '-->)');
  return re.test(html) ? html.replace(re, (m, a, b) => a + contenu + b) : html;
}

// Retire l'attribut hidden de la balise ouvrante <section ... id="...">
function montrer(html, id) {
  return html.replace(new RegExp('(<section[^>]*\\bid="' + id + '"[^>]*?)\\s+hidden(?=[\\s>])'), '$1');
}

function composer(html, items) {
  const r = Rendu.construire(items);
  if (r.vide) return html;
  html = injecter(html, 'une', r.une);
  if (r.fil !== null) {
    html = injecter(html, 'fil', r.fil);
    html = html.replace('id="une-fil" aria-hidden="true"', 'id="une-fil"');
  } else {
    html = html.replace('<div class="une-grid">', '<div class="une-grid sans-cote">');
    html = html.replace('<aside class="une-cote" id="une-cote"', '<aside class="une-cote" id="une-cote" hidden');
  }
  if (r.rubriques !== null) { html = injecter(html, 'rubriques', r.rubriques); html = montrer(html, 'rubriques'); }
  if (r.villes) {
    html = injecter(html, 'villes-pastilles', r.villes.pastilles);
    html = injecter(html, 'villes', r.villes.grille);
    html = montrer(html, 'villes');
  }
  if (r.national) {
    html = injecter(html, 'national-pastilles', r.national.pastilles);
    html = injecter(html, 'national', r.national.grille);
    html = montrer(html, 'national');
  }
  return html;
}

exports.composer = composer;
exports.handler = async (event) => {
  const base = baseDepuis(event || {});
  let page;
  try {
    const res = await fetch(base + '/index.html', { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error('page ' + res.status);
    page = await res.text();
  } catch (e) {
    return { statusCode: 302, headers: { Location: '/index.html', 'Cache-Control': 'no-store' }, body: '' };
  }
  let html = page;
  try {
    const items = await chargerItems(5000, base);
    if (items.length) html = composer(page, items);
  } catch (e) {
    html = page;
  }
  html = html.replace(/\/index\.html#/g, '/#');
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Netlify-CDN-Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600',
    },
    body: html,
  };
};
