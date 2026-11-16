// Journalistes présentés sur la page « À propos » (assets/equipe.js les affiche). Données : fonction SQL site_equipe de Compo,
// qui n'expose que prénom, nom, rédactions, « Président » et l'adresse e-mail de l'association, et seulement pour les membres
// qui n'ont pas décoché « Apparaître sur la page À propos du site » dans Compo.

const compo = require('../../lib/compo');
const { chargerItems } = require('../../lib/themes');
const { cle, indexEquipe, articlesDe } = require('../../lib/auteurs');
const { decoder } = require('../../lib/page');

exports.handler = async function () {
  const [lignes, items] = await Promise.all([compo.equipe(4000), chargerItems(6000)]);
  const index = indexEquipe(lignes);
  const equipe = (lignes || []).map((m) => {
    const membre = index.parCle.get(cle(`${m.prenom} ${m.nom}`)) || null;
    return {
      prenom: m.prenom,
      nom: m.nom,
      slug: membre ? membre.slug : null,
      nbArticles: membre ? articlesDe(membre, items, decoder).length : 0,
      redactions: (m.redactions || []).map(compo.libelleRedaction),
      fonction: m.fonction_publique || null,
      email: /^[a-z0-9._+-]+@ipsummedia\.fr$/i.test(m.email || '') ? m.email : null,   // seulement une adresse de l'association
    };
  });
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Quelques minutes de cache : quelqu'un qui se retire dans Compo disparaît vite
      'Cache-Control': lignes ? 'public, max-age=120' : 'public, max-age=20',
      'Netlify-CDN-Cache-Control': lignes ? 'public, max-age=120, stale-while-revalidate=300' : 'public, max-age=20',
    },
    body: JSON.stringify({ equipe: lignes ? equipe : [] }),
  };
};
