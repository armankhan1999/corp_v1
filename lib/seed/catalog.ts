import type { ItemCategory, OEMPrincipal, ProductLine } from "../schemas/enums";

/**
 * Reference vocabulary. Product lines, principals and geography are taken from
 * bhushancorp.in and the BRD; all individual names are fictional (SD-4 / CN-004).
 */

export const COMPANY = {
  legalName: "Bhushancorp Private Limited",
  tradeName: "Bhushan Corp",
  lineage: "Trading arm of Bhushan International, established 1985",
  cin: "U29309BR2017PTC035016",
  gstin: "10AAGCB4521K1ZP",
  pan: "AAGCB4521K",
  address: "2nd Floor, B-3, Grand Shere-II, Exhibition Road, Patna, Bihar 800001",
  phone: "+91 612 2320269",
  altPhone: "+91 99559 97458",
  email: "contact@bhushancorp.in",
  website: "www.bhushancorp.in",
  stateCode: "10",
  stateName: "Bihar",
  bank: {
    name: "State Bank of India",
    branch: "Exhibition Road, Patna",
    account: "3874 5521 0093",
    ifsc: "SBIN0004321",
  },
} as const;

export interface BranchSeed {
  code: string;
  name: string;
  city: string;
  district: string;
  isHeadOffice: boolean;
  hasCentralWarehouse: boolean;
  lat: number;
  lng: number;
  fieldEngineers: number;
}

/** B1 / PD-003 default — held as data, not code, so a client answer is a data edit. */
export const BRANCHES: BranchSeed[] = [
  { code: "PAT", name: "Patna (HQ)", city: "Patna", district: "Patna", isHeadOffice: true, hasCentralWarehouse: true, lat: 25.6093, lng: 85.1376, fieldEngineers: 4 },
  { code: "MUZ", name: "Muzaffarpur", city: "Muzaffarpur", district: "Muzaffarpur", isHeadOffice: false, hasCentralWarehouse: false, lat: 26.1209, lng: 85.3647, fieldEngineers: 2 },
  { code: "BHA", name: "Bhagalpur", city: "Bhagalpur", district: "Bhagalpur", isHeadOffice: false, hasCentralWarehouse: false, lat: 25.2425, lng: 86.9842, fieldEngineers: 2 },
  { code: "GAY", name: "Gaya", city: "Gaya", district: "Gaya", isHeadOffice: false, hasCentralWarehouse: false, lat: 24.7955, lng: 84.9994, fieldEngineers: 1 },
];

export interface DistrictSeed {
  name: string;
  state: string;
  stateCode: string;
  lat: number;
  lng: number;
  branchCode: string;
  country: string;
}

export const DISTRICTS: DistrictSeed[] = [
  { name: "Patna", state: "Bihar", stateCode: "10", lat: 25.6093, lng: 85.1376, branchCode: "PAT", country: "IN" },
  { name: "Bihta", state: "Bihar", stateCode: "10", lat: 25.5573, lng: 84.8672, branchCode: "PAT", country: "IN" },
  { name: "Hajipur", state: "Bihar", stateCode: "10", lat: 25.6858, lng: 85.2098, branchCode: "PAT", country: "IN" },
  { name: "Muzaffarpur", state: "Bihar", stateCode: "10", lat: 26.1209, lng: 85.3647, branchCode: "MUZ", country: "IN" },
  { name: "Darbhanga", state: "Bihar", stateCode: "10", lat: 26.1542, lng: 85.8918, branchCode: "MUZ", country: "IN" },
  { name: "Begusarai", state: "Bihar", stateCode: "10", lat: 25.4182, lng: 86.1272, branchCode: "MUZ", country: "IN" },
  { name: "Bhagalpur", state: "Bihar", stateCode: "10", lat: 25.2425, lng: 86.9842, branchCode: "BHA", country: "IN" },
  { name: "Purnia", state: "Bihar", stateCode: "10", lat: 25.7771, lng: 87.4753, branchCode: "BHA", country: "IN" },
  { name: "Gaya", state: "Bihar", stateCode: "10", lat: 24.7955, lng: 84.9994, branchCode: "GAY", country: "IN" },
  { name: "Sasaram", state: "Bihar", stateCode: "10", lat: 24.9509, lng: 84.0303, branchCode: "GAY", country: "IN" },
  { name: "Birgunj", state: "Province No. 2", stateCode: "96", lat: 27.0104, lng: 84.8770, branchCode: "MUZ", country: "NP" },
];

export const INDUSTRIES = [
  "Rice & Flour Milling",
  "Dairy Processing",
  "Pharmaceutical",
  "Plastics & Packaging",
  "Tyre Retreading",
  "Automobile Dealership Workshop",
  "Cold Storage",
  "Brewery & Beverage",
  "Cement & Construction Materials",
  "Hospital",
  "Hotel & Hospitality",
  "Municipal Body",
  "Water Supply Undertaking",
  "Textile Processing",
  "Engineering Fabrication",
] as const;

/** Institutional archetypes — anonymised per B8 / PD-010 default. */
export const INSTITUTIONAL_ARCHETYPES = [
  "State Medical Institute",
  "Regional Medical Sciences Institute",
  "District Government Hospital",
  "Municipal Corporation — Water Works",
  "State Water & Sanitation Board",
  "Central University Campus",
  "Government Engineering College",
  "State Dairy Federation",
  "District Cooperative Milk Union",
  "Regional Rural Development Authority",
  "State Pollution Control Facility",
  "Public Health Engineering Division",
  "Railway Divisional Workshop",
  "State Transport Depot",
] as const;

export const INDUSTRIAL_PREFIX = [
  "Ganga", "Maurya", "Magadh", "Kosi", "Sone", "Vaishali", "Mithila", "Nalanda",
  "Rajgir", "Anga", "Champaran", "Bodhi", "Shakti", "Sunrise", "Pushpanjali",
  "Trishul", "Anand", "Navjeevan", "Kalyani", "Deepak", "Suryodaya", "Ambika",
  "Bharat", "Kiran", "Vishwakarma", "Jagdamba", "Sitaram", "Prayag", "Arya", "Neelkamal",
] as const;

export const INDUSTRIAL_SUFFIX = [
  "Industries", "Agro Mills", "Foods", "Packaging", "Polymers", "Enterprises",
  "Udyog", "Steels", "Cold Chain", "Beverages", "Pharma", "Auto Works",
  "Engineering Works", "Rice Mills", "Dairy", "Plastics", "Fabricators",
  "Processing", "Textiles", "Traders",
] as const;

export const FIRST_NAMES = [
  "Rakesh", "Sunita", "Amit", "Priya", "Rajeev", "Nisha", "Manoj", "Kavita",
  "Sanjay", "Anita", "Vikash", "Rekha", "Pankaj", "Meena", "Dinesh", "Pooja",
  "Ashok", "Shalini", "Ravi", "Neha", "Sushil", "Archana", "Alok", "Swati",
  "Nitin", "Bhavna", "Deepak", "Jyoti", "Gaurav", "Madhuri", "Anil", "Seema",
  "Vinod", "Aarti", "Sachin", "Ritu", "Mukesh", "Preeti", "Naveen", "Suman",
  "Abhishek", "Divya", "Prakash", "Renu", "Satish", "Vandana", "Ajay", "Shobha",
  "Kunal", "Anjali", "Ranjan", "Bindu", "Saurabh", "Kiran", "Mithlesh", "Usha",
] as const;

export const LAST_NAMES = [
  "Kumar", "Singh", "Prasad", "Sharma", "Verma", "Jha", "Mishra", "Choudhary",
  "Yadav", "Gupta", "Sinha", "Thakur", "Pandey", "Ranjan", "Roy", "Mahto",
  "Tiwari", "Das", "Sahu", "Bharti", "Kumari", "Anand", "Raut", "Ojha",
] as const;

export const DESIGNATIONS_CUSTOMER = [
  "Plant Head", "Maintenance Manager", "Purchase Manager", "Works Manager",
  "Proprietor", "Director – Operations", "Utility In-charge", "Chief Engineer",
  "Executive Engineer", "Assistant Engineer", "Production Manager", "Store Manager",
] as const;

/* ------------------------------------------------------- product catalogue */

export interface MachineSpec {
  productLine: ProductLine;
  principal: OEMPrincipal;
  series: string;
  capacityUnit: string;
  capacityRange: [number, number];
  kwRange: [number, number] | null;
  priceRange: [number, number];
  hsn: string;
  gstRate: number;
  warrantyMonths: number;
}

/** Series names reference the product line, not fabricated catalogue codes. SD-6. */
export const MACHINE_SPECS: MachineSpec[] = [
  { productLine: "PISTON_COMPRESSOR", principal: "ELGI", series: "Piston Reciprocating", capacityUnit: "CFM", capacityRange: [10, 120], kwRange: [2.2, 22], priceRange: [58000, 480000], hsn: "8414", gstRate: 18, warrantyMonths: 12 },
  { productLine: "SCREW_COMPRESSOR", principal: "ELGI", series: "Electric Lubricated Screw", capacityUnit: "CFM", capacityRange: [55, 620], kwRange: [11, 132], priceRange: [420000, 3850000], hsn: "8414", gstRate: 18, warrantyMonths: 18 },
  { productLine: "OIL_FREE_COMPRESSOR", principal: "ELGI", series: "Oil Free Screw", capacityUnit: "CFM", capacityRange: [95, 480], kwRange: [22, 110], priceRange: [1250000, 6400000], hsn: "8414", gstRate: 18, warrantyMonths: 18 },
  { productLine: "PORTABLE_COMPRESSOR", principal: "ELGI", series: "Portable Diesel", capacityUnit: "CFM", capacityRange: [110, 450], kwRange: [30, 120], priceRange: [680000, 2400000], hsn: "8414", gstRate: 18, warrantyMonths: 12 },
  { productLine: "DIRECT_DRIVE_COMPRESSOR", principal: "ELGI", series: "Direct Drive Screw", capacityUnit: "CFM", capacityRange: [40, 220], kwRange: [7.5, 45], priceRange: [310000, 1450000], hsn: "8414", gstRate: 18, warrantyMonths: 18 },
  { productLine: "AIR_ACCESSORY", principal: "ELGI", series: "Refrigerated Air Dryer", capacityUnit: "CFM", capacityRange: [30, 600], kwRange: [0.5, 6], priceRange: [42000, 385000], hsn: "8419", gstRate: 18, warrantyMonths: 12 },
  { productLine: "BODY_SHOP_EQUIPMENT", principal: "ATS_ELGI", series: "Body Shop", capacityUnit: "Ton", capacityRange: [2, 10], kwRange: [1.5, 7.5], priceRange: [185000, 1250000], hsn: "8425", gstRate: 18, warrantyMonths: 12 },
  { productLine: "LUBE_EQUIPMENT", principal: "ATS_ELGI", series: "Lube Dispensing", capacityUnit: "LPM", capacityRange: [8, 45], kwRange: [0.75, 3], priceRange: [46000, 320000], hsn: "8413", gstRate: 18, warrantyMonths: 12 },
  { productLine: "WASHING_EQUIPMENT", principal: "ATS_ELGI", series: "High Pressure Washer", capacityUnit: "Bar", capacityRange: [100, 200], kwRange: [2.2, 11], priceRange: [78000, 540000], hsn: "8424", gstRate: 18, warrantyMonths: 12 },
  { productLine: "LIFTING_EQUIPMENT", principal: "ATS_ELGI", series: "Two Post Lift", capacityUnit: "Ton", capacityRange: [3, 6], kwRange: [2.2, 4], priceRange: [165000, 620000], hsn: "8425", gstRate: 18, warrantyMonths: 24 },
  { productLine: "PNEUMATIC_TOOL", principal: "ATS_ELGI", series: "Pneumatic Tooling", capacityUnit: "CFM", capacityRange: [3, 20], kwRange: null, priceRange: [8500, 74000], hsn: "8467", gstRate: 18, warrantyMonths: 6 },
  { productLine: "TYRE_INFLATOR", principal: "ATS_ELGI", series: "Digital Tyre Inflator", capacityUnit: "Bar", capacityRange: [8, 12], kwRange: null, priceRange: [24000, 118000], hsn: "8414", gstRate: 18, warrantyMonths: 12 },
  { productLine: "PUMP", principal: "KSB", series: "Centrifugal Process", capacityUnit: "m³/h", capacityRange: [12, 480], kwRange: [1.5, 90], priceRange: [64000, 1850000], hsn: "8413", gstRate: 18, warrantyMonths: 12 },
  { productLine: "WATER_TREATMENT", principal: "ION_EXCHANGE", series: "Treatment Package", capacityUnit: "KLD", capacityRange: [50, 1200], kwRange: [5, 75], priceRange: [850000, 12500000], hsn: "8421", gstRate: 18, warrantyMonths: 12 },
  { productLine: "PPR_PIPING", principal: "OTHER", series: "PPR Distribution", capacityUnit: "mm", capacityRange: [20, 160], kwRange: null, priceRange: [340, 4800], hsn: "3917", gstRate: 18, warrantyMonths: 60 },
];

export interface SpareSpec {
  name: string;
  category: ItemCategory;
  principal: OEMPrincipal;
  productLines: ProductLine[];
  uom: string;
  hsn: string;
  gstRate: number;
  costRange: [number, number];
  fastMoving: boolean;
}

export const SPARE_SPECS: SpareSpec[] = [
  { name: "Air Filter Element", category: "SPARE", principal: "ELGI", productLines: ["SCREW_COMPRESSOR", "DIRECT_DRIVE_COMPRESSOR", "PISTON_COMPRESSOR"], uom: "Nos", hsn: "8421", gstRate: 18, costRange: [820, 6400], fastMoving: true },
  { name: "Oil Filter Element", category: "SPARE", principal: "ELGI", productLines: ["SCREW_COMPRESSOR", "DIRECT_DRIVE_COMPRESSOR"], uom: "Nos", hsn: "8421", gstRate: 18, costRange: [640, 4200], fastMoving: true },
  { name: "Air-Oil Separator", category: "SPARE", principal: "ELGI", productLines: ["SCREW_COMPRESSOR", "OIL_FREE_COMPRESSOR"], uom: "Nos", hsn: "8421", gstRate: 18, costRange: [3400, 24500], fastMoving: true },
  { name: "Screw Compressor Oil 20L", category: "CONSUMABLE", principal: "ELGI", productLines: ["SCREW_COMPRESSOR", "DIRECT_DRIVE_COMPRESSOR"], uom: "Can", hsn: "2710", gstRate: 18, costRange: [4600, 12800], fastMoving: true },
  { name: "Intake Valve Kit", category: "SPARE", principal: "ELGI", productLines: ["SCREW_COMPRESSOR"], uom: "Set", hsn: "8481", gstRate: 18, costRange: [6800, 42000], fastMoving: false },
  { name: "Minimum Pressure Valve", category: "SPARE", principal: "ELGI", productLines: ["SCREW_COMPRESSOR"], uom: "Nos", hsn: "8481", gstRate: 18, costRange: [5400, 31000], fastMoving: false },
  { name: "Thermostatic Valve Element", category: "SPARE", principal: "ELGI", productLines: ["SCREW_COMPRESSOR"], uom: "Nos", hsn: "8481", gstRate: 18, costRange: [2800, 14600], fastMoving: true },
  { name: "Drive Belt Set", category: "SPARE", principal: "ELGI", productLines: ["PISTON_COMPRESSOR", "DIRECT_DRIVE_COMPRESSOR"], uom: "Set", hsn: "4010", gstRate: 18, costRange: [1200, 8400], fastMoving: true },
  { name: "Piston Ring Set", category: "SPARE", principal: "ELGI", productLines: ["PISTON_COMPRESSOR"], uom: "Set", hsn: "8409", gstRate: 18, costRange: [2200, 11500], fastMoving: false },
  { name: "Non-Return Valve", category: "SPARE", principal: "ELGI", productLines: ["PISTON_COMPRESSOR", "SCREW_COMPRESSOR"], uom: "Nos", hsn: "8481", gstRate: 18, costRange: [1400, 9200], fastMoving: true },
  { name: "Pressure Switch", category: "SPARE", principal: "ELGI", productLines: ["PISTON_COMPRESSOR"], uom: "Nos", hsn: "9032", gstRate: 18, costRange: [1800, 7600], fastMoving: true },
  { name: "Controller Display Module", category: "SPARE", principal: "ELGI", productLines: ["SCREW_COMPRESSOR", "OIL_FREE_COMPRESSOR"], uom: "Nos", hsn: "8537", gstRate: 18, costRange: [18000, 96000], fastMoving: false },
  { name: "Cooler Core Assembly", category: "SPARE", principal: "ELGI", productLines: ["SCREW_COMPRESSOR"], uom: "Nos", hsn: "8419", gstRate: 18, costRange: [22000, 148000], fastMoving: false },
  { name: "Motor Bearing Set", category: "SPARE", principal: "ELGI", productLines: ["SCREW_COMPRESSOR", "DIRECT_DRIVE_COMPRESSOR"], uom: "Set", hsn: "8482", gstRate: 18, costRange: [3200, 18400], fastMoving: true },
  { name: "Auto Drain Valve", category: "SPARE", principal: "ELGI", productLines: ["AIR_ACCESSORY"], uom: "Nos", hsn: "8481", gstRate: 18, costRange: [2400, 12000], fastMoving: true },
  { name: "Dryer Refrigerant Charge", category: "CONSUMABLE", principal: "ELGI", productLines: ["AIR_ACCESSORY"], uom: "Kg", hsn: "2903", gstRate: 18, costRange: [1800, 6400], fastMoving: false },
  { name: "Mechanical Seal", category: "SPARE", principal: "KSB", productLines: ["PUMP"], uom: "Nos", hsn: "8484", gstRate: 18, costRange: [3400, 42000], fastMoving: true },
  { name: "Pump Impeller", category: "SPARE", principal: "KSB", productLines: ["PUMP"], uom: "Nos", hsn: "8413", gstRate: 18, costRange: [8600, 124000], fastMoving: false },
  { name: "Pump Wear Ring", category: "SPARE", principal: "KSB", productLines: ["PUMP"], uom: "Nos", hsn: "8413", gstRate: 18, costRange: [2400, 18600], fastMoving: false },
  { name: "Pump Shaft Sleeve", category: "SPARE", principal: "KSB", productLines: ["PUMP"], uom: "Nos", hsn: "8413", gstRate: 18, costRange: [1900, 14200], fastMoving: true },
  { name: "Hydraulic Cylinder Seal Kit", category: "SPARE", principal: "ATS_ELGI", productLines: ["LIFTING_EQUIPMENT"], uom: "Set", hsn: "8412", gstRate: 18, costRange: [2600, 16800], fastMoving: true },
  { name: "Lift Safety Lock Assembly", category: "SPARE", principal: "ATS_ELGI", productLines: ["LIFTING_EQUIPMENT"], uom: "Nos", hsn: "8425", gstRate: 18, costRange: [4200, 22000], fastMoving: false },
  { name: "Washer High Pressure Hose", category: "SPARE", principal: "ATS_ELGI", productLines: ["WASHING_EQUIPMENT"], uom: "Mtr", hsn: "4009", gstRate: 18, costRange: [640, 3800], fastMoving: true },
  { name: "Lube Meter Assembly", category: "SPARE", principal: "ATS_ELGI", productLines: ["LUBE_EQUIPMENT"], uom: "Nos", hsn: "9026", gstRate: 18, costRange: [5400, 28000], fastMoving: false },
  { name: "Inflator Gauge Head", category: "SPARE", principal: "ATS_ELGI", productLines: ["TYRE_INFLATOR"], uom: "Nos", hsn: "9026", gstRate: 18, costRange: [1800, 9400], fastMoving: true },
  { name: "Ion Exchange Resin", category: "CONSUMABLE", principal: "ION_EXCHANGE", productLines: ["WATER_TREATMENT"], uom: "Ltr", hsn: "3914", gstRate: 18, costRange: [420, 1850], fastMoving: true },
  { name: "Dosing Pump Diaphragm", category: "SPARE", principal: "ION_EXCHANGE", productLines: ["WATER_TREATMENT"], uom: "Nos", hsn: "8413", gstRate: 18, costRange: [2200, 11400], fastMoving: false },
  { name: "Membrane Cartridge", category: "CONSUMABLE", principal: "ION_EXCHANGE", productLines: ["WATER_TREATMENT"], uom: "Nos", hsn: "8421", gstRate: 18, costRange: [6400, 38000], fastMoving: false },
];

export const ACCESSORY_NAMES = [
  "Air Receiver Tank", "Moisture Separator", "Line Filter Housing", "Pressure Gauge",
  "Ball Valve", "Flexible Hose Assembly", "Condensate Drain Trap", "Air Regulator",
  "Quick Release Coupler", "Pipe Clamp Set", "Vibration Isolator Pad", "Silencer",
  "Manifold Block", "Safety Relief Valve", "Digital Pressure Sensor",
] as const;

export const PIPE_NAMES = [
  "PPR Pipe", "PPR Elbow 90°", "PPR Tee", "PPR Coupler", "PPR Reducer",
  "PPR End Cap", "PPR Union", "PPR Ball Valve", "MS Pipe", "GI Fitting",
] as const;

export const SERVICE_ITEM_NAMES = [
  "Installation & Commissioning Charges", "Preventive Maintenance Visit",
  "Breakdown Attendance Charges", "Overhauling Labour", "Site Survey & Sizing",
  "Operator Training Session", "Annual Maintenance — Comprehensive",
  "Annual Maintenance — Non-Comprehensive", "Transportation & Handling",
  "Erection Supervision", "Performance Testing", "Piping Layout Design",
] as const;

export const SUPPLIER_NAMES = [
  "Elgi Equipments — Eastern Depot", "ATS Elgi Spares Division", "KSB Pumps Regional Stockist",
  "Ion Exchange Consumables Cell", "Eastern Bearing House", "Patna Industrial Fasteners",
  "Magadh Lubricants", "Ganga Hose & Fittings", "Bihar Electricals & Controls",
  "Nalanda Rubber Products", "Vaishali Instrumentation", "Kosi Pipes & Polymers",
  "Sone Valley Hardware", "Maurya Seals & Gaskets", "Anga Tools Depot",
  "Mithila Filtration Supplies", "Champaran Motors & Drives", "Rajgir Sheet Metal Works",
  "Bodhi Packaging Materials", "Shakti Welding & Gases", "Trishul Safety Equipment",
  "Navjeevan Chemical Traders",
] as const;

export const LEAVE_TYPES = [
  { code: "CL", name: "Casual Leave", annualEntitlement: 12, accrualPerMonth: 1 },
  { code: "SL", name: "Sick Leave", annualEntitlement: 12, accrualPerMonth: 1 },
  { code: "EL", name: "Earned Leave", annualEntitlement: 18, accrualPerMonth: 1.5 },
  { code: "LWP", name: "Leave Without Pay", annualEntitlement: 0, accrualPerMonth: 0 },
  { code: "CO", name: "Compensatory Off", annualEntitlement: 6, accrualPerMonth: 0.5 },
] as const;

/** Bihar-relevant observances plus national holidays. FR-M8-12 / X-16g. */
export const HOLIDAYS_2026 = [
  { date: "2026-01-26", name: "Republic Day" },
  { date: "2026-03-04", name: "Holi" },
  { date: "2026-03-21", name: "Ram Navami" },
  { date: "2026-04-14", name: "Bihar Diwas Observance" },
  { date: "2026-05-01", name: "Labour Day" },
  { date: "2026-08-15", name: "Independence Day" },
  { date: "2026-10-02", name: "Gandhi Jayanti" },
  { date: "2026-10-20", name: "Dussehra" },
  { date: "2026-11-08", name: "Diwali" },
  { date: "2026-11-15", name: "Chhath Puja" },
  { date: "2026-11-16", name: "Chhath Puja (Second Day)" },
  { date: "2026-12-25", name: "Christmas" },
] as const;

export const DEPARTMENTS = [
  "Sales", "Service", "Projects", "Accounts", "Stores", "HR & Admin", "Management",
] as const;

export const OBSERVATION_PRESETS: Record<string, string[]> = {
  COMPRESSOR: [
    "Unit running with elevated discharge temperature",
    "Excessive oil carry-over observed at outlet",
    "Air filter found choked, differential high",
    "Belt tension slack, minor squeal at start",
    "Auto drain not operating, condensate accumulation",
    "Load-unload cycling more frequent than normal",
    "Unusual noise from air end at full load",
    "Pressure not building to set point",
  ],
  PUMP: [
    "Gland leakage beyond acceptable limit",
    "Vibration at bearing housing above normal",
    "Suction pressure fluctuating, possible cavitation",
    "Discharge head below rated duty point",
    "Motor drawing current above nameplate",
    "Coupling alignment found disturbed",
  ],
  GARAGE: [
    "Hydraulic creep observed on lift under load",
    "Safety lock not engaging on one side",
    "Air leak at coupler connection",
    "Gauge reading inconsistent with reference",
    "Dispensing meter over-reading on calibration check",
  ],
  TREATMENT: [
    "Dosing pump output below set rate",
    "Resin bed showing channelling",
    "Backwash cycle timing drifted",
    "Membrane differential pressure rising",
  ],
};

export const WORK_PRESETS: Record<string, string[]> = {
  COMPRESSOR: [
    "Replaced air filter element and reset differential indicator",
    "Replaced oil filter and topped up compressor oil",
    "Replaced air-oil separator, checked scavenge line",
    "Cleaned cooler core, verified approach temperature",
    "Adjusted belt tension and verified alignment",
    "Serviced auto drain valve, verified condensate discharge",
    "Overhauled intake valve, tested load-unload operation",
    "Carried out scheduled preventive maintenance as per checklist",
  ],
  PUMP: [
    "Replaced mechanical seal and tested for leakage",
    "Replaced bearing set and re-greased housing",
    "Corrected coupling alignment within tolerance",
    "Replaced wear ring and restored clearance",
    "Carried out performance test against duty point",
  ],
  GARAGE: [
    "Replaced hydraulic cylinder seal kit and bled system",
    "Repaired safety lock assembly and function-tested",
    "Replaced high pressure hose and pressure-tested",
    "Calibrated gauge against reference standard",
  ],
  TREATMENT: [
    "Replaced dosing pump diaphragm and re-calibrated output",
    "Regenerated resin bed and verified outlet quality",
    "Reset backwash timer and verified cycle",
    "Replaced membrane cartridge and logged differential",
  ],
};

const PRODUCT_LINE_SHORT: Record<ProductLine, string> = {
  PISTON_COMPRESSOR: "Piston Compressor",
  SCREW_COMPRESSOR: "Screw Compressor",
  OIL_FREE_COMPRESSOR: "Oil Free Compressor",
  PORTABLE_COMPRESSOR: "Portable Compressor",
  DIRECT_DRIVE_COMPRESSOR: "Direct Drive Compressor",
  AIR_ACCESSORY: "Air Dryer",
  BODY_SHOP_EQUIPMENT: "Body Shop Equipment",
  LUBE_EQUIPMENT: "Lube Equipment",
  WASHING_EQUIPMENT: "Washing Equipment",
  LIFTING_EQUIPMENT: "Lifting Equipment",
  PNEUMATIC_TOOL: "Pneumatic Tool",
  TYRE_INFLATOR: "Tyre Inflator",
  PUMP: "Pump",
  WATER_TREATMENT: "Water Treatment Package",
  PPR_PIPING: "PPR Piping",
};

/** Short catalogue label used in item descriptions and asset models. */
export function productLineLabel(pl: ProductLine): string {
  return PRODUCT_LINE_SHORT[pl];
}

export function machineFamily(pl: ProductLine): keyof typeof OBSERVATION_PRESETS {
  if (pl === "PUMP") return "PUMP";
  if (pl === "WATER_TREATMENT") return "TREATMENT";
  if (
    pl === "BODY_SHOP_EQUIPMENT" || pl === "LUBE_EQUIPMENT" || pl === "WASHING_EQUIPMENT" ||
    pl === "LIFTING_EQUIPMENT" || pl === "PNEUMATIC_TOOL" || pl === "TYRE_INFLATOR"
  ) return "GARAGE";
  return "COMPRESSOR";
}

export const COMMISSIONING_CHECKLIST = [
  "Foundation level and grouting verified",
  "Electrical supply voltage and phase sequence checked",
  "Earthing continuity and resistance measured",
  "Inlet piping and isolation valve installed",
  "Condensate drain routed to trap",
  "Oil level verified against sight glass",
  "Direction of rotation confirmed",
  "Safety relief valve setting verified",
  "Load-unload pressure set points configured",
  "No-load and full-load current recorded",
  "Ambient ventilation adequacy confirmed",
  "Operator training completed and acknowledged",
] as const;

export const OEM_COMMISSIONING_WINDOW_DAYS: Record<OEMPrincipal, number> = {
  ELGI: 7,
  ATS_ELGI: 7,
  KSB: 10,
  ION_EXCHANGE: 15,
  OTHER: 7,
};

export const BOQ_SECTIONS = [
  "Civil Works",
  "Mechanical Supply",
  "Electrical & Instrumentation",
  "Erection & Commissioning",
  "Operation & Maintenance",
] as const;

export const BOQ_TEMPLATES: Record<string, { desc: string; uom: string; rate: [number, number] }[]> = {
  "Civil Works": [
    { desc: "Earthwork in excavation for tank foundation including shoring", uom: "Cum", rate: [280, 480] },
    { desc: "PCC 1:4:8 in foundation bed", uom: "Cum", rate: [4200, 5800] },
    { desc: "RCC M25 in raft, walls and slab including shuttering", uom: "Cum", rate: [7400, 9800] },
    { desc: "Reinforcement steel Fe500 cut, bent and placed", uom: "MT", rate: [68000, 82000] },
    { desc: "Brick masonry in CM 1:6 for chambers", uom: "Cum", rate: [5400, 6800] },
    { desc: "Waterproofing treatment to tank internal surfaces", uom: "Sqm", rate: [420, 680] },
    { desc: "Anti-corrosive epoxy coating to concrete surfaces", uom: "Sqm", rate: [340, 540] },
  ],
  "Mechanical Supply": [
    { desc: "Supply of coarse and fine bar screen assembly", uom: "Nos", rate: [68000, 142000] },
    { desc: "Supply of submersible raw sewage pump with accessories", uom: "Nos", rate: [185000, 420000] },
    { desc: "Supply of twin-lobe air blower with acoustic enclosure", uom: "Nos", rate: [240000, 580000] },
    { desc: "Supply of fine bubble diffuser assembly", uom: "Nos", rate: [1800, 3400] },
    { desc: "Supply of tube settler media", uom: "Sqm", rate: [2400, 3800] },
    { desc: "Supply of pressure sand and activated carbon filter", uom: "Nos", rate: [148000, 320000] },
    { desc: "Supply of chemical dosing system with tank and pump", uom: "Set", rate: [96000, 210000] },
    { desc: "Supply of MS piping, valves and specials", uom: "MT", rate: [92000, 118000] },
    { desc: "Supply of sludge dewatering filter press", uom: "Nos", rate: [420000, 980000] },
  ],
  "Electrical & Instrumentation": [
    { desc: "Supply and installation of MCC panel with starters", uom: "Nos", rate: [280000, 620000] },
    { desc: "Power and control cabling with laying and termination", uom: "Mtr", rate: [180, 420] },
    { desc: "Cable tray and support system", uom: "Mtr", rate: [420, 780] },
    { desc: "Earthing station with strip and electrode", uom: "Nos", rate: [12000, 22000] },
    { desc: "Level transmitter and flow meter with indication", uom: "Nos", rate: [42000, 96000] },
    { desc: "PLC-based control with HMI and field wiring", uom: "Set", rate: [320000, 720000] },
  ],
  "Erection & Commissioning": [
    { desc: "Erection of mechanical equipment including alignment", uom: "MT", rate: [18000, 28000] },
    { desc: "Erection of piping including welding and testing", uom: "MT", rate: [22000, 34000] },
    { desc: "Hydraulic testing of tanks and pipelines", uom: "LS", rate: [64000, 128000] },
    { desc: "Trial run, stabilisation and performance guarantee test", uom: "LS", rate: [120000, 280000] },
  ],
  "Operation & Maintenance": [
    { desc: "Comprehensive O&M including manpower and consumables", uom: "Month", rate: [64000, 148000] },
    { desc: "Supply of O&M consumables and chemicals", uom: "Month", rate: [22000, 48000] },
  ],
};

export const HINDRANCE_CAUSES = [
  { cause: "WEATHER" as const, text: "Continuous rainfall; excavation and concreting suspended" },
  { cause: "CLIENT_APPROVAL" as const, text: "Awaiting client approval on revised GA drawing" },
  { cause: "MATERIAL" as const, text: "Blower consignment delayed in transit from supplier" },
  { cause: "LABOUR" as const, text: "Skilled welders unavailable due to festival period" },
  { cause: "ACCESS" as const, text: "Site access restricted by parallel civil agency work" },
  { cause: "DRAWING" as const, text: "Discrepancy in foundation drawing referred to consultant" },
];

export const LOSS_REASON_WEIGHTS = [
  ["PRICE", 34],
  ["DELIVERY_LEAD_TIME", 24],
  ["TECHNICAL_FIT", 13],
  ["COMPETITOR_RELATIONSHIP", 11],
  ["BUDGET_WITHDRAWN", 8],
  ["NO_DECISION", 7],
  ["OTHER", 3],
] as const;

export const COMPETITORS = [
  "Atlas Copco", "Ingersoll Rand", "Kirloskar Pneumatic", "Chicago Pneumatic",
  "Kaeser", "Grundfos", "Crompton", "Local fabricator", "Thermax",
] as const;
