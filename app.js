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
    html += `<button class="secondaire" id="btn-comparer">Comparer avec OneDrive</button>`;
    html += `<button class="secondaire" id="btn-deconnexion">Se déconnecter</button>`;
  }

  vue(html);
  $("pied").textContent = "Version " + CONFIG.version_app;

  if ($("btn-connexion")) $("btn-connexion").onclick = () => seConnecter();
  if ($("btn-deconnexion")) $("btn-deconnexion").onclick = () => seDeconnecter();
  if ($("btn-comparer")) $("btn-comparer").onclick = () => ecranComparaison();
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

  if (r.statut === "approuve_absent") {
    return erreurEcran(
      `Le dossier approuvé « ${echapper(r.attendu)} » n'existe plus dans « ${
        echapper(imm.dossier_onedrive)} ».<br><br>Passe par « Comparer avec OneDrive » pour le redésigner.`,
      () => ecranUnite(E.brouillon.immeuble_id));
  }

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
    return erreurEcran(
      `Le dossier « ${echapper(nomUnite)} » ne contient aucun dossier locataire.
       L'application ne crée pas de dossier : crée-le dans OneDrive, puis reviens.`,
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
  E.brouillonTexte = ""; E.etat = null; E.proprete = null; E.indexEdition = null;
  VISITE = (await lireVisite(VISITE.visit_id)) || VISITE;
  const piece = VISITE.pieces.find(p => p.piece_id === pieceId);
  titre(piece.libelle, VISITE.bien.unite_source);
  dessinerPiece();
}

function dessinerPiece(message) {
  const piece = VISITE.pieces.find(p => p.piece_id === E.piece);
  const photos = VISITE.photos.filter(p => p.rattachement === E.piece);

  /* Le texte en cours et les sélections survivent au redessin : sans cela,
     prendre une photo au milieu d'une dictée effaçait la saisie. */
  if (E.brouillonTexte === undefined) E.brouillonTexte = "";
  if (E.etat === undefined) E.etat = null;
  if (E.proprete === undefined) E.proprete = null;

  const seg = (cle, valeurs, actif) => `<div class="segments">${valeurs.map(v =>
    `<button class="seg${actif === v ? " actif" : ""}" data-${cle}="${v}">${
      v.replace(/_/g, " ")}</button>`).join("")}</div>`;

  vue(`<div class="barre" id="barre-attente">…</div>
    ${message ? `<div class="succes">${echapper(message)}</div>` : ""}

    <div class="bloc"><h2>Repérage</h2>
      <p class="note">Depuis l'entrée de la pièce : mur de face, de gauche,
      de droite, arrière.</p></div>

    <div class="bloc"><h2>${E.indexEdition === null || E.indexEdition === undefined
        ? "Nouvelle constatation" : "Modifier la constatation"}</h2>
      <textarea id="saisie" rows="3"
        placeholder="Décris ce que tu vois. Micro du clavier disponible.">${
        echapper(E.brouillonTexte)}</textarea>
      ${seg("etat", ["neuf","bon_etat","usage","degrade"], E.etat)}
      ${seg("proprete", ["propre","a_nettoyer","sale"], E.proprete)}
      <p class="note">Appuie une seconde fois sur un choix pour le désélectionner.</p>
      <button id="btn-ajouter-constat">${E.indexEdition === null || E.indexEdition === undefined
        ? "Ajouter la constatation" : "Enregistrer la modification"}</button>
      ${E.indexEdition !== null && E.indexEdition !== undefined
        ? `<button class="secondaire" id="btn-annuler-edition">Annuler la modification</button>` : ""}
    </div>

    <div class="bloc"><h2>${piece.constatations.length} constatation${
        piece.constatations.length > 1 ? "s" : ""}</h2>
      ${piece.constatations.length
        ? piece.constatations.map((c, i) => `<div class="constat">
            <p>${echapper(c.texte)}</p>
            <p class="note">${c.etat ? echapper(c.etat.replace(/_/g, " ")) : "état non précisé"} ·
             ${c.proprete ? echapper(c.proprete.replace(/_/g, " ")) : "propreté non précisée"}
            <button class="lien" data-modif="${i}" style="color:#1f4e5f">modifier</button>
            <button class="lien" data-suppr="${i}">supprimer</button></p></div>`).join("")
        : `<p class="note">Aucune constatation pour l'instant.</p>`}
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

  const champ = $("saisie");

  function majBouton() {
    $("btn-ajouter-constat").disabled = champ.value.trim().length === 0;
  }
  champ.oninput = () => { E.brouillonTexte = champ.value; majBouton(); };
  majBouton();

  /* Bascule : un second appui sur un choix actif le désélectionne. */
  const brancherSegments = (cle) => {
    $("vue").querySelectorAll("[data-" + cle + "]").forEach(b => b.onclick = () => {
      const v = b.getAttribute("data-" + cle);
      E[cle] = (E[cle] === v) ? null : v;
      $("vue").querySelectorAll("[data-" + cle + "]").forEach(x =>
        x.className = "seg" + (x.getAttribute("data-" + cle) === E[cle] ? " actif" : ""));
    });
  };
  brancherSegments("etat");
  brancherSegments("proprete");

  $("vue").querySelectorAll("[data-modif]").forEach(b => b.onclick = () => {
    const i = parseInt(b.getAttribute("data-modif"), 10);
    const c = piece.constatations[i];
    E.brouillonTexte = c.texte;
    E.etat = c.etat || null;
    E.proprete = c.proprete || null;
    E.indexEdition = i;
    dessinerPiece();
    $("saisie").focus();
  });

  $("vue").querySelectorAll("[data-suppr]").forEach(b => b.onclick = async () => {
    const i = parseInt(b.getAttribute("data-suppr"), 10);
    VISITE = await modifierVisite(VISITE.visit_id, v => {
      v.pieces.find(x => x.piece_id === E.piece).constatations.splice(i, 1);
    }) || VISITE;
    E.indexEdition = null;
    programmerDepot();
    dessinerPiece("Constatation supprimée");
  });

  $("btn-ajouter-constat").onclick = async () => {
    const texte = champ.value.trim();
    if (!texte) return;
    const enEdition = E.indexEdition !== null && E.indexEdition !== undefined;
    const i = E.indexEdition;
    VISITE = await modifierVisite(VISITE.visit_id, v => {
      const pc = v.pieces.find(x => x.piece_id === E.piece);
      const entree = { texte, etat: E.etat, proprete: E.proprete };
      if (enEdition) pc.constatations[i] = entree; else pc.constatations.push(entree);
    }) || VISITE;
    E.brouillonTexte = ""; E.etat = null; E.proprete = null; E.indexEdition = null;
    programmerDepot();
    dessinerPiece(enEdition ? "Constatation modifiée" : "Constatation enregistrée");
  };

  if ($("btn-annuler-edition")) $("btn-annuler-edition").onclick = () => {
    E.brouillonTexte = ""; E.etat = null; E.proprete = null; E.indexEdition = null;
    dessinerPiece();
  };

  $("btn-photo").onclick = () => $("appareil").click();
  $("appareil").onchange = async (ev) => {
    const fichier = ev.target.files && ev.target.files[0];
    if (!fichier) return;
    E.brouillonTexte = champ.value;          // la dictée en cours est préservée
    $("btn-photo").disabled = true;
    $("btn-photo").textContent = "Enregistrement…";
    try {
      await ajouterPhoto(VISITE, E.piece, fichier);
    } catch (e) {
      avert(`<div class="erreur"><strong>Photo non enregistrée</strong>${echapper(e.message)}</div>`);
    }
    VISITE = (await lireVisite(VISITE.visit_id)) || VISITE;
    dessinerPiece("Photo enregistrée");
  };

  $("btn-retour").onclick = () => {
    E.brouillonTexte = ""; E.etat = null; E.proprete = null; E.indexEdition = null;
    ecranVisiteReprise(VISITE);
  };
  majCompteurAttente();
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
  COMP.resultats.forEach(bloc => bloc.lignes.forEach(l => {
    b.total++;
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

  // la file se vide en continu, dès qu'il y a du réseau
  window.addEventListener("online", () => lancerFile());
  setInterval(() => lancerFile(), 20000);
  lancerFile();
}

document.addEventListener("DOMContentLoaded", demarrer);
