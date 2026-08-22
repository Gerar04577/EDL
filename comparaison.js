/* EDL — Correspondances liste des locataires / OneDrive

   Une correspondance APPROUVÉE par l'utilisateur fait foi et remplace
   définitivement le calcul automatique. Elle est enregistrée dans OneDrive,
   donc partagée entre les trois utilisateurs et conservée d'un appareil
   à l'autre.

   Comparaison liste des locataires / OneDrive
   Repris de la fonctionnalité « Comparer noms OneDrive » de Gestion Loyers v84,
   étendue de deux niveaux : dossier locataire, puis EDLE et EDLS.

   Contrôle à faire au bureau, jamais debout dans un logement. */

/* ---- Table des correspondances approuvées -------------------------------
   Déposée dans le dossier racine, à côté des dossiers d'immeubles. */

const FICHIER_CORRESPONDANCES = "EDL_correspondances.json";
let _correspondances = null;

function cleUnite(immeubleId, designation) { return immeubleId + "|" + designation; }

async function chargerCorrespondances(forcer) {
  if (_correspondances && !forcer) return _correspondances;
  try {
    const racine = await obtenirRefRacineImmobilier();
    const enfants = await enfantsDeRef(racine);
    const f = enfants.find(e => (e.name || "").trim() === FICHIER_CORRESPONDANCES);
    if (!f) { _correspondances = { version: 1, unites: {} }; return _correspondances; }
    const ref = refDe(f, racine.driveId);
    _correspondances = await telechargerJson(ref);
    if (!_correspondances.unites) _correspondances.unites = {};
  } catch (e) {
    await journaliser("correspondances_lecture_echouee", String(e && e.message));
    _correspondances = { version: 1, unites: {} };
  }
  return _correspondances;
}

async function enregistrerCorrespondances() {
  const racine = await obtenirRefRacineImmobilier();
  const chemin = racine.driveId
    ? `/drives/${racine.driveId}/items/${racine.id}:/${FICHIER_CORRESPONDANCES}:/content`
    : `/me/drive/items/${racine.id}:/${FICHIER_CORRESPONDANCES}:/content`;
  const res = await appelGraph(chemin, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(_correspondances, null, 1),
  });
  if (!res.ok) throw new Error(`Enregistrement : ${await detailErreur(res)}`);
  await journaliser("correspondances_enregistrees",
    { unites: Object.keys(_correspondances.unites).length });
  return true;
}

async function approuverCorrespondance(immeubleId, designation, dossierUnite, operateur) {
  await chargerCorrespondances();
  _correspondances.unites[cleUnite(immeubleId, designation)] = {
    dossier_unite: dossierUnite,
    approuve_le: new Date().toISOString(),
    approuve_par: operateur || null,
  };
  await enregistrerCorrespondances();
}

async function retirerCorrespondance(immeubleId, designation) {
  await chargerCorrespondances();
  delete _correspondances.unites[cleUnite(immeubleId, designation)];
  await enregistrerCorrespondances();
}

function correspondanceApprouvee(immeubleId, designation) {
  if (!_correspondances) return null;
  return _correspondances.unites[cleUnite(immeubleId, designation)] || null;
}

/* ---- Évaluation d'une unité --------------------------------------------

   Le niveau « dossier locataire » est OPTIONNEL : dans certaines unités,
   EDLE et EDLS sont placés directement sous le dossier de l'unité.
   Les deux structures sont acceptées. */

const DOSSIERS_DOCUMENTS = ["EDLE", "EDLS", "BAIL", "SAMADHI"];

function estDossierDocument(nom) {
  return DOSSIERS_DOCUMENTS.includes(String(nom || "").trim().toUpperCase());
}

/* Détection des fautes de frappe dans les noms de dossiers : « ELDS »
   pour EDLS, « EDLE » écrit « EDEL »… Deux noms sont proches s'ils sont
   composés exactement des mêmes lettres. */
function memesLettres(a, b) {
  const t = s => String(s || "").toUpperCase().replace(/[^A-Z]/g, "").split("").sort().join("");
  return t(a) === t(b) && String(a).toUpperCase() !== String(b).toUpperCase();
}

function chercherFauteDeFrappe(attendu, presents) {
  return presents.find(n => memesLettres(n, attendu)) || null;
}

/* Choix du dossier locataire pertinent.
   « Le plus récemment modifié » est un mauvais critère : un dossier créé
   pour un locataire à venir peut être vide et plus récent que celui du
   locataire en place. On privilégie, dans l'ordre :
     1. le dossier dont le nom recoupe celui du locataire de la liste
     2. le dossier qui contient réellement un EDLE ou un EDLS
     3. à défaut, le plus récemment modifié */
function motsSignificatifs(nom) {
  return normaliserNom(nom).split(/[^A-Z0-9]+/)
    .filter(m => m.length >= 4);
}

function scoreNom(nomDossier, preneurs) {
  if (!preneurs || preneurs.length === 0) return 0;
  const motsDossier = new Set(motsSignificatifs(nomDossier));
  let score = 0;
  preneurs.forEach(p => motsSignificatifs(p).forEach(m => { if (motsDossier.has(m)) score++; }));
  return score;
}

async function choisirDossierLocataire(locs, unite, refUnite) {
  if (locs.length === 1) return { choix: locs[0], motif: "seul dossier" };

  // 1. recoupement de nom
  const notes = locs.map(l => ({ l, s: scoreNom(l.name, unite.preneurs) }));
  const meilleur = Math.max(...notes.map(n => n.s));
  const gagnants = notes.filter(n => n.s === meilleur && n.s > 0);
  if (gagnants.length === 1) return { choix: gagnants[0].l, motif: "nom du locataire" };

  // 2. contenu réel : on inspecte du plus récent au plus ancien
  const ordonnes = locs.slice().sort((a, b) =>
    String(b.lastModifiedDateTime || "").localeCompare(String(a.lastModifiedDateTime || "")));
  for (const l of ordonnes) {
    try {
      const enfants = (await enfantsDeRef(refDe(l, refUnite.driveId)))
        .filter(e => e.folder || e.remoteItem);
      const noms = enfants.map(e => String(e.name || "").trim().toUpperCase());
      if (noms.includes("EDLE") || noms.includes("EDLS"))
        return { choix: l, motif: "contient les états des lieux", enfants };
    } catch (_) { /* on continue */ }
  }

  // 3. à défaut
  return { choix: ordonnes[0], motif: "plus récemment modifié" };
}

/* Une unité non contrôlée — inoccupée ou hors périmètre — possède quand
   même un dossier. On le rattache, sans y descendre, pour qu'il ne soit
   pas présenté comme « dossier sans unité correspondante ». */
function marquerDossier(imm, unite, noms, utilises, ligne) {
  const a = correspondanceApprouvee(imm.immeuble_id, unite.designation);
  if (a && noms.includes(a.dossier_unite)) {
    ligne.approuvee = true;
    ligne.dossier_unite = a.dossier_unite;
    if (utilises) utilises.add(a.dossier_unite);
    return;
  }
  const r = trouverDossierUnite(unite.designation, noms);
  if (r.trouve) {
    ligne.dossier_unite = r.trouve;
    if (utilises) utilises.add(r.trouve);
  } else if (r.candidats && utilises) {
    r.candidats.forEach(c => utilises.add(c));
  }
}

async function evaluerUnite(imm, unite, dossiers, noms, refImmeuble, utilises) {
  const ligne = {
    designation: unite.designation,
    locataire: unite.locataire,
    inoccupe: unite.inoccupe,
    dossier_unite: null,
    statut: "manquant",
    ambigu: false,
    candidats: [],
    dossiers_locataires: [],
    edle: null,
    edls: null,
    message: null,
  };

  /* Unité qui ne fait pas l'objet d'un état des lieux — un garage, par
     exemple. Le type est réglé dans le fichier de configuration. */
  const typeUnite = extraireTypeEtNumero(unite.designation).type;
  if (CONFIG.types_sans_etat_des_lieux.includes(typeUnite)) {
    ligne.statut = "hors_perimetre";
    ligne.message = "aucun état des lieux attendu pour ce type d'unité";
    marquerDossier(imm, unite, noms, utilises, ligne);
    return ligne;
  }

  /* Unité inoccupée : il n'y a pas d'état des lieux à chercher.
     On ne descend pas, et on ne signale aucune anomalie. */
  if (unite.inoccupe) {
    ligne.statut = "vide_normal";
    ligne.message = "unité inoccupée — aucun état des lieux attendu";
    marquerDossier(imm, unite, noms, utilises, ligne);
    return ligne;
  }

  const approuvee = correspondanceApprouvee(imm.immeuble_id, unite.designation);
  let r;
  if (approuvee && noms.includes(approuvee.dossier_unite)) {
    r = { trouve: approuvee.dossier_unite, candidats: [], ambigu: false };
    ligne.approuvee = true;
    ligne.approuve_le = approuvee.approuve_le;
  } else if (approuvee) {
    ligne.statut = "approuve_absent";
    ligne.message = `le dossier approuvé « ${approuvee.dossier_unite} » n'existe plus`;
    ligne.candidats_libres = noms;
    return ligne;
  } else {
    r = trouverDossierUnite(unite.designation, noms);
    ligne.approuvee = false;
  }

  if (r.ambigu) {
    ligne.statut = "ambigu";
    ligne.ambigu = true;
    ligne.candidats = r.candidats;
    ligne.message = "plusieurs dossiers possibles — à trancher";
    ligne.candidats_libres = noms;
    if (utilises) r.candidats.forEach(c => utilises.add(c));
    return ligne;
  }
  if (!r.trouve) {
    ligne.message = "aucun dossier correspondant — à désigner";
    ligne.candidats_libres = noms;
    return ligne;
  }

  ligne.dossier_unite = r.trouve;
  if (utilises) utilises.add(r.trouve);
  const elUnite = dossiers.find(e => e.name === r.trouve);
  const refUnite = refDe(elUnite, refImmeuble.driveId);

  let sousUnite = [];
  try {
    sousUnite = (await enfantsDeRef(refUnite)).filter(e => e.folder || e.remoteItem);
  } catch (e) {
    ligne.statut = "erreur";
    ligne.message = e.message;
    return ligne;
  }

  /* Structure PLATE : EDLE et EDLS directement sous l'unité. */
  const plate = sousUnite.some(e => estDossierDocument(e.name));
  let contenants;

  if (plate) {
    ligne.structure = "plate";
    contenants = sousUnite;
    ligne.dossier_courant = null;
  } else {
    ligne.structure = "par_locataire";
    const locs = sousUnite;
    ligne.dossiers_locataires = locs.map(e => e.name);
    if (locs.length === 0) {
      ligne.statut = unite.inoccupe ? "vide_normal" : "sans_locataire";
      ligne.message = unite.inoccupe
        ? "unité inoccupée, aucun dossier locataire"
        : "aucun dossier locataire alors que l'unité est occupée";
      return ligne;
    }
    /* Une unité contient les dossiers de plusieurs locataires ou
       colocataires successifs. On inspecte TOUS ces dossiers : conclure
       sur un seul conduit à signaler « incomplet » à tort. */
    const detail = [];
    for (const l of locs) {
      let enf = [];
      try {
        enf = (await enfantsDeRef(refDe(l, refUnite.driveId))).filter(e => e.folder || e.remoteItem);
      } catch (_) { /* dossier illisible : traité comme vide */ }
      const n = enf.map(e => String(e.name || "").trim().toUpperCase());
      detail.push({
        nom: l.name, ref: l, enfants: enf,
        edle: n.includes(CONFIG.onedrive.sous_dossier_edle),
        edls: n.includes(CONFIG.onedrive.sous_dossier_edls),
        score: scoreNom(l.name, unite.preneurs),
        modifie_le: l.lastModifiedDateTime || null,
      });
    }
    ligne.detail_locataires = detail.map(d => ({
      nom: d.nom, edle: d.edle, edls: d.edls,
    }));

    /* Le dossier du locataire EN PLACE, dans l'ordre :
       recoupement de nom, puis présence des états des lieux, puis récence. */
    const parNom = detail.filter(d => d.score > 0)
      .sort((a, b) => b.score - a.score);
    const avecDocs = detail.filter(d => d.edle || d.edls)
      .sort((a, b) => String(b.modifie_le || "").localeCompare(String(a.modifie_le || "")));
    const parDate = detail.slice()
      .sort((a, b) => String(b.modifie_le || "").localeCompare(String(a.modifie_le || "")));

    let retenu, motif;
    if (parNom.length) { retenu = parNom[0]; motif = "nom du locataire"; }
    else if (avecDocs.length) { retenu = avecDocs[0]; motif = "contient les états des lieux"; }
    else { retenu = parDate[0]; motif = "plus récemment modifié"; }

    ligne.dossier_courant = retenu.nom;
    ligne.motif_choix = locs.length === 1 ? "seul dossier" : motif;
    ligne.autres_avec_docs = detail
      .filter(d => d !== retenu && (d.edle || d.edls))
      .map(d => d.nom);
    contenants = retenu.enfants;
  }

  const nomsSous = contenants.map(e => String(e.name || "").trim().toUpperCase());
  ligne.edle = nomsSous.includes(CONFIG.onedrive.sous_dossier_edle);
  ligne.edls = nomsSous.includes(CONFIG.onedrive.sous_dossier_edls);
  ligne.sous_dossiers = contenants.map(e => e.name);

  if (ligne.edle && ligne.edls) {
    ligne.statut = "complet";
  } else {
    ligne.statut = "incomplet";
    const manque = [];
    const fautes = [];
    if (!ligne.edle) {
      manque.push("EDLE");
      const f = chercherFauteDeFrappe(CONFIG.onedrive.sous_dossier_edle, ligne.sous_dossiers);
      if (f) fautes.push(`« ${f} » à renommer en EDLE`);
    }
    if (!ligne.edls) {
      manque.push("EDLS");
      const f = chercherFauteDeFrappe(CONFIG.onedrive.sous_dossier_edls, ligne.sous_dossiers);
      if (f) fautes.push(`« ${f} » à renommer en EDLS`);
    }
    ligne.message = "dossier manquant : " + manque.join(" et ");
    if (ligne.autres_avec_docs && ligne.autres_avec_docs.length) {
      ligne.message += " chez ce locataire — présents chez : " +
        ligne.autres_avec_docs.join(", ");
    }
    if (fautes.length) {
      ligne.faute_de_frappe = fautes.join(" · ");
      ligne.message += " — faute de frappe probable : " + ligne.faute_de_frappe;
    }
  }
  return ligne;
}

/* Réévaluation d'une seule unité, pour éviter de reparcourir les sept
   immeubles après chaque approbation. */
async function reevaluerUnite(immeubleId, designation) {
  const liste = await chargerLocataires();
  const imm = liste.immeubles.find(i => i.immeuble_id === immeubleId);
  const unite = imm.unites.find(u => u.designation === designation);
  const refImmeuble = await obtenirRefImmeuble(immeubleId);
  const dossiers = (await enfantsDeRef(refImmeuble)).filter(e => e.folder || e.remoteItem);
  const noms = dossiers.map(e => e.name);
  return evaluerUnite(imm, unite, dossiers, noms, refImmeuble, null);
}

/* ---- Comparaison ------------------------------------------------------- */

async function comparerAvecOneDrive(surProgres) {
  const liste = await chargerLocataires(true);
  await chargerCorrespondances(true);
  const resultats = [];

  for (const imm of liste.immeubles) {
    if (surProgres) surProgres(imm.nom);

    const bloc = {
      immeuble: imm.nom,
      immeuble_id: imm.immeuble_id,
      dossier_onedrive: imm.dossier_onedrive,
      erreur: null,
      lignes: [],
      extras: [],
    };

    let dossiers = [], refImmeuble = null;
    try {
      refImmeuble = await obtenirRefImmeuble(imm.immeuble_id);
      const enfants = await enfantsDeRef(refImmeuble);
      dossiers = enfants.filter(e => e.folder || e.remoteItem);
    } catch (e) {
      bloc.erreur = e.message;
      resultats.push(bloc);
      continue;
    }

    const noms = dossiers.map(e => e.name);
    const utilises = new Set();

    for (const unite of imm.unites) {
      const ligne = await evaluerUnite(imm, unite, dossiers, noms, refImmeuble, utilises);
      bloc.lignes.push(ligne);
    }

    /* Dossiers présents dans OneDrive sans unité correspondante :
       archives, anciens baux, photos de géomètre. Signalés à part,
       jamais présentés comme des anomalies. */
    bloc.extras = noms.filter(n => !utilises.has(n));
    resultats.push(bloc);
  }

  const bilan = {
    total: 0, complet: 0, incomplet: 0, manquant: 0,
    ambigu: 0, sans_locataire: 0, vide_normal: 0, erreur: 0,
    approuve_absent: 0, hors_perimetre: 0, approuvees: 0,
  };
  /* Récapitulatif des dossiers mal orthographiés, pour les corriger
     d'un seul coup dans OneDrive au lieu de les chercher un par un. */
  const fautes = [];
  resultats.forEach(b => b.lignes.forEach(l => {
    bilan.total++;
    if (bilan[l.statut] !== undefined) bilan[l.statut]++;
    if (l.approuvee) bilan.approuvees++;
    if (l.faute_de_frappe) {
      fautes.push({
        immeuble: b.immeuble, unite: l.designation,
        chemin: [l.dossier_unite, l.dossier_courant].filter(Boolean).join(" › "),
        correction: l.faute_de_frappe,
      });
    }
  }));

  await journaliser("comparaison_onedrive", bilan);
  return { resultats, bilan, fautes, genere_le: liste.genere_le };
}
