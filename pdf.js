/* EDL — Procès-verbal en PDF

   Fabriqué dans le navigateur de l'iPhone, sans aucun service extérieur :
   le chemin de la signature ne doit dépendre de rien.

   Structure, reprise du rapport du géomètre-expert :
     1. Protocole de signature
     2. Informations du bien, parties, dates
     3. Constatations pièce par pièce, avec renvoi aux photos
     4. Relevé des compteurs
     5. Équipements, clés, état général
     6. Chiffrage, si activé
     7. Signatures et horodatage
*/

var PDF_MARGE = 18;
var PDF_LARGEUR = 210;
var PDF_HAUTEUR = 297;

/* Texte provisoire, À FAIRE RELIRE PAR UN AVOCAT avant tout usage réel.
   La clause mère doit figurer au bail ; ceci n'en est que le rappel. */
var PROTOCOLE_PROVISOIRE = [
  "Les parties conviennent expressément que le présent état des lieux est dressé " +
  "contradictoirement sur support numérique au moyen de l'application du bailleur.",
  "Elles reconnaissent que la signature manuscrite apposée sur l'écran tactile manifeste " +
  "leur consentement et constitue une signature au sens du Livre 8 du Code civil.",
  "Elles reconnaissent la date et l'heure figurant au présent document, ainsi que le fait " +
  "que les photographies référencées font partie intégrante de l'état des lieux.",
  "Le preneur reconnaît avoir pris connaissance de l'intégralité du document avant de le signer, " +
  "et accepte que sa transmission à l'adresse électronique qu'il a déclarée vaille communication.",
  "L'identité des signataires a été vérifiée sur présentation de la carte d'identité, " +
  "en présence des deux parties.",
];

function nouveauDocument() {
  const J = (typeof jspdf !== "undefined") ? jspdf : window.jspdf;
  return new J.jsPDF({ unit: "mm", format: "a4", compress: true });
}

function dateFr(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  /* Secondes comprises : l'horodatage applicatif doit être précis. */
  return d.toLocaleDateString("fr-BE") + " à " + d.toLocaleTimeString("fr-BE");
}

function libelleEtat(v) {
  return ({ neuf: "état neuf", bon_etat: "bon état", usage: "usagé", degrade: "dégradé" })[v] || null;
}
function libelleProprete(v) {
  return ({ propre: "propre", a_nettoyer: "à nettoyer", sale: "sale" })[v] || null;
}

/* Le générateur tient un curseur vertical et gère lui-même les sauts de page :
   sans cela, un long constat déborderait silencieusement hors de la feuille. */
function creerPlume(doc) {
  let y = PDF_MARGE;
  let page = 1;

  const place = (hauteur) => {
    if (y + hauteur > PDF_HAUTEUR - PDF_MARGE - 8) {
      doc.addPage(); page++; y = PDF_MARGE;
      return true;
    }
    return false;
  };

  return {
    get y() { return y; },
    set y(v) { y = v; },
    get page() { return page; },

    saut(h) { place(h || 0); y += (h || 4); },

    titre(texte) {
      place(14);
      doc.setFont("helvetica", "bold"); doc.setFontSize(13);
      doc.text(texte, PDF_MARGE, y); y += 6;
      doc.setDrawColor(31, 78, 95); doc.setLineWidth(0.4);
      doc.line(PDF_MARGE, y, PDF_LARGEUR - PDF_MARGE, y); y += 6;
      doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    },

    sousTitre(texte) {
      place(9);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11);
      doc.text(texte, PDF_MARGE, y); y += 6;
      doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    },

    paragraphe(texte, options) {
      const o = options || {};
      doc.setFont("helvetica", o.gras ? "bold" : "normal");
      doc.setFontSize(o.taille || 10);
      const largeur = PDF_LARGEUR - 2 * PDF_MARGE - (o.retrait || 0);
      const lignes = doc.splitTextToSize(String(texte == null ? "" : texte), largeur);
      lignes.forEach(l => {
        place(6);
        doc.text(l, PDF_MARGE + (o.retrait || 0), y);
        y += 4.8;
      });
      doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    },

    ligne(gauche, droite) {
      place(6);
      doc.setFontSize(10);
      doc.setTextColor(90); doc.text(String(gauche), PDF_MARGE, y);
      doc.setTextColor(0);
      const t = String(droite == null || droite === "" ? "—" : droite);
      doc.text(t, PDF_LARGEUR - PDF_MARGE, y, { align: "right" });
      y += 5.5;
    },

    filet() {
      place(4);
      doc.setDrawColor(220); doc.setLineWidth(0.2);
      doc.line(PDF_MARGE, y, PDF_LARGEUR - PDF_MARGE, y); y += 4;
    },
  };
}

async function genererPV(visite) {
  const doc = nouveauDocument();
  const p = creerPlume(doc);
  const V = visite;
  const sortie = V.type === "EDLS";

  // --- 1. En-tête et protocole -------------------------------------------
  p.titre(sortie ? "PROCÈS-VERBAL D'ÉTAT DES LIEUX DE SORTIE"
                 : "PROCÈS-VERBAL D'ÉTAT DES LIEUX D'ENTRÉE");
  p.paragraphe(V.bien.adresse_complete || V.bien.unite_source, { gras: true, taille: 11 });
  p.paragraphe(V.bien.immeuble + " — " + V.bien.unite_source);
  p.saut(4);

  p.sousTitre("Protocole de signature");
  (CONFIG.protocole && CONFIG.protocole.length ? CONFIG.protocole : PROTOCOLE_PROVISOIRE)
    .forEach(t => { p.paragraphe("• " + t, { retrait: 2 }); p.saut(1.5); });
  if (!CONFIG.protocole || !CONFIG.protocole.length) {
    p.saut(2);
    p.paragraphe("Texte provisoire, en attente de relecture juridique.",
                 { taille: 8, retrait: 2 });
  }
  p.saut(6);

  // --- 2. Parties et dates ------------------------------------------------
  p.sousTitre("Désignation des parties");
  p.ligne("Bailleur", V.parties.bailleur);
  if (V.parties.bailleur_represente_par) {
    const feminin = /^(S\.?A\.?|S\.?P\.?R\.?L|S\.?R\.?L|SC)/i.test(String(V.parties.bailleur).trim());
    p.ligne("Représenté" + (feminin ? "e" : "") + " par", V.parties.bailleur_represente_par);
  }
  (V.parties.preneurs || []).forEach((x, i) => {
    p.ligne("Preneur " + (i + 1), x.nom_complet);
    p.ligne("   Qualité", x.qualite || "Locataire");
    if (x.numero_carte_identite)
      p.ligne("   Carte d'identité n°", x.numero_carte_identite);
    p.ligne("   Identité vérifiée", x.identite_verifiee ? "oui, sur présentation de la carte" : "non");
    if (x.email) p.ligne("   Courriel", x.email);
  });
  p.filet();
  p.ligne("Date de la visite", dateFr(V.date_debut));
  p.ligne("Type", sortie ? "État des lieux de sortie" : "État des lieux d'entrée");
  p.saut(6);

  // --- 3. Notes liminaires ------------------------------------------------
  p.sousTitre("Notes liminaires");
  p.paragraphe(
    "Les constatations se limitent aux parties visibles et aux installations apparentes, " +
    "sans déplacement du mobilier ni investigation technique. Le fonctionnement des " +
    "canalisations, de l'installation de gaz, d'électricité et des conduits n'a pas été testé.");
  p.saut(2);
  p.paragraphe(
    "Repérage : les pièces sont désignées par rapport à la rue ; à l'intérieur d'une pièce, " +
    "les murs sont désignés depuis l'entrée — mur de face, de gauche, de droite, arrière.");
  p.saut(6);

  // --- 4. Constatations ---------------------------------------------------
  p.titre("Constatations");
  V.pieces.forEach(piece => {
    const photos = V.photos.filter(x => x.rattachement === piece.piece_id);
    p.sousTitre(piece.libelle);
    if (piece.constatations.length === 0 && photos.length === 0) {
      p.paragraphe("Rien à signaler.", { retrait: 2 });
    } else {
      piece.constatations.forEach(c => {
        const q = [libelleEtat(c.etat), libelleProprete(c.proprete)].filter(Boolean).join(", ");
        if (c.texte) p.paragraphe("• " + c.texte, { retrait: 2 });
        if (q) p.paragraphe(c.texte ? "  (" + q + ")" : "• " + q, { retrait: 2, taille: 9 });
        p.saut(1.5);
      });
      if (photos.length) {
        p.paragraphe(photos.length + " photographie" + (photos.length > 1 ? "s" : "") +
          " faisant partie du présent rapport :", { retrait: 2, taille: 8 });
        photos.forEach((x, n) => {
          p.paragraphe((n + 1) + ". " + x.nom_fichier +
            (x.empreinte_sha256 ? "  —  SHA-256 " + x.empreinte_sha256 : ""),
            { retrait: 4, taille: 7 });
        });
      }
    }
    p.saut(4);
  });

  // --- 5. Compteurs -------------------------------------------------------
  p.titre("Relevé des compteurs");
  const c = V.compteurs || {};
  if (c.electricite) {
    p.sousTitre("Électricité");
    p.ligne("Numéro", c.electricite.numero);
    if (c.electricite.bi_horaire) {
      p.ligne("Index jour", c.electricite.index_jour);
      p.ligne("Index nuit", c.electricite.index_nuit);
    } else {
      p.ligne("Index", c.electricite.index_unique);
    }
    const r = c.electricite.index_entree_rappel;
    if (sortie && r) {
      p.ligne("Index à l'entrée", c.electricite.bi_horaire
        ? [r.index_jour, r.index_nuit].filter(x => x != null).join(" / ")
        : r.index_unique);
    }
  }
  if (c.eau) {
    p.sousTitre("Eau");
    p.ligne("Numéro", c.eau.numero);
    p.ligne("Index", c.eau.index);
    if (sortie && c.eau.index_entree_rappel)
      p.ligne("Index à l'entrée", c.eau.index_entree_rappel.index);
  }
  if ((c.ista || []).length) {
    p.sousTitre("ISTA — à suivre avec décompte charges");
    c.ista.forEach((x, i) => {
      p.ligne("Répartiteur " + (i + 1) + (x.emplacement ? " — " + x.emplacement : ""), x.numero);
      p.ligne("   Index R", x.index_r);
      p.ligne("   Index 21", x.index_21);
    });
  }
  [["gaz", "Gaz"], ["mazout", "Mazout"]].forEach(([k, lib]) => {
    if (c[k]) { p.sousTitre(lib); p.ligne("Numéro", c[k].numero); p.ligne("Index", c[k].index); }
  });
  p.saut(6);

  // --- 6. Équipements, clés, état général ---------------------------------
  p.titre("Équipements, clés et état général");
  const e = V.equipements || {};
  p.ligne("Sonnette", e.sonnette && e.sonnette.etat === "fonctionnelle" ? "fonctionnelle"
        : e.sonnette && e.sonnette.etat === "hors_service" ? "hors service" : null);
  p.ligne("Détecteur de fumée", e.detecteur_fumee && e.detecteur_fumee.present === true ? "présent"
        : e.detecteur_fumee && e.detecteur_fumee.present === false ? "absent" : null);
  if (e.detecteur_fumee && e.detecteur_fumee.commentaire)
    p.paragraphe(e.detecteur_fumee.commentaire, { retrait: 2, taille: 9 });
  p.filet();

  p.sousTitre("Clés remises");
  (typeof CLES_STANDARD !== "undefined" ? CLES_STANDARD : []).forEach(k => {
    const n = (V.cles || {})[k.cle];
    p.ligne(k.libelle, (n === null || n === undefined) ? "sans objet" : n);
  });
  p.filet();

  const g = V.etat_general || {};
  p.sousTitre("État général");
  p.ligne("Dégâts locatifs constatés",
    g.degats_locatifs && g.degats_locatifs.constate === true ? "oui"
    : g.degats_locatifs && g.degats_locatifs.constate === false ? "non" : null);
  if (g.degats_locatifs && g.degats_locatifs.commentaire)
    p.paragraphe(g.degats_locatifs.commentaire, { retrait: 2, taille: 9 });
  p.ligne("Les lieux sont propres",
    g.proprete && g.proprete.propre === true ? "oui"
    : g.proprete && g.proprete.propre === false ? "non" : null);
  if (g.proprete && g.proprete.commentaire)
    p.paragraphe(g.proprete.commentaire, { retrait: 2, taille: 9 });

  if (V.divers) { p.filet(); p.sousTitre("Divers"); p.paragraphe(V.divers); }
  p.saut(6);

  // --- 6 ter. Version antérieure ------------------------------------------
  if (V.version_precedente) {
    p.titre("Version antérieure");
    p.paragraphe("Le présent document est la version " + (V.version_doc || "V2") +
      " de l'état des lieux référencé ci-dessus. Il rectifie la version " +
      V.version_precedente.version + ", signée le " +
      dateFr(V.version_precedente.date_signature) + ", qui demeure archivée et " +
      "n'a pas été modifiée.");
    if (V.version_precedente.empreinte)
      p.paragraphe("Empreinte SHA-256 de la version antérieure : " +
        V.version_precedente.empreinte, { taille: 8 });
    if (V.motif_version)
      p.paragraphe("Motif de la rectification : " + V.motif_version);
    p.saut(6);
  }

  // --- 6 bis. Observations et réserves ------------------------------------
  p.titre("Observations et réserves");
  const reserves = V.reserves || [];
  if (reserves.length === 0) {
    p.paragraphe("Le preneur, invité à faire consigner ses observations et réserves " +
      "avant la validation du présent état des lieux, a déclaré n'en avoir aucune.");
  } else {
    p.paragraphe("Les observations et réserves suivantes ont été consignées à la " +
      "demande de leur auteur, avant la validation du présent état des lieux :");
    p.saut(3);
    reserves.forEach((r, i) => {
      p.sousTitre((i + 1) + ". " + (r.auteur || "Le preneur") +
        (r.piece ? " — " + r.piece : ""));
      p.paragraphe(r.texte, { retrait: 2 });
      p.saut(2);
    });
  }
  p.saut(6);

  // --- 7. Chiffrage -------------------------------------------------------
  if (V.options && V.options.chiffrage_actif && V.chiffrage) {
    p.titre("Chiffrage");
    const ch = V.chiffrage;
    if (ch.total_degats != null) p.ligne("Dégâts", euro(ch.total_degats));
    if (ch.estimation_nettoyage_heures != null)
      p.ligne("Nettoyage estimé", ch.estimation_nettoyage_heures + " heures");
    if (ch.cout_nettoyage != null) p.ligne("Coût du nettoyage", euro(ch.cout_nettoyage));
    if (ch.chomage_locatif != null) p.ligne("Chômage locatif", euro(ch.chomage_locatif));
    if (ch.total_tvac != null) {
      p.filet();
      doc.setFont("helvetica", "bold");
      p.ligne("TOTAL TVAC", euro(ch.total_tvac));
      doc.setFont("helvetica", "normal");
    }
    p.saut(6);
  }

  // --- 8. Signatures ------------------------------------------------------
  const signataires = 1 + (V.parties.preneurs || []).length;
  const hauteurBloc = 40 + Math.ceil(signataires / 2) * 34;
  if (p.y + hauteurBloc > PDF_HAUTEUR - PDF_MARGE) { doc.addPage(); p.y = PDF_MARGE; }

  p.titre("Signatures");
  p.paragraphe("LU ET APPROUVÉ", { gras: true, taille: 12 });
  p.saut(2);
  p.paragraphe("Chaque signataire confirme avoir participé contradictoirement à l'état " +
    "des lieux, avoir pris connaissance du rapport qui lui est présenté ainsi que des " +
    "photographies qui en font partie, et avoir eu la possibilité de faire consigner ses " +
    "observations et réserves avant sa validation.");
  p.saut(2);
  p.paragraphe("En apposant sa signature ci-dessous, il manifeste sa volonté de valider le " +
    "présent état des lieux, sous réserve des observations et réserves qui y sont " +
    "expressément consignées.");
  p.saut(2);
  p.paragraphe("Le présent état des lieux fait partie intégrante du bail dont il ne peut " +
    "être dissocié. Chaque signataire reconnaît en recevoir un exemplaire.");
  p.saut(6);

  const blocs = [];
  blocs.push({ role: "Le bailleur",
               qualite: V.parties.bailleur_represente_par ? "Mandataire" : "Bailleur",
               nom: V.parties.bailleur_represente_par || V.parties.bailleur,
               image: (V.signatures || {}).bailleur });
  (V.parties.preneurs || []).forEach((x, i) => {
    blocs.push({ role: "Le preneur", qualite: x.qualite || "Locataire",
                 nom: x.nom_complet,
                 image: ((V.signatures || {}).preneurs || [])[i] });
  });

  const largeurBloc = (PDF_LARGEUR - 2 * PDF_MARGE - 8) / 2;
  blocs.forEach((b, i) => {
    const colonne = i % 2;
    if (colonne === 0 && i > 0) p.y += 34;
    if (p.y + 34 > PDF_HAUTEUR - PDF_MARGE) { doc.addPage(); p.y = PDF_MARGE; }
    const x = PDF_MARGE + colonne * (largeurBloc + 8);
    const y0 = p.y;
    doc.setFontSize(9); doc.setTextColor(90);
    doc.text(b.role + (b.qualite ? " — " + b.qualite : ""), x, y0);
    doc.setTextColor(0); doc.setFontSize(10);
    doc.text(String(b.nom || ""), x, y0 + 5);
    if (b.image) {
      try { doc.addImage(b.image, "PNG", x, y0 + 7, largeurBloc, 20); } catch (_) {}
    }
    doc.setDrawColor(150); doc.setLineWidth(0.3);
    doc.line(x, y0 + 28, x + largeurBloc, y0 + 28);
  });
  p.y += 34;

  p.saut(4);
  p.paragraphe("Document établi le " +
    dateFr(V.date_signature || new Date().toISOString()) + " (" + fuseau() + ")." +
    "  Référence : " + (V.edl_id || V.visit_id) + "  —  Version : " + (V.version_doc || "V1"),
    { taille: 8 });

  /* Les empreintes des photographies sont inscrites AU document : le
     SHA-256 du PDF les couvre donc, et l'on peut vérifier plus tard que
     les photographies produites sont bien celles présentées au signataire. */
  const avecEmpreinte = V.photos.filter(x => x.empreinte_sha256);
  if (avecEmpreinte.length) {
    p.saut(3);
    p.paragraphe("Les " + avecEmpreinte.length + " photographie(s) référencées " +
      "ci-dessus portent chacune une empreinte SHA-256 inscrite au présent document. " +
      "L'empreinte du présent fichier couvre donc l'ensemble : le rapport et " +
      "l'identification des photographies qui en font partie.", { taille: 8 });
  }

  // --- Pied de page sur chaque feuille ------------------------------------
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(140);
    doc.text(V.bien.unite_source + " — " + (sortie ? "EDLS" : "EDLE") + " — " +
             (V.edl_id || V.visit_id) + " " + (V.version_doc || "V1"),
             PDF_MARGE, PDF_HAUTEUR - 10);
    doc.text(i + " / " + total, PDF_LARGEUR - PDF_MARGE, PDF_HAUTEUR - 10, { align: "right" });
    doc.setTextColor(0);
  }

  return doc;
}

function fuseau() {
  const d = new Date();
  const m = -d.getTimezoneOffset();
  const signe = m >= 0 ? "+" : "-";
  const h = String(Math.floor(Math.abs(m) / 60)).padStart(2, "0");
  const mn = String(Math.abs(m) % 60).padStart(2, "0");
  let nom = "";
  try { nom = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (_) {}
  if (nom === "UTC" || nom === "Etc/UTC") nom = "";
  return (nom ? nom + ", " : "") + "UTC" + signe + h + ":" + mn;
}

function euro(v) {
  return Number(v).toFixed(2).replace(".", ",") + " €";
}

/* Empreinte du document : elle est inscrite au fichier de données et
   permet de prouver plus tard que le PDF n'a pas été retouché. */
async function empreinteSha256(donnees) {
  if (!(crypto && crypto.subtle)) return null;
  const buf = await crypto.subtle.digest("SHA-256", donnees);
  return Array.from(new Uint8Array(buf))
    .map(x => x.toString(16).padStart(2, "0")).join("");
}
