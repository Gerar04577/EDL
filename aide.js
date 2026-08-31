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
    titre: "4 bis. Décrire plusieurs photographies ensemble",
    corps: [
      "Quand une pièce demande quatre ou cinq vues, les décrire une par une fait " +
      "répéter la même fissure sous cinq angles. Coche-les et l'IA rédige UN seul " +
      "constat pour l'ensemble.",
      "PIÈCES D'EAU. Dans une pièce dont le nom contient salle de bain, WC, toilette, " +
      "douche, sanitaire, buanderie ou cuisine, l'IA reçoit des consignes " +
      "supplémentaires sur la propreté : entartrage, cernes, joints, calcaire. À la " +
      "SORTIE elle précise en outre, pour chaque salissure, si elle paraît nettoyable " +
      "ou incrustée dans le matériau — c'est cette distinction qui décide de la " +
      "retenue. Nomme donc tes pièces clairement : « SDB » fonctionne, « Pièce 3 » non.",
      "DEUX BOUTONS À L'ENTRÉE. « Décrire en détail » consigne tout défaut visible, " +
      "même une griffe ou un poinçon de clou. « Brièvement » ne retient que ce qu'on " +
      "remarque en entrant dans la pièce, et rédige en une à deux phrases. À la " +
      "SORTIE, un seul bouton : toujours le détail, car c'est ce document qui sert " +
      "devant le juge de paix.",
      "COCHER — sous chaque photographie déjà enregistrée, un bouton « cocher ». Il " +
      "n'apparaît pas sur une photographie encore en attente d'envoi : l'IA ne peut " +
      "pas la lire. À partir de deux cochées, un bloc s'ouvre en haut de l'écran.",
      "CE QU'IL FAUT REGARDER — avant de lancer, tu peux dicter ou écrire ce que la " +
      "photographie ne montre pas : « le châssis a été remplacé l'an dernier », " +
      "« regarde surtout le sol près de la porte », « ignore le mobilier ». C'est le " +
      "geste le plus utile de tout l'écran : une phrase ici vaut trois corrections " +
      "ensuite.",
      "RELIRE — le texte arrive dans un cadre que tu peux corriger au clavier ou au " +
      "micro. Le texte final est le tien.",
      "CORRIGER UNE SEULE PHOTOGRAPHIE. Sous la description, le bouton « Corriger » " +
      "ouvre un écran dédié : le texte, un champ pour dire ce qu'il faut changer, et " +
      "les mêmes deux boutons que pour un groupe. « Garder ce texte » le renvoie dans " +
      "le cadre de la photographie ; il reste à l'ajouter au constat.",
      "REFORMULER — écris ce qu'il faut changer, puis choisis. « Reformuler » " +
      "retravaille le texte sans rouvrir les images : rapide, presque gratuit. " +
      "« Revoir les photos » rouvre les images : plus lent, facturé comme une " +
      "description complète, et il demande confirmation. Autant de tours que " +
      "nécessaire.",
      "Si tu demandes quelque chose qui exige de regarder à nouveau — « tu as oublié " +
      "le sol » — l'IA te répond qu'il faut revoir les photographies. Utilise l'autre " +
      "bouton.",
      "AJOUTER AU CONSTAT — la constatation porte la liste des photographies du " +
      "groupe. Au procès-verbal elle s'affiche « photographies : 003, 004, 007 », et " +
      "l'annexe donne pour chacune sa date, son heure et son empreinte.",
      "Tu peux faire plusieurs groupes dans une même pièce : chacun donne une " +
      "constatation distincte. Décocher pendant qu'un constat est ouvert le remet à " +
      "zéro — il ne correspondrait plus aux photographies retenues.",
    ],
    attention: "L'IA n'écrit plus de formule creuse — sans remarque particulière, " +
      "rien à signaler, conforme. Quand un élément n'a rien, elle le nomme et " +
      "s'arrête, ou dit précisément ce qu'il ne présente pas : faïence sans éclat " +
      "ni fissure. Si une de ces formules revient malgré tout, demande simplement " +
      "« enlève la dernière phrase » et appuie sur Reformuler. " +
      "Tes consignes s'AJOUTENT aux règles de rédaction, elles ne les " +
      "remplacent pas. L'IA n'écrira jamais que l'état relève de l'usure normale, " +
      "n'imputera jamais un défaut à quelqu'un, ne chiffrera jamais rien : ces " +
      "appréciations t'appartiennent. Tu peux les écrire toi-même dans le cadre.",
  },
  {
    titre: "4 ter. L'ordre de visite et les abréviations",
    corps: [
      "L'ORDRE DES PIÈCES est celui d'un expert géomètre : les CHAMBRES " +
      "d'abord, puis la SALLE DE BAIN, les WC, la CUISINE et le SÉJOUR. Le " +
      "reste — hall, cave, terrasse, garage — vient à la fin. L'application " +
      "présente les pièces dans cet ordre, et le procès-verbal aussi : le " +
      "document se lit dans l'ordre où tu as marché, ce qui est plus " +
      "difficile à contester qu'une liste au hasard.",

      "L'ORDRE DES MURS, dans chaque pièce : GAUCHE, EN FACE, DROITE, " +
      "ENTRÉE. Toujours le même, pour ne rien oublier.",

      "GAUCHE ET DROITE SE COMPTENT DEPUIS L'EMBRASURE. Tiens-toi dans " +
      "l'encadrement de la porte, dos au couloir, en regardant vers " +
      "l'intérieur : ta gauche est le mur « Gauche », ta droite le mur " +
      "« Droite », celui d'en face est « En face », et le mur où se trouve " +
      "la porte est « Entrée ». Cette règle ne dépend pas de l'endroit où tu " +
      "te places ensuite dans la pièce.",

      "CINQ BOUTONS sous le titre de la pièce : Gauche, En face, Droite, " +
      "Entrée, Autre. Celui qui est vert est le mur en cours ; toutes tes " +
      "photographies porteront ce mur jusqu'à ce que tu en touches un autre. " +
      "GAUCHE est choisi d'avance à l'entrée de chaque pièce, puisque c'est " +
      "par là qu'on commence.",

      "« AUTRE » sert au sol, au plafond, à un radiateur au milieu, à une " +
      "vue d'ensemble — tout ce qui ne se rattache à aucun mur.",

      "LE COMPTE PAR MUR est affiché sous les boutons : G 4 · F 0 · D 0 · " +
      "E 0. Un zéro apparaît en rouge. En quittant la pièce, l'application " +
      "t'avertit s'il reste un mur sans photographie — elle ne t'empêche pas " +
      "de partir, mais elle te le dit.",

      "LES WC N'ONT PAS DE MURS distingués : quatre faces dans deux mètres " +
      "carrés n'apprennent rien à personne. Ni boutons, ni avertissement.",

      "UN RAPPEL EN GRAND s'affiche à l'entrée des DEUX PREMIÈRES pièces, " +
      "puis ne revient plus. Ensuite, la couleur des boutons suffit.",

      "LES ABRÉVIATIONS FIGURENT EN TÊTE du nom du fichier, juste après le " +
      "type d'état des lieux. C'est voulu : l'iPhone écrase le milieu des " +
      "noms trop longs, donc ce qui compte doit venir d'abord. Même tronqué, " +
      "« EDLS_CH1-G… » suffit à reconnaître la photographie.",

      "AUTRE AVANTAGE : dans un dossier trié par nom, les photographies se " +
      "groupent par pièce et par mur, au lieu de se mêler par date.",

      "PIÈCES — CH chambre · SDB salle de bain · SDE salle d'eau · WC · " +
      "CUI cuisine · SEJ séjour · HAL hall ou entrée · BUA buanderie · " +
      "CAV cave · GRE grenier · TER terrasse ou jardin · GAR garage. Le " +
      "chiffre suit quand il y en a plusieurs : CH1, CH2, WC2.",

      "MURS — G gauche · F en face · D droite · E entrée · DIV autre.",

      "EXEMPLE — EDLS_CH1-G_2026-08-30_012_ab12.jpg se lit : état des lieux " +
      "de sortie, chambre 1, mur de gauche, 30 août 2026, douzième " +
      "photographie de la pièce.",
    ],
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
    titre: "5 bis. Refaire les mêmes cadrages qu'à l'entrée (sortie)",
    corps: [
      "À la SORTIE seulement. Dans une pièce, le bouton « Photos de l'entrée » " +
      "ouvre les photographies de l'état des lieux d'entrée, lues dans le dossier " +
      "EDLE voisin. Les textes de l'entrée, eux, restent fermés : ton constat de " +
      "sortie se rédige à l'aveugle, et c'est ce qui lui donne sa valeur.",

      "DEUX TRIS. « Avec constat » ne montre que les photographies rattachées à " +
      "une constatation de l'entrée — souvent une vingtaine sur deux cents, ce " +
      "sont celles qui documentent quelque chose. « Toutes » les affiche par " +
      "tranches de cinquante. Sur un état des lieux d'entrée fait avant " +
      "l'application, il n'y a pas de fichier de données : seul « Toutes » " +
      "fonctionne.",

      "LE NOM DU PRENEUR VIENT DU DOSSIER ONEDRIVE que tu choisis, jamais de " +
      "Gestion Loyers — les noms y changent au fil des baux. La mention " +
      "« probable » ne sert qu'à repérer le bon dossier plus vite.",
      "TOUCHE UNE VIGNETTE pour ouvrir la visée. La photographie d'entrée " +
      "apparaît en transparence par-dessus la caméra, et un score te dit à quel " +
      "point tu retrouves le cadrage. Le curseur règle la transparence : le " +
      "va-et-vient entre 0 et 100 % est souvent le plus efficace.",

      "LE SCORE. Il compare les CONTOURS, pas les couleurs : un changement " +
      "d'éclairage entre l'entrée et la sortie ne le fait pas varier. Le cadre " +
      "verdit à 60 %, valeur éprouvée sur le terrain. En dessous, une consigne " +
      "s'affiche — recule, pivote à gauche, relève.",

      "L'ÉCHELLE SE CHERCHE TOUTE SEULE. Si la photographie d'entrée a été " +
      "prise en zoomant, elle montre les choses plus grosses que ta caméra : " +
      "l'application s'en aperçoit et ajuste la superposition. Tu n'as rien " +
      "à faire. Le pourcentage s'affiche sous l'image, et 100 % veut dire " +
      "qu'aucune correction n'est nécessaire.",

      "JUSQU'À UN ZOOM DE QUATRE FOIS, le guidage fonctionne. Au-delà — une " +
      "écornure photographiée de très près, un joint, une prise — la " +
      "référence ne montre qu'un tout petit morceau de la pièce et retrouver " +
      "ce cadrage à main levée devient impossible. Reprends alors la " +
      "photographie à vue : tu as la vignette d'entrée sous les yeux, tu " +
      "sais ce que tu cherches.",

      "UN CURSEUR DE SECOURS reste disponible sous l'image : « Zoom de la " +
      "référence ». Le toucher arrête la recherche automatique ; le bouton " +
      "juste en dessous la relance.",

      "LE BOUTON AUTO est dans l'image, en bas à droite. Vert avec un point " +
      "quand il est actif. Le déclencheur rond, lui, est juste sous l'image, " +
      "à portée de pouce.",

      "LA PHOTOGRAPHIE DE SORTIE SERA PLUS CLAIRE que celle d'entrée, et ce " +
      "n'est pas réglable : le navigateur n'a pas accès au traitement d'image " +
      "d'Apple. Tiens-en compte quand tu apprécies une salissure — elle " +
      "paraîtra moins marquée qu'elle ne l'est. Si un doute subsiste, " +
      "photographie de plus près.",

      "DÉCLENCHEMENT AUTOMATIQUE. Un bouton l'active. Une fois les 60 % " +
      "atteints, le cadre passe à l'orange et un décompte s'affiche : NE BOUGE " +
      "PLUS pendant une seconde. C'est ce temps qui permet à l'appareil de faire " +
      "sa mise au point — sans lui, la photographie partait pendant le geste et " +
      "sortait floue. Si tu bouges, le décompte repart de zéro.",
      "Puis elle part seule, avec un bandeau vert et une vibration. Elle ne part " +
      "qu'UNE fois : l'automatique se remet à l'arrêt aussitôt, sans quoi la " +
      "photo se reprendrait dix fois par seconde.",

      "TU VOIS TOUJOURS LE RÉSULTAT. Après la prise, les deux images " +
      "s'affichent côte à côte avec le score, la définition et le poids. Rien " +
      "n'est enregistré ni envoyé dans OneDrive tant que tu n'as pas appuyé sur " +
      "« Garder ». « Refaire » relance la visée, « Abandonner » revient à la " +
      "pièce.",

      "APRÈS « GARDER », TU REVIENS SUR CETTE PHOTOGRAPHIE, pas en haut de " +
      "la pièce. Elle est entourée d'un liseré vert et signalée « Celle que " +
      "tu viens de garder ». Les photographies déjà décrites sont légèrement " +
      "estompées. C'est là que tu écris ta constatation, ou que tu touches " +
      "« Comparer avec l'entrée ». Le liseré disparaît dès que la " +
      "constatation est ajoutée.",

      "CE QUI EST CONSERVÉ. La photographie gardée porte le lien vers sa vue " +
      "d'entrée et le score obtenu. Ce score figurera au procès-verbal : il dit " +
      "objectivement à quel point les deux vues sont comparables.",

      "TROIS RÉGLAGES, sous le bouton « Réglages » de l'écran de visée. Le SEUIL " +
      "d'alignement — bas, il déclenche vite mais cadre moins bien ; haut, il " +
      "exige une précision parfois impossible. L'IMMOBILITÉ avant la prise — la " +
      "mettre à zéro rend les photographies floues. La QUALITÉ de l'image, entre " +
      "0,80 et 1,00. Ils sont conservés pour les visites suivantes, et un bouton " +
      "les ramène aux valeurs d'usine.",
      "SURFACE TROP UNIE. Si la photographie d'entrée n'offre presque aucun " +
      "contour — un pan de mur nu, sans plinthe ni angle — l'écran te prévient : " +
      "le score sera peu fiable, fie-toi alors à la superposition. En pratique " +
      "c'est rare : un mur porte presque toujours une plinthe, un angle, une " +
      "prise.",

      "LES ANCIENS ÉTATS DES LIEUX marchent aussi. Leurs photographies ont été " +
      "prises à l'iPhone et déposées à la main dans OneDrive : elles sont au " +
      "format HEIC, que le navigateur n'affiche pas, et portent des noms sans " +
      "numéro ni pièce. L'application les convertit à la volée et affiche " +
      "l'heure de prise à la place du numéro, dans l'ordre de la visite.",
    ],
    attention: "La caméra s'éteint dès que tu quittes l'application, même deux " +
      "secondes : iOS l'impose. L'écran te le dit et te ramène à la pièce ; " +
      "touche à nouveau la vignette pour reprendre.",
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

      "DEUX COMPARAISONS, À NE PAS CONFONDRE. Cet écran rapproche les TEXTES, " +
      "pièce par pièce, et sert à classer et chiffrer. Le bouton violet " +
      "« Comparer avec l'entrée », lui, se trouve sous une photographie prise en " +
      "visée guidée : il rapproche les IMAGES et fait constater l'écart par l'IA.",

      "Le bouton violet n'apparaît que sur une photographie reprise depuis une " +
      "vue d'entrée, et une fois qu'elle est enregistrée dans OneDrive. L'IA " +
      "reçoit les deux images et décrit ce qui a changé : l'élément, la nature, " +
      "la localisation, l'ampleur, et si la salissure paraît nettoyable ou " +
      "incrustée dans le matériau.",

      "ELLE NE CLASSE RIEN. Ni nouveau, ni aggravé, ni imputable, ni un montant. " +
      "C'est ton travail, et c'est ce qui protège le document : une application " +
      "qui qualifierait à ta place affaiblirait le procès-verbal au lieu de le " +
      "renforcer.",

      "ELLE PEUT REFUSER. Si les cadrages sont trop différents ou l'éclairage " +
      "incomparable, elle répond « COMPARAISON IMPOSSIBLE » avec sa raison. " +
      "C'est voulu : mieux vaut un refus qu'un écart inventé. Le texte revient " +
      "dans le cadre de la photographie, corrigeable comme les autres.",
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
      "déposé dans le dossier du locataire. Sans réseau, il attend dans la file et " +
      "part au bouton « Envoyer ».",
      "Appuie ensuite sur « Rapport Word et courriel au locataire ». Laisse « Rapport " +
      "Word » sur non, et « Courriel » sur oui.",
      "L'envoi le jour même établit que le locataire a reçu copie : cela fait partie " +
      "de la preuve.",
      "Le courriel contient aussi un lien vers les photographies, en lecture seule. " +
      "Ce lien figure DÉJÀ dans le procès-verbal signé : il est créé au démarrage de " +
      "la visite, en même temps que le sous-dossier Photos.",
      "Il ne montre QUE les photographies. Ni le fichier de données — qui contient le " +
      "numéro de carte d'identité et les montants —, ni le procès-verbal, ni le bail, " +
      "ni les autres locataires. C'est pourquoi les photographies vont dans un " +
      "sous-dossier Photos et le reste au niveau au-dessus : ne déplace jamais ces " +
      "fichiers à la main dans OneDrive.",
      "Tu peux le désactiver au cas par cas, avec l'interrupteur « Lien vers les " +
      "photographies ».",
    ],
    attention: "Après signature, le document ne peut plus être modifié. Une correction " +
      "exige de créer une nouvelle version — voir la section suivante. La dernière page " +
      "du procès-verbal est l'ANNEXE : chaque photographie y figure avec sa date, son " +
      "heure et son empreinte. C'est elle qui permet de vérifier, des années plus tard, " +
      "qu'une photographie produite est bien celle qui a été présentée au locataire.",
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
      "Une fois le réseau retrouvé : accueil, bouton « Envoyer ». Il envoie tout ce qui " +
      "attend, pour TOUTES les visites, pas seulement la dernière. Le même bouton se " +
      "trouve sur l'écran de fin de visite.",
      "Tu peux signer sans attendre : la signature aboutit même sans réseau. Le " +
      "procès-verbal est fabriqué sur le téléphone, son empreinte calculée, et il " +
      "attend son tour dans la même file que les photographies. L'écran affiche alors " +
      "« Document signé — dépôt en attente de réseau ».",
      "Tant que le procès-verbal n'est pas déposé, le bouton « Rapport Word et courriel » " +
      "n'apparaît pas : le scénario n'aurait rien à joindre. Envoie d'abord, le bouton " +
      "revient ensuite.",
      "Le procès-verbal mentionne expressément les photographies restées à déposer, " +
      "avec leur date, leur heure et leur empreinte.",
      "Si une photographie est refusée plusieurs fois par Microsoft, elle est signalée " +
      "à part et n'empêche plus les autres de partir. Reprends-la depuis l'écran de " +
      "la pièce.",
    ],
    attention: "L'application ne peut pas se LANCER la première fois sans réseau, et " +
      "une visite ne peut pas DÉMARRER sans réseau. Ouvre-la et démarre la visite en " +
      "haut, à la porte, puis descends.",
  },
  {
    titre: "Obligations du locataire — aide-mémoire",
    corps: [
      "En bas de ce mode d'emploi, un bouton ouvre la liste des obligations du " +
      "locataire : propreté, sanitaires, cuisine, chauffage, châssis, ventilation, " +
      "sols, peintures, électricité, nicotine, clés, nuisibles.",
      "Elle vient de la liste wallonne des réparations locatives, réduite à ce qui " +
      "concerne un studio ou un petit appartement. Elle sert à savoir quoi regarder " +
      "et quoi photographier — pas à discuter sur place.",
      "Le poste le plus souvent décisif est le dernier : le locataire doit signaler " +
      "toute défectuosité dans un délai raisonnable. S'il s'est tu, il supporte " +
      "l'aggravation des dommages.",
    ],
    attention: "Ne montre pas cette liste au locataire pendant la visite. Elle n'est " +
      "pas exhaustive et ne remplace pas le bail : brandie comme une règle, elle " +
      "affaiblit ta position au lieu de la renforcer. Elle est là pour toi.",
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
/* ---- Obligations du locataire — aide-mémoire de l'opérateur -----------

   Tiré de la liste wallonne non limitative des réparations locatives.
   Adapté aux studios et petits appartements : les postes qui n'existent
   pas dans ce parc — jardin, piscine, ascenseur, façade, parties
   communes — ne figurent pas ici.

   DESTINÉ À JULIEN, PAS AU LOCATAIRE. Un tableau non exhaustif présenté
   comme une règle devant le preneur se retourne facilement. Il sert à
   savoir quoi regarder et quoi documenter, pas à argumenter sur place. */
var OBLIGATIONS = [
  { t: "Propreté générale", d: "Le bien est rendu vide et propre, quel que soit l'âge des décors. Lessivage des murs et plafonds en cas d'empoussièrement ou de souillure. Les frais d'enlèvement des objets, décombres et détritus sont à charge du preneur." },
  { t: "Sanitaires", d: "Détartrage, remplacement des joints de vannes et robinets, des filtres, mousseurs, flexibles et pommes de douche. Nettoyage des éviers, lavabos, baignoires, receveurs et WC. Manœuvre régulière des robinets thermostatiques et vannes d'arrêt. Le preneur répond des éclats, écornures, fêlures, percussions et griffures." },
  { t: "WC et chasse", d: "Remplacement des joints, élimination du calcaire, réparation du dispositif de commande, réglage du flotteur. Remplacement du manchon de raccord au tuyau de chute, des charnières, sièges et couvercles brisés. Cuvette maintenue en bon état de propreté." },
  { t: "Cuisine et électroménager", d: "Nettoyage, détartrage, dégivrage et dégraissage, en particulier des filtres et gicleurs. Remplacement des boutons, lampes témoins, poignées, joints de portes. Bacs à savon et joints de hublot maintenus propres. Le preneur répond des griffures et cristallisations sur vitrocéramique." },
  { t: "Chauffe-eau et chaudière", d: "Entretien périodique par un professionnel agréé, selon la législation et le bail. L'attestation doit être remise au bailleur à sa demande. Purge des radiateurs, manœuvre des vannes, étanchéité des raccords, pression d'eau adéquate." },
  { t: "Châssis et vitres", d: "Nettoyage des canaux d'évacuation des eaux de condensation et de la chambre de décompression. Lavage des vitres intérieures et extérieures accessibles. Manœuvre régulière des ouvrants. Le preneur répond des taches, coups, griffures et échardes, et refixe baguettes, socles et moulures détachés." },
  { t: "Ventilation et humidité", d: "Aération normale des locaux, grilles dégagées. Le preneur prévient immédiatement de toute infiltration ou apparition de champignons. En cas de mérule pendant l'occupation, c'est à lui de prouver l'absence de faute." },
  { t: "Sols", d: "Protections sous les pieds de meubles. Le preneur répond des griffures, brûlures, traces de coups, déchirures, taches et traces de talons, ainsi que des dégâts d'un nettoyage inadapté. Parquets et stratifiés se nettoient à sec ou à peine humides." },
  { t: "Peintures et enduits", d: "En fin d'occupation, les peintures — même amorties — ne peuvent être ni poussiéreuses, ni souillées, ni grasses. Le preneur répare localement les dégradations dues aux chevilles, clous et crampons, et enlève les accessoires de tapissier." },
  { t: "Électricité", d: "Remplacement à l'identique des petits accessoires : interrupteurs, prises, témoins lumineux, fusibles, ampoules, soquets. Le tableau électrique n'est pas modifié. Une dizaine de centimètres de fils apparents doivent rester à chaque point lumineux." },
  { t: "Nicotine", d: "Poste distinct, avec ses frais propres : lessivage des peintures et, dans certains cas, couche de fond, quel que soit le degré d'amortissement. Nettoyage spécifique des prises, interrupteurs, prises d'air, radiateurs et convecteurs. Nettoyage des textiles imprégnés." },
  { t: "Clés et accès", d: "Restitution de tous les exemplaires, copies comprises. Les clés manquantes ou hors d'usage sont remplacées. En cas de perte d'une clé donnant accès au bien, le preneur remplace le barillet avec le même nombre de clés. Boîtier à code : transmettre le code en usage." },
  { t: "Nuisibles", d: "Désinfection et désinsectisation à charge du preneur : cafards, punaises, rongeurs. Traitement spécifique des moquettes s'il a détenu chiens ou chats." },
  { t: "Prévenir le bailleur", d: "Le preneur doit signaler toute défectuosité dans un délai raisonnable. À défaut, il supporte l'aggravation des dommages causés par sa passivité. C'est un point souvent décisif." },
  { t: "Ce qui reste au bailleur", d: "Usure normale, vétusté, force majeure, vice de construction ou malfaçon, grosses réparations et gros entretien. Et tout ce qui aurait dû être fait avant l'entrée du locataire. Cette répartition ne peut pas être modifiée par le bail pour une résidence principale." },
];

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

  /* ---- Formules à employer et à bannir ---------------------------------
     Ce que l'IA écrit vient de la consigne ; ce que TU écris ou corriges
     dans le cadre éditable n'est contrôlé par personne. D'où ce glossaire :
     il vaut pour tes corrections à la main autant que pour la relecture. */

  { g: "À BANNIR — toujours", t: "usure normale, vétusté", d: "Ces mots reconnaissent que le défaut n'est pas imputable. Les écrire dans un constat revient à renoncer à toute retenue. C'est au juge de qualifier, pas à toi." },
  { g: "À BANNIR — toujours", t: "le locataire a, il a été causé par", d: "Aucune imputation dans le constat. Tu décris ce que tu vois ; la responsabilité se discute ailleurs, avec la comparaison entrée-sortie." },
  { g: "À BANNIR — toujours", t: "à remplacer, coût, devis, environ 200 euros", d: "Aucun chiffrage dans la description. Le chiffrage se fait à l'écran de comparaison, séparément." },
  { g: "À BANNIR — toujours", t: "récent, depuis peu, apparu après", d: "Aucune date d'apparition : une photographie ne dit pas quand un défaut est né." },
  { g: "À BANNIR — toujours", t: "décor récent, d'aspect récent, refait à neuf", d: "Une photographie ne dit pas l'âge d'une peinture. Écris ce qui se voit : peinture sans écaillage ni reprise apparente, ou raccord de teinte visible." },
  { g: "À BANNIR — toujours", t: "décor terne, décor fatigué", d: "Terne par rapport à quoi ? Dis ce qui le montre : perte de brillant du feuil, teinte inégale entre deux pans, empoussièrement." },
  { g: "À BANNIR — toujours", t: "infiltration, remontée capillaire, condensation", d: "L'origine d'une humidité ne se voit pas sur une photographie. Écris auréole, cloque, moisissure — le constat, pas la cause." },
  { g: "À BANNIR — toujours", t: "RAS, conforme, bon état général, sans remarque particulière", d: "Ne décrivent rien et noient les vraies constatations. Nomme l'élément et son matériau, puis arrête-toi." },
  { g: "Structure du constat", t: "MUR DE LA FENÊTRE, MUR DU FOYER, MUR DE LA PORTE", d: "Chaque mur se désigne par ce qu'il porte. Un constat qui dit seulement « les murs » ne situe rien : devant un juge, on ne saura pas de quel mur il s'agit." },
  { g: "Structure du constat", t: "MUR SANS ÉLÉMENT DISTINCTIF", d: "Quand rien ne permet de nommer un mur. Vaut mieux que d'inventer une orientation ou d'écrire « mur de gauche » — gauche par rapport à quoi ?" },
  { g: "Structure du constat", t: "ordre des rubriques", d: "PLAFOND, RETOMBÉES ET JOUES, les MURS, PORTES, CHÂSSIS, ESCALIER, SOLS, ÉQUIPEMENTS FIXES, APPAREILS. Toujours le même ordre, du haut vers le bas : c'est ce qui rendra la comparaison entrée-sortie lisible." },
  { g: "Structure du constat", t: "ÉLECTRICITÉ", d: "Rubrique à part : prises, interrupteurs, variateurs, plaques de finition, points lumineux et plafonniers. Jamais dispersés dans les rubriques de mur — ils y apparaissaient deux fois, et rassemblés ils se comparent bien mieux à la sortie." },
  { g: "Structure du constat", t: "observer n'est pas conclure", d: "À la sortie, écris « allumé au moment de la prise de vue », jamais « fonctionnel » : aucun interrupteur n'a été actionné. Une affirmation de fonctionnement démentie plus tard fragilise tout le document. Si tu as vérifié toi-même, écris-le à la main." },
  { g: "Structure du constat", t: "PORTES, CHÂSSIS, ESCALIER séparés", d: "Jamais fondus dans une rubrique MENUISERIES. Une porte, un châssis et un escalier ne se dégradent pas de la même façon et ne se comparent pas ensemble à la sortie." },
  { g: "Structure du constat", t: "ligne PHOTOGRAPHIES", d: "En fin de constat, ce que montre chaque cliché. Elle rattache chaque photographie à un élément nommé, ce qu'exige la jurisprudence pour qu'une photo ait valeur probante." },
  { g: "Structure du constat", t: "nord, sud, est, ouest", d: "À BANNIR. L'IA ne peut pas connaître l'orientation, et une orientation fausse dans un document signé se retourne contre celui qui l'a écrite. Si tu la connais, écris-la toi-même." },

  { g: "À BANNIR — toujours", t: "il semble, on dirait, probablement", d: "Un constat affirme ce qui est visible ou se tait. L'hypothèse fragilise tout le document." },

  { g: "À ÉCRIRE — entrée (EDLE)", t: "faïence sans éclat ni fissure", d: "L'affirmation d'intégrité porte sur un élément NOMMÉ et sur ce qu'il ne présente pas. C'est ce qui te sert à la sortie si la faïence est fêlée." },
  { g: "À ÉCRIRE — entrée (EDLE)", t: "double vitrage intact", d: "Même principe. Vaut bien mieux qu'un bon état général, qui ne prouve rien." },
  { g: "À ÉCRIRE — entrée (EDLE)", t: "deux poinçons de clou à mi-hauteur", d: "Les petits défauts se consignent AUSSI à l'entrée. Un défaut non consigné devient un défaut nouveau à la sortie, réclamé à quelqu'un qui ne l'a pas causé — et le procès-verbal tombe si le juge regarde les photographies." },
  { g: "À ÉCRIRE — entrée (EDLE)", t: "sur environ 2 dm², de l'ordre de 5 cm", d: "Sans ampleur, un défaut d'entrée ne sert pas de point de comparaison. Toujours en ordre de grandeur, jamais au millimètre." },

  { g: "À ÉCRIRE — sortie (EDLS)", t: "impact de 3 cm en zone centrale", d: "Élément, nature, localisation, ampleur. Les quatre, à chaque fois." },
  { g: "À ÉCRIRE — sortie (EDLS)", t: "marqué dans le matériau / superficiel d'allure lavable", d: "La distinction décisive : ce qui part au nettoyage ne se retient pas comme ce qui entame la matière." },
  { g: "À ÉCRIRE — sortie (EDLS)", t: "trois trous de cheville non rebouchés", d: "Compte quand tu peux compter. Un nombre vaut mieux que quelques." },
  { g: "À BANNIR — sortie (EDLS)", t: "un peu, quelques traces, correct, acceptable", d: "Les atténuations affaiblissent la retenue. Décris précisément, sans adoucir ni exagérer." },

  { g: "À ÉCRIRE — sortie (EDLS)", t: "bord de fissure encrassé", d: "À la SORTIE seulement, l'ancienneté apparente se décrit quand elle se voit : bord encrassé ou net, coulure sèche ou fraîche, poussière déposée dans un impact. Formule ce que tu observes, jamais ce que tu supposes." },
  { g: "À ÉCRIRE — sortie (EDLS)", t: "auréole partant du joint de châssis", d: "À la SORTIE, l'origine d'une humidité se mentionne si elle est visible. À l'ENTRÉE, jamais." },
  { g: "À ÉCRIRE — sortie (EDLS)", t: "vitrocéramique fêlée, poignée arrachée", d: "À la SORTIE, l'état d'un appareil se constate quand il est manifeste à l'œil. À l'ENTRÉE, on ne se prononce pas." },

  /* ---- Reformulation : ce qui marche et ce qui ne marche pas ----------
     Tiré des essais du 26/08/2026. Le modèle obéit aux demandes qui
     désignent un élément précis ou donnent un nombre ; il reste inerte
     devant les demandes vagues. */

  { g: "REFORMULER — demandes efficaces", t: "supprime la phrase sur le sol", d: "Désigne un élément précis du texte. C'est la forme qui marche le mieux." },
  { g: "REFORMULER — demandes efficaces", t: "trois phrases maximum", d: "Un nombre fait loi et prime sur toute autre indication de longueur. Toujours chiffrer." },
  { g: "REFORMULER — demandes efficaces", t: "regroupe les deux dernières phrases", d: "Une opération concrète sur une partie identifiable." },
  { g: "REFORMULER — demandes efficaces", t: "développe la description du mur", d: "Nomme l'élément à étoffer. Sans photographies, l'IA ne peut qu'étoffer ce qui est déjà écrit." },
  { g: "REFORMULER — demandes efficaces", t: "rends le texte plus fluide", d: "Fonctionne depuis que les règles de style cèdent devant la demande. Attention : un constat trop fluide perd le style d'expert qui fait sa crédibilité." },
  { g: "REFORMULER — demandes efficaces", t: "ne parle pas des cadres photographiques", d: "Une exclusion nommée est comprise." },

  { g: "REFORMULER — demandes inutiles", t: "tout, mieux, améliore", d: "Sans objet désigné, le modèle n'a rien à appliquer et recopie. L'application refuse d'ailleurs les instructions de moins de trois mots." },
  { g: "REFORMULER — demandes inutiles", t: "plus court, plus long", d: "Sans nombre, l'indication est trop vague. Écris trois phrases maximum, ou développe le paragraphe sur le sol." },
  { g: "REFORMULER — demandes inutiles", t: "tu as oublié le sol", d: "Avec « Reformuler », l'IA ne revoit pas les images : elle ne peut pas ajouter ce qu'elle ne voit pas. Utilise « Revoir les photos »." },
  { g: "REFORMULER — demandes inutiles", t: "deux demandes contraires à la suite", d: "Plus court puis plus long : la demande du moment l'emporte, mais le résultat devient erratique. Utilise « Repartir du texte d'origine »." },

  /* ---- Propreté des sanitaires ---------------------------------------
     Poste de retenue fréquent. Le vocabulaire ci-dessous décrit ; les
     mots bannis jugent. */

  { g: "Sanitaires — propreté", t: "entartrage", d: "Dépôt calcaire épais et durci. Le mot juste pour l'intérieur d'une cuvette ou le pourtour d'une bonde." },
  { g: "Sanitaires — propreté", t: "voile calcaire", d: "Dépôt léger et superficiel, sur une paroi de douche ou un chromage. Part généralement au produit." },
  { g: "Sanitaires — propreté", t: "cerne au niveau d'eau", d: "La marque horizontale à la surface de l'eau d'une cuvette. Se dit continu ou discontinu." },
  { g: "Sanitaires — propreté", t: "dépôt sous le rebord", d: "Sous le rebord de la cuvette, là où l'eau de chasse circule. Zone que l'on nettoie rarement — donc révélatrice." },
  { g: "Sanitaires — propreté", t: "coulure calcaire", d: "Trace verticale laissée par un écoulement, le long d'une cuve ou sous un robinet." },
  { g: "Sanitaires — propreté", t: "salissure organique", d: "Terme neutre pour ce qui n'est ni calcaire ni moisissure. Évite d'avoir à nommer la chose." },
  { g: "Sanitaires — propreté", t: "joint silicone noirci, grisonnant", d: "Le noircissement est une moisissure installée dans le joint ; le grisonnement est plus superficiel." },
  { g: "Sanitaires — propreté", t: "résidu savonneux", d: "Film blanchâtre sur une paroi ou un bac de douche." },
  { g: "Sanitaires — propreté", t: "piqûre du chromage", d: "L'oxydation a entamé le métal. C'est une atteinte au matériau, pas une salissure." },
  { g: "Sanitaires — propreté", t: "superficiel et d'allure nettoyable / incrusté dans le matériau", d: "LA distinction décisive à la sortie. Ce qui part au produit n'est pas un dégât ; un émail piqué par le calcaire en est un. L'IA le précise pour chaque salissure." },
  { g: "Sanitaires — À BANNIR", t: "entretenu, propre, sale, négligé, correct", d: "Ce sont des appréciations, pas des constats. Un locataire les conteste, un juge les écarte. Écris ce que tu vois : entartrage brunâtre sous le rebord, cerne continu au niveau d'eau." },

  /* ---- Sanitaires : atteintes au matériau ----------------------------
     Registre distinct de la propreté. Une salissure se nettoie ; une
     atteinte au matériau reste. C'est celle-ci qui justifie une retenue. */

  { g: "Sanitaires — atteintes au matériau", t: "éclat", d: "Morceau d'émail ou de faïence parti, laissant la matière à nu. Ne se répare pas : une retouche visible n'est pas une remise en état." },
  { g: "Sanitaires — atteintes au matériau", t: "écornure", d: "Éclat sur un angle ou un bord — rebord de lavabo, coin de bac de douche." },
  { g: "Sanitaires — atteintes au matériau", t: "percussion", d: "Trace d'un choc, avec ou sans perte de matière. Le mot d'expert pour un impact sur émail." },
  { g: "Sanitaires — atteintes au matériau", t: "altération du brillant", d: "L'émail terni, généralement par un produit inadapté. Ce n'est pas une salissure : le matériau lui-même a changé, et ça ne se nettoie pas." },
  { g: "Sanitaires — atteintes au matériau", t: "mousseur, brise-jet", d: "L'embout vissé au bout du robinet. S'entartre et se remplace." },
  { g: "Sanitaires — atteintes au matériau", t: "flexible de douche", d: "Élément à part de la robinetterie, qui se remplace seul." },
  { g: "Sanitaires — atteintes au matériau", t: "joint souple périphérique", d: "Le silicone du pourtour d'une baignoire ou d'un bac, distinct des joints de faïence. Sa défaillance provoque des infiltrations sous le bac." },
  { g: "Sanitaires — atteintes au matériau", t: "manchon de raccord", d: "La pièce reliant la cuvette au tuyau de chute, derrière le WC. Regarde-la : les fuites commencent là." },
  { g: "Sanitaires — atteintes au matériau", t: "inverseur", d: "Le sélecteur bain-douche d'un mitigeur. Se bloque quand il n'est pas manœuvré." },
  { g: "Sanitaires — atteintes au matériau", t: "cartouche thermostatique", d: "Le cœur d'un mitigeur thermostatique." },
  { g: "Sanitaires — atteintes au matériau", t: "trace d'adhésif antidérapant", d: "Le retrait d'un adhésif de fond de baignoire laisse une empreinte, et arrache parfois l'émail." },

  /* ---- Miroirs, électroménager, électricité, nicotine, ventilation ---- */

  { g: "Miroirs", t: "oxydation du tain", d: "Le tain se pique en bord de miroir, généralement dans une pièce mal ventilée. Se constate, sans conclure sur la cause." },
  { g: "Miroirs", t: "points de fixation", d: "Pattes, clips ou collage. Un miroir descellé se signale." },

  { g: "Électroménager", t: "cristallisation", d: "Marque blanchâtre incrustée sur une table vitrocéramique, laissée par un débordement cuit. Distincte d'une salissure : elle a pénétré le verre." },
  { g: "Électroménager", t: "bac à savon", d: "Le tiroir à lessive d'un lave-linge. S'encroûte quand il n'est pas rincé." },
  { g: "Électroménager", t: "joint de hublot", d: "Le caoutchouc de porte d'un lave-linge. Y voir moisissure, déchirure, corps étranger." },
  { g: "Électroménager", t: "filtre de hotte", d: "Grille métallique ou charbon. L'encrassement gras se photographie bien." },
  { g: "Électroménager", t: "joint de porte", d: "Réfrigérateur, four, lave-vaisselle. Décollement, déchirure, moisissure." },

  { g: "Électricité", t: "témoin lumineux", d: "La petite lampe d'un interrupteur ou d'un tableau. Se remplace." },
  { g: "Électricité", t: "fils apparents au point lumineux", d: "Une dizaine de centimètres doivent rester à chaque point lumineux. Coupés trop court, il faut retirer les fils des gaines. Vérifie-le quand un luminaire a été déposé." },
  { g: "Électricité", t: "soquet", d: "La douille d'ampoule." },

  { g: "Nicotine", t: "jaunissement homogène", d: "Coloration régulière d'un plafond ou d'une paroi. Se constate, sans dire qui a fumé." },
  { g: "Nicotine", t: "empoussièrement gras", d: "Dépôt collant sur les prises, interrupteurs, radiateurs et convecteurs. Signature d'une imprégnation." },
  { g: "Nicotine", t: "imprégnation des textiles", d: "Voilages, tentures et tapis. Ne se voit pas toujours : se sent." },

  { g: "Ventilation et humidité", t: "grille obstruée", d: "Grille d'aération bouchée, empoussiérée ou condamnée. Cause fréquente des moisissures d'angle." },
  { g: "Ventilation et humidité", t: "condensation", d: "Buée persistante, ruissellement sur un vitrage, cadre de châssis mouillé. Se décrit, sans conclure sur l'origine." },
  { g: "Ventilation et humidité", t: "moisissure d'angle", d: "Point noir dans un angle de mur ou de plafond, derrière un meuble. À localiser précisément." },
  { g: "Ventilation et humidité", t: "mérule", d: "Champignon du bois, filaments blancs puis plaques brunes. Grave. Se signale immédiatement, sans diagnostiquer." },
];
