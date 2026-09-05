/* Recalage d'images — reconnaître le cadrage d'une photographie de référence

   Sert à la visée guidée : à la sortie, l'opérateur superpose la vue
   d'entrée au flux de la caméra, et ce noyau lui dit à quel point les deux
   coïncident.

   AUCUNE BIBLIOTHÈQUE. Huit mégaoctets d'OpenCV pour un score d'alignement
   serait disproportionné, et le téléchargement seul découragerait l'usage
   sur le terrain.

   ON COMPARE DES CONTOURS, PAS DES COULEURS. L'éclairage change entre
   l'entrée et la sortie — trois ans d'écart, une autre saison — mais les
   arêtes ne bougent pas. C'est indispensable ici pour une autre raison
   encore : le flux du navigateur ne reçoit pas le traitement d'image
   d'Apple, et rend des vues systématiquement plus claires que l'appareil
   natif. La documentation d'Apple le confirme : getUserMedia ne donne
   qu'un flux basique, sans le traitement du système.

   COPIÉ DU BANC D'ESSAI essai-recalage.html, version 3.3, éprouvé sur le
   terrain le 29/08/2026. Le calcul n'est pas réécrit : l'expérience a
   montré qu'une reformulation, même fidèle en apparence, introduit des
   écarts qu'on met des heures à retrouver.

   IL N'Y A PLUS DE RECHERCHE D'ÉCHELLE. Une campagne de calibration a
   établi que l'appareil natif et le flux ont le même champ de vision. Ce
   qu'on prenait pour un écart d'échelle venait d'un zoom de 1,30 imposé
   par mon propre code au banc d'essai. */

/* ============================================================
   VERSION — recalage 2.1 (05/09/2026)

   Porte dans l'application le banc d'essai essai-recalage.html
   version « essai 8.8 ». Le CALCUL n'a pas changé d'une ligne : Sobel,
   dilatation 3×3, pénalités de déplacement et d'échelle, section dorée
   sur 25-125 % étaient déjà identiques au banc. Ce qui arrive ici, ce
   sont les acquis des 03 et 05/09 :

     — la normalisation du contraste des deux images ;
     — le seuillage des contours faibles ;
     — le délai de mise en place, pendant lequel RIEN ne bouge ;
     — les deux phases exclusives : zoom de la CAMÉRA réglé à la main
       puis affiné, ensuite relais au zoom de la RÉFÉRENCE ;
     — l'échelle de départ à 65 % au lieu de 100.

   RIEN ICI NE TOUCHE À L'INTERFACE. Les valeurs arrivent par le bloc
   ci-dessous, l'état de la caméra par pisteVisee, et tout affichage
   passe par les deux rappels facultatifs surZoomCamera et
   surMessageVisee, que app.js pose s'il le veut.
   ============================================================ */
var RECALAGE_VERSION = "recalage 2.1";

/* 2.1 — trois corrections trouvées en vérifiant contre le banc lui-même :
     — la clé de la réserve de contours porte désormais le seuil et la
       normalisation, comme au banc ; sans eux, changer un réglage
       laissait les contours du réglage précédent ;
     — les gardes de phase ne jouent que si un pilote de zoom est en
       service. Sans ce test, essai-onedrive.html — qui charge ce fichier
       et n'appelle jamais ouvrirVisee — restait figé à 65 % ;
     — un appareil sans zoom réglable passe directement en phase
       référence. Il restait sinon en phase caméra pour toujours, donc à
       65 % jusqu'à la fin de la visée. */

/* ============================================================
   RÉGLAGES DU RECALAGE — RECOPIÉS DU BANC, VALEUR POUR VALEUR

   Chaque valeur porte la date et le fait qui la justifient. Le noyau
   n'en connaît pas d'autres.
   ============================================================ */
var RECALAGE = {
  /* Mise en place : l'opérateur se place et cale son zoom. Aucun réglage
     ne bouge pendant ce temps. Porté de 10 à 15 s le 03/09 : dix
     secondes ne suffisaient pas pour se placer ET régler le zoom. */
  delai_mise_en_place: 15000,

  /* ÉCHELLE DE DÉPART DU CALQUE, PENDANT LA MISE EN PLACE.

     Elle était à 100 %, donc la référence débordait de l'écran pendant
     les quinze secondes où l'opérateur est censé s'en servir pour se
     placer. 65 % est la moyenne des échelles mesurées le 05/09 sur des
     photographies prises à 1× : 58, 69 et 73 %. Ce n'est pas une valeur
     juste, c'est un point de départ plausible ; la recherche l'ajuste
     dès la fin de la mise en place. */
  echelle_depart: 65,

  /* Bande explorée autour du réglage manuel, et nombre de mesures.
     L'exploration large a été abandonnée le 03/09 : au-delà d'un facteur
     3, les mesures se contredisent — 18 % à 1,53 × puis 222 % à 6,48 ×
     avec des scores équivalents. */
  zone_zoom: 1.25,
  paliers_zone: 5,

  /* Seuil des contours faibles, en fraction du plus fort de l'image.
     Non linéaire, donc la corrélation de Pearson ne peut pas l'annuler. */
  seuil_contour: 0,

  /* Qualité JPEG de la photographie prise. Portée de 0,82 à 0,92 le
     03/09 : le plafond de résolution ayant sauté, le poids se tient par
     la qualité et non plus en jetant des pixels. */
  qualite_jpeg: 0.92,

  /* Normalisation du contraste des DEUX images avant Sobel. Les vues de
     sortie sont systématiquement plus claires que celles d'entrée, et le
     gradient suit le contraste. */
  normaliser: true,

  /* Au-delà de ce zoom, la référence ne montre qu'un morceau de pièce et
     retrouver le cadrage à main levée n'a plus de sens. */
  zoom_max_utile: 4
};

const TAILLE = 96;          // mesure de l'alignement
const TAILLE_ECH = 48;      // recherche de l'échelle — un essai y coûte
                            // 1,3 ms au lieu de 22

/* Réduit une image (tableau RGBA) en niveaux de gris à T×T. */
function reduireT(rgba, L, H, T) {
  const g = new Float32Array(T * T);
  for (let y = 0; y < T; y++) {
    const sy = Math.floor(y * H / T);
    for (let x = 0; x < T; x++) {
      const sx = Math.floor(x * L / T);
      const i = (sy * L + sx) * 4;
      g[y * T + x] = 0.299 * rgba[i] + 0.587 * rgba[i+1] + 0.114 * rgba[i+2];
    }
  }
  return NORMALISER ? normaliserContraste(g) : g;
}

/* POURQUOI L'ACCENTUATION LINÉAIRE NE POUVAIT RIEN FAIRE.

   Elle multipliait le contraste de la référence par un facteur. Or la
   chaîne est linéaire de bout en bout : Sobel est linéaire, et le score
   est un coefficient de corrélation de Pearson, qui est INVARIANT par
   changement d'échelle. Constaté au banc le 03/09 : curseur poussé à
   fond, aucun chiffre ne bouge.

   LE SEUIL, LUI, EST NON LINÉAIRE. En dessous d'une fraction du gradient
   le plus fort de l'image, le contour est mis à zéro : on retire le bruit
   de compression de la vignette sans toucher aux arêtes franches. Aucune
   normalisation ne peut annuler cela — on ne change pas l'amplitude, on
   supprime des points.

   Appliqué à la référence ET au flux : les deux images doivent subir le
   même traitement, sans quoi leurs cartes de contours ne sont plus
   comparables. */
function seuillerContours(c, fraction) {
  if (!(fraction > 0.001)) return c;
  const n = c.length;
  let max = 0;
  for (let i = 0; i < n; i++) if (c[i] > max) max = c[i];
  if (max <= 0) return c;
  const seuil = max * fraction;
  const r = new Float32Array(n);
  for (let i = 0; i < n; i++) r[i] = c[i] >= seuil ? c[i] : 0;
  return r;
}

/* NORMALISATION DU CONTRASTE, APPLIQUÉE AUX DEUX IMAGES.

   Mesuré et consigné : les photographies de sortie sont systématiquement
   plus claires que celles d'entrée — même lumière, même position, deux
   minutes d'écart, et l'écart demeure. Le traitement d'image d'Apple ne
   s'applique pas au flux du navigateur, et aucun réglage n'y remédie.

   Le gradient de Sobel étant proportionnel au contraste local, une image
   plus claire et plus plate rend des contours plus faibles, et la
   comparaison les compte comme absents. C'est une partie du 35 % du
   03/09, alors que les arêtes coïncidaient à l'œil.

   ATTENTION : appliqué aux DEUX, jamais à une seule — accentuer la
   référence seule lui donnerait un caractère de contours que le flux n'a
   pas, et le score baisserait au lieu de monter.

   L'étalement se fait sur les centiles 2 et 98, pas sur le minimum et le
   maximum : un seul pixel brûlé suffirait sinon à ruiner l'échelle. */
function normaliserContraste(g) {
  const n = g.length;
  const hist = new Int32Array(256);
  for (let i = 0; i < n; i++) hist[Math.max(0, Math.min(255, g[i] | 0))]++;
  const bas = Math.round(n * 0.02), haut = Math.round(n * 0.98);
  let acc = 0, p2 = 0, p98 = 255;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= bas) { p2 = v; break; }
  }
  acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= haut) { p98 = v; break; }
  }
  /* Une image sans contraste du tout : on la laisse telle quelle plutôt
     que d'amplifier son seul bruit. */
  if (p98 - p2 < 12) return g;
  const k = 255 / (p98 - p2);
  const r = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    r[i] = Math.max(0, Math.min(255, (g[i] - p2) * k));
  }
  return r;
}

/* Amplitude du gradient (Sobel). On compare des CONTOURS, pas des teintes :
   l'éclairage change entre l'entrée et la sortie, les arêtes non. */
function contoursT(g, T) {
  const c = new Float32Array(T * T);
  for (let y = 1; y < T - 1; y++) {
    for (let x = 1; x < T - 1; x++) {
      const i = y * T + x;
      const gx = -g[i-T-1] - 2*g[i-1] - g[i+T-1] + g[i-T+1] + 2*g[i+1] + g[i+T+1];
      const gy = -g[i-T-1] - 2*g[i-T] - g[i-T+1] + g[i+T-1] + 2*g[i+T] + g[i+T+1];
      c[i] = Math.sqrt(gx*gx + gy*gy);
    }
  }
  const cs = seuillerContours(c, SEUIL_CONTOUR);
  return DILATATION ? dilater(cs, T) : cs;
}

/* DILATATION MORPHOLOGIQUE DES GRADIENTS.

   Un contour de Sobel fait un pixel d'épaisseur. Deux images légèrement
   désalignées n'ont alors AUCUN pixel de contour en commun : la mesure de
   ressemblance ne monte qu'au dernier moment, son sommet est étroit, et
   elle reste plate partout ailleurs. C'est la cause du tremblement au
   voisinage de l'optimum : l'algorithme y navigue dans du bruit.

   En remplaçant chaque pixel par le maximum de son voisinage 3×3, les
   contours passent à cinq ou sept pixels d'épaisseur. Le sommet s'élargit
   d'autant, et la mesure devient monotone sur une plage utile. */
var DILATATION = true;
var NORMALISER = RECALAGE.normaliser;
var SEUIL_CONTOUR = RECALAGE.seuil_contour;

function dilater(c, T) {
  const d = new Float32Array(T * T);
  for (let y = 1; y < T - 1; y++) {
    for (let x = 1; x < T - 1; x++) {
      const i = y * T + x;
      let m = c[i];
      if (c[i-T-1] > m) m = c[i-T-1];
      if (c[i-T]   > m) m = c[i-T];
      if (c[i-T+1] > m) m = c[i-T+1];
      if (c[i-1]   > m) m = c[i-1];
      if (c[i+1]   > m) m = c[i+1];
      if (c[i+T-1] > m) m = c[i+T-1];
      if (c[i+T]   > m) m = c[i+T];
      if (c[i+T+1] > m) m = c[i+T+1];
      d[i] = m;
    }
  }
  return d;
}

function densiteContoursT(c, T) {
  let n = 0, somme = 0;
  for (let i = 0; i < c.length; i++) { somme += c[i]; if (c[i] > 40) n++; }
  return { part: n / c.length, moyenne: somme / c.length };
}

function correlationT(a, b, dx, dy, e, T) {
  let sa = 0, sb = 0, sab = 0, saa = 0, sbb = 0, n = 0;
  const centre = T / 2;
  for (let y = 4; y < T - 4; y += 2) {
    for (let x = 4; x < T - 4; x += 2) {
      const bx = Math.round(centre + (x - centre) / e + dx);
      const by = Math.round(centre + (y - centre) / e + dy);
      if (bx < 0 || by < 0 || bx >= T || by >= T) continue;
      const va = a[y * T + x], vb = b[by * T + bx];
      sa += va; sb += vb; sab += va * vb; saa += va * va; sbb += vb * vb; n++;
    }
  }
  if (n < 40) return 0;
  const num = sab - sa * sb / n;
  const den = Math.sqrt((saa - sa*sa/n) * (sbb - sb*sb/n));
  return den > 0 ? num / den : 0;
}

function chercherT(refC, fluxC, T) {
  let meilleur = { score: -1, brut: -1, dx: 0, dy: 0, e: 1 };
  const lim = Math.round(T / 7);
  const echelles = [0.85, 0.93, 1, 1.08, 1.18];
  for (const e of echelles) {
    for (let dy = -lim; dy <= lim; dy += 2) {
      for (let dx = -lim; dx <= lim; dx += 2) {
        const brut = correlationT(refC, fluxC, dx, dy, e, T);
        /* PÉNALITÉ DU DÉPLACEMENT.

           La fonction cherche le meilleur décalage sur ±13 pixels, ce qui
           représente plusieurs dizaines de centimètres dans une pièce. Sans
           pénalité forte, elle rend un score élevé en COMPENSANT le
           déplacement de l'opérateur : le 29/08, deux poêles visiblement
           côte à côte donnaient 69 % et un cadre vert.

           Le score doit dire « tu es au bon endroit », pas « les deux
           images se ressemblent quelque part ». À 0,022 par pixel, un
           déplacement de treize pixels coûte une trentaine de points — de
           quoi rendre le score honnête sans le rendre inexploitable.

           L'échelle garde sa propre pénalité : elle vaut 1, s'en écarter
           n'a pas lieu d'être. */
        const cout = (Math.abs(dx) + Math.abs(dy)) * 0.022
                   + Math.abs(Math.log(e)) * 0.15;
        const s = brut - cout;
        if (s > meilleur.score) meilleur = { score: s, brut, dx, dy, e, cout };
      }
    }
  }
  /* LE SCORE RENDU EST LE SCORE PÉNALISÉ.

     Il était auparavant remplacé par la corrélation brute — la pénalité ne
     servait qu'à choisir, jamais à juger. D'où des scores flatteurs sur des
     cadrages manifestement faux. */
  meilleur.score = Math.max(0, meilleur.brut - meilleur.cout);
  return meilleur;
}

/* Appels à la taille de travail. */
const reduire = (rgba, L, H) => reduireT(rgba, L, H, TAILLE);
const contours = (g) => contoursT(g, TAILLE);
const densiteContours = (c) => densiteContoursT(c, TAILLE);
const chercher = (a, b) => chercherT(a, b, TAILLE);

/* Traduit le décalage en consigne compréhensible. */
function conseil(m) {
  const t = [];
  if (m.e < 0.96) t.push("avance");
  else if (m.e > 1.04) t.push("recule");
  if (m.dx > 2) t.push("pivote à droite");
  else if (m.dx < -2) t.push("pivote à gauche");
  if (m.dy > 2) t.push("baisse");
  else if (m.dy < -2) t.push("relève");
  return t.length ? t.join(", ") : "alignement correct";
}

/* ---- La référence et sa mise à l'échelle -------------------------------

   L'ÉCHELLE VAUT 100 % ET N'EST PLUS CHERCHÉE. Le curseur subsiste dans
   l'écran de visée : la calibration porte sur un seul appareil, et rien
   n'exclut qu'un cas se présente où il faille corriger — une photographie
   d'entrée prise à l'ultra grand-angle, par exemple. On ne sait jamais. */

var ECHELLE_FIXE = 100;
var imageRefChargee = null;
var reserve = {};
var echelleRetenue = null;        // en pourcent, lissée
var echelleFigee = null;          // arrêtée dès qu'elle est convaincante
var echecs = 0;                   // analyses de suite sous le seuil

/* Contours de la référence à une échelle donnée, mis en réserve : ils ne
   changent pas tant que la photographie ne change pas. */
function contoursRef(pc, T) {
  /* LA CLÉ PORTE LES RÉGLAGES, PAS SEULEMENT L'ÉCHELLE.

     Sans eux, la réserve rendait les contours calculés au seuil
     précédent : changer le seuil ne changeait rien à l'écran, et on
     réglait à l'aveugle. Défaut relevé au banc le 03/09. */
  const cle = T + "|" + Math.round(pc * 10) + "|" + Math.round(SEUIL_CONTOUR * 1000) +
    "|" + (NORMALISER ? 1 : 0);
  if (reserve[cle]) return reserve[cle];
  if (!imageRefChargee) return null;
  const c = document.createElement("canvas");
  c.width = T; c.height = T;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  /* Au-dessus de 100 %, on rogne la référence en son centre ; en dessous,
     on la prend entière — c'est alors le FLUX qui est rogné. Jamais l'une
     réduite dans son coin : cela découvrirait du vide autour. */
  const z = Math.max(1, pc / 100);
  /* UNE IMAGE, UN CANEVAS ET UN BITMAP N'EXPOSENT PAS LES MÊMES PROPRIÉTÉS.

     Une balise <img> a naturalWidth et naturalHeight ; un canevas et un
     bitmap n'ont que width et height. Lire les premières sur un canevas
     donne une valeur indéfinie : le découpage échoue, les contours sortent
     vides, le score reste à zéro. C'est exactement ce qui a cassé le banc
     d'essai en version 3.5, et la réduction ci-dessus rend désormais un
     canevas. */
  const iw = imageRefChargee.naturalWidth || imageRefChargee.width;
  const ih = imageRefChargee.naturalHeight || imageRefChargee.height;
  const sw = iw / z, sh = ih / z;
  ctx.drawImage(imageRefChargee, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, T, T);
  const d = ctx.getImageData(0, 0, T, T).data;
  const r = contoursT(reduireT(d, T, T, T), T);
  reserve[cle] = r;
  return r;
}

/* Contours du flux, rognés en miroir de la référence. */
var _cvEch = null;
function contoursFluxT(v, dx, dy, cl, ch, pc, T) {
  if (!_cvEch || _cvEch.width !== T) {
    _cvEch = document.createElement("canvas");
    _cvEch.width = T; _cvEch.height = T;
    _cvEch.ctx = _cvEch.getContext("2d", { willReadFrequently: true });
  }
  const z = Math.max(1, 100 / pc);
  const fl = Math.round(cl / z), fh = Math.round(ch / z);
  const fx = dx + Math.round((cl - fl) / 2), fy = dy + Math.round((ch - fh) / 2);
  _cvEch.ctx.drawImage(v, fx, fy, fl, fh, 0, 0, T, T);
  const px = _cvEch.ctx.getImageData(0, 0, T, T).data;
  return contoursT(reduireT(px, T, T, T), T);
}

/* ---- RECHERCHE DE L'ÉCHELLE PAR SECTION DORÉE -------------------------

   L'ancienne méthode balayait un pas fixe puis se contentait d'un
   voisinage : elle ne convergeait jamais et restait prisonnière d'un
   mauvais réglage. La section dorée, elle, réduit l'intervalle d'un
   facteur 0,618 à chaque tour et converge en une douzaine d'essais,
   quelle que soit la valeur cherchée.

   L'ÉCHELLE SE PARCOURT EN LOGARITHME. Un pas fixe de 8 % vaut 16 %
   d'écart relatif à 50 et 5,6 % à 142 : on chercherait finement là où ça
   ne sert à rien. En logarithme, un pas vaut le même rapport partout. */
const PHI = (Math.sqrt(5) - 1) / 2;
/* PLAGE 25 À 125 %, validée au banc d'essai le 30/08/2026.

   AU-DESSUS DE 100, ELLE NE SERT À RIEN : une échelle supérieure
   signifierait que la référence embrasse PLUS que le flux, donc qu'on a
   dézoomé en photographiant. Personne ne dézoome pour un état des lieux.
   On garde 125 pour absorber les écarts de position.

   EN DESSOUS, IL EN FAUT PLUS : l'opérateur zoome souvent, et un zoom de
   2× à la prise demande une échelle de 50 % — soit exactement l'ancienne
   borne, d'où les échecs constatés. On descend à 25 %, ce qui couvre
   jusqu'à un zoom de 4×.

   POURQUOI PAS PLUS BAS. Une plage de 10 à 125 a été essayée : le zoom
   s'est mis à bouger très fort. Douze fois plus d'échelles, c'est douze
   fois plus d'endroits où deux images sans rapport se ressemblent par
   hasard. Au-delà de 4×, la visée guidée ne s'applique pas — l'opérateur
   reprend la photographie à vue. */
const L_MIN = Math.log(25), L_MAX = Math.log(125);

function sectionDoree(evaluer, precision, nAmorce, autour) {
  /* Amorce : quelques points régulièrement espacés en logarithme, pour
     encadrer le maximum. La section dorée l'exige — elle ne converge que
     si le point du milieu bat ses deux voisins. */
  /* AUTOUR DE LA VALEUR PRÉCÉDENTE quand on en a une. Repartir de zéro à
     chaque image faisait atterrir la recherche un peu ailleurs à chaque
     fois : le zoom sautait et la superposition avec. */
  let lo = L_MIN, hi = L_MAX;
  if (autour) {
    const la = Math.log(autour);
    lo = Math.max(L_MIN, la - Math.log(1.18));
    hi = Math.min(L_MAX, la + Math.log(1.18));
  }
  const pts = [];
  for (let i = 0; i < nAmorce; i++) {
    const l = lo + (hi - lo) * i / (nAmorce - 1);
    pts.push({ l, v: evaluer(Math.exp(l)) });
  }
  let k = 0;
  for (let i = 1; i < pts.length; i++) if (pts[i].v > pts[k].v) k = i;
  let a = pts[Math.max(0, k - 1)];
  let b = pts[k];
  let c = pts[Math.min(pts.length - 1, k + 1)];
  let essais = nAmorce;

  const cible = Math.log(1 + precision);
  while (c.l - a.l > cible && essais < 30) {
    let x;
    if (c.l - b.l > b.l - a.l) {
      x = { l: b.l + (1 - PHI) * (c.l - b.l) };
      x.v = evaluer(Math.exp(x.l)); essais++;
      if (x.v > b.v) { a = b; b = x; } else { c = x; }
    } else {
      x = { l: b.l - (1 - PHI) * (b.l - a.l) };
      x.v = evaluer(Math.exp(x.l)); essais++;
      if (x.v > b.v) { c = b; b = x; } else { a = x; }
    }
  }
  return { echelle: Math.exp(b.l), score: b.v, essais };
}

/* ============================================================
   MISE EN PLACE, PHASES ET ZOOM DE LA CAMÉRA — PORTÉ DU BANC

   Rien de tout cela ne lit ni n'écrit dans le document. La piste vidéo
   arrive par ouvrirVisee ; l'affichage, s'il en faut un, passe par les
   deux rappels ci-dessous.
   ============================================================ */

/* Rappels facultatifs, posés par app.js. Laissés à null, le noyau
   fonctionne exactement pareil, en silence. */
var surZoomCamera = null;     // (valeur en ×) -> l'app met son curseur à jour
var surMessageVisee = null;   // (texte, "ok"|"attention") -> l'app affiche

function direVisee(t, c) { if (surMessageVisee) surMessageVisee(t, c); }

var pisteVisee = null;        // MediaStreamTrack de la visée en cours
var phaseVisee = "camera";    // "camera" puis "reference" — jamais les deux
var balayageEnCours = false, balayageFait = false;
var viseeClose = false;       // vraie dès qu'une photographie est prise

var zoomCamAuto = true;       // l'affinage a-t-il le droit d'agir
var zoomCamOccupe = false;    // un applyConstraints est en cours
var zoomCamValeur = 1;        // dernière valeur appliquée
var zoomCamBornes = null;     // { min, max } de l'appareil
var zoomCamPlainte = false;   // le refus a-t-il déjà été signalé

/* DÉLAI DE MISE EN PLACE.

   Les journaux du 02/09 le justifient : l'affinage partait dès
   l'allumage, pendant que l'opérateur cherchait encore sa place. Il
   mesurait donc un cadrage qui n'avait pas de sens, retenait un palier
   faux, et il fallait tout reprendre.

   Quinze secondes pendant lesquelles RIEN ne bouge : ni le zoom de la
   caméra, ni celui de la référence. Ensuite seulement l'affinage démarre,
   puis le relais passe à la référence. */
var DELAI_MISE_EN_PLACE = RECALAGE.delai_mise_en_place;

/* UNE SEULE SOURCE DE VÉRITÉ : l'instant de fin. Tout le reste s'en
   déduit, et c'est la boucle d'analyse qui rafraîchit l'affichage — elle
   tourne dix fois par seconde tant que la caméra est allumée. Trois
   écritures appuyées sur des minuteurs ont échoué avant celle-ci, le
   chronomètre restant bloqué sur 1. */
var misePlace = { fin: 0 };

function attenteEnCours() {
  return misePlace.fin > 0 && performance.now() < misePlace.fin;
}

/* Reste à afficher, en secondes entières. Zéro quand il n'y a plus rien
   à attendre : c'est ce que l'app teste pour masquer son chronomètre. */
function resteMisePlace() {
  const reste = misePlace.fin - performance.now();
  if (reste <= 0) { misePlace.fin = 0; return 0; }
  return Math.ceil(reste / 1000);
}

function demarrerMisePlace() {
  /* GARDE CONTRE LE DOUBLE DÉPART : un second appel dans la seconde qui
     suit ne prolonge plus le compte à rebours. */
  const maintenant = performance.now();
  if (misePlace.fin > 0 &&
      (misePlace.fin - maintenant) > DELAI_MISE_EN_PLACE - 1000) return;
  misePlace.fin = maintenant + DELAI_MISE_EN_PLACE;
}

function arreterMisePlace() { misePlace.fin = 0; }

/* Pose le zoom sans rien écrire : l'affinage en fait cinq d'affilée. */
async function poserZoomBrut(z) {
  const b = zoomCamBornes || { min: 1, max: 1 };
  const cible = Math.min(b.max, Math.max(b.min, z));
  if (!pisteVisee) return false;
  try {
    zoomCamOccupe = true;
    await pisteVisee.applyConstraints({ advanced: [{ zoom: cible }] });
    /* La piste met un quart de seconde à se reconfigurer, et l'exposition
       un peu plus : mesurer trop tôt note une image en transition. */
    await new Promise(r => setTimeout(r, 300));
    zoomCamValeur = cible;
    if (surZoomCamera) surZoomCamera(cible);
    return true;
  } catch (e) {
    return false;
  } finally {
    zoomCamOccupe = false;
  }
}

/* RECHERCHE DANS LA ZONE DU RÉGLAGE MANUEL.

   L'ancien balayage parcourait toute la plage de l'objectif, de 0,50 à
   10,00 ×, en seize paliers. Deux défauts établis les 02 et 03/09 :

     — plus la plage explorée est large, plus elle contient d'endroits où
       deux images sans rapport se ressemblent par hasard. L'essai de
       22:09 mesurait 18 % à 1,53 × puis 222 % à 6,48 ×, avec des scores
       équivalents : le score ne distinguait pas le vrai du faux ;
     — cinq secondes pendant lesquelles l'image saute sous les yeux de
       l'opérateur.

   Le réglage manuel supprime la question. L'opérateur cale le zoom
   pendant la mise en place ; il sait, lui, ce qu'il regarde. La recherche
   n'a plus qu'à affiner AUTOUR de cette valeur — jamais ailleurs. */
var ZONE_ZOOM = RECALAGE.zone_zoom;
var PALIERS_ZONE = RECALAGE.paliers_zone;

async function affinerZoomDansZone(v, dx, dy, cl, ch) {
  balayageEnCours = true;
  const b = zoomCamBornes || { min: 1, max: 1 };
  const depart = zoomCamValeur;
  const lo = Math.log(Math.max(b.min, depart / ZONE_ZOOM));
  const hi = Math.log(Math.min(b.max, depart * ZONE_ZOOM));

  const mesurer = () => {
    const r = contoursRef(100, TAILLE_ECH);
    if (!r) return 0;
    return chercherT(r, contoursFluxT(v, dx, dy, cl, ch, 100, TAILLE_ECH),
                     TAILLE_ECH).score;
  };

  let best = { z: depart, s: -1 };
  direVisee("Réglage retenu : " + depart.toFixed(2) + " × — affinage de " +
    Math.exp(lo).toFixed(2) + " à " + Math.exp(hi).toFixed(2) + " ×.", "ok");

  for (let i = 0; i < PALIERS_ZONE; i++) {
    const z = PALIERS_ZONE > 1
      ? Math.exp(lo + (hi - lo) * i / (PALIERS_ZONE - 1))
      : depart;
    if (!(await poserZoomBrut(z))) continue;
    const sc = mesurer();
    if (sc > best.s) best = { z, s: sc };
  }

  await poserZoomBrut(best.z);
  direVisee("Zoom caméra calé à " + best.z.toFixed(2) + " × (" +
    Math.round(best.s * 100) + " %) — le zoom de la RÉFÉRENCE prend la suite.",
    "ok");
  balayageFait = true; balayageEnCours = false;

  /* LE RELAIS EST INCONDITIONNEL.

     Il ne dépend plus d'un seuil de score. L'objectif est calé, sa part du
     travail est faite : le reste est du ressort de l'échelle, quel que
     soit le score atteint. Le seuil de 30 % laissait la phase caméra
     s'éterniser sur les sujets peu contrastés. */
  phaseVisee = "reference";
  echelleFigee = null; echelleRetenue = null; echecs = 0;
}

/* Le pilote, appelé à chaque analyse. Il ne fait rien la plupart du
   temps — c'est voulu. */
function piloterZoomCamera(v, dx, dy, cl, ch) {
  if (!zoomCamAuto) return;

  /* CHAQUE REFUS SE DIT. Un pilote qui ne fait rien en silence est
     indébogable à distance. */
  if (!zoomCamBornes) {
    if (!zoomCamPlainte) {
      zoomCamPlainte = true;
      direVisee("Cet appareil ne laisse pas régler le zoom depuis le " +
        "navigateur : sers-toi du zoom de la référence.", "attention");
    }
    return;
  }
  if (zoomCamOccupe) return;
  if (viseeClose) return;
  if (attenteEnCours()) return;
  /* Phase référence : l'objectif est figé, on ne le touche plus. */
  if (phaseVisee !== "camera") return;
  if (balayageEnCours) return;

  if (!balayageFait) affinerZoomDansZone(v, dx, dy, cl, ch);
}

/* Remet toute la visée à zéro et prend la main sur la piste vidéo.
   Appelée à chaque allumage de la caméra, et à chaque « Refaire ». */
async function ouvrirVisee(piste) {
  pisteVisee = piste || null;
  phaseVisee = "camera";
  balayageFait = false; balayageEnCours = false;
  zoomCamOccupe = false; zoomCamPlainte = false;
  viseeClose = false;
  echelleFigee = null; echelleRetenue = null; echecs = 0;

  const cap = (pisteVisee && pisteVisee.getCapabilities)
    ? pisteVisee.getCapabilities() : {};
  if (cap && cap.zoom) {
    zoomCamAuto = true;
    zoomCamBornes = { min: cap.zoom.min, max: cap.zoom.max };
    zoomCamValeur = (pisteVisee.getSettings().zoom) || 1;
    /* ON PART DU PLUS LARGE : zoom caméra au minimum de l'appareil.
       C'est de là que l'opérateur monte à la main. */
    await poserZoomBrut(cap.zoom.min);
  } else {
    /* AUCUN ZOOM RÉGLABLE — ON NE RESTE PAS EN PHASE CAMÉRA.

       Le pilote sortirait à chaque analyse faute de bornes, l'affinage
       ne se ferait jamais, le relais non plus, et l'échelle resterait
       collée à 65 % jusqu'à la fin de la visée. Vérifié le 05/09 : elle
       l'était. Sur un tel appareil il n'y a rien à piloter, donc la
       référence prend la main tout de suite. */
    zoomCamAuto = false;
    zoomCamBornes = null;
    zoomCamValeur = 1;
    phaseVisee = "reference";
    balayageFait = true;
  }
  demarrerMisePlace();
  return zoomCamBornes;
}

/* LA PRISE CLÔT LA VISÉE.

   Constaté au banc le 03/09 : la photographie prise à 82 %, l'opérateur
   baisse l'appareil, l'alignement s'effondre — et l'affinage repart pour
   parcourir des paliers qui rendent tous 0 %. Une fois la photographie
   faite, il n'y a plus rien à viser. */
function fermerVisee() {
  viseeClose = true;
  arreterMisePlace();
  pisteVisee = null;
}

/* SEULE ADAPTATION PAR RAPPORT AU BANC D'ESSAI.

   L'original lisait trois réglages directement à l'écran :
     if (!$("recherche-echelle").checked) return 100;
     if (!$("echelle-auto").checked) return Number($("zoom-ref").value);
   L'application n'a pas ces éléments : les valeurs arrivent en paramètre.
   Le calcul, lui, n'est pas touché d'une ligne.

   La recherche a été validée sur le terrain le 29/08/2026, avec les
   contours dilatés : échelle stable autour de 100 %, étendue verte. */
function chercherEchelle(v, dx, dy, cl, ch, active, echelleManuelle) {
  /* UN SEUL MÉCANISME À LA FOIS.

     Le zoom caméra et le zoom de la référence corrigent le même écart par
     deux moyens différents : l'un change le champ capté, l'autre la
     taille de l'image affichée. Actifs ensemble, ils se compensent — la
     recherche d'échelle rattrape ce que le zoom vient de corriger, et le
     zoom rattrape ce que l'échelle vient de faire. D'où les allers-
     retours du 02/09 et l'étendue 25 à 125 %, butée à butée.

     Deux phases exclusives, donc. Ces deux gardes sont AVANT toute autre
     condition : pendant la mise en place et pendant la phase caméra,
     l'échelle reste à sa valeur de départ, quoi qu'on lui demande.

     ELLES NE VALENT QUE SI UN PILOTE EST EN SERVICE. pisteVisee n'est
     posée que par ouvrirVisee. Sans elle — le banc OneDrive, qui charge
     ce fichier et n'a pas de pilote de zoom — les gardes sont muettes et
     la recherche travaille normalement. Sans ce test, ce banc restait
     figé à 65 % pour toujours : vérifié le 05/09, il l'était. */
  if (pisteVisee && attenteEnCours()) return RECALAGE.echelle_depart;
  if (pisteVisee && zoomCamAuto && phaseVisee === "camera")
    return RECALAGE.echelle_depart;

  if (!active) return echelleManuelle || 100;
  if (echelleFigee) return echelleFigee;

  const evaluer = (pc) => {
    const r = contoursRef(pc, TAILLE_ECH);
    if (!r) return 0;
    return chercherT(r, contoursFluxT(v, dx, dy, cl, ch, pc, TAILLE_ECH),
                     TAILLE_ECH).score;
  };

  /* Amorce large quand on part de rien, resserrée autour de la valeur
     précédente sinon — l'opérateur ne saute pas d'une distance à l'autre. */
  const res = sectionDoree(evaluer, 0.02,
                           echelleRetenue === null ? 5 : 4, echelleRetenue);

  if (echelleRetenue === null) { echelleRetenue = res.echelle; return arrondi(); }

  /* NE PAS BOUGER POUR RIEN.

     Près du but, deux échelles voisines donnent des scores qui ne
     diffèrent que de quelques millièmes : c'est le bruit de mesure, pas
     une information. La section dorée continue pourtant à chercher jusqu'à
     sa précision demandée, et se met à osciller entre des valeurs
     équivalentes — d'où le tremblement.

     On n'adopte donc la nouvelle échelle que si elle apporte un gain
     réel. C'est la même idée que la pénalité de complexité appliquée aux
     décalages : à résultat équivalent, on ne bouge pas. */
  const ancienScore = evaluer(echelleRetenue);
  const gain = res.score - ancienScore;
  if (gain < 0.02) return arrondi();      // le déplacement ne se justifie pas

  /* LISSAGE, d'autant plus fort que l'alignement est déjà bon : c'est
     près du but qu'il faut de la stabilité, et loin qu'il faut suivre. */
  const part = ancienScore > 0.55 ? 0.15 : 0.35;
  echelleRetenue = echelleRetenue * (1 - part) + res.echelle * part;
  return arrondi();

  function arrondi() {
    /* Un demi-point de résolution suffit : au-delà, on n'affiche que du
       bruit et le curseur s'agite sans que l'image change. */
    return Math.round(echelleRetenue * 2) / 2;
  }
}

/* Réduit la référence à une taille de travail, en gardant ses proportions.
   Rend un canevas, que drawImage accepte comme une image. */
function reduireSource(src, cote) {
  const L = src.naturalWidth || src.width;
  const H = src.naturalHeight || src.height;
  const f = Math.min(1, cote / Math.max(L, H));
  if (f >= 1) return src;
  const c = document.createElement("canvas");
  c.width = Math.round(L * f);
  c.height = Math.round(H * f);
  c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
  return c;
}

/* Remet la référence à neuf. La réserve contiendrait sinon les contours de
   la photographie précédente — le défaut constaté le 28/08.

   LA RÉFÉRENCE EST RÉDUITE UNE SEULE FOIS, à 512 pixels au plus grand côté.

   Chaque essai d'échelle redécoupait sinon l'image d'origine — 4284 × 5712,
   soit vingt-quatre millions de pixels. Mesuré sur le terrain le 29/08 :
   574 ms par analyse, deux images par seconde au lieu de dix.

   Tout finissant en 96 × 96, cette réduction ne coûte aucune précision et
   divise le travail par cent vingt-quatre. */
function poserReference(img) {
  imageRefChargee = reduireSource(img, 512);
  reserve = {};
  echelleRetenue = null;
  echelleFigee = null;
  echecs = 0;
}
