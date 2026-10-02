/* EDL — Authentification Microsoft   ·   auth 2.34.19 (01/10/2026)

   2.34.19 : version alignée. Aucun changement de comportement.

   2.34.18 : version alignée. Aucun changement de comportement.

   2.34.17 : consigner au journal ne peut plus casser le flux. journaliser
   écrit dans la base locale et peut échouer — base pleine, stockage refusé
   par iOS. Attendue telle quelle, son erreur REMPLAÇAIT l'erreur réelle :
   « timed_out » disparaissait, la reconnexion ne se déclenchait plus, et
   l'opérateur voyait une panne de journal au lieu d'une reconnexion. Or le
   cas où elle échoue est justement le cas dégradé où tout le reste doit
   continuer de fonctionner.

   2.34.16 : le texte d'une erreur est lu EN ENTIER, et non par son seul
   code. « e.errorCode || e.message » écartait le message dès qu'un code
   existait — or c'est le message qui porte AADSTS50011, la seule preuve
   qu'il s'agit bien de l'adresse du pont. Il ne restait que
   « invalid_request », que Microsoft renvoie pour quantité d'autres
   raisons : le premier accroc venu aurait écarté le pont pour toute la
   session, en silence, et la correction aurait été perdue sans que rien
   ne le signale. Le motif exige désormais une preuve.

   2.34.15 : version alignée. Aucun changement de comportement.

   2.34.14 : LE RENOUVELLEMENT SILENCIEUX PASSE PAR blank.html.
   MSAL v5 ne lit plus l'adresse de l'iframe : la page de redirection doit
   renvoyer la réponse par un canal BroadcastChannel, au moyen de
   broadcastResponseToMainFrame(). Notre adresse de redirection étant
   l'application elle-même, qui n'appelle jamais cette fonction, le
   renouvellement par iframe NE POUVAIT PAS aboutir — dix secondes
   d'attente, puis « timed_out ». L'écran sans issue de Julien venait de
   là, et non d'un réseau lent. La connexion interactive, elle, garde
   l'adresse actuelle : rien ne change à l'ouverture de session.
   Les options iframeHashTimeout, loadFrameTimeout et windowHashTimeout
   réglées en 2.34.11 portaient des noms de MSAL v2 : la v5 les ignorait,
   ce réglage n'a jamais rien fait. La bonne option est iframeBridgeTimeout.
   Si Entra ne connaît pas encore l'adresse du pont, l'application repasse
   d'elle-même à l'ancien comportement pour le reste de la session.

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

/* LE PONT DE REDIRECTION DU RENOUVELLEMENT SILENCIEUX.
   MSAL v5 ne lit plus l'adresse de l'iframe : la page de redirection doit
   RENVOYER la réponse par un canal BroadcastChannel, au moyen de
   broadcastResponseToMainFrame(). Tant que cette adresse était celle de
   l'application, personne n'appelait cette fonction, et le renouvellement
   par iframe ne pouvait PAS aboutir — dix secondes d'attente, puis
   « timed_out ». C'est l'écran sans issue de Julien.
   blank.html ne charge que le pont officiel de Microsoft, et l'appelle.
   Elle doit être déclarée à l'identique dans Entra. */
const PONT_SILENCIEUX = location.origin
  + location.pathname.replace(/[^/]*$/, "") + "blank.html";

/* Si Entra ne connaît pas encore l'adresse du pont, Microsoft la refuse.
   On le constate une fois, on repasse à l'ancien comportement pour le
   reste de la session, et la visite continue : la déclaration dans Entra
   peut ainsi se faire avant ou après le déploiement, sans que l'ordre
   n'ait de conséquence. */
let _pontRefuse = false;

/* TOUT LE TEXTE DE L'ERREUR, et pas seulement son code.
   Le code écrit « e.errorCode || e.message » : dès qu'un code existe, le
   message n'était JAMAIS regardé. Or c'est le message qui porte
   « AADSTS50011 », la seule preuve qu'il s'agit bien de l'adresse ; le
   code, lui, ne dit que « invalid_request ». On rassemble donc les quatre
   parties que MSAL remplit. */
const texteErreur = (e) => [
  e && e.errorCode, e && e.subError, e && e.errorMessage, e && e.message,
].filter(Boolean).map(String).join(" | ");

/* ET ON EXIGE UNE PREUVE QU'IL S'AGIT DE L'ADRESSE.
   « invalid_request » seul ne suffit pas : Microsoft le renvoie pour
   quantité de raisons. S'en contenter aurait écarté le pont
   DÉFINITIVEMENT et EN SILENCE au premier accroc venu, et nous aurions
   perdu la correction sans jamais le savoir. */
const ADRESSE_REFUSEE = /AADSTS50011|redirect[_ ]uri/i;

/* CONSIGNER NE DOIT JAMAIS CASSER LE FLUX.
   journaliser écrit dans la base locale, et peut échouer — base pleine,
   stockage refusé par iOS. Attendue telle quelle, son erreur REMPLACE
   l'erreur réelle : « timed_out » disparaît, la reconnexion qui suit ne se
   déclenche plus, et l'opérateur se retrouve devant une panne de journal
   au lieu d'une reconnexion. Or le cas où elle échoue est justement le cas
   dégradé où tout le reste doit continuer de fonctionner. */
const tracer = async (quoi, detail) => {
  try { await journaliser(quoi, detail); } catch (_) { /* sans importance */ }
};

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
    /* DÉLAI DU RENOUVELLEMENT SILENCIEUX.
       ATTENTION AU NOM DE L'OPTION. La 2.34.11 réglait iframeHashTimeout,
       loadFrameTimeout et windowHashTimeout : ce sont les noms de MSAL v2
       et v3. La v5 embarquée ici ne les connaît pas — ils n'apparaissent
       nulle part dans msal-browser.min.js — et les ignorait en silence.
       Le réglage livré ce jour-là n'a donc jamais rien changé.
       En v5, l'option s'appelle iframeBridgeTimeout, et vaut dix secondes
       par défaut. On la pose explicitement, pour que la valeur soit lisible
       ici et ne dépende pas d'une bibliothèque qui pourrait la changer. */
    system: {
      iframeBridgeTimeout: 10000,
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

/* Demande le jeton à MSAL, en faisant passer le renouvellement par iframe
   par le pont plutôt que par l'application entière. Si Microsoft refuse
   l'adresse — déclaration manquante dans Entra — on retente une seule fois
   sans elle, et on n'y revient plus de la session. */
async function renouvellementSilencieux() {
  const demande = { scopes: CONFIG.microsoft.scopes, account: _compte };
  if (!_pontRefuse) {
    try {
      const r = await _msal.acquireTokenSilent({ ...demande, redirectUri: PONT_SILENCIEUX });
      return r.accessToken;
    } catch (e) {
      const texte = texteErreur(e);
      if (!ADRESSE_REFUSEE.test(texte)) throw e;
      _pontRefuse = true;
      await tracer("pont_redirection_refuse", texte.slice(0, 200));
    }
  }
  const r = await _msal.acquireTokenSilent(demande);
  return r.accessToken;
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
    return await renouvellementSilencieux();
  } catch (e) {
    await tracer("jeton_silencieux_echoue", String((e && e.message) || e));

    /* DEUX FAÇONS D'ÉCHOUER, UNE SEULE ISSUE : redemander la connexion.
       InteractionRequiredAuthError, c'est Microsoft qui réclame une action
       de l'utilisateur. « timed_out » (monitor_window_timeout), c'est
       l'iframe qui n'a pas répondu à temps. Ce second cas n'était pas
       traité : l'erreur remontait telle quelle et l'écran affichait
       « Liste indisponible — timed_out », sans autre issue que Retour.
       Une visite s'arrêtait là. Dans les deux cas, une reconnexion
       explicite règle le problème, alors on la déclenche. */
    const code = texteErreur(e);
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
