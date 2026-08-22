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

async function lireVisite(visitId) {
  const s = await _transaction("visites", "readonly");
  return _promesse(s.get(visitId));
}

async function listerVisites() {
  const s = await _transaction("visites", "readonly");
  return _promesse(s.getAll());
}

async function visiteEnCours() {
  const toutes = await listerVisites();
  return toutes.find(v => v.statut === "en_cours") || null;
}

// --- File d'attente des photos -------------------------------------------

async function mettreEnFile(element) {
  const s = await _transaction("photos_en_attente", "readwrite");
  return _promesse(s.put(element));
}

async function photosEnAttente(visitId) {
  const s = await _transaction("photos_en_attente", "readonly");
  const toutes = await _promesse(s.getAll());
  return toutes.filter(p =>
    p.statut_transfert === "en_attente" && (!visitId || p.visit_id === visitId)
  );
}

async function nombreEnAttente() {
  return (await photosEnAttente()).length;
}

/* Confirmation d'écriture : c'est SEULEMENT ici que la copie locale
   est libérée, et uniquement si Microsoft a bien renvoyé un identifiant. */
async function confirmerTransfert(photoId, onedriveItemId) {
  if (!onedriveItemId) throw new Error("Confirmation refusée : aucun identifiant OneDrive");
  const s = await _transaction("photos_en_attente", "readwrite");
  const element = await _promesse(s.get(photoId));
  if (!element) return null;
  element.statut_transfert = "confirme";
  element.onedrive_item_id = onedriveItemId;
  element.blob = null;              // la copie locale est libérée
  element.confirme_le = new Date().toISOString();
  return _promesse(s.put(element));
}

async function incrementerTentative(photoId, message) {
  const s = await _transaction("photos_en_attente", "readwrite");
  const element = await _promesse(s.get(photoId));
  if (!element) return null;
  element.tentatives = (element.tentatives || 0) + 1;
  element.derniere_erreur = message || null;
  return _promesse(s.put(element));
}

// --- Journal technique ---------------------------------------------------

async function journaliser(evenement, detail) {
  const s = await _transaction("journal", "readwrite");
  return _promesse(s.add({
    horodatage: new Date().toISOString(),
    evenement,
    detail: detail || null,
  }));
}

async function lireJournal(limite) {
  const s = await _transaction("journal", "readonly");
  const tout = await _promesse(s.getAll());
  return tout.slice(-(limite || 50)).reverse();
}

// --- Identifiants --------------------------------------------------------

/* Générés localement, AVANT tout appel réseau, et jamais modifiés ensuite. */
function nouvelIdentifiant(prefixe) {
  const d = new Date();
  const jour = d.toISOString().slice(0, 10).replace(/-/g, "");
  const alea = Math.random().toString(16).slice(2, 8);
  return `${prefixe}_${jour}_${alea}`;
}

// --- Diagnostic ----------------------------------------------------------

async function espaceDisponible() {
  if (!navigator.storage || !navigator.storage.estimate) return null;
  const e = await navigator.storage.estimate();
  return { utilise: e.usage, quota: e.quota };
}
