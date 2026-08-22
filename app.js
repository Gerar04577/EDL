/* EDL — Orchestration de l'étape 2
   Objectif de cette étape : prouver la chaîne complète —
   connexion Microsoft, accès OneDrive, base locale, stockage persistant.
   Aucune visite n'est encore possible. */

function $(id) { return document.getElementById(id); }

function poser(id, texte, bon) {
  const e = $(id);
  if (!e) return;
  e.textContent = texte;
  e.className = "val" + (bon === true ? " ok" : bon === false ? " ko" : "");
}

async function diagnosticAppareil() {
  const installee = window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
  poser("d-installee", installee ? "oui" : "non", installee);

  poser("d-https", location.protocol === "https:" ? "oui" : "non",
        location.protocol === "https:");

  try {
    await ouvrirBase();
    poser("d-idb", "opérationnelle", true);
  } catch (e) {
    poser("d-idb", "erreur", false);
  }

  if (navigator.storage && navigator.storage.persist) {
    let ok = await navigator.storage.persisted();
    if (!ok) ok = await navigator.storage.persist();
    poser("d-persist", ok ? "oui" : "non", ok);
  } else {
    poser("d-persist", "non géré", false);
  }

  const esp = await espaceDisponible();
  if (esp && esp.quota) {
    const libre = Math.round((esp.quota - esp.utilise) / 1048576);
    poser("d-espace", libre + " Mo libres", libre > 200);
  } else {
    poser("d-espace", "inconnu", null);
  }

  poser("d-reseau", navigator.onLine ? "en ligne" : "hors ligne", navigator.onLine);
  poser("d-version", CONFIG.version_app, null);

  if (!installee) {
    $("avertissement").innerHTML =
      '<div class="avert"><strong>À installer sur l\'écran d\'accueil</strong>' +
      "Dans Safari : bouton Partager, puis « Sur l'écran d'accueil ». " +
      "Utilisée depuis un onglet, l'application perdrait ses photos en attente.</div>";
  }
}

function majEtatConnexion() {
  const connecte = estConnecte();
  poser("d-compte", connecte ? nomUtilisateur() : "non connecté", connecte);
  $("btn-connexion").style.display = connecte ? "none" : "block";
  $("btn-deconnexion").style.display = connecte ? "block" : "none";
  $("btn-test-onedrive").disabled = !connecte;
}

async function testerOneDrive() {
  const zone = $("resultat-onedrive");
  zone.innerHTML = '<p class="note">Lecture de OneDrive en cours…</p>';
  try {
    const profil = await lireProfil();
    const racine = await obtenirRefRacineImmobilier();
    const enfants = await enfantsDeRef(racine);
    const dossiers = enfants.filter(e => e.folder || e.remoteItem).map(e => e.name);

    const attendus = Object.values(CONFIG.dossier_onedrive_par_immeuble);
    const lignes = attendus.map(nom => {
      const present = dossiers.includes(nom);
      return `<div class="ligne"><span>${nom}</span>
              <span class="val ${present ? "ok" : "ko"}">${present ? "trouvé" : "absent"}</span></div>`;
    }).join("");

    const autres = dossiers.filter(d => !attendus.includes(d));

    zone.innerHTML =
      `<div class="ligne"><span>Compte</span><span class="val ok">${profil.displayName}</span></div>` +
      `<div class="ligne"><span>Dossier racine</span><span class="val ok">${CONFIG.onedrive.dossier_racine}</span></div>` +
      lignes +
      (autres.length ? `<p class="note">Autres dossiers présents : ${autres.join(", ")}</p>` : "");

    await journaliser("test_onedrive_ok", { immeubles_trouves: attendus.filter(n => dossiers.includes(n)).length });
  } catch (e) {
    zone.innerHTML = `<div class="avert"><strong>Échec</strong>${e.message}</div>`;
    await journaliser("test_onedrive_echec", String(e.message));
  }
}

async function demarrer() {
  await diagnosticAppareil();
  try {
    await initAuth();
  } catch (e) {
    $("avertissement").innerHTML =
      `<div class="avert"><strong>Authentification indisponible</strong>${e.message}</div>`;
  }
  majEtatConnexion();

  $("btn-connexion").onclick = () => seConnecter();
  $("btn-deconnexion").onclick = () => seDeconnecter();
  $("btn-test-onedrive").onclick = () => testerOneDrive();

  await journaliser("demarrage", { version: CONFIG.version_app });
}

window.addEventListener("online",  () => poser("d-reseau", "en ligne", true));
window.addEventListener("offline", () => poser("d-reseau", "hors ligne", false));
document.addEventListener("DOMContentLoaded", demarrer);
