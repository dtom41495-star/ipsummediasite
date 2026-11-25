// Dimensions des photos des articles (attributs width et height des <img>) : évitent que la page « saute » au chargement et sont
// attendues par Google pour les images d'un article. Les photos viennent du stockage de Supabase ; on n'en lit que les premiers octets
// (en-tête du fichier) et le résultat est gardé dans un fichier (.cache/dimensions-images.json, conservé d'une génération à l'autre par le
// workflow) : une photo n'est donc lue qu'une seule fois, ce qui ne pèse pas sur la bande passante gratuite de Supabase.
const fs = require('fs');
const path = require('path');
const CONFIG = require('../assets/config.js');
const COMPO_URL = process.env.COMPO_URL || CONFIG.SUPABASE_URL;
const FICHIER = path.join(process.env.IPSUM_CACHE_DIR || path.join(__dirname, '..', '.cache'), 'dimensions-images.json');

let memoire = null;
function charger() {
  if (memoire) return memoire;
  try { memoire = JSON.parse(fs.readFileSync(FICHIER, 'utf8')); } catch (e) { memoire = {}; }
  return memoire;
}
let aEcrire = false;
function enregistrer() {
  if (!aEcrire) return;
  try { fs.mkdirSync(path.dirname(FICHIER), { recursive: true }); fs.writeFileSync(FICHIER, JSON.stringify(memoire)); aEcrire = false; } catch (e) { /* le cache est facultatif */ }
}

// Largeur et hauteur d'après les premiers octets : WebP, PNG, JPEG, GIF
function lireTaille(o) {
  const b = Buffer.from(o);
  if (b.length > 30 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') {
    const t = b.toString('latin1', 12, 16);
    if (t === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
    if (t === 'VP8L') { const v = b.readUInt32LE(21); return { w: 1 + (v & 0x3fff), h: 1 + ((v >> 14) & 0x3fff) }; }
    if (t === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    return null;
  }
  if (b.length > 24 && b.toString('latin1', 1, 4) === 'PNG') return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b.length > 10 && b.toString('latin1', 0, 3) === 'GIF') return { w: b.readUInt16LE(6), h: b.readUInt16LE(8) };
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}

const echecs = new Set();   // cette génération seulement : on ne réessaie pas une photo illisible à chaque page
async function dimensions(url) {
  if (!COMPO_URL || !String(url).startsWith(COMPO_URL + '/storage/')) return null;   // seulement nos propres photos
  const c = charger();
  if (c[url]) return c[url];
  if (echecs.has(url)) return null;
  try {
    const res = await fetch(url, { headers: { Range: 'bytes=0-65535' }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error('réponse ' + res.status);
    const t = lireTaille(new Uint8Array(await res.arrayBuffer()));
    if (!t || !(t.w > 0 && t.h > 0)) throw new Error('format inconnu');
    c[url] = t; aEcrire = true; enregistrer();
    return t;
  } catch (e) { echecs.add(url); return null; }
}

// Ajoute width et height aux <img> du texte qui n'en ont pas (photos du stockage seulement)
async function avecDimensions(html) {
  const balises = [...String(html || '').matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]).filter((t) => !/\swidth=/i.test(t));
  const remplacements = new Map();
  for (const tag of new Set(balises)) {
    const src = /\ssrc="([^"]+)"/i.exec(tag);
    if (!src) continue;
    const url = src[1].replace(/&amp;/g, '&');
    const d = await dimensions(url);
    if (d) remplacements.set(tag, tag.replace(/^<img\b/i, `<img width="${d.w}" height="${d.h}"`));
  }
  let out = String(html || '');
  remplacements.forEach((neuf, ancien) => { out = out.split(ancien).join(neuf); });
  return out;
}

module.exports = { dimensions, avecDimensions, lireTaille };
