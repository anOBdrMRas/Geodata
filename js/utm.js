/* Umrechnung WGS84/ETRS89 <-> UTM (Zone 32, wie im BayernAtlas) und Flächenberechnung. */
(function () {
  const a = 6378137.0;
  const f = 1 / 298.257222101; // GRS80
  const e2 = f * (2 - f);
  const ep2 = e2 / (1 - e2);
  const k0 = 0.9996;
  const rad = Math.PI / 180;

  function toUtm(lat, lon, zone = 32) {
    const lon0 = (zone * 6 - 183) * rad;
    const phi = lat * rad;
    const N = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
    const T = Math.tan(phi) ** 2;
    const C = ep2 * Math.cos(phi) ** 2;
    const A = Math.cos(phi) * (lon * rad - lon0);
    const M = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * phi
      - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * phi)
      + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * phi)
      - (35 * e2 ** 3 / 3072) * Math.sin(6 * phi));
    const e = k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * A ** 5 / 120) + 500000;
    const n = k0 * (M + N * Math.tan(phi) * (A ** 2 / 2 + (5 - T + 9 * C + 4 * C ** 2) * A ** 4 / 24
      + (61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * A ** 6 / 720));
    return { e, n };
  }

  // Fläche eines Rings [[lon,lat], ...] in m² (über UTM-Koordinaten, für Flurstücke ausreichend genau)
  function ringArea(ring) {
    let s = 0;
    const pts = ring.map(([lon, lat]) => toUtm(lat, lon));
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      s += p.e * q.n - q.e * p.n;
    }
    return Math.abs(s / 2);
  }

  function polygonArea(rings) {
    if (!rings || !rings.length) return 0;
    return rings.reduce((sum, r, i) => sum + (i === 0 ? 1 : -1) * ringArea(r), 0);
  }

  function geometryArea(geom) {
    if (!geom) return 0;
    if (geom.type === 'Polygon') return polygonArea(geom.coordinates);
    if (geom.type === 'MultiPolygon') return geom.coordinates.reduce((s, p) => s + polygonArea(p), 0);
    return 0;
  }

  window.UTM = { toUtm, geometryArea };
})();
