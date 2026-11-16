// Service worker d'Ipsum Média : il sert seulement à rendre le site « installable » (le navigateur propose alors
// d'ajouter le site à l'écran d'accueil). Il ne garde RIEN en mémoire et ne touche à aucune requête : le site se comporte
// exactement comme avant, avec toujours la dernière version des pages.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => { /* aucune interception : le navigateur charge la page normalement */ });
