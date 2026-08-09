// Récupère le flux RSS public de Substack côté serveur (pas de CORS depuis le
// navigateur) et le transforme en JSON simple pour le site.

exports.handler = async function () {
  try {
    const res = await fetch('https://ipsummedia.substack.com/feed');
    if (!res.ok) throw new Error('Flux Substack inaccessible (' + res.status + ')');
    const xml = await res.text();

    const items = [];
    const blocks = xml.split('<item>').slice(1);

    for (const block of blocks.slice(0, 6)) {
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

      items.push({ title, link, pubDate, description, image, author });
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=900',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ items }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: String(e) }),
    };
  }
};

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
