/* EDL — Liste des locataires
   Source : remboursements.json, exporté par Gestion Loyers.
   L'application ne lit que quatre champs : immeuble, unité, locataire,
   inoccupé. Garanties, retards de loyer et d'assurance sont ignorés —
   ils n'ont rien à faire dans un état des lieux. */

let _locatairesCache = null;

/* Descend un chemin relatif à « Mes fichiers », segment par segment,
   PAR IDENTIFIANT. Jamais par chemin texte : voir graph.js. */
async function descendreChemin(cheminRelatif) {
  const segments = cheminRelatif.split("/").filter(s => s.length > 0);
  let ref = null;               // null = racine « Mes fichiers »
  let element = null;
  for (const segment of segments) {
    const enfants = await enfantsDeRef(ref);
    element = enfants.find(e => (e.name || "").trim() === segment);
    if (!element) throw new Error(`« ${segment} » introuvable dans OneDrive`);
    ref = refDe(element, ref ? ref.driveId : null);
  }
  return { ref, element };
}

async function telechargerJson(ref) {
  const url = ref.driveId
    ? `/drives/${ref.driveId}/items/${ref.id}/content`
    : `/me/drive/items/${ref.id}/content`;
  const res = await appelGraph(url);
  if (!res.ok) throw new Error(`Téléchargement : ${await detailErreur(res)}`);
  return res.json();
}

/* Découpe un champ locataire en preneurs distincts.
   Les colocations sont écrites tantôt avec « & », tantôt avec un tiret.
   Le caractère « @ » est un marqueur interne, retiré à l'affichage.
   Aucun découpage prénom/nom : l'ordre n'est pas constant dans la source,
   et une erreur ici finirait dans un document signé. */
function decouperPreneurs(champ) {
  if (!champ) return [];
  return String(champ)
    .split(/\s*&\s*|\s+-\s+/)
    .map(p => p.replace(/@/g, "").replace(/\s+/g, " ").trim())
    .filter(p => p.length > 0);
}

async function chargerLocataires(forcer) {
  if (_locatairesCache && !forcer) return _locatairesCache;

  const { ref } = await descendreChemin(CONFIG.onedrive.chemin_liste_locataires);
  const brut = await telechargerJson(ref);

  const parImmeuble = {};
  (brut.locataires || []).forEach(l => {
    const id = l.immeubleId;
    if (!parImmeuble[id]) {
      parImmeuble[id] = {
        immeuble_id: id,
        nom: l.immeuble,
        dossier_onedrive: CONFIG.dossier_onedrive_par_immeuble[id] || null,
        unites: [],
      };
    }
    parImmeuble[id].unites.push({
      designation: l.unite,
      locataire: l.locataire || null,
      preneurs: decouperPreneurs(l.locataire),
      inoccupe: l.inoccupe === true,
    });
  });

  _locatairesCache = {
    genere_le: brut.genereLe || null,
    mois: brut.mois || null,
    immeubles: Object.values(parImmeuble),
    total_unites: (brut.locataires || []).length,
  };
  await journaliser("liste_locataires_chargee", {
    unites: _locatairesCache.total_unites,
    genere_le: _locatairesCache.genere_le,
  });
  return _locatairesCache;
}
