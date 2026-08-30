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
  return DILATATION ? dilater(c, T) : c;
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
  const cle = T + "|" + Math.round(pc * 10);
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

/* SEULE ADAPTATION PAR RAPPORT AU BANC D'ESSAI.

   L'original lisait trois réglages directement à l'écran :
     if (!$("recherche-echelle").checked) return 100;
     if (!$("echelle-auto").checked) return Number($("zoom-ref").value);
   L'application n'a pas ces éléments : les valeurs arrivent en paramètre.
   Le calcul, lui, n'est pas touché d'une ligne.

   La recherche a été validée sur le terrain le 29/08/2026, avec les
   contours dilatés : échelle stable autour de 100 %, étendue verte. */
function chercherEchelle(v, dx, dy, cl, ch, active, echelleManuelle) {
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
