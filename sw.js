/* EDL — Copie locale de l'application   ·   sw 2.34.17 (01/10/2026)

   2.34.17 : version alignée. Aucun changement de comportement.

   2.34.16 : version alignée. Aucun changement de comportement.

   2.34.15 : la page du pont n'est plus jamais interceptée. Microsoft
   demande qu'une page de pont soit servie sans mise en cache ; surtout, la
   règle de repli servait index.html — l'application entière — à l'iframe
   de renouvellement hors réseau, c'est-à-dire exactement ce que blank.html
   existe pour éviter. La bibliothèque du pont, elle, reste en copie
   locale : c'est un fichier statique.

   2.34.14 : le pont de redirection entre dans la copie locale, mais PAS
   la page blank.html : Microsoft demande qu'une page de pont soit servie
   sans mise en cache. Elle n'est donc jamais interceptée — ce qui la
   soustrait aussi à la règle de repli, qui servirait sinon l'application
   entière à l'iframe de renouvellement.

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

const VERSION = "2.34.17";  // sw 2.34.17 (01/10/2026) — pont jamais intercepté
const CACHE = "edl-" + VERSION;

const FICHIERS = [
  "./",
  "./index.html",
  /* LE PONT DE REDIRECTION — la bibliothèque seulement.
     blank.html, elle, N'EST PAS gardée en copie : Microsoft demande qu'une
     page de pont soit servie sans mise en cache (Cache-Control: no-store).
     On ne maîtrise pas les en-têtes de GitHub Pages, mais on maîtrise ce
     fichier-ci : la règle plus bas la laisse passer sans jamais
     l'intercepter. Deux raisons de s'y tenir — ne pas servir un pont
     périmé après une mise à jour de MSAL, et ne rien garder d'un échange
     d'authentification. */
  "./msal-redirect-bridge.min.js",
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

  /* LA PAGE DU PONT N'EST JAMAIS INTERCEPTÉE.
     Deux raisons, et la seconde est la plus grave. D'abord Microsoft
     demande qu'elle soit servie sans mise en cache. Ensuite, et surtout :
     la règle de repli tout en bas renvoie index.html pour toute navigation
     hors réseau non gardée. Sans ce retour anticipé, une iframe de
     renouvellement sans réseau recevrait L'APPLICATION ENTIÈRE — seize
     scripts, IndexedDB, MSAL — c'est-à-dire exactement ce que blank.html
     existe pour éviter. Hors réseau le renouvellement ne peut de toute
     façon pas aboutir : qu'il échoue franchement. */
  if (url.pathname.endsWith("/blank.html")) return;

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
