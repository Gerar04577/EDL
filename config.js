/* EDL — Configuration   ·   config 2.34.2 (11/09/2026)
   Toutes les valeurs susceptibles de changer sont ici, et nulle part ailleurs.
   Aucune clé secrète dans ce fichier : la clé Gemini vit dans Make.

   2.34.0 : prêt de meubles de la S.A. SAMADHI — page du PV d'entrée,
   adresses propres, textes au singulier et au pluriel, mentions juridiques.

   2.33.0 : avenant au bail relatif au calcul des charges — un modèle PAR
   IMMEUBLE (Biche, Nimy, Petite Guirlande) et puce ajoutée au protocole. */

var CONFIG = {

  version_app: "2.34.2",

  /* Protocole de signature imprimé en page 1 du procès-verbal.
     TEXTE DÉFINITIF, validé par l'avocat le 25/08/2026. Toute modification
     de ce texte doit lui être soumise : il est signé par les deux parties. */
  protocole: [
    "Les parties conviennent expressément que le présent état des lieux est dressé " +
    "contradictoirement sur support numérique au moyen de l'application du bailleur.",
    "Elles reconnaissent que la signature manuscrite apposée sur l'écran tactile manifeste " +
    "leur consentement et constitue une signature au sens du Livre 8 du Code civil.",
    "Elles reconnaissent la date et l'heure figurant au présent document, ainsi que le fait " +
    "que les photographies référencées font partie intégrante de l'état des lieux.",
    "Le preneur reconnaît avoir pris connaissance de l'intégralité du document avant de le signer, " +
    "et accepte que sa transmission à l'adresse électronique qu'il a déclarée vaille communication.",
    "L'identité des signataires a été vérifiée sur présentation de la carte d'identité, " +
    "en présence des deux parties.",
  ],

  /* Puce AJOUTÉE au protocole, imprimée UNIQUEMENT quand l'avenant au bail
     est joint au procès-verbal d'entrée. Les cinq puces ci-dessus restent
     intactes pour tous les autres procès-verbaux. Texte validé par Gérard
     le 11/09/2026. */
  protocole_avenant:
    "Le preneur reconnaît avoir pris connaissance de l'avenant au bail relatif au " +
    "calcul des charges, reproduit au présent document dont il fait partie intégrante. " +
    "Sa signature finale atteste de cette prise de connaissance et vaut signature de " +
    "cet avenant.",

  /* Identité du bailleur. Elle DIFFÈRE selon l'immeuble : trois
     propriétaires distincts, et une confusion rendrait le procès-verbal
     contestable. La valeur ci-dessous ne sert que de défaut. */
  bailleur: "GERARD Jean-Marc",

  /* Julien Gérard conduit toutes les visites, mais sa qualité change :
     mandataire pour les immeubles de Jean-Marc et pour SAMADHI,
     propriétaire en nom propre à Egmont. Le nom du compte Microsoft
     ne sert JAMAIS de représentant. */
  bailleurs: [
    { cle: "jmg",     libelle: "GERARD Jean-Marc", represente_par: "GERARD Julien" },
    { cle: "samadhi", libelle: "SAMADHI S.A.",     represente_par: "GERARD Julien" },
    { cle: "julien",  libelle: "GERARD Julien",    represente_par: null },
  ],

  // Bailleur attendu pour chaque immeuble
  /* Auteur des constatations, prérempli à l'écran de démarrage et
     modifiable visite par visite. Exigé par l'article 27, §5, 2°, du
     décret wallon, qui demande l'identité et la qualité de celui qui
     dresse le constat. */
  auteur_constatations_defaut: "Julien GERARD",

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

  // --- Avenant au bail (calcul des charges) ------------------------------
  /* UN MODÈLE PAR IMMEUBLE. LES TEXTES DIFFÈRENT ET NE SE MÉLANGENT JAMAIS.

     Repris mot pour mot des fichiers Word de Gérard (Avenant_Biche_2025,
     Avenant_Nimy_2025, Avenant_Guirlande_2025), dans l'ordre de chacun.
     Seules corrections, validées le 11/09/2026 :
       — Biche : « le locataire à son propre compteur » → « a » ;
       — Nimy : accolade ouvrante « { » → parenthèse « ( » ;
       — Petite Guirlande : code postal 7000 ajouté ; « Biffer en cas de
         désaccord » retiré (la clause devient un oui / non) ;
       — les trois : « en 3 exemplaires » retiré, ligne « Le locataire »
         retirée (la signature est celle du bloc « Signatures » du PV).
     Nimy n'avait pas de clause internet : elle est ajoutée, placée comme
     à Biche (avant le paragraphe du contrat d'énergie).

     Un immeuble ABSENT de cette liste n'a pas d'avenant — Havré, Vannes,
     La Fermette et Egmont : ni interrupteur, ni page, et « non » au
     procès-verbal. Il n'existe aucun modèle par défaut.

     Champs variables, remplacés à l'impression :
       {DEBUT} {FIN}             dates du bail saisies à l'écran de démarrage
       {ANNEE_DEBUT} {ANNEE_FIN} leurs années, pour le contrat d'énergie
       {LOCATAIRE}               civilité + nom, pour chaque preneur
       {NUMERO}                  numéro du studio, lu dans le dossier OneDrive
       {DOSSIER}                 nom du dossier OneDrive, si ce n'est pas un studio
       {INTERNET}                clause internet, oui ou non
       {DATE}                    date de signature
     Une valeur manquante s'imprime en pointillés, jamais inventée. */
  avenants: {

    biche: {
      immeuble_id: "biche",
      source: "Avenant_Biche_2025.docx",
      titre: "AVENANT AU BAIL DE LOCATION DU {DEBUT} au {FIN}",
      coordonnees: "Coordonnées du locataire : {LOCATAIRE}",
      unite_studio: "Locataire du studio {NUMERO} -rue de la Biche 10 à 7000 Mons",
      unite_autre: "Locataire de « {DOSSIER} » -rue de la Biche 10 à 7000 Mons",
      internet_oui: "Le locataire souhaite souscrire l'abonnement annuel internet à 10€ par " +
        "mois à payer en même temps que le loyer et les charges.",
      internet_non: "Le locataire ne souhaite pas souscrire l'abonnement annuel internet à " +
        "10€ par mois.",
      paragraphes: [
        "A propos du calcul des charges :",
        "Pour l'eau, les charges sont calculées par le relevé de l'index des compteurs " +
          "individuels de passage.",
        "Pour l'électricité, le locataire a son propre compteur.",
        "Pour l’eau et l’électricité, une correction des index des compteurs individuels " +
          "en fonction des compteurs généraux sera adaptée autant que de besoin.",
        "Pour les charges communes (électricité et entretien des communs), les frais seront " +
          "divisés par le nombre des logements de l'immeuble",
        "{INTERNET}",
        "Pour le calcul des charges, le prix de l'énergie est fixé par un contrat fixe signé " +
          "le 01/06/{ANNEE_DEBUT} ( électricité) jusqu’au 01/06/{ANNEE_FIN}. A partir de cette " +
          "date, les provisions des charges seront adaptées chaque mois, si le contrat n’est " +
          "pas reconductible en fixe, en fonction de la variation des prix de l'énergie pour " +
          "éviter les mauvaises surprises au décompte final. Ce sera le cas où, il ne sera " +
          "possible que de signer un contrat variable avec un fournisseur d'énergie, ou que " +
          "le prix des contrats fixes aura considérablement augmenté.",
      ],
      fait: "Fait le {DATE}",
    },

    nimy: {
      immeuble_id: "nimy",
      source: "Avenant_Nimy_2025.docx",
      titre: "AVENANT AU BAIL DE LOCATION DU {DEBUT} au {FIN}",
      coordonnees: "Coordonnées du locataire : {LOCATAIRE}",
      unite_studio: "Locataire du studio numéro {NUMERO} rue de Nimy 94 à 7000 MONS",
      unite_autre: "Locataire de « {DOSSIER} » rue de Nimy 94 à 7000 MONS",
      /* Clause absente du modèle Word de Nimy : reprise de Biche. */
      internet_oui: "Le locataire souhaite souscrire l'abonnement annuel internet à 10€ par " +
        "mois à payer en même temps que le loyer et les charges.",
      internet_non: "Le locataire ne souhaite pas souscrire l'abonnement annuel internet à " +
        "10€ par mois.",
      paragraphes: [
        "A propos du calcul des charges :",
        "Pour le chauffage, les charges sont calculées en divisant la consommation globale " +
          "de l'immeuble par 9. Pour l'eau froide et chaude; elles sont divisées par 11. Pour " +
          "l'électricité, les charges sont calculées par le relevé de l'index des compteurs " +
          "de passage. (Pour les charges du chauffage :studios 10 et 11 uniquement " +
          "électricité, puisque le chauffage est électrique )",
        "Pour l'électricité, l'entretien des communs, l’entretien de la chaudière, les " +
          "charges sont divisées par 11",
        "Pour l’eau et l’électricité, une correction des index des compteurs individuels " +
          "en fonction des compteurs généraux sera adaptée autant que de besoin.",
        "{INTERNET}",
        "Pour le calcul des charges, le prix de l'énergie est fixé par un contrat fixe signé " +
          "le 01/06/{ANNEE_DEBUT} ( électricité) jusqu’au 01/06/{ANNEE_FIN}. A partir de cette " +
          "date, les provisions des charges seront adaptées chaque mois, si le contrat n’est " +
          "pas reconductible en fixe, en fonction de la variation des prix de l'énergie pour " +
          "éviter les mauvaises surprises au décompte final. Ce sera le cas où, il ne sera " +
          "possible que de signer un contrat variable avec un fournisseur d'énergie, ou que " +
          "le prix des contrats fixes aura considérablement augmenté.",
      ],
      fait: "Fait le {DATE}",
    },

    "petite-guirlande": {
      immeuble_id: "petite-guirlande",
      source: "Avenant_Guirlande_2025.docx",
      titre: "AVENANT AU BAIL DE LOCATION DU {DEBUT} au {FIN}",
      coordonnees: "Coordonnées du locataire : {LOCATAIRE}",
      unite_studio: "Locataire du studio numéro {NUMERO} rue de la Petite Guirlande 16 à 7000 MONS",
      unite_autre: "Locataire de « {DOSSIER} » rue de la Petite Guirlande 16 à 7000 MONS",
      internet_oui: "Le locataire souhaite souscrire l'abonnement annuel internet à 10€ par " +
        "mois à payer en même temps que le loyer et les charges.",
      internet_non: "Le locataire ne souhaite pas souscrire l'abonnement annuel internet à " +
        "10€ par mois.",
      paragraphes: [
        "A propos du calcul des charges :",
        "Pour le calcul des charges, le prix de l'énergie est fixé par un contrat fixe signé " +
          "le 01/06/{ANNEE_DEBUT} ( électricité) jusqu’au 01/06/{ANNEE_FIN}. A partir de cette " +
          "date, les provisions des charges seront adaptées chaque mois, si le contrat n’est " +
          "pas reconductible en fixe, en fonction de la variation des prix de l'énergie pour " +
          "éviter les mauvaises surprises au décompte final. Ce sera le cas où, il ne sera " +
          "possible que de signer un contrat variable avec un fournisseur d'énergie, ou que " +
          "le prix des contrats fixes aura considérablement augmenté.",
        "Les charges de chauffage et d’eau chaude sont calculées par la société ISTA, en " +
          "fonction des répartiteurs radiofréquence. Pour l'eau froide, les charges sont " +
          "calculées en divisant par 6 la consommation globale des studios de l'immeuble via " +
          "le compteur de passage« eau studios».",
        "Pour l'électricité, les charges sont calculées par le relevé de l'index des " +
          "compteurs de passage.",
        "Pour l’eau et l’électricité, une correction des index des compteurs individuels " +
          "en fonction des compteurs généraux sera adaptée autant que de besoin.",
        "Les charges pour l'électricité, l'entretien des communs, l'entretien de la " +
          "chaudière seront divisées par 8",
        "{INTERNET}",
      ],
      fait: "Fait le {DATE}",
    },
  },

  // --- Prêt de meubles de la S.A. SAMADHI -------------------------------
  /* Source : Pre_t_Meuble_2023.pdf, image scannée, transcrite puis validée
     mot pour mot par Gérard le 11/09/2026. Seules modifications validées :
     « S.A. SAMADHI » partout, accord au pluriel en colocation, « Fait en
     2 exemplaires » retiré, ligne « Le locataire » retirée (la signature
     est celle du bloc « Signatures » du PV).

     La page n'est jointe qu'au PV d'ENTRÉE, quand l'option est activée,
     et JAMAIS sans description du mobilier.

     ADRESSES PROPRES AU PRÊT — jamais reprises des textes d'avenant. Un
     immeuble absent de cette liste (Havré, Vannes, Egmont) n'a pas
     l'option. Les textes supposent le bailleur GERARD Jean-Marc représenté
     par GERARD Julien, administrateur de la S.A. SAMADHI : un autre
     bailleur rend l'option indisponible.

     Champs : {LOCATAIRES} civilité + nom de chaque preneur ; {ADRESSE}
     adresse ci-dessous ; {BOITE} numéro du studio, ou nom du dossier
     OneDrive si ce n'est pas un studio ; {DATE} date de signature. */
  pret_meubles: {
    bailleur_cle: "jmg",
    representant: "GERARD Julien",
    adresses: {
      biche: "rue de la Biche 10",
      nimy: "rue de Nimy 94",
      "petite-guirlande": "rue de la Petite Guirlande 16",
      fermette: "rue du Pourcelet 65",
    },
    titre: "PRÊT DE MEUBLES",
    declaration: {
      un: "{LOCATAIRES}, déclare avoir reçu en prêt à titre gratuit de la S.A. SAMADHI, " +
        "Avenue Jean Sibélius 18 Boîte 36 1070 Bruxelles.",
      plusieurs: "{LOCATAIRES}, déclarent avoir reçu en prêt à titre gratuit de la S.A. SAMADHI, " +
        "Avenue Jean Sibélius 18 Boîte 36 1070 Bruxelles.",
    },
    mobilier: "Le mobilier suivant :",
    engagement: {
      un: "{LOCATAIRES}, s'engage à restituer ce mobilier et objets dans l'état reçu, à la " +
        "S.A. SAMADHI à la fin du bail qui le lie pour le logement sis à 7000 Mons " +
        "{ADRESSE} bte {BOITE}",
      plusieurs: "{LOCATAIRES}, s'engagent à restituer ce mobilier et objets dans l'état reçu, " +
        "à la S.A. SAMADHI à la fin du bail qui les lie pour le logement sis à 7000 Mons " +
        "{ADRESSE} bte {BOITE}",
    },
    indemnite: {
      un: "Si toutefois, ce mobilier ou objets étaient dégradés, le locataire s'engage à " +
        "indemniser la S.A. SAMADHI",
      plusieurs: "Si toutefois, ce mobilier ou objets étaient dégradés, les locataires " +
        "s'engagent à indemniser la S.A. SAMADHI",
    },
    fait: "Fait à Mons, le {DATE}",
    signature: "Pour la S.A. SAMADHI : GERARD Julien, administrateur",
  },

  /* Puces AJOUTÉES au protocole, imprimées UNIQUEMENT quand le prêt de
     meubles est joint. Validées par Gérard le 11/09/2026. */
  protocole_pret: [
    "Le preneur reconnaît avoir pris connaissance du prêt de meubles consenti à titre " +
      "gratuit par la S.A. SAMADHI, reproduit au présent document dont il fait partie " +
      "intégrante. Sa signature finale atteste de cette prise de connaissance et vaut " +
      "signature de ce prêt.",
    "GERARD Julien signe en qualité de mandataire du bailleur et d'administrateur de la " +
      "S.A. SAMADHI, prêteur du mobilier ; sa signature vaut pour les deux.",
  ],

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
