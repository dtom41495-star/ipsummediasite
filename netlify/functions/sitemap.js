// Plan du site (sitemap.xml) fabriqué à chaque demande : les pages fixes, plus les articles dont le site est
// l'original (publiés depuis Compo). Les copies d'anciens articles Substack n'y figurent pas : leur balise canonical
// désigne Substack, et un plan du site ne doit lister que des adresses canoniques.
// Si la base ne répond pas, le plan contient au moins les pages fixes (comme l'ancien sitemap.xml).

const compo = require('../../lib/compo');

const SITE = 'https://ipsummedia.fr';
const PAGES_FIXES = [
  ['/', 'weekly', '1.0'],
  ['/a-propos.html', 'monthly', '0.9'],
  ['/nos-valeurs.html', 'monthly', '0.8'],
  ['/charte-ia.html', 'monthly', '0.6'],
  ['/articles.html', 'daily', '0.9'],
  ['/nous-rejoindre.html', 'monthly', '0.8'],
];

function isoJour(d) {
  const t = new Date(d);
  return isNaN(t.getTime()) ? '' : t.toISOString().slice(0, 10);
}

function fabriquerSitemap(publications) {
  const urls = PAGES_FIXES.map(([chemin, freq, prio]) =>
    `  <url>\n    <loc>${SITE}${chemin}</loc>\n    <changefreq>${freq}</changefreq>\n    <priority>${prio}</priority>\n  </url>`);
  (publications || [])
    .filter((p) => p && /^[a-z0-9-]{1,200}$/.test(p.slug || '') && !p.canonical_url)
    .forEach((p) => {
      const jour = isoJour(p.maj_le || p.publie_le);
      urls.push(`  <url>\n    <loc>${SITE}/articles/${p.slug}</loc>\n${jour ? `    <lastmod>${jour}</lastmod>\n` : ''}  </url>`);
    });
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join('\n') + '\n</urlset>\n';
}

async function sitemap() {
  const publications = await compo.listePublications(5000);
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': publications ? 'public, max-age=3600' : 'public, max-age=300',
    },
    body: fabriquerSitemap(publications),
  };
}

exports.handler = sitemap;
exports.fabriquerSitemap = fabriquerSitemap;
