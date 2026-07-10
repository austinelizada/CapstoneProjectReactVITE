const STD_W_CM = 90;
const STD_H_CM = 210;
const STD_DOOR_W_IN = STD_W_CM / 2.54; // 35.43307...
const STD_DOOR_H_IN = STD_H_CM / 2.54; // 82.677...
const STD_DOOR_SQFT = (STD_DOOR_W_IN * STD_DOOR_H_IN) / 144; // ~20.336

const catalog = {
  "Sliding Window": {
    method: "area",
    defaultW: 48,
    defaultH: 48,
    glasses: [
      { name: "Clear Glass", rate: 262.0 },
      { name: "Bronze Glass", rate: 262.0 },
      { name: "Reflective Bronze Glass", rate: 262.0 },
      { name: "Blue Glass", rate: 262.5 },
      { name: "Reflective Blue Glass", rate: 335.5 },
      { name: "Gray Glass", rate: 335.5 },
      { name: "Reflective Gray Glass", rate: 335.5 },
    ],
  },
  "Aluminum Window": {
    method: "area",
    defaultW: 48,
    defaultH: 48,
    glasses: [
      { name: "Sliding (Clear)", rate: 262.5 },
      { name: "Awning Frame", rate: 550.0 },
      { name: "Swing Frame", rate: 550.0 },
      { name: "Slide-Up Track", rate: 262.5 },
    ],
  },
  "Aluminum Door": {
    method: "area_door",
    defaultW: STD_DOOR_W_IN,
    defaultH: STD_DOOR_H_IN,
    glasses: [
      { name: "Alcoframe Screen Door", base: 5500, rate: 5500 / STD_DOOR_SQFT },
      { name: "Alcoframe Glass Panel", base: 7500, rate: 7500 / STD_DOOR_SQFT },
      { name: "SF101 Heavy Frame", base: 3800, rate: 3800 / STD_DOOR_SQFT },
    ],
  },
  "Glass Door": {
    method: "area_door",
    defaultW: STD_DOOR_W_IN,
    defaultH: STD_DOOR_H_IN,
    glasses: [
      { name: "Clear Glass", base: 7500, rate: 7500 / STD_DOOR_SQFT },
      { name: "Bronze Glass", base: 7500, rate: 7500 / STD_DOOR_SQFT },
      { name: "Reflective Bronze Glass", base: 7500, rate: 7500 / STD_DOOR_SQFT },
      { name: "Blue Glass", base: 8500, rate: 8500 / STD_DOOR_SQFT },
      { name: "Reflective Blue Glass", base: 8500, rate: 8500 / STD_DOOR_SQFT },
      { name: "Gray Glass", base: 8500, rate: 8500 / STD_DOOR_SQFT },
      { name: "Reflective Gray Glass", base: 8500, rate: 8500 / STD_DOOR_SQFT },
    ],
  },
  "Jalousie Window": {
    method: "blades",
    glasses: [
      { name: "Clear Glass — 3/16\" thick", rate: 135.0 },
      { name: "Clear Glass — 1/4\" thick", rate: 155.0 },
      { name: "Bronze Glass — 3/16\" thick", rate: 135.0 },
      { name: "Bronze Glass — 1/4\" thick", rate: 155.0 },
      { name: "Smoke Glass — 3/16\" thick", rate: 140.0 },
      { name: "Smoke Glass — 1/4\" thick", rate: 160.0 },
      { name: "Reflective Bronze Glass — 3/16\" thick", rate: 140.0 },
      { name: "Reflective Bronze Glass — 1/4\" thick", rate: 160.0 },
      { name: "Blue Glass — 3/16\" thick", rate: 140.0 },
      { name: "Reflective Blue Glass — 3/16\" thick", rate: 160.0 },
      { name: "Reflective Blue Glass — 1/4\" thick", rate: 180.0 },
      { name: "Gray Glass — 3/16\" thick", rate: 160.0 },
      { name: "Gray Glass — 1/4\" thick", rate: 180.0 },
      { name: "Reflective Gray Glass — 3/16\" thick", rate: 160.0 },
      { name: "Reflective Gray Glass — 1/4\" thick", rate: 180.0 },
    ],
  },
  "Shower Enclosure": {
    method: "area",
    defaultW: 36,
    defaultH: 72,
    glasses: [
      { name: "Smoke / Tinted — 3/16\" thick", rate: 262.5 },
      { name: "Smoke / Tinted — 1/4\" thick", rate: 290.0 },
      { name: "Clear — 3/16\" thick", rate: 250.0 },
      { name: "Clear — 1/4\" thick", rate: 275.0 },
      { name: "Frosted — 3/16\" thick", rate: 280.0 },
      { name: "Frosted — 1/4\" thick", rate: 310.0 },
    ],
  },
  "Sink Cabinet": {
    method: "area",
    defaultW: 24,
    defaultH: 36,
    glasses: [
      { name: "Modular", rate: 500.0 },
      { name: "Regular", rate: 350.0 },
    ],
  },
  "Hanging Cabinet": {
    method: "area",
    defaultW: 24,
    defaultH: 30,
    glasses: [
      { name: "Modular", rate: 1000.0 },
      { name: "Regular", rate: 700.0 },
    ],
  },
};

const UNIT_TO_INCH_FACTOR = {
  in: 1,
  ft: 12,
  cm: 1 / 2.54,
  m: 100 / 2.54,
};

const MEASUREMENT_UNIT_LABELS = {
  in: 'Inches',
  ft: 'Feet',
  cm: 'Centimeters',
  m: 'Meters',
};

function fmtNum(n, dec = 2) {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function toInches(value, unit = 'in') {
  const numeric = Number(value) || 0;
  const factor = UNIT_TO_INCH_FACTOR[unit] || 1;
  return numeric * factor;
}

function toSquareFeet(width, height, unit = 'in') {
  const widthIn = toInches(width, unit);
  const heightIn = toInches(height, unit);
  return (widthIn * heightIn) / 144;
}

function calculateEstimate({
  productName,
  categoryKey,
  variantName,
  width = 0,
  height = 0,
  measurementUnit = 'in',
  quantity = 1,
  blade_count = 0,
  base_price,
  overrideRate,
  customization = false,
  customization_fee = 0,
}) {
  const widthIn = toInches(width, measurementUnit);
  const heightIn = toInches(height, measurementUnit);
  const catKey = productName || categoryKey;
  const cat = catalog[catKey];
  let rate = overrideRate;
  let total = 0;
  let area = 0;
  let areaDisplay = '—';
  let rateNote = '';

  if (cat) {
    const glass = (variantName && cat.glasses.find(g => g.name === variantName)) || cat.glasses[0];
    rate = rate || glass.rate || (glass.base ? glass.base / STD_DOOR_SQFT : undefined);

    if (cat.method === 'area' || cat.method === 'area_door') {
      const w = widthIn || (cat.method === 'area_door' ? cat.defaultW : 0);
      const h = heightIn || (cat.method === 'area_door' ? cat.defaultH : 0);
      area = (w * h) / 144;
      total = area * (rate || 0) * (Number(quantity) || 1);
      areaDisplay = fmtNum(area, 4) + ' sq.ft';
      if (cat.method === 'area_door' && glass.base) {
        rateNote = `Base ₱${Number(glass.base).toLocaleString('en-PH')} ÷ ${fmtNum(STD_DOOR_SQFT,4)} std sq.ft = ₱${fmtNum(rate,2)}/sq.ft`;
      }
    } else if (cat.method === 'blades') {
      const b = Number(blade_count) || Number(quantity) || 0;
      total = (rate || 0) * b;
      areaDisplay = `${b} blade(s)`;
    }
  } else {
    if (overrideRate) {
      const sqft = toSquareFeet(width, height, measurementUnit) || 0;
      area = sqft;
      total = sqft * overrideRate * (Number(quantity) || 1);
      areaDisplay = fmtNum(area, 4) + ' sq.ft';
    } else if (base_price) {
      total = Number(base_price) * (Number(quantity) || 1);
    }
  }

  const customizationFee = customization ? Number(customization_fee) || 0 : 0;
  if (customizationFee && total > 0) total += customizationFee;
  if (customizationFee && total === 0) total = customizationFee;

  return {
    estimated_area: Number(area) || 0,
    estimated_price: Number(Number(total).toFixed(2)) || 0,
    rate: Number(rate) || 0,
    areaDisplay,
    rateNote,
  };
}

export { catalog, calculateEstimate, toInches, toSquareFeet, MEASUREMENT_UNIT_LABELS };
