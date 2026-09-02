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

/* Crée la version suivante d'une visite déjà signée. La version signée
   reste intacte : elle conserve son PDF, son empreinte et sa date. La
   nouvelle repart de son contenu et devra être signée à nouveau. */
async function nouvelleVersion(visiteSignee, motif) {
  const numero = parseInt(String(visiteSignee.version_doc || "V1").replace(/\D/g, ""), 10) || 1;
  const copie = JSON.parse(JSON.stringify(visiteSignee));

  const edl = visiteSignee.edl_id || visiteSignee.visit_id;
  copie.edl_id = edl;                          // l'identifiant EDL ne change PAS
  copie.version_doc = "V" + (numero + 1);
  copie.visit_id = edl + "__" + copie.version_doc;
  copie.version_precedente = {
    version: visiteSignee.version_doc || "V1",
    date_signature: visiteSignee.date_signature || null,
    empreinte: (visiteSignee.preuve || {}).hash_pdf_pv_sha256 || null,
    fichier: (visiteSignee.preuve || {}).pv_nom_fichier || null,
  };
  copie.motif_version = motif || null;
  copie.statut = "en_cours";
  copie.date_signature = null;
  copie.preuve = {};
  copie.signatures = undefined;
  delete copie.signatures;

  copie.photo_seq = {};        // les photos de la version précédente restent les siennes
  await enregistrerVisite(copie);
  await journaliser("nouvelle_version", {
    edl_id: edl, version: copie.version_doc, motif: motif || null,
  });
  return copie;
}

/* Le bailleur attendu pour un immeuble. Trois propriétaires distincts :
   se tromper rendrait le procès-verbal contestable. */
function bailleurParDefaut(immeubleId) {
  const cle = (CONFIG.bailleur_par_immeuble || {})[immeubleId] || "jmg";
  return trouverBailleur(cle);
}

function trouverBailleur(cle) {
  const liste = CONFIG.bailleurs || [];
  return liste.find(b => b.cle === cle) || liste[0] ||
    { cle: "jmg", libelle: CONFIG.bailleur, represente_par: null };
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
/* L'ORDRE DU GÉOMÈTRE.

   Un expert géomètre consulté le 30/08/2026 visite dans cet ordre :
   chambres, salle de bain, WC, cuisine, séjour. Ce n'est pas une habitude
   personnelle mais une méthode : on commence par le privé et le calme, on
   finit par les pièces de vie où l'on discute.

   L'intérêt pour nous est juridique autant que pratique : un procès-verbal
   lu dans l'ordre où l'on a marché est plus difficile à contester qu'une
   liste arbitraire, et l'opérateur n'oublie pas de pièce.

   Ce qui n'entre dans aucune de ces catégories — hall, cave, terrasse —
   vient à la fin. */
function construirePieces(composition) {
  const pieces = [];
  let n = 0;
  const ajouter = (libelle) => pieces.push({ piece_id: "p" + (++n), libelle, constatations: [] });

  for (let i = 1; i <= composition.nb_chambres; i++)
    ajouter(composition.nb_chambres === 1 ? "Chambre" : "Chambre " + i);
  for (let i = 1; i <= composition.nb_salles_de_bain; i++)
    ajouter(composition.nb_salles_de_bain === 1 ? "Salle de bain - WC" : "Salle de bain " + i);
  if (composition.cuisine) ajouter("Cuisine");
  if (composition.sejour) ajouter("Séjour");

  /* Le reste, dans l'ordre où on le rencontre en général. */
  if (composition.hall) ajouter("Hall");
  if (composition.buanderie) ajouter("Buanderie");
  if (composition.cave) ajouter("Cave");
  if (composition.grenier) ajouter("Grenier");
  if (composition.terrasse) ajouter("Terrasse / Jardin");
  if (composition.garage) ajouter("Garage");
  return pieces;
}

/* ---- Abréviations ------------------------------------------------------

   Elles figurent dans le NOM DU FICHIER, qui survit à tout : même sorties
   de l'application, les photographies restent lisibles.

   Les chiffres sont conservés — CH1, CH2, WC1 — pour que deux pièces du
   même type ne se confondent jamais. */
const ABREVIATIONS_PIECES = [
  [/^chambre/i,            "CH"],
  [/^salle de bain.*wc/i,  "SDB"],   /* avant SDB seule et avant WC */
  [/^salle de bain/i,      "SDB"],
  [/^salle d.eau/i,        "SDE"],
  [/^wc|^toilette/i,       "WC"],
  [/^cuisine/i,            "CUI"],
  [/^s[ée]jour|^salon|^living/i, "SEJ"],
  [/^hall|^entr[ée]e|^couloir/i, "HAL"],
  [/^buanderie/i,          "BUA"],
  [/^cave/i,               "CAV"],
  [/^grenier/i,            "GRE"],
  [/^terrasse|^jardin|^balcon/i, "TER"],
  [/^garage/i,             "GAR"],
];

function abregerPiece(libelle) {
  const t = String(libelle || "").trim();
  for (const [motif, abrev] of ABREVIATIONS_PIECES) {
    if (motif.test(t)) {
      const chiffre = (t.match(/\d+/) || [""])[0];
      return abrev + chiffre;
    }
  }
  /* Pièce d'un type imprévu : trois premières lettres, sans accent. */
  return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase() || "DIV";
}

/* ---- Les murs ----------------------------------------------------------

   L'ordre est celui du géomètre : on entre, on se tourne à gauche, et on
   fait le tour. GAUCHE ET DROITE S'ENTENDENT DEPUIS L'EMBRASURE, dos à la
   porte, en regardant vers l'intérieur — c'est la seule définition qui ne
   dépende pas d'où l'on se trouve dans la pièce. */
const MURS = [
  { cle: "G",   libelle: "Gauche" },
  { cle: "F",   libelle: "En face" },
  { cle: "D",   libelle: "Droite" },
  { cle: "E",   libelle: "Entrée" },
  { cle: "DIV", libelle: "Autre" },
];

/* Les WC n'ont pas quatre murs qui vaillent la peine d'être distingués. */
function pieceSansMurs(libelle) {
  return /^wc|^toilette/i.test(String(libelle || "").trim());
}

/* Création de la visite. Les identifiants sont générés localement,
   avant tout appel réseau, et ne changent plus ensuite. */
async function creerVisite(param) {
  const identifiant = nouvelIdentifiant("v");
  const visite = {
    schema_version: CONFIG.version_schema,
    /* edl_id est l'identifiant permanent de l'état des lieux : il ne change
       jamais, y compris entre versions. visit_id est la clé de stockage :
       il vaut edl_id pour la V1, puis « edl_id__V2 » pour les suivantes,
       afin que les versions coexistent sans s'écraser. */
    edl_id: identifiant,
    visit_id: identifiant,
    /* Version du document. Une correction après signature ne modifie
       jamais la version précédente : elle en crée une nouvelle, et
       l'ancienne reste archivée dans le dossier. */
    version_doc: "V1",
    version_precedente: null,
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
      /* Résolus au démarrage, quand le réseau est nécessairement là.
         Ensuite, plus rien n'est demandé à OneDrive pendant la visite. */
      dossier_photos_item_id: param.dossier_photos_item_id || null,
      lien_photos: param.lien_photos || null,
      correspondance_confirmee: param.confirmee === true,
    },

    parties: {
      bailleur_cle: (param.bailleur && param.bailleur.cle) || null,
      bailleur: (param.bailleur && param.bailleur.libelle) || CONFIG.bailleur,
      /* Le représentant vient du bailleur choisi, jamais du compte
         connecté : le nom du compte Microsoft avait été pris pour un
         mandataire, ce qui donnait des mentions fausses au document. */
      bailleur_represente_par: (param.bailleur && param.bailleur.represente_par) || null,
      /* Celui qui a dressé le constat, article 27, §5, 2°. Vidé à
         l'écran, il retombe sur le nom par défaut : le procès-verbal ne
         doit pas porter un champ vide sous ce libellé. */
      auteur_constatations: (param.auteur_constatations || "").trim() ||
        CONFIG.auteur_constatations_defaut || null,
      preneurs: (param.preneurs || []).map(nom => ({
        nom_complet: nom,
        qualite: "Locataire",
        numero_carte_identite: null,
        identite_verifiee: false,
        email: null,
      })),
    },

    options: {
      chiffrage_actif: param.type === "EDLS" ? param.chiffrage === true : false,
      rappel_index_entree: false,
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
    /* Références du bail. Exigées au procès-verbal par le décret wallon du
       15 mars 2018 : date de début à l'entrée (art. 27, §2, 3°), date du bail
       et durée d'occupation à la sortie (art. 27, §5, 4°).
       Facultatives : une date manquante ne doit jamais empêcher une visite
       de démarrer, quitte à ce que la ligne s'imprime en tiret. */
    bail: {
      debut: param.bail_debut || null,
      /* La fin de bail ne concerne que la sortie. Même logique que
         chiffrage_actif ci-dessus : une valeur saisie puis devenue sans
         objet ne doit pas rester dans la visite. */
      fin: param.type === "EDLS" ? (param.bail_fin || null) : null,
      /* Quatrième élément du 4° de l'article 27, §5 : « tout avenant ».
         Une case à cocher suffit — le procès-verbal doit signaler qu'il
         en existe un, pas le reproduire. */
      avenant: param.bail_avenant === true,
    },
    /* Observations et réserves du preneur, consignées AVANT signature.
       Sans cette possibilité, le caractère contradictoire de l'état des
       lieux peut être contesté — décret wallon du 15 mars 2018, art. 27. */
    reserves: [],
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
