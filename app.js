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
      terminees.slice(0, 8).map((v, i) => `<div class="ligne">
        <span>${echapper(v.bien.unite_source)} — ${v.type}</span>
        <span class="val gris">${new Date(v.date_debut).toLocaleDateString("fr-BE")}</span>
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

  $("vue").querySelectorAll("[data-reprendre]").forEach(b => b.onclick = () =>
    ecranVisiteReprise(ouvertes[parseInt(b.getAttribute("data-reprendre"), 10)]));

  $("vue").querySelectorAll("[data-abandonner]").forEach(b => b.onclick = () =>
    ecranAbandon(ouvertes[parseInt(b.getAttribute("data-abandonner"), 10)]));

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

  E.brouillon.dossier_locataire = locataire.nom;
  E.brouillon.ref_cible = c.ref;
  ecranComposition();
}

/* Le message peut venir de Microsoft et contenir un nom de dossier :
   l'échappement est fait ICI, une fois pour toutes. Les appelants
   passent du texte brut ; ceux qui veulent du HTML utilisent {html:...}. */
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
    <button class="secondaire" id="btn-releves">Compteurs, clés et état général</button>
    <button id="btn-cloturer">Terminer la visite</button>
    <button class="secondaire" id="btn-accueil">Retour à l'accueil</button>`);

  $("vue").querySelectorAll("[data-piece]").forEach(b =>
    b.onclick = () => ecranPiece(b.getAttribute("data-piece")));
  $("btn-releves").onclick = () => ecranReleves();
  $("btn-cloturer").onclick = () => ecranCloture(VISITE);
  $("btn-accueil").onclick = async () => {
    await deposerMaintenant(VISITE);
    ecranAccueil();
  };
  majCompteurAttente();
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

// --- Clôture : identité, lecture, signatures, PDF ------------------------

async function ecranCloture(visite) {
  E.ecran = "cloture";
  VISITE = (await lireVisite(visite.visit_id)) || visite;
  const V = VISITE;
  const attente = await nombreEnAttente();
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

  if (attente > 0) {
    html += `<div class="erreur"><strong>Clôture impossible</strong>
      ${attente} photo(s) ne sont pas encore enregistrées dans OneDrive.
      Reviens quand le réseau sera disponible.</div>
      <button disabled>Signer et clôturer</button>`;
  } else {
    html += `<button id="btn-identites">Passer à la signature</button>`;
  }
  html += `<button class="secondaire" id="btn-retour">Retour</button>`;
  vue(html);

  if ($("btn-identites")) $("btn-identites").onclick = () => ecranIdentites();
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

  const url = URL.createObjectURL(doc.output("blob"));
  vue(`<div class="bloc"><h2>À faire lire au locataire</h2>
      <p class="note">Fais défiler le document en entier avec le locataire.
      Il ne pourra plus être modifié après signature.</p>
      <iframe class="apercu" src="${url}"></iframe>
      <p class="note"><a href="${url}" target="_blank">Ouvrir en plein écran</a></p>
    </div>
    <div class="bloc"><h2>Confirmation de lecture</h2>
      <div class="interrupteur"><span>Le locataire déclare avoir lu et approuvé</span>
        <span class="segments">
          <button class="seg" id="lu-oui">oui</button>
        </span></div>
      <p class="note">Cette confirmation est distincte de la signature :
      elle atteste du consentement éclairé.</p>
    </div>
    <button id="btn-signatures" disabled>Passer aux signatures</button>
    <button class="secondaire" id="btn-retour">Retour</button>`);

  $("lu-oui").onclick = () => {
    E.luEtApprouve = !E.luEtApprouve;
    $("lu-oui").className = "seg" + (E.luEtApprouve ? " actif" : "");
    $("btn-signatures").disabled = !E.luEtApprouve;
  };
  $("btn-signatures").onclick = () => ecranSignatures();
  $("btn-retour").onclick = () => { URL.revokeObjectURL(url); ecranIdentites(); };
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

  vue(`<div class="bloc"><h2>Signer du doigt</h2>
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
      nettoyerLibelle(V.bien.unite_source)}_${V.visit_id.split("_").pop()}.pdf`;
    const item = await deposerPdf(V, nom, donnees);

    VISITE = await modifierVisite(VISITE.visit_id, v => {
      v.statut = "signee";
      v.date_signature = V.date_signature;
      v.preuve = v.preuve || {};
      v.preuve.hash_pdf_pv_sha256 = empreinte;
      v.preuve.pv_onedrive_item_id = item ? item.id : null;
      v.preuve.pv_nom_fichier = nom;
      v.preuve.horodatage_local = V.date_signature;
      v.preuve.lu_et_approuve = true;
      v.preuve.courriel_destinataires =
        (v.parties.preneurs || []).map(x => x.email).filter(Boolean);
    }) || VISITE;

    await deposerMaintenant(VISITE);
    await journaliser("visite_signee", { visit_id: VISITE.visit_id, depot: !!item });

    vue(`<div class="succes">Document signé et déposé</div>
      <div class="bloc"><h2>${echapper(nom)}</h2>
        <div class="ligne"><span>Empreinte</span><span class="val" style="font-size:11px">${
          empreinte ? echapper(empreinte.slice(0, 32)) + "…" : "—"}</span></div>
        <div class="ligne"><span>Signé le</span><span class="val">${
          new Date(V.date_signature).toLocaleString("fr-BE")}</span></div>
        <div class="ligne"><span>Signatures</span><span class="val">${blocs.length}</span></div>
      </div>
      <div class="avert"><strong>À faire maintenant</strong>
        Envoie le PDF au locataire depuis OneDrive, le jour même :
        sa réception fait partie de la preuve.</div>
      <button id="btn-accueil">Retour à l'accueil</button>`);
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
      ${photos.length ? photos.map(p => `<div class="constat">
          <div class="ligne"><span>${echapper(p.nom_fichier)}</span>
          <span class="val ${p.statut_transfert === "confirme" ? "ok" : "ko"}">${
            p.statut_transfert === "confirme" ? "enregistrée" : "en attente"}</span></div>
          <p class="note"><button class="lien" data-suppr-photo="${
            echapper(p.photo_id)}">retirer de l'état des lieux</button></p></div>`).join("")
        : `<p class="note">Aucune photo.</p>`}
      <input type="file" accept="image/*" capture="environment" id="appareil" class="cache">
      <button id="btn-photo">Prendre une photo</button>
    </div>

    <button class="secondaire" id="btn-retour">Retour aux pièces</button>`);

  const champ = $("saisie");

  /* Un constat peut se limiter à « bon état / propre », sans commentaire :
     c'est même le cas le plus fréquent. Le bouton s'active donc dès qu'il
     y a du texte, OU un état, OU une propreté. */
  function majBouton() {
    const vide = champ.value.trim().length === 0 && !E.etat && !E.proprete;
    $("btn-ajouter-constat").disabled = vide;
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
      majBouton();
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
    try {
      VISITE = await modifierVisite(VISITE.visit_id, v => {
        v.pieces.find(x => x.piece_id === E.piece).constatations.splice(i, 1);
      }) || VISITE;
    } catch (e) {
      return dessinerPiece("Suppression impossible : " + e.message);
    }
    E.indexEdition = null;
    programmerDepot();
    dessinerPiece("Constatation supprimée");
  });

  $("btn-ajouter-constat").onclick = async () => {
    const texte = champ.value.trim();
    if (!texte && !E.etat && !E.proprete) return;
    const enEdition = E.indexEdition !== null && E.indexEdition !== undefined;
    const i = E.indexEdition;
    const bouton = $("btn-ajouter-constat");
    bouton.disabled = true;
    try {
      VISITE = await modifierVisite(VISITE.visit_id, v => {
        const pc = v.pieces.find(x => x.piece_id === E.piece);
        const entree = { texte, etat: E.etat, proprete: E.proprete };
        if (enEdition) pc.constatations[i] = entree; else pc.constatations.push(entree);
      }) || VISITE;
    } catch (e) {
      bouton.disabled = false;
      return dessinerPiece("Enregistrement impossible : " + e.message);
    }
    E.brouillonTexte = ""; E.etat = null; E.proprete = null; E.indexEdition = null;
    programmerDepot();
    dessinerPiece(enEdition ? "Constatation modifiée" : "Constatation enregistrée");
  };

  if ($("btn-annuler-edition")) $("btn-annuler-edition").onclick = () => {
    E.brouillonTexte = ""; E.etat = null; E.proprete = null; E.indexEdition = null;
    dessinerPiece();
  };

  $("vue").querySelectorAll("[data-suppr-photo]").forEach(b => b.onclick = async () => {
    const id = b.getAttribute("data-suppr-photo");
    b.disabled = true;
    try {
      VISITE = await retirerPhoto(VISITE.visit_id, id) || VISITE;
    } catch (e) {
      return dessinerPiece("Retrait impossible : " + e.message);
    }
    await journaliser("photo_retiree", { photo_id: id });
    programmerDepot();
    dessinerPiece("Photo retirée — le fichier reste dans OneDrive");
  });

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

  $("btn-retour").onclick = async () => {
    E.brouillonTexte = ""; E.etat = null; E.proprete = null; E.indexEdition = null;
    await deposerMaintenant(VISITE);
    ecranVisiteReprise(VISITE);
  };
  majCompteurAttente(photos.length);
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
