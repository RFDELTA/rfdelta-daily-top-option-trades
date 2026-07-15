export function normCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

export function erf(x: number): number {
  // Abramowitz and Stegun approximation.
  const sign = x >= 0 ? 1 : -1;
  const ax = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * ax);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}

export function blackScholesPrice(args: {
  s: number;
  k: number;
  t: number;
  r: number;
  sigma: number;
  right: "C" | "P";
}): number {
  const { s, k, t, r, right } = args;
  const sigma = Math.max(args.sigma, 1e-6);
  if (t <= 0) {
    return right === "C" ? Math.max(0, s - k) : Math.max(0, k - s);
  }
  const d1 = (Math.log(s / k) + (r + 0.5 * sigma * sigma) * t) / (sigma * Math.sqrt(t));
  const d2 = d1 - sigma * Math.sqrt(t);
  if (right === "C") {
    return s * normCdf(d1) - k * Math.exp(-r * t) * normCdf(d2);
  }
  return k * Math.exp(-r * t) * normCdf(-d2) - s * normCdf(-d1);
}

export function blackScholesDelta(args: {
  s: number;
  k: number;
  t: number;
  r: number;
  sigma: number;
  right: "C" | "P";
}): number {
  const sigma = Math.max(args.sigma, 1e-6);
  if (args.t <= 0) {
    const callDelta = args.s > args.k ? 1 : args.s < args.k ? 0 : 0.5;
    return args.right === "C" ? callDelta : callDelta - 1;
  }
  const d1 = (Math.log(args.s / args.k) + (args.r + 0.5 * sigma * sigma) * args.t) / (sigma * Math.sqrt(args.t));
  const callDelta = normCdf(d1);
  return args.right === "C" ? callDelta : callDelta - 1;
}

export function impliedVolBisection(args: {
  s: number;
  k: number;
  t: number;
  r: number;
  price: number;
  right: "C" | "P";
}): number {
  let lo = 0.01;
  let hi = 8;
  for (let i = 0; i < 70; i += 1) {
    const mid = (lo + hi) / 2;
    const val = blackScholesPrice({ ...args, sigma: mid });
    if (val > args.price) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

export function payoff(st: number, strike: number, right: "C" | "P"): number {
  return right === "C" ? Math.max(st - strike, 0) : Math.max(strike - st, 0);
}
