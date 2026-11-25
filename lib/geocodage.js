// Corroboration de la ville d'un événement : l'adresse choisie dans le formulaire (suggestions de l'IGN) donne des coordonnées, la carte de la page les
// utilise ; la ville affichée et regroupée (pages /agenda/<édition>/<ville>) doit être celle de ces coordonnées, pas un texte tapé à la main.
// À la génération du site, chaque point est confronté au service de géocodage inverse de l'IGN (data.geopf.fr) ; le résultat est gardé dans un fichier
// d'une génération à l'autre, donc un point n'est interrogé qu'une fois. Sans réponse du service, on garde la ville saisie : jamais de blocage.
const fs = require('fs');
const path = require('path');

const FICHIER = path.join(process.env.IPSUM_CACHE_DIR || path.join(__dirname, '..', '.cache'), 'communes-ign.json');
const URL_IGN = 'https://data.geopf.fr/geocodage/reverse';
const MAX_NOUVEAUX = 80;   // interrogations nouvelles par génération (les suivantes attendent la prochaine)
let memoire = null, aEcrire = false;

function charger() {
  if (memoire) return memoire;
  try { memoire = JSON.parse(fs.readFileSync(FICHIER, 'utf8')) || {}; } catch (e) { memoire = {}; }
  return memoire;
}
function sauver() {
  if (!aEcrire) return;
  try { fs.mkdirSync(path.dirname(FICHIER), { recursive: true }); fs.writeFileSync(FICHIER, JSON.stringify(memoire)); aEcrire = false; } catch (e) { /* le cache est facultatif */ }
}
const cle = (lat, lng) => Number(lat).toFixed(4) + ',' + Number(lng).toFixed(4);

async function interroger(lat, lng) {
  try {
    const r = await fetch(`${URL_IGN}?lon=${encodeURIComponent(lng)}&lat=${encodeURIComponent(lat)}&index=address&limit=1`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    const f = ((await r.json()).features || [])[0];
    const p = f && f.properties;
    return p && p.city ? { nom: String(p.city), cp: String(p.postcode || ''), code: String(p.citycode || '') } : { nom: '' };   // « {nom:'' } » : le point n'a pas d'adresse, on le retient pour ne pas redemander
  } catch (e) { return null; }
}

// Remplace la ville saisie par celle des coordonnées (quand elles existent et que le service répond). Renvoie le nombre de corrections.
async function corroborer(evenements) {
  const memo = charger();
  const aFaire = [];
  (evenements || []).forEach((e) => {
    if (!e || e.lat == null || e.lng == null || !Number.isFinite(Number(e.lat)) || !Number.isFinite(Number(e.lng))) return;
    const k = cle(e.lat, e.lng);
    if (!(k in memo) && !aFaire.includes(k)) aFaire.push(k);
  });
  for (let i = 0; i < Math.min(aFaire.length, MAX_NOUVEAUX); i += 5) {
    await Promise.all(aFaire.slice(i, i + 5).map(async (k) => {
      const [lat, lng] = k.split(',');
      const res = await interroger(lat, lng);
      if (res) { memo[k] = res; aEcrire = true; }
    }));
  }
  sauver();
  let corrections = 0;
  evenements.forEach((e) => {
    if (!e || e.lat == null || e.lng == null) return;
    const res = memo[cle(e.lat, e.lng)];
    e.commune_saisie = e.commune;
    if (res && res.nom && res.nom !== e.commune) { e.commune = res.nom; corrections++; }
  });
  return corrections;
}

module.exports = { corroborer, interroger };
