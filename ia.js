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

var IA_DELAI_MS = 45000;
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
function morceauxConsigne(piece, type, niveau) {
  const sortie = (type === "EDLS");
  /* À la sortie, toujours le niveau détaillé : c'est là que se joue la
     comparaison. À l'entrée, le niveau sobre est possible — un état des
     lieux d'entrée exhaustif documente des défauts qui deviendront
     « déjà présents » et ne pourront plus être réclamés. */
  if (!sortie && niveau === "sobre") return morceauxSobre(piece);
  return [
    "Tu es géomètre-expert immobilier assermenté et tu rédiges un procès-verbal " +
      "d'état des lieux " + (sortie ? "de sortie" : "d'entrée") + " en Région wallonne. " +
      "Tu décris une photographie.",
    "Pièce concernée : " + (piece || "non précisée") + ".",

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

    "ÉTAT PONCTUEL. Pour un élément sans défaut : intact, sans remarque, pas de " +
      "remarque particulière, conforme, de belle facture, de bonne facture, " +
      "correctement mis en oeuvre, fonctionnel.",

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

    "MESURE. Ordre de grandeur seulement, jamais une mesure précise : millimétrique, " +
      "centimétrique, sur 3 à 4 cm, environ 2 cm, sur une dizaine de centimètres, " +
      "sur 1 m². Pour les surfaces, emploie cm², dm² ou m². Écris toujours environ ou " +
      "de l'ordre de : les longueurs sont estimées, non mesurées.",

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

    "INTERDITS ABSOLUS. N'écris JAMAIS que l'état relève de l'usure normale ou de la " +
      "vétusté. N'impute JAMAIS un défaut au locataire, au bailleur ou à un tiers. " +
      "N'évalue JAMAIS un coût ni une réparation. N'indique JAMAIS depuis quand un " +
      "défaut existe. Ces appréciations appartiennent aux parties et au juge de paix, " +
      "pas au constat.",

    "TU PEUX NE PAS SAVOIR. Écrire non déterminable sur la photographie est une " +
      "réponse correcte et attendue. Elle vaut mieux qu'une description plausible mais " +
      "inexacte : le constat sera relu par le locataire et pourra être discuté devant " +
      "le juge de paix.",

    "INCERTITUDE. Si un élément est sombre, flou ou masqué, écris-le. Les teintes " +
      "sont faussées par l'éclairage artificiel : préfère une teinte claire, un ton " +
      "chêne, plutôt qu'une couleur précise.",

    "SI RIEN N'EST À SIGNALER. Termine par : sans remarque particulière.",

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

    "EXEMPLE 1. Mur à droite sous peinture blanche, conforme. Deux poinçons de clou " +
      "à mi-hauteur et une trace de frottement d'allure lavable sur environ 2 dm². " +
      "Fendille longeant l'angle du plafond, pour mémoire.",

    "EXEMPLE 2. Sol constitué d'un parquet stratifié imitation chêne rustique avec " +
      "plinthes périphériques assorties. Griffes superficielles sur une trentaine de " +
      "centimètres en zone centrale. Léger disjoint entre sol et pied de plinthe.",

    "EXEMPLE 3. Châssis de fenêtre en aluminium thermolaqué anthracite, double " +
      "vitrage intact. Départ d'écaillement d'enduit sur 3 à 4 cm au niveau de " +
      "l'ébrasement. Tablette en pierre bleue polie à arête chanfreinée, marquée " +
      "d'une rayure légère.",

    "EXEMPLE 4. Plafond conforme avec coiffe d'éclairage circulaire. Évidement de " +
      "plafonnage d'environ 4 cm² à droite du châssis. Fissurations constructives " +
      "naissantes dans les angles, pour mémoire.",

    "EXEMPLE 5. Faïence murale blanc mat à joints propres, intacte. Joints " +
      "grisonnants en pied de tub de douche. Robinetterie chromée sans remarque.",
  ];
}

/* Consigne sobre, entrée seulement. Même ossature — anti-invention,
   vocabulaire, interdits — mais un seuil bien plus haut : on ne retient
   que ce qu'un locataire remarquerait en entrant dans la pièce. */
function morceauxSobre(piece) {
  return [
    "Tu es expert immobilier et tu rédiges un constat d'état des lieux d'entrée " +
      "en Région wallonne. Tu décris une photographie.",
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

    "SI RIEN NE DÉPASSE LE SEUIL. Nomme l'élément et son matériau, puis écris : " +
      "sans remarque particulière. C'est le cas le plus fréquent et c'est normal.",

    "INTERDITS. N'écris JAMAIS que l'état relève de l'usure normale ou de la vétusté. " +
      "N'impute JAMAIS un défaut à quiconque. N'évalue JAMAIS un coût. N'affirme " +
      "JAMAIS qu'un appareil fonctionne, qu'un élément manque, ou l'origine d'une " +
      "humidité.",

    "EXEMPLE 1. Mur sous peinture blanche, sans remarque particulière.",
    "EXEMPLE 2. Parquet stratifié ton chêne. Impact de 3 cm environ en zone centrale.",
    "EXEMPLE 3. Faïence murale blanche sans éclat ni fissure. Bac de douche intact.",
    "EXEMPLE 4. Châssis en PVC blanc, double vitrage intact. Sans remarque.",
    "CONTRE-EXEMPLE. NE PAS écrire : deux poinçons de clou à mi-hauteur et léger " +
      "voile grisâtre. Ces éléments sont sous le seuil. ÉCRIRE : Mur sous peinture " +
      "blanche, sans remarque particulière.",
  ];
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
