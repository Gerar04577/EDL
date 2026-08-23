/* EDL — Fin de visite

   Deux livrables, après la signature :
     — un rapport Word, modifiable, pour les corrections de forme
     — un courriel au locataire avec le procès-verbal en pièce jointe

   Les deux passent par un second scénario Make, EDL-FIN-VISITE. Il détient
   l'accès à la boîte d'envoi et le modèle Word : l'application, elle, ne
   conserve aucun identifiant de messagerie.

   Rien ici n'est bloquant. Un échec d'envoi ne remet pas en cause l'état
   des lieux : le PDF signé est déjà déposé, et c'est lui qui fait foi.
*/

var CLE_WEBHOOK_FIN = "edl_webhook_fin_visite";
var FIN_DELAI_MS = 60000;

function adresseFinVisite() {
  let locale = null;
  try { locale = localStorage.getItem(CLE_WEBHOOK_FIN); } catch (_) {}
  const source = (locale && locale.trim())
    ? locale
    : ((CONFIG.make && CONFIG.make.webhook_fin_visite) || "");
  return String(source).trim();
}

function enregistrerAdresseFinVisite(url) {
  try { localStorage.setItem(CLE_WEBHOOK_FIN, String(url || "").trim()); return true; }
  catch (_) { return false; }
}

function finVisiteDisponible() {
  return adresseFinVisite().length > 0;
}

/* Résumé transmis à Make. Volontairement plat : les modules de Make
   manipulent mal les structures imbriquées, et un champ par ligne se
   mappe sans effort dans le modèle Word. */
function resumePourMake(visite) {
  const V = visite;
  const sortie = V.type === "EDLS";
  const c = V.compteurs || {};
  const g = V.etat_general || {};

  const lignes = [];
  V.pieces.forEach(p => {
    const photos = V.photos.filter(x => x.rattachement === p.piece_id).length;
    if (!p.constatations.length && !photos) {
      lignes.push(p.libelle + " : rien à signaler.");
      return;
    }
    p.constatations.forEach(x => {
      const q = [x.etat, x.proprete].filter(Boolean)
        .map(y => String(y).replace(/_/g, " ")).join(", ");
      lignes.push(p.libelle + " : " + (x.texte || "") + (q ? " (" + q + ")" : ""));
    });
    if (photos) lignes.push(p.libelle + " — " + photos + " photographie(s).");
  });

  const cles = (typeof CLES_STANDARD !== "undefined" ? CLES_STANDARD : [])
    .map(k => {
      const n = (V.cles || {})[k.cle];
      return k.libelle + " : " + ((n === null || n === undefined) ? "sans objet" : n);
    }).join(" · ");

  return {
    action: "fin_visite",
    visit_id: V.visit_id,
    type: V.type,
    type_libelle: sortie ? "état des lieux de sortie" : "état des lieux d'entrée",
    immeuble: V.bien.immeuble || "",
    unite: V.bien.unite_source || "",
    adresse: V.bien.adresse_complete || V.bien.unite_source || "",
    dossier_drive_id: V.bien.dossier_cible_drive_id || "",
    dossier_item_id: V.bien.dossier_cible_item_id || "",
    date_visite: V.date_debut || "",
    date_signature: V.date_signature || "",
    bailleur: (V.parties && V.parties.bailleur) || "",
    operateur: V.operateur || "",
    preneurs: ((V.parties && V.parties.preneurs) || [])
      .map(x => x.nom_complet).join(" & "),
    destinataires: ((V.parties && V.parties.preneurs) || [])
      .map(x => x.email).filter(Boolean).join(","),
    nb_photos: String(V.photos.length),
    nb_constatations: String(V.pieces.reduce((n, p) => n + p.constatations.length, 0)),
    constatations: lignes.join("\n"),
    compteur_electricite: c.electricite
      ? [c.electricite.numero, c.electricite.bi_horaire
          ? "jour " + (c.electricite.index_jour ?? "—") + " / nuit " + (c.electricite.index_nuit ?? "—")
          : "index " + (c.electricite.index_unique ?? "—")].filter(Boolean).join(" — ")
      : "",
    compteur_eau: c.eau
      ? [c.eau.numero, "index " + (c.eau.index ?? "—")].filter(Boolean).join(" — ") : "",
    ista: (c.ista || []).map((x, i) =>
      "Répartiteur " + (i + 1) + " : R " + (x.index_r ?? "—") + ", 21 " + (x.index_21 ?? "—")).join(" · "),
    cles: cles,
    degats_locatifs: g.degats_locatifs
      ? (g.degats_locatifs.constate === true ? "oui" :
         g.degats_locatifs.constate === false ? "non" : "non précisé") : "",
    degats_commentaire: (g.degats_locatifs && g.degats_locatifs.commentaire) || "",
    proprete: g.proprete
      ? (g.proprete.propre === true ? "propre" :
         g.proprete.propre === false ? "à nettoyer" : "non précisé") : "",
    proprete_commentaire: (g.proprete && g.proprete.commentaire) || "",
    divers: V.divers || "",
    pv_nom_fichier: (V.preuve && V.preuve.pv_nom_fichier) || "",
    pv_item_id: (V.preuve && V.preuve.pv_onedrive_item_id) || "",
    pv_empreinte: (V.preuve && V.preuve.hash_pdf_pv_sha256) || "",
    comparaison_nom_fichier: (V.preuve && V.preuve.comparaison_nom_fichier) || "",
    comparaison_item_id: (V.preuve && V.preuve.comparaison_onedrive_item_id) || "",
    estimation_nettoyage: (V.chiffrage && V.chiffrage.estimation_nettoyage_heures != null)
      ? String(V.chiffrage.estimation_nettoyage_heures) : "",
    total_tvac: (V.chiffrage && V.chiffrage.total_tvac != null)
      ? String(V.chiffrage.total_tvac) : "",
  };
}

/* Envoi. Comme pour l'IA : champs de formulaire, aucun en-tête
   personnalisé, sinon le navigateur exige une requête préalable que
   Make ne traite pas. */
async function envoyerFinVisite(visite, options) {
  const cible = adresseFinVisite();
  if (!cible) throw new Error(
    "Aucune adresse enregistrée. Accueil → « Rapport et courriel ».");

  const champs = resumePourMake(visite);
  const o = options || {};
  champs.faire_rapport = o.rapport === false ? "non" : "oui";
  champs.faire_courriel = o.courriel === false ? "non" : "oui";
  champs.message = o.message || "";

  if (champs.faire_courriel === "oui" && !champs.destinataires) {
    throw new Error("Aucune adresse électronique de preneur. " +
      "Renseigne-la avant la signature, ou envoie le rapport seul.");
  }

  const corps = new URLSearchParams();
  Object.keys(champs).forEach(k => corps.append(k, String(champs[k] == null ? "" : champs[k])));

  const controleur = new AbortController();
  const minuterie = setTimeout(() => controleur.abort(), FIN_DELAI_MS);
  let res;
  try {
    res = await fetch(cible, { method: "POST", body: corps, signal: controleur.signal });
  } catch (e) {
    clearTimeout(minuterie);
    if (e.name === "AbortError")
      throw new Error("Le scénario n'a pas répondu en " + (FIN_DELAI_MS / 1000) + " secondes. " +
        "Il a peut-être abouti : vérifie dans Make avant de recommencer.");
    throw new Error("Réponse refusée par le navigateur. Vérifie que le module " +
      "« Webhook response » renvoie l'en-tête Access-Control-Allow-Origin.");
  }
  clearTimeout(minuterie);

  const texte = await res.text();
  if (!res.ok) throw new Error("Scénario : " + res.status + " — " + texte.slice(0, 200));

  await journaliser("fin_visite_envoyee", {
    visit_id: visite.visit_id,
    rapport: champs.faire_rapport,
    courriel: champs.faire_courriel,
    destinataires: champs.destinataires,
  });
  return nettoyerReponseIA(texte) || "Envoi accepté.";
}

/* Échantillon, pour que Make apprenne la structure : mêmes champs
   exactement que l'envoi réel. */
async function envoyerEchantillonFinVisite(url) {
  const cible = url || adresseFinVisite();
  if (!cible) throw new Error("Aucune adresse de scénario");
  const modele = {
    schema_version: "1.0", visit_id: "v_echantillon", type: "EDLS",
    date_debut: new Date().toISOString(), date_signature: new Date().toISOString(),
    operateur: "Échantillon",
    bien: { immeuble: "ÉCHANTILLON", unite_source: "STUDIO 1", adresse_complete: "—",
            dossier_cible_drive_id: "", dossier_cible_item_id: "" },
    parties: { bailleur: CONFIG.bailleur,
               preneurs: [{ nom_complet: "Échantillon", email: "echantillon@exemple.be" }] },
    pieces: [{ piece_id: "p1", libelle: "Séjour",
               constatations: [{ texte: "Exemple de constatation.",
                                 etat: "bon_etat", proprete: "propre" }] }],
    photos: [], compteurs: {}, equipements: {}, cles: {}, etat_general: {},
    divers: "", preuve: {}, chiffrage: {},
  };
  const champs = resumePourMake(modele);
  champs.faire_rapport = "oui";
  champs.faire_courriel = "non";
  champs.message = "";
  const corps = new URLSearchParams();
  Object.keys(champs).forEach(k => corps.append(k, String(champs[k] == null ? "" : champs[k])));
  const res = await fetch(cible, { method: "POST", body: corps });
  return { statut: res.status, corps: (await res.text()).slice(0, 300) };
}
