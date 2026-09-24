// Dernières vidéos de la chaîne YouTube d'Ipsum Média, pour la section "En vidéo" de l'accueil.
// Lit le flux Atom public de YouTube (aucune clé d'API nécessaire, comme la fonction substack-feed
// lit les flux RSS de Substack). Les bulletins météo et les rediffusions ne sont pas de vraies
// vidéos éditoriales : on les écarte, comme les bulletins météo sont déjà écartés des articles.

const CHANNEL_ID = 'UCfWONqeD2lpLz7y7j1CYapQ';
const FEED_URL = 'https://www.youtube.com/feeds/videos.xml?channel_id=' + CHANNEL_ID;
const NB_VIDEOS = 4;
const DELAI_MS = 6000;
const AGENT = 'Mozilla/5.0 (compatible; IpsumMediaSite/1.0; +https://ipsummedia.fr)';

const TITRES_IGNORES = /\bbulletin\b|diffusion en direct/i;

exports.handler = async function () {
  try {
    const res = await fetch(FEED_URL, {
      headers: { 'User-Agent': AGENT },
      signal: AbortSignal.timeout(DELAI_MS),
    });
    if (!res.ok) return reponse([]);
    const xml = await res.text();
    const videos = xml.split('<entry>').slice(1)
      .map(function (bloc) { return depuisEntree(bloc.split('</entry>')[0]); })
      .filter(function (v) { return v && !TITRES_IGNORES.test(v.title); })
      .slice(0, NB_VIDEOS);
    return reponse(videos);
  } catch (e) {
    return reponse([]);
  }
};

function reponse(videos) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    // Une nouvelle vidéo est rare (contrairement aux articles) : pas besoin de la fraîcheur de
    // substack-feed (2 minutes), 20 minutes suffisent largement.
    'Cache-Control': videos.length ? 'public, max-age=1200' : 'public, max-age=60',
  };
  if (videos.length) headers['Netlify-CDN-Cache-Control'] = 'public, max-age=1200, stale-while-revalidate=600, durable';
  return { statusCode: 200, headers, body: JSON.stringify({ videos: videos }) };
}

function depuisEntree(bloc) {
  const titre = decoderEntites(extractTag(bloc, 'title'));
  const id = extractTag(bloc, 'yt:videoId');
  const lien = extractAttr(bloc, 'link', 'href');
  if (!id || !titre || !lien) return null;
  const vues = extractAttr(bloc, 'media:statistics', 'views');
  const vignette = extractAttr(bloc, 'media:thumbnail', 'url');
  return {
    id: id,
    title: echapper(titre),
    link: lien,
    court: /\/shorts\//.test(lien),
    thumbnail: vignette || ('https://i.ytimg.com/vi/' + id + '/hqdefault.jpg'),
    views: vues ? parseInt(vues, 10) : null,
  };
}

function extractTag(xml, tag) {
  const re = new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>', 'i');
  const m = xml.match(re);
  return m ? m[1].trim() : '';
}

function extractAttr(xml, tag, attr) {
  const re = new RegExp('<' + tag + '[^>]*\\b' + attr + '="([^"]*)"', 'i');
  const m = xml.match(re);
  return m ? m[1] : null;
}

function echapper(t) {
  return String(t == null ? '' : t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
