/* EDL — Description assistée d'une photo

   L'application n'appelle jamais Gemini directement : la clé serait
   lisible par quiconque ouvre la page. Elle s'adresse à un scénario
   Make qui détient la clé et sert de relais.

   Deux contraintes de navigateur, apprises à nos dépens :

   1. Un envoi avec un contenu « application/json » déclenche une requête
      préalable OPTIONS que Make ne traite pas. On envoie donc les champs
      sous forme de formulaire : le navigateur s'en dispense alors.

   2. Pour que l'application puisse LIRE la réponse, le scénario doit
      renvoyer l'en-tête Access-Control-Allow-Origin. Sans lui, l'appel
      part, le scénario tourne, mais la réponse est refusée au navigateur.
      L'écran de réglages le vérifie explicitement.
*/

/* 45 s suffisaient pour une image. Un groupe de cinq oblige Make à
   télécharger cinq fichiers avant même d'appeler Gemini. */
var IA_DELAI_MS = 90000;

/* Version des consignes, transmise à chaque appel. Permet de savoir, six
   mois plus tard, quelle rédaction a produit un texte donné. À incrémenter
   dès qu'une consigne change. */
var IA_PROMPT_VERSION = "2026-08-28-v11";
var CLE_WEBHOOK_IA = "edl_webhook_ia";

/* L'adresse est conservée SUR L'APPAREIL. Le fichier de configuration
   ne sert que de valeur de repli : sans cela, il fallait redéposer un
   fichier sur GitHub à chaque changement de relais. */
function adresseRelais() {
  let locale = null;
  try { locale = localStorage.getItem(CLE_WEBHOOK_IA); } catch (_) {}
  const source = (locale && locale.trim())
    ? locale
    : ((CONFIG.ia && CONFIG.ia.webhook_ia) || "");
  return String(source).trim();
}

function enregistrerAdresseRelais(url) {
  try { localStorage.setItem(CLE_WEBHOOK_IA, String(url || "").trim()); return true; }
  catch (_) { return false; }
}

function iaDisponible() {
  return adresseRelais().length > 0;
}

/* Envoi en champs de formulaire : aucun en-tête personnalisé, aucun
   contenu JSON, donc aucune requête préalable. */
async function appelerRelaisIA(champs) {
  const cible = adresseRelais();
  if (!cible) throw new Error(
    "Aucune adresse de relais enregistrée. Accueil → « Description par IA ».");

  const corps = new URLSearchParams();
  Object.keys(champs).forEach(k => corps.append(k, String(champs[k] == null ? "" : champs[k])));

  const controleur = new AbortController();
  const minuterie = setTimeout(() => controleur.abort(), IA_DELAI_MS);

  let res;
  try {
    res = await fetch(cible, {
      method: "POST",
      body: corps,                  // le navigateur pose lui-même le bon type
      signal: controleur.signal,
    });
  } catch (e) {
    clearTimeout(minuterie);
    if (e.name === "AbortError")
      throw new Error("Le relais n'a pas répondu en " + (IA_DELAI_MS / 1000) + " secondes.");
    /* Un échec de fetch sans code d'erreur est presque toujours un refus
       du navigateur faute d'en-tête d'autorisation côté Make. */
    throw new Error("Réponse refusée par le navigateur. Vérifie que le module " +
      "« Webhook response » de Make renvoie l'en-tête Access-Control-Allow-Origin.");
  }
  clearTimeout(minuterie);

  const texte = await res.text();
  if (!res.ok) throw new Error("Relais : " + res.status + " — " + texte.slice(0, 200));
  return texte;
}

/* Consigne de rédaction. Volontairement stricte : on veut une description
   factuelle de ce qui est visible, pas un jugement sur l'usure ou la
   responsabilité — ces appréciations n'appartiennent qu'au bailleur. */
/* Une seule ligne, sans retour chariot : insérée telle quelle dans le
   corps JSON du scénario Make, un saut de ligne brut rendrait le JSON
   invalide — « Bad control character in string literal ». Idem pour les
   guillemets, retirés par précaution. */
function consigneDescription(piece, type, niveau) {
  return morceauxConsigne(piece, type, niveau)
    .join(" ")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/["\\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* Consigne bâtie sur des procès-verbaux réels d'experts assermentés belges
   (Bureau Nicolaï, Wavre, et Metric sprl, Bruxelles), ainsi que sur le
   modèle-type wallon du 28 juin 2018. Le vocabulaire, l'échelle
   d'amortissement et les tournures viennent de ces documents. */
/* PIÈCES D'EAU. Le bloc sanitaire ne s'ajoute que là où il sert : sur un
   séjour ou un couloir, il coûterait deux cents tokens pour rien.

   Détection sur le LIBELLÉ de la pièce, tel que l'utilisateur l'a saisi.
   Volontairement large : mieux vaut l'ajouter à tort dans une buanderie
   que l'oublier dans une salle de douche. Les accents sont retirés avant
   comparaison — « salle de bains » et « Salle de Bain » doivent tomber
   dans le même filet. */
function estPieceDEau(piece) {
  const n = String(piece || "").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return /salle de bain|salle d.eau|salle de douche|sdb|\bwc\b|toilette|douche|bain|sanitaire|lavabo|buanderie|cuisine/.test(n);
}

/* Constat de propreté des sanitaires.

   RÈGLE DE FOND : on décrit, on ne juge pas. « WC entretenu » ou « sale »
   sont des appréciations qu'un locataire conteste et qu'un juge écarte.
   « Entartrage brunâtre sous le rebord » est un fait qui se vérifie sur
   la photographie.

   À l'entrée, un rappel court suffit : on fixe l'état initial.
   À la sortie, le détail complet : c'est là que se décide la retenue, et
   la distinction nettoyable / incrusté en est le coeur. */
function morceauxSanitaires(sortie) {
  if (!sortie) {
    return [
      "SANITAIRES — PROPRETÉ. Constate l'état de propreté visible, sans le juger. " +
        "N'écris JAMAIS entretenu, propre, sale, négligé, correct : ce sont des " +
        "appréciations. Décris le fait : entartrage, voile calcaire, cerne, dépôt, " +
        "coulure, joint grisonnant, résidu savonneux.",

      "À REGARDER dans une pièce d'eau : intérieur de la cuvette et dessous du " +
        "rebord, niveau d'eau, pied et arrière du WC, lunette et abattant, chasse " +
        "d'eau et son bouton, robinetterie, bonde et joints silicone, paroi de " +
        "douche, joints de faïence, grille de ventilation.",

      "AMPLEUR, comme pour tout défaut : entartrage sur le tiers inférieur de la " +
        "cuve, cerne continu au niveau d'eau, joint noirci sur une quinzaine de " +
        "centimètres.",
    ];
  }
  return [
    "SANITAIRES — PROPRETÉ, POINT DÉCISIF À LA SORTIE. La propreté des sanitaires " +
      "est un poste de retenue fréquent. Constate-la précisément, sans jamais la " +
      "juger : n'écris pas entretenu, propre, sale, négligé, correct. Ces mots sont " +
      "des appréciations qu'un locataire conteste. Décris le fait observable.",

    "CUVETTE DE WC. Intérieur de la cuve : entartrage, cerne au niveau d'eau, " +
      "coloration brunâtre ou orangée, dépôt sous le rebord et sous la lunette, " +
      "salissure organique. Extérieur : pied, arrière de la cuve, fixations au sol " +
      "— ce sont les zones où la salissure s'accumule et qu'on néglige. Lunette et " +
      "abattant : propreté, charnières, fêlure, jeu.",

    "CHASSE D'EAU. Réservoir, bouton ou tirette, dessus du réservoir, coulure " +
      "calcaire, trace d'écoulement le long de la cuve, condensation ou auréole.",

    "LAVABO ET ÉVIER. Calcaire sur la robinetterie et autour de la bonde, cerne " +
      "dans la vasque, joint silicone grisonnant ou décollé, trop-plein.",

    "DOUCHE ET BAIGNOIRE. Calcaire sur la paroi et la robinetterie, joint silicone " +
      "noirci ou moisi, joints de faïence grisonnants, résidu savonneux, siphon.",

    "ROBINETTERIE CHROMÉE. Voile calcaire, ternissement, oxydation, piqûre du " +
      "chromage. VENTILATION : grille empoussiérée ou encrassée.",

    /* Second registre, distinct de la propreté : une salissure se nettoie,
       une atteinte au matériau ne se répare pas. C'est elle qui justifie
       une retenue. Absente des consignes jusqu'ici. */
    "ATTEINTES AU MATÉRIAU — À NE PAS CONFONDRE AVEC LA SALETÉ. Cherche aussi : " +
      "éclat, écornure, fêlure, percussion ou griffure sur émail, faïence, porcelaine " +
      "ou résine ; altération du brillant de l'émail ; mousseur ou brise-jet entartré ; " +
      "flexible de douche ; joint souple périphérique de baignoire ou de bac ; manchon " +
      "de raccord derrière la cuvette ; inverseur bain-douche ; trace laissée par un " +
      "adhésif antidérapant retiré. Une salissure se nettoie, une atteinte au matériau " +
      "reste.",

    "NETTOYABLE OU INCRUSTÉ — C'EST CETTE DISTINCTION QUI DÉCIDE. Pour chaque " +
      "salissure, dis si elle paraît superficielle et d'allure nettoyable, ou " +
      "incrustée dans le matériau. Un cerne qui part au produit n'est pas un dégât ; " +
      "un émail piqué par le calcaire en est un. Si tu ne peux pas trancher sur la " +
      "photographie, écris-le.",

    "AMPLEUR OBLIGATOIRE : entartrage sur le tiers inférieur de la cuve, cerne " +
      "continu au niveau d'eau, joint noirci sur une quinzaine de centimètres, " +
      "voile calcaire sur toute la paroi.",

    "EXEMPLE. Cuvette en porcelaine blanche. Entartrage brunâtre sous le rebord sur " +
      "tout le pourtour et cerne continu au niveau d'eau, d'allure incrustée. " +
      "Salissure grisâtre au pied et à l'arrière de la cuve, superficielle. Abattant " +
      "blanc, charnières intactes. Réservoir sans coulure.",
  ];
}

function morceauxConsigne(piece, type, niveau) {
  const sortie = (type === "EDLS");
  /* À la sortie, toujours le niveau détaillé : c'est là que se joue la
     comparaison, et c'est ce document qui servira devant le juge de paix. */
  if (!sortie && niveau === "sobre") return morceauxSobre(piece);
  const eau = estPieceDEau(piece);
  return [
    /* AUCUNE PERSONA D'EXPERT ASSERMENTÉ. Deux raisons. Le bailleur n'est pas
       géomètre-expert : un procès-verbal signé ne doit pas le laisser croire.
       Et la documentation de Gemini est explicite — le modèle prend sa
       persona au sérieux et ignore parfois des instructions pour la
       préserver. C'est ce qui rendait les demandes de style inopérantes. */
    "Tu rédiges le constat d'un état des lieux " +
      (sortie ? "de sortie" : "d'entrée") + " en Région wallonne, " +
      "à partir d'une photographie. Tu décris ce que montre cette photographie.",
    "Pièce concernée : " + (piece || "non précisée") + ".",

    /* L'enjeu diffère radicalement selon le moment, et le dire au modèle
       change ce sur quoi il porte son effort.
       À l'entrée, on fixe un point zéro : tout compte également.
       À la sortie, le document servira devant le juge de paix à établir
       des dégâts locatifs : la précision doit aller aux désordres, pas au
       décor déjà décrit à l'entrée. */
    sortie
      ? "ENJEU DE SORTIE — CE DOCUMENT PEUT SERVIR EN JUSTICE. Le procès-verbal de " +
        "sortie établit les dégâts locatifs. Consacre l'essentiel de ton texte aux " +
        "DÉSORDRES : pour chacun, l'élément atteint, son matériau, la nature exacte, " +
        "la localisation précise, l'ampleur chiffrée, le nombre quand il se compte, " +
        "et le caractère superficiel, nettoyable ou marqué dans le matériau. Un " +
        "désordre décrit trop vaguement ne pourra pas être retenu."
      : "ENJEU D'ENTRÉE — FIXER L'ÉTAT INITIAL. Ce constat servira de point de " +
        "comparaison à la sortie. Décris l'élément, son matériau, sa finition et son " +
        "état avec la même attention, qu'il présente un défaut ou non. Une " +
        "affirmation d'intégrité ciblée — vitrage intact, faïence sans éclat ni " +
        "fissure — vaut autant qu'un défaut consigné.",

    sortie
      ? "CE QUI EST INTACT À LA SORTIE. Mentionne-le brièvement, sans développer le " +
        "matériau ni la finition : l'entrée l'a déjà fait. Une formule courte suffit " +
        "— faïence intacte, vitrage sans fêlure. Garde ta précision pour ce qui est " +
        "atteint."
      : "CE QUI EST INTACT À L'ENTRÉE. Développe-le : matériau, finition, teinte, " +
        "état. C'est ce développement qui permettra, à la sortie, de démontrer qu'un " +
        "élément a changé.",

    sortie
      ? "DÉPÔT NICOTINIQUE. S'il est visible, décris-le comme une observation, jamais " +
        "comme une imputation : jaunissement homogène du plafond ou des parois, " +
        "empoussièrement gras sur les convecteurs, les prises et les interrupteurs, " +
        "coloration des voilages. N'écris jamais que quelqu'un a fumé."
      : "",

    sortie
      ? "AUCUN EUPHÉMISME À LA SORTIE. N'écris jamais un peu, quelques traces, " +
        "légèrement, correct, acceptable, sans gravité. Ces atténuations affaiblissent " +
        "le constat. Décris exactement ce que tu vois, sans adoucir ni exagérer."
      : "PAS D'EXAGÉRATION À L'ENTRÉE. Un défaut mineur se décrit comme mineur. " +
        "Grossir l'état initial nuirait au bailleur : le locataire pourrait rendre le " +
        "bien dans un état inférieur sans que cela se voie.",

    "RÈGLE PREMIÈRE — NE DÉCRIS QUE CETTE PHOTOGRAPHIE. Ne mentionne aucun élément " +
      "que tu ne vois pas réellement. Un séjour comporte d'ordinaire un radiateur, " +
      "des prises et des plinthes : cela ne t'autorise pas à les décrire s'ils ne sont " +
      "pas dans le cadre. Ne complète jamais par ce qu'une pièce de ce type contient " +
      "habituellement. Chaque mot doit correspondre à quelque chose de visible.",

    "STYLE. Phrases courtes, souvent nominales, sans verbe conjugué quand c'est " +
      "possible. Aucun remplissage. Deux à trois phrases. Tournures d'expert : " +
      "Relevons, Notons, Sous-jacent, En prolongement, Retour mural, Pour mémoire. " +
      "Jamais je, ni on, ni la photographie montre.",

    "ORDRE. De haut en bas : plafond, puis murs et pente de toiture, puis sol. " +
      "Pour les murs, sens horlogique en partant du mur de référence.",

    "REPÈRES. Gauche et droite s'entendent depuis la position de l'observateur face " +
      "à l'objet décrit. Autres repères : en pied, à mi-hauteur, en tête, en partie " +
      "haute, en partie basse, dans l'angle, au droit de, en prolongement, sous-jacent.",

    "ÉCHELLE D'AMORTISSEMENT. Emploie exclusivement ces six termes pour l'état " +
      "général d'un décor ou d'un matériau : neuf, récent, terne, défraîchi, usagé, " +
      "amorti. C'est la terminologie des experts belges.",

    "ÉTAT PONCTUEL. Pour dire qu'un élément ne présente pas de défaut, l'affirmation " +
      "doit PORTER SUR CET ÉLÉMENT et sur ce qu'il ne présente pas : faïence sans " +
      "éclat ni fissure, double vitrage intact, parquet sans dégradation, joints " +
      "propres, plinthes jointives. Ce sont des constats vérifiables.",

    "FORMULES CREUSES INTERDITES. N'écris JAMAIS : sans remarque particulière, sans " +
      "remarque, pas de remarque, rien à signaler, RAS, conforme, de belle facture, " +
      "de bonne facture, correctement mis en oeuvre, en bon état général, aucune " +
      "observation. Elles ne décrivent rien et n'ont aucune valeur au constat. " +
      "Le mot conforme est banni : conforme à quoi ?",

    /* Deux familles vues à l'essai du 26/08/2026 et qu'il fallait nommer :
       l'appréciation d'âge — que rien sur une photographie ne fonde — et
       l'appréciation d'état sans point de comparaison. */
    "APPRÉCIATIONS D'ÂGE INTERDITES. N'écris JAMAIS : récent, d'aspect récent, décor " +
      "récent, ancien, d'origine, refait récemment, remis à neuf, dernier décor. Une " +
      "photographie ne dit pas l'âge d'une peinture. Décris ce que tu vois : peinture " +
      "sans écaillage ni reprise apparente, ou au contraire raccord de teinte visible.",

    "APPRÉCIATIONS SANS POINT DE COMPARAISON INTERDITES. N'écris pas décor terne, " +
      "décor fatigué, décor défraîchi sans dire ce qui le montre. Terne par rapport à " +
      "quoi ? Si tu constates un affaiblissement, dis ce qui se voit : perte de " +
      "brillant du feuil, teinte inégale entre deux pans, empoussièrement du feuil.",

    "VOCABULAIRE DES DÉFAUTS. Emploie le terme exact. Enduit et plafonnage : " +
      "fendille, fissuration naissante, évidement, écrasement, éclat, écaillement, " +
      "effritement, pelade, boursouflure, décollement, point de rebouche, hors plomb, " +
      "défaut de plafonnage. Peinture : jaspure, débordement, retouche visible, " +
      "irrégularité de mise en peinture, décoloration, voile grisâtre, ombrage, " +
      "frottement, encrassement, couche peu couvrante. Bois et menuiserie : griffe, " +
      "éraflure, impact, poinçon de clou, trou de clou, disjoint, desserrage, jeu, " +
      "gonflement. Carrelage et pierre : éclat, fêlure, joint pulvérulent, joint " +
      "grisonnant, arête épaufrée. Vitrage : fêlé, rayé, buée entre vitrages. " +
      "Sanitaire : joint grisonnant, entartrage, dépôt calcaire, chaînette rompue.",

    "NOMENCLATURE DU BÂTI. Nomme correctement : ébrasement, chambranle, listel, " +
      "trumeau, besquaire, limon, pilastre, main courante, fuseau, plinthe, cornière, " +
      "crédence, tablette de fenêtre, appui, seuil, oculus, petit-bois, croisillon, " +
      "portillon, clayette, coiffe d'éclairage, soquet, buse d'extraction, patère, " +
      "arrêt de porte, quincaillerie, rosace, vanne thermostatique.",

    "MATÉRIAUX. Grès cérame, faïence, pierre bleue polie, travertin, mélaminé, " +
      "stratifié, acrylique, émail, thermolaqué, inox brossé, chromé, PVC, sapin " +
      "traité, chêne massif, bois recomposé, chape lissée. Précise la finition : " +
      "mat, satiné, poli, brossé, chanfreiné, sablé, dépoli.",

    "DÉNOMBREMENT PRUDENT. Compte exactement jusqu'à quatre occurrences distinctes et " +
      "nettement séparées : deux poinçons, trois griffes. Au-delà, ou si elles se " +
      "chevauchent, écris plusieurs ou une série et donne l'étendue de la zone. " +
      "Un compte faux est plus dommageable qu'un compte absent.",

    /* Six points qui se voient sur une photographie et qu'on oublie de
       regarder. Tirés de la liste wallonne des réparations locatives —
       dont on ne retient QUE les points de contrôle, jamais la répartition
       des charges : qualifier qui paie n'appartient pas au constat. */
    "POINTS SOUVENT OUBLIÉS, s'ils sont dans le cadre : canaux d'évacuation des eaux " +
      "de condensation en bas des châssis et chambre de décompression ; " +
      "poinçonnement du sol par les pieds de meubles et traces de talons ; " +
      "déchaussement des fuseaux ou balustres et descellement d'une main-courante ; " +
      "oxydation du tain d'un miroir ; griffures et cristallisations sur une table de " +
      "cuisson vitrocéramique ; grille de ventilation obstruée ou encrassée.",

    "MESURE OBLIGATOIRE. TOUT défaut consigné porte son ampleur, sans exception. " +
      "Sans ampleur, il ne pourra pas servir de point de comparaison lors de l'état " +
      "des lieux de sortie, et le constat perd sa raison d'être.",

    "COMMENT MESURER. Ordre de grandeur seulement, jamais une mesure précise : " +
      "millimétrique, centimétrique, sur 3 à 4 cm, environ 2 cm, sur une dizaine de " +
      "centimètres, sur 1 m². Pour les surfaces, emploie cm², dm² ou m². Écris " +
      "toujours environ ou de l'ordre de : les longueurs sont estimées, non mesurées.",

    "FISSURES. Ne chiffre l'ouverture qu'au-delà d'un demi-millimètre. En deçà : " +
      "fendille, fissure filiforme, fissure d'ouverture capillaire, faïençage. " +
      "Précise l'allure : horizontale, verticale, oblique, en escalier, sinueuse, " +
      "intermittente, se ramifiant. Un décalage au niveau des lèvres se signale " +
      "comme tel, sans en tirer de conclusion.",

    "LAVABLE OU NON. Distinction capitale : une trace d'allure lavable ou nettoyable " +
      "n'engage pas les mêmes suites qu'une atteinte au matériau. Écris d'allure " +
      "lavable, nettoyable, superficiel, ou au contraire marqué dans le matériau. " +
      "C'est ce qui sépare un nettoyage d'une réparation.",

    "POUR MÉMOIRE. Quand un élément mérite d'être consigné sans être imputé à " +
      "quiconque — un disjoint constructif, une fissuration naissante, une " +
      "irrégularité de mise en oeuvre — termine par : pour mémoire. C'est la " +
      "formule des experts pour noter sans accuser.",

    sortie
      ? "ENJEU DE SORTIE. Décris l'état constaté ce jour, précisément et sans le " +
        "comparer à quoi que ce soit : tu ne disposes pas de l'état des lieux " +
        "d'entrée. Le rapprochement sera fait ensuite, par les parties."
      : "ENJEU D'ENTRÉE. Ce qui n'est pas décrit à l'entrée est réputé intact et en " +
        "bon état — modèle-type wallon, remarque préalable 2. Un défaut omis " +
        "aujourd'hui ne pourra jamais être invoqué. Sois donc exhaustif : signale même " +
        "ce qui paraît anodin, une fendille, un trou de clou, un léger voile.",

    "CE QU'UNE PHOTOGRAPHIE NE PERMET PAS. N'affirme JAMAIS qu'un appareil fonctionne " +
      "ou non : les experts ne testent qu'à l'enclenchement. N'affirme JAMAIS qu'un " +
      "élément manque : tu ignores ce qui devrait s'y trouver ; décris ce qui est " +
      "visible, une tringle sans tenture, un support sans luminaire. N'affirme JAMAIS " +
      "l'origine d'une humidité — ni condensation, ni remontée capillaire, ni " +
      "infiltration : cela exige des mesures. Aucune investigation n'est faite sous " +
      "les décors, ni dans les canalisations, ni dans l'ossature.",

    /* Deux interdits ne cèdent jamais, à l'entrée comme à la sortie :
       l'usure normale — l'écrire soi-même revient à renoncer à toute
       retenue — et l'imputation, qui relève des parties et du juge.
       Le chiffrage reste exclu de la description : il se fait à l'écran de
       comparaison, séparément.
       En revanche, à la sortie, la date d'apparition, l'origine d'une
       humidité et l'état de fonctionnement d'un appareil deviennent
       admissibles quand ils sont VISIBLES : le procès-verbal de sortie
       sert à établir les dégâts locatifs devant le juge de paix, et
       s'interdire ces mentions l'appauvrissait. */
    sortie
      ? "INTERDITS ABSOLUS. N'écris JAMAIS que l'état relève de l'usure normale ou " +
        "de la vétusté : cette qualification appartient au juge de paix. N'impute " +
        "JAMAIS un défaut au locataire, au bailleur ou à un tiers : tu constates, tu " +
        "n'attribues pas. N'évalue JAMAIS un coût ni une réparation, le chiffrage se " +
        "faisant ailleurs."
      : "INTERDITS ABSOLUS. N'écris JAMAIS que l'état relève de l'usure normale ou de " +
        "la vétusté. N'impute JAMAIS un défaut au locataire, au bailleur ou à un " +
        "tiers. N'évalue JAMAIS un coût ni une réparation. N'indique JAMAIS depuis " +
        "quand un défaut existe. Ces appréciations appartiennent aux parties et au " +
        "juge de paix, pas au constat.",

    sortie
      ? "CE QUE TU PEUX DIRE À LA SORTIE, si et seulement si c'est VISIBLE sur la " +
        "photographie. L'ancienneté apparente d'un désordre : bord de fissure encrassé " +
        "ou net, coulure sèche ou fraîche, poussière déposée dans un impact. L'origine " +
        "d'une humidité quand elle se voit : auréole partant d'un joint de châssis, " +
        "cloque sous une fuite apparente. L'état d'un appareil quand il est manifeste : " +
        "vitrocéramique fêlée, poignée arrachée, détecteur pendant. Formule toujours ce " +
        "que tu observes, jamais ce que tu supposes : bord de fissure encrassé, et non " +
        "fissure ancienne." +
        " OBSERVER N'EST PAS CONCLURE. Un luminaire allumé sur la photographie se " +
        "décrit : allumé au moment de la prise de vue. N'écris pas qu'il est " +
        "fonctionnel — tu n'as actionné aucun interrupteur, et une affirmation de " +
        "fonctionnement démentie plus tard fragilise tout le document. De même : " +
        "voyant éteint, et non appareil hors service ; robinet fermé, et non robinet " +
        "étanche."
      : "TU NE JUGES PAS DE L'ÂGE. À l'entrée, n'indique jamais depuis quand un défaut " +
        "existe, ni d'où vient une humidité, ni si un appareil fonctionne. Tu fixes " +
        "l'état initial, tu ne l'interprètes pas.",

    "TU PEUX NE PAS SAVOIR. Écrire non déterminable sur la photographie est une " +
      "réponse correcte et attendue. Elle vaut mieux qu'une description plausible mais " +
      "inexacte : le constat sera relu par le locataire et pourra être discuté devant " +
      "le juge de paix.",

    "INCERTITUDE. Si un élément est sombre, flou ou masqué, écris-le. Les teintes " +
      "sont faussées par l'éclairage artificiel : préfère une teinte claire, un ton " +
      "chêne, plutôt qu'une couleur précise.",

    "SI RIEN N'EST À SIGNALER. N'ajoute AUCUNE formule de clôture. Nomme l'élément, " +
      "son matériau, sa finition, et arrête-toi là — ou bien affirme précisément ce " +
      "qu'il ne présente pas. Une description qui s'achève sur le matériau est " +
      "complète : le silence sur un défaut vaut absence de défaut.",

    "CONTRE-EXEMPLES. Voici ce qu'il ne faut pas écrire, suivi de ce qu'il faut écrire.",
    "À ÉVITER : Mur blanc avec quelques traces noires et un trou près de la fenêtre. " +
      "À ÉCRIRE : Plafonnage peint blanc. Deux poinçons de clou sous l'ébrasement " +
      "gauche du châssis et frottements grisâtres superficiels d'allure lavable à " +
      "mi-hauteur.",
    "À ÉVITER : Le bas de la douche est un peu abîmé et sale. À ÉCRIRE : Faïence " +
      "murale et bac de douche. Joint d'étanchéité périphérique grisonnant avec amorce " +
      "de décollement dans l'angle droit. Faïence sans éclat ni fissure.",
    "À ÉVITER : Le sol présente des traces d'usure normale pour un logement de cet âge. " +
      "À ÉCRIRE : Parquet stratifié ton chêne. Griffes superficielles sur une trentaine " +
      "de centimètres en zone centrale.",
    "Retiens de ces trois cas : jamais abîmé, sale, quelques, un peu, des traces. " +
      "Toujours l'élément, son matériau, le défaut nommé, sa localisation, son étendue.",

    /* Bloc sanitaire, uniquement dans les pièces d'eau. Placé avant les
       exemples, donc tard dans la consigne : Gemini pondère davantage ce
       qui vient en fin de prompt. */
    ...(eau ? morceauxSanitaires(sortie) : []),

    /* STRUCTURE OBLIGATOIRE.

       Sans elle, le modèle énumère les éléments dans l'ordre où il les
       aperçoit : plafond, sol, foyer, mur, étagères. Sur un groupe de
       photographies, le résultat est un mélange où l'on ne sait plus de
       quel mur on parle — et un constat qui ne situe pas ses observations
       ne tient pas devant un juge de paix.

       Les intitulés sont en majuscules suivies d'un tiret : le procès-
       verbal les imprime tels quels, sans mise en forme particulière. */
    "STRUCTURE OBLIGATOIRE DU CONSTAT. Organise ton texte en rubriques, dans CET " +
      "ordre exact, du haut vers le bas : PLAFOND, RETOMBÉES ET JOUES, les MURS, " +
      "PORTES, CHÂSSIS, ESCALIER, SOLS, ÉLECTRICITÉ, ÉQUIPEMENTS FIXES, APPAREILS. " +
      "Chaque rubrique commence par son intitulé en majuscules suivi d'un tiret, puis " +
      "le constat. N'écris QUE les rubriques dont un élément est visible : une " +
      "rubrique sans objet ne s'écrit pas.",

    /* Regrouper l'appareillage électrique évite qu'il se disperse entre
       les rubriques de mur et les équipements fixes — où il apparaissait
       deux fois. Rassemblé, il se compare aussi bien plus facilement à la
       sortie. */
    "ÉLECTRICITÉ — RUBRIQUE À PART. Prises de courant, interrupteurs, variateurs, " +
      "boîtiers, plaques de finition, points lumineux et plafonniers vont TOUS dans " +
      "cette rubrique, jamais dans les rubriques de mur ni dans les équipements " +
      "fixes. Situe chacun : au droit du chambranle, sous les châssis, en partie " +
      "basse. Décris la plaque, sa matière, sa teinte, son état.",

    /* Trois rubriques distinctes, jamais une seule MENUISERIES. Une porte,
       un châssis et un escalier ne se dégradent pas de la même façon et ne
       se comparent pas ensemble à la sortie. */
    "NE FONDS JAMAIS PORTES, CHÂSSIS ET ESCALIER EN UNE SEULE RUBRIQUE. PORTES : " +
      "vantail, chambranle, paumelles, poignée, serrure, chants. CHÂSSIS : dormant, " +
      "ouvrant, vitrage, quincaillerie, canaux d'évacuation de condensation. " +
      "ESCALIER : limon, marches, contre-marches, nez de marche, garde-corps, " +
      "balustres, main courante, ancrages. Chacun sa rubrique.",

    "NOMMER CHAQUE MUR — LE POINT DÉCISIF. Un constat qui dit seulement les murs ne " +
      "situe rien et ne vaut rien en cas de litige. Désigne chaque mur par CE QU'IL " +
      "PORTE : MUR DE LA FENÊTRE, MUR DE LA PORTE, MUR DU FOYER, MUR DE LA " +
      "BIBLIOTHÈQUE, MUR DU RADIATEUR, MUR DU LAVABO, MUR DE LA CUISINIÈRE.",

    "SI RIEN NE DISTINGUE UN MUR, écris MUR SANS ÉLÉMENT DISTINCTIF. N'invente " +
      "JAMAIS une orientation — ni nord, ni sud, ni est, ni ouest : tu ne peux pas la " +
      "connaître, et une orientation fausse dans un document signé se retourne contre " +
      "celui qui l'a écrite. N'écris pas non plus mur de gauche ou mur de droite : " +
      "gauche par rapport à quoi ?",

    "PLUSIEURS MURS. Si les photographies montrent des murs différents, fais une " +
      "rubrique par mur. Ne les fonds jamais en une seule.",

    "SI L'EXPERT A NOMMÉ LES MURS dans ses consignes, emploie SES désignations plutôt " +
      "que les tiennes : il était sur place, pas toi.",

    "EXEMPLE COMPLET DE STRUCTURE, sur trois photographies d'un salon. " +
      "PLAFOND — Plafonnage peint blanc mat, à raccords nets, sans fissure ni auréole. " +
      "RETOMBÉE DU LINTEAU — Peinte beige taupe mat. Reprise de peinture apparente en " +
      "partie haute sur une trentaine de centimètres, laissant transparaître un fond " +
      "plus clair. " +
      "MUR DU POÊLE — Plafonnage peint beige taupe mat. Niche d'encastrement de même " +
      "teinte, arêtes vives, sans épaufrure. Plinthe blanche en pied de niche. " +
      "MUR DE LA PORTE — Plafonnage peint beige taupe mat, homogène, sans éclat. " +
      "MUR DE LA BIBLIOTHÈQUE — Plafonnage peint beige taupe mat. Bibliothèque " +
      "encastrée toute hauteur, onze tablettes fixes teintées gris anthracite, sans " +
      "dégradation. " +
      "PORTES — Porte intérieure en bois peint blanc à panneau central creusé peint " +
      "ton mur, chambranle et cadre blancs. Trois paumelles en laiton doré. Poignée et " +
      "rosace de cylindre chromées. Chants sans épaufrure. " +
      "SOLS — Carrelage de terre cuite ton ocre à joints ciment, posé en diagonale, " +
      "carreaux sans éclat ni fissure. Sur l'emprise du foyer, pierre naturelle polie " +
      "à veinage gris et rosé, joints fins, sans écornure. " +
      "ÉLECTRICITÉ — Interrupteur double à plaque synthétique blanche à droite du " +
      "chambranle. Prise double de même appareillage en pied du mur de la " +
      "bibliothèque. Plaques sans fêlure ni jaunissement. " +
      "ÉQUIPEMENTS FIXES — Socle de foyer habillé de pierre naturelle polie, en deux " +
      "niveaux, arêtes intactes. Plaque de sol métallique noire, plane. " +
      "APPAREILS — Poêle à pellets cylindrique, corps thermolaqué noir, habillages " +
      "supérieur et inférieur en céramique blanche, porte vitrée intacte. Buse noire à " +
      "double coude et conduit vertical en place.",

    "CE QUE MONTRE CHAQUE PHOTOGRAPHIE. Termine par une ligne commençant par " +
      "PHOTOGRAPHIES suivie, pour chacune et dans l'ordre où elles te sont données, " +
      "de ce qu'elle montre, séparées par un point-virgule. Exemple : PHOTOGRAPHIES — " +
      "mur du poêle, niche et appareil ; mur de la bibliothèque ; mur de la porte et " +
      "menuiserie. Cette ligne rattache chaque cliché à un élément nommé, ce " +
      "qu'exige la jurisprudence.",

    "EXEMPLE 1. Mur à droite sous peinture blanche mate. Deux poinçons de clou " +
      "à mi-hauteur et une trace de frottement d'allure lavable sur environ 2 dm². " +
      "Fendille longeant l'angle du plafond, pour mémoire.",

    "EXEMPLE 2. Sol constitué d'un parquet stratifié imitation chêne rustique avec " +
      "plinthes périphériques assorties. Griffes superficielles sur une trentaine de " +
      "centimètres en zone centrale. Léger disjoint entre sol et pied de plinthe.",

    "EXEMPLE 3. Châssis de fenêtre en aluminium thermolaqué anthracite, double " +
      "vitrage intact. Départ d'écaillement d'enduit sur 3 à 4 cm au niveau de " +
      "l'ébrasement. Tablette en pierre bleue polie à arête chanfreinée, marquée " +
      "d'une rayure légère.",

    "EXEMPLE 4. Plafonnage peint blanc, coiffe d'éclairage circulaire. Évidement de " +
      "plafonnage d'environ 4 cm² à droite du châssis. Fissurations constructives " +
      "naissantes dans les angles, pour mémoire.",

    "EXEMPLE 5. Faïence murale blanc mat, sans éclat ni fissure. Joints " +
      "grisonnants en pied de bac de douche. Robinetterie chromée, sans trace de " +
      "calcaire.",

    "CONTRE-EXEMPLE DE CLÔTURE. NE PAS écrire : Châssis en PVC blanc, double vitrage " +
      "intact. Sans remarque particulière. La dernière phrase n'apporte rien et " +
      "contredit la précédente, qui disait déjà l'essentiel. ÉCRIRE : Châssis en PVC " +
      "blanc, double vitrage intact.",
  ];
}

/* Consigne sobre, entrée seulement. Même ossature — anti-invention,
   vocabulaire, interdits — mais un seuil bien plus haut : on ne retient
   que ce qu'un locataire remarquerait en entrant dans la pièce.

   Choix assumé du bailleur, réaffirmé le 26/08/2026 après discussion. Le
   bouton « Décrire en détail » reste disponible à l'entrée pour les pièces
   où l'exhaustivité est souhaitée. */
function morceauxSobre(piece) {
  const eau = estPieceDEau(piece);
  return [
    "Tu rédiges le constat d'un état des lieux d'entrée en Région wallonne, " +
      "à partir d'une photographie. Tu décris ce que montre cette photographie.",
    "Pièce concernée : " + (piece || "non précisée") + ".",

    "RÈGLE PREMIÈRE — NE DÉCRIS QUE CETTE PHOTOGRAPHIE. Ne mentionne aucun élément " +
      "que tu ne vois pas réellement. Ne complète jamais par ce qu'une pièce de ce " +
      "type contient habituellement.",

    "SEUIL — LE POINT ESSENTIEL. Ne retiens QUE ce qu'une personne remarquerait en " +
      "entrant dans la pièce sans chercher. Un défaut qu'il faut approcher pour voir " +
      "ne se signale PAS.",

    "À NE PAS SIGNALER, en aucun cas : fendille, microfissure, faïençage, poinçon ou " +
      "trou de clou, point de rebouche, jaspure, voile grisâtre, ombrage, trace de " +
      "frottement, griffe ou rayure superficielle, éraflure, joint légèrement " +
      "grisonnant, léger défraîchissement, arête légèrement épaufrée, petite " +
      "irrégularité de mise en peinture. Ces éléments existent : on ne les consigne " +
      "simplement pas à ce niveau de constat.",

    "À SIGNALER : impact ou enfoncement marqué, fissure ouverte au-delà d'un " +
      "millimètre, lézarde, écaillement ou pelade sur plus d'un décimètre carré, " +
      "décollement, trou non rebouché, tache franche, moisissure visible, auréole " +
      "d'humidité étendue, élément cassé, fêlé, descellé ou hors service à l'oeil nu.",

    "MESURE. Tout défaut retenu porte son ampleur : environ 5 cm, sur 2 dm², sur une " +
      "trentaine de centimètres. Sans ampleur, le défaut ne pourra pas servir de " +
      "point de comparaison à la sortie.",

    "CE QUI EST INTACT. Quand un élément important ne présente aucun défaut retenu, " +
      "dis-le explicitement : faïence sans éclat ni fissure, vitrage intact, parquet " +
      "sans dégradation. Cette affirmation compte autant que le reste.",

    "RÉDACTION. Une à deux phrases, courtes, souvent nominales. Nomme l'élément et " +
      "son matériau, puis le défaut retenu s'il y en a un. Jamais je ni on. Pas de " +
      "titre, pas de liste.",

    /* Même en mode bref, un mur doit être situé : sans repère, le constat
       ne vaut rien en cas de litige. La structure complète serait
       disproportionnée pour deux phrases, mais le repère est essentiel. */
    "SITUER LE MUR. Si tu décris un mur, désigne-le par CE QU'IL PORTE : mur de la " +
      "fenêtre, mur de la porte, mur du foyer, mur du radiateur. Si rien ne le " +
      "distingue, écris mur sans élément distinctif. N'invente JAMAIS une orientation " +
      "— ni nord, ni sud — et n'écris pas mur de gauche : gauche par rapport à quoi ?",

    "SI RIEN NE DÉPASSE LE SEUIL. Nomme l'élément, son matériau et sa finition, et " +
      "arrête-toi là. N'ajoute AUCUNE formule de clôture : ni sans remarque " +
      "particulière, ni rien à signaler, ni RAS, ni conforme, ni en bon état. C'est " +
      "le cas le plus fréquent, et une phrase qui nomme l'élément suffit.",

    "INTERDITS. N'écris JAMAIS que l'état relève de l'usure normale ou de la vétusté. " +
      "N'impute JAMAIS un défaut à quiconque. N'évalue JAMAIS un coût. N'affirme " +
      "JAMAIS qu'un appareil fonctionne, qu'un élément manque, ou l'origine d'une " +
      "humidité.",

    /* Même dans le mode bref, une pièce d'eau reçoit le rappel court :
       le calcaire et les cernes dépassent le seuil de ce mode. */
    ...(eau ? morceauxSanitaires(false) : []),

    "EXEMPLE 1. Mur sous peinture blanche mate.",
    "EXEMPLE 2. Parquet stratifié ton chêne. Impact de 3 cm environ en zone centrale.",
    "EXEMPLE 3. Faïence murale blanche sans éclat ni fissure. Bac de douche intact.",
    "EXEMPLE 4. Châssis en PVC blanc, double vitrage intact.",
    "CONTRE-EXEMPLE DE SEUIL. NE PAS écrire : deux poinçons de clou à mi-hauteur et " +
      "léger voile grisâtre. Ces éléments sont sous le seuil. ÉCRIRE : Mur sous " +
      "peinture blanche mate.",
    "CONTRE-EXEMPLE DE CLÔTURE. NE PAS écrire : Parquet stratifié ton chêne, sans " +
      "remarque particulière. ÉCRIRE : Parquet stratifié ton chêne.",
  ];
}

/* ---- Description d'un GROUPE de photographies ---------------------------

   Décrire cinq vues d'une même pièce une par une produit cinq fois la même
   fissure vue sous cinq angles. En les envoyant ensemble, le modèle voit
   l'ensemble et rédige UN constat.

   Le rattachement à la preuve n'est pas perdu : la constatation porte la
   LISTE des photographies du groupe, et l'annexe du procès-verbal donne
   pour chacune sa date, son heure et son empreinte. */

/* Consigne du groupe : l'ossature de la consigne d'une photo, plus les
   règles propres au rapprochement de plusieurs vues. Les instructions de
   l'utilisateur s'AJOUTENT à la fin — elles ne remplacent jamais les
   interdits, qui n'appartiennent pas au modèle. */
/* Tout texte inséré dans le corps JSON construit dans Make doit passer par
   ici : guillemets, antislash et sauts de ligne le rendraient invalide. */
function nettoyerPourJson(texte) {
  return String(texte == null ? "" : texte)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/["\\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function consigneGroupe(piece, type, nombre, instruction) {
  const morceaux = morceauxConsigne(piece, type, "detaille").concat([
    "PLUSIEURS PHOTOGRAPHIES. Tu reçois " + nombre + " photographies de cette " +
      "même pièce. Rédige UN SEUL constat d'ensemble, jamais une description par " +
      "photographie, jamais de liste, jamais de numéro de photographie.",
    "NE RÉPÈTE RIEN. Un même élément apparaît souvent sur plusieurs vues sous un " +
      "angle différent : ne le décris qu'une fois, à l'endroit le plus net. " +
      "Répéter le même désordre trois fois donnerait à croire qu'il y en a trois.",
    "RAPPROCHE. Si deux vues montrent le même désordre, dis-le : également visible " +
      "sur la vue de face, en prolongement, sous un autre angle. C'est ce " +
      "rapprochement qui justifie de les avoir prises ensemble.",
    "CE QUI N'APPARAÎT QUE SUR UNE VUE se décrit normalement, sans préciser sur " +
      "laquelle : le constat ne renvoie pas aux photographies une par une.",
    "LONGUEUR. Une à trois phrases par rubrique, pas davantage. Le nombre de " +
      "rubriques dépend de ce qui est visible, pas du nombre de photographies.",
    "AUCUNE FORMULE DE CLÔTURE, à plus forte raison sur un groupe : ni sans remarque " +
      "particulière, ni rien à signaler, ni RAS, ni conforme. Le constat s'achève sur " +
      "la ligne PHOTOGRAPHIES.",

    /* La structure prend tout son sens sur un groupe : c'est là que le
       mélange devenait illisible. La règle « un seul constat » n'interdit
       pas les rubriques — au contraire, elle les rend nécessaires. */
    "LA STRUCTURE PRIME SUR LA BRIÈVETÉ. UN SEUL constat, mais organisé en rubriques " +
      "comme indiqué plus haut : PLAFOND, RETOMBÉES, les MURS nommés, PORTES, " +
      "CHÂSSIS, ESCALIER, SOLS, ÉLECTRICITÉ, ÉQUIPEMENTS FIXES, APPAREILS. Un élément " +
      "vu sur plusieurs photographies se décrit UNE FOIS, dans sa rubrique.",

    "AUTANT DE RUBRIQUES DE MUR QUE DE MURS VUS. Si trois photographies montrent " +
      "trois murs différents, écris trois rubriques, chacune nommée par ce que porte " +
      "le mur. C'est la raison d'être du constat de groupe : rassembler sans " +
      "confondre.",
  ]);
  if (instruction && String(instruction).trim()) {
    morceaux.push(
      "CONSIGNES DE L'EXPERT PRÉSENT SUR PLACE. Elles portent sur ce qu'il faut " +
      "regarder ou laisser de côté, et sur ce qu'il sait du bien et que la " +
      "photographie ne montre pas : " + String(instruction).trim(),
      "Ces consignes s'ajoutent aux règles ci-dessus, elles ne les annulent pas. " +
      "Les INTERDITS ABSOLUS restent entiers, même si elles demandent le contraire : " +
      "pas d'usure normale, pas de vétusté, aucune imputation à quiconque, aucun " +
      "coût, aucune date d'apparition, aucune origine d'humidité.");
  }
  return morceaux.join(" ").replace(/[\r\n\t]+/g, " ")
    .replace(/["\\]/g, "").replace(/\s+/g, " ").trim();
}

/* Consigne de reformulation.

   ORDRE DES BLOCS — ce n'est pas cosmétique.
   La documentation de Gemini recommande de placer la demande principale et
   les contraintes décisives EN DERNIER, après le matériau source. Un banc
   d'essai publié en 2026 confirme que Gemini suit mieux les contraintes
   situées tard dans le prompt.

   La version précédente plaçait la demande de l'opérateur au milieu et les
   règles de style à la fin : les règles de style l'emportaient. « Rends le
   texte plus fluide » et « trois phrases » restaient sans effet, alors que
   « supprime la phrase sur le sol » passait — parce qu'aucune règle de
   style ne s'y opposait.

   DEUX NIVEAUX, nommés comme tels.
   Les INTERDITS sont juridiques : ils ne cèdent jamais, ils protègent le
   document. Les PRÉFÉRENCES sont stylistiques : elles cèdent devant la
   demande de l'opérateur, qui est un professionnel jugeant sur place.

   Aucune persona d'expert assermenté : le modèle la préserve au prix des
   instructions, et le bailleur ne porte pas ce titre. */
function consigneReformulation(piece, type, texteActuel, instruction, historique, avecPhotos) {
  const sortie = (type === "EDLS");
  const morceaux = [
    /* Rappel bref en tête. Les règles critiques se répètent aux deux
       extrémités : le début ancre, la fin décide. */
    "TÂCHE : réécrire un constat d'état des lieux " +
      (sortie ? "de sortie" : "d'entrée") + " en Région wallonne. " +
      "Interdits permanents, rappelés en détail plus bas : ni usure normale, ni " +
      "vétusté, aucune imputation, aucun coût.",

    "PIÈCE CONCERNÉE : " + (piece || "non précisée") + ".",

    /* Le matériau source, clairement séparé des instructions. */
    "=== TEXTE À RÉÉCRIRE, DÉBUT === " + String(texteActuel || "").trim() +
      " === TEXTE À RÉÉCRIRE, FIN ===",

    /* Phrase d'ancrage après le bloc de données : Google recommande une
       transition explicite entre le matériau et la demande. */
    "En te fondant uniquement sur le texte encadré ci-dessus, applique ce qui suit.",

    "MÉTHODE. Relève chaque fait matériel du texte ci-dessus. Élimine les " +
      "répétitions et les formules vagues. Réorganise par élément. Puis rédige un " +
      "texte RÉELLEMENT NOUVEAU. Tous les faits du texte source subsistent, sauf " +
      "ceux dont la suppression est expressément demandée.",

    "ANTI-COPIE. Rendre le texte inchangé n'est PAS une réponse acceptable. Se " +
      "limiter à la ponctuation non plus. Si la demande te paraît déjà satisfaite, " +
      "améliore la précision, l'ordre et la concision — sans ajouter aucun fait.",

    avecPhotos
      ? "Les photographies te sont redonnées : tu peux y revoir ce qui t'est demandé."
      : "Tu ne revois PAS les photographies. N'ajoute donc aucun élément que le " +
        "texte ci-dessus ne mentionne pas : tu ne pourrais pas le constater. Si la " +
        "demande exige de regarder à nouveau, réponds exactement : il faut revoir " +
        "les photographies.",

    sortie
      ? "PARTICULARITÉ DE SORTIE. Ton strict et descriptif. Chaque désordre garde " +
        "l'élément atteint, le matériau, la nature, la localisation, l'ampleur, et " +
        "le caractère superficiel ou marqué dans le matériau. Aucun euphémisme."
      : "PARTICULARITÉ D'ENTRÉE. Conserve TOUS les défauts, même mineurs : ils " +
        "fixent l'état initial. Conserve aussi les affirmations d'intégrité ciblées " +
        "— vitrage intact, faïence sans éclat. Jamais de bon état global.",

    "PRÉFÉRENCES DE STYLE — elles cèdent devant la demande finale. Phrases courtes, " +
      "souvent nominales, vocabulaire exact, échelle d'amortissement neuf récent " +
      "terne défraîchi usagé amorti. Si la demande finale réclame un autre style — " +
      "plus fluide, moins haché, phrases regroupées, plus long, plus court — c'est " +
      "la demande qui l'emporte et ces préférences s'effacent.",

    "LONGUEUR. Si la demande finale indique un nombre de phrases ou de mots, ce " +
      "nombre FAIT LOI et prime sur toute autre indication de longueur, y compris " +
      "les préférences de style ci-dessus. Compte les phrases avant de répondre.",

    "FORMAT. Rends le texte réécrit et RIEN d'autre : pas d'introduction, pas de " +
      "commentaire, pas de guillemets, pas de titre, pas de liste.",

    "N'AJOUTE JAMAIS de formule de clôture : ni sans remarque particulière, ni rien " +
      "à signaler, ni RAS, ni conforme, ni en bon état. Si le texte source en " +
      "contient une, RETIRE-LA.",

    "INTERDITS ABSOLUS — ils ne cèdent devant AUCUNE demande, contrairement aux " +
      "préférences de style. Jamais d'usure normale ni de vétusté. Aucune " +
      "imputation au locataire, au bailleur ou à un tiers. Aucun coût, aucun " +
      "chiffrage. Aucune date d'apparition. Aucune origine d'humidité. Aucune " +
      "affirmation qu'un appareil fonctionne ou qu'un élément manque.",

    /* Exemples de transformation. Google recommande d'en fournir toujours :
       une consigne sans exemple est nettement moins efficace. Ils montrent
       ce qu'obéir veut dire, notamment pour les demandes de forme qui
       restaient sans effet. */
    "EXEMPLE A. Demande : trois phrases maximum. Texte source : Mur sous peinture " +
      "blanche mate. Deux poinçons de clou à mi-hauteur. Voile grisâtre sur environ " +
      "2 dm². Parquet stratifié ton chêne. Griffes superficielles en zone centrale. " +
      "Réponse attendue : Mur sous peinture blanche mate, deux poinçons de clou à " +
      "mi-hauteur et voile grisâtre sur environ 2 dm². Parquet stratifié ton chêne, " +
      "griffes superficielles en zone centrale. Aucun autre désordre visible sur ces " +
      "surfaces. Trois phrases, aucun fait perdu.",

    "EXEMPLE B. Demande : moins haché, regroupe les phrases. Texte source : " +
      "Plafonnage peint blanc. Raccord net. Coiffe d'éclairage circulaire. " +
      "Réponse attendue : Plafonnage peint blanc à raccord net, muni d'une coiffe " +
      "d'éclairage circulaire. Les faits sont identiques, la rédaction ne l'est pas.",

    "EXEMPLE C. Demande : supprime la phrase sur le sol. Le fait disparaît, tout le " +
      "reste subsiste, et le texte est reformulé — pas simplement amputé.",
  ];

  if (historique && historique.length) {
    /* CONTEXTE, jamais interdiction. La formule « demandes déjà satisfaites,
       à ne pas défaire » figeait le modèle dès que deux demandes se
       croisaient — plus court puis plus long — et il recopiait faute de
       pouvoir trancher. */
    morceaux.push("POUR CONTEXTE, demandes des tours précédents : " +
      historique.map((h, i) => (i + 1) + ") " + h).join(" ; ") +
      ". Elles ne t'obligent à rien. En cas de contradiction avec la demande " +
      "ci-dessous, c'est la demande ci-dessous qui l'emporte, sans hésitation.");
  }

  /* DERNIÈRE LIGNE : la demande. C'est la position que le modèle pondère
     le plus fortement. Tout ce qui précède la sert. */
  morceaux.push(
    "DEMANDE À APPLIQUER MAINTENANT, priorité absolue sur les préférences de style " +
    "et sur les tours précédents : " + String(instruction || "").trim());

  return morceaux.join(" ").replace(/[\r\n\t]+/g, " ")
    .replace(/["\\]/g, "").replace(/\s+/g, " ").trim();
}

/* Décrit un groupe de photographies déjà déposées dans OneDrive. */
/* Plafond. Gemini accepte 20 Mo par requête, tout compris. Dix
   photographies compressées à 1600 px pèsent une fois encodées environ
   11 Mo : on reste sous la limite, mais on ne va pas plus loin. Au-delà,
   le constat d'ensemble se dilue de toute façon. */
var GROUPE_MAX_PHOTOS = 10;

/* ---- Comparaison de deux photographies ---------------------------------

   L'IA CONSTATE, ELLE NE QUALIFIE PAS. Elle décrit l'écart entre la vue
   d'entrée et celle de sortie. Elle ne dit ni « nouveau », ni « aggravé »,
   ni « imputable », ni « usure normale », ni un montant : ces
   qualifications appartiennent au bailleur et au juge de paix, et une
   application qui les produirait affaiblirait le document au lieu de le
   renforcer.

   ELLE DOIT POUVOIR DIRE NON. Devant deux images qu'elle ne peut pas
   rapprocher — cadrages trop différents, éclairage incomparable — elle
   voudra répondre quand même et inventera un écart. On lui demande donc
   de trancher d'abord si la comparaison est possible. */
function consigneComparaison(piece, scoreAlignement) {
  const morceaux = [
    "Tu reçois DEUX photographies du même logement en Région wallonne : la " +
      "PREMIÈRE a été prise à l'entrée du locataire, la SECONDE à sa sortie, " +
      "plusieurs mois ou années plus tard.",
    "Pièce concernée : " + (piece || "non précisée") + ".",

    scoreAlignement
      ? "Les deux vues ont été cadrées avec une correspondance mesurée à " +
        scoreAlignement + " %."
      : "Le cadrage des deux vues n'a pas été mesuré.",

    /* La question préalable. Sans elle, le modèle répond toujours quelque
       chose, et une différence d'éclairage devient une auréole. */
    "AVANT TOUTE CHOSE, TRANCHE : reconnais-tu le MÊME élément sur les deux " +
      "photographies ? Si les cadrages sont trop différents, si l'éclairage " +
      "empêche toute comparaison, ou si tu n'es pas certain de regarder la " +
      "même surface, réponds EXACTEMENT : COMPARAISON IMPOSSIBLE, suivi de la " +
      "raison en une phrase. N'invente jamais un écart pour avoir quelque " +
      "chose à dire : une comparaison impossible se dit, elle ne se devine pas.",

    "SI LA COMPARAISON EST POSSIBLE, décris CE QUI A CHANGÉ entre la première " +
      "et la seconde. Pour chaque écart : l'élément atteint, son matériau, la " +
      "nature exacte du désordre, sa localisation précise, son ampleur " +
      "chiffrée, et son caractère superficiel et d'allure nettoyable ou " +
      "incrusté dans le matériau.",

    "SI RIEN N'A CHANGÉ, écris-le en une phrase, en nommant les éléments que " +
      "tu as comparés. Ne meuble pas.",

    "NE DÉCRIS PAS CE QUI EST IDENTIQUE. La description de l'état initial a " +
      "déjà été faite à l'entrée ; ici, seul l'écart compte.",

    "MÉFIE-TOI DE L'ÉCLAIRAGE. Une ombre, un reflet, une lampe allumée d'un " +
      "côté et pas de l'autre ne sont pas des désordres. Ne signale un écart " +
      "que si la MATIÈRE a changé.",

    "MÉFIE-TOI DU MOBILIER. Un meuble déplacé, un objet retiré découvre une " +
      "surface qu'on ne voyait pas : dis alors que la zone n'était pas " +
      "visible à l'entrée, plutôt que d'annoncer un désordre nouveau.",

    "MESURE OBLIGATOIRE. Tout écart porte son ampleur : environ 5 cm, sur " +
      "2 dm², sur une trentaine de centimètres. Sans ampleur, il ne pourra " +
      "pas être retenu.",

    "VOCABULAIRE. Emploie les termes du métier : impact, enfoncement, " +
      "fissure, lézarde, écaillement, pelade, décollement, épaufrure, " +
      "écornure, éclat, entartrage, cerne, auréole, moisissure, griffure, " +
      "poinçonnement, frottement.",

    "FORMULES CREUSES INTERDITES : sans remarque particulière, rien à " +
      "signaler, RAS, conforme, en bon état, aucune différence notable. " +
      "AUCUN EUPHÉMISME : ni un peu, ni quelques traces, ni légèrement, ni " +
      "correct, ni acceptable.",

    /* Les interdits juridiques, rappelés en fin de consigne — la position
       que le modèle pondère le plus. */
    "INTERDITS ABSOLUS. N'écris JAMAIS que l'état relève de l'usure normale " +
      "ou de la vétusté : cette qualification appartient au juge de paix. " +
      "N'impute JAMAIS un désordre au locataire, au bailleur ou à un tiers. " +
      "N'évalue JAMAIS un coût ni une réparation. Ne classe pas l'écart : " +
      "n'écris ni nouveau, ni aggravé, ni déjà présent, ni imputable. Tu " +
      "constates, tu ne juges pas.",

    "FORMAT. Rends le constat de l'écart et RIEN d'autre : pas " +
      "d'introduction, pas de conclusion, pas de titre, pas de liste, pas de " +
      "guillemets. Trois phrases au plus.",
  ];
  return morceaux.join(" ").replace(/[\r\n\t]+/g, " ")
    .replace(/["\\]/g, "").replace(/\s+/g, " ").trim();
}

/* Envoie les DEUX adresses à Make, dans l'ordre entrée puis sortie.
   La branche « groupe » du scénario les traite sans rien changer : elle
   découpe urls_photos, télécharge, assemble et appelle Gemini. Deux images
   au lieu de cinq, c'est tout. */
async function comparerPhotographies(visite, photoSortie, urlEntree) {
  if (!photoSortie.onedrive_item_id)
    throw new Error("La photographie de sortie n'est pas encore enregistrée " +
      "dans OneDrive. Envoie-la d'abord.");
  if (!urlEntree)
    throw new Error("Adresse de la photographie d'entrée introuvable.");

  const piece = (visite.pieces.find(p => p.piece_id === photoSortie.rattachement) || {}).libelle;
  const urlSortie = await lienTelechargement(visite, photoSortie);

  const champs = {
    action: "comparer_photos",
    nombre_photos: "2",
    drive_id: visite.bien.dossier_cible_drive_id || "",
    modele: CONFIG.ia.modele,
    piece: piece || "",
    type: visite.type,
    consigne: consigneComparaison(piece, photoSortie.score_alignement),
    prompt_version: IA_PROMPT_VERSION,
    visit_id: visite.visit_id,
    photo_ids: photoSortie.photo_id,
    /* L'ORDRE COMPTE : la consigne parle de la première et de la seconde. */
    urls_photos: [urlEntree, urlSortie].join("|"),
    url_photo_1: urlEntree,
    url_photo_2: urlSortie,
    url_photo: urlEntree,
    item_id: photoSortie.onedrive_item_id,
    photo_entree_nom: photoSortie.photo_entree_nom || "",
    score_alignement: String(photoSortie.score_alignement || ""),
  };

  const texte = await appelerRelaisIA(champs);
  const propre = nettoyerReponseIA(texte);
  if (!propre) throw new Error("Le relais a répondu, mais sans texte exploitable.");
  await journaliser("ia_comparaison",
    { photo: photoSortie.photo_id, score: photoSortie.score_alignement,
      impossible: /COMPARAISON IMPOSSIBLE/i.test(propre) });
  return propre;
}

/* Échantillon pour faire connaître les champs de comparaison à Make. */
async function envoyerEchantillonComparaison(adresse) {
  const champs = {
    action: "comparer_photos",
    nombre_photos: "2",
    drive_id: "", modele: CONFIG.ia.modele,
    piece: "Séjour", type: "EDLS",
    consigne: consigneComparaison("Séjour", 63),
    prompt_version: IA_PROMPT_VERSION,
    visit_id: "v_echantillon", photo_ids: "ph_echantillon",
    urls_photos: "https://exemple/entree.jpg|https://exemple/sortie.jpg",
    url_photo_1: "https://exemple/entree.jpg",
    url_photo_2: "https://exemple/sortie.jpg",
    url_photo: "https://exemple/entree.jpg",
    item_id: "item_echantillon",
    photo_entree_nom: "20260827_230720115_iOS.heic",
    score_alignement: "63",
  };
  const res = await fetch(adresse, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(champs).toString(),
  });
  return { statut: res.status, champs: Object.keys(champs).length };
}

async function decrireGroupe(visite, photos, instruction) {
  if (photos.length > GROUPE_MAX_PHOTOS)
    throw new Error("Maximum " + GROUPE_MAX_PHOTOS + " photographies par groupe. " +
      "Décoche-en " + (photos.length - GROUPE_MAX_PHOTOS) + " ou fais deux groupes.");
  const manquantes = photos.filter(p => !p.onedrive_item_id);
  if (manquantes.length)
    throw new Error(manquantes.length + " photographie(s) pas encore enregistrée(s) " +
      "dans OneDrive. Envoie-les d'abord.");

  const piece = (visite.pieces.find(p => p.piece_id === photos[0].rattachement) || {}).libelle;
  const champs = {
    action: "decrire_groupe",
    nombre_photos: String(photos.length),
    drive_id: visite.bien.dossier_cible_drive_id || "",
    modele: CONFIG.ia.modele,
    piece: piece || "",
    type: visite.type,
    consigne: consigneGroupe(piece, visite.type, photos.length, instruction),
    prompt_version: IA_PROMPT_VERSION,
    instruction: nettoyerPourJson(instruction),
    visit_id: visite.visit_id,
    photo_ids: photos.map(p => p.photo_id).join(","),
  };
  /* DEUX FORMES POUR LES MÊMES ADRESSES.

     urls_photos — toutes les adresses dans UN champ, séparées par une barre
     verticale. C'est celui qui compte : l'itérateur de Make a besoin d'un
     tableau, et il l'obtient en découpant ce champ. Des champs numérotés
     l'obligeraient à un module par numéro, alors que le nombre de
     photographies varie.

     url_photo_1, url_photo_2… — conservés pour rester lisibles à l'écran de
     Make pendant la mise au point, et parce que le scénario d'origine
     attend url_photo. */
  const adresses = [];
  for (let i = 0; i < photos.length; i++) {
    const lien = await lienTelechargement(visite, photos[i]);
    adresses.push(lien);
    champs["url_photo_" + (i + 1)] = lien;
    champs["item_id_" + (i + 1)] = photos[i].onedrive_item_id;
  }
  champs.urls_photos = adresses.join("|");
  champs.url_photo = adresses[0];
  champs.item_id = photos[0].onedrive_item_id;

  const texte = await appelerRelaisIA(champs);
  const propre = nettoyerReponseIA(texte);
  if (!propre) throw new Error("Le relais a répondu, mais sans texte exploitable.");
  await journaliser("ia_groupe",
    { photos: photos.length, longueur: propre.length, avec_instruction: !!instruction });
  return propre;
}

/* Reformule un texte déjà obtenu. `avecPhotos` décide de la branche :
   sans photographies l'appel est presque gratuit ; avec, il coûte autant
   qu'une description complète. */
async function reformulerTexte(visite, photos, texteActuel, instruction, historique, avecPhotos) {
  const piece = (visite.pieces.find(p => p.piece_id === photos[0].rattachement) || {}).libelle;
  const champs = {
    action: avecPhotos ? "reformuler_avec_photos" : "reformuler",
    modele: CONFIG.ia.modele,
    piece: piece || "",
    type: visite.type,
    /* Les guillemets et les sauts de ligne sont retirés AVANT l'envoi :
       le corps de la requête est du JSON écrit à la main dans Make, et un
       guillemet tapé par l'opérateur dans le cadre éditable le casserait.
       Même précaution que pour la consigne. */
    texte_actuel: nettoyerPourJson(texteActuel),
    instruction: nettoyerPourJson(instruction),
    historique: nettoyerPourJson((historique || []).join(" ; ")),
    /* Le texte à réécrire entre DANS la consigne. Le module 17 de Make n'a
       donc plus à le concaténer, et la même consigne sert aux deux branches
       — sans image et avec images, où le corps ne transmet que consigne. */
    consigne: consigneReformulation(piece, visite.type, texteActuel,
                                    instruction, historique, avecPhotos),
    prompt_version: IA_PROMPT_VERSION,
    nombre_photos: avecPhotos ? String(photos.length) : "0",
    drive_id: visite.bien.dossier_cible_drive_id || "",
    visit_id: visite.visit_id,
    photo_ids: photos.map(p => p.photo_id).join(","),
  };
  if (avecPhotos) {
    const adresses = [];
    for (let i = 0; i < photos.length; i++) {
      const lien = await lienTelechargement(visite, photos[i]);
      adresses.push(lien);
      champs["url_photo_" + (i + 1)] = lien;
      champs["item_id_" + (i + 1)] = photos[i].onedrive_item_id;
    }
    champs.urls_photos = adresses.join("|");
    champs.url_photo = adresses[0];
    champs.item_id = photos[0].onedrive_item_id;
  } else {
    champs.urls_photos = "";
  }
  const texte = await appelerRelaisIA(champs);
  const propre = nettoyerReponseIA(texte);
  if (!propre) throw new Error("Le relais a répondu, mais sans texte exploitable.");
  await journaliser("ia_reformulation",
    { avec_photos: !!avecPhotos, tour: (historique || []).length + 1 });
  return propre;
}

/* Demande la description d'une photo déjà déposée dans OneDrive.
   On transmet un lien de téléchargement, jamais l'image : elle est déjà
   là-bas, et un second transfert depuis le téléphone serait inutile. */
async function decrirePhoto(visite, photo, niveau) {
  if (!photo.onedrive_item_id)
    throw new Error("Photo pas encore enregistrée dans OneDrive.");

  const piece = (visite.pieces.find(p => p.piece_id === photo.rattachement) || {}).libelle;
  const lien = await lienTelechargement(visite, photo);

  const texte = await appelerRelaisIA({
    action: "decrire",
    url_photo: lien,
    item_id: photo.onedrive_item_id,
    drive_id: visite.bien.dossier_cible_drive_id || "",
    modele: CONFIG.ia.modele,
    piece: piece || "",
    type: visite.type,
    consigne: consigneDescription(piece, visite.type, niveau),
    prompt_version: IA_PROMPT_VERSION,
    niveau: niveau || "detaille",
    visit_id: visite.visit_id,
    photo_id: photo.photo_id,
  });

  const propre = nettoyerReponseIA(texte);
  if (!propre) throw new Error("Le relais a répondu, mais sans texte exploitable.");
  await journaliser("ia_description", { photo_id: photo.photo_id, longueur: propre.length });
  return propre;
}

/* Lien de téléchargement pré-authentifié, fourni par Microsoft Graph. */
async function lienTelechargement(visite, photo) {
  const d = visite.bien;
  /* Aucun filtre de champs : demander « $select » écarte justement le lien
     de téléchargement, que Microsoft ne renvoie que dans la réponse
     complète. Le nom de la propriété a changé selon les versions, on
     accepte les deux. */
  const url = d.dossier_cible_drive_id
    ? `/drives/${d.dossier_cible_drive_id}/items/${photo.onedrive_item_id}`
    : `/me/drive/items/${photo.onedrive_item_id}`;
  const res = await appelGraph(url);
  if (!res.ok) throw new Error("Lien de la photo : " + await detailErreur(res));
  const item = await res.json();
  const lien = item["@microsoft.graph.downloadUrl"] || item["@content.downloadUrl"];
  if (!lien) {
    await journaliser("lien_absent", { champs: Object.keys(item).join(", ").slice(0, 300) });
    throw new Error("Microsoft n'a pas renvoyé de lien de téléchargement pour cette photo. " +
      "Réessaie dans quelques secondes : le fichier vient peut-être d'être déposé.");
  }
  return lien;
}

/* Make renvoie parfois du JSON, parfois du texte brut selon la façon
   dont le module de réponse est réglé : on accepte les deux. */
function nettoyerReponseIA(brut) {
  let t = String(brut || "").trim();
  if (!t) return "";
  if (t.startsWith("{") || t.startsWith("[")) {
    try {
      const o = JSON.parse(t);
      t = o.texte || o.text || o.description || o.reponse ||
          (o.candidates && o.candidates[0] && o.candidates[0].content &&
           o.candidates[0].content.parts && o.candidates[0].content.parts[0] &&
           o.candidates[0].content.parts[0].text) || "";
    } catch (_) { /* ce n'était pas du JSON */ }
  }
  return String(t).replace(/^["'\s]+|["'\s]+$/g, "").replace(/\s+\n/g, "\n").trim();
}

/* ---- Échantillons pour l'éditeur de Make --------------------------------

   Make n'affiche AUCUN champ à mapper tant qu'il n'a pas reçu un envoi
   réel. Sans ces boutons, il est impossible de construire le scénario :
   on se retrouve devant un webhook vide.

   Les champs envoyés ici sont EXACTEMENT ceux d'un appel véritable, aux
   valeurs près. Un champ oublié ici est un champ introuvable dans Make. */

async function envoyerEchantillonGroupe(url, nombre) {
  const cible = url || adresseRelais();
  if (!cible) throw new Error("Aucune adresse de relais");
  const n = nombre || 5;
  const champs = {
    action: "decrire_groupe",
    nombre_photos: String(n),
    drive_id: "ECHANTILLON",
    modele: CONFIG.ia.modele,
    piece: "Séjour",
    type: "EDLE",
    consigne: consigneGroupe("Séjour", "EDLE", n, "Regarde surtout le sol près de la porte."),
    prompt_version: IA_PROMPT_VERSION,
    instruction: "Regarde surtout le sol près de la porte.",
    visit_id: "v_echantillon",
    photo_ids: Array.from({ length: n }, (_, i) => "ph_echantillon_" + (i + 1)).join(","),
  };
  const adresses = [];
  for (let i = 1; i <= n; i++) {
    const lien = "https://exemple-de-lien-de-telechargement/" + i;
    adresses.push(lien);
    champs["url_photo_" + i] = lien;
    champs["item_id_" + i] = "ECHANTILLON_" + i;
  }
  champs.urls_photos = adresses.join("|");
  champs.url_photo = adresses[0];
  champs.item_id = "ECHANTILLON_1";

  const corps = new URLSearchParams();
  Object.keys(champs).forEach(k => corps.append(k, String(champs[k] == null ? "" : champs[k])));
  const res = await fetch(cible, { method: "POST", body: corps });
  return { statut: res.status, corps: (await res.text()).slice(0, 300),
           champs: Object.keys(champs).length };
}

/* La branche « reformuler » n'envoie NI images NI consigne de description :
   ses champs diffèrent, elle a donc besoin de son propre échantillon. */
async function envoyerEchantillonReformulation(url) {
  const cible = url || adresseRelais();
  if (!cible) throw new Error("Aucune adresse de relais");
  const champs = {
    action: "reformuler",
    modele: CONFIG.ia.modele,
    piece: "Séjour",
    type: "EDLE",
    texte_actuel: "Plafonnage peint blanc. Deux poinçons de clou sous l'ebrasement gauche.",
    instruction: "Fais plus court et ne parle pas du plafond.",
    historique: "Fais plus court",
    consigne: consigneReformulation("Séjour", "EDLE",
      "Plafonnage peint blanc. Deux poinçons de clou sous l'ebrasement gauche.",
      "Fais plus court et ne parle pas du plafond.", ["Fais plus court"], false),
    prompt_version: IA_PROMPT_VERSION,
    nombre_photos: "0",
    urls_photos: "",
    drive_id: "ECHANTILLON",
    visit_id: "v_echantillon",
    photo_ids: "ph_echantillon_1,ph_echantillon_2",
  };
  const corps = new URLSearchParams();
  Object.keys(champs).forEach(k => corps.append(k, String(champs[k] == null ? "" : champs[k])));
  const res = await fetch(cible, { method: "POST", body: corps });
  return { statut: res.status, corps: (await res.text()).slice(0, 300),
           champs: Object.keys(champs).length };
}

/* Échantillon envoyé pour que Make apprenne la structure des données.
   Sans cet envoi, le webhook n'affiche aucun champ à mapper : c'est
   l'étape que tout le monde oublie. */
async function envoyerEchantillonIA(url) {
  const cible = url || (CONFIG.ia && CONFIG.ia.webhook_ia);
  if (!cible) throw new Error("Aucune adresse de relais");
  const corps = new URLSearchParams({
    action: "decrire",
    url_photo: "https://exemple-de-lien-de-telechargement",
    item_id: "ECHANTILLON",
    drive_id: "ECHANTILLON",
    modele: CONFIG.ia.modele,
    piece: "Séjour",
    type: "EDLE",
    consigne: consigneDescription("Séjour", "EDLE"),
    niveau: "detaille",
    visit_id: "v_echantillon",
    photo_id: "ph_echantillon",
  });
  const res = await fetch(cible, { method: "POST", body: corps });
  return { statut: res.status, corps: (await res.text()).slice(0, 300) };
}
