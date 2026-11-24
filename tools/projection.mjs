const SEMI_MAJOR = 6378137;
const ECCENTRICITY_SQUARED = 0.0066943799901413165;
const SECOND_ECCENTRICITY_SQUARED = ECCENTRICITY_SQUARED / (1 - ECCENTRICITY_SQUARED);
const SCALE = 0.9996;
const CENTRAL_MERIDIAN = (-9 * Math.PI) / 180;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export function projectEtrs89Utm29(lon, lat) {
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || lat < -80 || lat > 84) {
    throw new RangeError(
      'UTM input must be a finite longitude and a latitude from -80 to 84 degrees.',
    );
  }
  const phi = lat * DEG_TO_RAD;
  const lambda = lon * DEG_TO_RAD;
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const tanPhi = Math.tan(phi);
  const eccentricityFourth = ECCENTRICITY_SQUARED ** 2;
  const eccentricitySixth = ECCENTRICITY_SQUARED ** 3;
  const n = SEMI_MAJOR / Math.sqrt(1 - ECCENTRICITY_SQUARED * sinPhi ** 2);
  const t = tanPhi ** 2;
  const c = SECOND_ECCENTRICITY_SQUARED * cosPhi ** 2;
  const a = cosPhi * (lambda - CENTRAL_MERIDIAN);
  const meridionalArc =
    SEMI_MAJOR *
    ((1 -
      ECCENTRICITY_SQUARED / 4 -
      (3 * eccentricityFourth) / 64 -
      (5 * eccentricitySixth) / 256) *
      phi -
      ((3 * ECCENTRICITY_SQUARED) / 8 +
        (3 * eccentricityFourth) / 32 +
        (45 * eccentricitySixth) / 1024) *
        Math.sin(2 * phi) +
      ((15 * eccentricityFourth) / 256 + (45 * eccentricitySixth) / 1024) * Math.sin(4 * phi) -
      ((35 * eccentricitySixth) / 3072) * Math.sin(6 * phi));
  return {
    easting:
      500000 +
      SCALE *
        n *
        (a +
          ((1 - t + c) * a ** 3) / 6 +
          ((5 - 18 * t + t ** 2 + 72 * c - 58 * SECOND_ECCENTRICITY_SQUARED) * a ** 5) / 120),
    northing:
      SCALE *
      (meridionalArc +
        n *
          tanPhi *
          (a ** 2 / 2 +
            ((5 - t + 9 * c + 4 * c ** 2) * a ** 4) / 24 +
            ((61 - 58 * t + t ** 2 + 600 * c - 330 * SECOND_ECCENTRICITY_SQUARED) * a ** 6) / 720)),
  };
}

export function unprojectEtrs89Utm29(easting, northing) {
  const x = easting - 500000;
  const m = northing / SCALE;
  const mu =
    m /
    (SEMI_MAJOR *
      (1 -
        ECCENTRICITY_SQUARED / 4 -
        (3 * ECCENTRICITY_SQUARED ** 2) / 64 -
        (5 * ECCENTRICITY_SQUARED ** 3) / 256));
  const e1 = (1 - Math.sqrt(1 - ECCENTRICITY_SQUARED)) / (1 + Math.sqrt(1 - ECCENTRICITY_SQUARED));
  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const sinPhi = Math.sin(phi1);
  const cosPhi = Math.cos(phi1);
  const tanPhi = Math.tan(phi1);
  const n1 = SEMI_MAJOR / Math.sqrt(1 - ECCENTRICITY_SQUARED * sinPhi ** 2);
  const r1 =
    (SEMI_MAJOR * (1 - ECCENTRICITY_SQUARED)) / (1 - ECCENTRICITY_SQUARED * sinPhi ** 2) ** 1.5;
  const t1 = tanPhi ** 2;
  const c1 = SECOND_ECCENTRICITY_SQUARED * cosPhi ** 2;
  const d = x / (n1 * SCALE);
  const lat =
    phi1 -
    ((n1 * tanPhi) / r1) *
      (d ** 2 / 2 -
        ((5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * SECOND_ECCENTRICITY_SQUARED) * d ** 4) / 24 +
        ((61 +
          90 * t1 +
          298 * c1 +
          45 * t1 ** 2 -
          252 * SECOND_ECCENTRICITY_SQUARED -
          3 * c1 ** 2) *
          d ** 6) /
          720);
  const lon =
    CENTRAL_MERIDIAN +
    (d -
      ((1 + 2 * t1 + c1) * d ** 3) / 6 +
      ((5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * SECOND_ECCENTRICITY_SQUARED + 24 * t1 ** 2) *
        d ** 5) /
        120) /
      cosPhi;
  return { lon: lon * RAD_TO_DEG, lat: lat * RAD_TO_DEG };
}

export function projectedRegionBounds(origin, extentMeters) {
  const center = projectEtrs89Utm29(origin.lon, origin.lat);
  const half = extentMeters / 2;
  const corners = [
    unprojectEtrs89Utm29(center.easting - half, center.northing - half),
    unprojectEtrs89Utm29(center.easting - half, center.northing + half),
    unprojectEtrs89Utm29(center.easting + half, center.northing - half),
    unprojectEtrs89Utm29(center.easting + half, center.northing + half),
  ];
  return {
    south: Math.min(...corners.map((point) => point.lat)),
    west: Math.min(...corners.map((point) => point.lon)),
    north: Math.max(...corners.map((point) => point.lat)),
    east: Math.max(...corners.map((point) => point.lon)),
    origin: center,
  };
}
