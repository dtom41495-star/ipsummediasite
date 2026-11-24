// Page « À propos » : formulaire « Une info à nous signaler ? » (même fonction serveur que l'ancien formulaire de contact)
// et chiffre des bénévoles actifs, lu en direct dans Compo (fonction site_chiffres : seulement un nombre, aucun nom).
(function () {
  var CFG = window.IPSUM_CONFIG || {};
  var HEADERS = { apikey: CFG.SUPABASE_CLE, Authorization: 'Bearer ' + CFG.SUPABASE_CLE };
  function echapper(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  // Chiffre en direct : s'il ne répond pas, le bloc reste caché (aucun chiffre vide ni faux)
  var blocB = document.getElementById('stat-benevoles');
  if (blocB && CFG.SUPABASE_URL) {
    fetch(CFG.SUPABASE_URL + '/rest/v1/rpc/site_chiffres', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, HEADERS), body: '{}' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var n = d && Number(d.benevoles);
        if (n > 0) { document.getElementById('stat-benevoles-n').textContent = n; blocB.hidden = false; }
      })
      .catch(function () {});
  }

  var select = document.getElementById('cf-redaction');
  var form = document.getElementById('contact-form');
  if (!select || !form || !CFG.SUPABASE_URL) return;
  var status = document.getElementById('cf-status');
  var bouton = document.getElementById('cf-submit');
  var ouvertLe = Date.now();   // un humain met plus de quelques secondes : la fonction écarte les envois instantanés

  fetch(CFG.SUPABASE_URL + '/functions/v1/redactions-publiques', { headers: HEADERS })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var liste = (data && data.redactions) || [];
      if (!liste.length) { select.innerHTML = '<option value="" disabled selected>Aucune rédaction disponible</option>'; return; }
      liste.sort(function (a, b) { return a.nom === 'Tarn' ? -1 : b.nom === 'Tarn' ? 1 : a.nom.localeCompare(b.nom); });
      select.innerHTML = liste.map(function (r) { return '<option value="' + echapper(r.id) + '">' + echapper(r.nom) + '</option>'; }).join('');
    })
    .catch(function () { select.innerHTML = '<option value="" disabled selected>Indisponible pour le moment</option>'; });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    bouton.disabled = true;
    status.textContent = 'Envoi en cours...';
    status.className = 'form-status';
    fetch(CFG.SUPABASE_URL + '/functions/v1/contact-form', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, HEADERS),
      body: JSON.stringify({
        nom: document.getElementById('cf-nom').value,
        email: document.getElementById('cf-email').value,
        redaction_id: select.value,
        message: document.getElementById('cf-message').value,
        site: document.getElementById('cf-site').value,
        duree_ms: Date.now() - ouvertLe
      })
    })
      .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
      .then(function (res) {
        if (res.ok) {
          status.textContent = 'Message envoyé, merci ! Vous allez recevoir une confirmation par email.';
          status.className = 'form-status form-status-ok';
          form.reset();
        } else {
          var err = new Error((res.data && res.data.error) || 'Erreur inconnue');
          if (res.data && res.data.limite) err.limite = true;
          throw err;
        }
      })
      .catch(function (err) {
        status.textContent = (err && err.limite) ? err.message : 'Le formulaire est momentanément indisponible, écrivez-nous à contact@ipsummedia.fr.';
        status.className = 'form-status form-status-error';
      })
      .then(function () { bouton.disabled = false; });
  });
})();
