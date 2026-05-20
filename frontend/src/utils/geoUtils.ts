/**
 * Calculates the geodesic/approximate flat plane area of a GeoJSON Polygon.
 * Uses a Pune-centered equirectangular approximation which is highly accurate for local zones.
 */
export function calculatePolygonArea(geometry: any): number {
  if (!geometry) return 0;
  
  let coordinates: number[][][] | null = null;
  
  if (geometry.type === 'FeatureCollection') {
    const feature = geometry.features?.[0];
    if (feature && feature.geometry) {
      coordinates = feature.geometry.coordinates;
    }
  } else if (geometry.type === 'Feature') {
    if (geometry.geometry) {
      coordinates = geometry.geometry.coordinates;
    }
  } else if (geometry.type === 'Polygon') {
    coordinates = geometry.coordinates;
  }
  
  if (!coordinates || !coordinates[0] || coordinates[0].length < 3) return 0;
  
  const ring = coordinates[0];
  const R_lat = 111320; // meters per degree latitude
  const R_lng = 105530; // meters per degree longitude (approx at 18.5 lat)
  
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    const xi = ring[i][0] * R_lng;
    const yi = ring[i][1] * R_lat;
    const xj = ring[j][0] * R_lng;
    const yj = ring[j][1] * R_lat;
    area += xi * yj - xj * yi;
  }
  
  return Math.abs(area / 2.0); // area in square meters
}

/**
 * Formats square meters into a human-readable format (m², hectares, or km²).
 */
export function formatArea(squareMeters: number): string {
  if (squareMeters <= 0) return '0 m²';
  
  if (squareMeters < 10000) {
    return `${Math.round(squareMeters).toLocaleString()} m²`;
  } else if (squareMeters < 1000000) {
    return `${(squareMeters / 10000).toFixed(2)} hectares`;
  } else {
    return `${(squareMeters / 1000000).toFixed(2)} km²`;
  }
}
