/* EDL — Microsoft Graph

   CONTRAINTE À NE JAMAIS PERDRE
   Pour le propriétaire du OneDrive, le dossier racine est un vrai dossier
   et un accès par chemin texte fonctionne. Pour toute autre personne, ce
   même dossier n'est visible que comme un raccourci vers le drive du
   propriétaire (remoteItem) : un accès par chemin texte échoue alors avec
   une erreur 422. La seule méthode fiable pour tous les utilisateurs
   consiste à descendre l'arborescence identifiant par identifiant, en
   traitant explicitement le cas remoteItem.
   Toute réécriture qui reviendrait à un accès par chemin reproduirait
   un défaut déjà rencontré en production.

   Corollaire : chaque utilisateur autre que le propriétaire doit avoir
   ajouté le dossier partagé en raccourci dans « Mes fichiers ». */

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

async function appelGraph(chemin, options) {
  const jeton = await obtenirJeton();
  if (!jeton) throw new Error("Jeton indisponible");
  const o = options || {};
  const entetes = Object.assign({ Authorization: "Bearer " + jeton }, o.headers || {});
  return fetch(chemin.startsWith("http") ? chemin : GRAPH_BASE + chemin,
    Object.assign({}, o, { headers: entetes }));
}

async function detailErreur(res) {
  try {
    const d = await res.json();
    return (d.error && d.error.message) || res.status;
  } catch (_) {
    return res.status;
  }
}

/* Résout la référence d'un élément, en gérant le cas du raccourci. */
function refDe(element, driveParent) {
  if (element.remoteItem) {
    return {
      driveId: (element.remoteItem.parentReference && element.remoteItem.parentReference.driveId) || driveParent || null,
      id: element.remoteItem.id,
    };
  }
  return { driveId: driveParent || null, id: element.id };
}

/* Liste les enfants d'un dossier, en suivant la pagination jusqu'au bout.
   Un 404 est traité comme un dossier vide, pas comme une erreur. */
async function enfantsDeRef(ref) {
  const champs = "id,name,folder,file,remoteItem,webUrl,size,lastModifiedDateTime";
  let url;
  if (!ref || !ref.id) {
    url = `/me/drive/root/children?$top=200&$select=${champs}`;
  } else if (ref.driveId) {
    url = `/drives/${ref.driveId}/items/${ref.id}/children?$top=200&$select=${champs}`;
  } else {
    url = `/me/drive/items/${ref.id}/children?$top=200&$select=${champs}`;
  }

  const tous = [];
  while (url) {
    const res = await appelGraph(url);
    if (!res.ok) {
      if (res.status === 404) return tous;
      throw new Error(`Listage : ${await detailErreur(res)}`);
    }
    const data = await res.json();
    tous.push(...(data.value || []));
    url = data["@odata.nextLink"]
      ? data["@odata.nextLink"].replace(/^https:\/\/graph\.microsoft\.com\/v1\.0/, "")
      : null;
  }
  return tous;
}

let _refRacineCache = null;

async function obtenirRefRacineImmobilier() {
  if (_refRacineCache) return _refRacineCache;
  const enfants = await enfantsDeRef(null);
  const trouve = enfants.find(e => (e.name || "").trim() === CONFIG.onedrive.dossier_racine);
  if (!trouve) {
    throw new Error(
      `Dossier "${CONFIG.onedrive.dossier_racine}" introuvable dans « Mes fichiers ». ` +
      `Vérifie qu'il est bien ajouté en raccourci.`
    );
  }
  _refRacineCache = refDe(trouve, null);
  return _refRacineCache;
}

const _cacheRefImmeuble = {};

async function obtenirRefImmeuble(immeubleId) {
  if (_cacheRefImmeuble[immeubleId]) return _cacheRefImmeuble[immeubleId];
  const nom = CONFIG.dossier_onedrive_par_immeuble[immeubleId];
  if (!nom) throw new Error("Immeuble non associé à un dossier OneDrive");
  const racine = await obtenirRefRacineImmobilier();
  const enfants = await enfantsDeRef(racine);
  const trouve = enfants.find(e => (e.name || "").trim() === nom);
  if (!trouve) throw new Error(`Dossier immeuble "${nom}" introuvable`);
  const ref = refDe(trouve, racine.driveId);
  _cacheRefImmeuble[immeubleId] = ref;
  return ref;
}

// --- Correspondance des noms d'unités ------------------------------------
// Repris du portage Gestion Loyers v84, éprouvé sur les sept immeubles.

function normaliserNom(s) {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/\s+/g, " ").trim();
}

/* Correspondance par TYPE + NUMÉRO plutôt que par texte : les noms de
   dossiers OneDrive sont trop différents des désignations de Gestion
   Loyers pour une comparaison de chaînes ("REZ-DE-CHAUSSÉE" vs "RDC").
   L'ordre des tests n'est pas indifférent : COMMERCIAL avant RDC. */
function extraireTypeEtNumero(nom) {
  const n = normaliserNom(nom);
  if (/COMMERCIAL/.test(n)) return { type: "RDC_COMMERCIAL", num: null };
  if (/\bRDC\b/.test(n) || /REZ[\s-]*DE[\s-]*CHAUSSEE/.test(n)) return { type: "RDC", num: null };
  if (/GARAGE/.test(n)) return { type: "GARAGE", num: null };
  if (/DUPLEX/.test(n)) return { type: "DUPLEX", num: null };
  let m = n.match(/STUDIO\s*(\d+)/);
  if (m) return { type: "STUDIO", num: parseInt(m[1], 10) };
  m = n.match(/(\d+)\s*(ER|EME|E)?\s*ETAGE/);
  if (m) return { type: "ETAGE", num: parseInt(m[1], 10) };
  m = n.match(/APPART(?:EMENT)?\.?\s*(\d+)/);
  if (m) return { type: "ETAGE", num: parseInt(m[1], 10) };
  if (/\bAPPARTEMENT\b/.test(n) || /\bAPPART\.?\b/.test(n)) return { type: "APPART", num: null };
  return { type: null, num: null };
}

/* Trouve le dossier d'unité correspondant à une désignation Gestion Loyers.
   Renvoie aussi les candidats, car le cas RDC est ambigu à Petite Guirlande
   (RDC COMMERCIAL et APPART. RDC coexistent) : l'utilisateur devra trancher. */
function trouverDossierUnite(designation, dossiersReels) {
  const cible = extraireTypeEtNumero(designation);
  if (!cible.type) return { trouve: null, candidats: [], ambigu: false };
  const typesAcceptes = cible.type === "RDC" ? ["RDC", "RDC_COMMERCIAL"] : [cible.type];
  const candidats = dossiersReels.filter(d => {
    const t = extraireTypeEtNumero(d);
    return typesAcceptes.includes(t.type) && t.num === cible.num;
  });
  return {
    trouve: candidats.length === 1 ? candidats[0] : null,
    candidats,
    ambigu: candidats.length > 1,
  };
}

// --- Profil --------------------------------------------------------------

async function lireProfil() {
  const res = await appelGraph("/me?$select=displayName,userPrincipalName");
  if (!res.ok) throw new Error(`Profil : ${await detailErreur(res)}`);
  return res.json();
}
