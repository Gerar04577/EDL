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

function iaDisponible() {
  return !!(CONFIG.ia && CONFIG.ia.webhook_ia && CONFIG.ia.webhook_ia.trim());
}

/* Envoi en champs de formulaire : aucun en-tête personnalisé, aucun
   contenu JSON, donc aucune requête préalable. */
async function appelerRelaisIA(champs) {
  if (!iaDisponible()) throw new Error("Aucun relais configuré");

  const corps = new URLSearchParams();
  Object.keys(champs).forEach(k => corps.append(k, String(champs[k] == null ? "" : champs[k])));

  const controleur = new AbortController();
  const minuterie = setTimeout(() => controleur.abort(), IA_DELAI_MS);

  let res;
  try {
    res = await fetch(CONFIG.ia.webhook_ia, {
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
function consigneDescription(piece, type) {
  return [
    "Tu décris une photographie prise lors d'un état des lieux " +
      (type === "EDLS" ? "de sortie" : "d'entrée") + " d'un logement en Belgique.",
    "Pièce concernée : " + (piece || "non précisée") + ".",
    "Rédige deux à trois phrases en français, au présent, strictement factuelles :",
    "— nomme le matériau, l'élément ou l'équipement visible ;",
    "— décris l'état constaté et localise-le (mur de face, de gauche, de droite, arrière, sol, plafond) ;",
    "— donne un ordre de grandeur si une trace ou un défaut est visible.",
    "N'écris JAMAIS d'appréciation sur l'usure normale, la vétusté, la responsabilité " +
      "du locataire ou le coût d'une réparation.",
    "Si la photographie ne montre aucun défaut, dis-le simplement.",
    "Réponds par le texte seul, sans introduction ni titre.",
  ].join("\n");
}

/* Demande la description d'une photo déjà déposée dans OneDrive.
   On transmet l'identifiant du fichier, jamais l'image : elle est déjà
   là-bas, et un second transfert depuis le téléphone serait inutile. */
async function decrirePhoto(visite, photo) {
  if (!photo.onedrive_item_id)
    throw new Error("Photo pas encore enregistrée dans OneDrive.");

  const piece = (visite.pieces.find(p => p.piece_id === photo.rattachement) || {}).libelle;

  /* On transmet un lien de téléchargement direct plutôt que l'identifiant
     du fichier : le module OneDrive de Make ne sait pas toujours atteindre
     un dossier partagé, alors qu'une simple requête sur ce lien fonctionne
     toujours. Le lien est fourni par Microsoft, déjà authentifié, et
     valable environ une heure. */
  const lien = await lienTelechargement(visite, photo);

  const texte = await appelerRelaisIA({
    action: "decrire",
    url_photo: lien,
    item_id: photo.onedrive_item_id,
    drive_id: visite.bien.dossier_cible_drive_id || "",
    modele: CONFIG.ia.modele,
    piece: piece || "",
    type: visite.type,
    consigne: consigneDescription(piece, visite.type),
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
  const url = d.dossier_cible_drive_id
    ? `/drives/${d.dossier_cible_drive_id}/items/${photo.onedrive_item_id}?$select=id,@microsoft.graph.downloadUrl`
    : `/me/drive/items/${photo.onedrive_item_id}?$select=id,@microsoft.graph.downloadUrl`;
  const res = await appelGraph(url);
  if (!res.ok) throw new Error("Lien de la photo : " + await detailErreur(res));
  const item = await res.json();
  const lien = item["@microsoft.graph.downloadUrl"];
  if (!lien) throw new Error("Microsoft n'a pas fourni de lien de téléchargement.");
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
    visit_id: "v_echantillon",
    photo_id: "ph_echantillon",
  });
  const res = await fetch(cible, { method: "POST", body: corps });
  return { statut: res.status, corps: (await res.text()).slice(0, 300) };
}
