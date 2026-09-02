export const median = (xs: number[]) => percentile(xs, 50);

export function percentile(xs: number[], p: number) {
  if (!xs.length) return 0;
  const a = [...xs].sort((x, y) => x - y),
    i = ((a.length - 1) * p) / 100,
    l = Math.floor(i),
    f = i - l;
  return a[l] + (a[Math.min(l + 1, a.length - 1)] - a[l]) * f;
}

const ranks = (xs: number[]) => {
  const sorted = xs.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v),
    out = Array(xs.length);
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1].v === sorted[i].v) j++;
    const r = (i + j + 2) / 2;
    for (let k = i; k <= j; k++) out[sorted[k].i] = r;
    i = j + 1;
  }
  return out;
};

export function spearman(x: number[], y: number[]) {
  if (x.length !== y.length || x.length < 2) return null;
  const a = ranks(x), b = ranks(y), ma = median(a), mb = median(b);
  let n = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) {
    const ax = a[i] - ma, by = b[i] - mb;
    n += ax * by;
    da += ax * ax;
    db += by * by;
  }
  return da && db ? n / Math.sqrt(da * db) : null;
}

export function relationship(rho: number) {
  const a = Math.abs(rho);
  return `${a < 0.3 ? "Weak" : a < 0.5 ? "Moderate" : "Strong"} ${rho < 0 ? "negative" : "positive"} observed relationship`;
}
