export const PLACES: { name: string; lat: number; lon: number }[] = [
  { name: 'Dubai', lat: 25.2048, lon: 55.2708 },
  { name: 'Paris', lat: 48.8566, lon: 2.3522 },
  { name: 'Tokyo', lat: 35.6762, lon: 139.6503 },
  { name: 'Sydney', lat: -33.8688, lon: 151.2093 },
  { name: 'Houston', lat: 29.7604, lon: -95.3698 },
  { name: 'Tromsø', lat: 69.6492, lon: 18.9553 },
  { name: 'Suva (Fiji)', lat: -18.1416, lon: 178.4419 },
];

const MIN_R = 10;
const MAX_R = 3000;

/** Radius slider is logarithmic: fine control near 50–500 km, still reaches 3 000 km. */
export const radiusToSlider = (km: number) =>
  (Math.log(km / MIN_R) / Math.log(MAX_R / MIN_R)) * 1000;
export const sliderToRadius = (s: number) => Math.round(MIN_R * (MAX_R / MIN_R) ** (s / 1000));
