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

      /* Une correspondance approuvée fait foi : aucun calcul. */
      const approuvee = correspondanceApprouvee(imm.immeuble_id, unite.designation);
      let r;
      if (approuvee && noms.includes(approuvee.dossier_unite)) {
        r = { trouve: approuvee.dossier_unite, candidats: [], ambigu: false };
        ligne.approuvee = true;
        ligne.approuve_le = approuvee.approuve_le;
      } else if (approuvee) {
        // le dossier approuvé a disparu ou a été renommé
        ligne.statut = "approuve_absent";
        ligne.message = `le dossier approuvé « ${approuvee.dossier_unite} » n'existe plus`;
        ligne.candidats_libres = noms;
        bloc.lignes.push(ligne);
        continue;
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
        bloc.lignes.push(ligne);
        r.candidats.forEach(c => utilises.add(c));
        continue;
      }
      if (!r.trouve) {
        ligne.message = "aucun dossier correspondant — à désigner";
        ligne.candidats_libres = noms;
        bloc.lignes.push(ligne);
        continue;
      }

      ligne.dossier_unite = r.trouve;
      utilises.add(r.trouve);
      const elUnite = dossiers.find(e => e.name === r.trouve);
      const refUnite = refDe(elUnite, refImmeuble.driveId);

      // niveau locataire
      let locs = [];
      try {
        locs = await listerDossiersLocataires(refUnite);
      } catch (e) {
        ligne.statut = "erreur";
        ligne.message = e.message;
        bloc.lignes.push(ligne);
        continue;
      }
      ligne.dossiers_locataires = locs.map(l => l.nom);

      if (locs.length === 0) {
        ligne.statut = unite.inoccupe ? "vide_normal" : "sans_locataire";
        ligne.message = unite.inoccupe
          ? "unité inoccupée, aucun dossier locataire"
          : "aucun dossier locataire alors que l'unité est occupée";
        bloc.lignes.push(ligne);
        continue;
      }

      /* Le dossier de travail est le plus récemment modifié : c'est celui
         du locataire en place. Les anciens restent listés pour information. */
      const courant = locs.slice().sort((a, b) =>
        String(b.modifie_le || "").localeCompare(String(a.modifie_le || "")))[0];
      ligne.dossier_courant = courant.nom;

      const sous = await enfantsDeRef(courant.ref);
      const nomsSous = sous.filter(e => e.folder || e.remoteItem)
        .map(e => (e.name || "").trim().toUpperCase());
      ligne.edle = nomsSous.includes(CONFIG.onedrive.sous_dossier_edle);
      ligne.edls = nomsSous.includes(CONFIG.onedrive.sous_dossier_edls);
      ligne.sous_dossiers = sous.filter(e => e.folder || e.remoteItem).map(e => e.name);

      if (ligne.edle && ligne.edls) {
        ligne.statut = "complet";
      } else {
        ligne.statut = "incomplet";
        const manque = [];
        if (!ligne.edle) manque.push("EDLE");
        if (!ligne.edls) manque.push("EDLS");
        ligne.message = "dossier manquant : " + manque.join(" et ");
      }
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
