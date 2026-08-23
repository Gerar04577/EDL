/* EDL — Capture et file d'attente
   RÈGLE DE SÛRETÉ FONDAMENTALE
   Une photo est enregistrée localement AVANT tout appel réseau, et sa copie
   locale n'est libérée qu'après confirmation d'écriture par Microsoft.
   Aucune exception. Une visite se déroule souvent en cave, sans réseau. */

let _fileEnCours = false;
let _minuterie = null;

/* Compression par canvas. Le plus grand côté est ramené à la valeur
   configurée, puis la qualité JPEG est abaissée par paliers jusqu'à
   atteindre la cible de poids. */
async function compresserImage(fichier) {
  const bitmap = await creerBitmap(fichier);
  const cote = CONFIG.photo.cote_max_px;
  let l = bitmap.width, h = bitmap.height;
  if (Math.max(l, h) > cote) {
    const f = cote / Math.max(l, h);
    l = Math.round(l * f); h = Math.round(h * f);
  }
  const toile = document.createElement("canvas");
  toile.width = l; toile.height = h;
  toile.getContext("2d").drawImage(bitmap, 0, 0, l, h);

  let qualite = CONFIG.photo.qualite_jpeg;
  let blob = await toileVersBlob(toile, qualite);
  let essais = 0;
  while (blob && blob.size > CONFIG.photo.cible_octets && qualite > 0.4 && essais < 4) {
    qualite -= 0.12; essais++;
    blob = await toileVersBlob(toile, qualite);
  }
  if (bitmap.close) bitmap.close();
  return { blob, largeur: l, hauteur: h, qualite };
}

function creerBitmap(fichier) {
  if (window.createImageBitmap) return createImageBitmap(fichier);
  return new Promise((resoudre, rejeter) => {
    const img = new Image();
    img.onload = () => resoudre(img);
    img.onerror = () => rejeter(new Error("Image illisible"));
    img.src = URL.createObjectURL(fichier);
  });
}

function toileVersBlob(toile, qualite) {
  return new Promise(resoudre => toile.toBlob(resoudre, "image/jpeg", qualite));
}

function nettoyerLibelle(s) {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

/* Le code de visite est inclus dans le nom : deux états des lieux du même
   type, le même jour, dans le même dossier ne peuvent pas s'écraser. */
function nomFichierPhoto(visite, rattachement, numero) {
  const date = visite.date_debut.slice(0, 10);
  const piece = visite.pieces.find(p => p.piece_id === rattachement);
  const etiquette = piece ? nettoyerLibelle(piece.libelle) : nettoyerLibelle(rattachement);
  const code = visite.visit_id.split("_").pop();
  return `${visite.type}_${date}_${etiquette}_${String(numero).padStart(3, "0")}_${code}.jpg`;
}

/* Ajout d'une photo : identifiant local, compression, enregistrement,
   PUIS seulement tentative d'envoi. L'ordre n'est pas négociable. */
async function ajouterPhoto(visite, rattachement, fichier) {
  const photoId = nouvelIdentifiant("ph");
  let blob = fichier, largeur = null, hauteur = null;
  try {
    const c = await compresserImage(fichier);
    if (c.blob) { blob = c.blob; largeur = c.largeur; hauteur = c.hauteur; }
    else await journaliser("compression_echouee", "résultat vide, envoi de l'original");
  } catch (e) {
    await journaliser("compression_echouee", String(e && e.message));
  }

  /* Numérotation ATOMIQUE : le calcul du numéro et l'ajout à la visite
     se font dans une seule transaction. Sans cela, deux prises simultanées
     — un double appui suffit — produisent le même nom de fichier, et la
     seconde écrase la première dans OneDrive. */
  const entree = {
    photo_id: photoId, nom_fichier: null, rattachement,
    onedrive_item_id: null, taille_octets: blob.size || null,
    statut_transfert: "en_attente", tentatives: 0,
    horodatage: new Date().toISOString(),
    description: "", description_source: null,
  };
  /* La numérotation ne doit JAMAIS revenir en arrière : compter les photos
     présentes réutiliserait le numéro d'une photo retirée, et le nouveau
     fichier écraserait un fichier existant dans OneDrive. On conserve donc
     un compteur qui ne décroît pas, par pièce. */
  const aJour = await modifierVisite(visite.visit_id, v => {
    if (!v.photo_seq) v.photo_seq = {};
    if (v.photo_seq[rattachement] === undefined) {
      // reprise d'une visite antérieure : on repart du plus grand numéro utilisé
      let max = 0;
      v.photos.filter(x => x.rattachement === rattachement).forEach(x => {
        const m = String(x.nom_fichier || "").match(/_(\d{3})_/);
        if (m) max = Math.max(max, parseInt(m[1], 10));
      });
      v.photo_seq[rattachement] = max;
    }
    const numero = v.photo_seq[rattachement] + 1;
    v.photo_seq[rattachement] = numero;
    entree.nom_fichier = nomFichierPhoto(v, rattachement, numero);
    v.photos.push(entree);
  });
  if (aJour) visite.photos = aJour.photos;
  else {
    if (!visite.photo_seq) visite.photo_seq = {};
    const numero = (visite.photo_seq[rattachement] || 0) + 1;
    visite.photo_seq[rattachement] = numero;
    entree.nom_fichier = nomFichierPhoto(visite, rattachement, numero);
    visite.photos.push(entree);
    await enregistrerVisite(visite);
  }
  const nom = entree.nom_fichier;

  const element = {
    photo_id: photoId,
    visit_id: visite.visit_id,
    nom_fichier: nom,
    rattachement,
    blob,
    taille_octets: blob.size || null,
    largeur, hauteur,
    statut_transfert: "en_attente",
    tentatives: 0,
    horodatage: entree.horodatage,
    drive_id: visite.bien.dossier_cible_drive_id,
    parent_id: visite.bien.dossier_cible_item_id,
  };
  await mettreEnFile(element);

  lancerFile();
  return photoId;
}

/* Téléversement d'un élément de la file. */
async function envoyerElement(element) {
  const chemin = element.drive_id
    ? `/drives/${element.drive_id}/items/${element.parent_id}:/${encodeURIComponent(element.nom_fichier)}:/content`
    : `/me/drive/items/${element.parent_id}:/${encodeURIComponent(element.nom_fichier)}:/content`;

  const res = await appelGraph(chemin, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg" },
    body: element.blob,
  });
  if (!res.ok) throw new Error(`Envoi : ${await detailErreur(res)}`);
  const item = await res.json();
  if (!item || !item.id) throw new Error("Réponse sans identifiant");
  return item.id;
}

/* Traitement de la file, un élément à la fois, avec délai croissant.
   Ne s'arrête jamais sur un échec : l'élément reste en attente. */
async function traiterFile() {
  if (_fileEnCours) return;
  if (!navigator.onLine || !estConnecte()) return;
  _fileEnCours = true;
  const visitesTouchees = new Set();
  try {
    let attente = await photosEnAttente();
    while (attente.length > 0 && navigator.onLine) {
      const element = attente[0];
      try {
        const itemId = await envoyerElement(element);
        await confirmerTransfert(element.photo_id, itemId);
        await majPhotoDansVisite(element.visit_id, element.photo_id, itemId);
        visitesTouchees.add(element.visit_id);
        await journaliser("photo_envoyee", { photo_id: element.photo_id });
      } catch (e) {
        await incrementerTentative(element.photo_id, String(e && e.message));
        await journaliser("photo_echec", { photo_id: element.photo_id, message: String(e && e.message) });
        const delai = Math.min(30000, 2000 * Math.pow(2, Math.min(4, element.tentatives || 0)));
        programmerReprise(delai);
        break;
      }
      majCompteurAttente();
      attente = await photosEnAttente();
    }
  } finally {
    _fileEnCours = false;
    majCompteurAttente();
    /* Dépôt final : dès que la file est vide, le fichier de visite est
       remis à jour dans OneDrive. Sans cela, les dernières photos
       manqueraient à une reprise depuis un autre appareil. */
    if (visitesTouchees.size > 0 && (await nombreEnAttente()) === 0) {
      for (const id of visitesTouchees) {
        const v = await lireVisite(id);
        if (v) {
          _dernierePhotoSauvee[v.visit_id] =
            v.photos.filter(p => p.statut_transfert === "confirme").length;
          await deposerFichierVisite(v);
        }
      }
    }
  }
}

function programmerReprise(delai) {
  if (_minuterie) clearTimeout(_minuterie);
  _minuterie = setTimeout(() => { _minuterie = null; traiterFile(); }, delai);
}

function lancerFile() {
  if (_minuterie) { clearTimeout(_minuterie); _minuterie = null; }
  traiterFile();
}

async function majPhotoDansVisite(visitId, photoId, itemId) {
  const visite = await modifierVisite(visitId, v => {
    const p = v.photos.find(x => x.photo_id === photoId);
    if (p) { p.onedrive_item_id = itemId; p.statut_transfert = "confirme"; }
  });
  if (!visite) return;
  // l'écran affiche la version en base, jamais une copie divergente
  if (typeof VISITE !== "undefined" && VISITE && VISITE.visit_id === visitId) {
    VISITE.photos = visite.photos;
  }
  await peutEtreSauvegarder(visite);
}

/* Sauvegarde continue du fichier de visite, pour rendre possible
   la reprise depuis un autre appareil. */
/* Un compteur PAR VISITE : un compteur unique se désynchronisait dès
   que deux visites étaient ouvertes en même temps. */
const _dernierePhotoSauvee = {};

async function peutEtreSauvegarder(visite) {
  const confirmees = visite.photos.filter(p => p.statut_transfert === "confirme").length;
  const precedent = _dernierePhotoSauvee[visite.visit_id] || 0;
  if (confirmees - precedent >= CONFIG.sauvegarde.intervalle_photos) {
    _dernierePhotoSauvee[visite.visit_id] = confirmees;
    await deposerFichierVisite(visite);
  }
}

/* Dépôt immédiat, à appeler quand on quitte un écran ou qu'on clôture :
   la minuterie de cinq secondes ne doit jamais être le seul déclencheur. */
async function deposerMaintenant(visite) {
  if (typeof _minuterieDepot !== "undefined" && _minuterieDepot) {
    clearTimeout(_minuterieDepot); _minuterieDepot = null;
  }
  return deposerFichierVisite(visite);
}

async function deposerFichierVisite(visite) {
  try {
    /* Le préfixe disparaît dès que la visite n'est plus en cours.
       Tester "signee" seul laissait un brouillon éternel après clôture. */
    const enCours = visite.statut === "en_cours" || !visite.statut;
    const nom = (enCours ? CONFIG.sauvegarde.prefixe_brouillon : "") +
                `visite_${visite.visit_id}.json`;
    const d = visite.bien;
    const chemin = d.dossier_cible_drive_id
      ? `/drives/${d.dossier_cible_drive_id}/items/${d.dossier_cible_item_id}:/${
          encodeURIComponent(nom)}:/content`
      : `/me/drive/items/${d.dossier_cible_item_id}:/${encodeURIComponent(nom)}:/content`;
    const res = await appelGraph(chemin, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(visite, null, 1),
    });
    if (!res.ok) throw new Error(await detailErreur(res));
    await journaliser("visite_sauvegardee", { visit_id: visite.visit_id, nom });
    if (!enCours) await supprimerBrouillon(visite);
    return true;
  } catch (e) {
    await journaliser("sauvegarde_echouee", String(e && e.message));
    return false;
  }
}

/* À la clôture, l'ancien fichier préfixé n'a plus lieu d'être :
   sans cela, le dossier contiendrait un brouillon et un définitif. */
async function supprimerBrouillon(visite) {
  try {
    const d = visite.bien;
    const nom = CONFIG.sauvegarde.prefixe_brouillon + `visite_${visite.visit_id}.json`;
    const chemin = d.dossier_cible_drive_id
      ? `/drives/${d.dossier_cible_drive_id}/items/${d.dossier_cible_item_id}:/${
          encodeURIComponent(nom)}:/content`
      : `/me/drive/items/${d.dossier_cible_item_id}:/${encodeURIComponent(nom)}:/content`;
    const info = await appelGraph(chemin.replace(":/content", ""));
    if (!info.ok) return false;
    const item = await info.json();
    const suppr = await appelGraph(
      d.dossier_cible_drive_id ? `/drives/${d.dossier_cible_drive_id}/items/${item.id}`
                               : `/me/drive/items/${item.id}`,
      { method: "DELETE" });
    await journaliser("brouillon_supprime", { ok: suppr.ok });
    return suppr.ok;
  } catch (e) {
    await journaliser("brouillon_suppression_echouee", String(e && e.message));
    return false;
  }
}

/* Compteur permanent, jamais masquable. */
async function majCompteurAttente(nbPhotos) {
  const zone = document.getElementById("barre-attente");
  if (!zone) return;
  const n = await nombreEnAttente();
  if (n > 0) {
    zone.textContent = n + (n > 1 ? " photos en attente d'envoi" : " photo en attente d'envoi");
    zone.className = "barre barre-attente";
    return;
  }
  /* Aucune photo en attente : encore faut-il qu'il y en ait eu.
     « Toutes les photos sont enregistrées » sur une pièce vide n'a
     aucun sens et fait croire à une photo fantôme. */
  const total = (typeof nbPhotos === "number") ? nbPhotos
    : (typeof VISITE !== "undefined" && VISITE ? VISITE.photos.length : 0);
  if (total === 0) {
    zone.textContent = "Aucune photo pour l'instant";
    zone.className = "barre barre-neutre";
  } else {
    zone.textContent = total > 1
      ? "Les " + total + " photos sont enregistrées"
      : "La photo est enregistrée";
    zone.className = "barre barre-ok";
  }
}
