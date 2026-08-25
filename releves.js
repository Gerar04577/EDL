/* EDL — Relevés de fin de visite
   Compteurs, clés, équipements, état général, estimation de nettoyage.
   Repris à l'identique du formulaire papier de Gérard. */

var CLES_STANDARD = [
  { cle: "logement",          libelle: "Logement" },
  { cle: "communs",           libelle: "Porte des communs" },
  { cle: "boite_aux_lettres", libelle: "Boîte aux lettres" },
  { cle: "portail",           libelle: "Portail" },
  { cle: "jardin",            libelle: "Jardin" },
];

/* La photo du compteur est CONSEILLÉE, jamais obligatoire :
   elle appuie le relevé en cas de contestation, mais ne doit pas
   bloquer la clôture d'une visite. */
function photoCompteur(visite, rattachement) {
  return visite.photos.find(p => p.rattachement === rattachement) || null;
}

/* Rappels, JAMAIS bloquants. Rien n'empêche de clôturer une visite :
   c'est l'opérateur qui juge de ce qui doit être relevé. */
function controlerReleves(visite) {
  const conseils = [];
  const c = visite.compteurs;
  if (!c || !c.electricite || !c.eau) return conseils;
  const noter = (ok, message) => { if (!ok) conseils.push(message); };

  if (c.electricite.bi_horaire) {
    noter(estRempli(c.electricite.index_jour), "index électrique de jour");
    noter(estRempli(c.electricite.index_nuit), "index électrique de nuit");
  } else {
    noter(estRempli(c.electricite.index_unique), "index électrique");
  }
  noter(!!photoCompteur(visite, "compteur_electricite"), "photo du compteur électrique");

  noter(estRempli(c.eau.index), "index d'eau");
  noter(!!photoCompteur(visite, "compteur_eau"), "photo du compteur d'eau");

  (c.ista || []).forEach((x, i) => {
    noter(estRempli(x.index_r), `index R du répartiteur ${i + 1}`);
    noter(estRempli(x.index_21), `index 21 du répartiteur ${i + 1}`);
    noter(!!photoCompteur(visite, "compteur_ista_" + (i + 1)),
          `photo du répartiteur ${i + 1}`);
  });

  return conseils;
}

function estRempli(v) {
  return v !== null && v !== undefined && v !== "";
}

/* À la sortie, un index inférieur à celui d'entrée est impossible :
   soit une faute de frappe, soit un compteur remplacé. */
function controlerProgression(visite) {
  if (visite.type !== "EDLS") return [];
  const anomalies = [];
  const c = visite.compteurs;
  if (!c || !c.electricite || !c.eau) return anomalies;

  const comparer = (actuel, entree, libelle) => {
    if (!estRempli(actuel) || !estRempli(entree)) return;
    if (Number(actuel) < Number(entree)) {
      anomalies.push(`${libelle} : ${actuel} est inférieur à l'index d'entrée (${entree})`);
    }
  };

  const rapp = c.electricite.index_entree_rappel || {};
  if (c.electricite.bi_horaire) {
    comparer(c.electricite.index_jour, rapp.index_jour, "index électrique de jour");
    comparer(c.electricite.index_nuit, rapp.index_nuit, "index électrique de nuit");
  } else {
    comparer(c.electricite.index_unique, rapp.index_unique, "index électrique");
  }
  comparer(c.eau.index, (c.eau.index_entree_rappel || {}).index, "index d'eau");
  (c.ista || []).forEach((r, i) => {
    const re = r.index_entree_rappel || {};
    comparer(r.index_r, re.index_r, `index R du répartiteur ${i + 1}`);
    comparer(r.index_21, re.index_21, `index 21 du répartiteur ${i + 1}`);
  });
  return anomalies;
}

/* Reprend les index de l'état des lieux d'entrée dans celui de sortie,
   pour les afficher en regard et bloquer les régressions. */
async function rappelerIndexEntree(visite) {
  if (visite.type !== "EDLS") return null;
  /* Le rappel n'a lieu que s'il a été demandé : il coûte plusieurs
     lectures OneDrive et n'est pas toujours utile. */
  if ((visite.options || {}).rappel_index_entree !== true) return null;
  try {
    // l'EDLE est dans le dossier frère : on remonte d'un cran
    const parent = await refParentEDLE(visite);
    if (!parent) return null;
    const fichiers = (await enfantsDeRef(parent))
      .filter(e => e.file && /^visite_.*\.json$/.test(e.name || ""));
    if (!fichiers.length) return null;
    fichiers.sort((a, b) =>
      String(b.lastModifiedDateTime || "").localeCompare(String(a.lastModifiedDateTime || "")));
    const edle = await telechargerJson(refDe(fichiers[0], parent.driveId));
    if (!edle || edle.type !== "EDLE") return null;
    return { visit_id: edle.visit_id, date: edle.date_debut, compteurs: edle.compteurs,
             pieces: edle.pieces };
  } catch (e) {
    await journaliser("rappel_index_echoue", String(e && e.message));
    return null;
  }
}

/* Le dossier EDLE, frère du dossier EDLS où l'on écrit. */
async function refParentEDLE(visite) {
  const d = visite.bien;
  const url = d.dossier_cible_drive_id
    ? `/drives/${d.dossier_cible_drive_id}/items/${d.dossier_cible_item_id}?$select=parentReference`
    : `/me/drive/items/${d.dossier_cible_item_id}?$select=parentReference`;
  const res = await appelGraph(url);
  if (!res.ok) return null;
  const info = await res.json();
  const parentId = info.parentReference && info.parentReference.id;
  if (!parentId) return null;
  const ref = { id: parentId, driveId: d.dossier_cible_drive_id };
  const freres = (await enfantsDeRef(ref)).filter(e => e.folder || e.remoteItem);
  const edle = freres.find(e =>
    String(e.name || "").trim().toUpperCase() === CONFIG.onedrive.sous_dossier_edle);
  return edle ? refDe(edle, d.dossier_cible_drive_id) : null;
}
