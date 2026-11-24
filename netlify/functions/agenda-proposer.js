// Page du formulaire public « Proposer un événement » : /agenda/proposer (le script est dans assets/agenda-proposer.js).
const { SITE, echapper, enveloppe } = require('../../lib/page');
const { EDITIONS, CATEGORIES } = require('../../lib/agenda');

exports.handler = async function () {
  const options = (o) => Object.keys(o).map((k) => `<option value="${k}">${echapper(typeof o[k] === 'string' ? o[k] : o[k].nom)}</option>`).join('');
  const main = `
  <section class="page-bandeau">
    <div class="wrap">
      <nav class="theme-fil" aria-label="Fil d'Ariane"><a href="/index.html#accueil">Accueil</a> › <a href="/agenda/tarn">Agenda</a> › <span aria-current="page">Proposer un événement</span></nav>
      <span class="page-bandeau-eyebrow">Agenda</span>
      <h1>Proposer un événement</h1>
      <p class="page-bandeau-lead">C'est gratuit et sans compte. Notre équipe relit votre proposition, puis elle apparaît sur l'agenda d'Ipsum Média.</p>
    </div>
  </section>
  <section class="journal ag-formulaire"><div class="wrap">
    <form id="ag-form" class="ag-form" novalidate>
      <div class="ag-champs">
        <label class="ag-champ ag-large"><span class="ag-lib">Titre de l'événement <span class="ag-req">*</span></span><input id="f-titre" name="titre" maxlength="120" required placeholder="Ex. Concert de printemps de la chorale"></label>
        <label class="ag-champ"><span class="ag-lib">Agenda <span class="ag-req">*</span></span><select id="f-edition" name="edition" required>${options({ 'tarn': EDITIONS.tarn, 'haute-garonne': EDITIONS['haute-garonne'] })}</select></label>
        <label class="ag-champ"><span class="ag-lib">Catégorie <span class="ag-req">*</span></span><select id="f-categorie" name="categorie" required>${options(CATEGORIES)}</select></label>
        <label class="ag-champ"><span class="ag-lib">Début <span class="ag-req">*</span></span><input id="f-debut" name="debut" type="datetime-local" required></label>
        <label class="ag-champ"><span class="ag-lib">Fin <small>(facultatif)</small></span><input id="f-fin" name="fin" type="datetime-local"></label>
        <div class="ag-champ ag-large ag-lieu">
          <label for="f-lieu"><span class="ag-lib">Lieu <span class="ag-req">*</span></span></label>
          <div class="ag-lieu-boite">
            <input id="f-lieu" name="lieu" maxlength="160" required autocomplete="off" role="combobox" aria-expanded="false" aria-controls="f-lieu-liste" aria-autocomplete="list" placeholder="Tapez une adresse ou le nom du lieu (salle des fêtes, mairie…)">
            <ul id="f-lieu-liste" class="ag-suggestions" role="listbox" hidden></ul>
          </div>
          <p class="ag-aide" id="f-lieu-aide">Choisissez une suggestion pour situer le lieu sur une carte. Suggestions : cartes.gouv.fr (IGN).</p>
          <div id="f-carte" class="ag-carte-apercu" hidden></div>
        </div>
        <label class="ag-champ"><span class="ag-lib">Commune <span class="ag-req">*</span></span><input id="f-commune" name="commune" maxlength="80" required placeholder="Ex. Albi"></label>
        <label class="ag-champ ag-large"><span class="ag-lib">Description <small>(quelques lignes : programme, tarifs, public…)</small></span><textarea id="f-description" name="description" rows="6" maxlength="2000"></textarea></label>
        <label class="ag-champ ag-large"><span class="ag-lib">Lien pour en savoir plus <small>(facultatif)</small></span><input id="f-lien" name="lien" type="url" maxlength="300" placeholder="https://"></label>
        <div class="ag-champ ag-large">
          <label for="f-photo">Photo ou affiche <small>(facultatif)</small></label>
          <input id="f-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp">
          <p class="ag-aide" id="f-photo-aide">Elle est réduite automatiquement avant l'envoi.</p>
          <img id="f-photo-apercu" class="ag-apercu" alt="" hidden>
        </div>
        <label class="ag-champ"><span class="ag-lib">Votre nom <span class="ag-req">*</span></span><input id="f-nom" name="nom" maxlength="120" required autocomplete="name" placeholder="Nom de l'organisateur ou de la structure"></label>
        <label class="ag-champ"><span class="ag-lib">Votre adresse email <span class="ag-req">*</span></span><input id="f-email" name="email" type="email" maxlength="254" required autocomplete="email"></label>
        <label class="ag-piege" aria-hidden="true">Ne pas remplir<input id="f-site" name="site" tabindex="-1" autocomplete="off"></label>
      </div>
      <p class="ag-statut" id="ag-statut" role="status" aria-live="polite"></p>
      <button type="submit" class="btn btn-primary" id="ag-envoyer">Envoyer ma proposition</button>
      <p class="ag-mention">Votre adresse email ne sert qu'à vous répondre au sujet de cet événement, et n'est jamais affichée sur le site. Elle est supprimée trois mois après la date de l'événement. L'équipe peut vous recontacter, par exemple pour en parler dans un article, sans aucun engagement de sa part. <a href="/confidentialite.html">Politique de confidentialité</a>.</p>
    </form>
    <div class="ag-merci" id="ag-merci" hidden>
      <h2>Merci, c'est bien reçu !</h2>
      <p>Notre équipe relit votre proposition. Si elle est acceptée, l'événement apparaîtra sur l'agenda dans l'heure qui suit, et nous vous écrirons pour vous donner son lien.</p>
      <p><a class="btn btn-primary" href="/agenda/tarn">Agenda du Tarn</a> <a class="btn btn-outline" href="/agenda/haute-garonne">Agenda de la Haute-Garonne</a></p>
    </div>
  </div></section>
  <script src="/assets/agenda-carte.js"></script>
  <script src="/assets/agenda-proposer.js"></script>`;
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
    body: enveloppe({ titre: 'Proposer un événement à l\'agenda | Ipsum Média', description: 'Proposez gratuitement votre événement (concert, sport, culture, marché, réunion publique) dans l\'agenda d\'Ipsum Média, sans compte.', canonical: SITE + '/agenda/proposer', main }),
  };
};
