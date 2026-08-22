/* EDL — Écrans
   Étape 3 : démarrage d'une visite. La capture arrive à l'étape suivante. */

const E = {
  installee: false,
  connecte: false,
  liste: null,
  brouillon: {},     // visite en cours de préparation
  ecran: "accueil",
};

function $(id) { return document.getElementById(id); }
function vue(html) { $("vue").innerHTML = html; }
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

  const enCours = await visiteEnCours();
  const attente = await nombreEnAttente();

  let html = "";

  if (enCours) {
    html += `<div class="avert"><strong>Visite interrompue</strong>
      ${echapper(enCours.bien.unite_source)} — ${enCours.type}, commencée le
      ${new Date(enCours.date_debut).toLocaleString("fr-BE")}.
      <button id="btn-reprendre">Reprendre cette visite</button></div>`;
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

  html += `<div class="bloc"><h2>État</h2>
    <div class="ligne"><span>Compte</span><span class="val ${E.connecte ? "ok" : "ko"}">${
      E.connecte ? echapper(nomUtilisateur()) : "non connecté"}</span></div>
    <div class="ligne"><span>Installée sur l'écran d'accueil</span><span class="val ${
      E.installee ? "ok" : "ko"}">${E.installee ? "oui" : "non"}</span></div>
    <div class="ligne"><span>Photos en attente d'envoi</span><span class="val ${
      attente ? "ko" : "ok"}">${attente}</span></div>
    <div class="ligne"><span>Liste des locataires</span><span class="val">${
      E.liste ? E.liste.total_unites + " unités" : "non chargée"}</span></div>
    </div>`;

  if (E.connecte) {
    html += `<button class="secondaire" id="btn-deconnexion">Se déconnecter</button>`;
  }

  vue(html);
  $("pied").textContent = "Version " + CONFIG.version_app;

  if ($("btn-connexion")) $("btn-connexion").onclick = () => seConnecter();
  if ($("btn-deconnexion")) $("btn-deconnexion").onclick = () => seDeconnecter();
  if ($("btn-nouvelle")) $("btn-nouvelle").onclick = () => ecranType();
  if ($("btn-reprendre")) $("btn-reprendre").onclick = () => ecranVisiteReprise(enCours);
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

  if (r.statut === "introuvable") {
    return erreurEcran(
      `Aucun dossier ne correspond à « ${echapper(designation)} » dans « ${
        echapper(imm.dossier_onedrive)} ».<br><br>Dossiers présents : ${
        echapper((r.tous || []).join(", "))}`,
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

  E.brouillon.confirmee = false;
  suiteDossier(r.nom, r.ref);
}

async function suiteDossier(nomUnite, refUnite) {
  E.brouillon.dossier_unite = nomUnite;
  vue(`<p class="note">Lecture des dossiers locataires…</p>`);
  let locs;
  try { locs = await listerDossiersLocataires(refUnite); }
  catch (e) { return erreurEcran(e.message, () => ecranUnite(E.brouillon.immeuble_id)); }

  if (locs.length === 0) {
    return erreurEcran(
      `Le dossier « ${echapper(nomUnite)} » ne contient aucun dossier locataire.
       L'application ne crée pas de dossier : crée-le dans OneDrive, puis reviens.`,
      () => ecranUnite(E.brouillon.immeuble_id));
  }

  titre("Dossier locataire", "Étape 3 sur 5 — " + nomUnite);
  vue(`<p class="fil">${E.brouillon.type} · ${echapper(E.brouillon.immeuble_nom)} · ${echapper(nomUnite)}</p>
    <div class="bloc">${boutonsChoix(locs.map(l => ({ valeur: l.nom, libelle: l.nom })))}</div>
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
    return erreurEcran(
      `Le dossier « ${echapper(c.attendu)} » n'existe pas chez ${echapper(locataire.nom)}.<br><br>
       Présents : ${echapper(c.presents.join(", ") || "aucun")}.<br><br>
       L'application ne crée pas de dossier. Crée-le dans OneDrive avant de commencer.`,
      () => ecranUnite(E.brouillon.immeuble_id));
  }

  E.brouillon.dossier_locataire = locataire.nom;
  E.brouillon.ref_cible = c.ref;
  ecranComposition();
}

function erreurEcran(message, retour) {
  vue(`<div class="erreur"><strong>Impossible de continuer</strong>${message}</div>
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
      ${inter("ista_present", "Répartiteurs ISTA", r.ista_present)}
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

  vue(`<div class="bloc"><h2>Options</h2>
      ${b.type === "EDLS" ? inter("chiffrage", "Chiffrage des dégâts", b.chiffrage)
        : `<p class="note">Le chiffrage ne concerne que les états des lieux de sortie.</p>`}
      ${inter("pret_meubles", "Prêt de meubles Samadhi", b.pret_meubles)}
    </div>
    <div class="bloc"><h2>Destination</h2>
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
    erreurEcran("Création impossible : " + echapper(e.message), () => ecranOptions());
  }
}

// --- Visite en cours -----------------------------------------------------

let VISITE = null;

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
    <button class="secondaire" id="btn-accueil">Retour à l'accueil</button>`);

  $("vue").querySelectorAll("[data-piece]").forEach(b =>
    b.onclick = () => ecranPiece(b.getAttribute("data-piece")));
  $("btn-accueil").onclick = () => ecranAccueil();
  majCompteurAttente();
}

// --- Écran d'une pièce ---------------------------------------------------

async function ecranPiece(pieceId) {
  E.ecran = "piece";
  E.piece = pieceId;
  VISITE = (await lireVisite(VISITE.visit_id)) || VISITE;
  const piece = VISITE.pieces.find(p => p.piece_id === pieceId);
  titre(piece.libelle, VISITE.bien.unite_source);
  dessinerPiece();
}

function dessinerPiece() {
  const piece = VISITE.pieces.find(p => p.piece_id === E.piece);
  const photos = VISITE.photos.filter(p => p.rattachement === E.piece);

  vue(`<div class="barre" id="barre-attente">…</div>

    <div class="bloc"><h2>Repérage</h2>
      <p class="note">Depuis l'entrée de la pièce : mur de face, de gauche,
      de droite, arrière.</p></div>

    <div class="bloc"><h2>Constatations</h2>
      ${piece.constatations.length
        ? piece.constatations.map((c, i) => `<div class="constat">
            <p>${echapper(c.texte)}</p>
            <p class="note">${c.etat || "état non précisé"} · ${c.proprete || "propreté non précisée"}
            <button class="lien" data-suppr="${i}">supprimer</button></p></div>`).join("")
        : `<p class="note">Aucune constatation.</p>`}
      <textarea id="saisie" rows="3" placeholder="Décris ce que tu vois. Micro du clavier disponible."></textarea>
      <div class="segments" id="seg-etat">
        ${["neuf","bon_etat","usage","degrade"].map(v =>
          `<button class="seg" data-etat="${v}">${v.replace("_"," ")}</button>`).join("")}
      </div>
      <div class="segments" id="seg-proprete">
        ${["propre","a_nettoyer","sale"].map(v =>
          `<button class="seg" data-proprete="${v}">${v.replace("_"," ")}</button>`).join("")}
      </div>
      <button id="btn-ajouter-constat">Ajouter la constatation</button>
    </div>

    <div class="bloc"><h2>${photos.length} photo${photos.length > 1 ? "s" : ""}</h2>
      ${photos.length ? photos.map(p => `<div class="ligne">
          <span>${echapper(p.nom_fichier)}</span>
          <span class="val ${p.statut_transfert === "confirme" ? "ok" : "ko"}">${
            p.statut_transfert === "confirme" ? "enregistrée" : "en attente"}</span></div>`).join("")
        : `<p class="note">Aucune photo.</p>`}
      <input type="file" accept="image/*" capture="environment" id="appareil" class="cache">
      <button id="btn-photo">Prendre une photo</button>
    </div>

    <button class="secondaire" id="btn-retour">Retour aux pièces</button>`);

  E.etat = null; E.proprete = null;

  $("vue").querySelectorAll("[data-etat]").forEach(b => b.onclick = () => {
    E.etat = b.getAttribute("data-etat");
    $("vue").querySelectorAll("[data-etat]").forEach(x => x.className = "seg");
    b.className = "seg actif";
  });
  $("vue").querySelectorAll("[data-proprete]").forEach(b => b.onclick = () => {
    E.proprete = b.getAttribute("data-proprete");
    $("vue").querySelectorAll("[data-proprete]").forEach(x => x.className = "seg");
    b.className = "seg actif";
  });
  $("vue").querySelectorAll("[data-suppr]").forEach(b => b.onclick = async () => {
    const i = parseInt(b.getAttribute("data-suppr"), 10);
    VISITE = await modifierVisite(VISITE.visit_id, v => {
      v.pieces.find(x => x.piece_id === E.piece).constatations.splice(i, 1);
    }) || VISITE;
    dessinerPiece();
  });

  $("btn-ajouter-constat").onclick = async () => {
    const texte = $("saisie").value.trim();
    if (!texte) return;
    VISITE = await modifierVisite(VISITE.visit_id, v => {
      const pc = v.pieces.find(x => x.piece_id === E.piece);
      pc.constatations.push({ texte, etat: E.etat, proprete: E.proprete });
    }) || VISITE;
    await deposerFichierVisite(VISITE);
    dessinerPiece();
  };

  $("btn-photo").onclick = () => $("appareil").click();
  $("appareil").onchange = async (ev) => {
    const fichier = ev.target.files && ev.target.files[0];
    if (!fichier) return;
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

  $("btn-retour").onclick = () => ecranVisiteReprise(VISITE);
  majCompteurAttente();
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

  // la file se vide en continu, dès qu'il y a du réseau
  window.addEventListener("online", () => lancerFile());
  setInterval(() => lancerFile(), 20000);
  lancerFile();
}

document.addEventListener("DOMContentLoaded", demarrer);
