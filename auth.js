/* EDL — Authentification Microsoft   ·   auth 2.34.13 (01/10/2026)

   2.34.13 : une reconnexion déjà lancée fait échouer les appels suivants
   IMMÉDIATEMENT, sans solliciter Microsoft. Chacun tentait d'abord un
   renouvellement silencieux : une iframe de dix secondes vers une page que
   le navigateur est en train de quitter. La file de dépôt et l'écran en
   lançaient facilement huit, soit quatre-vingts secondes d'application
   figée juste après avoir annoncé « l'écran va se recharger ». Le silence
   est borné à vingt secondes : passé ce délai, la navigation a visiblement
   échoué et l'application retente d'elle-même, au lieu d'exiger qu'on la
   ferme et la rouvre en pleine visite.

   2.34.11 : délais du renouvellement silencieux portés à dix secondes, et
   expiration de l'iframe traitée comme une reconnexion nécessaire au lieu
   d'une erreur sans issue. Après le lancement de la reconnexion, obtenirJeton
   lève une erreur explicite au lieu de renvoyer null : « Jeton indisponible »
   n'apprenait rien à personne. Elle ne SUSPEND PAS l'appelant — la file de
   dépôt garderait son verrou posé et plus aucune photographie ne partirait.
   Un verrou empêche deux reconnexions simultanées.
   Bibliothèque MSAL copiée dans le dépôt, jamais chargée depuis un CDN.
   Une visite dure plus longtemps que la validité d'un jeton :
   le renouvellement silencieux est un cas normal, pas une exception. */

let _msal = null;
let _compte = null;
/* Horodatage de la dernière reconnexion lancée — null tant qu'il n'y en a
   pas eu. Il sert à deux choses : empêcher les appels concurrents (la file
   de dépôt, l'écran) d'en lancer chacun une, et éviter qu'ils sollicitent
   Microsoft pour rien pendant que la page s'en va. Il disparaît avec la
   page, puisque la reconnexion la recharge. */
let _reconnexionLancee = null;

/* Combien de temps on considère la navigation vers Microsoft « en cours ».
   Au-delà, elle a visiblement échoué, et on laisse l'application
   réessayer d'elle-même plutôt que d'exiger un redémarrage. */
const DELAI_RECONNEXION = 20000;

const MSG_RECONNEXION = "Reconnexion à Microsoft en cours — l'écran va se " +
  "recharger. Si rien ne se passe, ferme complètement l'application et rouvre-la.";

async function initAuth() {
  _msal = new msal.PublicClientApplication({
    auth: {
      clientId: CONFIG.microsoft.client_id,
      authority: CONFIG.microsoft.authority,
      redirectUri: CONFIG.microsoft.redirect_uri,
      navigateToLoginRequestUrl: false,
    },
    cache: {
      // Survit à la fermeture de l'application, contrairement à sessionStorage
      cacheLocation: "localStorage",
      storeAuthStateInCookie: false,
    },
    /* DÉLAIS DU RENOUVELLEMENT SILENCIEUX.
       MSAL renouvelle le jeton dans une iframe cachée et abandonne au bout
       de six secondes par défaut. Or l'URI de redirection est la page
       COMPLÈTE de l'application : l'iframe recharge les seize scripts et
       ouvre IndexedDB avant que MSAL puisse lire la réponse. Sur un iPhone
       en 5G, six secondes ne suffisent pas — c'est l'erreur « timed_out »
       rencontrée le 30/09/2026 chez Julien, en pleine visite.
       Dix secondes laissent le temps à la page de se charger. La solution
       de fond reste une page blanche dédiée comme URI de redirection des
       appels silencieux, qui demande une déclaration dans Entra. */
    system: {
      iframeHashTimeout: 10000,
      loadFrameTimeout: 10000,
      windowHashTimeout: 10000,
    },
  });

  await _msal.initialize();

  // Retour de redirection après connexion
  const resultat = await _msal.handleRedirectPromise();
  if (resultat && resultat.account) {
    _compte = resultat.account;
  } else {
    const comptes = _msal.getAllAccounts();
    if (comptes.length > 0) _compte = comptes[0];
  }

  if (_compte) _msal.setActiveAccount(_compte);
  return _compte;
}

function estConnecte() {
  return _compte !== null;
}

function nomUtilisateur() {
  if (!_compte) return null;
  return _compte.name || _compte.username || null;
}

async function seConnecter() {
  await _msal.loginRedirect({ scopes: CONFIG.microsoft.scopes });
}

async function seDeconnecter() {
  await _msal.logoutRedirect({ account: _compte });
}

/* Renvoie un jeton valide. Renouvelle silencieusement si nécessaire.
   Si le renouvellement silencieux échoue — jeton de rafraîchissement
   expiré, mot de passe changé — on redemande une connexion explicite
   plutôt que de laisser une visite se poursuivre sans pouvoir écrire. */
async function obtenirJeton() {
  if (!_compte) throw new Error("Non connecté");

  /* UNE RECONNEXION VIENT DE PARTIR : on échoue IMMÉDIATEMENT, sans
     solliciter Microsoft. Le verrou plus bas suffisait à n'ouvrir qu'une
     seule redirection, mais chaque appel suivant tentait d'abord un
     renouvellement silencieux — une iframe de dix secondes vers une page
     qui ne répondra jamais, puisque le navigateur est en train de quitter.
     La file de dépôt et l'écran en lancent facilement huit : quatre-vingts
     secondes d'application figée, juste après avoir annoncé « l'écran va
     se recharger ». Le banc 27 l'a mesuré ; le banc de preuve avait
     d'abord montré que l'assertion correspondante ne vérifiait rien.

     MAIS LE SILENCE EST LIMITÉ DANS LE TEMPS. Si la navigation a bien
     lieu, personne n'est là pour réessayer : la page a disparu. Si elle
     échoue — iOS la refuse parfois à une application installée sur
     l'écran d'accueil — un refus définitif obligerait Gérard à fermer et
     rouvrir en pleine visite. Passé le délai, on laisse donc une nouvelle
     tentative : l'application se répare seule au lieu d'attendre un
     geste. */
  if (_reconnexionLancee && Date.now() - _reconnexionLancee < DELAI_RECONNEXION) {
    throw new Error(MSG_RECONNEXION);
  }

  try {
    const r = await _msal.acquireTokenSilent({
      scopes: CONFIG.microsoft.scopes,
      account: _compte,
    });
    return r.accessToken;
  } catch (e) {
    await journaliser("jeton_silencieux_echoue", String(e && e.message));

    /* DEUX FAÇONS D'ÉCHOUER, UNE SEULE ISSUE : redemander la connexion.
       InteractionRequiredAuthError, c'est Microsoft qui réclame une action
       de l'utilisateur. « timed_out » (monitor_window_timeout), c'est
       l'iframe qui n'a pas répondu à temps. Ce second cas n'était pas
       traité : l'erreur remontait telle quelle et l'écran affichait
       « Liste indisponible — timed_out », sans autre issue que Retour.
       Une visite s'arrêtait là. Dans les deux cas, une reconnexion
       explicite règle le problème, alors on la déclenche. */
    const code = String((e && (e.errorCode || e.message)) || "");
    const iframeExpiree = /timed_out|monitor_window_timeout/.test(code);

    if (e instanceof msal.InteractionRequiredAuthError || iframeExpiree) {
      /* UNE SEULE RECONNEXION À LA FOIS.
         La file de dépôt tourne toutes les deux minutes en arrière-plan et
         appelle Graph, en même temps que l'écran. Sans ce verrou, chacun
         lancerait sa propre redirection. */
      /* Deux appels peuvent avoir franchi le contrôle d'entrée ensemble,
         avant que l'un des deux ne pose l'horodatage : on revérifie ici,
         juste avant de lancer la redirection. */
      if (_reconnexionLancee && Date.now() - _reconnexionLancee < DELAI_RECONNEXION) {
        throw new Error(MSG_RECONNEXION);
      }
      _reconnexionLancee = Date.now();
      await _msal.acquireTokenRedirect({ scopes: CONFIG.microsoft.scopes });

      /* ON REND LA MAIN, EN ÉCHOUANT.
         Tentation première : suspendre l'appelant le temps que le navigateur
         quitte la page. C'est faux, et dangereux. La file de dépôt
         (photos.js) pose un verrou « _fileEnCours » qu'elle ne relâche que
         dans son finally : une promesse jamais résolue laisse ce verrou posé
         pour toujours, et plus AUCUNE photographie ne part, sans un mot.
         On lève donc une erreur claire. L'appelant la traite comme
         n'importe quel échec — la file se débloque, l'écran affiche le
         message — et la navigation vers Microsoft se poursuit par-dessus. */
      throw new Error(MSG_RECONNEXION);
    }
    throw e;
  }
}
