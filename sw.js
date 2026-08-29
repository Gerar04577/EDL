/* EDL — Copie locale de l'application

   Sans ce fichier, l'application ne s'ouvre pas hors réseau : l'iPhone va
   chercher index.html et les scripts sur GitHub à chaque lancement. Une
   visite interrompue — iOS ferme l'application pour récupérer de la
   mémoire, ce qui arrive avec deux cents photographies — ne pouvait alors
   pas être reprise depuis une cave.

   Les photographies et les visites, elles, n'ont jamais dépendu de ce
   fichier : elles sont dans la base locale du navigateur.

   ATTENTION — VERSION
   Ce numéro doit être incrémenté à CHAQUE dépôt sur GitHub, en même temps
   que CONFIG.version_app. Sans cela, l'iPhone continue de servir l'ancienne
   copie et les corrections ne sont jamais visibles. C'est le seul piège de
   ce mécanisme, et il est silencieux. */

const VERSION = "2.20.0";
const CACHE = "edl-" + VERSION;

const FICHIERS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./config.js",
  "./db.js",
  "./auth.js",
  "./graph.js",
  "./locataires.js",
  "./visite.js",
  "./releves.js",
  "./pdf.js",
  "./comparaison-edl.js",
  "./ia.js",
  "./finvisite.js",
  "./aide.js",
  "./comparaison.js",
  "./recalage.js",
  "./photos.js",
  "./app.js",
  "./jspdf.umd.min.js",
  "./msal-browser.min.js",
  "./icone-180.png",
  "./icone-512.png",
];

self.addEventListener("install", (e) => {
  /* addAll échoue en bloc si un seul fichier manque : on dépose un par un
     pour qu'un oubli dans la liste ne laisse pas l'application sans copie. */
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const f of FICHIERS) {
      try { await cache.add(new Request(f, { cache: "reload" })); }
      catch (_) { /* fichier absent : on continue */ }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const noms = await caches.keys();
    await Promise.all(noms.map(n => n === CACHE ? null : caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  /* Microsoft, Make : jamais interceptés. Ces échanges doivent échouer
     franchement hors réseau, pour que la file d'attente reprenne la main.
     Servir une réponse gardée en copie ferait croire à un dépôt réussi. */
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith((async () => {
    const enCopie = await caches.match(req, { ignoreSearch: true });
    if (enCopie) {
      /* Copie servie tout de suite, et rafraîchie en arrière-plan : au
         lancement suivant, la version la plus récente est déjà là. */
      e.waitUntil((async () => {
        try {
          const frais = await fetch(req);
          if (frais && frais.ok) (await caches.open(CACHE)).put(req, frais.clone());
        } catch (_) { /* hors réseau : la copie reste valable */ }
      })());
      return enCopie;
    }
    try {
      return await fetch(req);
    } catch (e) {
      /* Navigation hors réseau vers une adresse non gardée : on renvoie
         la page d'accueil plutôt qu'une erreur de navigateur. */
      if (req.mode === "navigate") {
        const accueil = await caches.match("./index.html");
        if (accueil) return accueil;
      }
      throw e;
    }
  })());
});
