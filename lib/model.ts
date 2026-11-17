// The token radar model "radar-4": size curve + blind test + netted farm.
// Follows DESIGN-V3.md exactly with §10 review corrections.

export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  breadth_weight: number;
  max_breadth_chains: number;
  // v3 Assumptions
  p_airdrop: number;
  p_qualify: number;
  farmer_allocation_fdv: number;
  annual_opportunity_cost: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.6,
  growth_floor: -50,
  growth_cap: 150,
  maturity_floor: 0.55,
  maturity_range: 0.45,
  maturity_days: 1460,
  unknown_age_days: 365,
  breadth_weight: 0.02,
  max_breadth_chains: 10,
  p_airdrop: 0.7,
  p_qualify: 0.5,
  farmer_allocation_fdv: 0.05,
  annual_opportunity_cost: 0.05,
};

export const MODEL_VERSION = 'radar-4';

export interface OOSMetric {
  median_f: number;
  mean_log_err: number;
  p90_log_err: number;
  r2: number;
  n: number;
}

export interface OOSResult {
  time_split: {
    global_median: OOSMetric;
    radar3: OOSMetric;
    radar4_no_priors: OOSMetric;
    radar4_with_priors: OOSMetric;
  };
  random_split: {
    global_median: OOSMetric;
    radar3: OOSMetric;
    radar4_no_priors: OOSMetric;
    radar4_with_priors: OOSMetric;
  };
}

export interface CategoryData {
  category: string;
  n: number;
  shift: number;
  multiple?: number; // for radar-3 compat
  comps: { name: string; ratio: number }[];
}

export interface CurveCoefficients {
  a: number;
  b: number;
  b_ci: [number, number];
}

export interface CalibrationData {
  curve: CurveCoefficients;
  categories: CategoryData[];
  global_median: number;
  oos: OOSResult;
  priors_dropped: boolean;
}

export interface FarmLedgerStep {
  text: string;
  cost_usd: number;
  time: string;
}

export interface FarmLedger {
  steps: FarmLedgerStep[];
  total_cost_usd: number;
  opportunity_cost_usd: number;
  expected_value_usd: number;
  net_usd: number;
  net_range_usd: [number, number];
  verdict: 'FARM' | 'THIN' | 'SKIP';
  reason: string;
}

export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  bootstrap_band: [number, number];
  net_farm_usd: number;
  verdict: 'FARM' | 'THIN' | 'SKIP';
  model: {
    curve_a: number;
    curve_b: number;
    category_shift: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    priors_dropped: boolean;
  };
  farm_ledger: FarmLedger;
  farm_steps: string[]; // for board compat
}

export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  calibration: CalibrationData;
  rows: RadarRow[];
  live: LiveRow[];
  oos: OOSResult;
}

export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  implied_value_usd: number;
  bootstrap_low: number;
  bootstrap_high: number;
  bootstrap_band: [number, number];
  net_farm_usd: number;
  verdict: 'FARM' | 'THIN' | 'SKIP';
  model: {
    curve_a: number;
    curve_b: number;
    category_shift: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    priors_dropped: boolean;
  };
  farm_ledger: FarmLedger;
  farm_steps: string[];
}

export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
}

const DAY_MS = 86_400_000;

// Deterministic PRNG: mulberry32
function mulberry32(a: number) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

function computeMedian(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

// OLS: y = a + b*x
function fitOLS(xs: number[], ys: number[]): { a: number; b: number; r2: number } {
  const n = xs.length;
  if (n < 2) return { a: 0, b: 0, r2: 0 };
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, sumYY = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i]!;
    sumY += ys[i]!;
    sumXY += xs[i]! * ys[i]!;
    sumXX += xs[i]! * xs[i]!;
    sumYY += ys[i]! * ys[i]!;
  }
  const b = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const a = (sumY - b * sumX) / n;
  
  const yMean = sumY / n;
  let ssRes = 0, ssTot = 0;
  for (let i = 0; i < n; i++) {
    const yPred = a + b * xs[i]!;
    ssRes += (ys[i]! - yPred) ** 2;
    ssTot += (ys[i]! - yMean) ** 2;
  }
  const r2 = ssTot === 0 ? 1 : 1 - (ssRes / ssTot);
  return { a, b, r2 };
}

function getMetric(actuals: number[], preds: number[]): OOSMetric {
  const n = actuals.length;
  if (n === 0) return { median_f: 0, mean_log_err: 0, p90_log_err: 0, r2: 0, n: 0 };
  const logErrors = actuals.map((a, i) => Math.abs(Math.log10(preds[i]! / a)));
  const medianLogErr = computeMedian(logErrors);
  const meanLogErr = logErrors.reduce((a, b) => a + b, 0) / n;
  const p90LogErr = [...logErrors].sort((a, b) => a - b)[Math.floor(n * 0.9)] ?? 0;
  
  const logActuals = actuals.map(a => Math.log10(a));
  const logPreds = preds.map(p => Math.log10(p));
  const { r2 } = fitOLS(logPreds, logActuals); // R2 of the log fit

  return {
    median_f: Math.pow(10, medianLogErr),
    mean_log_err: meanLogErr,
    p90_log_err: p90LogErr,
    r2,
    n
  };
}

export function computeRadar4(train: SnapshotProtocol[], test: SnapshotProtocol[], asOf: string, model: ModelConstants) {
  const trainComps = train.filter(p => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
  const xs = trainComps.map(p => Math.log10(p.tvl_usd));
  const ys = trainComps.map(p => Math.log10(p.mcap_usd!));
  const { a, b } = fitOLS(xs, ys);

  const residuals = trainComps.map(p => Math.log10(p.mcap_usd!) - (a + b * Math.log10(p.tvl_usd)));
  const byCat = new Map<string, number[]>();
  for (let i = 0; i < trainComps.length; i++) {
    const cat = trainComps[i]!.category ?? 'General';
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat)!.push(residuals[i]!);
  }

  const shifts = new Map<string, number>();
  for (const [cat, res] of byCat.entries()) {
    if (res.length >= 5) {
      const s = computeMedian(res);
      shifts.set(cat, Math.max(-0.30, Math.min(0.30, s)));
    } else {
      shifts.set(cat, 0);
    }
  }

  const predict = (p: SnapshotProtocol, withPriors: boolean) => {
    const shift = shifts.get(p.category ?? 'General') ?? 0;
    let val = Math.pow(10, a + b * Math.log10(p.tvl_usd) + shift);
    val = Math.max(p.tvl_usd * 0.03, Math.min(p.tvl_usd * 0.80, val));
    if (withPriors) {
      const priors = getPriors(p, asOf, model);
      val *= priors.growthMult * priors.maturityMult * priors.breadthMult;
    }
    return Math.max(1, val);
  };

  const testActuals = test.filter(p => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
  const actuals = testActuals.map(p => p.mcap_usd!);
  const predsNo = testActuals.map(p => predict(p, false));
  const predsWith = testActuals.map(p => predict(p, true));

  return {
    a, b, shifts,
    metricNo: getMetric(actuals, predsNo),
    metricWith: getMetric(actuals, predsWith)
  };
}

function getPriors(p: SnapshotProtocol, asOf: string, model: ModelConstants) {
  const age = ageDays(asOf, p.listed_at);
  const rawGrowth = finite(p.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = growthPct >= 0 ? 1 + (growthPct / 100) * model.growth_weight : 1 + (growthPct / 100) * 0.9;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + model.maturity_range * (Math.log(1 + Math.min(ageForModel, model.maturity_days)) / Math.log(1 + model.maturity_days));
  const breadthMult = 1 + model.breadth_weight * Math.min(Math.max(p.chains.length - 1, 0), model.max_breadth_chains);
  return { growthMult, maturityMult, breadthMult, age };
}

function shuffle<T>(array: T[], rng: () => number): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

export function computeCalibration(snapshot: Snapshot, model: ModelConstants): CalibrationData {
  const comps = snapshot.protocols.filter(p => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
  
  // 1. Time split
  const sortedByTime = [...comps].sort((a, b) => {
    const da = a.listed_at ? Date.parse(a.listed_at) : 0;
    const db = b.listed_at ? Date.parse(b.listed_at) : 0;
    return da - db;
  });
  const mid = Math.floor(sortedByTime.length / 2);
  const trainTime = sortedByTime.slice(0, mid);
  const testTime = sortedByTime.slice(mid);

  // 2. Random split
  const rng = mulberry32(hashString(snapshot.as_of));
  const shuffled = shuffle(comps, rng);
  const splitIdx = Math.floor(shuffled.length * 0.8);
  const trainRand = shuffled.slice(0, splitIdx);
  const testRand = shuffled.slice(splitIdx);

  const runOOS = (train: SnapshotProtocol[], test: SnapshotProtocol[]) => {
    const testComps = test.filter(p => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
    const actuals = testComps.map(p => p.mcap_usd!);
    
    // Global Median (Radar-3 logic)
    const globalMedianRaw = computeMedian(train.map(p => p.mcap_usd! / p.tvl_usd));
    const globalMedian = Math.max(0.03, Math.min(0.80, globalMedianRaw));
    const predsGlobal = testComps.map(p => p.tvl_usd * globalMedian);
    
    // Radar-3 (Category Median)
    const catMedians = new Map<string, number>();
    const byCat = new Map<string, number[]>();
    for (const p of train) {
      const cat = p.category ?? 'General';
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat)!.push(p.mcap_usd! / p.tvl_usd);
    }
    for (const [cat, rs] of byCat.entries()) {
      const rawCatMedian = computeMedian(rs);
      const clampedCat = Math.max(0.03, Math.min(0.80, rawCatMedian));
      if (rs.length >= 5) catMedians.set(cat, clampedCat);
    }
    const predsR3 = testComps.map(p => {
      const m = catMedians.get(p.category ?? 'General') ?? globalMedian;
      return p.tvl_usd * m;
    });

    const r4 = computeRadar4(train, test, snapshot.as_of, model);

    return {
      global_median: getMetric(actuals, predsGlobal),
      radar3: getMetric(actuals, predsR3),
      radar4_no_priors: r4.metricNo,
      radar4_with_priors: r4.metricWith,
      best: r4.metricWith.mean_log_err < r4.metricNo.mean_log_err ? 'with' : 'no'
    };
  };

  const oosTime = runOOS(trainTime, testTime);
  const oosRand = runOOS(trainRand, testRand);

  const oos: OOSResult = {
    time_split: {
      global_median: oosTime.global_median,
      radar3: oosTime.radar3,
      radar4_no_priors: oosTime.radar4_no_priors,
      radar4_with_priors: oosTime.radar4_with_priors,
    },
    random_split: {
      global_median: oosRand.global_median,
      radar3: oosRand.radar3,
      radar4_no_priors: oosRand.radar4_no_priors,
      radar4_with_priors: oosRand.radar4_with_priors,
    }
  };

  // Ablation: drop priors if they worsen error on BOTH splits (or just check overall?)
  // DESIGN says: IF priors worsen held-out error, DROP the priors
  const meanErrWith = (oosTime.radar4_with_priors.mean_log_err + oosRand.radar4_with_priors.mean_log_err) / 2;
  const meanErrNo = (oosTime.radar4_no_priors.mean_log_err + oosRand.radar4_no_priors.mean_log_err) / 2;
  const priors_dropped = meanErrWith > meanErrNo;

  // Final fit on all comps
  const xs = comps.map(p => Math.log10(p.tvl_usd));
  const ys = comps.map(p => Math.log10(p.mcap_usd!));
  const { a, b } = fitOLS(xs, ys);

  // Slope CI via bootstrap (simple)
  const b_samples: number[] = [];
  const fitRng = mulberry32(hashString(snapshot.as_of + "_fit"));
  for (let i = 0; i < 100; i++) {
    const bxs: number[] = [], bys: number[] = [];
    for (let j = 0; j < comps.length; j++) {
      const idx = Math.floor(fitRng() * comps.length);
      bxs.push(xs[idx]!);
      bys.push(ys[idx]!);
    }
    b_samples.push(fitOLS(bxs, bys).b);
  }
  b_samples.sort((a, b) => a - b);
  const b_ci: [number, number] = [b_samples[5]!, b_samples[95]!];

  const resids = comps.map(p => Math.log10(p.mcap_usd!) - (a + b * Math.log10(p.tvl_usd)));
  const catResids = new Map<string, { ratios: number[], resids: number[], comps: {name: string, ratio: number}[] }>();
  for (let i = 0; i < comps.length; i++) {
    const cat = comps[i]!.category ?? 'General';
    if (!catResids.has(cat)) catResids.set(cat, { ratios: [], resids: [], comps: [] });
    catResids.get(cat)!.ratios.push(comps[i]!.mcap_usd! / comps[i]!.tvl_usd);
    catResids.get(cat)!.resids.push(resids[i]!);
    catResids.get(cat)!.comps.push({ name: comps[i]!.name, ratio: round4(comps[i]!.mcap_usd! / comps[i]!.tvl_usd) });
  }

  const categories: CategoryData[] = [];
  for (const [cat, data] of catResids.entries()) {
    const shift = data.resids.length >= 5 ? Math.max(-0.30, Math.min(0.30, computeMedian(data.resids))) : 0;
    data.comps.sort((a, b) => b.ratio - a.ratio);
    categories.push({ category: cat, n: data.resids.length, shift, comps: data.comps });
  }

  return {
    curve: { a, b, b_ci },
    categories,
    global_median: computeMedian(comps.map(p => p.mcap_usd! / p.tvl_usd)),
    oos,
    priors_dropped
  };
}

export function getGasTable(chain: string): number {
  const c = chain.toLowerCase();
  if (c.includes('ethereum')) return 2.0;
  if (c.includes('solana')) return 0.05;
  if (c.includes('bsc') || c.includes('binance')) return 0.15;
  if (c.includes('polygon')) return 0.05;
  if (c.includes('arbitrum')) return 0.1;
  if (c.includes('optimism')) return 0.1;
  if (c.includes('base')) return 0.05;
  if (c.includes('avalanche')) return 0.15;
  return 0.1; // Default
}

function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its primary chain';
}

function gasTokenFor(chain: string): string {
  const c = chain.toLowerCase();
  if (c.includes('solana')) return 'SOL';
  if (c.includes('bsc') || c.includes('binance')) return 'BNB';
  if (c.includes('polygon') || c.includes('matic')) return 'POL';
  if (c.includes('avalanche')) return 'AVAX';
  if (c.includes('tron')) return 'TRX';
  if (c.includes('sui')) return 'SUI';
  if (c.includes('aptos')) return 'APT';
  if (c.includes('near')) return 'NEAR';
  if (c.includes('ton')) return 'TON';
  return 'ETH';
}

function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) {
    return `Supply $${capital} of USDC or stable assets to ${name} on ${chain} and maintain healthy collateralization.`;
  }
  if (c.includes('dex') || c.includes('yield') || c.includes('farm') || c.includes('liquidity')) {
    return `Provide $${capital} of liquidity to ${name} on ${chain} and stake LP tokens in their reward pool.`;
  }
  if (c.includes('bridge') || c.includes('cross chain')) {
    return `Transfer $${capital} of assets via ${name} across ${chain} and utilize active route destinations.`;
  }
  if (c.includes('stake') || c.includes('restak')) {
    return `Stake $${capital} equivalent of network assets through ${name} and hold the receipt token.`;
  }
  if (c.includes('derivative') || c.includes('perpetual')) {
    return `Deposit $${capital} margin on ${name} and open a hedged delta-neutral position.`;
  }
  if (c.includes('rwa') || c.includes('stablecoin')) {
    return `Mint or deposit $${capital} of yield-bearing asset on ${name} via ${chain}.`;
  }
  return `Deposit $${capital} into ${name} on ${chain} and maintain active interaction.`;
}

function riskFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp')) {
    return `Monitor liquidation thresholds closely if borrowing against volatile collateral.`;
  }
  if (c.includes('dex') || c.includes('yield') || c.includes('farm')) {
    return `Watch for impermanent loss and shifting emission reward APRs during high volatility.`;
  }
  if (c.includes('bridge')) {
    return `Verify cross-chain validator finality and messaging security assumptions.`;
  }
  if (c.includes('stake') || c.includes('restak')) {
    return `Be mindful of validator slashing risks and unbonding delay periods.`;
  }
  return `Keep track of protocol upgrade governance proposals and smart contract security updates.`;
}

export function buildFarmLedger(p: SnapshotProtocol, age: number | null, implied: number, band: [number, number], model: ModelConstants): FarmLedger {
  const chain = chainOf(p);
  const gas = getGasTable(chain);
  const gasToken = gasTokenFor(chain);
  const capital = p.tvl_usd >= 1e9 ? 250 : p.tvl_usd >= 1e8 ? 150 : p.tvl_usd >= 5e7 ? 100 : 50;
  const hold = age === null ? 30 : age < 180 ? 60 : age < 365 ? 45 : 30;
  const action = actionFor(p, capital, chain);
  const risk = riskFor(p);

  const steps: FarmLedgerStep[] = [
    { text: `Set up a clean dedicated wallet funded with operational funds.`, cost_usd: 0.1, time: '5m' },
    { text: action, cost_usd: gas, time: '15m' },
    { text: `Perform one recurring weekly qualifying action like compounding yields.`, cost_usd: gas * 4, time: '10m weekly' },
    { text: `Hold the active position undisturbed for at least ${hold} consecutive days.`, cost_usd: 0, time: `${hold}d` },
    { text: `Check official reward portals strictly through verified documentation links.`, cost_usd: 0, time: '10m' },
    { text: risk, cost_usd: 0, time: '5m' },
    { text: `Log wallet addresses, entry timestamps, and tx hashes in your farm journal.`, cost_usd: 0, time: '5m' }
  ];

  const total_cost_gas = steps.reduce((a, b) => a + b.cost_usd, 0);
  const opportunity_cost = capital * model.annual_opportunity_cost * (hold / 365);
  const total_cost = total_cost_gas + opportunity_cost;
  
  const expected_value = implied * model.p_airdrop * model.p_qualify * model.farmer_allocation_fdv;
  const net = expected_value - total_cost;
  
  const net_low = band[0] * model.p_airdrop * model.p_qualify * model.farmer_allocation_fdv - total_cost;
  const net_high = band[1] * model.p_airdrop * model.p_qualify * model.farmer_allocation_fdv - total_cost;

  let verdict: 'FARM' | 'THIN' | 'SKIP' = 'SKIP';
  if (net >= 100) verdict = 'FARM';
  else if (net >= 0) verdict = 'THIN';

  return {
    steps,
    total_cost_usd: round4(total_cost),
    opportunity_cost_usd: round4(opportunity_cost),
    expected_value_usd: Math.round(expected_value),
    net_usd: Math.round(net),
    net_range_usd: [Math.round(net_low), Math.round(net_high)],
    verdict,
    reason: `Net expected $${Math.round(net)} (range $${Math.round(net_low)}-$${Math.round(net_high)}) after $${Math.round(total_cost)} cost.`
  };
}

export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const cal = computeCalibration(snapshot, model);
  const rng = mulberry32(hashString(snapshot.as_of + "_boot"));
  
  const getImplied = (p: SnapshotProtocol, a: number, b: number, shifts: Map<string, number>, priorsDropped: boolean) => {
    const shift = shifts.get(p.category ?? 'General') ?? 0;
    let val = Math.pow(10, a + b * Math.log10(p.tvl_usd) + shift);
    val = Math.max(p.tvl_usd * 0.03, Math.min(p.tvl_usd * 0.80, val));
    const priors = getPriors(p, snapshot.as_of, model);
    if (!priorsDropped) {
      val *= priors.growthMult * priors.maturityMult * priors.breadthMult;
    }
    return { implied: Math.round(val), priors, shift };
  };

  const comps = snapshot.protocols.filter(p => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
  const bootResults = snapshot.protocols.map(() => [] as number[]);
  
  // Bootstrap
  for (let i = 0; i < 200; i++) {
    const sample: SnapshotProtocol[] = [];
    for (let j = 0; j < comps.length; j++) {
      sample.push(comps[Math.floor(rng() * comps.length)]!);
    }
    const sxs = sample.map(p => Math.log10(p.tvl_usd));
    const sys = sample.map(p => Math.log10(p.mcap_usd!));
    const { a, b } = fitOLS(sxs, sys);
    
    const resids = sample.map(p => Math.log10(p.mcap_usd!) - (a + b * Math.log10(p.tvl_usd)));
    const sByCat = new Map<string, number[]>();
    for (let j = 0; j < sample.length; j++) {
      const cat = sample[j]!.category ?? 'General';
      if (!sByCat.has(cat)) sByCat.set(cat, []);
      sByCat.get(cat)!.push(resids[j]!);
    }
    const sShifts = new Map<string, number>();
    for (const [cat, rs] of sByCat.entries()) {
      if (rs.length >= 5) sShifts.set(cat, Math.max(-0.30, Math.min(0.30, computeMedian(rs))));
    }

    for (let j = 0; j < snapshot.protocols.length; j++) {
      const { implied } = getImplied(snapshot.protocols[j]!, a, b, sShifts, cal.priors_dropped);
      bootResults[j]!.push(implied);
    }
  }

  const shiftsMap = new Map(cal.categories.map(c => [c.category, c.shift]));
  const rows = snapshot.protocols
    .filter(p => isEligible(p))
    .map((p, idx) => {
      const { implied, priors, shift } = getImplied(p, cal.curve.a, cal.curve.b, shiftsMap, cal.priors_dropped);
      const boots = bootResults[snapshot.protocols.indexOf(p)]!.sort((a, b) => a - b);
      const band: [number, number] = [boots[20]!, boots[180]!]; // p10, p90
      const ledger = buildFarmLedger(p, priors.age, implied, band, model);
      
      return {
        slug: p.slug,
        name: p.name,
        category: p.category,
        chains: p.chains,
        tvl_usd: p.tvl_usd,
        change_7d: p.change_7d,
        mcap_usd: p.mcap_usd,
        listed_at: p.listed_at,
        gecko_id: p.gecko_id,
        symbol: p.symbol,
        token_status: 'pre-token' as const,
        age_days: priors.age,
        implied_value_usd: implied,
        bootstrap_band: band,
        net_farm_usd: ledger.net_usd,
        verdict: ledger.verdict,
        model: {
          curve_a: round4(cal.curve.a),
          curve_b: round4(cal.curve.b),
          category_shift: round4(shift),
          growth_multiplier: round4(priors.growthMult),
          maturity_multiplier: round4(priors.maturityMult),
          breadth_multiplier: round4(priors.breadthMult),
          priors_dropped: cal.priors_dropped
        },
        farm_ledger: ledger,
        farm_steps: ledger.steps.map(s => `${s.text}. Cost: $${s.cost_usd}. Time: ${s.time}.`)
      };
    });

  rows.sort((a, b) => b.implied_value_usd - a.implied_value_usd || a.slug.localeCompare(b.slug));
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

const EXCLUDED_CATEGORIES = new Set(['bridge', 'canonical bridge', 'liquid staking', 'liquid restaking', 'restaked btc', 'cex']);
const EXCHANGES = ['binance', 'coinbase', 'bybit', 'kraken', 'bitget', 'okx', 'bitfinex', 'gemini'];
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const WRAPPED_STAKED = /\b(wrapped|staked|staking)\b/i;

export function isEligible(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  const cat = (p.category ?? '').toLowerCase();
  if (EXCLUDED_CATEGORIES.has(cat)) return false;
  const name = p.name;
  const lowerName = name.toLowerCase();
  if (WRAPPED_STAKED.test(name)) return false;
  for (const ex of EXCHANGES) {
    if (lowerName === ex || lowerName.startsWith(ex + ' ') || lowerName.startsWith(ex + '-')) return false;
  }
  if (VERSIONED.test(name)) return false;
  return true;
}

export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const calibration = computeCalibration(snapshot, model);
  const board = buildBoard(snapshot, model);
  const live = snapshot.protocols
    .filter(p => !isPreToken(p) && (p.category ?? '').toLowerCase() !== 'cex')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0))
    .slice(0, 24)
    .map(p => ({
      slug: p.slug, name: p.name, category: p.category, chains: p.chains,
      tvl_usd: p.tvl_usd, mcap_usd: p.mcap_usd
    }));

  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    calibration,
    rows: board.map(r => ({
      rank: r.rank, slug: r.slug, name: r.name, category: r.category, chains: r.chains,
      tvl_usd: r.tvl_usd, implied_value_usd: r.implied_value_usd,
      bootstrap_low: r.bootstrap_band[0], bootstrap_high: r.bootstrap_band[1],
      bootstrap_band: r.bootstrap_band,
      net_farm_usd: r.net_farm_usd, verdict: r.verdict, farm_steps: r.farm_steps,
      model: r.model,
      farm_ledger: r.farm_ledger
    })),
    live,
    oos: calibration.oos
  };
  return { board, radar };
}

export function parseSnapshot(text: string): Snapshot {
  const o = JSON.parse(text);
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols: o.protocols.map((p: any) => ({
      slug: p.slug, name: p.name, category: p.category ?? null,
      chains: p.chains ?? [], tvl_usd: p.tvl_usd,
      change_7d: p.change_7d ?? null, mcap_usd: p.mcap_usd ?? null,
      listed_at: p.listed_at ?? null, gecko_id: p.gecko_id ?? null,
      symbol: p.symbol ?? null
    })),
    watchlist: o.watchlist
  };
}

export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length !== 198) return `expected 198 rows, got ${board.length}`;
  const watchlist = new Set(snapshot.watchlist);
  const foundInWatchlist = board.filter(r => watchlist.has(r.slug)).length;
  if (foundInWatchlist !== 40) return `expected 40/40 watchlist, got ${foundInWatchlist}`;
  
  for (let i = 0; i < board.length; i++) {
    const r = board[i]!;
    if (r.rank !== i + 1) return `rank mismatch at ${i}: expected ${i+1}, got ${r.rank}`;
    if (i > 0 && r.implied_value_usd > board[i-1]!.implied_value_usd) return `implied value non-increasing at rank ${r.rank}`;
    if (r.implied_value_usd <= 0 || !Number.isSafeInteger(r.implied_value_usd)) return `invalid implied value at rank ${r.rank}`;
    if (r.bootstrap_band[0] > r.implied_value_usd || r.implied_value_usd > r.bootstrap_band[1]) return `band inconsistent at rank ${r.rank}`;
    
    // Verdict consistency
    const net = r.net_farm_usd;
    if (r.verdict === 'FARM' && net < 100) return `FARM verdict but net $${net} at rank ${r.rank}`;
    if (r.verdict === 'THIN' && (net < 0 || net >= 100)) return `THIN verdict but net $${net} at rank ${r.rank}`;
    if (r.verdict === 'SKIP' && net >= 0) return `SKIP verdict but net $${net} at rank ${r.rank}`;
    
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) return `invalid farm steps count at rank ${r.rank}`;
    for (const step of r.farm_steps) {
      if (step.length < 20 || step.length > 600) return `invalid farm step length at rank ${r.rank}`;
    }
  }
  return null;
}

export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
