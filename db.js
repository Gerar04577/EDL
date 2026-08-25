/* EDL — Base locale (IndexedDB)
   Règle de sûreté fondamentale : une photo n'est retirée de la file
   qu'après confirmation d'écriture par Microsoft. Jamais avant. */

const DB_NOM = "edl";
const DB_VERSION = 1;

let _db = null;

function ouvrirBase() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resoudre, rejeter) => {
    const requete = indexedDB.open(DB_NOM, DB_VERSION);

    requete.onupgradeneeded = (e) => {
      const db = e.target.result;

      if (!db.objectStoreNames.contains("visites")) {
        const s = db.createObjectStore("visites", { keyPath: "visit_id" });
        s.createIndex("statut", "statut", { unique: false });
      }

      if (!db.objectStoreNames.contains("photos_en_attente")) {
        const s = db.createObjectStore("photos_en_attente", { keyPath: "photo_id" });
        s.createIndex("visit_id", "visit_id", { unique: false });
        s.createIndex("statut_transfert", "statut_transfert", { unique: false });
      }

      if (!db.objectStoreNames.contains("journal")) {
        db.createObjectStore("journal", { keyPath: "id", autoIncrement: true });
      }
    };

    requete.onsuccess = () => { _db = requete.result; resoudre(_db); };
    requete.onerror = () => rejeter(requete.error);
  });
}

function _transaction(magasin, mode) {
  return ouvrirBase().then(db => db.transaction(magasin, mode).objectStore(magasin));
}

function _promesse(requete) {
  return new Promise((resoudre, rejeter) => {
    requete.onsuccess = () => resoudre(requete.result);
    requete.onerror = () => rejeter(requete.error);
  });
}

// --- Visites -------------------------------------------------------------

async function enregistrerVisite(visite) {
  const s = await _transaction("visites", "readwrite");
  return _promesse(s.put(visite));
}

/* Modification atomique : on relit toujours la version en base avant
   d'appliquer un changement. Sans cela, l'objet gardé en mémoire par
   l'écran écrase les confirmations d'envoi écrites par la file. */
async function modifierVisite(visitId, mutation) {
  /* Deux transactions distinctes plutôt qu'une seule maintenue ouverte :
     Safari referme une transaction devenue inactive entre deux tours de
     boucle, ce qui produirait un enregistrement silencieusement perdu.
     Les écritures sont sérialisées par une file d'attente interne. */
  return _enFile(async () => {
    const lecture = await _transaction("visites", "readonly");
    const visite = await _promesse(lecture.get(visitId));
    if (!visite) return null;
    mutation(visite);
    const ecriture = await _transaction("visites", "readwrite");
    await _promesse(ecriture.put(visite));
    // relecture de contrôle : on ne renvoie que ce qui est réellement écrit
    const verif = await _transaction("visites", "readonly");
    return _promesse(verif.get(visitId));
  });
}

/* File d'attente : deux modifications simultanées de la même visite ne
   peuvent pas s'écraser mutuellement. */
let _chaine = Promise.resolve();
function _enFile(tache) {
  const suivant = _chaine.then(tache, tache);
  _chaine = suivant.catch(() => {});
  return suivant;
}

async function lireVisite(visitId) {
  const s = await _transaction("visites", "readonly");
  return _promesse(s.get(visitId));
}

async function listerVisites() {
  const s = await _transaction("visites", "readonly");
  return _promesse(s.getAll());
}

async function visitesEnCours() {
  const toutes = await listerVisites();
  return toutes.filter(v => v.statut === "en_cours")
    .sort((a, b) => String(b.date_debut).localeCompare(String(a.date_debut)));
}

async function visiteEnCours() {
  return (await visitesEnCours())[0] || null;
}

async function visitesTerminees() {
  const toutes = await listerVisites();
  return toutes.filter(v => v.statut !== "en_cours")
    .sort((a, b) => String(b.date_debut).localeCompare(String(a.date_debut)));
}

/* Suppression complète : la visite ET les photos restées en file.
   Les fichiers déjà déposés dans OneDrive ne sont pas touchés. */
async function supprimerVisite(visitId) {
  return _enFile(async () => {
    /* Une transaction par opération : une boucle d'attentes à l'intérieur
       d'une même transaction est refermée par Safari en cours de route. */
    const lecture = await _transaction("photos_en_attente", "readonly");
    const toutes = await _promesse(lecture.getAll());
    const aSupprimer = toutes.filter(p => p.visit_id === visitId).map(p => p.photo_id);
    for (const id of aSupprimer) {
      const s = await _transaction("photos_en_attente", "readwrite");
      await _promesse(s.delete(id));
    }
    const sv = await _transaction("visites", "readwrite");
    await _promesse(sv.delete(visitId));
    return true;
  });
}

/* Retire une photo de la visite et de la file. */
async function retirerPhoto(visitId, photoId) {
  await _enFile(async () => {
    const sp = await _transaction("photos_en_attente", "readwrite");
    await _promesse(sp.delete(photoId));
  });
  return modifierVisite(visitId, v => {
    const i = v.photos.findIndex(p => p.photo_id === photoId);
    if (i >= 0) v.photos.splice(i, 1);
  });
}

// --- File d'attente des photos -------------------------------------------

async function mettreEnFile(element) {
  const s = await _transaction("photos_en_attente", "readwrite");
  return _promesse(s.put(element));
}

/* Triée par horodatage : les photos partent dans l'ordre où elles ont été
   prises. Sans ce tri, l'ordre suivrait l'identifiant, qui est aléatoire. */
/* La file contient deux sortes d'éléments : les photographies, et les
   documents produits à la signature — procès-verbal, rapport de
   comparaison. Le procès-verbal doit lui aussi pouvoir attendre le
   réseau : sans cela, la signature restait impossible hors ligne, alors
   même qu'on avait décidé qu'elle devait aboutir.

   Les éléments enregistrés avant la 2.5.2 n'ont pas de champ « genre » :
   ce sont des photographies. */
function _estPhoto(element) {
  return (element.genre || "photo") === "photo";
}

async function elementsEnAttente(visitId) {
  const s = await _transaction("photos_en_attente", "readonly");
  const toutes = await _promesse(s.getAll());
  return toutes
    .filter(p => p.statut_transfert === "en_attente" && (!visitId || p.visit_id === visitId))
    .sort((a, b) => String(a.horodatage).localeCompare(String(b.horodatage)));
}

async function photosEnAttente(visitId) {
  return (await elementsEnAttente(visitId)).filter(_estPhoto);
}

async function documentsEnAttente(visitId) {
  return (await elementsEnAttente(visitId)).filter(x => !_estPhoto(x));
}

/* Compté PAR VISITE : un compteur global faisait qu'une visite ouverte
   en bloquait une autre, et le bandeau annonçait des photos qui n'étaient
   pas celles de la pièce affichée. */
async function nombreEnAttente(visitId) {
  const liste = await photosEnAttente();
  if (!visitId) return liste.length;
  return liste.filter(p => p.visit_id === visitId).length;
}

/* Confirmation d'écriture : c'est SEULEMENT ici que la copie locale
   est libérée, et uniquement si Microsoft a bien renvoyé un identifiant. */
async function confirmerTransfert(photoId, onedriveItemId) {
  if (!onedriveItemId) throw new Error("Confirmation refusée : aucun identifiant OneDrive");
  return _enFile(async () => {
    const lecture = await _transaction("photos_en_attente", "readonly");
    const element = await _promesse(lecture.get(photoId));
    if (!element) return null;
    element.statut_transfert = "confirme";
    element.onedrive_item_id = onedriveItemId;
    element.blob = null;              // la copie locale est libérée
    element.confirme_le = new Date().toISOString();
    const ecriture = await _transaction("photos_en_attente", "readwrite");
    return _promesse(ecriture.put(element));
  });
}

/* Photographie définitivement refusée par Microsoft. Elle sort de la file
   des envois à faire — sans quoi elle serait retentée à chaque fois et
   fausserait le compte — mais son image RESTE dans la base : rien n'est
   jamais effacé sans confirmation d'écriture. */
async function marquerEchec(photoId, message) {
  return _enFile(async () => {
    const lecture = await _transaction("photos_en_attente", "readonly");
    const element = await _promesse(lecture.get(photoId));
    if (!element) return null;
    element.statut_transfert = "echec";
    element.derniere_erreur = message || null;
    element.echec_le = new Date().toISOString();
    const ecriture = await _transaction("photos_en_attente", "readwrite");
    return _promesse(ecriture.put(element));
  });
}

/* Photographies abandonnées, pour les signaler à l'écran. */
async function photosEnEchec(visitId) {
  const s = await _transaction("photos_en_attente", "readonly");
  const toutes = await _promesse(s.getAll());
  return toutes.filter(p => p.statut_transfert === "echec" &&
    (!visitId || p.visit_id === visitId));
}

/* Poids total restant à envoyer : c'est lui qui décide si l'on appuie sur
   « Envoyer » en wifi ou si l'on attend d'être rentré. */
async function poidsEnAttente(visitId) {
  const liste = await photosEnAttente(visitId);
  return liste.reduce((n, p) => n + (p.taille_octets || 0), 0);
}

async function incrementerTentative(photoId, message) {
  return _enFile(async () => {
    const lecture = await _transaction("photos_en_attente", "readonly");
    const element = await _promesse(lecture.get(photoId));
    if (!element) return null;
    element.tentatives = (element.tentatives || 0) + 1;
    element.derniere_erreur = message || null;
    const ecriture = await _transaction("photos_en_attente", "readwrite");
    await _promesse(ecriture.put(element));
    /* On renvoie l'ÉLÉMENT, pas la clé : l'appelant a besoin du nombre de
       tentatives pour décider d'abandonner. */
    return element;
  });
}

// --- Journal technique ---------------------------------------------------

/* Le journal est plafonné : sans cela il grossit indéfiniment,
   quelques milliers d'entrées après une saison de rotations. */
const JOURNAL_MAX = 500;
let _journalDepuisPurge = 0;

async function journaliser(evenement, detail) {
  const s = await _transaction("journal", "readwrite");
  const r = await _promesse(s.add({
    horodatage: new Date().toISOString(),
    evenement,
    detail: detail || null,
  }));
  if (++_journalDepuisPurge >= 100) { _journalDepuisPurge = 0; purgerJournal(); }
  return r;
}

async function purgerJournal() {
  try {
    const lecture = await _transaction("journal", "readonly");
    const cles = await _promesse(lecture.getAllKeys());
    if (cles.length <= JOURNAL_MAX) return;
    const aEffacer = cles.slice(0, cles.length - JOURNAL_MAX);
    for (const k of aEffacer) {
      const s = await _transaction("journal", "readwrite");
      await _promesse(s.delete(k));
    }
  } catch (_) { /* le journal n'est jamais bloquant */ }
}

async function lireJournal(limite) {
  const s = await _transaction("journal", "readonly");
  const tout = await _promesse(s.getAll());
  return tout.slice(-(limite || 50)).reverse();
}

// --- Identifiants --------------------------------------------------------

/* Générés localement, AVANT tout appel réseau, et jamais modifiés ensuite.

   Six caractères aléatoires donnaient environ une chance sur sept de
   produire deux identifiants identiques quelque part dans l'année, ce
   qui écraserait une photo en file. On utilise donc le générateur
   cryptographique du navigateur, douze caractères, plus un compteur
   qui garantit l'unicité au sein d'une même session. */
let _compteurId = 0;

function nouvelIdentifiant(prefixe) {
  const jour = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  let alea;
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const t = new Uint8Array(6);
    crypto.getRandomValues(t);
    alea = Array.from(t).map(x => x.toString(16).padStart(2, "0")).join("");
  } else {
    alea = (Math.random().toString(16) + "000000000000").slice(2, 14);
  }
  const suite = (++_compteurId).toString(36);
  return `${prefixe}_${jour}_${alea}${suite}`;
}

// --- Diagnostic ----------------------------------------------------------

async function espaceDisponible() {
  if (!navigator.storage || !navigator.storage.estimate) return null;
  const e = await navigator.storage.estimate();
  return { utilise: e.usage, quota: e.quota };
}
