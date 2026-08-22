/* EDL — Démarrage d'une visite
   Résolution du dossier de destination, puis création de la visite.
   Règle : l'application ne crée JAMAIS de dossier. Si le dossier attendu
   n'existe pas, la visite ne démarre pas. Mieux vaut un blocage à la porte
   du logement qu'une visite entière sans savoir où déposer les fichiers. */

/* Étape 1 — le dossier de l'unité, dans le dossier de l'immeuble.
   Renvoie soit une résolution unique, soit la liste des candidats
   quand la correspondance est ambiguë (cas RDC de Petite Guirlande). */
async function resoudreDossierUnite(immeubleId, designation) {
  const refImmeuble = await obtenirRefImmeuble(immeubleId);
  const enfants = await enfantsDeRef(refImmeuble);
  const dossiers = enfants.filter(e => e.folder || e.remoteItem);
  const noms = dossiers.map(e => e.name);

  /* Une correspondance approuvée fait foi et court-circuite la
     reconnaissance automatique. */
  if (typeof chargerCorrespondances === "function") {
    try {
      await chargerCorrespondances();
      const a = correspondanceApprouvee(immeubleId, designation);
      if (a && noms.includes(a.dossier_unite)) {
        const el = dossiers.find(e => e.name === a.dossier_unite);
        return { statut: "resolu", nom: a.dossier_unite,
                 ref: refDe(el, refImmeuble.driveId), candidats: [], approuvee: true };
      }
      if (a) {
        return { statut: "approuve_absent", nom: null, ref: null, candidats: [],
                 attendu: a.dossier_unite, tous: noms };
      }
    } catch (_) { /* on retombe sur la reconnaissance automatique */ }
  }

  const r = trouverDossierUnite(designation, noms);

  if (r.trouve) {
    const el = dossiers.find(e => e.name === r.trouve);
    return {
      statut: "resolu",
      nom: r.trouve,
      ref: refDe(el, refImmeuble.driveId),
      candidats: [],
    };
  }
  if (r.ambigu) {
    return {
      statut: "ambigu",
      nom: null,
      ref: null,
      candidats: r.candidats.map(nom => {
        const el = dossiers.find(e => e.name === nom);
        return { nom, ref: refDe(el, refImmeuble.driveId) };
      }),
    };
  }
  return { statut: "introuvable", nom: null, ref: null, candidats: [], tous: noms };
}

/* Étape 2 — le contenu du dossier d'unité.
   Deux structures existent dans l'arborescence réelle :
   soit un dossier par locataire, soit EDLE et EDLS directement sous l'unité.
   Dans le second cas, on renvoie l'unité elle-même comme contenant. */
async function listerDossiersLocataires(refUnite) {
  const enfants = (await enfantsDeRef(refUnite)).filter(e => e.folder || e.remoteItem);
  const documents = ["EDLE", "EDLS", "BAIL", "SAMADHI"];
  const plate = enfants.some(e => documents.includes(String(e.name || "").trim().toUpperCase()));

  if (plate) {
    return [{ nom: "(dossier de l'unité)", ref: refUnite, modifie_le: null, plate: true }];
  }
  /* Le dossier le plus probable est proposé en tête de liste, mais
     l'utilisateur garde le dernier mot : il choisit lui-même à l'écran. */
  const liste = enfants.map(e => ({
    nom: e.name,
    ref: refDe(e, refUnite.driveId),
    modifie_le: e.lastModifiedDateTime || null,
    plate: false,
  }));
  return liste.sort((a, b) =>
    String(b.modifie_le || "").localeCompare(String(a.modifie_le || "")));
}

/* Étape 3 — le sous-dossier EDLE ou EDLS.
   Il doit exister. L'application ne le crée pas. */
async function resoudreDossierCible(refLocataire, type) {
  const attendu = type === "EDLE"
    ? CONFIG.onedrive.sous_dossier_edle
    : CONFIG.onedrive.sous_dossier_edls;

  const enfants = await enfantsDeRef(refLocataire);
  const dossiers = enfants.filter(e => e.folder || e.remoteItem);
  const trouve = dossiers.find(e => (e.name || "").trim().toUpperCase() === attendu);

  if (!trouve) {
    return {
      statut: "absent",
      attendu,
      presents: dossiers.map(e => e.name),
    };
  }
  return {
    statut: "resolu",
    nom: trouve.name,
    ref: refDe(trouve, refLocataire.driveId),
    contenu_existant: enfants.length,
  };
}

/* Composition par défaut d'une unité, déduite de son type.
   Ces valeurs sont un point de départ : l'utilisateur les ajuste,
   et elles sont ensuite mémorisées pour cette unité. */
function compositionParDefaut(designation) {
  const t = extraireTypeEtNumero(designation);
  const base = {
    sejour: true, cuisine: true,
    nb_chambres: 0, nb_salles_de_bain: 1,
    hall: false, cave: false, terrasse: false,
    grenier: false, buanderie: false, garage: false,
  };
  if (t.type === "STUDIO") return base;
  if (t.type === "GARAGE") {
    return Object.assign({}, base, {
      sejour: false, cuisine: false, nb_salles_de_bain: 0, garage: true,
    });
  }
  if (t.type === "RDC_COMMERCIAL") {
    return Object.assign({}, base, { cuisine: false, nb_salles_de_bain: 1 });
  }
  if (t.type === "DUPLEX") {
    return Object.assign({}, base, { nb_chambres: 2, nb_salles_de_bain: 1, hall: true });
  }
  // APPART, ETAGE, RDC résidentiel
  return Object.assign({}, base, { nb_chambres: 1, hall: true });
}

/* Réglages techniques par défaut, selon l'immeuble. */
function reglagesParDefaut(immeubleId) {
  return {
    electricite_bi_horaire: !CONFIG.immeubles_simple_horaire.includes(immeubleId),
    ista_present: CONFIG.immeubles_avec_ista.includes(immeubleId),
  };
}

const CLE_REGLAGES = "edl_reglages_unites";

function lireReglagesMemorises(immeubleId, designation) {
  try {
    const tout = JSON.parse(localStorage.getItem(CLE_REGLAGES) || "{}");
    return tout[immeubleId + "|" + designation] || null;
  } catch (_) { return null; }
}

function memoriserReglages(immeubleId, designation, composition, reglages) {
  try {
    const tout = JSON.parse(localStorage.getItem(CLE_REGLAGES) || "{}");
    tout[immeubleId + "|" + designation] = { composition, reglages };
    localStorage.setItem(CLE_REGLAGES, JSON.stringify(tout));
  } catch (_) { /* sans effet si le stockage refuse */ }
}

/* Construit la liste des pièces à partir de la composition. */
function construirePieces(composition) {
  const pieces = [];
  let n = 0;
  const ajouter = (libelle) => pieces.push({ piece_id: "p" + (++n), libelle, constatations: [] });

  if (composition.hall) ajouter("Hall");
  if (composition.sejour) ajouter("Séjour");
  if (composition.cuisine) ajouter("Cuisine");
  for (let i = 1; i <= composition.nb_chambres; i++)
    ajouter(composition.nb_chambres === 1 ? "Chambre" : "Chambre " + i);
  for (let i = 1; i <= composition.nb_salles_de_bain; i++)
    ajouter(composition.nb_salles_de_bain === 1 ? "Salle de bain - WC" : "Salle de bain " + i);
  if (composition.buanderie) ajouter("Buanderie");
  if (composition.cave) ajouter("Cave");
  if (composition.grenier) ajouter("Grenier");
  if (composition.terrasse) ajouter("Terrasse / Jardin");
  if (composition.garage) ajouter("Garage");
  return pieces;
}

/* Création de la visite. Les identifiants sont générés localement,
   avant tout appel réseau, et ne changent plus ensuite. */
async function creerVisite(param) {
  const visite = {
    schema_version: CONFIG.version_schema,
    visit_id: nouvelIdentifiant("v"),
    type: param.type,
    statut: "en_cours",
    date_debut: new Date().toISOString(),
    date_signature: null,
    operateur: param.operateur || null,
    app_version: CONFIG.version_app,

    bien: {
      immeuble: param.immeuble_nom,
      immeuble_id: param.immeuble_id,
      unite_source: param.designation,
      adresse_complete: null,
      dossier_immeuble_onedrive: CONFIG.dossier_onedrive_par_immeuble[param.immeuble_id],
      dossier_unite_onedrive: param.dossier_unite,
      dossier_locataire_onedrive: param.dossier_locataire,
      dossier_cible_item_id: param.ref_cible.id,
      dossier_cible_drive_id: param.ref_cible.driveId,
      correspondance_confirmee: param.confirmee === true,
    },

    parties: {
      bailleur: CONFIG.bailleur,
      bailleur_represente_par: param.operateur || null,
      preneurs: (param.preneurs || []).map(nom => ({
        nom_complet: nom,
        numero_carte_identite: null,
        identite_verifiee: false,
        email: null,
      })),
    },

    options: {
      chiffrage_actif: param.type === "EDLS" ? param.chiffrage === true : false,
      pret_meubles_actif: param.pret_meubles === true,
      composition: param.composition,
      reglages_unite: param.reglages,
    },

    pieces: construirePieces(param.composition),
    photos: [],
    photo_seq: {},
    compteurs: {
      electricite: { bi_horaire: param.reglages.electricite_bi_horaire,
                     numero: null, index_unique: null, index_jour: null,
                     index_nuit: null, photo_id: null },
      eau: { numero: null, index: null, photo_id: null },
      ista: [],
      gaz: null,
      mazout: null,
    },
    equipements: {
      sonnette: { etat: null, commentaire: "" },
      detecteur_fumee: { present: null, commentaire: "" },
    },
    cles: { logement: null, communs: null, boite_aux_lettres: null,
            portail: null, jardin: null },
    etat_general: {
      degats_locatifs: { constate: null, commentaire: "" },
      proprete: { propre: null, commentaire: "" },
    },
    divers: "",
    pret_meubles: { actif: param.pret_meubles === true, articles: [] },
    comparaison: null,
    chiffrage: null,
    preuve: {},
  };

  await enregistrerVisite(visite);
  memoriserReglages(param.immeuble_id, param.designation, param.composition, param.reglages);
  await journaliser("visite_creee", {
    visit_id: visite.visit_id, type: visite.type,
    unite: param.designation, pieces: visite.pieces.length,
  });
  return visite;
}
