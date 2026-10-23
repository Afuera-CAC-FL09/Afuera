/*
 * Port of Liljegren's WBGT v1.1 C code. Copyright © 2008, UChicago Argonne, LLC. All Rights Reserved.
 * This product includes software produced by UChicago Argonne, LLC under Contract No. DE-AC02-06CH11357
 * with the Department of Energy. Supplied "as is"; full license in tools/wbgt-oracle/wbgt.c.
 * Changed by the Afuera team (2026): TypeScript with 64-bit math, UTC input, null instead of -9999, no main().
 */

const PI = 3.1415926535897932;
const TWOPI = 6.2831853071795864;
const DEG_RAD = 0.017453292519943295;
const RAD_DEG = 57.295779513082323;

const SOLAR_CONST = 1367;
const STEFANB = 5.6696e-8;
const Cp = 1003.5;
const M_AIR = 28.97;
const M_H2O = 18.015;
const RATIO = (Cp * M_AIR) / M_H2O;
const R_GAS = 8314.34;
const R_AIR = R_GAS / M_AIR;
const Pr = Cp / (Cp + 1.25 * R_AIR);

const EMIS_WICK = 0.95;
const ALB_WICK = 0.4;
const D_WICK = 0.007;
const L_WICK = 0.0254;

const EMIS_GLOBE = 0.95;
const ALB_GLOBE = 0.05;
const D_GLOBE = 0.0508;

const EMIS_SFC = 0.999;
const ALB_SFC = 0.45;

const CZA_MIN = 0.00873;
const NORMSOLAR_MAX = 0.85;
const REF_HEIGHT = 2.0;
const MIN_SPEED = 0.13;
const CONVERGENCE = 0.02;
const MAX_ITER = 50;

export interface WbgtInput {
  /** Middle of the averaging period is computed from this; see avgMinutes. */
  time: Date;
  lat: number;
  lon: number;
  /** Global horizontal irradiance, W/m². */
  solar: number;
  /** Barometric pressure, hPa (mb). */
  pressure: number;
  /** Air temperature, °C. */
  tempC: number;
  /** Relative humidity, %. */
  rh: number;
  /** Wind speed, m/s, measured at windHeight. */
  windSpeed: number;
  /** Height of the wind measurement, m. Open-Meteo reports 10 m. */
  windHeight: number;
  /** Averaging period before `time`; Open-Meteo hourly data is 60. */
  avgMinutes?: number;
  /** Night-time stability input, °C. 0 is the cautious default. */
  dT?: number;
  urban?: boolean;
}

export interface WbgtResult {
  /** Wet bulb globe temperature, °C. */
  wbgt: number;
  /** Black globe temperature, °C. */
  globe: number;
  /** Natural wet bulb temperature, °C. */
  naturalWetBulb: number;
  /** Wind speed at 2 m used in the calculation, m/s. */
  speed2m: number;
  /** Cosine of the solar zenith angle. */
  cza: number;
}

/** Returns null when the globe or wet-bulb iteration fails to converge. */
export function calcWbgt(input: WbgtInput): WbgtResult | null {
  const avg = input.avgMinutes ?? 0;
  const t = input.time;
  const hourUtc =
    t.getUTCHours() + (t.getUTCMinutes() + t.getUTCSeconds() / 60 - 0.5 * avg) / 60;
  const dday = t.getUTCDate() + hourUtc / 24;

  const sun = solarParameters(
    t.getUTCFullYear(),
    t.getUTCMonth() + 1,
    dday,
    input.lat,
    input.lon,
    input.solar,
  );
  if (!sun) return null;
  const { cza, fdir, solar } = sun;

  let speed = input.windSpeed;
  if (input.windHeight !== REF_HEIGHT) {
    const stability = stabilityClass(cza > 0, speed, solar, input.dT ?? 0);
    speed = estWindSpeed(speed, input.windHeight, stability, input.urban ?? false);
  }

  const tk = input.tempC + 273.15;
  const rh = 0.01 * input.rh;

  const globe = tGlobe(tk, rh, input.pressure, speed, solar, fdir, cza);
  const naturalWetBulb = tWetBulb(tk, rh, input.pressure, speed, solar, fdir, cza);
  if (globe === null || naturalWetBulb === null) return null;

  return {
    wbgt: 0.1 * input.tempC + 0.2 * globe + 0.7 * naturalWetBulb,
    globe,
    naturalWetBulb,
    speed2m: speed,
    cza,
  };
}

export const cToF = (c: number) => (c * 9) / 5 + 32;
export const fToC = (f: number) => ((f - 32) * 5) / 9;

/** Sun angle, direct-beam fraction, and irradiance clipped to the sun position. */
function solarParameters(
  year: number,
  month: number,
  day: number,
  lat: number,
  lon: number,
  solarIn: number,
): { cza: number; fdir: number; solar: number } | null {
  const pos = solarPosition(year, month, day, lat, lon);
  if (!pos) return null;
  const cza = Math.cos((90 - pos.altitude) * DEG_RAD);
  let toasolar = (SOLAR_CONST * Math.max(0, cza)) / (pos.distance * pos.distance);
  if (cza < CZA_MIN) toasolar = 0;

  let solar = solarIn;
  let fdir = 0;
  if (toasolar > 0) {
    const normsolar = Math.min(solar / toasolar, NORMSOLAR_MAX);
    solar = normsolar * toasolar;
    if (normsolar > 0) {
      fdir = Math.exp(3 - 1.34 * normsolar - 1.65 / normsolar);
      fdir = Math.max(Math.min(fdir, 0.9), 0);
    }
  }
  return { cza, fdir, solar };
}

/** Natural wet bulb temperature, °C. Tair in kelvin, rh as a fraction. */
function tWetBulb(
  Tair: number,
  rh: number,
  Pair: number,
  speed: number,
  solar: number,
  fdir: number,
  cza: number,
): number | null {
  const a = 0.56; // Bedingfield and Drew
  const Tsfc = Tair;
  const sza = Math.acos(cza);
  const eair = rh * esat(Tair);
  let twbPrev = dewPoint(eair);
  let twbNew = twbPrev;

  for (let iter = 0; iter < MAX_ITER; iter++) {
    const Tref = 0.5 * (twbPrev + Tair);
    const h = hCylinderInAir(D_WICK, L_WICK, Tref, Pair, speed);
    const Fatm =
      STEFANB *
        EMIS_WICK *
        (0.5 * (emisAtm(Tair, rh) * Tair ** 4 + EMIS_SFC * Tsfc ** 4) - twbPrev ** 4) +
      (1 - ALB_WICK) *
        solar *
        ((1 - fdir) * (1 + (0.25 * D_WICK) / L_WICK) +
          fdir * (Math.tan(sza) / PI + (0.25 * D_WICK) / L_WICK) +
          ALB_SFC);
    const ewick = esat(twbPrev);
    const density = (Pair * 100) / (R_AIR * Tref);
    const Sc = viscosity(Tref) / (density * diffusivity(Tref, Pair));
    twbNew =
      Tair -
      ((evap(Tref) / RATIO) * (ewick - eair)) / (Pair - ewick) * (Pr / Sc) ** a +
      Fatm / h;
    const converged = Math.abs(twbNew - twbPrev) < CONVERGENCE;
    twbPrev = 0.9 * twbPrev + 0.1 * twbNew;
    if (converged) return twbNew - 273.15;
  }
  return null;
}

/** Convective heat transfer coefficient for a long cylinder in cross flow, W/(m² K). */
function hCylinderInAir(diameter: number, _length: number, Tair: number, Pair: number, speed: number) {
  const a = 0.56; // Bedingfield and Drew, eqn 32
  const b = 0.281;
  const c = 0.4;
  const density = (Pair * 100) / (R_AIR * Tair);
  const Re = (Math.max(speed, MIN_SPEED) * density * diameter) / viscosity(Tair);
  const Nu = b * Re ** (1 - c) * Pr ** (1 - a);
  return (Nu * thermalCond(Tair)) / diameter;
}

/** Globe temperature, °C. Tair in kelvin, rh as a fraction. */
function tGlobe(
  Tair: number,
  rh: number,
  Pair: number,
  speed: number,
  solar: number,
  fdir: number,
  cza: number,
): number | null {
  const Tsfc = Tair;
  let tgPrev = Tair;
  for (let iter = 0; iter < MAX_ITER; iter++) {
    const Tref = 0.5 * (tgPrev + Tair);
    const h = hSphereInAir(D_GLOBE, Tref, Pair, speed);
    const tgNew =
      (0.5 * (emisAtm(Tair, rh) * Tair ** 4 + EMIS_SFC * Tsfc ** 4) -
        (h / (STEFANB * EMIS_GLOBE)) * (tgPrev - Tair) +
        (solar / (2 * STEFANB * EMIS_GLOBE)) *
          (1 - ALB_GLOBE) *
          (fdir * (1 / (2 * cza) - 1) + 1 + ALB_SFC)) **
      0.25;
    const converged = Math.abs(tgNew - tgPrev) < CONVERGENCE;
    tgPrev = 0.9 * tgPrev + 0.1 * tgNew;
    if (converged) return tgNew - 273.15;
  }
  return null;
}

/** Convective heat transfer coefficient for flow around a sphere, W/(m² K). BSL p. 409. */
function hSphereInAir(diameter: number, Tair: number, Pair: number, speed: number) {
  const density = (Pair * 100) / (R_AIR * Tair);
  const Re = (Math.max(speed, MIN_SPEED) * density * diameter) / viscosity(Tair);
  const Nu = 2.0 + 0.6 * Math.sqrt(Re) * Pr ** 0.3333;
  return (Nu * thermalCond(Tair)) / diameter;
}

/** Saturation vapor pressure over liquid water, mb. Buck (1981) eqn 3, with the moist-air factor. */
function esat(tk: number) {
  const y = (tk - 273.15) / (tk - 32.18);
  return 1.004 * 6.1121 * Math.exp(17.502 * y);
}

/** Dew point, K, from vapor pressure in mb. Inverse of esat. */
function dewPoint(e: number) {
  const z = Math.log(e / (6.1121 * 1.004));
  return 273.15 + (240.97 * z) / (17.502 - z);
}

/** Viscosity of air, kg/(m s). BSL p. 23. */
function viscosity(Tair: number) {
  const sigma = 3.617;
  const epsKappa = 97.0;
  const Tr = Tair / epsKappa;
  const omega = ((Tr - 2.9) / 0.4) * -0.034 + 1.048;
  return (2.6693e-6 * Math.sqrt(M_AIR * Tair)) / (sigma * sigma * omega);
}

/** Thermal conductivity of air, W/(m K). BSL p. 257. */
function thermalCond(Tair: number) {
  return (Cp + 1.25 * R_AIR) * viscosity(Tair);
}

/** Diffusivity of water vapor in air, m²/s. BSL p. 505. */
function diffusivity(Tair: number, Pair: number) {
  const PcritAir = 36.4;
  const PcritH2o = 218;
  const TcritAir = 132;
  const TcritH2o = 647.3;
  const a = 3.64e-4;
  const b = 2.334;
  const Pcrit13 = (PcritAir * PcritH2o) ** (1 / 3);
  const Tcrit512 = (TcritAir * TcritH2o) ** (5 / 12);
  const Tcrit12 = Math.sqrt(TcritAir * TcritH2o);
  const Mmix = Math.sqrt(1 / M_AIR + 1 / M_H2O);
  const Patm = Pair / 1013.25;
  return ((a * (Tair / Tcrit12) ** b * Pcrit13 * Tcrit512 * Mmix) / Patm) * 1e-4;
}

/** Heat of evaporation, J/kg, for 283–313 K. Van Wylen and Sonntag, Table A.1.1. */
function evap(Tair: number) {
  return ((313.15 - Tair) / 30) * -71100 + 2.4073e6;
}

/** Atmospheric emissivity. Oke (2nd ed.), p. 373. */
function emisAtm(Tair: number, rh: number) {
  const e = rh * esat(Tair);
  return 0.575 * e ** 0.143;
}

/** Sun position (Nels Larson, PNNL). Day is the UTC day.fraction of the month. */
function solarPosition(
  year: number,
  month: number,
  day: number,
  latitude: number,
  longitude: number,
): { altitude: number; distance: number } | null {
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  if (year < 1950 || year > 2049) return null;
  if (month < 1 || month > 12 || day < 0 || day > 33) return null;

  const daynumber = dayNumber(year, month, Math.trunc(day));
  const deltaYears = year - 2000;
  let deltaDays = deltaYears * 365 + Math.trunc(deltaYears / 4) + daynumber;
  if (year > 2000) deltaDays += 1;
  let daysJ2000 = deltaDays - 1.5;
  const centJ2000 = daysJ2000 / 36525.0;

  let ut = fracPart(day);
  daysJ2000 += ut;
  ut *= 24.0;

  const meanAnomaly = fracPart((357.528 + 0.9856003 * daysJ2000) / 360.0) * TWOPI;
  const meanLongitude = fracPart((280.46 + 0.9856474 * daysJ2000) / 360.0) * TWOPI;
  const meanObliquity = (23.439 - 4.0e-7 * daysJ2000) * DEG_RAD;
  const eclipticLong =
    (1.915 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2.0 * meanAnomaly)) * DEG_RAD +
    meanLongitude;

  const distance =
    1.00014 - 0.01671 * Math.cos(meanAnomaly) - 0.00014 * Math.cos(2.0 * meanAnomaly);

  let apRa = Math.atan2(Math.cos(meanObliquity) * Math.sin(eclipticLong), Math.cos(eclipticLong));
  if (apRa < 0) apRa += TWOPI;
  apRa = fracPart(apRa / TWOPI) * 24.0;

  const apDec = Math.asin(Math.sin(meanObliquity) * Math.sin(eclipticLong));

  let gmst0h =
    24110.54841 + centJ2000 * (8640184.812866 + centJ2000 * (0.093104 - centJ2000 * 6.2e-6));
  gmst0h = fracPart(gmst0h / 3600.0 / 24.0) * 24.0;
  if (gmst0h < 0) gmst0h += 24.0;

  let lmst = gmst0h + ut * 1.00273790934 + longitude / 15.0;
  lmst = fracPart(lmst / 24.0) * 24.0;
  if (lmst < 0) lmst += 24.0;

  let localHa = lmst - apRa;
  if (localHa < -12.0) localHa += 24.0;
  else if (localHa > 12.0) localHa -= 24.0;

  const latRad = latitude * DEG_RAD;
  localHa = (localHa / 24.0) * TWOPI;

  const altRad = Math.asin(
    Math.sin(apDec) * Math.sin(latRad) + Math.cos(apDec) * Math.cos(localHa) * Math.cos(latRad),
  );
  const tanAlt = Math.abs(altRad) < 1.57079615 ? Math.tan(altRad) : 6.0e6;
  const altitude = altRad * RAD_DEG;

  // Refraction for standard sea-level pressure and temperature.
  const pressure = 1013.25;
  const temp = 15.0;
  let refraction = 0;
  if (!(altitude < -1.0 || tanAlt === 6.0e6)) {
    if (altitude < 19.225) {
      refraction = (0.1594 + altitude * (0.0196 + 0.00002 * altitude)) * pressure;
      refraction /= (1.0 + altitude * (0.505 + 0.0845 * altitude)) * (273.0 + temp);
    } else {
      refraction = (0.00452 * (pressure / (273.0 + temp))) / tanAlt;
    }
  }
  return { altitude: altitude + refraction, distance };
}

/** C's modf(): the fractional part, keeping the sign. */
function fracPart(x: number) {
  return x - Math.trunc(x);
}

/** Day of the year for a Gregorian date (Jan 1 = 1). */
function dayNumber(year: number, month: number, day: number) {
  const begmonth = [0, 0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const leapyr = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  let dnum = begmonth[month] + day;
  if (leapyr && month > 2) dnum += 1;
  return dnum;
}

/** Estimated wind speed at 2 m. EPA-454/5-99-005 (2000), section 6.2.5. */
function estWindSpeed(speed: number, zspeed: number, stabilityClass: number, urban: boolean) {
  const urbanExp = [0.15, 0.15, 0.2, 0.25, 0.3, 0.3];
  const ruralExp = [0.07, 0.07, 0.1, 0.15, 0.35, 0.55];
  const exponent = (urban ? urbanExp : ruralExp)[stabilityClass - 1];
  return Math.max(speed * (REF_HEIGHT / zspeed) ** exponent, MIN_SPEED);
}

/** Pasquill stability class, 1–6. EPA-454/5-99-005 §6.2.5. */
function stabilityClass(daytime: boolean, speed: number, solar: number, dT: number) {
  const lsrdt = [
    [1, 1, 2, 4, 0, 5, 6, 0],
    [1, 2, 3, 4, 0, 5, 6, 0],
    [2, 2, 3, 4, 0, 4, 4, 0],
    [3, 3, 4, 4, 0, 0, 0, 0],
    [3, 4, 4, 4, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0],
  ];
  let i: number;
  let j: number;
  if (daytime) {
    if (solar >= 925.0) j = 0;
    else if (solar >= 675.0) j = 1;
    else if (solar >= 175.0) j = 2;
    else j = 3;

    if (speed >= 6.0) i = 4;
    else if (speed >= 5.0) i = 3;
    else if (speed >= 3.0) i = 2;
    else if (speed >= 2.0) i = 1;
    else i = 0;
  } else {
    j = dT >= 0.0 ? 6 : 5;
    if (speed >= 2.5) i = 2;
    else if (speed >= 2.0) i = 1;
    else i = 0;
  }
  return lsrdt[i][j];
}
