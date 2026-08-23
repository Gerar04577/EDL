/* EDL — Configuration
   Toutes les valeurs susceptibles de changer sont ici, et nulle part ailleurs.
   Aucune clé secrète dans ce fichier : la clé Gemini vit dans Make. */

var CONFIG = {

  version_app: "1.4.0",

  /* Protocole de signature imprimé en page 1 du procès-verbal.
     Laisser vide tant que l'avocat n'a pas rendu son texte :
     l'application utilise alors une version provisoire, signalée comme telle. */
  protocole: [],

  /* Identité du bailleur. Elle DIFFÈRE selon l'immeuble : trois
     propriétaires distincts, et une confusion rendrait le procès-verbal
     contestable. La valeur ci-dessous ne sert que de défaut. */
  bailleur: "GERARD Jean-Marc",

  bailleurs: [
    { cle: "jmg",     libelle: "GERARD Jean-Marc",  represente_par: null },
    { cle: "samadhi", libelle: "SAMADHI S.A.",      represente_par: "GERARD Julien" },
    { cle: "julien",  libelle: "GERARD Julien",     represente_par: null },
  ],

  // Bailleur attendu pour chaque immeuble
  bailleur_par_immeuble: {
    nimy: "jmg",
    "petite-guirlande": "jmg",
    vannes: "jmg",
    fermette: "jmg",
    biche: "jmg",
    havre: "samadhi",
    egmont: "julien",
  },
  version_schema: "1.0",

  // --- Microsoft Entra ---------------------------------------------------
  microsoft: {
    // Inscription "EDL", comptes Microsoft personnels uniquement
    client_id: "b93e33ba-f9f8-4767-ae3d-4073df4f66c2",
    authority: "https://login.microsoftonline.com/consumers",
    // L'adresse exacte déclarée dans Entra, calculée pour éviter toute divergence
    redirect_uri: location.origin + location.pathname,
    scopes: ["Files.ReadWrite", "User.Read", "offline_access"],
  },

  // --- OneDrive ----------------------------------------------------------
  onedrive: {
    // Nom du dossier racine partagé. Change chaque année.
    dossier_racine: "Immobilier 2025-2026",
    // Emplacement de la liste des locataires exportée par Gestion Loyers
    chemin_liste_locataires: "AGestion Charges/Calcul charges et compteurs/remboursements.json",
    // Sous-dossiers attendus dans un dossier locataire
    sous_dossier_edle: "EDLE",
    sous_dossier_edls: "EDLS",
    sous_dossier_meubles: "SAMADHI",
  },

  // Correspondance entre l'identifiant d'immeuble de Gestion Loyers
  // et le vrai nom du dossier OneDrive. Repris du portage v84.
  dossier_onedrive_par_immeuble: {
    "nimy": "Nimy",
    "petite-guirlande": "PTG",
    "havre": "Havré",
    "vannes": "Vannes",
    "fermette": "Pourcelet Fermette",
    "egmont": "Egmont",
    "biche": "Biche",
  },

  // Types d'unités pour lesquels aucun état des lieux n'est attendu.
  // Retire "GARAGE" de cette liste si tu veux les contrôler comme les logements.
  types_sans_etat_des_lieux: ["GARAGE"],

  // Immeubles disposant de répartiteurs ISTA
  immeubles_avec_ista: ["petite-guirlande"],

  // Immeubles dont les compteurs électriques sont en simple horaire par défaut
  immeubles_simple_horaire: ["biche", "petite-guirlande", "nimy"],

  // --- Photos ------------------------------------------------------------
  photo: {
    cote_max_px: 1600,
    qualite_jpeg: 0.82,
    cible_octets: 800 * 1024,
  },

  // --- Sauvegarde continue ----------------------------------------------
  sauvegarde: {
    // Le fichier de données est déposé au plus tard toutes les N photos
    intervalle_photos: 20,
    prefixe_brouillon: "BROUILLON_",
  },

  // --- Intelligence artificielle ----------------------------------------
  ia: {
    // gemini-2.5-flash-lite fermé aux nouveaux comptes (constaté le 23/08/2026)
    modele: "gemini-3.5-flash-lite",
    // Webhook Make servant de relais. Vide = bouton "Décrire" désactivé.
    webhook_ia: "",
  },

  // --- Fin de visite -----------------------------------------------------
  make: {
    webhook_fin_visite: "",
    /* Une connexion Gmail dans Make expire et doit être réautorisée.
       L'application prévient chaque jour à partir de huit jours avant. */
    gmail_reautoriser_le: "2027-02-19",
    gmail_alerte_jours: 8,
  },
};
