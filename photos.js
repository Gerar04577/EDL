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
  const code = (visite.edl_id || visite.visit_id).split("_").pop();
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
  /* Empreinte calculée sur l'appareil, avant tout transfert : elle
     établit que la photo versée au débat est bien celle qui a été prise
     et présentée au signataire. */
  let empreinte = null;
  try { empreinte = await empreinteBlob(blob); }
  catch (e) { await journaliser("empreinte_photo_echouee", String(e && e.message)); }

  const entree = {
    photo_id: photoId, nom_fichier: null, rattachement,
    empreinte_sha256: empreinte,
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
    /* Adresse résolue UNE SEULE FOIS, au démarrage de la visite. Aucun appel
       réseau ici : l'image doit être à l'abri avant tout échange avec
       Microsoft. Les visites antérieures à la 2.5.0 n'ont pas de
       sous-dossier : elles continuent de déposer au niveau du dessus. */
    parent_id: visite.bien.dossier_photos_item_id ||
               visite.bien.dossier_cible_item_id,
  };
  await mettreEnFile(element);

  lancerFile();
  return photoId;
}

/* Empreinte SHA-256 d'un fichier, calculée localement. */
async function empreinteBlob(blob) {
  if (!(typeof crypto !== "undefined" && crypto.subtle)) return null;
  const tampon = blob.arrayBuffer ? await blob.arrayBuffer() : null;
  if (!tampon) return null;
  const h = await crypto.subtle.digest("SHA-256", tampon);
  return Array.from(new Uint8Array(h))
    .map(x => x.toString(16).padStart(2, "0")).join("");
}

/* Sous-dossier « Photos », à l'intérieur du dossier EDLE ou EDLS de la
   visite. Les photographies y vont ; le procès-verbal et le fichier de
   données restent au niveau au-dessus. Un lien de partage sur ce
   sous-dossier n'expose donc que des images — le fichier de données
   contient le numéro de carte d'identité des signataires.

   C'est le SEUL dossier que l'application crée, et uniquement au
   démarrage d'une visite, lorsque le réseau est nécessairement là.
   Jamais pendant la visite : voir ajouterPhoto. */

var _echecEnvoi = null;           // raison du dernier échec d'envoi de photo

async function resoudreDossierPhotos(driveId, parentId) {
  if (!parentId) return { ok: false, message: "Dossier de destination inconnu." };
  const base = driveId ? `/drives/${driveId}/items/${parentId}`
                       : `/me/drive/items/${parentId}`;
  const chercher = async () => {
    const res = await appelGraph(base + "/children");
    if (!res.ok) return { erreur: "Lecture du dossier refusée : " + (await detailErreur(res)) };
    const contenu = await res.json();
    const trouve = (contenu.value || []).find(
      x => x.folder && String(x.name).toLowerCase() === "photos");
    return { id: trouve ? trouve.id : null };
  };

  try {
    const lu = await chercher();
    if (lu.erreur) return { ok: false, message: lu.erreur };
    if (lu.id) return { ok: true, id: lu.id, cree: false };

    const cree = await appelGraph(base + "/children", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Photos", folder: {},
        /* Microsoft n'accepte que fail, replace ou rename à la création
           d'un dossier. « fail » convient : la lecture qui précède a déjà
           retrouvé le dossier s'il existait. */
        "@microsoft.graph.conflictBehavior": "fail",
      }),
    });
    if (cree.ok) {
      const item = await cree.json();
      if (item && item.id) {
        await journaliser("dossier_photos_cree", { parent: parentId });
        return { ok: true, id: item.id, cree: true };
      }
    }
    /* Créé entre-temps par un autre appareil : on le relit plutôt que
       d'échouer. */
    if (cree.status === 409) {
      const relu = await chercher();
      if (relu.id) return { ok: true, id: relu.id, cree: false };
    }
    const message = "Microsoft a refusé la création : " + (await detailErreur(cree));
    await journaliser("dossier_photos_echoue", message);
    return { ok: false, message };
  } catch (e) {
    const message = String((e && e.message) || e);
    await journaliser("dossier_photos_echoue", message);
    return { ok: false, message };
  }
}

/* Lien de consultation du sous-dossier Photos. Créé au démarrage, lui
   aussi : il figure au procès-verbal signé, et le locataire doit pouvoir
   consulter les photographies même si elles sont déposées plus tard. */
async function creerLienPhotos(driveId, itemId) {
  if (!itemId) return { ok: false, message: "Sous-dossier Photos inconnu." };
  const chemin = driveId ? `/drives/${driveId}/items/${itemId}/createLink`
                         : `/me/drive/items/${itemId}/createLink`;
  try {
    const res = await appelGraph(chemin, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "view", scope: "anonymous" }),
    });
    if (!res.ok) {
      const message = "Microsoft a refusé le lien de partage : " + (await detailErreur(res));
      await journaliser("lien_partage_echoue", message);
      return { ok: false, message };
    }
    const o = await res.json();
    const url = o && o.link && o.link.webUrl;
    if (!url) return { ok: false, message: "Microsoft n'a renvoyé aucune adresse de partage." };
    await journaliser("lien_partage_cree", { item: itemId });
    return { ok: true, lien: url };
  } catch (e) {
    const message = String((e && e.message) || e);
    await journaliser("lien_partage_echoue", message);
    return { ok: false, message };
  }
}

/* Préparation complète du dépôt, appelée à la sélection du dossier
   locataire. Si elle échoue, la visite ne démarre pas : mieux vaut un
   état des lieux sur papier qu'une visite dont on ignore où elle dépose. */
async function preparerDepot(refCible) {
  const dossier = await resoudreDossierPhotos(refCible.driveId, refCible.id);
  if (!dossier.ok) return { ok: false, etape: "sous-dossier Photos", message: dossier.message };
  const lien = await creerLienPhotos(refCible.driveId, dossier.id);
  if (!lien.ok) return { ok: false, etape: "lien de partage", message: lien.message };
  return { ok: true, id: dossier.id, lien: lien.lien };
}

/* Téléversement d'un élément de la file. */
async function envoyerElement(element) {
  const chemin = element.drive_id
    ? `/drives/${element.drive_id}/items/${element.parent_id}:/${encodeURIComponent(element.nom_fichier)}:/content`
    : `/me/drive/items/${element.parent_id}:/${encodeURIComponent(element.nom_fichier)}:/content`;

  const res = await appelGraph(chemin, {
    method: "PUT",
    /* Photographie ou document : le type suit l'élément. */
    headers: { "Content-Type": element.type_mime || "image/jpeg" },
    body: element.blob,
  });
  if (!res.ok) throw new Error(`Envoi : ${await detailErreur(res)}`);
  const item = await res.json();
  if (!item || !item.id) throw new Error("Réponse sans identifiant");
  return item.id;
}

/* Traitement de la file, un élément à la fois, avec délai croissant.
   Ne s'arrête jamais sur un échec : l'élément reste en attente. */
/* Une photographie refusée par Microsoft — nom impossible, fichier
   corrompu — ne doit JAMAIS bloquer les autres. La file était triée par
   horodatage toutes visites confondues : une photographie fautive du matin
   empêchait indéfiniment le départ de celles de l'après-midi.

   On distingue donc deux causes :
     — le réseau manque : on s'arrête, la suivante échouerait pareil ;
     — cette photographie-ci est refusée : on passe à la suivante. */
var ECHECS_AVANT_ABANDON = 5;

function _panneDeReseau(message) {
  const m = String(message || "").toLowerCase();
  return !navigator.onLine ||
    m.includes("n'a pas répondu") || m.includes("failed to fetch") ||
    m.includes("network") || m.includes("load failed") ||
    m.includes("jeton indisponible");
}

async function traiterFile() {
  if (_fileEnCours) return;
  if (!navigator.onLine) { _echecEnvoi = "Pas de réseau."; return; }
  if (!estConnecte()) { _echecEnvoi = "Compte Microsoft non connecté."; return; }
  _fileEnCours = true;
  const visitesTouchees = new Set();
  try {
    let attente = await elementsEnAttente();
    let rang = 0;
    while (rang < attente.length && navigator.onLine) {
      const element = attente[rang];
      let itemId = null;
      try {
        itemId = await envoyerElement(element);
        await confirmerTransfert(element.photo_id, itemId);
        _echecEnvoi = null;
      } catch (e) {
        const message = String((e && e.message) || e);
        _echecEnvoi = message;
        const maj = await incrementerTentative(element.photo_id, message);
        await journaliser("photo_echec", { photo_id: element.photo_id, message });

        if (_panneDeReseau(message)) {
          /* Réseau : on s'arrête et on retente plus tard, du début. */
          const delai = Math.min(30000, 2000 * Math.pow(2, Math.min(4, element.tentatives || 0)));
          programmerReprise(delai);
          break;
        }
        /* Photographie refusée : on la laisse de côté et on continue.
           Au-delà de cinq essais, elle est marquée en échec pour cesser
           d'être retentée à chaque envoi, et signalée à l'écran. */
        if (maj && (maj.tentatives || 0) >= ECHECS_AVANT_ABANDON) {
          await marquerEchec(element.photo_id, message);
          /* La visite doit le savoir : le procès-verbal mentionnera cette
             photographie comme non transmise. Sans cela, le document citait
             une image que le locataire ne trouverait jamais dans le dossier
             partagé, sans que rien ne l'explique. */
          if ((element.genre || "photo") === "photo") {
            await majPhotoEchouee(element.visit_id, element.photo_id, message);
          }
          await journaliser("photo_abandonnee", { photo_id: element.photo_id, message });
        }
        rang++;
        majCompteurAttente();
        continue;
      }
      /* Le dépôt a réussi et Microsoft a confirmé. Ce qui suit — mise à
         jour de la visite, rafraîchissement de l'écran — ne doit PAS être
         compté comme un échec d'envoi : la photographie est déposée, et la
         retenter la déposerait deux fois. */
      try {
        if ((element.genre || "photo") === "photo") {
          await majPhotoDansVisite(element.visit_id, element.photo_id, itemId);
          await journaliser("photo_envoyee", { photo_id: element.photo_id });
        } else {
          await majDocumentDansVisite(element, itemId);
          await journaliser("document_envoye",
            { role: element.role, nom: element.nom_fichier });
        }
        visitesTouchees.add(element.visit_id);
      } catch (e) {
        await journaliser("photo_apres_depot_echoue",
          { photo_id: element.photo_id, message: String((e && e.message) || e) });
      }
      majCompteurAttente();
      attente = await elementsEnAttente();
      rang = 0;
    }
  } finally {
    _fileEnCours = false;
    majCompteurAttente();
    /* Dépôt final : dès que la file est vide, le fichier de visite est
       remis à jour dans OneDrive. Sans cela, les dernières photos
       manqueraient à une reprise depuis un autre appareil. */
    /* Le dépôt final du fichier de visite ne doit dépendre que de SES
       photos, pas de celles d'une autre visite ouverte en parallèle. */
    if (visitesTouchees.size > 0) {
      for (const id of visitesTouchees) {
        if ((await nombreEnAttente(id)) > 0) continue;   // cette visite-ci attend encore
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
    /* L'écran doit se redessiner DÈS la confirmation. Attendre une
       minuterie laissait la photo affichée « en attente » alors qu'elle
       était déjà déposée — et le bouton « décrire » restait caché. */
    if (typeof prevenirEcran === "function") prevenirEcran(visitId);
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

/* Documents produits à la signature. Ils suivent EXACTEMENT la même règle
   que les photographies : conservés sur l'appareil, déposés quand le
   réseau le permet, et effacés de l'appareil seulement après confirmation
   d'écriture par Microsoft. */
async function mettreDocumentEnFile(visite, nom, donnees, role, mime) {
  const element = {
    photo_id: nouvelIdentifiant("doc"),
    genre: "document",
    role: role,
    visit_id: visite.visit_id,
    nom_fichier: nom,
    blob: donnees,
    type_mime: mime || "application/pdf",
    taille_octets: donnees.byteLength || donnees.size || null,
    statut_transfert: "en_attente",
    tentatives: 0,
    horodatage: new Date().toISOString(),
    drive_id: visite.bien.dossier_cible_drive_id,
    /* Le procès-verbal et le rapport restent au NIVEAU DE LA VISITE, jamais
       dans le sous-dossier Photos : le lien remis au locataire ne doit
       montrer que des images. */
    parent_id: visite.bien.dossier_cible_item_id,
  };
  await mettreEnFile(element);
  await journaliser("document_en_file", { role: role, nom: nom });
  return element.photo_id;
}

/* Photographie définitivement refusée : on l'inscrit dans la visite, sans
   la retirer. Ce qui a été pris et montré au locataire reste au constat. */
async function majPhotoEchouee(visitId, photoId, message) {
  const visite = await modifierVisite(visitId, v => {
    const p = v.photos.find(x => x.photo_id === photoId);
    if (p) { p.statut_transfert = "echec"; p.motif_echec = message || null; }
  });
  if (!visite) return;
  if (typeof VISITE !== "undefined" && VISITE && VISITE.visit_id === visitId) {
    VISITE.photos = visite.photos;
    if (typeof prevenirEcran === "function") prevenirEcran(visitId);
  }
}

async function majDocumentDansVisite(element, itemId) {
  await modifierVisite(element.visit_id, v => {
    v.preuve = v.preuve || {};
    if (element.role === "pv") {
      v.preuve.pv_onedrive_item_id = itemId;
      v.preuve.pv_depot_differe = false;
    } else if (element.role === "comparaison") {
      v.preuve.comparaison_onedrive_item_id = itemId;
    }
  });
}

/* Bloc « Envoyer les photographies », posé sur l'accueil et sur l'écran de
   clôture. Même comportement aux deux endroits : il envoie TOUT, toutes
   visites confondues, dans l'ordre où les photographies ont été prises.
   Deux boutons de même nom qui n'agiraient pas pareil seraient une source
   d'erreur, et la file est de toute façon unique. */
async function blocEnvoi() {
  const attente = await elementsEnAttente();
  const echecs = await photosEnEchec();
  if (!attente.length && !echecs.length) return "";

  const photos = attente.filter(x => (x.genre || "photo") === "photo").length;
  const docs = attente.length - photos;
  const mo = Math.round(attente.reduce((n, p) => n + (p.taille_octets || 0), 0) / 104857.6) / 10;

  /* Une ligne par visite : sans elle, Julien ne sait pas laquelle attend.
     Le procès-verbal est signalé à part — c'est la pièce qui compte. */
  const parVisite = {};
  attente.forEach(p => {
    const c = parVisite[p.visit_id] = parVisite[p.visit_id] || { photos: 0, docs: [] };
    if ((p.genre || "photo") === "photo") c.photos++;
    else c.docs.push(p.role === "pv" ? "procès-verbal" : "rapport de comparaison");
  });
  const noms = await Promise.all(Object.keys(parVisite).map(async id => {
    const v = await lireVisite(id);
    const libelle = v ? (v.bien.immeuble + " " + v.bien.unite_source) : "visite effacée";
    const c = parVisite[id];
    const detail = [c.photos ? c.photos + " photo(s)" : null]
      .concat(c.docs).filter(Boolean).join(" · ");
    return `<div class="ligne"><span>${escapeSimple(libelle)}</span>
      <span class="val">${detail}</span></div>`;
  }));

  const quoi = photos
    ? photos + " photo" + (photos > 1 ? "s" : "") + (docs ? " et " + docs + " document(s)" : "")
    : docs + " document" + (docs > 1 ? "s" : "");

  return `<div class="bloc"><h2>À envoyer</h2>
    ${docs ? `<p class="note ko">Un procès-verbal signé attend d'être déposé.
      Envoie-le dès que le réseau revient.</p>` : ""}
    ${attente.length
      ? `<button id="btn-envoyer">Envoyer ${quoi} — ${mo} Mo</button>
         ${noms.join("")}`
      : ""}
    ${echecs.length
      ? `<p class="note ko">${echecs.length} photographie(s) refusée(s) par Microsoft
         après plusieurs essais : ${escapeSimple(echecs[0].derniere_erreur)}.
         Elles restent sur le téléphone. Reprends-les depuis l'écran de la pièce.</p>`
      : ""}
    ${_echecEnvoi && attente.length
      ? `<p class="note">Dernier échec : ${escapeSimple(_echecEnvoi)}</p>` : ""}
  </div>`;
}

function escapeSimple(s) {
  return String(s == null ? "" : s).replace(/[<>&"]/g, c =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
}

/* Branche le bouton. `apres` est rappelée quand l'envoi est terminé, pour
   que l'écran se redessine avec le compte à jour. */
function brancherEnvoi(apres) {
  const b = document.getElementById("btn-envoyer");
  if (!b) return;
  b.onclick = async () => {
    b.disabled = true;
    const total = (await elementsEnAttente()).length;
    let restant = total;
    b.textContent = "Envoi… 0 sur " + total;
    const suivi = setInterval(async () => {
      restant = (await elementsEnAttente()).length;
      b.textContent = "Envoi… " + (total - restant) + " sur " + total;
    }, 1200);
    try { await traiterFile(); }
    finally {
      clearInterval(suivi);
      if (typeof apres === "function") await apres();
    }
  };
}

/* Compteur permanent, jamais masquable. */
async function majCompteurAttente(nbPhotos) {
  const zone = document.getElementById("barre-attente");
  if (!zone) return;
  const n = await nombreEnAttente(
    typeof VISITE !== "undefined" && VISITE ? VISITE.visit_id : null);
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
