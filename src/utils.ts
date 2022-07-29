import circleToPolygon from 'circle-to-polygon';

export const makeCircumscribedSquare: (
  lon: number,
  lat: number,
  radius: number
) => { east: number; south: number; north: number; west: number } = (
  lon: number,
  lat: number,
  radius: number
) => {
  const coordinates = [lon, lat]; //center of circle
  const squareSideLength = radius / (Math.sqrt(2) / 2); // in meters
  const numberOfEdges = 8; // for make square

  const polygon = circleToPolygon(coordinates, squareSideLength, numberOfEdges);

  const coords = polygon.coordinates[0];

  const uncertainty = 0.0001; // in radians ~30 meters

  return {
    east: coords[1][0] + uncertainty,
    south: coords[1][1] + uncertainty,
    west: coords[5][0] - uncertainty,
    north: coords[5][1] - uncertainty
  };
};
