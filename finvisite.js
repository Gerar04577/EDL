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
function resumePourMake(visite, lien) {
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
    visit_id: V.edl_id || V.visit_id,
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
    bailleur_complet: nomBailleurComplet(V),
    bailleur_represente_par: (V.parties && V.parties.bailleur_represente_par) || "",
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
    /* Éléments imposés au courriel par l'expertise : identifiant, version,
       horodatage complet avec fuseau, empreinte du fichier. */
    version_doc: V.version_doc || "V1",
    horodatage_complet: horodatageComplet(V.date_signature || V.date_debut),
    objet_courriel: "Transmission de votre état des lieux signé — " +
      (V.bien.adresse_complete || V.bien.unite_source || "") + " — " +
      (V.edl_id || V.visit_id) + " " + (V.version_doc || "V1"),
    corps_courriel: corpsCourriel(V, lien || null),
    lien_photos: lien || "",
    nb_reserves: String(((V.reserves || []).length)),
    reserves: (V.reserves || []).map((r, i) =>
      (i + 1) + ". " + (r.auteur || "Le preneur") +
      (r.piece ? " — " + r.piece : "") + " : " + r.texte).join("\n"),
    comparaison_nom_fichier: (V.preuve && V.preuve.comparaison_nom_fichier) || "",
    comparaison_item_id: (V.preuve && V.preuve.comparaison_onedrive_item_id) || "",
    estimation_nettoyage: (V.chiffrage && V.chiffrage.estimation_nettoyage_heures != null)
      ? String(V.chiffrage.estimation_nettoyage_heures) : "",
    total_tvac: (V.chiffrage && V.chiffrage.total_tvac != null)
      ? String(V.chiffrage.total_tvac) : "",
  };
}

/* « Bailleur, représenté par X » — jamais l'inverse. */
function nomBailleurComplet(V) {
  const p = V.parties || {};
  if (!p.bailleur) return "";
  const feminin = /^(S\.?A\.?|S\.?P\.?R\.?L|S\.?R\.?L|SC)/i.test(p.bailleur.trim());
  return p.bailleur_represente_par
    ? p.bailleur + ", représenté" + (feminin ? "e" : "") + " par " + p.bailleur_represente_par
    : p.bailleur;
}

/* Lien de consultation vers le dossier de la visite — EDLE ou EDLS,
   jamais le dossier du locataire, qui contiendrait son bail.
   Lecture seule. Créé par l'application, qui est déjà connectée à
   OneDrive : aucun module Make supplémentaire. */
async function lienDossierVisite(visite) {
  const d = visite.bien || {};
  /* Le lien est créé au démarrage de la visite et figure au procès-verbal
     signé : on le reprend tel quel. */
  if (d.lien_photos) return d.lien_photos;
  /* Visite antérieure à la 2.5.0 : pas de sous-dossier Photos enregistré.
     On ne partage JAMAIS le dossier de la visite lui-même — il contient le
     fichier de données, avec le numéro de carte d'identité des signataires
     et les montants réclamés. */
  if (!d.dossier_photos_item_id) {
    await journaliser("lien_refuse", "visite sans sous-dossier Photos");
    return null;
  }
  const r = await creerLienPhotos(d.dossier_cible_drive_id, d.dossier_photos_item_id);
  return r.ok ? r.lien : null;
}

function horodatageComplet(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const m = -d.getTimezoneOffset();
  const signe = m >= 0 ? "+" : "-";
  const hh = String(Math.floor(Math.abs(m) / 60)).padStart(2, "0");
  const mm = String(Math.abs(m) % 60).padStart(2, "0");
  let zone = "";
  try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (_) {}
  if (zone === "UTC" || zone === "Etc/UTC") zone = "";
  return d.toLocaleDateString("fr-BE") + " à " + d.toLocaleTimeString("fr-BE") +
    " (" + (zone ? zone + ", " : "") + "UTC" + signe + hh + ":" + mm + ")";
}

/* Corps du courriel, repris de la formulation validée par l'expertise.
   Deux précautions de vocabulaire : on parle de TRANSMISSION d'un
   exemplaire, jamais de délivrance ; et l'envoi n'est jamais présenté
   comme la preuve d'une lecture par le destinataire. */
function corpsCourriel(V, lien) {
  const reserves = V.reserves || [];
  const nbPhotos = (V.photos || []).length;
  return [
    "Madame, Monsieur,",
    "",
    "Nous vous confirmons la clôture de l'" +
      (V.type === "EDLS" ? "état des lieux de sortie" : "état des lieux d'entrée") +
      " réalisé pour le bien situé :",
    (V.bien.adresse_complete || V.bien.unite_source || ""),
    "",
    "Vous trouverez en pièce jointe votre exemplaire électronique du rapport " +
      "finalisé et signé, comprenant les descriptions, relevés, observations et " +
      "photographies faisant partie du rapport présenté lors de sa validation.",
    "",
    lien
      ? "Les " + nbPhotos + " photographie(s) faisant partie du rapport sont " +
        "consultables à l'adresse suivante, en lecture seule :"
      : "",
    lien || "",
    lien
      ? "Chaque photographie est identifiée dans le rapport par son nom et son " +
        "empreinte, ce qui permet de vérifier à tout moment qu'elle correspond " +
        "bien à celle qui vous a été présentée."
      : "",
    lien ? "" : null,
    "Référence : " + (V.edl_id || V.visit_id),
    "Version : " + (V.version_doc || "V1"),
    "Date et heure de validation : " + horodatageComplet(V.date_signature),
    "Empreinte SHA-256 du fichier : " + ((V.preuve && V.preuve.hash_pdf_pv_sha256) || "—"),
    "",
    reserves.length
      ? reserves.length + " observation(s) et réserve(s) ont été consignées à votre " +
        "demande avant validation et figurent dans le rapport."
      : "Aucune observation ni réserve n'a été consignée avant validation.",
    "",
    "Le rapport signé ainsi que les éléments techniques associés à sa validation " +
      "et à sa transmission sont conservés afin de permettre, en cas de contestation, " +
      "de vérifier le contenu du rapport, son intégrité, la date de sa validation et " +
      "les circonstances de sa transmission, dans le respect des dispositions légales " +
      "applicables.",
    "",
    "Bien cordialement,",
    nomBailleurComplet(V),
  ].filter(x => x !== null).join("\n");
}

/* Envoi. Comme pour l'IA : champs de formulaire, aucun en-tête
   personnalisé, sinon le navigateur exige une requête préalable que
   Make ne traite pas. */
async function envoyerFinVisite(visite, options) {
  const cible = adresseFinVisite();
  if (!cible) throw new Error(
    "Aucune adresse enregistrée. Accueil → « Rapport et courriel ».");

  const o = options || {};
  /* Le lien est créé au moment de l'envoi, pas à la signature : il ne
     figure donc pas dans le document signé, qui doit rester intemporel. */
  /* Jamais de lien par défaut : le dossier contient le fichier de données
     de la visite. Il faut une demande explicite. */
  let lien = null;
  if (o.courriel !== false && o.lien !== false) {
    lien = await lienDossierVisite(visite);
  }
  const champs = resumePourMake(visite, lien);
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
