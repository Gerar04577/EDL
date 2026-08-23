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
      "Vérifie sur l'accueil que le compte Microsoft est affiché en vert et que le " +
      "nombre de photos en attente est à zéro.",
      "Charge le téléphone. Une visite complète avec deux cents photos consomme " +
      "beaucoup de batterie.",
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
      "refuse de démarrer. Elle ne crée jamais de dossier : crée-le dans OneDrive, " +
      "puis reviens.",
  },
  {
    titre: "2. La composition du logement",
    corps: [
      "Coche les pièces présentes et le nombre de chambres et de salles de bain. " +
      "L'application prépare une fiche par pièce.",
      "Ces réglages sont mémorisés : à la prochaine visite de la même unité, ils " +
      "reviennent tout seuls.",
    ],
  },
  {
    titre: "3. L'identité du propriétaire",
    corps: [
      "Sur le récapitulatif, vérifie le bailleur. Il change selon l'immeuble :",
      "— Havré : SAMADHI S.A., représentée par Julien Gérard ;",
      "— Egmont : Julien Gérard ;",
      "— Nimy, Petite Guirlande, Vannes, La Fermette, Biche : Jean-Marc Gérard.",
      "Le nom retenu ici sera celui du document signé.",
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
    ],
    attention: "Après signature, le document ne peut plus être modifié. Une correction " +
      "exige de créer une nouvelle version, avec le bouton « Rectifier », et de faire " +
      "signer à nouveau.",
  },
  {
    titre: "Si le réseau manque",
    corps: [
      "Continue normalement. Les photos s'accumulent sur le téléphone et la barre du " +
      "haut indique combien attendent.",
      "Dès que le réseau revient, elles partent toutes seules. Tu peux fermer " +
      "l'application, éteindre le téléphone : rien ne se perd.",
      "La clôture reste bloquée tant qu'une photo n'est pas déposée — elle serait perdue.",
    ],
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
