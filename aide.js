/* EDL — Mode d'emploi

   Écrit pour quelqu'un qui n'a pas participé à la conception : chaque
   écran est décrit dans l'ordre où on le rencontre, avec ce qu'il faut
   faire et ce qu'il ne faut pas faire.
*/

var AIDE = [
  {
    titre: "En deux mots",
    corps: [
      "Cette application remplace l'état des lieux sur papier. Elle prend les photos, " +
      "enregistre les constats, relève les compteurs, fait signer les deux parties et " +
      "dépose un document signé dans OneDrive.",
      "Tout est enregistré sur le téléphone au fur et à mesure. Si le réseau manque — " +
      "en cave, dans un garage — rien n'est perdu : les photos partent toutes seules " +
      "dès que le réseau revient.",
    ],
  },
  {
    titre: "Avant de partir",
    corps: [
      "Ouvre l'application depuis l'icône de l'écran d'accueil, jamais depuis Safari. " +
      "Installée, elle conserve ses données ; dans un onglet, iOS peut les effacer.",
      "Vérifie sur l'accueil que le compte Microsoft est affiché en vert. S'il reste " +
      "des photographies à envoyer, un bouton l'indique avec leur nombre et leur " +
      "poids : appuie dessus avant de partir, tant que tu es en wifi.",
      "Charge le téléphone. Une visite complète avec deux cents photos consomme " +
      "beaucoup de batterie.",
      "OUVRE L'APPLICATION AVANT DE DESCENDRE. Une fois lancée, elle fonctionne " +
      "sans réseau — cave, garage, sous-sol. Mais elle ne peut pas se lancer sans " +
      "réseau : ouvre-la en haut, puis descends.",
    ],
  },
  {
    titre: "1. Démarrer une visite",
    corps: [
      "Appuie sur « Démarrer une visite », puis choisis :",
      "— ENTRÉE ou SORTIE ;",
      "— l'immeuble ;",
      "— l'unité, avec le nom du locataire affiché en regard ;",
      "— le dossier du locataire dans OneDrive.",
      "Le dossier locataire change à chaque nouveau bail : lis bien le nom avant de " +
      "choisir. L'application indique « probable » à côté de celui qui correspond au " +
      "locataire de la liste, mais c'est toi qui décides.",
    ],
    attention: "Si l'application dit qu'un dossier EDLE ou EDLS n'existe pas, elle " +
      "refuse de démarrer. Crée-le dans OneDrive, puis reviens. Elle refuse aussi " +
      "de démarrer si elle ne parvient pas à préparer le sous-dossier Photos et son " +
      "lien de consultation : dans ce cas, fais l'état des lieux sur PAPIER. Le " +
      "message dit ce que Microsoft a répondu.",
  },
  {
    titre: "2. La composition du logement",
    corps: [
      "Coche les pièces présentes et le nombre de chambres et de salles de bain. " +
      "L'application prépare une fiche par pièce.",
      "Ces réglages sont mémorisés : à la prochaine visite de la même unité, ils " +
      "reviennent tout seuls.",
      "Tu peux les corriger en cours de visite : bouton « Modifier la composition » " +
      "sur l'écran des pièces. Ajoute une cave oubliée, une chambre de plus, ou change " +
      "un réglage de compteur.",
      "Une pièce qui contient déjà des photos ou des constats ne peut pas être retirée : " +
      "l'application refuse et te dit ce qu'elle contient.",
    ],
  },
  {
    titre: "3. L'identité du propriétaire",
    corps: [
      "Sur le récapitulatif, vérifie le bailleur. Il change selon l'immeuble, " +
      "et ta qualité change avec lui :",
      "— Nimy, Petite Guirlande, Vannes, La Fermette, Biche : le bailleur est " +
      "Jean-Marc Gérard, et tu le représentes ;",
      "— Havré : le bailleur est SAMADHI S.A., et tu la représentes ;",
      "— Egmont : le bailleur, c'est toi. Tu signes en ton nom, sans mention " +
      "de représentation.",
      "Le nom retenu ici sera celui du document signé et du courriel au locataire.",
    ],
    attention: "Une erreur de propriétaire rend le procès-verbal contestable. " +
      "L'application signale en rouge tout choix inhabituel.",
  },
  {
    titre: "4. Photographier et décrire",
    corps: [
      "Ouvre une pièce et prends les photos. Convention : depuis l'entrée, mur de face, " +
      "de gauche, de droite, arrière.",
      "La barre en haut d'écran indique où en sont les photos. Verte, tout est déposé " +
      "dans OneDrive ; orange, il en reste à envoyer.",
      "Sous chaque photo enregistrée, le bouton « Décrire cette photo » propose deux ou " +
      "trois phrases. Relis-les, corrige-les, puis appuie sur « Ajouter la constatation ».",
      "Tu peux aussi écrire toi-même, ou dicter avec le micro du clavier.",
      "Les boutons « état » et « propreté » se répondent séparément. Un second appui " +
      "sur un choix le désélectionne. Un constat peut se limiter à « bon état », sans texte.",
    ],
    attention: "Chaque « Décrire » est facturé — crédits Make et appel Gemini. " +
      "Une confirmation te le rappelle. Ne l'utilise que là où décrire prend du temps.",
  },
  {
    titre: "5. Compteurs, clés, état général",
    corps: [
      "Bouton « Compteurs, clés et état général » sur l'écran des pièces.",
      "Rien n'y est obligatoire : l'application rappelle ce qui n'est pas rempli, mais " +
      "ne bloque jamais.",
      "Les photos de compteur sont conseillées : elles appuient le relevé en cas de " +
      "contestation.",
      "À la sortie, un interrupteur permet de faire afficher les index de l'entrée en " +
      "regard. Un index inférieur à celui d'entrée est signalé.",
    ],
  },
  {
    titre: "6. Comparer avec l'entrée (sortie seulement)",
    corps: [
      "Rédige d'abord tes constats sans regarder l'entrée : c'est volontaire. Un constat " +
      "de sortie qui recopie l'entrée perd sa valeur.",
      "Ensuite, bouton « Comparer avec l'entrée ». L'application met les textes en regard, " +
      "pièce par pièce.",
      "Pour chaque écart, choisis : déjà présent à l'entrée, aggravé, ou nouveau. " +
      "Seuls « aggravé » et « nouveau » portent un montant.",
      "Une suggestion s'affiche quand elle est évidente, mais rien n'est classé " +
      "automatiquement : le jugement t'appartient.",
    ],
  },
  {
    titre: "7. Terminer et signer",
    corps: [
      "Bouton « Terminer la visite », puis « Passer à la signature ». Quatre étapes :",
      "IDENTITÉ — relève le numéro de la CARTE d'identité, celui du recto. Jamais le " +
      "numéro de Registre national : sa collecte est interdite au bailleur. Note aussi " +
      "l'adresse électronique, elle sert à envoyer le document.",
      "LECTURE — fais défiler le document entier avec le locataire, puis coche qu'il l'a lu.",
      "RÉSERVES — pose la question : « souhaitez-vous faire consigner des observations " +
      "ou des réserves ? » Consigne-les dans ses termes. S'il n'en a aucune, le document " +
      "le dira.",
      "SIGNATURES — chacun signe du doigt dans son cadre. Le dépôt reste bloqué tant " +
      "que tout le monde n'a pas signé.",
      "S'il reste des photographies à envoyer, tu peux signer quand même. Le document " +
      "porte alors une mention expresse : elles ont été prises pendant la visite, leur " +
      "date, leur heure et leur empreinte figurent en annexe, et le locataire les " +
      "consultera à l'adresse inscrite au document. Un bouton permet de les envoyer " +
      "sur-le-champ si le réseau est revenu.",
    ],
    attention: "La question des réserves doit être posée : c'est ce qui rend l'état des " +
      "lieux contradictoire. Sans elle, un état des lieux contesté est fragile.",
  },
  {
    titre: "8. Après la signature",
    corps: [
      "Le document est fabriqué sur le téléphone, son empreinte calculée, et il est " +
      "déposé dans le dossier du locataire.",
      "Appuie ensuite sur « Rapport Word et courriel au locataire ». Laisse « Rapport " +
      "Word » sur non, et « Courriel » sur oui.",
      "L'envoi le jour même établit que le locataire a reçu copie : cela fait partie " +
      "de la preuve.",
      "Le courriel contient aussi un lien vers les photographies, en lecture seule. " +
      "Ce lien ne donne accès qu'au dossier de la visite — EDLE ou EDLS — et à rien " +
      "d'autre : ni le bail, ni les autres locataires, ni le reste de OneDrive.",
      "Tu peux le désactiver au cas par cas, avec l'interrupteur « Lien vers les " +
      "photographies ».",
    ],
    attention: "Après signature, le document ne peut plus être modifié. Une correction " +
      "exige de créer une nouvelle version — voir la section suivante.",
  },
  {
    titre: "9. Corriger une erreur après signature",
    corps: [
      "Un document signé ne se modifie jamais. Si une erreur apparaît ensuite, " +
      "on crée une version suivante : la version signée reste dans le dossier, " +
      "intacte, et la nouvelle reprend tout son contenu.",
      "Sur l'accueil, dans la liste des visites terminées, appuie sur « Rectifier ».",
      "Écris le motif de la correction. Il est OBLIGATOIRE : sans lui, le bouton " +
      "« Créer la version » ne fait rien, et l'application te le dit. Ce texte figurera " +
      "au document : il explique au lecteur pourquoi deux versions coexistent.",
      "Corrige ensuite ce qui doit l'être, puis fais signer à nouveau les deux parties. " +
      "La nouvelle version n'a d'effet qu'une fois signée.",
    ],
    attention: "L'ancienne version n'est jamais effacée. Deux documents coexisteront " +
      "dans le dossier, V1 et V2 : c'est voulu, c'est ce qui rend la correction " +
      "incontestable.",
  },
  {
    titre: "Si le réseau manque",
    corps: [
      "Continue normalement. Photographier, écrire les constats, relever les compteurs, " +
      "compter les clés : tout fonctionne sans réseau. La barre du haut indique combien " +
      "de photographies attendent.",
      "Ce qui ne marche pas sans réseau : le bouton « Décrire », qui a besoin de l'IA.",
      "Les photographies restent sur le téléphone. Tu peux fermer l'application, " +
      "éteindre le téléphone : rien ne se perd, jamais. Elles ne sont effacées de " +
      "l'appareil qu'une fois que Microsoft a confirmé les avoir reçues.",
      "Une fois le réseau retrouvé : accueil, bouton « Envoyer les N photos en attente ». " +
      "Il envoie celles de TOUTES les visites, pas seulement de la dernière. Le même " +
      "bouton se trouve sur l'écran de fin de visite.",
      "Tu peux signer sans attendre qu'elles soient parties : le procès-verbal le " +
      "mentionne expressément et porte leur date, leur heure et leur empreinte.",
      "Si une photographie est refusée plusieurs fois par Microsoft, elle est signalée " +
      "à part et n'empêche plus les autres de partir. Reprends-la depuis l'écran de " +
      "la pièce.",
    ],
    attention: "L'application ne peut pas se LANCER la première fois sans réseau, et " +
      "une visite ne peut pas DÉMARRER sans réseau. Ouvre-la et démarre la visite en " +
      "haut, à la porte, puis descends.",
  },
  {
    titre: "Si quelque chose ne va pas",
    corps: [
      "L'application affiche un message qui dit quoi faire. Lis-le : il est écrit pour ça.",
      "Une visite interrompue reste sur l'accueil : appuie sur « Reprendre ».",
      "Une visite d'essai s'efface avec « Abandonner » — les fichiers déjà dans OneDrive, " +
      "eux, restent.",
      "En cas de doute, ne supprime rien et demande.",
    ],
  },
  {
    titre: "Ce qu'il ne faut jamais faire",
    corps: [
      "Ne supprime pas les fichiers « visite_….json » dans OneDrive : ils permettent la " +
      "comparaison entrée/sortie des années plus tard.",
      "Ne photographie jamais une carte d'identité.",
      "N'inscris jamais un numéro de Registre national.",
      "Ne modifie pas un document signé : crée une nouvelle version.",
    ],
  },
];


/* Glossaire — les termes que l'IA emploie et que personne ne connaît
   avant d'avoir lu un procès-verbal d'expert. Une ligne par terme. */
var GLOSSAIRE = [
  { g: "Échelle d'état", t: "neuf", d: "Jamais utilisé, sans trace d'usage." },
  { g: "Échelle d'état", t: "récent", d: "Posé depuis peu, aspect proche du neuf." },
  { g: "Échelle d'état", t: "terne", d: "A perdu son éclat, sans défaut par ailleurs." },
  { g: "Échelle d'état", t: "défraîchi", d: "Aspect fatigué, couleur passée, mais intact." },
  { g: "Échelle d'état", t: "usagé", d: "Traces d'usage nettes, encore fonctionnel." },
  { g: "Échelle d'état", t: "amorti", d: "En fin de vie. Sa valeur résiduelle est nulle." },

  { g: "Le bâti", t: "ébrasement", d: "Épaisseur du mur sur le côté d'une fenêtre ou d'une porte, entre le châssis et la surface du mur." },
  { g: "Le bâti", t: "chambranle", d: "Encadrement en bois qui entoure une porte." },
  { g: "Le bâti", t: "listel", d: "Fine baguette de finition, souvent en bois ou en carrelage." },
  { g: "Le bâti", t: "trumeau", d: "Pan de mur entre deux fenêtres." },
  { g: "Le bâti", t: "besquaire", d: "Petit mur bas sous une pente de toit, dans une pièce mansardée." },
  { g: "Le bâti", t: "limon", d: "Pièce inclinée qui porte les marches d'un escalier sur le côté." },
  { g: "Le bâti", t: "fuseau", d: "Barreau vertical d'une rampe d'escalier." },
  { g: "Le bâti", t: "main courante", d: "La barre qu'on tient en montant un escalier." },
  { g: "Le bâti", t: "pilastre", d: "Poteau de départ d'une rampe d'escalier." },
  { g: "Le bâti", t: "crédence", d: "Revêtement mural entre le plan de travail et les meubles hauts d'une cuisine." },
  { g: "Le bâti", t: "oculus", d: "Petite ouverture ronde ou ovale." },
  { g: "Le bâti", t: "petit-bois", d: "Barreaux qui divisent un vitrage en carreaux." },
  { g: "Le bâti", t: "portillon", d: "Porte d'un meuble bas ou d'un placard." },
  { g: "Le bâti", t: "clayette", d: "Étagère amovible dans un meuble ou un frigo." },
  { g: "Le bâti", t: "coiffe", d: "Abat-jour ou globe d'un point lumineux." },
  { g: "Le bâti", t: "soquet", d: "Douille dans laquelle se visse l'ampoule." },
  { g: "Le bâti", t: "patère", d: "Crochet mural pour suspendre un vêtement." },
  { g: "Le bâti", t: "rosace", d: "Cache circulaire au plafond, à la sortie du câble d'un luminaire." },
  { g: "Le bâti", t: "appui", d: "Tablette extérieure sous une fenêtre." },
  { g: "Le bâti", t: "cornière", d: "Profilé en L protégeant un angle." },
  { g: "Le bâti", t: "vanne thermostatique", d: "Robinet gradué d'un radiateur, qui règle la température." },

  { g: "Défauts — enduit et peinture", t: "fendille", d: "Fissure très fine dans l'enduit, sans gravité." },
  { g: "Défauts — enduit et peinture", t: "faïençage", d: "Réseau de craquelures superficielles, en maillage." },
  { g: "Défauts — enduit et peinture", t: "microfissure", d: "Fissure de moins d'un demi-millimètre." },
  { g: "Défauts — enduit et peinture", t: "lézarde", d: "Fissure large, au-delà de deux millimètres. À surveiller." },
  { g: "Défauts — enduit et peinture", t: "ouverture capillaire", d: "Aussi fin qu'un cheveu. On ne la mesure pas." },
  { g: "Défauts — enduit et peinture", t: "évidement", d: "Creux dans l'enduit, matière partie." },
  { g: "Défauts — enduit et peinture", t: "écrasement", d: "Enfoncement dû à un choc." },
  { g: "Défauts — enduit et peinture", t: "écaillement", d: "Peinture qui se détache en plaques." },
  { g: "Défauts — enduit et peinture", t: "pelade", d: "Peinture partie par plaques, laissant le support nu." },
  { g: "Défauts — enduit et peinture", t: "boursouflure", d: "Cloque, la peinture se soulève." },
  { g: "Défauts — enduit et peinture", t: "point de rebouche", d: "Trou rebouché, visible parce que non repeint." },
  { g: "Défauts — enduit et peinture", t: "jaspure", d: "Petites projections de peinture d'une autre couleur." },
  { g: "Défauts — enduit et peinture", t: "voile grisâtre", d: "Film gris terne sur une surface, en général lavable." },
  { g: "Défauts — enduit et peinture", t: "ombrage", d: "Zone plus foncée, souvent là où un meuble était posé." },
  { g: "Défauts — enduit et peinture", t: "hors plomb", d: "Pas vertical." },

  { g: "Défauts — bois et sols", t: "poinçon de clou", d: "Petit trou laissé par un clou ou une punaise." },
  { g: "Défauts — bois et sols", t: "griffe", d: "Rayure dans le matériau." },
  { g: "Défauts — bois et sols", t: "éraflure", d: "Rayure superficielle, en surface." },
  { g: "Défauts — bois et sols", t: "disjoint", d: "Deux éléments qui ne se touchent plus, un jour est apparu." },
  { g: "Défauts — bois et sols", t: "desserrage", d: "Ouverture d'un joint entre deux ouvrages." },
  { g: "Défauts — bois et sols", t: "épaufrée", d: "Se dit d'une arête écornée, ébréchée." },
  { g: "Défauts — bois et sols", t: "frottement", d: "Marque laissée par un objet frotté contre la surface." },

  { g: "Défauts — humidité", t: "auréole", d: "Cerne laissé par de l'eau. Ne dit pas d'où l'eau venait." },
  { g: "Défauts — humidité", t: "salpêtre", d: "Dépôt blanc poudreux, signe d'humidité dans le mur." },
  { g: "Défauts — humidité", t: "efflorescence", d: "Autre nom du dépôt blanchâtre." },
  { g: "Défauts — humidité", t: "pulvérulence", d: "Joint qui s'effrite et part en poudre." },
  { g: "Défauts — humidité", t: "grisonnant", d: "Joint qui a noirci, typique des salles de bain." },

  { g: "Matériaux", t: "plafonnage", d: "Enduit de finition sur les murs et plafonds. Le plâtre." },
  { g: "Matériaux", t: "grès cérame", d: "Carrelage très dur, courant dans les pièces d'eau." },
  { g: "Matériaux", t: "faïence", d: "Carrelage mural, plus tendre que le grès." },
  { g: "Matériaux", t: "thermolaqué", d: "Métal peint au four. Les châssis en aluminium le sont." },
  { g: "Matériaux", t: "mélaminé", d: "Panneau recouvert d'un film décoratif. Meubles de cuisine." },
  { g: "Matériaux", t: "stratifié", d: "Sol imitant le bois, en panneau revêtu." },
  { g: "Matériaux", t: "chanfreiné", d: "Dont l'arête a été coupée en biseau." },
  { g: "Matériaux", t: "chape", d: "Couche de mortier sous le revêtement de sol." },

  { g: "Formules d'expert", t: "pour mémoire", d: "Consigné sans être reproché à personne. Sert pour ce qui vient du bâtiment lui-même." },
  { g: "Formules d'expert", t: "sans remarque", d: "Rien à signaler sur cet élément." },
  { g: "Formules d'expert", t: "d'allure lavable", d: "Devrait partir au nettoyage. Distinction capitale : ce n'est pas une réparation." },
  { g: "Formules d'expert", t: "conforme", d: "Identique à ce qui a été décrit dans les généralités." },
  { g: "Formules d'expert", t: "fissuration constructive", d: "Fissure due aux mouvements du bâtiment, pas au locataire." },
  { g: "Formules d'expert", t: "usure normale", d: "Vieillissement inévitable d'un logement occupé normalement. À la charge du bailleur, jamais du locataire." },
  { g: "Formules d'expert", t: "vétusté", d: "Perte de valeur due à l'âge. Se déduit de ce qu'on peut réclamer." },
  { g: "Formules d'expert", t: "dégât locatif", d: "Dégradation liée à l'occupation, au-delà de l'usure normale. C'est ce qui se retient sur la garantie." },
];
