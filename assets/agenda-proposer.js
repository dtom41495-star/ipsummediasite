// Formulaire « Proposer un événement » (/agenda/proposer) : envoie la proposition à la fonction agenda-public (Supabase).
// La photo est réduite et compressée ICI, dans le navigateur de l'organisateur (≈ 1 600 px de large, WebP, moins de 300 ko) :
// le stockage gratuit de Supabase n'est pas gaspillé et l'envoi reste léger.
(function () {
  var CFG = window.IPSUM_CONFIG || {};
  var form = document.getElementById('ag-form');
  if (!form) return;
  var PHOTO_MAX = 300 * 1024;      // octets
  var LARGEUR_MAX = 1600;          // pixels
  var statut = document.getElementById('ag-statut');
  var envoyer = document.getElementById('ag-envoyer');
  var champPhoto = document.getElementById('f-photo');
  var aide = document.getElementById('f-photo-aide');
  var apercu = document.getElementById('f-photo-apercu');
  var photo = null;                // { type, data (base64) }

  // L'agenda proposé par défaut : celui de la page d'où l'on vient (?edition=haute-garonne)
  var ed = new URLSearchParams(location.search).get('edition');
  if (ed === 'tarn' || ed === 'haute-garonne') document.getElementById('f-edition').value = ed;

  // Début possible : maintenant, jusqu'à 6 mois
  function champDate(d) { var p = function (n) { return String(n).padStart(2, '0'); }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()); }
  var maintenant = new Date(), limite = new Date(); limite.setMonth(limite.getMonth() + 6);
  document.getElementById('f-debut').min = champDate(maintenant); document.getElementById('f-debut').max = champDate(limite);

  // « 2026-12-04T19:30 » saisi en heure de Paris -> date UTC (ISO)
  function versIso(v) {
    if (!v) return null;
    var naive = new Date(v + ':00Z');
    var paris = new Date(naive.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    var utc = new Date(naive.toLocaleString('en-US', { timeZone: 'UTC' }));
    return new Date(naive.getTime() - (paris - utc)).toISOString();
  }

  function dire(texte, erreur) { statut.textContent = texte || ''; statut.className = 'ag-statut' + (erreur ? ' ag-erreur' : ''); }

  // Réduit la photo : largeur 1600 px au plus, WebP (JPEG si le navigateur ne sait pas), qualité abaissée jusqu'à passer sous 300 ko
  function compresser(fichier) {
    return new Promise(function (resolve, reject) {
      var img = new Image(), url = URL.createObjectURL(fichier);
      img.onload = function () {
        URL.revokeObjectURL(url);
        var k = Math.min(1, LARGEUR_MAX / img.width);
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        var essais = [0.82, 0.7, 0.58, 0.46, 0.36];
        var type = 'image/webp';
        function essai(i, echelle) {
          c.toBlob(function (blob) {
            if (!blob) { reject(new Error('photo')); return; }
            if (blob.type !== 'image/webp' && type === 'image/webp') { type = 'image/jpeg'; essai(0, echelle); return; }
            if (blob.size <= PHOTO_MAX || i >= essais.length - 1) {
              if (blob.size > PHOTO_MAX && echelle > 0.5) {   // encore trop lourde : on réduit aussi les dimensions
                c.width = Math.round(c.width * 0.75); c.height = Math.round(c.height * 0.75);
                c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); essai(0, echelle * 0.75); return;
              }
              if (blob.size > PHOTO_MAX) { reject(new Error('lourde')); return; }
              var lecteur = new FileReader();
              lecteur.onload = function () { resolve({ type: blob.type, data: String(lecteur.result).split(',')[1], taille: blob.size, apercu: lecteur.result }); };
              lecteur.readAsDataURL(blob);
              return;
            }
            essai(i + 1, echelle);
          }, type, essais[i]);
        }
        essai(0, 1);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('photo')); };
      img.src = url;
    });
  }

  champPhoto.addEventListener('change', function () {
    photo = null; apercu.hidden = true;
    var f = champPhoto.files && champPhoto.files[0];
    if (!f) { aide.textContent = 'Elle est réduite automatiquement avant l\'envoi.'; return; }
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { aide.textContent = 'Choisissez une image JPEG, PNG ou WebP.'; champPhoto.value = ''; return; }
    aide.textContent = 'Réduction de la photo…';
    compresser(f).then(function (p) {
      photo = p; apercu.src = p.apercu; apercu.hidden = false;
      aide.textContent = 'Photo prête (' + Math.round(p.taille / 1024) + ' ko).';
    }).catch(function () { aide.textContent = 'Cette photo n\'a pas pu être préparée : essayez-en une autre, ou envoyez sans photo.'; champPhoto.value = ''; });
  });

  var MESSAGES = {
    limite: 'Vous avez déjà envoyé plusieurs propositions récemment. Réessayez un peu plus tard.',
    date: 'La date de début doit être comprise entre maintenant et les six prochains mois.',
    email: 'Cette adresse email ne semble pas valide.',
    lien: 'Le lien doit commencer par https://',
    photo: 'La photo n\'a pas pu être envoyée. Essayez sans photo ou avec une autre image.',
    invalide: 'Vérifiez les champs obligatoires.',
  };

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    dire('');
    var v = function (id) { return document.getElementById(id).value.trim(); };
    var debut = versIso(v('f-debut')), fin = versIso(v('f-fin'));
    if (v('f-titre').length < 3 || v('f-lieu').length < 2 || v('f-commune').length < 2 || v('f-nom').length < 2 || !debut) { dire(MESSAGES.invalide, true); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v('f-email'))) { dire(MESSAGES.email, true); return; }
    if (fin && fin < debut) { dire('La fin ne peut pas être avant le début.', true); return; }
    if (v('f-lien') && !/^https?:\/\/\S+$/i.test(v('f-lien'))) { dire(MESSAGES.lien, true); return; }
    envoyer.disabled = true; dire('Envoi en cours…');
    var corps = {
      edition: v('f-edition'), categorie: v('f-categorie'), titre: v('f-titre'), debut: debut, fin: fin, lieu: v('f-lieu'), commune: v('f-commune'),
      description: document.getElementById('f-description').value, lien: v('f-lien'), nom: v('f-nom'), email: v('f-email'), site: v('f-site'),
    };
    if (photo) corps.photo = { type: photo.type, data: photo.data };
    fetch(CFG.SUPABASE_URL + '/functions/v1/agenda-public', {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.SUPABASE_CLE }, body: JSON.stringify(corps),
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (res.ok && res.d.ok) { form.hidden = true; document.getElementById('ag-merci').hidden = false; window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
        dire(MESSAGES[res.d.error] || 'L\'envoi n\'a pas abouti. Réessayez dans un instant.', true); envoyer.disabled = false;
      })
      .catch(function () { dire('Pas de connexion : réessayez dans un instant.', true); envoyer.disabled = false; });
  });
})();
