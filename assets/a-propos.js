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

  // Nos sujets : le fond change de couleur selon le panneau qui occupe l'écran (sur grand écran)
  var univers = document.querySelector('.ap2-univers');
  if (univers && 'IntersectionObserver' in window) {
    var obs = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (e) { if (e.isIntersecting) univers.setAttribute('data-actif', e.target.getAttribute('data-i')); });
    }, { rootMargin: '-45% 0px -45% 0px' });
    univers.querySelectorAll('.ap2-panneau').forEach(function (p) { obs.observe(p); });
  }

  // Vidéo muette : elle ne joue que lorsqu'elle est à l'écran, et pas du tout pour qui préfère moins d'animations (commandes visibles à la place)
  var video = document.getElementById('ap-reportage');
  if (video) {
    video.muted = true;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      video.controls = true;
    } else if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entrees) {
        entrees.forEach(function (e) { if (e.isIntersecting) { var p = video.play(); if (p && p.catch) p.catch(function () { video.controls = true; }); } else video.pause(); });
      }, { threshold: 0.4 }).observe(video);
    } else {
      video.controls = true;
    }
  }

  // Vidéos YouTube (bande-annonce, Club de la presse) : rien n'est chargé chez YouTube tant qu'on n'a pas cliqué (confidentialité et rapidité)
  document.querySelectorAll('button.ap-lite[data-video]').forEach(function (bouton) {
    var vignette = bouton.querySelector('img');
    if (vignette) vignette.addEventListener('error', function () { vignette.remove(); });   // sans vignette : fond sombre avec le bouton de lecture
    bouton.addEventListener('click', function () {
      var id = bouton.getAttribute('data-video');
      var cadre = document.createElement('iframe');
      cadre.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?autoplay=1&mute=1&rel=0&modestbranding=1&playsinline=1';
      cadre.title = bouton.getAttribute('aria-label') || 'Vidéo Ipsum Média';
      cadre.allow = 'autoplay; encrypted-media; picture-in-picture';
      cadre.allowFullscreen = true;
      cadre.className = bouton.getAttribute('data-format') === 'vertical' ? 'ap-short-cadre' : 'ap-trailer-cadre';
      bouton.parentNode.replaceChild(cadre, bouton);
    });
  });

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
