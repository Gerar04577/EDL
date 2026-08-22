/* EDL — Authentification Microsoft
   Bibliothèque MSAL copiée dans le dépôt, jamais chargée depuis un CDN.
   Une visite dure plus longtemps que la validité d'un jeton :
   le renouvellement silencieux est un cas normal, pas une exception. */

let _msal = null;
let _compte = null;

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
  try {
    const r = await _msal.acquireTokenSilent({
      scopes: CONFIG.microsoft.scopes,
      account: _compte,
    });
    return r.accessToken;
  } catch (e) {
    await journaliser("jeton_silencieux_echoue", String(e && e.message));
    if (e instanceof msal.InteractionRequiredAuthError) {
      await _msal.acquireTokenRedirect({ scopes: CONFIG.microsoft.scopes });
      return null;
    }
    throw e;
  }
}
