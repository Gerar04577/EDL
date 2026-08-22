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
    const courant = locs.slice().sort((a, b) =>
      String(b.lastModifiedDateTime || "").localeCompare(String(a.lastModifiedDateTime || "")))[0];
    ligne.dossier_courant = courant.name;
    try {
      contenants = (await enfantsDeRef(refDe(courant, refUnite.driveId)))
        .filter(e => e.folder || e.remoteItem);
    } catch (e) {
      ligne.statut = "erreur";
      ligne.message = e.message;
      return ligne;
    }
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
    if (!ligne.edle) manque.push("EDLE");
    if (!ligne.edls) manque.push("EDLS");
    ligne.message = "dossier manquant : " + manque.join(" et ");
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
    approuve_absent: 0, approuvees: 0,
  };
  resultats.forEach(b => b.lignes.forEach(l => {
    bilan.total++;
    if (bilan[l.statut] !== undefined) bilan[l.statut]++;
    if (l.approuvee) bilan.approuvees++;
  }));

  await journaliser("comparaison_onedrive", bilan);
  return { resultats, bilan, genere_le: liste.genere_le };
}
