/* EDL — Écrans
   Étape 3 : démarrage d'une visite. La capture arrive à l'étape suivante. */

var E = {
  installee: false,
  connecte: false,
  liste: null,
  brouillon: {},     // visite en cours de préparation
  ecran: "accueil",
};

function $(id) { return document.getElementById(id); }
/* Les aperçus occupent de la mémoire jusqu'à leur libération. On libère
   ceux de l'écran précédent à CHAQUE changement d'écran, et non au seul
   retour : iOS ferme une application qui consomme trop, en pleine visite. */
var _apercusAffiches = [];
var _apercusEnCours = [];

function noterApercu(url) { if (url) _apercusEnCours.push(url); return url; }

function libererApercus() {
  _apercusAffiches.forEach(u => { try { URL.revokeObjectURL(u); } catch (_) {} });
  _apercusAffiches = _apercusEnCours;
  _apercusEnCours = [];
}

/* Le redessin remplace tout le contenu, et le navigateur revient alors en
   haut de page. Sur l'écran d'une pièce, coché une photo faisait remonter
   l'écran : le doigt restait au même endroit, mais la photo qui s'y
   trouvait n'était plus la même, et on cochait la mauvaise.

   On conserve donc la position quand le MÊME écran se redessine. Un
   changement d'écran, lui, doit bien repartir du haut. */
var _ecranAffiche = null;

function vue(html, memeEcran) {
  /* La clé inclut la pièce : passer du séjour à la cuisine reste l'écran
     « piece », mais c'est un contenu neuf, qui doit repartir du haut. */
  const cle = String(E.ecran) + "|" + String(E.piece || "");
  const identique = memeEcran === true ||
    (memeEcran !== false && _ecranAffiche === cle);
  const boite = $("vue");
  const y = identique ? (window.scrollY || document.documentElement.scrollTop || 0) : 0;

  /* FIGER LA HAUTEUR PENDANT L'ÉCHANGE.

     Remplacer le contenu vide la page un instant. Sa hauteur retombe
     presque à zéro, et Safari ramène aussitôt le défilement à la seule
     position possible : le haut. Replacer ensuite ne suffit pas — la
     consigne est écrêtée à son tour tant que la page n'a pas repris sa
     hauteur.

     On impose donc l'ancienne hauteur au conteneur avant l'échange, et on
     ne la libère qu'une fois le nouveau contenu en place. Safari n'a alors
     jamais l'occasion de rabattre la position.

     Symptôme corrigé : cocher la troisième photographie d'une pièce
     faisait remonter l'écran, et le doigt cochait la première. */
  const hauteur = identique && boite ? boite.offsetHeight : 0;
  if (hauteur > 0) boite.style.minHeight = hauteur + "px";

  libererApercus();
  boite.innerHTML = html;
  _ecranAffiche = cle;

  if (y > 0) {
    window.scrollTo(0, y);
    /* Deux cycles d'affichage : le premier laisse Safari calculer la
       nouvelle hauteur, le second replace pour de bon. Un seul cycle se
       révélait trop tôt sur iPhone. */
    requestAnimationFrame(() => {
      window.scrollTo(0, y);
      requestAnimationFrame(() => {
        window.scrollTo(0, y);
        if (hauteur > 0) boite.style.minHeight = "";
      });
    });
  } else {
    if (hauteur > 0) boite.style.minHeight = "";
    if (!identique) window.scrollTo(0, 0);
  }
}
function titre(t, s) { $("titre").textContent = t; $("sous-titre").textContent = s || ""; }
function avert(html) { $("avertissement").innerHTML = html; }
function echapper(s) { return String(s == null ? "" : s).replace(/[<>&"]/g, c =>
  ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c])); }

function boutonsChoix(items) {
  return items.map(i =>
    `<button class="choix" data-val="${echapper(i.valeur)}">${echapper(i.libelle)}` +
    (i.droite ? `<span class="droite">${echapper(i.droite)}</span>` : "") + `</button>`
  ).join("");
}

function surChoix(fn) {
  $("vue").querySelectorAll("button.choix").forEach(b => {
    b.onclick = () => fn(b.getAttribute("data-val"));
  });
}

// --- Écran d'accueil -----------------------------------------------------

async function ecranAccueil() {
  E.ecran = "accueil";
  titre("EDL — État des Lieux", E.connecte ? nomUtilisateur() : "Non connecté");

  const ouvertes = await visitesEnCours();
  const terminees = await visitesTerminees();
  const attente = await nombreEnAttente();

  let html = "";

  if (ouvertes.length) {
    html += `<div class="bloc"><h2>${ouvertes.length} visite${
      ouvertes.length > 1 ? "s" : ""} en cours</h2>` +
      ouvertes.map((v, i) => `<div class="comp comp-alerte">
        <div class="ligne"><span>${echapper(v.bien.unite_source)}</span>
          <span class="val">${v.type}</span></div>
        <p class="note">commencée le ${new Date(v.date_debut).toLocaleString("fr-BE")} ·
          ${v.photos.length} photo${v.photos.length > 1 ? "s" : ""} ·
          ${v.pieces.reduce((n, p) => n + p.constatations.length, 0)} constatation(s)</p>
        <button class="mini" data-reprendre="${i}">Reprendre</button>
        <button class="mini secondaire" data-abandonner="${i}">Abandonner</button>
      </div>`).join("") + `</div>`;
  }

  html += `<div class="bloc"><h2>Nouvelle visite</h2>`;
  if (!E.connecte) {
    html += `<p class="note">Connexion à OneDrive nécessaire.</p>
             <button id="btn-connexion">Se connecter à OneDrive</button>`;
  } else if (!E.installee) {
    html += `<p class="note">Application non installée sur l'écran d'accueil.</p>
             <button disabled>Démarrer une visite</button>`;
  } else {
    html += `<button id="btn-nouvelle">Démarrer une visite</button>`;
  }
  html += `</div>`;

  if (terminees.length) {
    html += `<div class="bloc"><h2>${terminees.length} visite${
      terminees.length > 1 ? "s terminées" : " terminée"}</h2>` +
      terminees.slice(0, 8).map((v, i) => `<div class="comp">
        <div class="ligne"><span>${echapper(v.bien.unite_source)} — ${v.type}</span>
        <span class="val gris">${new Date(v.date_debut).toLocaleDateString("fr-BE")}</span></div>
        ${v.version_doc && v.version_doc !== "V1"
          ? `<p class="note gris">Version ${echapper(v.version_doc)}</p>` : ""}
        ${v.statut === "signee" && finVisiteDisponible()
          ? `<button class="mini secondaire" data-renvoi="${i}">${
              (v.preuve && v.preuve.courriel_envoye) ? "Renvoyer" : "Rapport et courriel"}</button>`
          : ""}
        ${v.statut === "signee"
          ? `<button class="mini secondaire" data-rectifier="${i}">Rectifier</button>` : ""}
      </div>`).join("") +
      `<button class="mini secondaire" id="btn-purge">Effacer les visites terminées</button></div>`;
  }

  html += `<div class="bloc"><h2>État</h2>
    <div class="ligne"><span>Compte</span><span class="val ${E.connecte ? "ok" : "ko"}">${
      E.connecte ? echapper(nomUtilisateur()) : "non connecté"}</span></div>
    <div class="ligne"><span>Installée sur l'écran d'accueil</span><span class="val ${
      E.installee ? "ok" : "ko"}">${E.installee ? "oui" : "non"}</span></div>
    <div class="ligne"><span>Photos en attente d'envoi</span><span class="val ${
      attente ? "ko" : "ok"}">${attente}</span></div>
    </div>`;

  html += await blocEnvoi();

  html += `<button class="aide" id="btn-aide">Mode d'emploi</button>`;

  if (E.connecte) {
    html += `<button class="secondaire" id="btn-ia">Description par IA${
      iaDisponible() ? "" : " — non configurée"}</button>`;
    html += `<button class="secondaire" id="btn-reglage-fin">Rapport et courriel${
      finVisiteDisponible() ? "" : " — non configuré"}</button>`;
    html += `<button class="secondaire" id="btn-comparer">Comparer avec OneDrive</button>`;
    html += `<button class="secondaire" id="btn-deconnexion">Se déconnecter</button>`;
  }

  const rappel = rappelGmail();
  if (rappel) avert(rappel); 

  vue(html);
  $("pied").textContent = "Version " + CONFIG.version_app;

  if ($("btn-aide")) $("btn-aide").onclick = () => ecranAide();
  brancherEnvoi(() => ecranAccueil());
  if ($("btn-connexion")) $("btn-connexion").onclick = () => seConnecter();
  if ($("btn-deconnexion")) $("btn-deconnexion").onclick = () => seDeconnecter();
  if ($("btn-comparer")) $("btn-comparer").onclick = () => ecranComparaison();
  if ($("btn-ia")) $("btn-ia").onclick = () => ecranIA();
  if ($("btn-reglage-fin")) $("btn-reglage-fin").onclick = () => ecranReglageFin();
  if ($("btn-nouvelle")) $("btn-nouvelle").onclick = () => ecranType();

  $("vue").querySelectorAll("[data-reprendre]").forEach(b => b.onclick = () =>
    ecranVisiteReprise(ouvertes[parseInt(b.getAttribute("data-reprendre"), 10)]));

  $("vue").querySelectorAll("[data-abandonner]").forEach(b => b.onclick = () =>
    ecranAbandon(ouvertes[parseInt(b.getAttribute("data-abandonner"), 10)]));

  $("vue").querySelectorAll("[data-renvoi]").forEach(b => b.onclick = () => {
    const v = terminees[parseInt(b.getAttribute("data-renvoi"), 10)];
    VISITE = v;
    E.finRapport = undefined; E.finCourriel = undefined; E.finMessage = "";
    ecranFinVisite(v);
  });

  $("vue").querySelectorAll("[data-rectifier]").forEach(b => b.onclick = () =>
    ecranRectification(terminees[parseInt(b.getAttribute("data-rectifier"), 10)]));

  if ($("btn-purge")) $("btn-purge").onclick = async () => {
    const b = $("btn-purge");
    b.disabled = true; b.textContent = "Effacement…";
    try {
      for (const v of terminees) await supprimerVisite(v.visit_id);
    } catch (e) {
      await journaliser("purge_echouee", String(e && e.message));
    }
    await ecranAccueil();
  };
}

/* La connexion Gmail de Make expire : sans réautorisation, l'envoi du
   procès-verbal au locataire s'arrête sans prévenir. On alerte chaque
   jour à partir de huit jours avant. */
function rappelGmail() {
  const m = CONFIG.make || {};
  if (!m.gmail_reautoriser_le) return null;
  const echeance = new Date(m.gmail_reautoriser_le + "T12:00:00");
  if (isNaN(echeance.getTime())) return null;
  /* Compté en jours de calendrier, pas en heures : sinon le décompte
     changeait selon l'heure à laquelle on ouvrait l'application. */
  const minuit = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const jours = Math.round((minuit(echeance) - minuit(new Date())) / 86400000);
  const seuil = m.gmail_alerte_jours || 8;
  if (jours > seuil) return null;

  if (jours < 0) {
    return `<div class="erreur"><strong>Connexion Gmail expirée</strong>
      Depuis le ${echeance.toLocaleDateString("fr-BE")}. L'envoi du procès-verbal
      au locataire ne fonctionne plus. Réautorise la connexion dans Make,
      puis mets à jour la date dans config.js.</div>`;
  }
  return `<div class="avert"><strong>Connexion Gmail à réautoriser${
    jours === 0 ? " AUJOURD'HUI" : " dans " + jours + " jour" + (jours > 1 ? "s" : "")}</strong>
    Échéance le ${echeance.toLocaleDateString("fr-BE")}. Passé cette date,
    l'envoi du procès-verbal au locataire s'arrêtera. Va dans Make,
    connexions, et réautorise Gmail.</div>`;
}

/* Une correction après signature ne modifie JAMAIS le document signé :
   elle crée une version suivante, qui devra être signée à son tour.
   L'ancienne reste dans le dossier, avec son empreinte. */
function ecranRectification(visite, message) {
  E.ecran = "rectification";
  const suivante = "V" + ((parseInt(String(visite.version_doc || "V1")
    .replace(/\D/g, ""), 10) || 1) + 1);

  titre("Rectifier", visite.bien.unite_source);
  vue(`${message ? `<div class="erreur">${echapper(message)}</div>` : ""}
    <div class="avert"><strong>Le document signé ne sera pas modifié</strong>
      La version ${echapper(visite.version_doc || "V1")}, signée le
      ${new Date(visite.date_signature || visite.date_debut).toLocaleString("fr-BE")},
      reste dans le dossier avec son empreinte. Une rectification crée la version
      ${echapper(suivante)}, qui devra être relue et signée par les deux parties.</div>

    <div class="bloc"><h2>Motif de la rectification</h2>
      <textarea id="motif" rows="3"
        placeholder="Ce qui doit être corrigé, et pourquoi. Ce texte figurera au document.">${
        echapper(E.motifRectif || "")}</textarea>
      <p class="note">Le motif est inscrit au procès-verbal de la nouvelle version :
      il explique au lecteur pourquoi deux documents coexistent.</p>
    </div>

    <div class="bloc"><h2>Ce qui sera repris</h2>
      <p class="note">Constatations, photographies, compteurs, clés, état général
      et réserves de la version précédente. Tu pourras tout modifier avant de
      signer à nouveau.</p>
    </div>

    <button id="btn-creer-version">Créer la version ${echapper(suivante)}</button>
    <button class="secondaire" id="btn-annuler">Annuler</button>`);

  $("btn-creer-version").onclick = async () => {
    const motif = $("motif").value.trim();
    if (!motif) {
      return ecranRectification(visite,
        "Écris d'abord le motif : il figurera au document et explique " +
        "pourquoi deux versions coexistent.");
    }
    E.motifRectif = motif;
    if (!(await confirmer("Créer la version " + suivante + " ?",
        "La version signée reste intacte. La nouvelle devra être signée par " +
        "les deux parties pour avoir effet.", "Oui, créer"))) return;
    try {
      const copie = await nouvelleVersion(visite, motif);
      E.motifRectif = "";
      VISITE = copie;
      vue(`<div class="succes">Version ${echapper(copie.version_doc)} créée</div>
        <div class="bloc"><h2>${echapper(copie.bien.unite_source)}</h2>
          <div class="ligne"><span>Version précédente</span><span class="val">${
            echapper(copie.version_precedente.version)}, signée le ${
            new Date(copie.version_precedente.date_signature).toLocaleDateString("fr-BE")
            }</span></div>
          <div class="ligne"><span>Motif</span><span class="val">${echapper(motif)}</span></div>
          <p class="note">Le contenu de la version précédente a été repris.
          Corrige ce qui doit l'être, puis fais signer à nouveau les deux parties.</p>
        </div>
        <button id="btn-ouvrir">Ouvrir la version ${echapper(copie.version_doc)}</button>
        <button class="secondaire" id="btn-acc">Retour à l'accueil</button>`);
      $("btn-ouvrir").onclick = () => ecranVisiteReprise(copie);
      $("btn-acc").onclick = () => ecranAccueil();
    } catch (e) {
      vue(`<div class="erreur"><strong>Impossible</strong>${echapper(e.message)}</div>
           <button class="secondaire" id="btn-r">Retour</button>`);
      $("btn-r").onclick = () => ecranAccueil();
    }
  };
  $("btn-annuler").onclick = () => { E.motifRectif = ""; ecranAccueil(); };
}

function ecranAbandon(visite) {
  titre("Abandonner la visite", visite.bien.unite_source);
  vue(`<div class="avert"><strong>Cette visite sera effacée de l'appareil</strong>
      ${visite.photos.length} photo(s) et
      ${visite.pieces.reduce((n, p) => n + p.constatations.length, 0)} constatation(s).<br><br>
      Les fichiers déjà déposés dans OneDrive ne sont PAS supprimés :
      à toi de les effacer si besoin.</div>
    <button id="btn-confirmer">Oui, abandonner cette visite</button>
    <button class="secondaire" id="btn-annuler">Annuler</button>`);
  $("btn-confirmer").onclick = async () => {
    $("btn-confirmer").disabled = true;
    try {
      await supprimerVisite(visite.visit_id);
      await journaliser("visite_abandonnee", { visit_id: visite.visit_id });
    } catch (e) {
      vue(`<div class="erreur"><strong>Abandon impossible</strong>${echapper(e.message)}</div>
           <button class="secondaire" id="btn-retour">Retour</button>`);
      $("btn-retour").onclick = () => ecranAccueil();
      return;
    }
    await ecranAccueil();
  };
  $("btn-annuler").onclick = () => ecranAccueil();
}

// --- 1. Type de visite ---------------------------------------------------

function ecranType() {
  E.ecran = "type";
  E.brouillon = {};
  titre("Type de visite", "Étape 1 sur 5");
  vue(`<div class="bloc">${boutonsChoix([
    { valeur: "EDLE", libelle: "État des lieux d'ENTRÉE", droite: "EDLE" },
    { valeur: "EDLS", libelle: "État des lieux de SORTIE", droite: "EDLS" },
  ])}</div><button class="secondaire" id="btn-retour">Annuler</button>`);
  surChoix(v => { E.brouillon.type = v; ecranImmeuble(); });
  $("btn-retour").onclick = () => ecranAccueil();
}

// --- 2. Immeuble et unité ------------------------------------------------

async function ecranImmeuble() {
  E.ecran = "immeuble";
  titre("Immeuble", "Étape 2 sur 5");
  vue(`<p class="note">Lecture de la liste des locataires…</p>`);
  try {
    E.liste = await chargerLocataires();
  } catch (e) {
    vue(`<div class="erreur"><strong>Liste indisponible</strong>${echapper(e.message)}</div>
         <button class="secondaire" id="btn-retour">Retour</button>`);
    $("btn-retour").onclick = () => ecranAccueil();
    return;
  }
  vue(`<p class="fil">${E.brouillon.type}</p><div class="bloc">${
    boutonsChoix(E.liste.immeubles.map(i => ({
      valeur: i.immeuble_id, libelle: i.nom, droite: i.unites.length + " unités",
    })))}</div><button class="secondaire" id="btn-retour">Retour</button>`);
  surChoix(id => ecranUnite(id));
  $("btn-retour").onclick = () => ecranType();
}

function ecranUnite(immeubleId) {
  E.ecran = "unite";
  const imm = E.liste.immeubles.find(i => i.immeuble_id === immeubleId);
  E.brouillon.immeuble_id = immeubleId;
  E.brouillon.immeuble_nom = imm.nom;
  titre("Unité", "Étape 2 sur 5 — " + imm.nom);
  vue(`<p class="fil">${E.brouillon.type} · ${echapper(imm.nom)}</p><div class="bloc">${
    boutonsChoix(imm.unites.map(u => ({
      valeur: u.designation,
      libelle: u.designation,
      droite: u.inoccupe ? "inoccupé" : (u.locataire || ""),
    })))}</div><button class="secondaire" id="btn-retour">Retour</button>`);
  surChoix(d => ecranDossier(d));
  $("btn-retour").onclick = () => ecranImmeuble();
}

// --- 3. Dossier OneDrive -------------------------------------------------

async function ecranDossier(designation) {
  E.ecran = "dossier";
  const imm = E.liste.immeubles.find(i => i.immeuble_id === E.brouillon.immeuble_id);
  const unite = imm.unites.find(u => u.designation === designation);
  E.brouillon.designation = designation;
  E.brouillon.preneurs = unite.preneurs;

  titre("Dossier OneDrive", "Étape 3 sur 5");
  vue(`<p class="note">Recherche du dossier…</p>`);

  let r;
  try { r = await resoudreDossierUnite(E.brouillon.immeuble_id, designation); }
  catch (e) { return erreurEcran(e.message, () => ecranUnite(E.brouillon.immeuble_id)); }

  if (r.statut === "approuve_absent") {
    return erreurEcran({ html:
      `Le dossier approuvé « ${echapper(r.attendu)} » n'existe plus dans « ${
        echapper(imm.dossier_onedrive)} ».<br><br>Passe par « Comparer avec OneDrive » pour le redésigner.` },
      () => ecranUnite(E.brouillon.immeuble_id));
  }

  if (r.statut === "introuvable") {
    return erreurEcran({ html:
      `Aucun dossier ne correspond à « ${echapper(designation)} » dans « ${
        echapper(imm.dossier_onedrive)} ».<br><br>Dossiers présents : ${
        echapper((r.tous || []).join(", "))}` },
      () => ecranUnite(E.brouillon.immeuble_id));
  }

  if (r.statut === "ambigu") {
    vue(`<div class="avert"><strong>Deux dossiers possibles</strong>
      « ${echapper(designation)} » peut correspondre à plusieurs dossiers.
      Choisis lequel.</div>
      <div class="bloc">${boutonsChoix(r.candidats.map(c => ({
        valeur: c.nom, libelle: c.nom })))}</div>
      <button class="secondaire" id="btn-retour">Retour</button>`);
    surChoix(nom => {
      const c = r.candidats.find(x => x.nom === nom);
      E.brouillon.confirmee = true;
      suiteDossier(c.nom, c.ref);
    });
    $("btn-retour").onclick = () => ecranUnite(E.brouillon.immeuble_id);
    return;
  }

  E.brouillon.confirmee = r.approuvee === true;
  suiteDossier(r.nom, r.ref);
}

async function suiteDossier(nomUnite, refUnite) {
  E.brouillon.dossier_unite = nomUnite;
  vue(`<p class="note">Lecture des dossiers locataires…</p>`);
  let locs;
  try { locs = await listerDossiersLocataires(refUnite); }
  catch (e) { return erreurEcran(e.message, () => ecranUnite(E.brouillon.immeuble_id)); }

  if (locs.length === 0) {
    return erreurEcran({ html:
      `Le dossier « ${echapper(nomUnite)} » ne contient aucun dossier locataire.
       L'application ne crée pas de dossier : crée-le dans OneDrive, puis reviens.` },
      () => ecranUnite(E.brouillon.immeuble_id));
  }

  titre("Dossier locataire", "Étape 3 sur 5 — " + nomUnite);
  const attendu = (E.brouillon.preneurs || []).join(" & ");
  vue(`<p class="fil">${E.brouillon.type} · ${echapper(E.brouillon.immeuble_nom)} · ${echapper(nomUnite)}</p>
    ${attendu ? `<div class="bloc"><h2>Locataire attendu</h2>
       <p class="note">D'après Gestion Loyers : <strong>${echapper(attendu)}</strong>.
       Les dossiers changent à chaque nouveau bail — choisis celui de cette visite.</p></div>` : ""}
    <div class="bloc">${boutonsChoix(locs.map(l => ({
      valeur: l.nom,
      libelle: l.nom,
      droite: (typeof scoreNom === "function" &&
               scoreNom(l.nom, E.brouillon.preneurs) > 0) ? "probable" : "",
    })))}</div>
    <button class="secondaire" id="btn-retour">Retour</button>`);
  surChoix(nom => {
    const l = locs.find(x => x.nom === nom);
    verifierCible(l);
  });
  $("btn-retour").onclick = () => ecranUnite(E.brouillon.immeuble_id);
}

async function verifierCible(locataire) {
  vue(`<p class="note">Vérification du dossier de destination…</p>`);
  let c;
  try { c = await resoudreDossierCible(locataire.ref, E.brouillon.type); }
  catch (e) { return erreurEcran(e.message, () => ecranUnite(E.brouillon.immeuble_id)); }

  if (c.statut === "absent") {
    return erreurEcran({ html:
      `Le dossier « ${echapper(c.attendu)} » n'existe pas chez ${echapper(locataire.nom)}.<br><br>
       Présents : ${echapper(c.presents.join(", ") || "aucun")}.<br><br>
       L'application ne crée pas de dossier. Crée-le dans OneDrive avant de commencer.` },
      () => ecranUnite(E.brouillon.immeuble_id));
  }

  /* Sous-dossier Photos et lien de partage, résolus MAINTENANT : c'est le
     seul moment où le réseau est certain. Si l'un des deux échoue, la
     visite ne démarre pas — état des lieux sur papier. Mieux vaut un
     blocage à la porte qu'une visite entière mal rangée. */
  vue(`<p class="note">Préparation du dossier des photographies…</p>`);
  let prep;
  try { prep = await preparerDepot(c.ref); }
  catch (e) { prep = { ok: false, etape: "préparation", message: e.message }; }

  if (!prep.ok) {
    return erreurEcran({ html:
      `Le <strong>${echapper(prep.etape)}</strong> n'a pas pu être mis en place dans
       « ${echapper(locataire.nom)} ».<br><br>
       Microsoft répond : ${echapper(prep.message || "aucune précision")}.<br><br>
       <strong>Cette visite ne peut pas être faite avec l'application.</strong>
       Utilise l'état des lieux papier.` },
      () => ecranUnite(E.brouillon.immeuble_id));
  }

  E.brouillon.dossier_locataire = locataire.nom;
  E.brouillon.ref_cible = c.ref;
  E.brouillon.dossier_photos_item_id = prep.id;
  E.brouillon.lien_photos = prep.lien;

  /* Les preneurs viennent de Gestion Loyers, et de nulle part ailleurs.
     Une version antérieure les remplaçait par le nom du dossier OneDrive
     quand les deux ne concordaient pas : un dossier nommé « DUPONT Jean -
     bail 2025 » finissait tel quel comme nom de preneur dans un document
     signé. Un nom de dossier est une étiquette de rangement, pas une
     identité civile.
     Les écarts entre les deux sources se traitent AU BUREAU, dans
     « Comparer avec OneDrive », jamais debout devant une porte. */
  ecranComposition();
}

/* Le message peut venir de Microsoft et contenir un nom de dossier :
   l'échappement est fait ICI, une fois pour toutes. Les appelants
   passent du texte brut ; ceux qui veulent du HTML utilisent {html:...}. */
/* Confirmation en oui / non. Renvoie une promesse : l'appelant attend
   la réponse sans figer le reste de l'écran. */
function confirmer(titreTexte, detail, libelleOui) {
  return new Promise(resoudre => {
    const fond = document.createElement("div");
    fond.className = "voile";
    fond.innerHTML = `<div class="boite">
      <h2>${echapper(titreTexte)}</h2>
      ${detail ? `<p class="note">${echapper(detail)}</p>` : ""}
      <button id="conf-oui">${echapper(libelleOui || "Oui")}</button>
      <button class="secondaire" id="conf-non">Annuler</button>
    </div>`;
    document.body.appendChild(fond);
    const fermer = (reponse) => {
      if (fond.parentNode) fond.parentNode.removeChild(fond);
      resoudre(reponse);
    };
    fond.querySelector("#conf-oui").onclick = () => fermer(true);
    fond.querySelector("#conf-non").onclick = () => fermer(false);
    fond.onclick = (ev) => { if (ev.target === fond) fermer(false); };
  });
}

/* Le code court identifie le document. Pour une version 2, visit_id se
   termine par « V2 » : deux rectifications le même jour dans la même unité
   auraient produit le même nom de fichier, et la seconde aurait écrasé la
   première. On prend donc le code de l'identifiant PERMANENT. */
function codeCourt(V) {
  const base = (V.edl_id || V.visit_id).split("_").pop();
  const version = V.version_doc && V.version_doc !== "V1" ? "_" + V.version_doc : "";
  return base + version;
}

function erreurEcran(message, retour) {
  const corps = (message && message.html) ? message.html : echapper(message);
  vue(`<div class="erreur"><strong>Impossible de continuer</strong>${corps}</div>
       <button class="secondaire" id="btn-retour">Retour</button>`);
  $("btn-retour").onclick = retour;
}

// --- 4. Composition ------------------------------------------------------

function ecranComposition() {
  E.ecran = "composition";
  const memo = lireReglagesMemorises(E.brouillon.immeuble_id, E.brouillon.designation);
  E.brouillon.composition = memo ? memo.composition : compositionParDefaut(E.brouillon.designation);
  E.brouillon.reglages = memo ? memo.reglages : reglagesParDefaut(E.brouillon.immeuble_id);
  dessinerComposition(memo !== null);
}

function dessinerComposition(memorise) {
  const c = E.brouillon.composition, r = E.brouillon.reglages;
  titre("Composition du logement", "Étape 4 sur 5");
  const inter = (cle, libelle, valeur) =>
    `<div class="interrupteur"><span>${libelle}</span>
     <button class="choix" style="width:auto;margin:0;padding:7px 16px" data-bascule="${cle}">${
       valeur ? "oui" : "non"}</button></div>`;
  const nombre = (cle, libelle, valeur) =>
    `<div class="interrupteur"><span>${libelle}</span><span class="compteur">
      <button class="choix" style="width:auto;margin:0;padding:7px 14px" data-moins="${cle}">−</button>
      <input readonly value="${valeur}">
      <button class="choix" style="width:auto;margin:0;padding:7px 14px" data-plus="${cle}">+</button>
     </span></div>`;

  vue(
    (memorise ? `<p class="note">Composition mémorisée lors d'une visite précédente.</p>` : "") +
    `<div class="bloc"><h2>Pièces</h2>
      ${inter("sejour", "Séjour", c.sejour)}
      ${inter("cuisine", "Cuisine", c.cuisine)}
      ${nombre("nb_chambres", "Chambres", c.nb_chambres)}
      ${nombre("nb_salles_de_bain", "Salles de bain", c.nb_salles_de_bain)}
      ${inter("hall", "Hall", c.hall)}
      ${inter("cave", "Cave", c.cave)}
      ${inter("terrasse", "Terrasse / jardin", c.terrasse)}
      ${inter("grenier", "Grenier", c.grenier)}
      ${inter("buanderie", "Buanderie", c.buanderie)}
      ${inter("garage", "Garage", c.garage)}
    </div>
    <div class="bloc"><h2>Compteurs</h2>
      ${inter("electricite_bi_horaire", "Électricité bi-horaire", r.electricite_bi_horaire)}
      ${inter("ista_present", "ISTA — à suivre avec décompte charges", r.ista_present)}
    </div>
    <button id="btn-suite">Continuer</button>
    <button class="secondaire" id="btn-retour">Retour</button>`);

  $("vue").querySelectorAll("[data-bascule]").forEach(b => b.onclick = () => {
    const k = b.getAttribute("data-bascule");
    if (k in c) c[k] = !c[k]; else r[k] = !r[k];
    dessinerComposition(memorise);
  });
  $("vue").querySelectorAll("[data-plus]").forEach(b => b.onclick = () => {
    const k = b.getAttribute("data-plus"); c[k] = Math.min(9, c[k] + 1); dessinerComposition(memorise);
  });
  $("vue").querySelectorAll("[data-moins]").forEach(b => b.onclick = () => {
    const k = b.getAttribute("data-moins"); c[k] = Math.max(0, c[k] - 1); dessinerComposition(memorise);
  });
  $("btn-suite").onclick = () => ecranOptions();
  $("btn-retour").onclick = () => ecranUnite(E.brouillon.immeuble_id);
}

// --- 5. Options et récapitulatif ----------------------------------------

function ecranOptions() {
  E.ecran = "options";
  if (E.brouillon.chiffrage === undefined) E.brouillon.chiffrage = false;
  if (E.brouillon.pret_meubles === undefined) E.brouillon.pret_meubles = false;
  if (!E.brouillon.bailleur)
    E.brouillon.bailleur = bailleurParDefaut(E.brouillon.immeuble_id);
  dessinerOptions();
}

function dessinerOptions() {
  const b = E.brouillon;
  const pieces = construirePieces(b.composition);
  titre("Récapitulatif", "Étape 5 sur 5");

  const inter = (cle, libelle, valeur) =>
    `<div class="interrupteur"><span>${libelle}</span>
     <button class="choix" style="width:auto;margin:0;padding:7px 16px" data-opt="${cle}">${
       valeur ? "oui" : "non"}</button></div>`;

  const attendu = bailleurParDefaut(b.immeuble_id);
  const ecart = b.bailleur.cle !== attendu.cle;

  vue(`<div class="avert"><strong>ATTENTION À L'IDENTITÉ DU PROPRIÉTAIRE !</strong>
      Trois propriétaires différents selon l'immeuble. Le nom retenu ici sera
      celui du procès-verbal signé.</div>

    <div class="bloc"><h2>Bailleur</h2>
      ${(CONFIG.bailleurs || []).map(x => `<button class="choix${
        b.bailleur.cle === x.cle ? " actif-choix" : ""}" data-bailleur="${x.cle}">
        ${echapper(x.libelle)}${x.represente_par
          ? `<span class="droite">représentée par ${echapper(x.represente_par)}</span>` : ""}
        </button>`).join("")}
      ${ecart
        ? `<p class="note ko">Ce n'est pas le propriétaire habituel de
           ${echapper(b.immeuble_nom)} — normalement ${echapper(attendu.libelle)}.
           Vérifie avant de continuer.</p>`
        : `<p class="note">Propriétaire habituel de ${echapper(b.immeuble_nom)}.</p>`}
    </div>

    <div class="bloc"><h2>Options</h2>
      ${b.type === "EDLS" ? inter("chiffrage", "Chiffrage des dégâts", b.chiffrage)
        : `<p class="note">Le chiffrage ne concerne que les états des lieux de sortie.</p>`}
      ${inter("pret_meubles", "Prêt de meubles Samadhi", b.pret_meubles)}
    </div>
    <div class="bloc"><h2>Destination</h2>
      <div class="ligne"><span>Bailleur</span><span class="val">${
        echapper(b.bailleur.libelle)}</span></div>
      <div class="ligne"><span>Immeuble</span><span class="val">${echapper(b.immeuble_nom)}</span></div>
      <div class="ligne"><span>Unité</span><span class="val">${echapper(b.dossier_unite)}</span></div>
      <div class="ligne"><span>Locataire</span><span class="val">${echapper(b.dossier_locataire)}</span></div>
      <div class="ligne"><span>Dossier</span><span class="val">${b.type}</span></div>
    </div>
    <div class="bloc"><h2>Preneurs à faire signer</h2>
      ${b.preneurs.length
        ? b.preneurs.map(p => `<div class="ligne"><span>${echapper(p)}</span><span class="val"></span></div>`).join("")
        : `<p class="note">Aucun preneur dans la liste — unité inoccupée. À saisir à la signature.</p>`}
    </div>
    <div class="bloc"><h2>${pieces.length} pièces</h2>
      <p class="note">${pieces.map(p => echapper(p.libelle)).join(" · ")}</p>
    </div>
    <button id="btn-creer">Commencer la visite</button>
    <button class="secondaire" id="btn-retour">Retour</button>`);

  $("vue").querySelectorAll("[data-bailleur]").forEach(x => x.onclick = () => {
    b.bailleur = trouverBailleur(x.getAttribute("data-bailleur"));
    dessinerOptions();
  });

  $("vue").querySelectorAll("[data-opt]").forEach(x => x.onclick = () => {
    const k = x.getAttribute("data-opt"); b[k] = !b[k]; dessinerOptions();
  });
  $("btn-creer").onclick = () => lancerVisite();
  $("btn-retour").onclick = () => dessinerComposition(false);
}

async function lancerVisite() {
  const b = E.brouillon;
  b.operateur = nomUtilisateur();
  try {
    const visite = await creerVisite(b);
    ecranVisiteReprise(visite);
  } catch (e) {
    erreurEcran("Création impossible : " + e.message, () => ecranOptions());
  }
}

// --- Visite en cours -----------------------------------------------------

var VISITE = null;

async function ecranVisiteReprise(visite) {
  VISITE = visite;
  E.ecran = "visite";
  titre(visite.bien.unite_source, visite.type + " — " + visite.bien.dossier_locataire_onedrive);

  const parPiece = {};
  visite.photos.forEach(p => { parPiece[p.rattachement] = (parPiece[p.rattachement] || 0) + 1; });

  vue(`<div class="barre" id="barre-attente">…</div>
    <div class="bloc"><h2>Pièces</h2>
      ${visite.pieces.map(p => {
        const n = parPiece[p.piece_id] || 0;
        const c = p.constatations.length;
        return `<button class="choix" data-piece="${p.piece_id}">${echapper(p.libelle)}
          <span class="droite">${n} photo${n > 1 ? "s" : ""}${c ? " · " + c + " constat" + (c > 1 ? "s" : "") : ""}</span></button>`;
      }).join("")}
    </div>
    <button class="secondaire" id="btn-composition">Modifier la composition</button>
    <button class="secondaire" id="btn-releves">Compteurs, clés et état général</button>
    ${visite.type === "EDLS"
      ? `<button class="secondaire" id="btn-comparer-edl">Comparer avec l'entrée</button>` : ""}
    <button id="btn-cloturer">Terminer la visite</button>
    <button class="secondaire" id="btn-accueil">Retour à l'accueil</button>`);

  $("vue").querySelectorAll("[data-piece]").forEach(b =>
    b.onclick = () => ecranPiece(b.getAttribute("data-piece")));
  $("btn-composition").onclick = () => ecranModifierComposition();
  $("btn-releves").onclick = () => ecranReleves();
  if ($("btn-comparer-edl")) $("btn-comparer-edl").onclick = () => ecranComparaisonEDL();
  $("btn-cloturer").onclick = () => ecranCloture(VISITE);
  $("btn-accueil").onclick = async () => {
    await deposerMaintenant(VISITE);
    ecranAccueil();
  };
  majCompteurAttente();
}

// --- Modifier la composition d'une visite en cours -----------------------

/* La composition se découvre sur place : une cave, une chambre de plus.
   Elle doit rester modifiable tant que la visite n'est pas signée. */
function ecranModifierComposition(message) {
  E.ecran = "modif_composition";
  const V = VISITE;
  const c = JSON.parse(JSON.stringify(V.options.composition || {}));
  const r = JSON.parse(JSON.stringify(V.options.reglages_unite || {}));
  E.compoTravail = E.compoTravail || c;
  E.reglagesTravail = E.reglagesTravail || r;
  dessinerModifComposition(message);
}

function dessinerModifComposition(message) {
  const V = VISITE;
  const c = E.compoTravail, r = E.reglagesTravail;
  const futures = construirePieces(c);
  const actuelles = V.pieces;

  /* Une pièce qui contient déjà quelque chose ne peut pas disparaître :
     on perdrait des constats ou des photos déjà déposées. */
  const occupee = (p) => p.constatations.length > 0 ||
    V.photos.some(x => x.rattachement === p.piece_id);
  const libelles = futures.map(x => x.libelle);
  const perdues = actuelles.filter(p => !libelles.includes(p.libelle) && occupee(p));
  const supprimees = actuelles.filter(p => !libelles.includes(p.libelle) && !occupee(p));
  const ajoutees = futures.filter(x => !actuelles.some(p => p.libelle === x.libelle));

  titre("Modifier la composition", V.bien.unite_source);

  const inter = (cle, libelle, valeur, cible) =>
    `<div class="interrupteur"><span>${libelle}</span>
     <button class="choix" style="width:auto;margin:0;padding:7px 16px"
       data-bascule="${cible}:${cle}">${valeur ? "oui" : "non"}</button></div>`;
  const nombre = (cle, libelle, valeur) =>
    `<div class="interrupteur"><span>${libelle}</span><span class="compteur">
      <button class="choix" style="width:auto;margin:0;padding:7px 14px" data-moins="${cle}">−</button>
      <input readonly value="${valeur}">
      <button class="choix" style="width:auto;margin:0;padding:7px 14px" data-plus="${cle}">+</button>
     </span></div>`;

  let html = `${message ? `<div class="succes">${echapper(message)}</div>` : ""}
    <div class="bloc"><h2>Pièces</h2>
      ${inter("sejour", "Séjour", c.sejour, "c")}
      ${inter("cuisine", "Cuisine", c.cuisine, "c")}
      ${nombre("nb_chambres", "Chambres", c.nb_chambres)}
      ${nombre("nb_salles_de_bain", "Salles de bain", c.nb_salles_de_bain)}
      ${inter("hall", "Hall", c.hall, "c")}
      ${inter("cave", "Cave", c.cave, "c")}
      ${inter("terrasse", "Terrasse / jardin", c.terrasse, "c")}
      ${inter("grenier", "Grenier", c.grenier, "c")}
      ${inter("buanderie", "Buanderie", c.buanderie, "c")}
      ${inter("garage", "Garage", c.garage, "c")}
    </div>
    <div class="bloc"><h2>Compteurs</h2>
      ${inter("electricite_bi_horaire", "Électricité bi-horaire", r.electricite_bi_horaire, "r")}
      ${inter("ista_present", "ISTA — à suivre avec décompte charges", r.ista_present, "r")}
    </div>`;

  if (V.type === "EDLS") {
    html += `<div class="bloc"><h2>Chiffrage</h2>
      ${inter("chiffrage_actif", "Chiffrage des dégâts", V.options.chiffrage_actif, "o")}
    </div>`;
  }

  html += `<div class="bloc"><h2>Ce qui va changer</h2>
    ${ajoutees.length
      ? `<p class="note">À ajouter : ${ajoutees.map(x => echapper(x.libelle)).join(", ")}</p>`
      : ""}
    ${supprimees.length
      ? `<p class="note">À retirer, encore vides : ${
          supprimees.map(x => echapper(x.libelle)).join(", ")}</p>` : ""}
    ${!ajoutees.length && !supprimees.length && !perdues.length
      ? `<p class="note">Aucun changement.</p>` : ""}
  </div>`;

  if (perdues.length) {
    html += `<div class="erreur"><strong>Impossible de retirer ${
      perdues.length > 1 ? "ces pièces" : "cette pièce"}</strong>
      ${perdues.map(p => echapper(p.libelle) + " — " + p.constatations.length +
        " constat(s), " + V.photos.filter(x => x.rattachement === p.piece_id).length +
        " photo(s)").join("<br>")}<br><br>
      Retire d'abord leur contenu, ou laisse-les en place.</div>
      <button disabled>Appliquer</button>`;
  } else {
    html += `<button id="btn-appliquer">Appliquer</button>`;
  }
  html += `<button class="secondaire" id="btn-retour">Annuler</button>`;
  vue(html);

  $("vue").querySelectorAll("[data-bascule]").forEach(b => b.onclick = () => {
    const [cible, cle] = b.getAttribute("data-bascule").split(":");
    if (cible === "c") c[cle] = !c[cle];
    else if (cible === "r") r[cle] = !r[cle];
    else E.chiffrageTravail = !(E.chiffrageTravail === undefined
      ? V.options.chiffrage_actif : E.chiffrageTravail);
    if (cible === "o") V.options.chiffrage_actif = E.chiffrageTravail;
    dessinerModifComposition();
  });
  $("vue").querySelectorAll("[data-plus]").forEach(b => b.onclick = () => {
    const k = b.getAttribute("data-plus"); c[k] = Math.min(9, c[k] + 1);
    dessinerModifComposition();
  });
  $("vue").querySelectorAll("[data-moins]").forEach(b => b.onclick = () => {
    const k = b.getAttribute("data-moins"); c[k] = Math.max(0, c[k] - 1);
    dessinerModifComposition();
  });

  if ($("btn-appliquer")) $("btn-appliquer").onclick = async () => {
    try {
      VISITE = await modifierVisite(VISITE.visit_id, v => {
        const attendues = construirePieces(E.compoTravail);
        const parLibelle = {};
        v.pieces.forEach(p => { parLibelle[p.libelle] = p; });

        /* Les pièces conservées gardent leur identifiant : les photos
           déjà prises restent rattachées. */
        let maxNum = 0;
        v.pieces.forEach(p => {
          const n = parseInt(String(p.piece_id).replace(/\D/g, ""), 10) || 0;
          if (n > maxNum) maxNum = n;
        });
        v.pieces = attendues.map(x => {
          if (parLibelle[x.libelle]) return parLibelle[x.libelle];
          return { piece_id: "p" + (++maxNum), libelle: x.libelle, constatations: [] };
        });
        v.options.composition = E.compoTravail;
        v.options.reglages_unite = E.reglagesTravail;
        if (v.type === "EDLS" && E.chiffrageTravail !== undefined)
          v.options.chiffrage_actif = E.chiffrageTravail;
        if (v.options.reglages_unite.electricite_bi_horaire !==
            v.compteurs.electricite.bi_horaire) {
          v.compteurs.electricite.bi_horaire = v.options.reglages_unite.electricite_bi_horaire;
        }
      }) || VISITE;
      memoriserReglages(VISITE.bien.immeuble_id, VISITE.bien.unite_source,
        E.compoTravail, E.reglagesTravail);
    } catch (e) {
      return dessinerModifComposition("Modification impossible : " + e.message);
    }
    E.compoTravail = null; E.reglagesTravail = null; E.chiffrageTravail = undefined;
    programmerDepot();
    ecranVisiteReprise(VISITE);
  };

  $("btn-retour").onclick = () => {
    E.compoTravail = null; E.reglagesTravail = null; E.chiffrageTravail = undefined;
    ecranVisiteReprise(VISITE);
  };
}

// --- Relevés : compteurs, clés, équipements, état général ----------------

async function ecranReleves(message) {
  E.ecran = "releves";
  VISITE = (await lireVisite(VISITE.visit_id)) || VISITE;
  titre("Compteurs et relevés", VISITE.bien.unite_source);

  if (VISITE.type === "EDLS" && (VISITE.options || {}).rappel_index_entree === true
      && !E.rappelCharge) {
    E.rappelCharge = true;
    vue(`<p class="note">Lecture de l'état des lieux d'entrée…</p>`);
    const rappel = await rappelerIndexEntree(VISITE);
    if (rappel && rappel.compteurs) {
      VISITE = await modifierVisite(VISITE.visit_id, v => {
        const r = rappel.compteurs;
        v.compteurs.electricite.index_entree_rappel = {
          index_unique: r.electricite.index_unique,
          index_jour: r.electricite.index_jour,
          index_nuit: r.electricite.index_nuit,
        };
        v.compteurs.eau.index_entree_rappel = { index: r.eau.index };
        (v.compteurs.ista || []).forEach((x, i) => {
          const src = (r.ista || [])[i];
          if (src) x.index_entree_rappel = { index_r: src.index_r, index_21: src.index_21 };
        });
        v.comparaison = v.comparaison || {};
        v.comparaison.edle_visit_id = rappel.visit_id;
        v.comparaison.edle_date = rappel.date;
      }) || VISITE;
    }
  }
  dessinerReleves(message);
}

function dessinerReleves(message) {
  const V = VISITE, c = V.compteurs;
  const sortie = V.type === "EDLS";

  const champ = (id, valeur, rappel) =>
    `<div class="ligne"><span>${id.libelle}${
      rappel !== undefined && rappel !== null
        ? ` <span class="gris">(entrée : ${echapper(String(rappel))})</span>` : ""}</span>
      <input class="saisie-index" inputmode="numeric" data-releve="${id.chemin}"
        value="${valeur === null || valeur === undefined ? "" : echapper(String(valeur))}"></div>`;

  const photoDe = (r) => {
    const p = photoCompteur(V, r);
    return `<div class="ligne"><span class="note">Photo du compteur</span>
      <span class="val ${p ? "ok" : "gris"}">${p ? "prise" : "conseillée"}</span></div>
      <input type="file" accept="image/*" capture="environment" class="cache" id="app-${r}">
      <button class="mini ${p ? "secondaire" : ""}" data-photo-compteur="${r}">${
        p ? "Reprendre la photo" : "Photographier le compteur"}</button>`;
  };

  const rappelElec = c.electricite.index_entree_rappel || {};
  const rappelEau = (c.eau.index_entree_rappel || {}).index;

  let html = `<div class="barre" id="barre-attente">…</div>
    ${message ? `<div class="succes">${echapper(message)}</div>` : ""}`;

  if (sortie) {
    const demande = (V.options || {}).rappel_index_entree === true;
    html += `<div class="bloc"><h2>Index d'entrée</h2>
      <div class="interrupteur"><span>Rappeler les index de l'état des lieux d'entrée</span>
        <span class="segments">
          <button class="seg${demande ? " actif" : ""}" data-rappel="oui">oui</button>
          <button class="seg${demande === false ? " actif" : ""}" data-rappel="non">non</button>
        </span></div>
      <p class="note">${demande
        ? "Les index d'entrée s'affichent en regard, et un index inférieur est signalé."
        : "Aucun index d'entrée n'est lu ni affiché."}</p>
    </div>`;
  }

  html += `<div class="bloc"><h2>Compteur électrique</h2>
      ${champ({ libelle: "Numéro", chemin: "compteurs.electricite.numero" }, c.electricite.numero)}
      ${c.electricite.bi_horaire
        ? champ({ libelle: "Index jour", chemin: "compteurs.electricite.index_jour" },
                c.electricite.index_jour, sortie ? rappelElec.index_jour : null) +
          champ({ libelle: "Index nuit", chemin: "compteurs.electricite.index_nuit" },
                c.electricite.index_nuit, sortie ? rappelElec.index_nuit : null)
        : champ({ libelle: "Index", chemin: "compteurs.electricite.index_unique" },
                c.electricite.index_unique, sortie ? rappelElec.index_unique : null)}
      ${photoDe("compteur_electricite")}
    </div>

    <div class="bloc"><h2>Compteur d'eau</h2>
      ${champ({ libelle: "Numéro", chemin: "compteurs.eau.numero" }, c.eau.numero)}
      ${champ({ libelle: "Index", chemin: "compteurs.eau.index" }, c.eau.index, sortie ? rappelEau : null)}
      ${photoDe("compteur_eau")}
    </div>`;

  if (((V.options || {}).reglages_unite || {}).ista_present) {
    html += `<div class="bloc"><h2>ISTA — à suivre avec décompte charges</h2>`;
    (c.ista || []).forEach((r, i) => {
      const re = r.index_entree_rappel || {};
      html += `<p class="note">Répartiteur ${i + 1}</p>
        ${champ({ libelle: "Numéro", chemin: "compteurs.ista." + i + ".numero" }, r.numero)}
        ${champ({ libelle: "Index R", chemin: "compteurs.ista." + i + ".index_r" }, r.index_r,
                sortie ? re.index_r : null)}
        ${champ({ libelle: "Index 21", chemin: "compteurs.ista." + i + ".index_21" }, r.index_21,
                sortie ? re.index_21 : null)}
        ${photoDe("compteur_ista_" + (i + 1))}
        <button class="mini secondaire" data-suppr-ista="${i}">Retirer ce répartiteur</button>`;
    });
    html += `<button class="mini" id="btn-ajout-ista">Ajouter un répartiteur</button></div>`;
  }

  // gaz et mazout : présents, masqués tant qu'ils ne servent pas
  html += `<div class="bloc"><h2>Autres compteurs</h2>
    ${c.gaz ? champ({ libelle: "Gaz — numéro", chemin: "compteurs.gaz.numero" }, c.gaz.numero) +
              champ({ libelle: "Gaz — index", chemin: "compteurs.gaz.index" }, c.gaz.index)
            : `<button class="mini secondaire" data-ajout="gaz">Ajouter un compteur gaz</button>`}
    ${c.mazout ? champ({ libelle: "Mazout — numéro", chemin: "compteurs.mazout.numero" }, c.mazout.numero) +
                 champ({ libelle: "Mazout — index", chemin: "compteurs.mazout.index" }, c.mazout.index)
               : `<button class="mini secondaire" data-ajout="mazout">Ajouter un compteur mazout</button>`}
  </div>`;

  html += `<div class="bloc"><h2>Clés remises</h2>
    ${CLES_STANDARD.map(k => `<div class="ligne"><span>${k.libelle}</span>
      <span class="compteur">
        <button class="choix" style="width:auto;margin:0;padding:6px 13px" data-cle-moins="${k.cle}">−</button>
        <input readonly value="${V.cles[k.cle] === null || V.cles[k.cle] === undefined
          ? "—" : V.cles[k.cle]}">
        <button class="choix" style="width:auto;margin:0;padding:6px 13px" data-cle-plus="${k.cle}">+</button>
      </span></div>`).join("")}
    <p class="note">« — » signifie sans objet.</p>
  </div>`;

  const oui_non = (chemin, libelle, valeur) =>
    `<div class="interrupteur"><span>${libelle}</span><span class="segments">
      <button class="seg${valeur === true ? " actif" : ""}" data-on="${chemin}">oui</button>
      <button class="seg${valeur === false ? " actif" : ""}" data-off="${chemin}">non</button>
    </span></div>`;

  html += `<div class="bloc"><h2>Équipements</h2>
    ${oui_non("equipements.sonnette.etat", "Sonnette fonctionnelle",
              V.equipements.sonnette.etat === "fonctionnelle" ? true
              : V.equipements.sonnette.etat === "hors_service" ? false : null)}
    ${oui_non("equipements.detecteur_fumee.present", "Détecteur de fumée présent",
              V.equipements.detecteur_fumee.present)}
    <textarea rows="2" data-texte="equipements.detecteur_fumee.commentaire"
      placeholder="Remarque sur le détecteur (piles, emplacement…)">${
      echapper(V.equipements.detecteur_fumee.commentaire || "")}</textarea>
  </div>

  <div class="bloc"><h2>État général</h2>
    ${oui_non("etat_general.degats_locatifs.constate", "Dégâts locatifs constatés",
              V.etat_general.degats_locatifs.constate)}
    <textarea rows="2" data-texte="etat_general.degats_locatifs.commentaire"
      placeholder="Lesquels ?">${echapper(V.etat_general.degats_locatifs.commentaire || "")}</textarea>
    ${oui_non("etat_general.proprete.propre", "Les lieux sont propres",
              V.etat_general.proprete.propre)}
    <textarea rows="2" data-texte="etat_general.proprete.commentaire"
      placeholder="Précisions">${echapper(V.etat_general.proprete.commentaire || "")}</textarea>
  </div>`;

  if (sortie) {
    html += `<div class="bloc"><h2>Estimation de nettoyage</h2>
      <div class="ligne"><span>Heures estimées</span>
        <input class="saisie-index" inputmode="decimal" data-nettoyage
          value="${V.chiffrage && V.chiffrage.estimation_nettoyage_heures !== undefined
            && V.chiffrage.estimation_nettoyage_heures !== null
            ? V.chiffrage.estimation_nettoyage_heures : ""}"></div>
      <p class="note">Appréciation sur place, ni plafond ni forfait.
      Ordre de grandeur habituel : jusqu'à 10 h pour un studio, 14 h pour un appartement.</p>
    </div>`;
  }

  html += `<div class="bloc"><h2>Divers</h2>
    <textarea rows="3" data-texte="divers"
      placeholder="Remarques générales">${echapper(V.divers || "")}</textarea></div>`;

  const conseils = controlerReleves(V);
  const anomalies = controlerProgression(V);
  if (anomalies.length)
    html += `<div class="erreur"><strong>À vérifier</strong>${
      anomalies.map(x => echapper(x)).join("<br>")}</div>`;
  if (conseils.length)
    html += `<div class="bloc"><h2>Non renseigné</h2>
      <p class="note">${conseils.map(m => echapper(m)).join(", ")}.
      Rien n'est obligatoire : tu peux clôturer sans.</p></div>`;

  html += `<button class="secondaire" id="btn-retour">Retour aux pièces</button>`;
  vue(html);
  brancherReleves();
  majCompteurAttente(V.photos.length);
}

function brancherReleves() {
  const ecrire = async (chemin, valeur) => {
    VISITE = await modifierVisite(VISITE.visit_id, v => {
      const parts = chemin.split(".");
      let cible = v;
      for (let i = 0; i < parts.length - 1; i++) {
        const k = parts[i];
        if (cible[k] === null || cible[k] === undefined) cible[k] = {};
        cible = cible[k];
      }
      cible[parts[parts.length - 1]] = valeur;
    }) || VISITE;
  };

  $("vue").querySelectorAll("[data-releve]").forEach(i => {
    i.onchange = async () => {
      const brut = i.value.trim();
      const chemin = i.getAttribute("data-releve");
      /* Les index sont des nombres : conservés en texte, la comparaison
         avec l'index d'entrée se ferait alphabétiquement. */
      let v = brut === "" ? null : brut;
      if (v !== null && /index/.test(chemin)) {
        const n = Number(String(v).replace(",", "."));
        v = isNaN(n) ? null : n;
      }
      await ecrire(chemin, v);
      programmerDepot();
      dessinerReleves();
    };
  });

  $("vue").querySelectorAll("[data-texte]").forEach(t => {
    t.onchange = async () => {
      await ecrire(t.getAttribute("data-texte"), t.value);
      programmerDepot();
    };
  });

  $("vue").querySelectorAll("[data-on]").forEach(b => b.onclick = async () => {
    const chemin = b.getAttribute("data-on");
    await ecrire(chemin, chemin.includes("sonnette") ? "fonctionnelle" : true);
    programmerDepot(); dessinerReleves();
  });
  $("vue").querySelectorAll("[data-off]").forEach(b => b.onclick = async () => {
    const chemin = b.getAttribute("data-off");
    await ecrire(chemin, chemin.includes("sonnette") ? "hors_service" : false);
    programmerDepot(); dessinerReleves();
  });

  $("vue").querySelectorAll("[data-rappel]").forEach(b => b.onclick = async () => {
    const oui = b.getAttribute("data-rappel") === "oui";
    await ecrire("options.rappel_index_entree", oui);
    if (!oui) {
      VISITE = await modifierVisite(VISITE.visit_id, v => {
        delete v.compteurs.electricite.index_entree_rappel;
        delete v.compteurs.eau.index_entree_rappel;
        (v.compteurs.ista || []).forEach(x => { delete x.index_entree_rappel; });
      }) || VISITE;
      E.rappelCharge = false;
      return dessinerReleves("Rappel des index d'entrée désactivé");
    }
    E.rappelCharge = false;
    ecranReleves("Lecture de l'état des lieux d'entrée…");
  });

  $("vue").querySelectorAll("[data-cle-plus]").forEach(b => b.onclick = async () => {
    const k = b.getAttribute("data-cle-plus");
    await ecrire("cles." + k, (VISITE.cles[k] || 0) + 1);
    dessinerReleves();
  });
  $("vue").querySelectorAll("[data-cle-moins]").forEach(b => b.onclick = async () => {
    const k = b.getAttribute("data-cle-moins");
    const n = VISITE.cles[k];
    await ecrire("cles." + k, (n === null || n === undefined || n <= 1) ? null : n - 1);
    dessinerReleves();
  });

  $("vue").querySelectorAll("[data-ajout]").forEach(b => b.onclick = async () => {
    await ecrire("compteurs." + b.getAttribute("data-ajout"),
                 { numero: null, index: null, photo_id: null });
    dessinerReleves();
  });

  if ($("btn-ajout-ista")) $("btn-ajout-ista").onclick = async () => {
    VISITE = await modifierVisite(VISITE.visit_id, v => {
      v.compteurs.ista.push({ emplacement: null, numero: null, index_r: null,
                              index_21: null, photo_id: null });
    }) || VISITE;
    dessinerReleves();
  };
  $("vue").querySelectorAll("[data-suppr-ista]").forEach(b => b.onclick = async () => {
    const i = parseInt(b.getAttribute("data-suppr-ista"), 10);
    VISITE = await modifierVisite(VISITE.visit_id, v => { v.compteurs.ista.splice(i, 1); }) || VISITE;
    dessinerReleves();
  });

  const nett = $("vue").querySelector("[data-nettoyage]");
  if (nett) nett.onchange = async () => {
    const val = nett.value.trim();
    VISITE = await modifierVisite(VISITE.visit_id, v => {
      v.chiffrage = v.chiffrage || {};
      v.chiffrage.estimation_nettoyage_heures = val === "" ? null : parseFloat(val.replace(",", "."));
    }) || VISITE;
    programmerDepot();
  };

  $("vue").querySelectorAll("[data-photo-compteur]").forEach(b => b.onclick = () => {
    const r = b.getAttribute("data-photo-compteur");
    const input = $("app-" + r);
    input.onchange = async (ev) => {
      const fichier = ev.target.files && ev.target.files[0];
      if (!fichier) return;
      b.disabled = true; b.textContent = "Enregistrement…";
      try {
        const ancienne = photoCompteur(VISITE, r);
        if (ancienne) await retirerPhoto(VISITE.visit_id, ancienne.photo_id);
        VISITE = (await lireVisite(VISITE.visit_id)) || VISITE;
        const id = await ajouterPhoto(VISITE, r, fichier);
        await ecrire(cheminPhotoCompteur(r), id);
      } catch (e) {
        return dessinerReleves("Photo non enregistrée : " + e.message);
      }
      VISITE = (await lireVisite(VISITE.visit_id)) || VISITE;
      dessinerReleves("Photo du compteur enregistrée");
    };
    input.click();
  });

  $("btn-retour").onclick = async () => {
    await deposerMaintenant(VISITE);
    ecranVisiteReprise(VISITE);
  };
}

function cheminPhotoCompteur(rattachement) {
  if (rattachement === "compteur_electricite") return "compteurs.electricite.photo_id";
  if (rattachement === "compteur_eau") return "compteurs.eau.photo_id";
  const m = rattachement.match(/^compteur_ista_(\d+)$/);
  if (m) return "compteurs.ista." + (parseInt(m[1], 10) - 1) + ".photo_id";
  return "compteurs.divers_photo_id";
}

/* Appelée par la file dès qu'une photo est confirmée par Microsoft.
   Sans cela, l'écran gardait l'état d'avant l'envoi. */
let _redessinPrevu = null;

async function prevenirEcran(visitId) {
  if (!VISITE || VISITE.visit_id !== visitId) return;
  /* Plusieurs photos peuvent être confirmées coup sur coup : on regroupe
     les redessins pour ne pas repeindre l'écran dix fois par seconde. */
  if (_redessinPrevu) clearTimeout(_redessinPrevu);
  _redessinPrevu = setTimeout(async () => {
    _redessinPrevu = null;
    const frais = await lireVisite(visitId);
    if (!frais || !VISITE || VISITE.visit_id !== visitId) return;
    VISITE = frais;
    if (E.ecran === "piece") dessinerPiece();
    else if (E.ecran === "releves") dessinerReleves();
    else if (E.ecran === "visite") ecranVisiteReprise(VISITE);
  }, 250);
}

// --- Mode d'emploi -------------------------------------------------------

/* Comparaison insensible aux accents et à la casse : Julien tapera
   « ebrasement » sur un clavier d'iPhone, en visite, sans accent. */
function sansAccent(s) {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function ecranAide(ouvert) {
  E.ecran = "aide";
  E.aideOuvert = (ouvert === undefined) ? (E.aideOuvert || null) : ouvert;
  titre("Mode d'emploi", "Application EDL — version " + CONFIG.version_app);
  dessinerAide();
  const champ = $("recherche-aide");
  if (champ && E.aideRecherche) { champ.value = E.aideRecherche; }
}

function dessinerAide() {
  const q = sansAccent(E.aideRecherche || "");
  const cherche = q.length >= 2;

  let html = `<div class="bloc">
      <input class="saisie-mail" id="recherche-aide" style="width:100%"
        placeholder="Chercher un mot — ébrasement, réserves, compteur…"
        value="${echapper(E.aideRecherche || "")}">
      <p class="note">${cherche
        ? "Efface pour revoir tout le mode d'emploi."
        : "Tape au moins deux lettres. Les accents ne comptent pas."}</p>
    </div>`;

  // --- glossaire, en tête quand on cherche ---
  const termes = cherche
    ? GLOSSAIRE.filter(x => sansAccent(x.t).includes(q) || sansAccent(x.d).includes(q))
    : [];
  if (cherche && termes.length) {
    html += `<div class="bloc"><h2>${termes.length} terme${
      termes.length > 1 ? "s" : ""}</h2>`;
    termes.forEach(x => {
      html += `<div class="constat">
        <p><strong>${echapper(x.t)}</strong> <span class="gris">— ${echapper(x.g)}</span></p>
        <p class="note">${echapper(x.d)}</p></div>`;
    });
    html += `</div>`;
  }

  // --- sections ---
  const sections = AIDE.map((s, i) => ({ s, i })).filter(({ s }) => {
    if (!cherche) return true;
    const tout = sansAccent(s.titre + " " + s.corps.join(" ") + " " + (s.attention || ""));
    return tout.includes(q);
  });

  if (cherche) {
    html += sections.length
      ? `<div class="bloc"><h2>${sections.length} section${
          sections.length > 1 ? "s" : ""} du mode d'emploi</h2></div>`
      : (termes.length ? "" : `<div class="bloc"><p class="note">Aucun résultat pour
          « ${echapper(E.aideRecherche)} ».</p></div>`);
  } else {
    html += `<div class="bloc"><p class="note">Appuie sur une section pour la déplier.
      Les encadrés orange signalent ce qui ne se rattrape pas.</p></div>`;
  }

  sections.forEach(({ s, i }) => {
    const ouverte = cherche || E.aideOuvert === i;
    html += `<div class="bloc">
      <button class="aide-titre" data-aide="${i}">${echapper(s.titre)}
        <span class="droite">${ouverte ? "−" : "+"}</span></button>
      ${ouverte ? `
        ${s.corps.map(t => `<p class="aide-texte">${echapper(t)}</p>`).join("")}
        ${s.attention
          ? `<div class="avert"><strong>À retenir</strong>${echapper(s.attention)}</div>`
          : ""}` : ""}
    </div>`;
  });

  // --- glossaire complet, en bas, hors recherche ---
  if (!cherche) {
    const familles = [];
    GLOSSAIRE.forEach(x => { if (!familles.includes(x.g)) familles.push(x.g); });
    html += `<div class="bloc">
      <button class="aide-titre" data-aide="glossaire">Glossaire — ${
        GLOSSAIRE.length} termes employés par l'IA
        <span class="droite">${E.aideOuvert === "glossaire" ? "−" : "+"}</span></button>
      ${E.aideOuvert === "glossaire" ? familles.map(f => `
        <p class="aide-texte"><strong>${echapper(f)}</strong></p>
        ${GLOSSAIRE.filter(x => x.g === f).map(x =>
          `<p class="note"><strong>${echapper(x.t)}</strong> — ${echapper(x.d)}</p>`).join("")}
      `).join("") : ""}
    </div>`;
  }

  /* Aide-mémoire des obligations du locataire. Réservé à l'opérateur :
     un tableau non exhaustif brandi devant un preneur se retourne. */
  if (!cherche && typeof OBLIGATIONS !== "undefined") {
    html += `<div class="bloc">
      <button class="aide-titre" data-aide="obligations">Obligations du locataire — ${
        OBLIGATIONS.length} postes
        <span class="droite">${E.aideOuvert === "obligations" ? "−" : "+"}</span></button>
      ${E.aideOuvert === "obligations" ? `
        <div class="avert"><strong>Pour toi, pas pour le locataire</strong>
          Cette liste sert à savoir quoi regarder et quoi documenter. Elle n'est pas
          exhaustive et ne remplace pas le bail : la brandir pendant une visite se
          retourne facilement.</div>
        ${OBLIGATIONS.map(x =>
          `<p class="note"><strong>${echapper(x.t)}</strong> — ${echapper(x.d)}</p>`).join("")}
      ` : ""}
    </div>`;
  }

  html += `<button class="secondaire" id="btn-retour">Retour à l'accueil</button>`;
  vue(html);

  const champ = $("recherche-aide");
  if (champ) {
    champ.oninput = () => {
      const pos = champ.selectionStart;
      E.aideRecherche = champ.value;
      dessinerAide();
      const neuf = $("recherche-aide");
      if (neuf) { neuf.focus(); try { neuf.setSelectionRange(pos, pos); } catch (_) {} }
    };
  }

  $("vue").querySelectorAll("[data-aide]").forEach(b => b.onclick = () => {
    const v = b.getAttribute("data-aide");
    /* Les sections du mode d'emploi sont numérotées ; le glossaire et les
       obligations sont désignés par leur nom. Sans cette liste, parseInt
       rendait NaN et le bloc ne s'ouvrait jamais. */
    const i = (v === "glossaire" || v === "obligations") ? v : parseInt(v, 10);
    E.aideOuvert = (E.aideOuvert === i) ? null : i;
    dessinerAide();
  });
  $("btn-retour").onclick = () => { E.aideRecherche = ""; ecranAccueil(); };
}

// --- Fin de visite : rapport Word et courriel ----------------------------

function ecranFinVisite(visite, message) {
  E.ecran = "fin_visite";
  const V = visite;
  const destinataires = ((V.parties && V.parties.preneurs) || [])
    .map(x => x.email).filter(Boolean);
  /* Le rapport Word n'a plus d'objet : les corrections se font AVANT
     signature, sur l'écran de lecture. Le scénario Make se limite donc
     à l'envoi du procès-verbal signé. */
  if (E.finRapport === undefined) E.finRapport = false;
  if (E.finCourriel === undefined) E.finCourriel = destinataires.length > 0;
  /* Le lien ne porte plus que sur le sous-dossier Photos. */
  if (E.finLien === undefined) E.finLien = destinataires.length > 0;

  titre("Rapport et courriel", V.bien.unite_source);

  const inter = (cle, libelle, valeur, desactive) =>
    `<div class="interrupteur"><span>${libelle}</span><span class="segments">
      <button class="seg${valeur ? " actif" : ""}" data-fin-oui="${cle}"${
        desactive ? " disabled" : ""}>oui</button>
      <button class="seg${valeur ? "" : " actif"}" data-fin-non="${cle}">non</button>
    </span></div>`;

  vue(`${message || ""}
    <div class="bloc"><h2>Ce qui sera fait</h2>
      ${inter("courriel", "Courriel au locataire, procès-verbal signé joint",
              E.finCourriel, destinataires.length === 0)}
      ${inter("lien", "Lien vers les photographies, en lecture seule", E.finLien)}
      ${inter("rapport", "Rapport Word (nécessite un modèle dans Make)", E.finRapport)}
      <p class="note">L'envoi du procès-verbal le jour même établit que le
      locataire en a reçu copie : cela fait partie de la preuve.</p>
            <p class="note">Le lien porte uniquement sur le sous-dossier
      <code>Photos</code> de cette visite, en lecture seule. Ni le fichier de
      données, ni le procès-verbal, ni le bail, ni les autres locataires.</p>
      <p class="note">Le document signé est déjà déposé dans OneDrive.
      Un échec d'envoi ne remet rien en cause.</p>
    </div>

    <div class="bloc"><h2>Destinataires</h2>
      ${destinataires.length
        ? destinataires.map(e => `<div class="ligne"><span>${echapper(e)}</span>
            <span class="val ok">renseigné</span></div>`).join("")
        : `<p class="note ko">Aucune adresse électronique n'a été saisie à la
           signature. Le courriel ne peut pas partir.</p>`}
    </div>

    <div class="bloc"><h2>Mot d'accompagnement</h2>
      <textarea id="msg-fin" rows="3"
        placeholder="Facultatif — ajouté au courriel">${echapper(E.finMessage || "")}</textarea>
    </div>

    <button id="btn-lancer-fin">Envoyer</button>
    <button class="secondaire" id="btn-retour">Retour à l'accueil</button>
    <div id="resultat-fin"></div>`);

  $("vue").querySelectorAll("[data-fin-oui]").forEach(b => b.onclick = () => {
    const k = b.getAttribute("data-fin-oui");
    if (k === "rapport") E.finRapport = true;
    else if (k === "lien") E.finLien = true;
    else E.finCourriel = true;
    ecranFinVisite(visite);
  });
  $("vue").querySelectorAll("[data-fin-non]").forEach(b => b.onclick = () => {
    const k = b.getAttribute("data-fin-non");
    if (k === "rapport") E.finRapport = false;
    else if (k === "lien") E.finLien = false;
    else E.finCourriel = false;
    ecranFinVisite(visite);
  });

  $("btn-lancer-fin").onclick = async () => {
    E.finMessage = $("msg-fin").value;
    if (!E.finRapport && !E.finCourriel) {
      return afficherFin(`<div class="avert">Rien n'est sélectionné.</div>`);
    }
    if (E.finCourriel && !(await confirmer(
        "Envoyer le courriel au locataire ?",
        "Il partira à : " + destinataires.join(", ") +
        ". Cet envoi ne peut pas être rappelé.", "Oui, envoyer"))) return;

    const b = $("btn-lancer-fin");
    b.disabled = true; b.textContent = "Envoi en cours…";
    try {
      const reponse = await envoyerFinVisite(V,
        { rapport: E.finRapport, courriel: E.finCourriel,
          lien: E.finLien, message: E.finMessage });
      VISITE = await modifierVisite(V.visit_id, v => {
        v.preuve = v.preuve || {};
        v.preuve.execution_make_id = String(reponse).slice(0, 120);
        v.preuve.courriel_envoye = E.finCourriel === true;
        v.preuve.rapport_demande = E.finRapport === true;
        v.preuve.fin_visite_le = new Date().toISOString();
      }) || VISITE;
      afficherFin(`<div class="succes">Envoi accepté par le scénario</div>
        <div class="bloc"><p class="note">${echapper(reponse)}</p>
        <p class="note">Vérifie dans tes messages envoyés que le courriel est parti,
        avec le procès-verbal en pièce jointe.</p></div>
        <button id="btn-fin-accueil">Retour à l'accueil</button>`);
      const ba = $("btn-fin-accueil");
      if (ba) ba.onclick = () => ecranAccueil();
      b.textContent = "Renvoyer";
    } catch (e) {
      afficherFin(`<div class="erreur"><strong>Envoi non abouti</strong>${
        echapper(e.message)}</div>
        <div class="bloc"><p class="note">Le procès-verbal signé reste déposé dans
        OneDrive : rien n'est perdu. Tu peux réessayer, ou envoyer le document
        à la main depuis OneDrive.</p></div>
        <button class="secondaire" id="btn-fin-accueil">Retour à l'accueil</button>`);
      const be = $("btn-fin-accueil");
      if (be) be.onclick = () => ecranAccueil();
    }
    b.disabled = false;
  };

  $("btn-retour").onclick = () => ecranAccueil();
}

function afficherFin(html) {
  const z = $("resultat-fin");
  if (z) z.innerHTML = html;
}

/* Réglage du second scénario Make, depuis l'accueil. */
function ecranReglageFin(message) {
  E.ecran = "reglage_fin";
  titre("Rapport et courriel", finVisiteDisponible() ? "Scénario configuré" : "Non configuré");

  vue(`${message || ""}
    <div class="bloc"><h2>À quoi cela sert</h2>
      <p class="note">Après la signature, un second scénario Make produit le
      rapport Word et envoie le procès-verbal au locataire. Le procès-verbal
      signé, lui, est déposé par l'application elle-même : ce scénario n'est
      jamais indispensable.</p>
    </div>

    <div class="bloc"><h2>Adresse du scénario</h2>
      <p class="note">Scénario <strong>EDL-FIN-VISITE</strong>.</p>
      <textarea id="url-fin" rows="2"
        placeholder="https://hook.eu1.make.com/…">${echapper(adresseFinVisite())}</textarea>
      <button class="mini" id="btn-garder-fin">Enregistrer cette adresse</button>
    </div>

    <div class="bloc"><h2>Apprendre la structure à Make</h2>
      <p class="note">Dans Make : ouvre le scénario, clique le webhook, puis
      <strong>« Redetermine data structure »</strong>. Reviens ici et appuie
      ci-dessous : les champs apparaîtront dans Make.</p>
      <button class="mini" id="btn-echantillon-fin">Envoyer un échantillon</button>
    </div>

    <div id="resultat-fin"></div>
    <button class="secondaire" id="btn-retour">Retour à l'accueil</button>`);

  $("btn-garder-fin").onclick = () => {
    const url = $("url-fin").value.trim();
    if (!url) return afficherFin(`<div class="erreur">Le champ est vide.</div>`);
    enregistrerAdresseFinVisite(url);
    afficherFin(`<div class="succes">Adresse enregistrée sur cet appareil</div>`);
    titre("Rapport et courriel", "Scénario configuré");
  };

  $("btn-echantillon-fin").onclick = async () => {
    const url = $("url-fin").value.trim();
    if (!url) return afficherFin(`<div class="erreur">Colle d'abord l'adresse.</div>`);
    const b = $("btn-echantillon-fin"); b.disabled = true; b.textContent = "Envoi…";
    try {
      const r = await envoyerEchantillonFinVisite(url);
      afficherFin(`<div class="succes">Échantillon envoyé — réponse ${r.statut}</div>
        <div class="bloc"><p class="note">${echapper(r.corps || "(vide)")}</p>
        <p class="note">Les champs doivent maintenant apparaître dans le webhook.</p></div>`);
    } catch (e) {
      afficherFin(`<div class="erreur"><strong>Échec</strong>${echapper(e.message)}</div>`);
    }
    b.disabled = false; b.textContent = "Envoyer un échantillon";
  };

  $("btn-retour").onclick = () => ecranAccueil();
}

// --- Réglage et essai du relais IA ---------------------------------------

function ecranIA(message) {
  E.ecran = "ia";
  titre("Description par IA", iaDisponible() ? "Relais configuré" : "Relais non configuré");

  vue(`${message || ""}
    <div class="bloc"><h2>À quoi cela sert</h2>
      <p class="note">Sous chaque photo déjà enregistrée, un bouton « décrire » propose
      deux ou trois phrases factuelles. Tu les relis, tu les corriges, puis tu les
      enregistres comme constatation. Rien n'est automatique.</p>
      <p class="note">L'appréciation de l'usure normale et de la responsabilité
      reste la tienne : elle n'est jamais demandée à l'IA.</p>
    </div>

    <div class="bloc"><h2>Adresse du relais Make</h2>
      <p class="note">Scénario <strong>EDL-IA-PHOTO</strong>. La clé Gemini reste
      chez Make, jamais dans l'application.</p>
      <textarea id="url-ia" rows="2"
        placeholder="https://hook.eu1.make.com/…">${echapper(adresseRelais())}</textarea>
      <button class="mini" id="btn-garder">Enregistrer cette adresse</button>
      <p class="note">Elle est conservée sur cet appareil. Le fichier
      <code>config.js</code> ne sert que de valeur de repli.</p>
    </div>

    <div class="bloc"><h2>1. Apprendre la structure à Make</h2>
      <p class="note">Dans Make : ouvre le scénario, clique sur le webhook,
      puis sur <strong>« Redetermine data structure »</strong>. Make se met en attente.
      Reviens ici et appuie sur le bouton ci-dessous : Make verra les champs
      et pourra les proposer dans les modules suivants.</p>
      <button class="mini" id="btn-echantillon">Envoyer un échantillon à Make</button>
    </div>

    <div class="bloc"><h2>1 bis. Structure du GROUPE et de la REFORMULATION</h2>
      <p class="note">Ces deux appels n'envoient pas les mêmes champs que la
      description d'une photographie seule. Make ne peut pas les deviner :
      mets-le en attente avec <strong>« Redetermine data structure »</strong>,
      puis appuie sur le bouton correspondant.</p>
      <button class="mini" id="btn-ech-groupe">Envoyer un échantillon groupé</button>
      <button class="mini" id="btn-ech-reformulation">Envoyer un échantillon de reformulation</button>
      <p class="note">L'échantillon groupé porte cinq photographies. Si tu comptes
      en cocher davantage, refais-le avec le nombre maximum que tu utiliseras :
      Make n'affiche que les champs qu'il a vus passer.</p>
    </div>

    <div class="bloc"><h2>2. Essai réel</h2>
      <p class="note">Le scénario doit être activé et contenir un module
      <strong>« Webhook response »</strong> renvoyant l'en-tête
      <code>Access-Control-Allow-Origin</code>. Sans lui, l'appel part
      mais la réponse est refusée au navigateur.</p>
      <button class="mini" id="btn-essai">Essayer sur une photo d'exemple</button>
    </div>

    <div id="resultat-ia"></div>
    <button class="secondaire" id="btn-retour">Retour à l'accueil</button>`);

  $("btn-garder").onclick = () => {
    const url = $("url-ia").value.trim();
    if (!url) return afficherIA(`<div class="erreur">Le champ est vide.</div>`);
    const ok = enregistrerAdresseRelais(url);
    afficherIA(ok
      ? `<div class="succes">Adresse enregistrée sur cet appareil</div>
         <div class="bloc"><p class="note">Le bouton « décrire » est maintenant actif
         sous chaque photo déjà enregistrée dans OneDrive.</p></div>`
      : `<div class="erreur">Enregistrement refusé par le navigateur.</div>`);
    titre("Description par IA", iaDisponible() ? "Relais configuré" : "Relais non configuré");
  };

  $("btn-echantillon").onclick = async () => {
    const url = $("url-ia").value.trim();
    if (!url) return afficherIA(`<div class="erreur">Colle d'abord l'adresse du webhook.</div>`);
    const b = $("btn-echantillon"); b.disabled = true; b.textContent = "Envoi…";
    try {
      const r = await envoyerEchantillonIA(url);
      afficherIA(`<div class="succes">Échantillon envoyé — réponse ${r.statut}</div>
        <div class="bloc"><h2>Réponse de Make</h2>
        <p class="note">${echapper(r.corps || "(vide)")}</p>
        <p class="note">Retourne dans Make : les champs doivent maintenant apparaître
        dans le webhook. Une réponse « Accepted » signifie que le scénario a reçu
        les données mais ne renvoie rien — c'est normal à cette étape.</p></div>`);
    } catch (e) {
      afficherIA(`<div class="erreur"><strong>Échec</strong>${echapper(e.message)}</div>`);
    }
    b.disabled = false; b.textContent = "Envoyer un échantillon à Make";
  };

  const echantillon = async (idBouton, libelle, envoi) => {
    const b = $(idBouton);
    if (!b) return;
    b.onclick = async () => {
      const url = $("url-ia").value.trim();
      if (!url) return afficherIA(`<div class="erreur">Colle d'abord l'adresse du webhook.</div>`);
      b.disabled = true; b.textContent = "Envoi…";
      try {
        const r = await envoi(url);
        afficherIA(`<div class="succes">Échantillon envoyé — réponse ${r.statut}</div>
          <div class="bloc"><h2>${echapper(libelle)}</h2>
          <p class="note">${r.champs} champs transmis.</p>
          <p class="note">${echapper(r.corps || "(vide)")}</p>
          <p class="note">Retourne dans Make : les champs doivent maintenant
          apparaître dans le webhook.</p></div>`);
      } catch (e) {
        afficherIA(`<div class="erreur"><strong>Échec</strong>${echapper(e.message)}</div>`);
      }
      b.disabled = false; b.textContent = libelle;
    };
  };
  echantillon("btn-ech-groupe", "Envoyer un échantillon groupé",
              (u) => envoyerEchantillonGroupe(u, 5));
  echantillon("btn-ech-reformulation", "Envoyer un échantillon de reformulation",
              (u) => envoyerEchantillonReformulation(u));

  $("btn-essai").onclick = async () => {
    const url = $("url-ia").value.trim();
    if (!url) return afficherIA(`<div class="erreur">Colle d'abord l'adresse du webhook.</div>`);
    const b = $("btn-essai"); b.disabled = true; b.textContent = "Appel en cours…";
    enregistrerAdresseRelais(url);
    try {
      const texte = await appelerRelaisIA({
        action: "decrire", item_id: "ECHANTILLON", drive_id: "",
        modele: CONFIG.ia.modele, piece: "Séjour", type: "EDLE",
        consigne: "Réponds simplement : essai réussi.",
        visit_id: "v_essai", photo_id: "ph_essai",
      });
      afficherIA(`<div class="succes">Le relais a répondu</div>
        <div class="bloc"><h2>Texte reçu</h2>
          <p class="note">${echapper(nettoyerReponseIA(texte) || texte || "(vide)")}</p></div>`);
    } catch (e) {
      afficherIA(`<div class="erreur"><strong>Échec</strong>${echapper(e.message)}</div>
        <div class="bloc"><h2>Points à vérifier dans Make</h2>
          <p class="note">— le scénario est-il activé ?<br>
          — contient-il un module « Webhook response » en fin de parcours ?<br>
          — ce module renvoie-t-il l'en-tête Access-Control-Allow-Origin ?<br>
          — le webhook est-il réglé sur un traitement immédiat, sans file d'attente ?</p></div>`);
    }
    b.disabled = false; b.textContent = "Essayer sur une photo d'exemple";
  };

  $("btn-retour").onclick = () => ecranAccueil();
}

function afficherIA(html) {
  const z = $("resultat-ia");
  if (z) z.innerHTML = html;
}

// --- Comparaison entrée / sortie -----------------------------------------

async function ecranComparaisonEDL(message) {
  E.ecran = "comparaison_edl";
  VISITE = (await lireVisite(VISITE.visit_id)) || VISITE;
  const V = VISITE;
  titre("Comparaison entrée / sortie", V.bien.unite_source);

  const dejaFaite = V.comparaison && V.comparaison.lignes && V.comparaison.lignes.length;
  if (!dejaFaite) return ecranComparaisonAvant(message);
  dessinerComparaisonEDL(message);
}

/* Premier écran : on rappelle pourquoi l'entrée est restée fermée. */
function ecranComparaisonAvant(message) {
  const V = VISITE;
  const constats = V.pieces.reduce((n, p) => n + p.constatations.length, 0);

  vue(`${message ? `<div class="succes">${echapper(message)}</div>` : ""}
    <div class="bloc"><h2>Avant de comparer</h2>
      <p class="note">L'état des lieux d'entrée est resté fermé pendant ta visite,
      volontairement : rédiger en l'ayant sous les yeux conduit à recopier, et un
      constat de sortie qui ressemble à une copie de l'entrée perd sa valeur.</p>
      <p class="note">Tu as rédigé ${constats} constatation${constats > 1 ? "s" : ""}.
      Tu pourras encore les corriger après la comparaison.</p>
    </div>
    <button id="btn-lancer">Ouvrir l'état des lieux d'entrée</button>
    <button class="secondaire" id="btn-retour">Retour aux pièces</button>`);

  $("btn-lancer").onclick = () => lancerComparaison();
  $("btn-retour").onclick = () => ecranVisiteReprise(VISITE);
}

async function lancerComparaison() {
  vue(`<p class="note">Lecture de l'état des lieux d'entrée…</p>`);
  const r = await chargerEtatDesLieuxEntree(VISITE);

  if (r.statut === "complet") {
    const lignes = construireLignesComparaison(VISITE, r.edle);
    lignes.forEach(l => { l.suggestion = suggererCategorie(l); });
    VISITE = await modifierVisite(VISITE.visit_id, v => {
      v.comparaison = v.comparaison || {};
      v.comparaison.edle_visit_id = r.edle.visit_id;
      v.comparaison.edle_date = r.edle.date_debut;
      v.comparaison.source = r.nom_fichier;
      v.comparaison.lignes = lignes;
    }) || VISITE;
    return dessinerComparaisonEDL(lignes.length + " écart(s) à classer");
  }

  // aucun fichier de données : entrée antérieure à l'application
  let html = "";
  if (r.statut === "ancien_document") {
    html = `<div class="avert"><strong>Comparaison automatique impossible</strong>
        L'état des lieux d'entrée a été fait avant l'application : il n'existe
        que sous forme de document. Ouvre-le et compare à l'œil.</div>
      <div class="bloc"><h2>Document d'entrée</h2>
        ${r.documents.map(d => `<div class="ligne">
          <span>${echapper(d.nom)}</span>
          <span class="val">${d.modifie_le
            ? new Date(d.modifie_le).toLocaleDateString("fr-BE") : ""}</span></div>
          ${d.url ? `<p class="note"><a href="${echapper(d.url)}" target="_blank">
            Ouvrir dans OneDrive</a></p>` : ""}`).join("")}
        ${r.photos ? `<p class="note">${r.photos} photographie(s) dans le dossier d'entrée.</p>` : ""}
      </div>`;
  } else if (r.statut === "vide") {
    html = `<div class="avert"><strong>Dossier d'entrée vide</strong>
      Aucun état des lieux d'entrée n'a été trouvé. La comparaison n'est pas possible.</div>`;
  } else if (r.statut === "dossier_introuvable") {
    html = `<div class="avert"><strong>Dossier EDLE introuvable</strong>
      Le dossier d'entrée n'existe pas à côté du dossier de sortie.</div>`;
  } else {
    html = `<div class="erreur"><strong>Lecture impossible</strong>${
      echapper(r.message || "erreur inconnue")}</div>`;
  }

  vue(html + `<button class="secondaire" id="btn-retour">Retour aux pièces</button>`);
  $("btn-retour").onclick = () => ecranVisiteReprise(VISITE);
}

function dessinerComparaisonEDL(message) {
  const V = VISITE;
  const comp = V.comparaison || {};
  const lignes = comp.lignes || [];
  const n = compterParCategorie(comp);
  const chiffre = V.options && V.options.chiffrage_actif;

  titre("Comparaison entrée / sortie", V.bien.unite_source);

  let html = `${message ? `<div class="succes">${echapper(message)}</div>` : ""}
    <div class="bloc"><h2>Bilan</h2>
      <div class="ligne"><span>État des lieux d'entrée</span><span class="val">${
        comp.edle_date ? new Date(comp.edle_date).toLocaleDateString("fr-BE") : "—"}</span></div>
      <div class="ligne"><span>Déjà présent à l'entrée</span><span class="val gris">${n.deja_present}</span></div>
      <div class="ligne"><span>Aggravé</span><span class="val attention">${n.aggrave}</span></div>
      <div class="ligne"><span>Nouveau</span><span class="val ko">${n.nouveau}</span></div>
      <div class="ligne"><span>Non classé</span><span class="val ${
        n.non_classe ? "ko" : "ok"}">${n.non_classe}</span></div>
      <p class="note">Le classement t'appartient : l'application rapproche les textes,
      elle ne juge pas ce qui relève de l'usure normale.</p>
    </div>`;

  const parPiece = {};
  lignes.forEach((l, i) => { (parPiece[l.piece] = parPiece[l.piece] || []).push({ l, i }); });

  Object.keys(parPiece).forEach(piece => {
    html += `<div class="bloc"><h2>${echapper(piece)}</h2>`;
    parPiece[piece].forEach(({ l, i }) => {
      html += `<div class="comp ${l.categorie ? "" : "comp-alerte"}">
        ${l.general ? `<p class="note"><strong>État général de la pièce</strong></p>` : ""}
        ${!l.general && !l.rapproche && l.texte_entree && !l.texte_sortie
          ? `<p class="note attention">Plus signalé à la sortie</p>` : ""}
        ${!l.general && !l.rapproche && !l.texte_entree && l.texte_sortie
          ? `<p class="note attention">Sans équivalent à l'entrée</p>` : ""}
        ${!l.general && !l.rapproche && l.texte_entree && l.texte_sortie
          ? `<p class="note attention">Aucun rapprochement automatique — vérifie</p>` : ""}
        <p class="note"><strong>À l'entrée :</strong> ${
          echapper(l.texte_entree || "rien de signalé")}</p>
        <p class="note"><strong>À la sortie :</strong> ${
          echapper(l.texte_sortie || "rien de signalé")}</p>
        ${l.piece_absente_entree
          ? `<p class="note attention">Cette pièce n'existait pas dans l'état des lieux d'entrée.</p>`
          : ""}
        <div class="segments">${CATEGORIES.map(c =>
          `<button class="seg${l.categorie === c.cle ? " actif" : ""}"
             data-cat="${i}:${c.cle}">${c.libelle}</button>`).join("")}</div>
        ${l.suggestion && !l.categorie
          ? `<p class="note">Suggestion : ${echapper(
              (CATEGORIES.find(c => c.cle === l.suggestion) || {}).libelle || "")}
             — à confirmer.</p>` : ""}
        ${chiffre && (l.categorie === "aggrave" || l.categorie === "nouveau")
          ? `<div class="ligne"><span>Montant retenu</span>
             <input class="saisie-index" inputmode="decimal" data-montant="${i}"
               value="${l.montant === null || l.montant === undefined ? "" : l.montant}"></div>`
          : ""}
      </div>`;
    });
    html += `</div>`;
  });

  if (chiffre) {
    const t = totaliserComparaison(comp, V.chiffrage);
    html += `<div class="bloc"><h2>Montants</h2>
      <div class="ligne"><span>Dégâts retenus</span><span class="val">${
        t.total_degats.toFixed(2).replace(".", ",")} €</span></div>
      <div class="ligne"><span>Nettoyage</span>
        <input class="saisie-index" inputmode="decimal" data-cout="nettoyage"
          value="${(V.chiffrage || {}).cout_nettoyage ?? ""}"></div>
      <div class="ligne"><span>Chômage locatif</span>
        <input class="saisie-index" inputmode="decimal" data-cout="chomage"
          value="${(V.chiffrage || {}).chomage_locatif ?? ""}"></div>
      <div class="ligne"><span><strong>Total TVAC</strong></span>
        <span class="val"><strong>${t.total_tvac.toFixed(2).replace(".", ",")} €</strong></span></div>
      <p class="note">Seuls « aggravé » et « nouveau » sont comptés.</p>
    </div>`;
  }

  html += `<button class="secondaire" id="btn-refaire">Refaire la comparaison</button>
    <button class="secondaire" id="btn-retour">Retour aux pièces</button>`;
  vue(html);

  $("vue").querySelectorAll("[data-cat]").forEach(b => b.onclick = async () => {
    const [i, cle] = b.getAttribute("data-cat").split(":");
    const rang = parseInt(i, 10);
    VISITE = await modifierVisite(VISITE.visit_id, v => {
      const l = v.comparaison.lignes[rang];
      l.categorie = (l.categorie === cle) ? null : cle;
      if (l.categorie !== "aggrave" && l.categorie !== "nouveau") l.montant = null;
    }) || VISITE;
    programmerDepot();
    dessinerComparaisonEDL();
  });

  $("vue").querySelectorAll("[data-montant]").forEach(inp => inp.onchange = async () => {
    const rang = parseInt(inp.getAttribute("data-montant"), 10);
    const val = inp.value.trim().replace(",", ".");
    VISITE = await modifierVisite(VISITE.visit_id, v => {
      v.comparaison.lignes[rang].montant = val === "" ? null : Number(val);
    }) || VISITE;
    await recalculerChiffrage();
    programmerDepot();
    dessinerComparaisonEDL();
  });

  $("vue").querySelectorAll("[data-cout]").forEach(inp => inp.onchange = async () => {
    const quoi = inp.getAttribute("data-cout");
    const val = inp.value.trim().replace(",", ".");
    VISITE = await modifierVisite(VISITE.visit_id, v => {
      v.chiffrage = v.chiffrage || {};
      v.chiffrage[quoi === "nettoyage" ? "cout_nettoyage" : "chomage_locatif"] =
        val === "" ? null : Number(val);
    }) || VISITE;
    await recalculerChiffrage();
    programmerDepot();
    dessinerComparaisonEDL();
  });

  $("btn-refaire").onclick = () => lancerComparaison();
  $("btn-retour").onclick = async () => {
    await deposerMaintenant(VISITE);
    ecranVisiteReprise(VISITE);
  };
}

async function recalculerChiffrage() {
  const t = totaliserComparaison(VISITE.comparaison, VISITE.chiffrage);
  VISITE = await modifierVisite(VISITE.visit_id, v => {
    v.chiffrage = v.chiffrage || {};
    v.chiffrage.total_degats = t.total_degats;
    v.chiffrage.total_tvac = t.total_tvac;
  }) || VISITE;
}

// --- Clôture : identité, lecture, signatures, PDF ------------------------

async function ecranCloture(visite) {
  E.ecran = "cloture";
  VISITE = (await lireVisite(visite.visit_id)) || visite;
  const V = VISITE;
  /* Seules les photos de CETTE visite bloquent sa clôture : une autre
     visite ouverte en parallèle ne doit pas l'empêcher de signer. */
  const attente = await nombreEnAttente(V.visit_id);
  const constats = V.pieces.reduce((n, p) => n + p.constatations.length, 0);
  const piecesVides = V.pieces.filter(p =>
    p.constatations.length === 0 && !V.photos.some(ph => ph.rattachement === p.piece_id));

  titre("Terminer la visite", V.bien.unite_source);

  let html = `<div class="bloc"><h2>Récapitulatif</h2>
    <div class="ligne"><span>Type</span><span class="val">${V.type}</span></div>
    <div class="ligne"><span>Locataire</span><span class="val">${
      echapper(V.bien.dossier_locataire_onedrive)}</span></div>
    <div class="ligne"><span>Photos</span><span class="val">${V.photos.length}</span></div>
    <div class="ligne"><span>Constatations</span><span class="val">${constats}</span></div>
    <div class="ligne"><span>Photos en attente d'envoi</span><span class="val ${
      attente ? "ko" : "ok"}">${attente}</span></div>
    </div>`;

  if (piecesVides.length) {
    html += `<div class="avert"><strong>${piecesVides.length} pièce${
      piecesVides.length > 1 ? "s" : ""} sans photo ni constatation</strong>
      ${piecesVides.map(p => echapper(p.libelle)).join(", ")}</div>`;
  }

  /* Photographies définitivement refusées : elles figureront au document
     comme non transmises. Julien peut encore les reprendre s'il en a le
     temps — rien ne bloque. */
  const echouees = V.photos.filter(p => p.statut_transfert === "echec");
  if (echouees.length) {
    html += `<div class="avert"><strong>${echouees.length} photographie(s) refusée(s)
      par Microsoft</strong>
      ${echouees.map(p => echapper(p.nom_fichier)).join("<br>")}<br><br>
      Elles ne seront pas dans le dossier consultable par le locataire. Le
      procès-verbal le dira expressément, avec leur empreinte. Si tu as le temps,
      reprends-les depuis l'écran de la pièce : retire la photographie et
      refais-la.</div>`;
  }

  const conseils = controlerReleves(V);
  const anomalies = controlerProgression(V);
  if (anomalies.length) {
    html += `<div class="avert"><strong>Index à vérifier</strong>${
      anomalies.map(x => echapper(x)).join("<br>")}<br><br>
      Cela n'empêche pas de clôturer.</div>`;
  }
  if (conseils.length) {
    html += `<div class="avert"><strong>Relevés non renseignés</strong>
      ${conseils.map(m => echapper(m)).join(", ")}.<br>
      Tu peux clôturer malgré tout.</div>`;
  }

  /* La signature n'est plus bloquée par les photographies restées en file.
     Ce qui fait preuve, c'est l'horodatage et l'empreinte de chaque
     photographie, calculés sur l'appareil à la prise de vue et inscrits au
     procès-verbal signé — pas la date de dépôt chez Microsoft. Le document
     porte alors une mention expresse, lue et signée par les deux parties. */
  if (attente > 0) {
    html += `<div class="avert"><strong>${attente} photographie(s) pas encore déposée(s)</strong>
      Elles sont en sécurité sur le téléphone et partiront dès le retour du réseau.<br><br>
      Le procès-verbal portera une mention expresse : leur date, leur heure et leur
      empreinte y figurent, et sont couvertes par les signatures. Le locataire
      les consultera à l'adresse indiquée au document.</div>`;
    html += await blocEnvoi();
  }
  html += `<button id="btn-identites">Passer à la signature</button>`;
  html += `<button class="secondaire" id="btn-retour">Retour</button>`;
  vue(html);

  if ($("btn-identites")) $("btn-identites").onclick = () => ecranIdentites();
  brancherEnvoi(() => ecranCloture(V));
  $("btn-retour").onclick = () => ecranVisiteReprise(V);
}

// --- Identité des preneurs ----------------------------------------------

function ecranIdentites(message) {
  E.ecran = "identites";
  const V = VISITE;
  titre("Identité des signataires", "Étape 1 sur 3");

  vue(`${message ? `<div class="succes">${echapper(message)}</div>` : ""}
    <div class="bloc"><h2>Vérification</h2>
      <p class="note">Demande la carte d'identité et relève le <strong>numéro de la carte</strong>,
      celui inscrit au recto. <strong>Jamais le numéro de Registre national</strong> :
      sa collecte est interdite au bailleur.</p>
      <p class="note">Aucune photographie de carte d'identité n'est prise ni conservée.</p>
    </div>
    ${(V.parties.preneurs || []).map((x, i) => `<div class="bloc">
      <h2>Preneur ${i + 1}</h2>
      <div class="ligne"><span>Nom</span><span class="val">${echapper(x.nom_complet)}</span></div>
      <div class="ligne"><span>Carte d'identité</span>
        <input class="saisie-carte" inputmode="numeric" maxlength="15"
          placeholder="000-0000000-00" data-carte="${i}"
          value="${echapper(x.numero_carte_identite || "")}"></div>
      <div class="ligne"><span>Courriel</span>
        <input class="saisie-mail" inputmode="email" data-mail="${i}"
          placeholder="pour l'envoi du document"
          value="${echapper(x.email || "")}"></div>
      <div class="interrupteur"><span>Qualité</span><span class="segments">
        ${["Locataire", "Colocataire", "Mandataire"].map(q =>
          `<button class="seg${(x.qualite || "Locataire") === q ? " actif" : ""}"
             data-qualite="${i}:${q}">${q}</button>`).join("")}
      </span></div>
      <div class="interrupteur"><span>Identité vérifiée sur présentation de la carte</span>
        <span class="segments">
          <button class="seg${x.identite_verifiee === true ? " actif" : ""}"
            data-verif-oui="${i}">oui</button>
          <button class="seg${x.identite_verifiee === false ? " actif" : ""}"
            data-verif-non="${i}">non</button>
        </span></div>
    </div>`).join("")}
    ${(V.parties.preneurs || []).length === 0
      ? `<div class="avert"><strong>Aucun preneur enregistré</strong>
         Cette unité était inoccupée dans la liste. Le document sera signé
         par le bailleur seul.</div>` : ""}
    <button id="btn-lecture">Continuer</button>
    <button class="secondaire" id="btn-retour">Retour</button>`);

  const ecrirePreneur = async (i, champ, valeur) => {
    VISITE = await modifierVisite(VISITE.visit_id, v => {
      v.parties.preneurs[i][champ] = valeur;
    }) || VISITE;
  };

  $("vue").querySelectorAll("[data-carte]").forEach(inp => {
    inp.onchange = async () => {
      const i = parseInt(inp.getAttribute("data-carte"), 10);
      /* Un numéro de Registre national commence par la date de naissance
         et compte onze chiffres : on le refuse explicitement. */
      const chiffres = inp.value.replace(/\D/g, "");
      if (chiffres.length === 11) {
        return ecranIdentites("Ce numéro ressemble à un Registre national — " +
          "utilise le numéro de la CARTE, au recto.");
      }
      await ecrirePreneur(i, "numero_carte_identite", inp.value.trim() || null);
    };
  });
  $("vue").querySelectorAll("[data-mail]").forEach(inp => {
    inp.onchange = async () => {
      const i = parseInt(inp.getAttribute("data-mail"), 10);
      await ecrirePreneur(i, "email", inp.value.trim() || null);
    };
  });
  $("vue").querySelectorAll("[data-qualite]").forEach(b => b.onclick = async () => {
    const [i, q] = b.getAttribute("data-qualite").split(":");
    await ecrirePreneur(parseInt(i, 10), "qualite", q);
    ecranIdentites();
  });

  $("vue").querySelectorAll("[data-verif-oui]").forEach(b => b.onclick = async () => {
    await ecrirePreneur(parseInt(b.getAttribute("data-verif-oui"), 10), "identite_verifiee", true);
    ecranIdentites();
  });
  $("vue").querySelectorAll("[data-verif-non]").forEach(b => b.onclick = async () => {
    await ecrirePreneur(parseInt(b.getAttribute("data-verif-non"), 10), "identite_verifiee", false);
    ecranIdentites();
  });

  $("btn-lecture").onclick = () => ecranLecture();
  $("btn-retour").onclick = () => ecranCloture(VISITE);
}

// --- Lecture par le locataire -------------------------------------------

async function ecranLecture() {
  E.ecran = "lecture";
  E.luEtApprouve = false;
  titre("Lecture du document", "Étape 2 sur 3");
  vue(`<p class="note">Préparation du document…</p>`);

  let doc;
  try { doc = await genererPV(VISITE); }
  catch (e) {
    return erreurEcran("Document impossible à préparer : " + e.message,
                       () => ecranIdentites());
  }
  E.apercu = doc;

  const url = noterApercu(URL.createObjectURL(doc.output("blob")));
  vue(`<div class="bloc"><h2>À faire lire au locataire</h2>
      <p class="note">Fais défiler le document en entier avec le locataire.
      Il ne pourra plus être modifié après signature.</p>
      <iframe class="apercu" src="${url}"></iframe>
      <p class="note"><a href="${url}" target="_blank">Ouvrir en plein écran</a></p>
    </div>
    <div class="bloc"><h2>Confirmation de lecture</h2>
      <div class="interrupteur"><span>Le locataire déclare avoir lu le document</span>
        <span class="segments">
          <button class="seg" id="lu-oui">oui</button>
        </span></div>
      <p class="note">La lecture est distincte de la signature. L'écran suivant
      permettra au locataire de faire consigner ses observations et réserves.</p>
    </div>
    <button id="btn-reserves" disabled>Observations et réserves</button>
    <button class="secondaire" id="btn-retour">Retour</button>`);

  $("lu-oui").onclick = () => {
    E.luEtApprouve = !E.luEtApprouve;
    $("lu-oui").className = "seg" + (E.luEtApprouve ? " actif" : "");
    $("btn-reserves").disabled = !E.luEtApprouve;
  };
  $("btn-reserves").onclick = () => ecranReserves();
  $("btn-retour").onclick = () => ecranIdentites();   // vue() libère l'aperçu
}

// --- Observations et réserves du preneur ---------------------------------

/* Le caractère contradictoire de l'état des lieux suppose que le preneur
   ait PU faire consigner son désaccord avant de signer. Sans cet écran,
   un état des lieux contesté serait fragile. */
async function ecranReserves(message) {
  E.ecran = "reserves";
  VISITE = (await lireVisite(VISITE.visit_id)) || VISITE;
  const V = VISITE;
  const reserves = V.reserves || [];
  const auteurs = [{ nom: "Le preneur", cle: "preneur" }]
    .concat((V.parties.preneurs || []).map(x => ({ nom: x.nom_complet, cle: x.nom_complet })));

  if (!E.reserveAuteur) E.reserveAuteur = auteurs[auteurs.length > 1 ? 1 : 0].nom;
  if (E.reserveTexte === undefined) E.reserveTexte = "";
  if (!E.reservePiece) E.reservePiece = "";

  titre("Observations et réserves", "Avant signature");

  vue(`${message ? `<div class="succes">${echapper(message)}</div>` : ""}
    <div class="bloc"><h2>À lire au locataire</h2>
      <p class="note">« Avant de signer, souhaitez-vous faire consigner des
      observations ou des réserves ? Elles figureront dans le document et
      la signature en tiendra compte. »</p>
      <p class="note">S'il n'en a aucune, le document le mentionnera
      expressément. Cette question doit être posée : elle fonde le caractère
      contradictoire de l'état des lieux.</p>
    </div>

    <div class="bloc"><h2>${reserves.length} réserve${reserves.length > 1 ? "s" : ""} consignée${
        reserves.length > 1 ? "s" : ""}</h2>
      ${reserves.length
        ? reserves.map((r, i) => `<div class="constat">
            <p class="note"><strong>${echapper(r.auteur)}</strong>${
              r.piece ? " — " + echapper(r.piece) : ""}</p>
            <p>${echapper(r.texte)}</p>
            <p class="note"><button class="lien" data-suppr-reserve="${i}">retirer</button></p>
          </div>`).join("")
        : `<p class="note">Aucune réserve. Le document indiquera que le preneur,
           invité à en formuler, a déclaré n'en avoir aucune.</p>`}
    </div>

    <div class="bloc"><h2>Ajouter une réserve</h2>
      <div class="ligne"><span>Auteur</span></div>
      <div class="segments">${auteurs.map(x =>
        `<button class="seg${E.reserveAuteur === x.nom ? " actif" : ""}"
           data-auteur="${echapper(x.nom)}">${echapper(x.nom)}</button>`).join("")}</div>
      <div class="ligne" style="margin-top:9px"><span>Pièce concernée</span>
        <input class="saisie-mail" id="res-piece" placeholder="facultatif"
          value="${echapper(E.reservePiece)}"></div>
      <textarea id="res-texte" rows="3"
        placeholder="Ce que le locataire veut faire consigner, dans ses termes.">${
        echapper(E.reserveTexte)}</textarea>
      <button id="btn-ajouter-reserve">Consigner cette réserve</button>
    </div>

    <div class="avert"><strong>Après la signature, plus aucune réserve
      ne pourra être ajoutée</strong>
      Une observation formulée plus tard exigerait un avenant signé des deux parties.</div>

    <button id="btn-vers-signatures">Passer aux signatures</button>
    <button class="secondaire" id="btn-retour">Retour au document</button>`);

  $("vue").querySelectorAll("[data-auteur]").forEach(b => b.onclick = () => {
    E.reserveAuteur = b.getAttribute("data-auteur");
    E.reserveTexte = $("res-texte").value;
    E.reservePiece = $("res-piece").value;
    ecranReserves();
  });

  $("btn-ajouter-reserve").onclick = async () => {
    const texte = $("res-texte").value.trim();
    if (!texte) return ecranReserves("Écris d'abord la réserve.");
    try {
      VISITE = await modifierVisite(VISITE.visit_id, v => {
        v.reserves = v.reserves || [];
        v.reserves.push({
          auteur: E.reserveAuteur,
          piece: $("res-piece").value.trim() || null,
          texte: texte,
          horodatage: new Date().toISOString(),
        });
      }) || VISITE;
    } catch (e) {
      return ecranReserves("Enregistrement impossible : " + e.message);
    }
    E.reserveTexte = ""; E.reservePiece = "";
    programmerDepot();
    ecranReserves("Réserve consignée");
  };

  $("vue").querySelectorAll("[data-suppr-reserve]").forEach(b => b.onclick = async () => {
    const i = parseInt(b.getAttribute("data-suppr-reserve"), 10);
    VISITE = await modifierVisite(VISITE.visit_id, v => { v.reserves.splice(i, 1); }) || VISITE;
    programmerDepot();
    ecranReserves("Réserve retirée");
  });

  $("btn-vers-signatures").onclick = async () => {
    if ((VISITE.reserves || []).length === 0) {
      if (!(await confirmer("Aucune réserve n'a été consignée",
          "Le document indiquera que le preneur, invité à en formuler, a déclaré " +
          "n'en avoir aucune. As-tu bien posé la question ?",
          "Oui, continuer"))) return;
    }
    E.reserveTexte = ""; E.reservePiece = "";
    ecranSignatures();
  };

  $("btn-retour").onclick = () => ecranLecture();
}

// --- Signatures tactiles -------------------------------------------------

function ecranSignatures() {
  E.ecran = "signatures";
  const V = VISITE;
  E.signatures = E.signatures || { bailleur: null, preneurs: [] };
  titre("Signatures", "Étape 3 sur 3");

  const blocs = [{ id: "bailleur", role: "Le bailleur",
                   nom: V.parties.bailleur_represente_par || V.parties.bailleur }];
  (V.parties.preneurs || []).forEach((x, i) =>
    blocs.push({ id: "preneur" + i, role: "Le preneur", nom: x.nom_complet }));

  const nbReserves = (V.reserves || []).length;

  vue(`<div class="bloc"><h2>À lire avant de signer</h2>
      <p class="approuve">LU ET APPROUVÉ</p>
      <p class="note">Chaque signataire confirme avoir participé contradictoirement
      à l'état des lieux, avoir pris connaissance du rapport et des photographies
      qui en font partie, et avoir eu la possibilité de faire consigner ses
      observations et réserves avant sa validation.</p>
      <p class="note">En apposant sa signature, il manifeste sa volonté de valider
      le présent état des lieux${nbReserves
        ? ", sous réserve des " + nbReserves + " observation(s) consignée(s)" : ""}.</p>
    </div>
    <div class="bloc"><h2>Signer du doigt</h2>
      <p class="note">Chaque signataire signe dans son cadre.
      Le bouton « effacer » permet de recommencer.</p></div>
    ${blocs.map(b => `<div class="bloc">
      <h2>${b.role} — ${echapper(b.nom)}</h2>
      <canvas class="signature" id="sig-${b.id}"></canvas>
      <button class="mini secondaire" data-effacer="${b.id}">Effacer</button>
      <span class="val gris" id="etat-${b.id}"> </span>
    </div>`).join("")}
    <div class="avert"><strong>Après signature, le document est figé</strong>
      Il sera déposé dans OneDrive et ne pourra plus être modifié.
      Une correction nécessiterait un avenant signé des deux parties.</div>
    <button id="btn-signer" disabled>Signer et déposer le document</button>
    <button class="secondaire" id="btn-retour">Retour</button>`);

  const pretes = blocs.map(b => brancherSignature(b.id)).filter(Boolean).length;
  if (pretes < blocs.length) {
    avert(`<div class="erreur"><strong>Signature indisponible</strong>
      Le dessin tactile n'est pas accessible sur cet appareil. Réessaie après
      avoir rouvert l'application depuis l'écran d'accueil.</div>`);
  }
  majBoutonSigner(blocs);

  $("vue").querySelectorAll("[data-effacer]").forEach(btn => btn.onclick = () => {
    const id = btn.getAttribute("data-effacer");
    const c = $("sig-" + id);
    c.getContext("2d").clearRect(0, 0, c.width, c.height);
    c.dataset.signe = "";
    $("etat-" + id).textContent = " ";
    majBoutonSigner(blocs);
  });

  $("btn-signer").onclick = () => signerEtDeposer(blocs);
  $("btn-retour").onclick = () => ecranLecture();
}

/* La zone de dessin est créée à trois fois la taille affichée : sinon la
   signature apparaît crénelée dans le PDF. */
function brancherSignature(id) {
  const c = $("sig-" + id);
  if (!c) return false;
  const rect = c.getBoundingClientRect();
  const echelle = 3;
  c.width = Math.max(300, Math.round(rect.width)) * echelle;
  c.height = 110 * echelle;
  const ctx = c.getContext("2d");
  if (!ctx) {
    /* Dessin indisponible : mieux vaut le dire que planter en silence. */
    const zone = $("etat-" + id);
    if (zone) { zone.textContent = "signature impossible sur cet appareil"; zone.className = "val ko"; }
    return false;
  }
  ctx.scale(echelle, echelle);
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#101010";

  let dessine = false;
  const point = (ev) => {
    const r = c.getBoundingClientRect();
    const t = (ev.touches && ev.touches[0]) || ev;
    return { x: (t.clientX - r.left), y: (t.clientY - r.top) };
  };
  const debut = (ev) => { ev.preventDefault(); dessine = true;
    const p = point(ev); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
  const trace = (ev) => { if (!dessine) return; ev.preventDefault();
    const p = point(ev); ctx.lineTo(p.x, p.y); ctx.stroke();
    c.dataset.signe = "1"; };
  const fin = () => { dessine = false;
    if (c.dataset.signe) $("etat-" + id).textContent = "signé";
    majBoutonSigner(); };

  c.addEventListener("touchstart", debut, { passive: false });
  c.addEventListener("touchmove", trace, { passive: false });
  c.addEventListener("touchend", fin);
  c.addEventListener("mousedown", debut);
  c.addEventListener("mousemove", trace);
  c.addEventListener("mouseup", fin);
  c.addEventListener("mouseleave", fin);
  return true;
}

function majBoutonSigner(blocs) {
  const b = $("btn-signer");
  if (!b) return;
  const tous = $("vue").querySelectorAll("canvas.signature");
  let signes = 0;
  tous.forEach(c => { if (c.dataset.signe) signes++; });
  b.disabled = signes < tous.length;
  b.textContent = signes < tous.length
    ? `Signer et déposer (${signes} / ${tous.length} signatures)`
    : "Signer et déposer le document";
}

async function signerEtDeposer(blocs) {
  const b = $("btn-signer");
  b.disabled = true; b.textContent = "Fabrication du document…";

  const signatures = { bailleur: null, preneurs: [] };
  blocs.forEach(x => {
    const c = $("sig-" + x.id);
    const image = c.toDataURL("image/png");
    if (x.id === "bailleur") signatures.bailleur = image;
    else signatures.preneurs.push(image);
  });

  try {
    /* Les images de signature ne sont jamais enregistrées : elles vivent
       dans le PDF, qui est l'acte. On les passe au générateur, puis on
       les oublie. */
    const V = Object.assign({}, VISITE, {
      signatures,
      date_signature: new Date().toISOString(),
      statut: "signee",
    });
    const doc = await genererPV(V);
    const donnees = doc.output("arraybuffer");
    const empreinte = await empreinteSha256(donnees);

    b.textContent = "Dépôt dans OneDrive…";
    const nom = `${V.type}_${V.date_signature.slice(0, 10)}_${
      nettoyerLibelle(V.bien.unite_source)}_${codeCourt(V)}.pdf`;

    /* Le procès-verbal suit la même règle que les photographies : s'il ne
       peut pas être déposé maintenant, il attend dans la file et part au
       bouton « Envoyer ». La signature, elle, ABOUTIT — c'est ce qui a été
       décidé, et sans cela une visite sans réseau ne pouvait pas se
       clôturer alors que le document était fabriqué et l'empreinte
       calculée. */
    let item = null, pvDiffere = false;
    try {
      item = await deposerPdf(V, nom, donnees);
    } catch (e) {
      pvDiffere = true;
      await journaliser("pv_depot_differe", String((e && e.message) || e));
      await mettreDocumentEnFile(VISITE, nom, donnees, "pv", "application/pdf");
    }

    /* Le rapport de comparaison est un document distinct, non signé :
       contester le classement ne doit pas fragiliser le constat. */
    let comparaisonDeposee = null;
    if (V.type === "EDLS" && V.comparaison && (V.comparaison.lignes || []).length) {
      try {
        b.textContent = "Dépôt du rapport de comparaison…";
        const docComp = await genererRapportComparaison(V);
        const donneesComp = docComp.output("arraybuffer");
        const nomComp = `COMPARAISON_${V.date_signature.slice(0, 10)}_${
          nettoyerLibelle(V.bien.unite_source)}_${codeCourt(V)}.pdf`;
        let itemComp = null;
        try {
          itemComp = await deposerPdf(V, nomComp, donneesComp);
        } catch (e) {
          await journaliser("comparaison_depot_differe", String((e && e.message) || e));
          await mettreDocumentEnFile(VISITE, nomComp, donneesComp, "comparaison", "application/pdf");
        }
        comparaisonDeposee = {
          nom: nomComp, id: itemComp ? itemComp.id : null,
          empreinte: await empreinteSha256(donneesComp),
        };
      } catch (e) {
        await journaliser("comparaison_echouee", String(e && e.message));
      }
    }

    VISITE = await modifierVisite(VISITE.visit_id, v => {
      v.statut = "signee";
      v.date_signature = V.date_signature;
      v.preuve = v.preuve || {};
      v.preuve.hash_pdf_pv_sha256 = empreinte;
      v.preuve.pv_onedrive_item_id = item ? item.id : null;
      v.preuve.pv_nom_fichier = nom;
      v.preuve.pv_depot_differe = pvDiffere;
      if (comparaisonDeposee) {
        v.preuve.hash_pdf_comparaison_sha256 = comparaisonDeposee.empreinte;
        v.preuve.comparaison_onedrive_item_id = comparaisonDeposee.id;
        v.preuve.comparaison_nom_fichier = comparaisonDeposee.nom;
      }
      v.preuve.horodatage_local = V.date_signature;
      v.preuve.lu_et_approuve = true;
      v.preuve.nb_reserves = (v.reserves || []).length;
      v.preuve.reserves_proposees = true;
      v.preuve.courriel_destinataires =
        (v.parties.preneurs || []).map(x => x.email).filter(Boolean);
    }) || VISITE;

    await deposerMaintenant(VISITE);
    await journaliser("visite_signee",
      { visit_id: VISITE.visit_id, depot: !!item, differe: pvDiffere });

    vue(`<div class="succes">${pvDiffere
        ? "Document signé — dépôt en attente de réseau"
        : "Document signé et déposé"}</div>
      ${pvDiffere ? `<div class="avert"><strong>Le procès-verbal n'est pas encore
        dans OneDrive</strong> Il est signé, son empreinte est calculée, et il est
        conservé sur le téléphone. Appuie sur « Envoyer » dès que le réseau revient :
        il partira avec les photographies. Rien n'est perdu.</div>` : ""}
      <div class="bloc"><h2>${echapper(nom)}</h2>
        <div class="ligne"><span>Empreinte</span><span class="val" style="font-size:11px">${
          empreinte ? echapper(empreinte.slice(0, 32)) + "…" : "—"}</span></div>
        <div class="ligne"><span>Signé le</span><span class="val">${
          new Date(V.date_signature).toLocaleString("fr-BE")}</span></div>
        <div class="ligne"><span>Signatures</span><span class="val">${blocs.length}</span></div>
      </div>
      ${comparaisonDeposee ? `<div class="bloc"><h2>Rapport de comparaison</h2>
        <p class="note">${echapper(comparaisonDeposee.nom)}</p></div>` : ""}
      ${pvDiffere
        ? await blocEnvoi()
        : (finVisiteDisponible()
          ? `<button id="btn-envoi">Rapport Word et courriel au locataire</button>`
          : `<div class="avert"><strong>À faire maintenant</strong>
               Envoie le PDF au locataire depuis OneDrive, le jour même :
               sa réception fait partie de la preuve.</div>`)}
      <button class="secondaire" id="btn-accueil">Retour à l'accueil</button>`);
    /* Tant que le procès-verbal n'est pas déposé, le courriel au locataire
       n'a pas d'objet : le scénario Make ne trouverait rien à joindre. */
    brancherEnvoi(() => ecranAccueil());
    if ($("btn-envoi")) $("btn-envoi").onclick = () => ecranFinVisite(VISITE);
    $("btn-accueil").onclick = () => ecranAccueil();
  } catch (e) {
    vue(`<div class="erreur"><strong>Signature non aboutie</strong>${echapper(e.message)}<br><br>
        Rien n'est perdu : la visite reste ouverte et tu peux recommencer.</div>
      <button class="secondaire" id="btn-retour">Retour</button>`);
    $("btn-retour").onclick = () => ecranSignatures();
    await journaliser("signature_echouee", String(e && e.message));
  }
}

async function deposerPdf(visite, nom, donnees) {
  const d = visite.bien;
  const chemin = d.dossier_cible_drive_id
    ? `/drives/${d.dossier_cible_drive_id}/items/${d.dossier_cible_item_id}:/${
        encodeURIComponent(nom)}:/content`
    : `/me/drive/items/${d.dossier_cible_item_id}:/${encodeURIComponent(nom)}:/content`;
  const res = await appelGraph(chemin, {
    method: "PUT",
    headers: { "Content-Type": "application/pdf" },
    body: donnees,
  });
  if (!res.ok) throw new Error("Dépôt : " + await detailErreur(res));
  return res.json();
}

// --- Écran d'une pièce ---------------------------------------------------

async function ecranPiece(pieceId) {
  E.ecran = "piece";
  E.piece = pieceId;
  E.brouillons = {}; E.etat = undefined; E.proprete = undefined;
  E.commentaireGeneral = undefined; E.indexEdition = null;
  /* E.photosEntree et E.liensEntree survivent au changement de pièce :
     ils valent pour toute la visite, et les relire coûterait un appel
     Graph par image à chaque fois. */
  viderGroupe();
  VISITE = (await lireVisite(VISITE.visit_id)) || VISITE;
  const piece = VISITE.pieces.find(p => p.piece_id === pieceId);
  titre(piece.libelle, VISITE.bien.unite_source);
  dessinerPiece();
}

/* ---- Description d'un groupe de photographies ---------------------------

   Cocher plusieurs vues, obtenir UN constat d'ensemble, puis le corriger
   autant de fois qu'il le faut avant de le retenir.

   L'état vit dans E, jamais dans le document : l'écran se redessine à
   chaque photographie confirmée par la file, et tout ce qui serait lu
   depuis le DOM se perdrait à ce moment-là. */

function blocGroupe(piece, photos) {
  const coches = (E.groupe || []).filter(id => photos.some(p => p.photo_id === id));
  if (coches.length < 2 && !E.groupeTexte) return "";

  const noms = coches.map(id => {
    const p = photos.find(x => x.photo_id === id);
    const m = String(p.nom_fichier || "").match(/_(\d{3})_/);
    return m ? m[1] : "?";
  });

  if (!E.groupeTexte) {
    /* Avant l'appel : ce que l'expert veut faire regarder. Une phrase dictée
       ici vaut trois corrections ensuite — le modèle ne sait rien du bien. */
    return `<div class="bloc"><h2>${coches.length} photographies cochées</h2>
      <p class="note">Photographies ${noms.join(", ")}${
        coches.length >= GROUPE_MAX_PHOTOS ? " — maximum atteint" : ""}.
      L'IA les regardera ensemble
      et rédigera UN constat, sans répéter ce qui apparaît sur plusieurs vues.</p>
      <textarea id="groupe-avant" rows="2"
        placeholder="Ce qu'il faut regarder (facultatif) — micro du clavier disponible">${
        echapper(E.groupeAvant || "")}</textarea>
      <p class="note">Exemples : « le châssis a été remplacé l'an dernier »,
      « regarde surtout le sol près de la porte », « ignore le mobilier ».</p>
      <button class="decrire" id="btn-groupe">Décrire ces ${coches.length} photos ensemble</button>
      <button class="mini secondaire" id="btn-groupe-vider">Tout décocher</button>
    </div>`;
  }

  /* Après l'appel : le texte, éditable, et les deux voies de correction. */
  const tours = (E.groupeHistorique || []).length;
  return `<div class="bloc"><h2>Constat des photographies ${noms.join(", ")}</h2>
    <textarea id="groupe-texte" rows="7"
      placeholder="Le constat du groupe.">${echapper(E.groupeTexte)}</textarea>
    <p class="note">Relis et corrige directement : le texte final est le tien.</p>

    <textarea id="groupe-instruction" rows="2"
      placeholder="Que faut-il changer ?">${echapper(E.groupeInstruction || "")}</textarea>
    <div class="duo">
      <button class="decrire sobre" id="btn-reformuler">Reformuler</button>
      <button class="decrire" id="btn-revoir">Revoir les photos</button>
    </div>
    ${tours === 0
      ? `<p class="note">Reformuler retravaille le texte. Revoir les photos
         rouvre les images.</p>` : ""}
    ${tours
      ? `<p class="note gris">${tours} correction(s) déjà demandée(s) :
         ${echapper((E.groupeHistorique || []).join(" · "))}</p>` : ""}

    <button id="btn-groupe-ajouter">Ajouter au constat</button>
    <div class="duo">
      <button class="mini secondaire" id="btn-groupe-repartir">Repartir du texte d'origine</button>
      <button class="mini secondaire" id="btn-groupe-abandon">Abandonner ce constat</button>
    </div>
  </div>`;
}

/* ---- Corriger la description d'UNE photographie ------------------------

   Pour un groupe, on dispose de « Reformuler » et « Revoir les photos ».
   Une photographie seule n'avait que le clavier. Le même mécanisme sert
   ici : reformulerTexte accepte une liste, on lui en passe une d'un seul
   élément, et les routes Make existent déjà. */

/* Instructions qui fonctionnent, tirées des essais du 26/08/2026. Le
   modèle obéit quand la demande désigne un objet précis ou donne un
   nombre ; il recopie devant une demande vague. */
var EXEMPLES_CORRECTION = [
  "supprime la phrase sur le sol",
  "trois phrases maximum",
  "développe la description du mur",
  "regroupe les deux dernières phrases",
];

async function ecranCorrigerPhoto(photoId) {
  E.ecran = "corriger";
  const photo = VISITE.photos.find(x => x.photo_id === photoId);
  if (!photo) return dessinerPiece("Photographie introuvable.");
  E.corrige = {
    photo_id: photoId,
    texte: E.corrige && E.corrige.photo_id === photoId
      ? E.corrige.texte
      : (E.brouillons[photoId] !== undefined ? E.brouillons[photoId] : (photo.description || "")),
    instruction: "",
    historique: (E.corrige && E.corrige.photo_id === photoId) ? E.corrige.historique : [],
    origine: (E.corrige && E.corrige.photo_id === photoId) ? E.corrige.origine : null,
  };
  if (!E.corrige.origine) E.corrige.origine = E.corrige.texte;
  const piece = VISITE.pieces.find(p => p.piece_id === E.piece);
  titre("Corriger la description", piece ? piece.libelle : "");
  dessinerCorrection();
}

function dessinerCorrection(message) {
  const C = E.corrige;
  const tours = (C.historique || []).length;
  let html = message ? `<div class="succes">${echapper(message)}</div>` : "";

  html += `<div class="bloc"><h2>Photographie ${numeroDansNom(
      (VISITE.photos.find(x => x.photo_id === C.photo_id) || {}).nom_fichier)}</h2>
    <textarea id="corr-texte" rows="7">${echapper(C.texte)}</textarea>
    <p class="note">Tu peux corriger directement au clavier ou au micro.
    Le texte final est le tien.</p>

    <textarea id="corr-instruction" rows="2"
      placeholder="Que faut-il changer ?">${echapper(C.instruction || "")}</textarea>

    ${tours === 0 ? `<p class="note">Nomme ce qu'il faut changer. « Mieux » ou
      « plus court » ne suffisent pas.</p>
      ${EXEMPLES_CORRECTION.map(x =>
        `<button class="lien" data-exemple="${echapper(x)}">${echapper(x)}</button>`
      ).join(" · ")}` : ""}

    <div class="duo">
      <button class="decrire sobre" id="corr-reformuler">Reformuler</button>
      <button class="decrire" id="corr-revoir">Revoir la photo</button>
    </div>
    ${tours === 0
      ? `<p class="note">Reformuler retravaille le texte. Revoir la photo rouvre
         l'image.</p>` : ""}
    ${tours ? `<p class="note gris">${tours} correction(s) demandée(s) :
      ${echapper((C.historique || []).join(" · "))}</p>` : ""}

    <button id="corr-garder">Garder ce texte</button>
    <div class="duo">
      <button class="mini secondaire" id="corr-origine">Repartir du texte d'origine</button>
      <button class="mini secondaire" id="corr-annuler">Annuler</button>
    </div>
  </div>`;

  vue(html);
  brancherCorrection();
}

function brancherCorrection() {
  const C = E.corrige;
  const t = $("corr-texte");
  if (t) t.oninput = () => { C.texte = t.value; };
  const i = $("corr-instruction");
  if (i) i.oninput = () => { C.instruction = i.value; };

  $("vue").querySelectorAll("[data-exemple]").forEach(b => b.onclick = () => {
    C.instruction = b.getAttribute("data-exemple");
    dessinerCorrection();
  });

  const lancer = async (avecPhoto) => {
    const inst = String(C.instruction || "").trim();
    if (!inst) return dessinerCorrection("Écris d'abord ce qu'il faut changer.");
    if (inst.split(/\s+/).length < 3) {
      return dessinerCorrection("Sois plus précis : nomme ce qu'il faut changer. " +
        "Une demande vague ne change rien au texte.");
    }
    if (!iaDisponible()) return dessinerCorrection("Aucun relais IA enregistré.");
    const photo = VISITE.photos.find(x => x.photo_id === C.photo_id);
    if (avecPhoto && !(await confirmer("Revoir la photographie ?",
        "L'IA rouvre l'image. Cet appel est facturé comme une description complète.",
        "Oui, revoir"))) return;
    const b = $(avecPhoto ? "corr-revoir" : "corr-reformuler");
    b.disabled = true; b.textContent = avecPhoto ? "Relecture…" : "Reformulation…";
    let texte;
    try {
      texte = await reformulerTexte(VISITE, [photo], C.texte, inst,
                                    C.historique || [], avecPhoto);
    } catch (e) {
      return dessinerCorrection("Correction impossible : " + e.message);
    }
    if (/il faut revoir les photographies/i.test(texte)) {
      return dessinerCorrection("L'IA ne peut pas répondre sans revoir l'image. " +
        "Utilise « Revoir la photo ».");
    }
    C.texte = texte;
    C.historique = (C.historique || []).concat([inst]);
    C.instruction = "";
    dessinerCorrection("Texte corrigé — relis-le");
  };
  if ($("corr-reformuler")) $("corr-reformuler").onclick = () => lancer(false);
  if ($("corr-revoir")) $("corr-revoir").onclick = () => lancer(true);

  if ($("corr-origine")) $("corr-origine").onclick = () => {
    C.texte = C.origine; C.historique = []; C.instruction = "";
    dessinerCorrection("Texte d'origine rétabli");
  };

  if ($("corr-garder")) $("corr-garder").onclick = async () => {
    /* ecranPiece REMET LES BROUILLONS À ZÉRO au chargement : il faut donc
       reposer le texte APRÈS son retour, sans quoi la correction est
       perdue au moment même où on la garde. */
    const id = C.photo_id, texte = C.texte;
    E.corrige = null;
    await ecranPiece(E.piece);
    E.brouillons[id] = texte;
    dessinerPiece("Texte corrigé repris — ajoute-le au constat");
  };
  if ($("corr-annuler")) $("corr-annuler").onclick = () => {
    E.corrige = null;
    ecranPiece(E.piece);
  };
}

/* ---- Photographies de l'état des lieux d'entrée -------------------------

   Elles servent de référence à la visée guidée. Les liens de
   téléchargement de Microsoft ne vivent qu'une heure : on garde la LISTE
   pour toute la visite, mais on redemande les liens à chaque ouverture.

   Rien du TEXTE de l'entrée n'est montré ici. Voir une image ne conduit
   pas à recopier des mots ; le constat de sortie se rédige à l'aveugle,
   et les textes ne s'ouvrent qu'à l'écran de comparaison. */
function blocPhotosEntree() {
  const e = E.photosEntree;
  if (!e) {
    return `<div class="bloc"><h2>État des lieux d'entrée</h2>
      <button class="mini secondaire" id="btn-photos-entree">Photos de l'entrée</button>
      <p class="note">Pour refaire les mêmes cadrages qu'à l'entrée.</p></div>`;
  }
  if (e.statut !== "ok") {
    const raisons = {
      dossier_introuvable: "Dossier EDLE introuvable à côté de celui-ci.",
      aucune: "Aucune photographie dans l'état des lieux d'entrée.",
      erreur: "Lecture impossible : " + (e.message || ""),
      sans_objet: "Sans objet pour un état des lieux d'entrée.",
    };
    return `<div class="bloc"><h2>État des lieux d'entrée</h2>
      <p class="note ko">${echapper(raisons[e.statut] || e.statut)}</p>
      <button class="mini secondaire" id="btn-photos-entree">Réessayer</button></div>`;
  }

  const piece = VISITE.pieces.find(p => p.piece_id === E.piece);
  const lot = photosEntreePourPiece(e.photos, piece && piece.libelle);
  const reprises = (VISITE.photos || [])
    .map(p => p.photo_entree_id).filter(Boolean);

  return `<div class="bloc"><h2>Photos de l'entrée — ${lot.length}</h2>
    ${lot.length === e.photos.length && e.photos.length > 1
      ? `<p class="note">Aucune ne porte le nom de cette pièce : toutes sont
         affichées.</p>` : ""}
    <div class="vignettes">
      ${lot.map(p => {
        const prise = reprises.includes(p.onedrive_item_id);
        return `<figure class="vignette${prise ? " reprise" : ""}"
            data-entree="${echapper(p.onedrive_item_id)}">
          <img src="${echapper(E.liensEntree[p.onedrive_item_id] || "")}" alt="" loading="lazy">
          <figcaption>${echapper(p.numero || "?")}${prise ? " ✓" : ""}</figcaption>
        </figure>`;
      }).join("")}
    </div>
    <p class="note">Touche une photographie pour refaire le même cadrage.
    ${reprises.length ? reprises.length + " déjà reprise(s)." : ""}</p>
  </div>`;
}

async function ouvrirPhotosEntree() {
  const b = $("btn-photos-entree");
  if (b) { b.disabled = true; b.textContent = "Lecture de OneDrive…"; }
  let e;
  try { e = await chargerPhotosEntree(VISITE); }
  catch (err) { e = { statut: "erreur", message: err.message, photos: [] }; }
  E.photosEntree = e;

  /* Un lien par photographie : c'est le coût réel de cet écran, un appel
     Graph par image. Sur une vingtaine de vues, quelques secondes en wifi. */
  E.liensEntree = E.liensEntree || {};
  if (e.statut === "ok") {
    for (const p of e.photos) {
      try { E.liensEntree[p.onedrive_item_id] = await lienPhotoEntree(p); }
      catch (_) { /* une photographie illisible n'empêche pas les autres */ }
    }
  }
  dessinerPiece();
}

function numeroDansNom(nom) {
  const m = String(nom || "").match(/_(\d{3})_/);
  return m ? m[1] : "?";
}

/* Libellé et couleur d'un bouton « cocher », sans toucher au reste. */
function majBoutonCocher(bouton, coche) {
  if (!bouton) return;
  bouton.textContent = coche ? "cochée" : "cocher";
  bouton.className = "seg" + (coche ? " actif" : "");
}

/* Remplace le SEUL bloc de groupe, et rebranche ce qu'il contient.
   La hauteur de la page change — le bloc apparaît ou disparaît — mais le
   contenu au-dessus n'est pas remplacé, donc rien n'est repositionné. */
function rafraichirZoneGroupe(piece, photos) {
  const zone = $("zone-groupe");
  if (!zone) return dessinerPiece();
  zone.innerHTML = blocGroupe(piece, photos);
  brancherZoneGroupe(piece, photos);
}

/* Message passager, affiché sans reconstruire l'écran. */
function messageBref(texte) {
  const zone = $("zone-groupe");
  if (!zone || !zone.parentNode) return;
  const avis = document.createElement("div");
  avis.className = "avert";
  avis.textContent = texte;
  zone.parentNode.insertBefore(avis, zone);
  setTimeout(() => { if (avis.parentNode) avis.parentNode.removeChild(avis); }, 4000);
}

function viderGroupe() {
  E.groupe = []; E.groupeTexte = null; E.groupeAvant = "";
  E.groupeInstruction = ""; E.groupeHistorique = []; E.groupeOrigine = null;
}

/* Mémorise ce qui est tapé avant tout redessin : sans cela, une photographie
   confirmée par la file efface la saisie en cours. */
function memoriserGroupe() {
  const a = $("groupe-avant"); if (a) E.groupeAvant = a.value;
  const t = $("groupe-texte"); if (t) E.groupeTexte = t.value;
  const i = $("groupe-instruction"); if (i) E.groupeInstruction = i.value;
}

function brancherGroupe(piece, photos) {
  if ($("btn-photos-entree")) $("btn-photos-entree").onclick = ouvrirPhotosEntree;

  $("vue").querySelectorAll("[data-corriger]").forEach(b => b.onclick = () => {
    memoriserGroupe();
    ecranCorrigerPhoto(b.getAttribute("data-corriger"));
  });

  /* COCHER NE RECONSTRUIT PLUS L'ÉCRAN.

     Redessiner toute la pièce remplaçait le contenu de la page. Safari
     ramenait alors le défilement en haut, et l'on se retrouvait devant la
     première photographie au lieu de celle qu'on venait de cocher. Trois
     tentatives de rétablissement de la position ont échoué : la page
     défile sur le body, dont la hauteur s'effondre le temps de l'échange.

     On ne touche donc plus qu'à ce qui change : le libellé du bouton et le
     bloc de groupe. Aucun remplacement global, donc aucune position à
     rétablir. Le problème disparaît par construction. */
  $("vue").querySelectorAll("[data-grouper]").forEach(b => b.onclick = () => {
    memoriserGroupe();
    const id = b.getAttribute("data-grouper");
    E.groupe = E.groupe || [];
    const i = E.groupe.indexOf(id);
    if (i >= 0) E.groupe.splice(i, 1);
    else if (E.groupe.length >= GROUPE_MAX_PHOTOS) {
      /* Au-delà de dix, la requête approche la limite de 20 Mo de Gemini.
         Message affiché sans redessin, pour ne pas faire sauter l'écran. */
      return messageBref("Dix photographies au maximum par groupe. " +
        "Décoches-en une, ou fais un second groupe.");
    }
    else E.groupe.push(id);
    /* Décocher pendant qu'un constat est ouvert changerait le groupe auquel
       il se rattache : on repart alors de zéro. */
    if (E.groupeTexte) { E.groupeTexte = null; E.groupeHistorique = []; }

    majBoutonCocher(b, E.groupe.includes(id));
    rafraichirZoneGroupe(piece, photos);
  });

  brancherZoneGroupe(piece, photos);
}

/* Branche ce qui vit DANS le bloc de groupe. Rappelée à chaque
   rafraîchissement de la zone, sans toucher au reste de l'écran. */
function brancherZoneGroupe(piece, photos) {
  const cochees = () => (E.groupe || [])
    .map(id => photos.find(p => p.photo_id === id)).filter(Boolean);

  const ga = $("groupe-avant");
  if (ga) ga.oninput = () => { E.groupeAvant = ga.value; };
  const gt = $("groupe-texte");
  if (gt) gt.oninput = () => { E.groupeTexte = gt.value; };
  const gi = $("groupe-instruction");
  if (gi) gi.oninput = () => { E.groupeInstruction = gi.value; };

  if ($("btn-groupe-vider")) $("btn-groupe-vider").onclick = () => {
    viderGroupe();
    /* Remettre tous les boutons à « cocher » sans reconstruire l'écran. */
    $("vue").querySelectorAll("[data-grouper]").forEach(b => majBoutonCocher(b, false));
    rafraichirZoneGroupe(piece, photos);
  };
  /* Sortie de secours quand les corrections successives se sont enlisées :
     on revient au texte que l'IA avait produit et on efface l'historique,
     sans repayer une description complète. */
  if ($("btn-groupe-repartir")) $("btn-groupe-repartir").onclick = () => {
    if (!E.groupeOrigine) return dessinerPiece("Aucun texte d'origine conservé.");
    E.groupeTexte = E.groupeOrigine;
    E.groupeHistorique = [];
    E.groupeInstruction = "";
    dessinerPiece("Texte d'origine rétabli — les corrections précédentes sont oubliées");
  };

  if ($("btn-groupe-abandon")) $("btn-groupe-abandon").onclick = () => {
    E.groupeTexte = null; E.groupeInstruction = ""; E.groupeHistorique = [];
    dessinerPiece();
  };

  if ($("btn-groupe")) $("btn-groupe").onclick = async () => {
    memoriserGroupe();
    const lot = cochees();
    if (lot.length < 2) return dessinerPiece("Coche au moins deux photographies.");
    if (!iaDisponible()) return dessinerPiece("Aucun relais IA enregistré — va dans " +
      "Accueil → Description par IA pour coller l'adresse Make.");
    if (!(await confirmer("Décrire ces " + lot.length + " photographies ensemble ?",
        "Cet appel est facturé — un appel Gemini portant " + lot.length +
        " images. L'IA rédigera un seul constat pour l'ensemble.",
        "Oui, décrire"))) return;
    const b = $("btn-groupe");
    b.disabled = true; b.textContent = "Lecture des " + lot.length + " photos…";
    try {
      E.groupeTexte = await decrireGroupe(VISITE, lot, E.groupeAvant);
      E.groupeOrigine = E.groupeTexte;
      E.groupeHistorique = [];
      E.groupeInstruction = "";
    } catch (e) {
      return dessinerPiece("Description impossible : " + e.message);
    }
    dessinerPiece("Constat proposé — relis-le, corrige, puis « Ajouter au constat »");
  };

  const reformuler = async (avecPhotos) => {
    memoriserGroupe();
    const lot = cochees();
    const instruction = String(E.groupeInstruction || "").trim();
    if (!instruction) return dessinerPiece("Écris d'abord ce qu'il faut changer.");
    // « Tout », « mieux », « non » : le modèle n'a rien à appliquer et recopie.
    if (instruction.split(/\s+/).length < 3) {
      return dessinerPiece("Sois plus précis : « supprime la phrase sur le sol », " +
        "« trois phrases maximum », « ne parle pas des cadres ». " +
        "Une demande vague ne change rien au texte.");
    }
    if (avecPhotos && !(await confirmer("Revoir les photographies ?",
        "L'IA rouvre les " + lot.length + " images. Cet appel est facturé comme " +
        "une description complète.", "Oui, revoir"))) return;
    const b = $(avecPhotos ? "btn-revoir" : "btn-reformuler");
    b.disabled = true; b.textContent = avecPhotos ? "Relecture…" : "Reformulation…";
    let texte;
    try {
      texte = await reformulerTexte(VISITE, lot, E.groupeTexte, instruction,
                                    E.groupeHistorique || [], avecPhotos);
    } catch (e) {
      return dessinerPiece("Reformulation impossible : " + e.message);
    }
    /* Le modèle a le droit de dire qu'il ne peut pas répondre sans revoir
       les images : on le relaie au lieu de faire passer sa réponse pour un
       constat. */
    if (/il faut revoir les photographies/i.test(texte)) {
      return dessinerPiece("L'IA ne peut pas répondre sans revoir les images. " +
        "Utilise « Revoir les photos ».");
    }
    E.groupeTexte = texte;
    E.groupeHistorique = (E.groupeHistorique || []).concat([instruction]);
    E.groupeInstruction = "";
    dessinerPiece("Texte corrigé — relis-le");
  };
  if ($("btn-reformuler")) $("btn-reformuler").onclick = () => reformuler(false);
  if ($("btn-revoir")) $("btn-revoir").onclick = () => reformuler(true);

  if ($("btn-groupe-ajouter")) $("btn-groupe-ajouter").onclick = async () => {
    memoriserGroupe();
    const lot = cochees();
    const texte = String(E.groupeTexte || "").trim();
    if (!texte) return dessinerPiece("Le constat est vide.");
    try {
      VISITE = await modifierVisite(VISITE.visit_id, v => {
        const pc = v.pieces.find(x => x.piece_id === E.piece);
        pc.constatations.push({
          texte: texte,
          /* La LISTE des photographies, et non une seule : c'est ce qui
             relie le constat à l'annexe du procès-verbal. */
          photo_ids: lot.map(p => p.photo_id),
          photo_noms: lot.map(p => p.nom_fichier),
          photo_id: null, photo_nom: null,
          source: "ia_groupe_validee",
          instruction_avant: String(E.groupeAvant || "").trim() || null,
          instructions_correction: (E.groupeHistorique || []).slice(),
          horodatage: new Date().toISOString(),
        });
      }) || VISITE;
    } catch (e) {
      return dessinerPiece("Enregistrement impossible : " + e.message);
    }
    viderGroupe();
    programmerDepot();
    dessinerPiece("Constat de groupe enregistré");
  };
}

function dessinerPiece(message) {
  const piece = VISITE.pieces.find(p => p.piece_id === E.piece);
  const photos = VISITE.photos.filter(p => p.rattachement === E.piece);
  const deposees = photos.filter(p => p.statut_transfert === "confirme").length;

  /* Un brouillon PAR PHOTO : un champ unique pour toute la pièce faisait
     s'écraser les descriptions successives. */
  if (!E.brouillons) E.brouillons = {};
  if (E.etat === undefined) E.etat = null;
  if (E.proprete === undefined) E.proprete = null;
  if (E.commentaireGeneral === undefined) {
    E.commentaireGeneral = (piece.etat_general && piece.etat_general.commentaire) || "";
    E.etat = (piece.etat_general && piece.etat_general.etat) || null;
    E.proprete = (piece.etat_general && piece.etat_general.proprete) || null;
  }

  const seg = (cle, valeurs, actif) => `<div class="segments">${valeurs.map(v =>
    `<button class="seg${actif === v ? " actif" : ""}" data-${cle}="${v}">${
      v.replace(/_/g, " ")}</button>`).join("")}</div>`;

  vue(`<div class="barre" id="barre-attente">…</div>
    ${message ? `<div class="succes">${echapper(message)}</div>` : ""}

    <div class="bloc"><h2>État général de la pièce</h2>
      <p class="note">Une appréciation d'ensemble, distincte des constatations
      rattachées aux photographies.</p>
      ${seg("etat", ["neuf","bon_etat","usage","degrade"], E.etat)}
      ${seg("proprete", ["propre","a_nettoyer","sale"], E.proprete)}
      <textarea id="commentaire-general" rows="2"
        placeholder="Commentaire sur l'ensemble de la pièce (facultatif)">${
        echapper(E.commentaireGeneral)}</textarea>
      <button id="btn-etat-general">Enregistrer l'état général</button>
    </div>

    <div class="bloc"><h2>${piece.constatations.length} constatation${
        piece.constatations.length > 1 ? "s" : ""} dans cette pièce</h2>
      ${piece.constatations.length
        ? piece.constatations.map((c, i) => `<div class="constat">
            <p>${echapper(c.texte)}</p>
            <p class="note">${c.photo_noms && c.photo_noms.length
              ? "photographies " + echapper(c.photo_noms.map(numeroDansNom).join(", "))
              : (c.photo_nom
                ? "photographie " + echapper(c.photo_nom)
                : "sans photographie")}
            <button class="lien" data-modif="${i}" style="color:#1f4e5f">modifier</button>
            <button class="lien" data-suppr="${i}">supprimer</button></p></div>`).join("")
        : `<p class="note">Aucune constatation pour l'instant.</p>`}
    </div>

    ${_echecEnvoi && deposees < photos.length
      ? `<div class="erreur"><strong>Envoi bloqué</strong>${echapper(_echecEnvoi)}<br><br>
         Les photographies restent sur le téléphone : rien n'est perdu. Elles
         repartiront dès que la cause sera levée.</div>` : ""}

    ${VISITE.type === "EDLS" ? blocPhotosEntree() : ""}

    <div id="zone-groupe">${blocGroupe(piece, photos)}</div>

    <div class="bloc"><h2>${photos.length} photo${photos.length > 1 ? "s" : ""}${
        photos.length ? " — " + deposees + " enregistrée" + (deposees > 1 ? "s" : "") : ""}</h2>
      ${photos.length ? photos.map(p => {
        const brouillon = E.brouillons[p.photo_id] === undefined
          ? (p.description || "") : E.brouillons[p.photo_id];
        const dejaConstat = piece.constatations.some(c => c.photo_id === p.photo_id);
        return `<div class="constat">
          <div class="ligne"><span>${echapper(p.nom_fichier)}</span>
          <span class="val ${p.statut_transfert === "confirme" ? "ok" : "ko"}">${
            p.statut_transfert === "confirme" ? "enregistrée"
            : p.statut_transfert === "echec" ? "refusée" : "en attente"}</span></div>
          ${p.statut_transfert === "echec"
            ? `<p class="note ko">Refusée par Microsoft : ${
                echapper(p.motif_echec || "motif inconnu")}. Elle restera au
               procès-verbal, signalée comme non transmise. Retire-la et
               refais-la si tu le peux.</p>` : ""}

          ${p.statut_transfert === "confirme" ? `
            <div class="interrupteur">
              <span class="note">Décrire avec d'autres photographies</span>
              <button class="seg${(E.groupe || []).includes(p.photo_id) ? " actif" : ""}"
                style="width:auto;margin:0;padding:7px 16px"
                data-grouper="${echapper(p.photo_id)}">${
                (E.groupe || []).includes(p.photo_id) ? "cochée" : "cocher"}</button>
            </div>
            <textarea rows="3" data-brouillon="${echapper(p.photo_id)}"
              placeholder="Décris cette photo. Micro du clavier disponible.">${
              echapper(brouillon)}</textarea>
            ${VISITE.type === "EDLE"
              ? `<div class="duo">
                   <button class="decrire" data-decrire="${echapper(p.photo_id)}">Décrire</button>
                   <button class="decrire sobre" data-sobre="${
                     echapper(p.photo_id)}">Brièvement</button>
                 </div>`
              : `<button class="decrire" data-decrire="${
                  echapper(p.photo_id)}">Décrire cette photo</button>`}
            <div class="duo">
              <button data-ajouter="${echapper(p.photo_id)}"${
                brouillon.trim() ? "" : " disabled"}>Ajouter au constat</button>
              <button class="mini secondaire" data-corriger="${echapper(p.photo_id)}"${
                brouillon.trim() ? "" : " disabled"}>Corriger</button>
            </div>
            ${dejaConstat
              ? `<p class="note ok">Une constatation est rattachée à cette photo.</p>` : ""}
          ` : `<p class="note gris">En attente d'envoi</p>`}

          <p class="note" style="margin-top:10px">
            <button class="lien" data-suppr-photo="${
              echapper(p.photo_id)}">retirer de l'état des lieux</button></p></div>`;
        }).join("")
        : `<p class="note">Aucune photo.</p>`}
      <input type="file" accept="image/*" capture="environment" id="appareil" class="cache">
      <button id="btn-photo">Prendre une photo</button>
    </div>

    <button class="secondaire" id="btn-retour">Retour aux pièces</button>`);

  // --- état général de la pièce ---
  const cg = $("commentaire-general");
  if (cg) cg.oninput = () => { E.commentaireGeneral = cg.value; };

  $("vue").querySelectorAll("[data-etat]").forEach(b => b.onclick = () => {
    const v = b.getAttribute("data-etat");
    E.etat = (E.etat === v) ? null : v;
    if (cg) E.commentaireGeneral = cg.value;
    dessinerPiece();
  });
  $("vue").querySelectorAll("[data-proprete]").forEach(b => b.onclick = () => {
    const v = b.getAttribute("data-proprete");
    E.proprete = (E.proprete === v) ? null : v;
    if (cg) E.commentaireGeneral = cg.value;
    dessinerPiece();
  });

  $("btn-etat-general").onclick = async () => {
    E.commentaireGeneral = cg ? cg.value : E.commentaireGeneral;
    try {
      VISITE = await modifierVisite(VISITE.visit_id, v => {
        const pc = v.pieces.find(x => x.piece_id === E.piece);
        pc.etat_general = {
          etat: E.etat, proprete: E.proprete,
          commentaire: (E.commentaireGeneral || "").trim() || null,
          horodatage: new Date().toISOString(),
        };
      }) || VISITE;
    } catch (e) {
      return dessinerPiece("Enregistrement impossible : " + e.message);
    }
    programmerDepot();
    dessinerPiece("État général de la pièce enregistré");
  };

  // --- brouillon par photo ---
  $("vue").querySelectorAll("[data-brouillon]").forEach(t => {
    t.oninput = () => {
      E.brouillons[t.getAttribute("data-brouillon")] = t.value;
      const b = $("vue").querySelector('[data-ajouter="' +
        t.getAttribute("data-brouillon") + '"]');
      if (b) b.disabled = !t.value.trim();
    };
  });

  // --- ajouter au constat ---
  $("vue").querySelectorAll("[data-ajouter]").forEach(b => b.onclick = async () => {
    const id = b.getAttribute("data-ajouter");
    const zone = $("vue").querySelector('[data-brouillon="' + id + '"]');
    const texte = (zone ? zone.value : E.brouillons[id] || "").trim();
    if (!texte) return dessinerPiece("Écris ou dicte d'abord une description.");
    const photo = VISITE.photos.find(x => x.photo_id === id);
    b.disabled = true;
    try {
      VISITE = await modifierVisite(VISITE.visit_id, v => {
        const pc = v.pieces.find(x => x.piece_id === E.piece);
        const entree = {
          texte: texte,
          photo_id: id,
          photo_nom: photo ? photo.nom_fichier : null,
          source: (photo && photo.description === texte) ? "ia_validee" : "saisie",
          horodatage: new Date().toISOString(),
        };
        const i = pc.constatations.findIndex(c => c.photo_id === id);
        if (i >= 0) pc.constatations[i] = entree; else pc.constatations.push(entree);
      }) || VISITE;
    } catch (e) {
      b.disabled = false;
      return dessinerPiece("Enregistrement impossible : " + e.message);
    }
    E.brouillons[id] = texte;
    programmerDepot();
    const pc = VISITE.pieces.find(x => x.piece_id === E.piece);
    dessinerPiece("Constatation enregistrée — " + pc.constatations.length +
      " dans cette pièce");
  });

  // --- modifier ou supprimer une constatation ---
  $("vue").querySelectorAll("[data-modif]").forEach(b => b.onclick = async () => {
    const c = piece.constatations[parseInt(b.getAttribute("data-modif"), 10)];
    if (c.photo_ids && c.photo_ids.length) {
      /* Un constat de groupe se corrige en le reprenant entier : le rattacher
         à une seule photographie romprait le lien avec les autres. */
      E.groupe = c.photo_ids.slice();
      E.groupeTexte = c.texte;
      E.groupeHistorique = (c.instructions_correction || []).slice();
      E.groupeAvant = c.instruction_avant || "";
      E.groupeInstruction = "";
      VISITE = await modifierVisite(VISITE.visit_id, v => {
        const pc = v.pieces.find(x => x.piece_id === E.piece);
        const i = pc.constatations.indexOf(pc.constatations.find(
          x => x.horodatage === c.horodatage && x.texte === c.texte));
        if (i >= 0) pc.constatations.splice(i, 1);
      }) || VISITE;
      return dessinerPiece("Constat repris — corrige-le, puis « Ajouter au constat »");
    }
    if (c.photo_id) {
      E.brouillons[c.photo_id] = c.texte;
      dessinerPiece("Corrige le texte sous la photographie, puis « Ajouter au constat »");
    } else {
      dessinerPiece("Cette constatation n'est rattachée à aucune photographie.");
    }
  });

  $("vue").querySelectorAll("[data-suppr]").forEach(b => b.onclick = async () => {
    const i = parseInt(b.getAttribute("data-suppr"), 10);
    VISITE = await modifierVisite(VISITE.visit_id, v => {
      v.pieces.find(x => x.piece_id === E.piece).constatations.splice(i, 1);
    }) || VISITE;
    programmerDepot();
    dessinerPiece("Constatation supprimée");
  });

  const brancherDecrire = (attribut, niveau) =>
    $("vue").querySelectorAll("[" + attribut + "]").forEach(b => b.onclick = async () => {
    const id = b.getAttribute(attribut);
    const photo = VISITE.photos.find(x => x.photo_id === id);
    if (!iaDisponible()) {
      return dessinerPiece("Aucun relais IA enregistré — va dans " +
        "Accueil → Description par IA pour coller l'adresse Make.");
    }
    /* Chaque description est facturée : deux crédits Make et un appel
       Gemini. Un appui involontaire ne doit jamais suffire. */
    if (!(await confirmer(niveau === "sobre"
        ? "Décrire brièvement ?" : "Décrire cette photo ?",
        "Cet appel est facturé — deux crédits Make et un appel Gemini. " +
        (niveau === "sobre"
          ? "Seuls les défauts visibles au premier regard seront signalés. "
          : "") +
        (photo.description ? "Le texte proposé s'ajoutera au constat." : ""),
        "Oui, décrire"))) return;
    b.disabled = true; b.textContent = "Lecture en cours…";
    let texte;
    try {
      texte = await decrirePhoto(VISITE, photo, niveau);
    } catch (e) {
      return dessinerPiece("Description impossible : " + e.message);
    }
    /* Le texte proposé S'AJOUTE au champ de saisie sans écraser ce qui s'y
       trouve : décrire une deuxième photo effaçait la description de la
       première, et une seule finissait dans le constat. */
    /* Le texte va dans le champ de CETTE photo, jamais dans un champ commun. */
    const zone = $("vue").querySelector('[data-brouillon="' + id + '"]');
    const dejaLa = (zone ? zone.value : E.brouillons[id] || "").trim();
    E.brouillons[id] = dejaLa ? (dejaLa + "\n" + texte) : texte;

    VISITE = await modifierVisite(VISITE.visit_id, v => {
      const p = v.photos.find(x => x.photo_id === id);
      if (p) {
        p.description = texte;
        p.description_source = "ia_proposee";
        p.description_niveau = niveau || "detaille";
      }
    }) || VISITE;
    dessinerPiece(dejaLa
      ? "Texte ajouté sous la photographie — relis, puis « Ajouter au constat »"
      : "Proposition de l'IA — relis-la, puis « Ajouter au constat »");
  });

  brancherDecrire("data-decrire", null);
  brancherDecrire("data-sobre", "sobre");

  $("vue").querySelectorAll("[data-suppr-photo]").forEach(b => b.onclick = async () => {
    const id = b.getAttribute("data-suppr-photo");
    const liee = piece.constatations.find(c => c.photo_id === id);
    if (!(await confirmer("Retirer cette photographie ?",
        liee
          ? "Sa constatation sera retirée en même temps : « " +
            liee.texte.slice(0, 80) + (liee.texte.length > 80 ? "…" : "") +
            " ». Le fichier déjà déposé dans OneDrive n'est pas supprimé."
          : "Le fichier déjà déposé dans OneDrive n'est pas supprimé.",
        "Oui, retirer"))) return;
    b.disabled = true;
    try {
      /* retirerPhoto sort la photographie de la visite ET de la file
         d'attente. Sans elle, une photographie retirée continuait d'être
         comptée « en attente d'envoi ». */
      VISITE = await retirerPhoto(VISITE.visit_id, id) || VISITE;
    } catch (e) {
      b.disabled = false;
      return dessinerPiece("Retrait impossible : " + e.message);
    }
    VISITE = await modifierVisite(VISITE.visit_id, v => {
      /* Une constatation qui cite une photographie retirée serait
         orpheline au procès-verbal : elle part avec elle. */
      v.pieces.forEach(pc => {
        pc.constatations = pc.constatations.filter(c => c.photo_id !== id);
      });
    }) || VISITE;
    await journaliser("photo_retiree", { photo_id: id });
    delete E.brouillons[id];
    programmerDepot();
    dessinerPiece(liee
      ? "Photographie et constatation retirées de l'état des lieux"
      : "Photographie retirée de l'état des lieux");
  });

  $("btn-photo").onclick = () => $("appareil").click();
  $("appareil").onchange = async (ev) => {
    const fichier = ev.target.files && ev.target.files[0];
    if (!fichier) return;
    /* Les brouillons par photo sont déjà mémorisés à chaque frappe. */
    $("vue").querySelectorAll("[data-brouillon]").forEach(t => {
      E.brouillons[t.getAttribute("data-brouillon")] = t.value;
    });
    $("btn-photo").disabled = true;
    $("btn-photo").textContent = "Enregistrement…";
    try {
      await ajouterPhoto(VISITE, E.piece, fichier);
    } catch (e) {
      avert(`<div class="erreur"><strong>Photo non enregistrée</strong>${echapper(e.message)}</div>`);
    }
    VISITE = (await lireVisite(VISITE.visit_id)) || VISITE;
    dessinerPiece();
  };

  $("btn-retour").onclick = async () => {
    E.brouillons = {}; E.etat = undefined; E.proprete = undefined;
    E.commentaireGeneral = undefined; E.indexEdition = null;
    await deposerMaintenant(VISITE);
    ecranVisiteReprise(VISITE);
  };

  brancherGroupe(piece, photos);
  majCompteurAttente(VISITE.photos.length);
}

/* Le fichier de visite n'est plus déposé à chaque frappe : on attend
   quelques secondes de calme. Hors réseau, l'échec reste sans effet. */
let _minuterieDepot = null;
function programmerDepot() {
  if (_minuterieDepot) clearTimeout(_minuterieDepot);
  _minuterieDepot = setTimeout(async () => {
    _minuterieDepot = null;
    if (VISITE) await deposerFichierVisite(VISITE);
  }, 5000);
}

// --- Correspondances avec OneDrive ---------------------------------------

const ETIQUETTES = {
  complet:          { texte: "complet",          classe: "ok" },
  incomplet:        { texte: "incomplet",        classe: "ko" },
  manquant:         { texte: "à désigner",       classe: "ko" },
  ambigu:           { texte: "à trancher",       classe: "attention" },
  sans_locataire:   { texte: "sans locataire",   classe: "ko" },
  vide_normal:      { texte: "inoccupé",         classe: "gris" },
  inoccupe:         { texte: "inoccupé",         classe: "gris" },
  hors_perimetre:   { texte: "hors périmètre",   classe: "gris" },
  approuve_absent:  { texte: "dossier disparu",  classe: "ko" },
  erreur:           { texte: "erreur",           classe: "ko" },
};

let COMP = null;

async function ecranComparaison(silencieux) {
  E.ecran = "comparaison";
  titre("Correspondances OneDrive", "Contrôle et approbation des unités");
  if (!silencieux) vue(`<p class="note" id="progres">Lecture de OneDrive en cours…</p>`);

  try {
    COMP = await comparerAvecOneDrive(nom => {
      const p = $("progres");
      if (p) p.textContent = "Lecture de " + nom + "…";
    });
  } catch (e) {
    vue(`<div class="erreur"><strong>Comparaison impossible</strong>${echapper(e.message)}</div>
         <button class="secondaire" id="btn-retour">Retour</button>`);
    $("btn-retour").onclick = () => ecranAccueil();
    return;
  }
  dessinerComparaison();
}

function recalculerBilan() {
  const b = { total: 0, complet: 0, incomplet: 0, manquant: 0, ambigu: 0,
              sans_locataire: 0, vide_normal: 0, erreur: 0,
              approuve_absent: 0, hors_perimetre: 0, approuvees: 0 };
  const fautes = [];
  const ecarts = [];
  COMP.resultats.forEach(bloc => bloc.lignes.forEach(l => {
    b.total++;
    if (l.ecart_nom) {
      ecarts.push({ immeuble: bloc.immeuble, unite: l.designation,
                    dossier: l.ecart_nom.dossier, attendu: l.ecart_nom.attendu });
    }
    if (b[l.statut] !== undefined) b[l.statut]++;
    if (l.approuvee) b.approuvees++;
    if (l.faute_de_frappe) {
      fautes.push({
        immeuble: bloc.immeuble, unite: l.designation,
        chemin: [l.dossier_unite, l.dossier_courant].filter(Boolean).join(" › "),
        correction: l.faute_de_frappe,
      });
    }
  }));
  COMP.bilan = b;
  COMP.fautes = fautes;
  COMP.ecarts = ecarts;
}

function dessinerComparaison() {
  const r = COMP, b = r.bilan;
  const aTraiter = b.incomplet + b.manquant + b.ambigu + b.sans_locataire
                 + b.erreur + b.approuve_absent;

  let html = `<div class="bloc"><h2>Bilan</h2>
    <div class="ligne"><span>Unités contrôlées</span><span class="val">${b.total}</span></div>
    <div class="ligne"><span>Correspondances approuvées</span><span class="val ok">${b.approuvees}</span></div>
    <div class="ligne"><span>Dossiers complets</span><span class="val ok">${b.complet}</span></div>
    <div class="ligne"><span>Unités inoccupées</span><span class="val gris">${b.vide_normal}</span></div>
    <div class="ligne"><span>À traiter</span><span class="val ${aTraiter ? "ko" : "ok"}">${aTraiter}</span></div>
    <div class="ligne"><span>Noms à vérifier</span><span class="val ${
      (r.ecarts || []).length ? "attention" : "ok"}">${(r.ecarts || []).length}</span></div>
    <div class="ligne"><span>Hors périmètre</span><span class="val gris">${b.hors_perimetre}</span></div>
    ${r.genere_le ? `<p class="note">Liste exportée le ${new Date(r.genere_le).toLocaleString("fr-BE")}</p>` : ""}
    </div>`;

  if (r.fautes && r.fautes.length) {
    html += `<div class="bloc"><h2>Dossiers à renommer dans OneDrive — ${r.fautes.length}</h2>
      <p class="note">À corriger à la main dans OneDrive, puis relancer le contrôle
      avec le bouton en bas de page.</p>
      ${r.fautes.map(f => `<div class="comp comp-alerte">
        <div class="ligne"><span>${echapper(f.unite)}</span>
          <span class="val attention">${echapper(f.correction)}</span></div>
        <p class="note">${echapper(f.immeuble)} › ${echapper(f.chemin)}</p>
      </div>`).join("")}
    </div>`;
  }

  /* Les écarts de noms se règlent ICI, au bureau. Pendant la visite,
     l'application ne demande rien et ne corrige rien : les preneurs
     viennent de Gestion Loyers. */
  if (r.ecarts && r.ecarts.length) {
    html += `<div class="bloc"><h2>Noms à vérifier — ${r.ecarts.length}</h2>
      <p class="note">Le dossier retenu ne porte aucun mot du nom du locataire
      annoncé par Gestion Loyers. Soit le dossier est celui d'un ancien preneur,
      soit la liste n'est pas à jour. À trancher avant la visite : c'est le nom
      de Gestion Loyers qui figurera au procès-verbal.</p>
      ${r.ecarts.map(e => `<div class="comp comp-alerte">
        <div class="ligne"><span>${echapper(e.unite)}</span>
          <span class="val gris">${echapper(e.immeuble)}</span></div>
        <p class="note">Gestion Loyers : <strong>${echapper(e.attendu)}</strong></p>
        <p class="note">Dossier OneDrive : <strong>${echapper(e.dossier)}</strong></p>
      </div>`).join("")}
    </div>`;
  }

  r.resultats.forEach((bloc, ib) => {
    if (bloc.erreur) {
      html += `<div class="bloc"><h2>${echapper(bloc.immeuble)}</h2>
        <div class="erreur">${echapper(bloc.erreur)}</div></div>`;
      return;
    }
    const n = bloc.lignes.filter(l =>
      ["incomplet","manquant","ambigu","sans_locataire","erreur","approuve_absent"]
        .includes(l.statut)).length;

    html += `<div class="bloc"><h2>${echapper(bloc.immeuble)} — « ${echapper(bloc.dossier_onedrive)} »${
      n ? " · " + n + " à traiter" : ""}</h2>`;

    bloc.lignes.forEach((l, il) => {
      const e = ETIQUETTES[l.statut] || ETIQUETTES.erreur;
      const calme = l.statut === "complet" || l.statut === "vide_normal"
                 || l.statut === "hors_perimetre";
      html += `<div class="comp ${calme ? "" : "comp-alerte"}">
        <div class="ligne"><span>${echapper(l.designation)}${
          l.approuvee ? ' <span class="sceau">approuvé</span>' : ""}</span>
          <span class="val ${e.classe}">${e.texte}</span></div>`;

      if (l.dossier_unite) {
        html += `<p class="note">${echapper(l.dossier_unite)}`;
        if (l.dossier_courant) html += ` › ${echapper(l.dossier_courant)}`;
        if (l.motif_choix && l.motif_choix !== "seul dossier")
          html += ` <span class="gris">(${echapper(l.motif_choix)})</span>`;
        if (l.statut === "complet") html += ` › EDLE ✓ EDLS ✓`;
        if (l.structure === "plate") html += ` <span class="gris">(sans dossier locataire)</span>`;
        html += `</p>`;
      }
      if (l.ecart_nom) {
        html += `<p class="note attention">Nom à vérifier — Gestion Loyers annonce
          ${echapper(l.ecart_nom.attendu)}, le dossier s'appelle
          ${echapper(l.ecart_nom.dossier)}</p>`;
      }
      if (l.message) html += `<p class="note">${echapper(l.message)}</p>`;
      if (l.statut === "incomplet" && l.sous_dossiers)
        html += `<p class="note">présents : ${echapper(l.sous_dossiers.join(", ") || "aucun")}</p>`;
      if (l.detail_locataires && l.detail_locataires.length > 1) {
        html += `<p class="note">${l.detail_locataires.length} dossiers locataires : ${
          l.detail_locataires.map(d => echapper(d.nom) +
            (d.edle || d.edls ? " (" + [d.edle ? "EDLE" : null, d.edls ? "EDLS" : null]
              .filter(Boolean).join("+") + ")" : "")).join(", ")}</p>`;
      } else if (l.dossiers_locataires && l.dossiers_locataires.length > 1) {
        html += `<p class="note">${l.dossiers_locataires.length} dossiers locataires : ${
          echapper(l.dossiers_locataires.join(", "))}</p>`;
      }

      // --- actions ---
      if (l.dossier_unite && !l.approuvee) {
        html += `<button class="mini" data-approuver="${ib}:${il}">Approuver cette correspondance</button>`;
      }
      if (l.approuvee) {
        html += `<button class="mini secondaire" data-retirer="${ib}:${il}">Retirer l'approbation</button>`;
      }
      if (l.candidats_libres && l.candidats_libres.length) {
        html += `<button class="mini secondaire" data-designer="${ib}:${il}">Désigner le dossier</button>`;
      }
      html += `</div>`;
    });

    if (bloc.extras.length)
      html += `<p class="note">Dossiers sans unité correspondante — ce ne sont pas des logements : ${
        echapper(bloc.extras.join(", "))}</p>`;
    html += `</div>`;
  });

  html += `<button id="btn-relancer">Relancer le contrôle complet</button>`;
  html += `<button class="secondaire" id="btn-retour">Retour à l'accueil</button>`;
  vue(html);

  $("btn-relancer").onclick = () => ecranComparaison();

  const ligneDe = (cle) => {
    const [ib, il] = cle.split(":").map(Number);
    return { bloc: COMP.resultats[ib], ligne: COMP.resultats[ib].lignes[il] };
  };

  /* Après une approbation, seule l'unité concernée est réévaluée :
     reparcourir les sept immeubles prendrait plusieurs secondes. */
  async function majUneLigne(cle, action) {
    const [ib, il] = cle.split(":").map(Number);
    const bloc = COMP.resultats[ib];
    const ligne = bloc.lignes[il];
    await action(bloc, ligne);
    const nouvelle = await reevaluerUnite(bloc.immeuble_id, ligne.designation);
    bloc.lignes[il] = nouvelle;
    recalculerBilan();
    dessinerComparaison();
  }

  $("vue").querySelectorAll("[data-approuver]").forEach(btn => btn.onclick = async () => {
    btn.disabled = true; btn.textContent = "Enregistrement…";
    try {
      await majUneLigne(btn.getAttribute("data-approuver"), (bloc, ligne) =>
        approuverCorrespondance(bloc.immeuble_id, ligne.designation,
                                ligne.dossier_unite, nomUtilisateur()));
    } catch (e) {
      btn.textContent = "Échec : " + e.message; btn.disabled = false;
    }
  });

  $("vue").querySelectorAll("[data-retirer]").forEach(btn => btn.onclick = async () => {
    btn.disabled = true; btn.textContent = "…";
    try {
      await majUneLigne(btn.getAttribute("data-retirer"), (bloc, ligne) =>
        retirerCorrespondance(bloc.immeuble_id, ligne.designation));
    } catch (e) {
      btn.textContent = "Échec : " + e.message; btn.disabled = false;
    }
  });

  $("vue").querySelectorAll("[data-designer]").forEach(btn => btn.onclick = () => {
    const { bloc, ligne } = ligneDe(btn.getAttribute("data-designer"));
    ecranDesignation(bloc, ligne);
  });

  $("btn-retour").onclick = () => ecranAccueil();
}

function ecranDesignation(bloc, ligne) {
  titre("Désigner le dossier", ligne.designation);
  vue(`<div class="bloc">
      <p class="note">Immeuble ${echapper(bloc.immeuble)} — dossier « ${
        echapper(bloc.dossier_onedrive)} ».<br>
      Choisis le dossier qui correspond à « ${echapper(ligne.designation)} ».
      Ton choix sera enregistré et remplacera définitivement la reconnaissance automatique.</p>
      ${boutonsChoix((ligne.candidats_libres || []).map(n => ({ valeur: n, libelle: n })))}
    </div>
    <button class="secondaire" id="btn-retour">Annuler</button>`);
  surChoix(async nom => {
    vue(`<p class="note">Enregistrement…</p>`);
    try {
      await approuverCorrespondance(bloc.immeuble_id, ligne.designation, nom, nomUtilisateur());
      const ib = COMP.resultats.indexOf(bloc);
      const il = bloc.lignes.indexOf(ligne);
      bloc.lignes[il] = await reevaluerUnite(bloc.immeuble_id, ligne.designation);
      recalculerBilan();
      dessinerComparaison();
    } catch (e) {
      vue(`<div class="erreur"><strong>Échec</strong>${echapper(e.message)}</div>
           <button class="secondaire" id="btn-retour">Retour</button>`);
      $("btn-retour").onclick = () => ecranComparaison();
    }
  });
  $("btn-retour").onclick = () => dessinerComparaison();
}

// --- Démarrage -----------------------------------------------------------

async function demarrer() {
  E.installee = window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);

  try { await ouvrirBase(); } catch (_) {}
  if (navigator.storage && navigator.storage.persist) {
    if (!(await navigator.storage.persisted())) await navigator.storage.persist();
  }

  if (!E.installee) {
    avert(`<div class="avert"><strong>À installer sur l'écran d'accueil</strong>
      Dans Safari : bouton Partager, puis « Sur l'écran d'accueil ».
      Utilisée depuis un onglet, l'application perdrait ses photos en attente.</div>`);
  }

  try {
    await initAuth();
    E.connecte = estConnecte();
  } catch (e) {
    avert(`<div class="erreur"><strong>Authentification indisponible</strong>${echapper(e.message)}</div>`);
  }

  await journaliser("demarrage", { version: CONFIG.version_app, installee: E.installee });
  await ecranAccueil();

  /* La file se vide toute seule dès qu'il y a du réseau : c'est un filet,
     le bouton « Envoyer » de l'accueil sert à reprendre la main.
     Deux minutes et non vingt secondes : une relance trop fréquente
     écrasait le délai croissant après un échec et pilonnait Microsoft. */
  window.addEventListener("online", () => lancerFile());
  setInterval(() => traiterFile(), 120000);
  lancerFile();
}

document.addEventListener("DOMContentLoaded", demarrer);
