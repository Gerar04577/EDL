/* EDL — Comparaison entrée / sortie

   Trois temps, dans cet ordre, et l'ordre compte :
     1. la sortie est rédigée à l'aveugle, l'entrée reste fermée
     2. la comparaison est demandée explicitement
     3. le classement de chaque écart est un choix humain

   Rédiger en ayant l'entrée sous les yeux conduit à recopier. Le constat
   de sortie ressemblerait alors à une copie de l'entrée plutôt qu'à une
   observation, ce qui l'affaiblit devant le juge de paix.
*/

var CATEGORIES = [
  { cle: "deja_present", libelle: "déjà présent à l'entrée", chiffrable: false },
  { cle: "aggrave",      libelle: "aggravé",                 chiffrable: true },
  { cle: "nouveau",      libelle: "nouveau",                 chiffrable: true },
];

/* Va chercher l'état des lieux d'entrée dans le dossier EDLE voisin.
   Trois issues : le fichier de données (comparaison ligne à ligne),
   un ancien PDF seul (lecture à l'œil), ou rien. */
/* ---- Photographies de l'état des lieux d'entrée -------------------------

   Elles servent de référence à la visée guidée : à la sortie, Julien
   superpose la vue d'entrée au flux de la caméra et refait le même
   cadrage. Deux images comparables valent mieux que deux images
   rapprochées après coup.

   Les liens de téléchargement rendus par Microsoft vivent environ une
   heure. On ne les met donc pas en réserve durablement : on les redemande
   à l'ouverture de l'écran. */
async function chargerPhotosEntree(visite) {
  if (visite.type !== "EDLS") return { statut: "sans_objet", photos: [] };
  try {
    const parent = await refParentEDLE(visite);
    if (!parent) return { statut: "dossier_introuvable", photos: [] };

    /* Les visites récentes rangent leurs images dans un sous-dossier
       Photos ; celles d'avant la 2.5.0 les laissent au niveau du dessus.
       On regarde aux DEUX endroits et on réunit le résultat : choisir l'un
       OU l'autre échouait dès que le sous-dossier existait mais restait
       vide, ou l'inverse.

       ATTENTION AU DOSSIER PARTAGÉ. Un dossier venu d'un partage — le cas
       de cette arborescence, ouverte à plusieurs — n'arrive pas avec la
       propriété « folder » mais « remoteItem ». Ne tester que « folder »
       faisait manquer le sous-dossier Photos, chercher au niveau du dessus,
       et conclure qu'il n'y avait aucune photographie. */
    const contenu = await enfantsDeRef(parent);
    const trouvees = [];
    const vus = new Set();

    const ramasser = (liste, ref) => {
      liste.filter(e => (e.file || (e.remoteItem && e.remoteItem.file)) &&
                        /\.(jpe?g|png|heic|heif|webp)$/i.test(e.name || ""))
        .forEach(e => {
          const r = refDe(e, ref.driveId);
          if (vus.has(r.id)) return;
          vus.add(r.id);
          const h = horodatageDuNom(e.name);
          trouvees.push({
            nom_fichier: e.name,
            onedrive_item_id: r.id,
            drive_id: r.driveId,
            numero: numeroDuNom(e.name),
            piece: pieceDuNom(e.name),
            horodatage: h,
            heic: /\.(heic|heif)$/i.test(e.name || ""),
            prise_le: e.lastModifiedDateTime || null,
          });
        });
    };

    ramasser(contenu, parent);

    /* DESCENTE DANS TOUS LES SOUS-DOSSIERS.

       On s'arrêtait au dossier « Photos ». Depuis la 2.26.0, les
       photographies y sont rangées PAR PIÈCE — Photos / Salle de bain,
       Photos / Cuisine, Photos / Annexe — donc un niveau plus bas : elles
       devenaient invisibles à la sortie. Défaut constaté le 31/08/2026.

       La descente est bornée à trois niveaux : la racine, « Photos », et
       les pièces. Au-delà il n'y a rien, et une descente sans limite
       exposerait à parcourir tout OneDrive si un raccourci pointait vers
       un dossier parent.

       Un sous-dossier illisible n'interrompt rien : on note et on
       continue. */
    const descendre = async (liste, ref, niveau) => {
      if (niveau > 2) return;
      const dossiers = liste.filter(e =>
        (e.folder || e.remoteItem) && !(e.file || (e.remoteItem && e.remoteItem.file)));
      for (const d of dossiers) {
        const r = refDe(d, ref.driveId);
        if (vus.has("dos:" + r.id)) continue;
        vus.add("dos:" + r.id);
        try {
          const enfants = await enfantsDeRef(r);
          ramasser(enfants, r);
          await descendre(enfants, r, niveau + 1);
        } catch (err) {
          await journaliser("photos_entree_sous_dossier_illisible",
            { dossier: d.name, message: String(err && err.message) });
        }
      }
    };
    await descendre(contenu, parent, 0);

    const sousDossier = contenu.find(e =>
      (e.folder || e.remoteItem) &&
      String(e.name || "").toLowerCase() === "photos");

    if (!trouvees.length) {
      /* Dire CE QU'ON A VU : sans cela, « aucune photographie » ne permet
         pas de distinguer un dossier vide d'une lecture qui a échoué. */
      const noms = contenu.slice(0, 12).map(e => e.name).join(", ");
      await journaliser("photos_entree_aucune",
        { sous_dossier: !!sousDossier, contenu: noms });
      return { statut: "aucune", photos: [],
               vu: noms, sous_dossier: !!sousDossier };
    }

    /* Tri par horodatage quand il existe — c'est l'ordre de la visite —
       et par nom sinon. */
    const photos = trouvees.sort((a, b) => {
      const ta = (a.horodatage && a.horodatage.tri) || a.nom_fichier;
      const tb = (b.horodatage && b.horodatage.tri) || b.nom_fichier;
      return String(ta).localeCompare(String(tb));
    });

    await journaliser("photos_entree_lues",
      { nombre: photos.length, sous_dossier: !!sousDossier });
    return { statut: "ok", photos, sous_dossier: !!sousDossier };
  } catch (e) {
    await journaliser("photos_entree_echec", String(e && e.message));
    return { statut: "erreur", message: e.message, photos: [] };
  }
}

/* Les noms suivent le gabarit EDLE_2026-08-25_sejour_003_abc123.jpg :
   on en tire le numéro et la pièce, sans dépendre du fichier de données —
   qui peut manquer sur une entrée ancienne. */
function numeroDuNom(nom) {
  const m = String(nom || "").match(/_(\d{3})_/);
  return m ? m[1] : null;
}

/* La pièce, lue dans le nom du fichier. DEUX GABARITS COEXISTENT :

     EDLS_CH1-G_2026-08-30_012_ab12.jpg        depuis la 2.27.1
     EDLS_2026-08-30_chambre-1_012_ab12.jpg    avant

   Le premier place l'abréviation en tête — l'iPhone écrase le milieu des
   noms trop longs, ce qui compte doit donc venir d'abord. Le second est
   conservé pour les visites déjà déposées. */
function pieceDuNom(nom) {
  const t = String(nom || "");
  const neuf = t.match(/^[A-Z]+_([A-Z]{2,3}\d*)(?:-[A-Z]+)?_\d{4}-\d{2}-\d{2}_\d{3}_/);
  if (neuf) return neuf[1];
  const ancien = t.match(/^[A-Z]+_\d{4}-\d{2}-\d{2}_(.+?)_\d{3}_/);
  return ancien ? ancien[1].replace(/-/g, " ") : null;
}

/* Le mur, quand le nom le porte. Rien avant la 2.27.0. */
function murDuNom(nom) {
  const m = String(nom || "").match(/^[A-Z]+_[A-Z]{2,3}\d*-([A-Z]+)_\d{4}-\d{2}-\d{2}_/);
  return m ? m[1] : null;
}

/* Les états des lieux antérieurs à l'application ont été photographiés
   avec l'appareil de l'iPhone et déposés à la main dans OneDrive : leurs
   noms suivent le gabarit d'iOS — 20260827_230720115_iOS.heic — sans
   numéro ni pièce. On en tire au moins l'heure, pour donner un repère à
   l'écran et un ordre de tri fidèle à la visite. */
function horodatageDuNom(nom) {
  const m = String(nom || "").match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
  if (!m) return null;
  return { jour: m[3] + "/" + m[2], heure: m[4] + "h" + m[5],
           tri: m[1] + m[2] + m[3] + m[4] + m[5] + m[6] };
}

/* Aperçu JPEG produit par Microsoft.

   INDISPENSABLE POUR LE HEIC : Safari n'affiche pas ce format dans une
   page web, et Gemini reçoit dans nos appels un type déclaré image/jpeg.
   Demander un aperçu règle les deux d'un coup — Microsoft convertit, on
   ne manipule que du JPEG.

   On tente d'abord une grande taille, utile à la superposition ; la
   vignette « large » sert de repli, et le fichier d'origine en dernier
   ressort pour les formats que Safari sait déjà lire. */
/* Aperçu rapatrié EN LOCAL, sous forme de blob.

   INDISPENSABLE POUR LA VISÉE GUIDÉE. Une image servie par un autre
   domaine — et Microsoft en est un — ne peut pas voir ses pixels lus par
   la page : le navigateur l'interdit, et l'analyse des contours échoue
   avant même que la caméra ne s'allume. C'est ce qui bloquait le bouton.

   On passe donc par appelGraph, qui est authentifié et dont les réponses
   sont autorisées, puis on fabrique une adresse locale. L'image devient
   alors lisible comme si elle venait de l'appareil.

   Réservé à la visée : pour les vignettes, l'adresse directe suffit et
   coûte moins. */
async function apercuBlobEntree(photo, grand) {
  const base = photo.drive_id
    ? `/drives/${photo.drive_id}/items/${photo.onedrive_item_id}`
    : `/me/drive/items/${photo.onedrive_item_id}`;

  /* LES TAILLES D'APERÇU DE MICROSOFT, telles que la documentation les
     définit :
       small   — 48 × 48, RECADRÉ au carré ;
       medium  — 176 × 176, redimensionné ;
       large   — 1920 × 1920, redimensionné, plus long côté à 1920 ;
       cLxH    — taille libre, mais le préfixe « c » RECADRE : l'image
                 remplit la boîte et ce qui dépasse est coupé.

     Il n'existe pas de taille libre SANS recadrage. Mes deux tentatives
     précédentes s'y sont brisées : « c1600x1600 » rendait un carré, puis
     « 1600x1600 » sans le « c » ne correspondait à rien et échouait.

     LARGE EST LA BONNE RÉPONSE, et l'était depuis le début : 1920 pixels
     au plus long côté, proportions conservées, une seule requête.

     Pour la visée on préfère quand même le FICHIER D'ORIGINE quand Safari
     sait le lire — mêmes pixels que le banc d'essai qui charge depuis la
     pellicule. Le HEIC des anciens états des lieux passe par « large ». */
  const lisibleParSafari = /\.(jpe?g|png|webp)$/i.test(photo.nom_fichier || "");

  /* On garde le blob : la visée le confie à createImageBitmap, qui décode
     comme le banc d'essai. */
  const rapatrier = async (chemin) => {
    const res = await appelGraph(chemin);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob || !blob.size) return null;
    return { url: URL.createObjectURL(blob), blob };
  };

  if (grand && lisibleParSafari) {
    try { const u = await rapatrier(`${base}/content`); if (u) return u; }
    catch (_) { /* on tentera l'aperçu */ }
  }

  /* c1920x1920 D'ABORD POUR LA VISÉE — mesuré sur le terrain le
     30/08/2026, sur un HEIC d'iPhone déposé dans OneDrive :

       source        refusée
       c1920x1920    1440×1920   317 Ko    ← proportions conservées
       large          600×800     68 Ko
       medium         132×176      6 Ko
       small           72×96       3 Ko

     LE PRÉFIXE « c » NE RECADRE PAS. C'est le suffixe « _crop » qui le
     fait — l'exemple officiel est « c300x400_crop ». Je l'avais retirée le
     29/08 en croyant l'inverse, sans jamais le vérifier : c'était la
     meilleure taille disponible.

     ET « large » NE FAIT PAS 1920 malgré la documentation : 600×800 sur ce
     fichier. Deux signalements ouverts depuis 2021 décrivent cette perte
     de résolution sur les HEIC de l'iPhone, jamais corrigée.

     Pour les vignettes, « large » suffit et coûte cinq fois moins. */
  for (const t of (grand ? ["c1920x1920", "large", "medium"] : ["large", "medium"])) {
    try { const u = await rapatrier(`${base}/thumbnails/0/${t}/content`); if (u) return u; }
    catch (_) { /* taille suivante */ }
  }

  if (lisibleParSafari) {
    try { const u = await rapatrier(`${base}/content`); if (u) return u; }
    catch (_) { /* échec annoncé ci-dessous */ }
  }
  throw new Error("Aperçu indisponible pour " + photo.nom_fichier);
}

async function apercuPhotoEntree(photo, grand) {
  const base = photo.drive_id
    ? `/drives/${photo.drive_id}/items/${photo.onedrive_item_id}`
    : `/me/drive/items/${photo.onedrive_item_id}`;
  /* Vignettes : « large » suffit — 600×800 mesuré, 68 Ko. Voir
     apercuBlobEntree pour le détail des tailles de Microsoft. */
  const tailles = ["large", "medium"];

  for (const t of tailles) {
    try {
      const res = await appelGraph(`${base}/thumbnails/0/${t}`);
      if (!res.ok) continue;
      const v = await res.json();
      if (v && v.url) return v.url;
    } catch (_) { /* on essaie la taille suivante */ }
  }

  /* Aucun aperçu : Microsoft n'en produit pas pour tous les fichiers.
     Le fichier d'origine convient si Safari sait l'afficher. */
  if (/\.(jpe?g|png|webp)$/i.test(photo.nom_fichier || "")) {
    return await lienPhotoEntree(photo);
  }
  throw new Error("Aperçu indisponible pour " + photo.nom_fichier);
}

/* Lien de téléchargement d'une photographie d'entrée. Même mécanisme que
   lienTelechargement, mais la photo vit dans un AUTRE dossier que la
   visite en cours : on emploie son propre drive_id. */
async function lienPhotoEntree(photo) {
  const url = photo.drive_id
    ? `/drives/${photo.drive_id}/items/${photo.onedrive_item_id}`
    : `/me/drive/items/${photo.onedrive_item_id}`;
  const res = await appelGraph(url);
  if (!res.ok) throw new Error("Lien de la photo d'entrée : " + await detailErreur(res));
  const item = await res.json();
  const lien = item["@microsoft.graph.downloadUrl"] || item["@content.downloadUrl"];
  if (!lien) throw new Error("Microsoft n'a pas renvoyé de lien pour " + photo.nom_fichier);
  return lien;
}

/* Rapproche les photographies d'entrée de la pièce en cours. Le nom de
   fichier porte la pièce ; à défaut on rend tout, à charge de Julien de
   choisir.

   Dans un studio d'étudiant — l'essentiel du parc — la pièce principale
   porte presque toutes les photographies : ce filtre n'allège donc guère,
   d'où le tri par constat ci-dessous. */
function photosEntreePourPiece(photosEntree, libellePiece) {
  if (!libellePiece) return photosEntree;

  /* ON COMPARE DES ABRÉVIATIONS, PAS DES LIBELLÉS.

     Depuis la 2.27.1, le nom du fichier porte « SDB » et non plus
     « salle-de-bain-wc » : comparer les libellés complets échouait
     toujours, et l'écran montrait toutes les photographies quelle que
     soit la pièce. Défaut constaté le 31/08/2026.

     Les deux gabarits coexistent — pieceDuNom rend l'abréviation pour les
     noms récents, le libellé pour les anciens — donc on essaie les deux. */
  /* Comparaison faite ici plutôt que par nettoyerLibelle : cette dernière
     vit dans photos.js, chargé APRÈS ce fichier. Cela fonctionne dans un
     navigateur — l'appel n'a lieu qu'au clic — mais c'est une dépendance
     fragile qu'il vaut mieux ne pas créer. */
  const simplifier = (t) => String(t || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  const abrev = abregerPiece(libellePiece);
  const libelle = simplifier(libellePiece);

  const exactes = photosEntree.filter(p => {
    if (!p.piece) return false;
    return p.piece === abrev || simplifier(p.piece) === libelle;
  });
  return exactes.length ? exactes : [];
}

/* Photographies rattachées à une constatation de l'entrée.

   Deux cents vues dans un studio, mais vingt seulement documentent
   quelque chose ; les autres sont des vues d'ambiance qu'il est inutile
   de refaire. Rendre null quand le fichier de données manque — entrée
   antérieure à l'application — pour que l'écran désactive le choix
   plutôt que d'afficher une liste vide trompeuse. */
function photosAvecConstat(photosEntree, edle) {
  if (!edle || !edle.pieces) return null;
  const cites = new Set();
  edle.pieces.forEach(p => (p.constatations || []).forEach(c => {
    if (c.photo_nom) cites.add(c.photo_nom);
    (c.photo_noms || []).forEach(n => cites.add(n));
  }));
  if (!cites.size) return [];
  return photosEntree.filter(p => cites.has(p.nom_fichier));
}

async function chargerEtatDesLieuxEntree(visite) {
  if (visite.type !== "EDLS") return { statut: "sans_objet" };
  try {
    const parent = await refParentEDLE(visite);
    if (!parent) return { statut: "dossier_introuvable" };

    const contenu = await enfantsDeRef(parent);
    const fichiers = contenu.filter(e => e.file);

    const donnees = fichiers
      .filter(e => /^visite_.*\.json$/i.test(e.name || ""))
      .sort((a, b) => String(b.lastModifiedDateTime || "")
                        .localeCompare(String(a.lastModifiedDateTime || "")));

    if (donnees.length) {
      const edle = await telechargerJson(refDe(donnees[0], parent.driveId));
      if (edle && edle.pieces) {
        return { statut: "complet", edle, nom_fichier: donnees[0].name };
      }
    }

    /* Pas de fichier de données : l'entrée est antérieure à l'application.
       On propose l'ancien document à la lecture, sans rapprochement. */
    const documents = fichiers
      .filter(e => /\.(pdf|docx?)$/i.test(e.name || ""))
      .sort((a, b) => String(b.lastModifiedDateTime || "")
                        .localeCompare(String(a.lastModifiedDateTime || "")));
    if (documents.length) {
      return {
        statut: "ancien_document",
        documents: documents.map(e => ({
          nom: e.name,
          url: e.webUrl || null,
          modifie_le: e.lastModifiedDateTime || null,
        })),
        photos: fichiers.filter(e => /\.jpe?g$/i.test(e.name || "")).length,
      };
    }

    return { statut: "vide", photos: 0 };
  } catch (e) {
    await journaliser("edle_lecture_echouee", String(e && e.message));
    return { statut: "erreur", message: e.message };
  }
}

/* Rapproche les constatations d'entrée et de sortie, pièce par pièce.
   L'application ne juge rien : elle met en regard et laisse trancher. */
function construireLignesComparaison(visite, edle) {
  const lignes = [];

  const parLibelle = {};
  (edle.pieces || []).forEach(p => {
    parLibelle[normaliserLibelle(p.libelle)] = p;
  });

  visite.pieces.forEach(piece => {
    const entree = parLibelle[normaliserLibelle(piece.libelle)];

    /* L'état général de la pièce se compare aussi : il a quitté les
       constatations pour devenir une appréciation d'ensemble. */
    const ge = (entree && entree.etat_general) || {};
    const gs = piece.etat_general || {};
    const texteGeneral = (g) => {
      const t = [({ neuf: "état neuf", bon_etat: "bon état", usage: "usagé",
                    degrade: "dégradé" })[g.etat],
                 ({ propre: "propre", a_nettoyer: "à nettoyer",
                    sale: "sale" })[g.proprete]].filter(Boolean).join(", ");
      return [t, g.commentaire].filter(Boolean).join(" — ") || null;
    };
    const tge = texteGeneral(ge), tgs = texteGeneral(gs);
    if (tge || tgs) {
      lignes.push({
        piece_id: piece.piece_id, piece: piece.libelle, rang: -1,
        general: true,
        texte_entree: tge, etat_entree: ge.etat || null,
        proprete_entree: ge.proprete || null,
        texte_sortie: tgs, etat_sortie: gs.etat || null,
        proprete_sortie: gs.proprete || null,
        categorie: null, montant: null,
        piece_absente_entree: !entree,
      });
    }
    const constatsEntree = entree ? (entree.constatations || []) : [];
    const constatsSortie = piece.constatations || [];
    if (!constatsEntree.length && !constatsSortie.length) return;

    apparier(constatsEntree, constatsSortie).forEach((paire, i) => {
      const e = paire.entree, s = paire.sortie;
      lignes.push({
        piece_id: piece.piece_id,
        piece: piece.libelle,
        rang: i,
        texte_entree: e ? (e.texte || resumeQualites(e)) : null,
        etat_entree: e ? e.etat : null,
        proprete_entree: e ? e.proprete : null,
        texte_sortie: s ? (s.texte || resumeQualites(s)) : null,
        etat_sortie: s ? s.etat : null,
        proprete_sortie: s ? s.proprete : null,
        rapproche: paire.score > 0,
        score: paire.score,
        categorie: null,          // à trancher par l'utilisateur
        montant: null,
        piece_absente_entree: !entree,
      });
    });
  });

  return lignes;
}

/* Mots porteurs de sens d'un constat. Les mots courts et les mots vides
   sont écartés : ils rapprocheraient n'importe quoi de n'importe quoi. */
/* Trois lettres suffisent : MUR, SOL, BAC, JEU désignent des choses.
   En revanche les qualificatifs — BON, LEGER, GRAND — rapprocheraient
   n'importe quel constat de n'importe quel autre. */
var MOTS_VIDES = ["LES","DES","UNE","UN","DU","DE","LA","LE","ET","EN","AU","AUX",
  "SUR","SOUS","DANS","AVEC","SANS","PAR","POUR","EST","SONT","SE","SA","SON","SES",
  "CETTE","CET","CE","QUI","QUE","PAS","PEU","PLUS","TRES","BIEN","MAL","ETAT",
  "BON","BONNE","BONS","MAUVAIS","LEGER","LEGERE","GRAND","GRANDE","PETIT","PETITE",
  "AUTRE","MEME","DEUX","TROIS","QUATRE","CINQ","PRESENTE","PRESENTENT","PRESENCE",
  "VISIBLE","VISIBLES","ENVIRON","CIRCA","REMARQUE","PARTICULIERE","AUCUN","AUCUNE",
  "TOUT","TOUTE","ETRE","AVOIR","FAIT","NOTE","RELEVE"];

function motsConstat(texte) {
  return String(texte || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().split(/[^A-Z0-9]+/)
    /* Les unités et les nombres ne désignent rien : 40 CM se retrouve
       dans deux constats sans rapport. */
    .filter(m => m.length >= 3 && !/^[0-9]+$/.test(m) &&
                 m !== "CM" && m !== "MM" && !MOTS_VIDES.includes(m));
}

/* Nombre de mots porteurs communs à deux constats. */
function ressemblance(a, b) {
  const ma = motsConstat(a && (a.texte || resumeQualites(a)));
  const mb = motsConstat(b && (b.texte || resumeQualites(b)));
  if (!ma.length || !mb.length) return 0;
  const ensemble = new Set(mb);
  return ma.filter(m => ensemble.has(m)).length;
}

/* Rapproche les constats d'entrée et de sortie qui parlent de la même
   chose. L'ancien appariement se faisait par ORDRE D'ARRIVÉE : depuis que
   chaque constat suit une photographie, cet ordre n'a plus aucune raison
   de coïncider, et l'on comparait le parquet au châssis.

   On apparie du plus ressemblant au moins ressemblant. Ce qui ne trouve
   personne reste seul, et l'écran le dit. */
function apparier(entrees, sorties) {
  const candidats = [];
  entrees.forEach((e, i) => {
    sorties.forEach((s, j) => {
      const score = ressemblance(e, s);
      if (score > 0) candidats.push({ i, j, score });
    });
  });
  candidats.sort((a, b) => b.score - a.score);

  const prisE = new Set(), prisS = new Set();
  const paires = [];
  candidats.forEach(c => {
    if (prisE.has(c.i) || prisS.has(c.j)) return;
    prisE.add(c.i); prisS.add(c.j);
    paires.push({ entree: entrees[c.i], sortie: sorties[c.j], score: c.score, rangE: c.i });
  });

  entrees.forEach((e, i) => {
    if (!prisE.has(i)) paires.push({ entree: e, sortie: null, score: 0, rangE: i });
  });
  sorties.forEach((s, j) => {
    if (!prisS.has(j)) paires.push({ entree: null, sortie: s, score: 0, rangE: 999 + j });
  });

  paires.sort((a, b) => a.rangE - b.rangE);
  return paires;
}

function normaliserLibelle(s) {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function resumeQualites(c) {
  const t = [];
  if (c.etat) t.push(({ neuf: "état neuf", bon_etat: "bon état",
                        usage: "usagé", degrade: "dégradé" })[c.etat] || c.etat);
  if (c.proprete) t.push(({ propre: "propre", a_nettoyer: "à nettoyer",
                            sale: "sale" })[c.proprete] || c.proprete);
  return t.join(", ") || "—";
}

/* Suggestion, jamais une décision : elle sert seulement à ordonner le
   travail. Une ligne suggérée reste à confirmer. */
function suggererCategorie(ligne) {
  if (!ligne.texte_entree) return "nouveau";
  if (!ligne.texte_sortie) return "deja_present";
  const rang = { neuf: 0, bon_etat: 1, usage: 2, degrade: 3 };
  const a = rang[ligne.etat_entree], b = rang[ligne.etat_sortie];
  if (a !== undefined && b !== undefined && b > a) return "aggrave";
  if (normaliserLibelle(ligne.texte_entree) === normaliserLibelle(ligne.texte_sortie))
    return "deja_present";
  return null;
}

/* Le total ne retient que « aggravé » et « nouveau ».
   Ce qui était déjà là à l'entrée n'est pas imputable au locataire. */
function totaliserComparaison(comparaison, chiffrage) {
  const lignes = (comparaison && comparaison.lignes) || [];
  const retenues = lignes.filter(l =>
    (l.categorie === "aggrave" || l.categorie === "nouveau") &&
    l.montant !== null && l.montant !== undefined);
  const degats = retenues.reduce((s, l) => s + Number(l.montant), 0);

  const c = chiffrage || {};
  const nettoyage = Number(c.cout_nettoyage || 0);
  const chomage = Number(c.chomage_locatif || 0);

  return {
    total_degats: Math.round(degats * 100) / 100,
    cout_nettoyage: nettoyage || null,
    chomage_locatif: chomage || null,
    total_tvac: Math.round((degats + nettoyage + chomage) * 100) / 100,
    lignes_retenues: retenues.length,
    lignes_non_classees: lignes.filter(l => !l.categorie).length,
  };
}

function compterParCategorie(comparaison) {
  const n = { deja_present: 0, aggrave: 0, nouveau: 0, non_classe: 0 };
  ((comparaison && comparaison.lignes) || []).forEach(l => {
    if (l.categorie && n[l.categorie] !== undefined) n[l.categorie]++;
    else n.non_classe++;
  });
  return n;
}

/* Rapport de comparaison — document distinct du procès-verbal, non signé.
   Contester le classement ne doit pas fragiliser le constat lui-même. */
async function genererRapportComparaison(visite) {
  const doc = nouveauDocument();
  const p = creerPlume(doc);
  const V = visite;
  const comp = V.comparaison || {};
  const lignes = comp.lignes || [];

  p.titre("RAPPORT DE COMPARAISON ENTRÉE / SORTIE");
  p.paragraphe(V.bien.adresse_complete || V.bien.unite_source, { gras: true, taille: 11 });
  p.paragraphe(V.bien.immeuble + " — " + V.bien.unite_source);
  p.saut(4);

  p.paragraphe("Ce rapport est annexé au procès-verbal d'état des lieux de sortie. " +
    "Il n'est pas signé : il expose le rapprochement entre les constatations d'entrée " +
    "et celles de sortie, et le classement retenu par le bailleur.");
  p.saut(4);

  p.ligne("État des lieux d'entrée", comp.edle_date
    ? new Date(comp.edle_date).toLocaleDateString("fr-BE") : "—");
  p.ligne("État des lieux de sortie", dateFr(V.date_debut));
  p.ligne("Écarts examinés", lignes.length);
  p.saut(6);

  CATEGORIES.forEach(cat => {
    const groupe = lignes.filter(l => l.categorie === cat.cle);
    if (!groupe.length) return;
    p.titre(cat.libelle.toUpperCase() + "  —  " + groupe.length);
    groupe.forEach(l => {
      p.sousTitre(l.piece);
      p.paragraphe("À l'entrée : " + (l.texte_entree || "rien de signalé"), { retrait: 2 });
      p.paragraphe("À la sortie : " + (l.texte_sortie || "rien de signalé"), { retrait: 2 });
      if (cat.chiffrable && l.montant !== null && l.montant !== undefined)
        p.paragraphe("Montant retenu : " + euro(l.montant), { retrait: 2, gras: true });
      p.saut(3);
    });
    p.saut(3);
  });

  const nonClassees = lignes.filter(l => !l.categorie);
  if (nonClassees.length) {
    p.titre("NON CLASSÉ  —  " + nonClassees.length);
    p.paragraphe("Ces écarts n'ont pas été classés et ne sont retenus dans aucun montant.");
    nonClassees.forEach(l => {
      p.sousTitre(l.piece);
      p.paragraphe("À l'entrée : " + (l.texte_entree || "rien de signalé"), { retrait: 2 });
      p.paragraphe("À la sortie : " + (l.texte_sortie || "rien de signalé"), { retrait: 2 });
      p.saut(3);
    });
  }

  if (V.options && V.options.chiffrage_actif) {
    const t = totaliserComparaison(comp, V.chiffrage);
    p.titre("MONTANTS");
    p.paragraphe("Seuls les écarts classés « aggravé » ou « nouveau » sont retenus. " +
      "Ce qui était déjà présent à l'entrée n'est pas imputable au preneur.");
    p.saut(3);
    p.ligne("Dégâts retenus (" + t.lignes_retenues + " ligne(s))", euro(t.total_degats));
    if (t.cout_nettoyage) p.ligne("Nettoyage", euro(t.cout_nettoyage));
    if (t.chomage_locatif) p.ligne("Chômage locatif", euro(t.chomage_locatif));
    p.filet();
    doc.setFont("helvetica", "bold");
    p.ligne("TOTAL TVAC", euro(t.total_tvac));
    doc.setFont("helvetica", "normal");
  }

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(140);
    doc.text("Comparaison — " + V.bien.unite_source + " — " + V.visit_id,
             PDF_MARGE, PDF_HAUTEUR - 10);
    doc.text(i + " / " + total, PDF_LARGEUR - PDF_MARGE, PDF_HAUTEUR - 10, { align: "right" });
    doc.setTextColor(0);
  }
  return doc;
}
