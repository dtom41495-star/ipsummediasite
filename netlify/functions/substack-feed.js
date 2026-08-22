// Récupère les flux RSS publics Substack (Tarn + Haute-Garonne) côté serveur
// (pas de CORS depuis le navigateur), les fusionne triés par date, et les
// transforme en JSON simple pour le site.

const FLUX = [
  { url: 'https://ipsummedia.substack.com/feed', redaction: 'Tarn' },
  { url: 'https://ipsummediahautegaronne.substack.com/feed', redaction: 'Haute-Garonne' },
];

exports.handler = async function () {
  try {
    const resultats = await Promise.all(FLUX.map(fetchFlux));
    const items = [].concat(...resultats);
    items.sort(function (a, b) { return new Date(b.pubDate) - new Date(a.pubDate); });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=900',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ items: items.slice(0, 20) }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: String(e) }),
    };
  }
};

// Un flux en panne ou vide (ex : Haute-Garonne qui débute) ne doit jamais
// faire planter l'ensemble — on renvoie juste une liste vide pour celui-là.
async function fetchFlux(flux) {
  try {
    const res = await fetch(flux.url);
    if (!res.ok) return [];
    const xml = await res.text();
    const blocks = xml.split('<item>').slice(1);

    return blocks.map(function (block) {
      const itemXml = block.split('</item>')[0];
      const title = extractTag(itemXml, 'title');
      const link = extractTag(itemXml, 'link');
      const pubDate = extractTag(itemXml, 'pubDate');
      const description = stripHtml(extractTag(itemXml, 'description')).slice(0, 160).trim();
      const author = extractTag(itemXml, 'dc:creator') || null;

      let image = extractAttr(itemXml, 'enclosure', 'url');
      if (!image) {
        const contentEncoded = extractTag(itemXml, 'content:encoded');
        const imgMatch = (contentEncoded || '').match(/<img[^>]+src="([^"]+)"/);
        image = imgMatch ? imgMatch[1] : null;
      }

      return { title, link, pubDate, description, image, author, redaction: flux.redaction };
    });
  } catch (e) {
    return [];
  }
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
