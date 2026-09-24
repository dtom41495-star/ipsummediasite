// Section "En vidéo" de l'accueil : les dernières vidéos de la chaîne YouTube, depuis la fonction
// youtube-feed. Les textes reçus sont déjà échappés : on peut les insérer tels quels.
(function () {
  var section = document.getElementById('videos');
  if (!section) return;

  var grille = document.getElementById('videos-grille');

  var ICONE_LECTURE = '<svg class="video-play-icone" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11"/><path d="M10 8.3v7.4a.6.6 0 0 0 .9.5l6.2-3.7a.6.6 0 0 0 0-1l-6.2-3.7a.6.6 0 0 0-.9.5z" fill="var(--white)" stroke="none"/></svg>';

  function formatVues(n) {
    if (n == null) return '';
    if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.', ',') + ' k vues';
    return n + (n > 1 ? ' vues' : ' vue');
  }

  function carte(v) {
    return '<a class="video-card" href="' + v.link + '" target="_blank" rel="noopener">' +
      '<span class="video-thumb">' +
      '<img src="' + v.thumbnail + '" alt="" loading="lazy" decoding="async">' +
      (v.court ? '<span class="video-badge">Short</span>' : '') +
      '<img class="video-logo" src="assets/logo-white-recadre.png" alt="" loading="lazy">' +
      ICONE_LECTURE +
      '</span>' +
      '<span class="video-info">' +
      '<span class="video-titre">' + v.title + '</span>' +
      (v.views != null ? '<span class="video-meta">' + formatVues(v.views) + '</span>' : '') +
      '</span></a>';
  }

  fetch('/.netlify/functions/youtube-feed')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var videos = (data && data.videos) || [];
      if (!videos.length) return;
      grille.innerHTML = videos.map(carte).join('');
      section.hidden = false;
    })
    .catch(function () {});
})();
