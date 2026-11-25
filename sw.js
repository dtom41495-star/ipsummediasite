// Service worker d'Ipsum Média : il sert seulement à rendre le site « installable » (le navigateur propose alors
// d'ajouter le site à l'écran d'accueil). Il ne garde RIEN en mémoire et ne touche à aucune requête : le site se comporte
// exactement comme avant, avec toujours la dernière version des pages.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => { /* aucune interception : le navigateur charge la page normalement */ });

// Alertes « nouvel article » (notifications web) : le serveur envoie un petit message chiffré, on l'affiche.
// Toujours aucune mise en cache : seulement l'affichage de la notification et l'ouverture de l'article au clic.
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = {}; }
  const titre = String(d.titre || 'Ipsum Média').slice(0, 140);
  const url = typeof d.url === 'string' && /^\/[^/\\]/.test(d.url) ? d.url : '/articles.html';
  const options = {
    body: String(d.corps || '').slice(0, 200),
    icon: '/assets/app/icon-192.png',
    badge: '/assets/app/icon-192.png',
    tag: String(d.tag || 'ipsum-article').slice(0, 80),
    lang: 'fr',
    data: { url },
  };
  if (typeof d.image === 'string' && /^https:\/\//.test(d.image)) options.image = d.image;
  event.waitUntil(self.registration.showNotification(titre, options));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const cible = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const fenetres = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const f of fenetres) {
      if (f.url === cible && 'focus' in f) return f.focus();
    }
    return self.clients.openWindow(cible);
  })());
});
