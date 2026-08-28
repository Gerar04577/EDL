/* Recalage d'images — reconnaître le cadrage d'une photographie de référence

   Sert à la visée guidée : à la sortie, l'opérateur superpose la vue
   d'entrée au flux de la caméra, et ce noyau lui dit à quel point les
   deux coïncident.

   AUCUNE BIBLIOTHÈQUE. Huit mégaoctets d'OpenCV pour un score
   d'alignement serait disproportionné, et le téléchargement seul
   découragerait l'usage sur le terrain.

   ON COMPARE DES CONTOURS, PAS DES COULEURS. L'éclairage change entre
   l'entrée et la sortie — trois ans d'écart, une autre saison, un autre
   moment de la journée — mais les arêtes ne bougent pas. Mesuré : un
   écart de luminosité de 25 % ne fait pas varier le score d'un point.

   VALIDÉ SUR LE TERRAIN le 28/08/2026 : seuil de déclenchement à 60 %,
   atterrissage reproductible. Les murs des studios donnent 5 à 25 % de
   contours — plinthes, angles, prises — bien au-dessus du minimum
   nécessaire. */

const TAILLE = 96;   // côté de l'image de travail

/* Réduit une image (tableau RGBA) en niveaux de gris à TAILLE×TAILLE. */
function reduire(rgba, L, H) {
  const g = new Float32Array(TAILLE * TAILLE);
  for (let y = 0; y < TAILLE; y++) {
    const sy = Math.floor(y * H / TAILLE);
    for (let x = 0; x < TAILLE; x++) {
      const sx = Math.floor(x * L / TAILLE);
      const i = (sy * L + sx) * 4;
      g[y * TAILLE + x] = 0.299 * rgba[i] + 0.587 * rgba[i+1] + 0.114 * rgba[i+2];
    }
  }
  return g;
}

/* Amplitude du gradient (Sobel). On compare des CONTOURS, pas des teintes :
   l'éclairage change entre l'entrée et la sortie, les arêtes non. */
function contours(g) {
  const c = new Float32Array(TAILLE * TAILLE);
  for (let y = 1; y < TAILLE - 1; y++) {
    for (let x = 1; x < TAILLE - 1; x++) {
      const i = y * TAILLE + x;
      const gx = -g[i-TAILLE-1] - 2*g[i-1] - g[i+TAILLE-1]
                 + g[i-TAILLE+1] + 2*g[i+1] + g[i+TAILLE+1];
      const gy = -g[i-TAILLE-1] - 2*g[i-TAILLE] - g[i-TAILLE+1]
                 + g[i+TAILLE-1] + 2*g[i+TAILLE] + g[i+TAILLE+1];
      c[i] = Math.sqrt(gx*gx + gy*gy);
    }
  }
  return c;
}

/* Densité de contours : dit si l'image offre de quoi s'accrocher.
   Un mur beige uniforme donne une valeur très basse — et le score
   d'alignement n'y voudra rien dire. */
function densiteContours(c) {
  let n = 0, somme = 0;
  for (let i = 0; i < c.length; i++) { somme += c[i]; if (c[i] > 40) n++; }
  return { part: n / c.length, moyenne: somme / c.length };
}

/* Corrélation croisée normalisée entre deux cartes de contours, la
   seconde décalée de (dx, dy) et mise à l'échelle e. */
function correlation(a, b, dx, dy, e) {
  let sa = 0, sb = 0, sab = 0, saa = 0, sbb = 0, n = 0;
  const centre = TAILLE / 2;
  for (let y = 4; y < TAILLE - 4; y += 2) {
    for (let x = 4; x < TAILLE - 4; x += 2) {
      const bx = Math.round(centre + (x - centre) / e + dx);
      const by = Math.round(centre + (y - centre) / e + dy);
      if (bx < 0 || by < 0 || bx >= TAILLE || by >= TAILLE) continue;
      const va = a[y * TAILLE + x], vb = b[by * TAILLE + bx];
      sa += va; sb += vb; sab += va * vb; saa += va * va; sbb += vb * vb; n++;
    }
  }
  if (n < 100) return 0;
  const num = sab - sa * sb / n;
  const den = Math.sqrt((saa - sa*sa/n) * (sbb - sb*sb/n));
  return den > 0 ? num / den : 0;
}

/* Cherche le meilleur alignement dans une plage volontairement étroite :
   on guide un geste, on ne recale pas un scanner. */
function chercher(refC, fluxC) {
  let meilleur = { score: -1, brut: -1, dx: 0, dy: 0, e: 1 };
  const echelles = [0.85, 0.93, 1, 1.08, 1.18];
  for (const e of echelles) {
    for (let dy = -14; dy <= 14; dy += 2) {
      for (let dx = -14; dx <= 14; dx += 2) {
        const brut = correlation(refC, fluxC, dx, dy, e);
        /* PÉNALITÉ DE COMPLEXITÉ. Sans elle, plusieurs transformations
           très différentes obtiennent des scores voisins, et le bruit
           décide : un décalage vertical se voyait annoncé comme « avance,
           pivote à droite ». On préfère donc, à score égal, la
           transformation la plus simple — celle qui bouge le moins. */
        const cout = (Math.abs(dx) + Math.abs(dy)) * 0.004
                   + Math.abs(Math.log(e)) * 0.15;
        const s = brut - cout;
        if (s > meilleur.score) meilleur = { score: s, brut, dx, dy, e };
      }
    }
  }
  /* Le score rendu est la corrélation réelle, pas la valeur pénalisée. */
  meilleur.score = meilleur.brut;
  return meilleur;
}

/* Traduit le décalage en consigne compréhensible. */
/* Les seuils sont en pixels de l'image de travail (96 de côté) : deux
   pixels y valent une vingtaine sur la photographie finale. */
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

