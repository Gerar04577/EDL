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

const TAILLE = 96;          // côté de l'image de travail

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

/* Remet la référence à neuf. La réserve contiendrait sinon les contours de
   la photographie précédente — le défaut constaté le 28/08. */
function poserReference(img) {
  imageRefChargee = img;
  reserve = {};
}

/* ---- Redressement d'une image selon son orientation EXIF ---------------

   drawImage IGNORE LES MÉTADONNÉES EXIF, dont l'orientation. La
   documentation le dit sans détour, et signale que le comportement est
   particulièrement gênant sur iOS.

   Conséquence chez nous : la balise <img> affiche la photographie
   redressée — Safari respecte l'orientation par défaut sur mobile, et en
   tient compte jusque dans naturalWidth — tandis que le canevas la reçoit
   telle qu'elle est enregistrée, couchée ou retournée.

   L'affichage et l'analyse travaillaient donc sur deux images différentes.
   Le score ne voulait rien dire et la superposition paraissait décalée.

   Le banc d'essai y échappait : l'image venait de la pellicule par un
   sélecteur de fichier, et Safari la redresse avant de la fournir.

   On redresse donc une fois pour toutes, à l'ouverture, et tout le reste
   travaille ensuite sur une image sans ambiguïté. */

/* Lit l'orientation dans l'en-tête EXIF d'un JPEG. Rend 1 quand il n'y en
   a pas, ou quand le fichier n'est pas un JPEG — un aperçu Microsoft, par
   exemple, qui arrive déjà redressé. */
async function orientationExif(blob) {
  try {
    const vue = new DataView(await blob.slice(0, 128 * 1024).arrayBuffer());
    if (vue.byteLength < 4 || vue.getUint16(0) !== 0xFFD8) return 1;  // pas un JPEG
    let i = 2;
    while (i + 4 < vue.byteLength) {
      if (vue.getUint16(i) !== 0xFFE1) {           // on cherche le bloc APP1
        if ((vue.getUint16(i) & 0xFF00) !== 0xFF00) return 1;
        i += 2 + vue.getUint16(i + 2);
        continue;
      }
      const debut = i + 10;                         // après « Exif\0\0 »
      if (vue.getUint32(i + 4) !== 0x45786966) return 1;
      const gros = vue.getUint16(debut) === 0x4D4D; // ordre des octets
      const lireCourt = (o) => vue.getUint16(o, !gros);
      const lireLong = (o) => vue.getUint32(o, !gros);
      const ifd = debut + lireLong(debut + 4);
      const n = lireCourt(ifd);
      for (let k = 0; k < n; k++) {
        const t = ifd + 2 + k * 12;
        if (lireCourt(t) === 0x0112) return lireCourt(t + 8);
      }
      return 1;
    }
    return 1;
  } catch (_) { return 1; }
}

/* Applique l'orientation et rend une image redressée. Les valeurs 5 à 8
   font pivoter d'un quart de tour : largeur et hauteur s'échangent. */
function redresser(img, orientation) {
  if (!orientation || orientation === 1) return Promise.resolve(img);

  const quart = orientation >= 5;
  const L = img.naturalWidth, H = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = quart ? H : L;
  c.height = quart ? L : H;
  const ctx = c.getContext("2d");

  switch (orientation) {
    case 2: ctx.translate(L, 0); ctx.scale(-1, 1); break;
    case 3: ctx.translate(L, H); ctx.rotate(Math.PI); break;
    case 4: ctx.translate(0, H); ctx.scale(1, -1); break;
    case 5: ctx.rotate(0.5 * Math.PI); ctx.scale(1, -1); break;
    case 6: ctx.rotate(0.5 * Math.PI); ctx.translate(0, -H); break;
    case 7: ctx.rotate(0.5 * Math.PI); ctx.translate(L, -H); ctx.scale(-1, 1); break;
    case 8: ctx.rotate(-0.5 * Math.PI); ctx.translate(-L, 0); break;
  }
  ctx.drawImage(img, 0, 0);

  return new Promise((ok, ko) => {
    const r = new Image();
    r.onload = () => ok(r);
    r.onerror = () => ko(new Error("redressement impossible"));
    r.src = c.toDataURL("image/jpeg", 0.95);
  });
}
