// Alertes « nouvel article » : bouton « Recevoir les alertes » dans le pied de page, avec le choix des éditions.
// Rien n'est demandé tout seul : la permission du navigateur n'est demandée qu'au clic sur « Activer ».
(function () {
  'use strict';
  var C = window.IPSUM_CONFIG || {};
  var URL_FN = (C.SUPABASE_URL || '') + '/functions/v1/push-abonnement';
  var EDITIONS = [['tarn', 'Tarn'], ['haute-garonne', 'Haute-Garonne'], ['national', 'National']];
  var ua = navigator.userAgent || '';
  var ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var installe = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  var capable = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (!C.SUPABASE_URL) return;
  if (!capable && !ios) return;   // navigateur sans notifications : on n'affiche rien

  function appel(corps) {
    return fetch(URL_FN, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: C.SUPABASE_CLE, Authorization: 'Bearer ' + C.SUPABASE_CLE }, body: JSON.stringify(corps) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, d: d }; }); });
  }
  function cleEnOctets(t) {
    var s = t.replace(/-/g, '+').replace(/_/g, '/'); s += '='.repeat((4 - (s.length % 4)) % 4);
    var b = atob(s), o = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) o[i] = b.charCodeAt(i); return o;
  }
  function inscription() { return navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription().then(function (s) { return { reg: reg, sub: s }; }); }); }

  var modal, statut, btnPrincipal, btnStop, cases, etat = { sub: null };
  function construire() {
    if (modal) return;
    modal = document.createElement('div');
    modal.className = 'alertes-fond'; modal.hidden = true;
    modal.innerHTML = '<div class="alertes-boite" role="dialog" aria-modal="true" aria-labelledby="alertes-titre">' +
      '<button type="button" class="alertes-fermer" aria-label="Fermer">×</button>' +
      '<h2 id="alertes-titre">Les alertes d’Ipsum Média</h2>' +
      '<p class="alertes-intro">Recevez une notification quand un nouvel article paraît. Choisissez vos éditions :</p>' +
      '<div class="alertes-editions">' + EDITIONS.map(function (e) { return '<label><input type="checkbox" value="' + e[0] + '" checked> ' + e[1] + '</label>'; }).join('') + '</div>' +
      '<p class="alertes-statut" role="status" aria-live="polite"></p>' +
      '<div class="alertes-actions"><button type="button" class="alertes-principal">Activer les alertes</button><button type="button" class="alertes-stop" hidden>Désactiver</button></div>' +
      '<p class="alertes-note">Aucun compte, aucune adresse email. Pas de notification entre 22 h et 7 h. Vous pouvez arrêter à tout moment.</p></div>';
    document.body.appendChild(modal);
    statut = modal.querySelector('.alertes-statut'); btnPrincipal = modal.querySelector('.alertes-principal'); btnStop = modal.querySelector('.alertes-stop');
    cases = [].slice.call(modal.querySelectorAll('input[type=checkbox]'));
    modal.addEventListener('click', function (e) { if (e.target === modal || e.target.classList.contains('alertes-fermer')) fermer(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) fermer(); });
    btnPrincipal.addEventListener('click', activer);
    btnStop.addEventListener('click', desactiver);
  }
  function dire(t, erreur) { statut.textContent = t || ''; statut.classList.toggle('alertes-erreur', !!erreur); }
  function choisies() { return cases.filter(function (c) { return c.checked; }).map(function (c) { return c.value; }); }
  function fermer() { modal.hidden = true; document.documentElement.classList.remove('alertes-ouvert'); }

  function ouvrir() {
    construire();
    modal.hidden = false; document.documentElement.classList.add('alertes-ouvert');
    dire('');
    if (!capable) {   // iPhone / iPad : il faut d'abord installer le site sur l'écran d'accueil
      cases.forEach(function (c) { c.disabled = true; }); btnPrincipal.hidden = true; btnStop.hidden = true;
      dire('Sur iPhone et iPad, ajoutez d’abord le site à l’écran d’accueil (bouton Partager, puis « Sur l’écran d’accueil »), ouvrez-le depuis cette icône, puis revenez ici.');
      return;
    }
    if (Notification.permission === 'denied') {
      cases.forEach(function (c) { c.disabled = true; }); btnPrincipal.hidden = true; btnStop.hidden = true;
      dire('Les notifications sont bloquées pour ce site dans votre navigateur. Autorisez-les dans les réglages du site, puis revenez ici.', true);
      return;
    }
    cases.forEach(function (c) { c.disabled = false; }); btnPrincipal.hidden = false; btnPrincipal.disabled = false;
    inscription().then(function (x) {
      etat.sub = x.sub;
      if (!x.sub) { btnPrincipal.textContent = 'Activer les alertes'; btnStop.hidden = true; return; }
      btnPrincipal.textContent = 'Enregistrer mes choix'; btnStop.hidden = false;
      appel({ action: 'lire', endpoint: x.sub.endpoint }).then(function (r) {
        if (r.ok && r.d.editions) cases.forEach(function (c) { c.checked = r.d.editions.indexOf(c.value) >= 0; });
        else if (r.status === 404) { btnPrincipal.textContent = 'Activer les alertes'; btnStop.hidden = true; }
      });
    }).catch(function () {});
  }

  function activer() {
    var editions = choisies();
    if (!editions.length) { dire('Choisissez au moins une édition.', true); return; }
    btnPrincipal.disabled = true; dire('Un instant…');
    var permission = Notification.permission === 'granted' ? Promise.resolve('granted') : Notification.requestPermission();
    Promise.resolve(permission).then(function (p) {
      if (p !== 'granted') throw new Error(p === 'denied' ? 'Les notifications ont été refusées. Vous pouvez les autoriser dans les réglages du site.' : 'Autorisation non donnée.');
      return inscription();
    }).then(function (x) {
      if (x.sub) return x.sub;
      return appel({ action: 'cle' }).then(function (r) {
        if (!r.ok || !r.d.publique) throw new Error('Service momentanément indisponible. Réessayez plus tard.');
        return x.reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cleEnOctets(r.d.publique) });
      });
    }).then(function (sub) {
      var j = sub.toJSON();
      return appel({ action: 'abonner', abonnement: { endpoint: j.endpoint, keys: j.keys }, editions: editions }).then(function (r) {
        if (!r.ok) { if (sub) sub.unsubscribe().catch(function () {}); throw new Error(r.status === 429 ? 'Trop de demandes depuis votre connexion. Réessayez plus tard.' : 'Impossible d’enregistrer l’abonnement. Réessayez plus tard.'); }
        etat.sub = sub; btnPrincipal.textContent = 'Enregistrer mes choix'; btnStop.hidden = false;
        dire('C’est enregistré : vous recevrez les nouveaux articles de ' + editions.map(function (e) { return (EDITIONS.filter(function (x) { return x[0] === e; })[0] || [0, e])[1]; }).join(', ') + '.');
        majBoutons(true);
      });
    }).catch(function (e) { dire((e && e.message) || 'Une erreur est survenue.', true); }).then(function () { btnPrincipal.disabled = false; });
  }

  function desactiver() {
    btnStop.disabled = true; dire('Un instant…');
    inscription().then(function (x) {
      if (!x.sub) return;
      var ep = x.sub.endpoint;
      return x.sub.unsubscribe().then(function () { return appel({ action: 'desabonner', endpoint: ep }); });
    }).then(function () {
      etat.sub = null; btnStop.hidden = true; btnPrincipal.textContent = 'Activer les alertes'; dire('Les alertes sont désactivées.'); majBoutons(false);
    }).catch(function () { dire('Impossible de désactiver pour le moment.', true); }).then(function () { btnStop.disabled = false; });
  }

  var boutons = [];
  var cloches = [], invitations = [];
  function majBoutons(actif) {
    boutons.forEach(function (b) { b.textContent = actif ? 'Alertes activées' : 'Recevoir les alertes'; b.classList.toggle('alertes-actives', !!actif); });
    cloches.forEach(function (b) { b.classList.toggle('alertes-actives', !!actif); b.title = actif ? 'Alertes activées (modifier)' : 'Recevoir les alertes'; });
    if (actif) invitations.forEach(function (n) { n.hidden = true; });
  }
  function lireRappel() { try { return parseInt(localStorage.getItem('ipsum-alertes-plus-tard') || '0', 10); } catch (e) { return 0; } }
  function noterRappel() { try { localStorage.setItem('ipsum-alertes-plus-tard', String(Date.now())); } catch (e) {} }
  // Cloche dans l'en-tête : visible sur toutes les pages, sans prendre de place dans le menu
  function poserCloche() {
    var cta = document.querySelector('.header-cta');
    if (!cta || cta.querySelector('.alertes-cloche')) return;
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'alertes-cloche'; b.title = 'Recevoir les alertes'; b.setAttribute('aria-label', 'Recevoir les alertes de nouveaux articles');
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg><span class="alertes-point" aria-hidden="true"></span>';
    b.addEventListener('click', ouvrir);
    cta.insertBefore(b, cta.firstChild); cloches.push(b);
  }
  // Fin d'un article : le moment où le lecteur est convaincu. Une seule carte, discrète, qui disparaît 30 jours si on dit « Plus tard ».
  function poserInvitation() {
    var corps = document.querySelector('.article-body');
    if (!corps || document.querySelector('.alertes-invit')) return;
    if (Date.now() - lireRappel() < 30 * 86400000) return;
    var n = document.createElement('aside');
    n.className = 'alertes-invit'; n.hidden = true;
    n.innerHTML = '<div class="alertes-invit-texte"><strong>Ne ratez pas le prochain article.</strong><span>Une notification à chaque nouvel article de votre édition (Tarn, Haute-Garonne ou National). Sans compte, sans email.</span></div>' +
      '<div class="alertes-invit-actions"><button type="button" class="alertes-invit-ok">Choisir mes alertes</button><button type="button" class="alertes-invit-non">Plus tard</button></div>';
    n.querySelector('.alertes-invit-ok').addEventListener('click', ouvrir);
    n.querySelector('.alertes-invit-non').addEventListener('click', function () { noterRappel(); n.hidden = true; });
    corps.parentNode.insertBefore(n, corps.nextSibling); invitations.push(n);
    if (!capable) { n.hidden = false; return; }
    if (Notification.permission === 'denied') return;
    inscription().then(function (x) { if (!x.sub) n.hidden = false; }).catch(function () { n.hidden = false; });
  }
  function poser() {
    [].slice.call(document.querySelectorAll('.footer-social-group')).forEach(function (g) {
      if (g.querySelector('.alertes-btn')) return;
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'alertes-btn'; b.textContent = 'Recevoir les alertes';
      b.addEventListener('click', ouvrir);
      g.appendChild(b); boutons.push(b);
    });
    poserCloche(); poserInvitation();
    if (capable && Notification.permission === 'granted') inscription().then(function (x) { if (x.sub) majBoutons(true); }).catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', poser); else poser();
})();
