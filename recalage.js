/* Recalage d'images — reconnaître le cadrage d'une photographie de référence

   Sert à la visée guidée : à la sortie, l'opérateur superpose la vue
   d'entrée au flux de la caméra, et ce noyau lui dit à quel point les deux
   coïncident.

   AUCUNE BIBLIOTHÈQUE. Huit mégaoctets d'OpenCV pour un score d'alignement
   serait disproportionné, et le téléchargement seul découragerait l'usage
   sur le terrain.

   ON COMPARE DES CONTOURS, PAS DES COULEURS. L'éclairage change entre
   l'entrée et la sortie — trois ans d'écart, une autre saison — mais les
   arêtes ne bougent pas.

   CE FICHIER EST COPIÉ DU BANC D'ESSAI essai-recalage.html, version 2.2,
   éprouvé sur le terrain le 28/08/2026. Le calcul n'y a pas été réécrit :
   l'expérience de la journée a montré qu'une reformulation, même fidèle en
   apparence, introduit des écarts qu'on met des heures à retrouver.

   Deux fonctions seules diffèrent de l'original, et c'est signalé sur
   place : chercherEchelle et poserEchelleCalque, qui lisaient les réglages
   directement à l'écran et les reçoivent ici en paramètre. */

const TAILLE = 96;          // mesure de l'alignement
const TAILLE_ECH = 48;      // recherche de l'échelle

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
  return g;
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
  return c;
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
        /* Pénalité de complexité : à score égal, la transformation la plus
           simple gagne. Sans elle, le bruit décide entre plusieurs
           optima voisins et les consignes deviennent absurdes. */
        const cout = (Math.abs(dx) + Math.abs(dy)) * 0.004
                   + Math.abs(Math.log(e)) * 0.15;
        const s = brut - cout;
        if (s > meilleur.score) meilleur = { score: s, brut, dx, dy, e };
      }
    }
  }
  meilleur.score = meilleur.brut;
  return meilleur;
}

/* Les appels historiques, à la taille de mesure. */
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
const L_MIN = Math.log(50), L_MAX = Math.log(150);

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

/* ---- Recherche automatique de l'échelle --------------------------------

   Deux images du même lieu, prises par deux objectifs différents, ne
   coïncident qu'à une échelle près. On la cherche, au petit format, par
   section dorée. */
/* NON REPRIS DU BANC D'ESSAI : le décompte d'immobilité et la demande de
   mise au point. Ce sont des affaires d'écran, pas de calcul, et la
   fonction du banc d'essai référençait sa propre variable de caméra —
   inexistante ici. L'application les tient dans app.js, avec ses propres
   réglages. */

var echelleRetenue = null;        // en pourcent
var echelleFigee = null;          // arrêtée dès qu'elle est convaincante
var echecs = 0;
var imageRefChargee = null;

/* Contours de la référence à une échelle donnée, mis en réserve. */
var reserve = {};                 // clé : taille + "|" + pourcent
function contoursRef(pc, T) {
  const cle = T + "|" + Math.round(pc * 10);
  if (reserve[cle]) return reserve[cle];
  if (!imageRefChargee) return null;
  const c = document.createElement("canvas");
  c.width = T; c.height = T;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  /* Au-dessus de 100 %, on rogne la référence en son centre ; en dessous,
     on la prend entière — c'est alors le FLUX qui sera rogné. */
  const z = Math.max(1, pc / 100);
  const iw = imageRefChargee.naturalWidth, ih = imageRefChargee.naturalHeight;
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

/* Cherche l'échelle au PETIT format, puis mesure l'alignement au GRAND.
   C'est la pyramide : estimation au grossier, mesure au fin. */
/* SEULE LIGNE MODIFIÉE PAR RAPPORT AU BANC D'ESSAI.

   L'original lisait les réglages directement à l'écran :
     if (!$("echelle-auto").checked) return Number($("zoom-ref").value);
   Ici ils arrivent en paramètre, l'application n'ayant pas les mêmes
   éléments. Le calcul, lui, est inchangé. */
function chercherEchelle(v, dx, dy, cl, ch, auto, echelleManuelle) {
  if (!auto) return echelleManuelle;
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
