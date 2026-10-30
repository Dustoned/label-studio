// Beeldbewerking naar puur zwart/wit voor de thermische kop. Pure functies op {data,width,height}.

export const DITHER_MODES = [
	{ id: 'auto', name: 'Automatisch' },
	{ id: 'threshold', name: 'Drempel' },
	{ id: 'floyd', name: 'Floyd-Steinberg' },
	{ id: 'atkinson', name: 'Atkinson' },
	{ id: 'stucki', name: 'Stucki' },
	{ id: 'jarvis', name: 'Jarvis-Judice-Ninke' },
	{ id: 'sierra', name: 'Sierra' },
	{ id: 'bluenoise', name: 'Blauwe ruis (e-ink)' },
	{ id: 'bayer2', name: 'Raster 2×2' },
	{ id: 'bayer4', name: 'Raster 4×4' },
	{ id: 'bayer8', name: 'Raster 8×8' },
	{ id: 'halftone', name: 'Krantenraster' },
	{ id: 'sketch', name: 'Schets (lijnen)' },
];
// Variantenraster in de inspector (klik = deze params op het element zetten). 'auto' eerst = ook 'Reset naar auto'
// en de default van een nieuwe foto (doc.js).
const NEUTRAL = { brightness: 0, contrast: 0, gamma: 1, sharpen: 0, bgCut: 0, threshold: 128, invertImg: false };
// Alle velden die het beeld bepalen (naast fit en de flips): 'Reset naar auto' en de render-cachesleutel.
export const IMAGE_KEYS = ['mode', 'threshold', 'brightness', 'contrast', 'gamma', 'sharpen', 'bgCut', 'invertImg', 'auto', 'localContrast', 'dotGain', 'bleed'];
// Dot-gain van papier + kop: 1 plek om te kalibreren.
const DG = 30;
export const IMAGE_PRESETS = [
	{ id: 'auto', name: 'Auto', params: { ...NEUTRAL, mode: 'auto', auto: true, localContrast: 40, dotGain: DG, bleed: 85 } },
	{ id: 'foto', name: 'Foto', params: { ...NEUTRAL, mode: 'auto', auto: true, localContrast: 60, dotGain: DG, bleed: 90, sharpen: 25 } },
	{ id: 'portret', name: 'Portret', params: { ...NEUTRAL, mode: 'auto', auto: true, localContrast: 20, dotGain: DG, bleed: 80, sharpen: 10 } },
	{ id: 'eink', name: 'E-ink (blauwe ruis)', params: { ...NEUTRAL, mode: 'bluenoise', auto: true, localContrast: 45, dotGain: DG, bleed: 85, sharpen: 15 } },
	{ id: 'logo', name: 'Logo/tekening', params: { ...NEUTRAL, mode: 'auto', auto: true, localContrast: 0, dotGain: 0, bleed: 0, sharpen: 20, bgCut: 15 } },
	{ id: 'schets', name: 'Schets', params: { ...NEUTRAL, mode: 'sketch', threshold: 110, contrast: 20 } },
];

// [deler, dx,dy,gewicht, ...]; dx gespiegeld op oneven rijen (serpentine, minder "wormen").
const KERNELS = {
	floyd: [16, 1,0,7, -1,1,3, 0,1,5, 1,1,1],
	atkinson: [8, 1,0,1, 2,0,1, -1,1,1, 0,1,1, 1,1,1, 0,2,1],
	stucki: [42, 1,0,8, 2,0,4, -2,1,2, -1,1,4, 0,1,8, 1,1,4, 2,1,2, -2,2,1, -1,2,2, 0,2,4, 1,2,2, 2,2,1],
	jarvis: [48, 1,0,7, 2,0,5, -2,1,3, -1,1,5, 0,1,7, 1,1,5, 2,1,3, -2,2,1, -1,2,3, 0,2,5, 1,2,3, 2,2,1],
	sierra: [32, 1,0,5, 2,0,3, -2,1,2, -1,1,4, 0,1,5, 1,1,4, 2,1,2, -1,2,2, 0,2,3, 1,2,2],
};
const HT_CELL = 6, HT_ANGLE = Math.PI / 4;   // ~34 lpi op 203 dpi, 45° zoals krantendruk
// Nieuwe pijplijn (analyse, lokaal contrast, dot-gain, bleed) alleen voor de nieuwe modes: oude docs printen exact als vroeger.
export const PRO = new Set(['auto', 'bluenoise']);

const c255 = v => v < 0 ? 0 : v > 255 ? 255 : v;
const num = (v, d) => Number.isFinite(+v) && v !== '' && v !== null ? +v : d;
function bayer(n) {
	if (n === 1) return [0];
	const h = n / 2, s = bayer(h), m = new Array(n * n);
	for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) m[y * n + x] = 4 * s[(y % h) * h + (x % h)] + [0, 2, 3, 1][(y >= h ? 2 : 0) + (x >= h ? 1 : 0)];
	return m;
}
const B = { 2: bayer(2), 4: bayer(4), 8: bayer(8) };

// bl = error-bleed: alleen dat deel van de fout doorgeven (< 1 tegen modder/wormen in vlakke stukken).
// Kwantiseert op 128; de Drempel komt er vooraf als geklemde bias bij (zie MODES en pro).
function diffuse(g, w, h, k, bl = 1) {
	const o = new Uint8Array(w * h), div = k[0];
	for (let y = 0; y < h; y++) {
		const rev = y & 1;
		for (let s = 0; s < w; s++) {
			const x = rev ? w - 1 - s : s, i = y * w + x, v = g[i], nv = v < 128 ? 0 : 255, e = (v - nv) * bl / div;
			o[i] = nv;
			for (let q = 1; q < k.length; q += 3) {
				const xx = x + (rev ? -k[q] : k[q]), yy = y + k[q + 1];
				if (xx >= 0 && xx < w && yy < h) g[yy * w + xx] += e * k[q + 2];
			}
		}
	}
	return o;
}

function ordered(g, w, h, thr, n) {
	const m = B[n], nn = n * n, b = 128 - thr, o = new Uint8Array(w * h);
	for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; o[i] = g[i] + b < (m[(y % n) * n + (x % n)] + .5) / nn * 255 ? 0 : 255; }
	return o;
}

// Void-and-cluster (Ulichney): drempelmatrix 64×64 met blauwe-ruisspectrum, 1× gemaakt (vaste seed = altijd dezelfde print).
const BN = 64;
let blue = null;
function blueNoise() {
	if (blue) return blue;
	const N = BN, S = N * N, M = N - 1, RK = 6, sig2 = 2 * 1.5 * 1.5, K = [];
	for (let dy = -RK; dy <= RK; dy++) for (let dx = -RK; dx <= RK; dx++) K.push(dx, dy, Math.exp(-(dx * dx + dy * dy) / sig2));
	const E = new Float64Array(S), on = new Uint8Array(S), rank = new Int32Array(S);
	const put = (i, s) => { const x = i & M, y = i >> 6; on[i] = s > 0 ? 1 : 0; for (let q = 0; q < K.length; q += 3) E[((y + K[q + 1]) & M) * N + ((x + K[q]) & M)] += s * K[q + 2]; };
	const pick = (want, best) => { let j = -1, b = 0; for (let i = 0; i < S; i++) if (on[i] === want && (j < 0 || best(E[i], b))) { j = i; b = E[i]; } return j; };
	const cluster = () => pick(1, (e, b) => e > b), voids = () => pick(0, (e, b) => e < b);
	let seed = 0x9e3779b9;
	const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
	const n0 = Math.round(S / 10);
	for (let c = 0; c < n0;) { const i = rnd() * S | 0; if (!on[i]) { put(i, 1); c++; } }
	for (let it = 0; it < S; it++) { const c = cluster(); put(c, -1); const v = voids(); put(v, 1); if (v === c) break; }   // spreiden tot stabiel
	const E0 = E.slice(), on0 = on.slice();
	for (let r = n0 - 1; r >= 0; r--) { const c = cluster(); rank[c] = r; put(c, -1); }
	E.set(E0); on.set(on0);
	// Energie van de enen: grootste leegte = laagste energie, ook voorbij de helft (daar = dichtste cluster van de nullen).
	for (let r = n0; r < S; r++) { const v = voids(); rank[v] = r; put(v, 1); }
	blue = new Float32Array(S);
	for (let i = 0; i < S; i++) blue[i] = (rank[i] + .5) / S * 255;
	return blue;
}
// Geen drempel hier: pro() telt de bias al vóór papierwit op.
function blueDither(g, w, h) {
	const m = blueNoise(), o = new Uint8Array(w * h);
	for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; o[i] = g[i] < m[(y & (BN - 1)) * BN + (x & (BN - 1))] ? 0 : 255; }
	return o;
}

// Deel van een eenheidscel binnen straal r: zo krijgt elke grijswaarde exact zijn zwart-oppervlak.
function diskArea(r) {
	if (r <= .5) return Math.PI * r * r;
	if (r >= Math.SQRT1_2) return 1;
	return Math.PI * r * r - 4 * (r * r * Math.acos(.5 / r) - .5 * Math.sqrt(r * r - .25));
}

function halftone(g, w, h, thr) {
	const c = Math.cos(HT_ANGLE) / HT_CELL, s = Math.sin(HT_ANGLE) / HT_CELL, b = 128 - thr, o = new Uint8Array(w * h);
	for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
		const i = y * w + x, u = (x + .5) * c + (y + .5) * s, v = (y + .5) * c - (x + .5) * s;
		const dark = 1 - c255(g[i] + b) / 255, r = Math.hypot(u - Math.floor(u) - .5, v - Math.floor(v) - .5);
		o[i] = dark >= .999 || dark > diskArea(r) ? 0 : 255;
	}
	return o;
}

function sketch(g, w, h, thr) {
	const o = new Uint8Array(w * h), T = (256 - thr) * 2, at = (x, y) => g[(y < 0 ? 0 : y >= h ? h - 1 : y) * w + (x < 0 ? 0 : x >= w ? w - 1 : x)];
	for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
		const gx = at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
		const gy = at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1);
		o[y * w + x] = Math.hypot(gx, gy) >= T ? 0 : 255;
	}
	return o;
}

function sharpen(g, w, h, amt) {
	const b = new Float32Array(g.length), at = (x, y) => g[(y < 0 ? 0 : y >= h ? h - 1 : y) * w + (x < 0 ? 0 : x >= w ? w - 1 : x)];
	for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
		b[y * w + x] = (4 * at(x, y) + 2 * (at(x - 1, y) + at(x + 1, y) + at(x, y - 1) + at(x, y + 1)) + at(x - 1, y - 1) + at(x + 1, y - 1) + at(x - 1, y + 1) + at(x + 1, y + 1)) / 16;
	for (let i = 0; i < g.length; i++) g[i] = c255(g[i] + amt * (g[i] - b[i]));
}

const MODES = {
	threshold: (g, w, h, t) => g.map(v => v < t ? 0 : 255),
	bayer2: (g, w, h, t) => ordered(g, w, h, t, 2), bayer4: (g, w, h, t) => ordered(g, w, h, t, 4), bayer8: (g, w, h, t) => ordered(g, w, h, t, 8),
	halftone, sketch,
};
// Drempel = bias (SPEC): 128 - thr bij elke waarde op (als kwantiseerpunt compenseerde de doorgegeven fout hem en deed de
// schuif niets). Geklemd zoals in pro(): 'zwarter dan zwart' lekte anders als donkere rand naar de buren. Bij 128 bit-identiek.
for (const k in KERNELS) MODES[k] = (g, w, h, t) => { for (let i = 0; i < g.length; i++) g[i] = c255(g[i] + 128 - t); return diffuse(g, w, h, KERNELS[k]); };

// ---------- analyse (pro-pijplijn) ----------
function histogram(g) { const H = new Float64Array(256); for (let i = 0; i < g.length; i++) H[g[i] < 0 ? 0 : g[i] > 255 ? 255 : g[i] + .5 | 0]++; return H; }
function percentile(H, n, q) { let c = 0; for (let v = 0; v < 256; v++) { c += H[v]; if (c >= q * n) return v; } return 255; }
// Otsu: drempel met de grootste tussen-klasse-variantie; eta = die variantie / totale (1 = zuiver twee tonen).
function otsu(H, n) {
	let sum = 0, sq = 0;
	for (let v = 0; v < 256; v++) { sum += v * H[v]; sq += v * v * H[v]; }
	let w0 = 0, s0 = 0, best = -1, t = 128, t2 = 128;
	for (let v = 0; v < 255; v++) {
		w0 += H[v]; s0 += v * H[v];
		const w1 = n - w0;
		if (!w0 || !w1) continue;
		const d = s0 / w0 - (sum - s0) / w1, sb = w0 * w1 * d * d;
		if (sb > best) { best = sb; t = t2 = v + 1; } else if (sb === best) t2 = v + 1;
	}
	const vt = sq / n - (sum / n) * (sum / n);
	// Gelijke score over een leeg gat (zuiver twee tonen): midden van het gat, niet tegen de donkere toon aan; anders
	// maakte de eerste tik helderheid een zwart logo al wit.
	return { t: Math.round((t + t2) / 2), eta: vt > 0 ? best / (n * n) / vt : 1 };
}
// Logo/tekening = histogram met vrijwel alleen twee tonen. Een product op wit heeft ook een witpiek, maar het product
// zelf zit vol middentonen: daarom ook het aandeel middentonen, niet alleen Otsu's scheiding.
// Dat aandeel alleen verdunt een effen achtergrond (onderwerp van 15-20 % op wit/zwart = 'logo' = zwarte vlek). Daarom
// ook WAAR de middentonen zitten: bij een logo zijn het randjes (anti-aliasing, 1-2 dots breed), bij een foto vlakken.
// Gemeten (320x240): logo's 0-0,2 % middentoon-pixels met rondom middentoon, foto's 68-90 %.
// s = verschuiving van het midden door levels (klein bereik): een licht logo (grijs 185 op wit) landt anders met zijn
// donkere toon (~69) in de vaste band en heette 'foto' (grijs gespikkeld i.p.v. strak zwart).
function isGraphic(g, w, h, H, n, s = 0) {
	const r = Math.round(s);
	let mid = 0;
	for (let v = Math.max(0, 48 + r); v < Math.min(256, 208 + r); v++) mid += H[v];
	if (!(otsu(H, n).eta > .86 && mid / n < .14)) return false;
	const m = v => v >= 47.5 + r && v < 207.5 + r;   // zelfde bakjes als het histogram
	let core = 0;
	for (let y = 1; y < h - 1; y++) for (let x = 1, i = y * w + 1; x < w - 1; x++, i++) if (m(g[i]) && m(g[i - 1]) && m(g[i + 1]) && m(g[i - w]) && m(g[i + w])) core++;
	return core <= mid * .25;
}
// Exponent e (v' = v^e) waarbij het gemiddelde naar `target` gaat; bisectie op het histogram (256 bins, goedkoop).
function autoExp(H, n, target) {
	const mean = e => { let s = 0; for (let v = 0; v < 256; v++) if (H[v]) s += H[v] * Math.pow(v / 255, e); return s / n; };
	let lo = .35, hi = 2.8;
	for (let k = 0; k < 24; k++) { const mid = Math.sqrt(lo * hi); if (mean(mid) > target) lo = mid; else hi = mid; }
	return Math.sqrt(lo * hi);
}
function lut(g, L) { for (let i = 0; i < g.length; i++) { const v = g[i] < 0 ? 0 : g[i] > 255 ? 255 : g[i], j = v | 0, f = v - j; g[i] = j < 255 ? L[j] + (L[j + 1] - L[j]) * f : L[255]; } }
// Productfoto: egale bijna-witte achtergrond langs de rand (na levels). Geeft de toon waarboven het papierwit wordt + de
// knie eronder, of null. Lokaal contrast, scherpte en dot-gain maakten van de ruis daarin anders losse ditherspikkels.
// Rand i.p.v. histogram: een wit onderwerp of een lucht (licht maar niet egaal, niet rondom) blijft zo ongemoeid.
function paperLevel(g, w, h) {
	const b = [];
	for (let x = 0; x < w; x++) b.push(g[x], g[(h - 1) * w + x]);
	for (let y = 1; y < h - 1; y++) b.push(g[y * w], g[y * w + w - 1]);
	const lt = b.filter(v => v >= 200).sort((a, c) => a - c), q = f => lt[Math.min(lt.length - 1, Math.floor(f * lt.length))];
	if (lt.length < b.length * .5) return null;
	const s = q(.5) - q(.1);   // ~1,3 sigma ruis
	return q(.5) >= 224 && s <= 12 ? { cut: Math.max(200, q(.1) - Math.max(3, s)), knee: Math.max(8, 2 * s) } : null;
}
// 0..1 per pixel: hoe papierwit (smoothstep in de knie, geen harde rand om het onderwerp).
function paperMask(g, { cut, knee }) {
	const m = new Float32Array(g.length), k0 = cut - knee;
	for (let i = 0; i < g.length; i++) { const s = (g[i] - k0) / knee; m[i] = s <= 0 ? 0 : s >= 1 ? 1 : s * s * (3 - 2 * s); }
	return m;
}

// CLAHE: histogram-egalisatie per tegel (8×8) met clip-limit (begrenst de versterking: geen ruis-explosie in vlakken),
// bilineair tussen de tegels geïnterpoleerd. clip 1 laat alleen een effen tegel ongemoeid; een tegel met spreiding wordt
// ook dan deels geëgaliseerd (pro() mengt daarom bij lage sterkte met het origineel).
function clahe(g, w, h, clip) {
	const TX = Math.max(1, Math.min(8, Math.round(w / 12))), TY = Math.max(1, Math.min(8, Math.round(h / 12))), L = new Float32Array(TX * TY * 256), H = new Float64Array(256);
	const xs = t => Math.round(t * w / TX), ys = t => Math.round(t * h / TY);
	for (let ty = 0; ty < TY; ty++) for (let tx = 0; tx < TX; tx++) {
		H.fill(0);
		const x0 = xs(tx), x1 = xs(tx + 1), y0 = ys(ty), y1 = ys(ty + 1), n = (x1 - x0) * (y1 - y0);
		for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const v = g[y * w + x]; H[v < 0 ? 0 : v > 255 ? 255 : v + .5 | 0]++; }
		const lim = Math.max(1, clip * n / 256);
		let ex = 0;
		for (let v = 0; v < 256; v++) if (H[v] > lim) { ex += H[v] - lim; H[v] = lim; }
		const add = ex / 256, o = (ty * TX + tx) * 256;
		let cum = 0;
		for (let v = 0; v < 256; v++) { const hv = H[v] + add; L[o + v] = (cum + hv / 2) / n * 256 - .5; cum += hv; }
	}
	for (let y = 0; y < h; y++) {
		const fy = Math.max(0, Math.min(TY - 1, (y + .5) * TY / h - .5)), y0 = fy | 0, y1 = Math.min(TY - 1, y0 + 1), ay = fy - y0;
		for (let x = 0; x < w; x++) {
			const fx = Math.max(0, Math.min(TX - 1, (x + .5) * TX / w - .5)), x0 = fx | 0, x1 = Math.min(TX - 1, x0 + 1), ax = fx - x0, i = y * w + x;
			const v = g[i] < 0 ? 0 : g[i] > 255 ? 255 : g[i] + .5 | 0;
			const a = L[(y0 * TX + x0) * 256 + v], b = L[(y0 * TX + x1) * 256 + v], c = L[(y1 * TX + x0) * 256 + v], d = L[(y1 * TX + x1) * 256 + v];
			g[i] = c255((a + (b - a) * ax) * (1 - ay) + (c + (d - c) * ax) * ay);
		}
	}
}

// Thermisch papier: een dot brandt groter dan zijn cel, dus vlakken printen donkerder dan de dot-dekking. Model:
// geprinte zwartheid = c + k·c·(1-c); hier de inverse, zodat de print de bedoelde toon krijgt (dotGain 30 → +15% op 50%).
function dotGain(g, pct) {
	const k = pct / 50, L = new Float32Array(256);
	for (let v = 0; v < 256; v++) { const c = 1 - v / 255, q = (1 + k - Math.sqrt((1 + k) * (1 + k) - 4 * k * c)) / (2 * k); L[v] = 255 * (1 - q); }
	lut(g, L);
}

// Analyse → toon → lokaal contrast → scherpte → dot-gain → dither. Zie SPEC-wave3 "Foto's duidelijk in zwart-wit".
function pro(g, w, h, p, f, tone) {
	const n = w * h, auto = p.auto !== false, lc = num(p.localContrast, 40), dg = num(p.dotGain, DG), bleed = num(p.bleed, 85), thr = Number.isFinite(p.threshold) ? p.threshold : 128;
	let graphic = false, tPre = 128, paper = null, lv = null, wt = 255;
	if (auto) {
		const H = histogram(g), lo = percentile(H, n, .005), hi = percentile(H, n, .995);
		// Levels: 0,5–99,5 % naar zwart–wit, versterking begrensd (bijna-vlak beeld wordt geen ruis). Midden alleen naar
		// middengrijs naar rato van het bereik dat de begrensde versterking haalt: effen wit bleef anders geen papierwit.
		const gain = Math.min(2.5, 255 / Math.max(1, hi - lo)), mid = (lo + hi) / 2, ctr = mid + (127.5 - mid) * Math.min(1, (hi - lo) * gain / 255), L = new Float32Array(256);
		for (let v = 0; v < 256; v++) L[v] = c255(ctr + (v - mid) * gain);
		lut(g, L);
		// Wit na levels (licht logo: 244 door de begrensde versterking): de logo-drempel mag daar niet boven.
		wt = L[hi];
		lv = g.slice();
		const H2 = histogram(g);
		graphic = isGraphic(g, w, h, H2, n, ctr - 127.5);
		// Auto-gamma alleen bij echt donkere foto's en maar half (gemeten: naar gemiddelde 0,5 werd een avondfoto een
		// dagfoto en een product op wit donkerder; CLAHE + dot-gain houden schaduwen al open).
		if (!graphic) {
			const e = Math.pow(Math.min(1, autoExp(H2, n, .3)), .5);
			for (let v = 0; v < 256; v++) L[v] = 255 * Math.pow(v / 255, e);
			lut(g, L);
			paper = paperLevel(g, w, h);
		}
	}
	const hard = p.mode === 'auto' && (graphic || bleed <= 0), lcOn = !graphic && lc > 0;
	// Harde drempel (logo) vóór de toonkromme bepalen: helderheid/contrast/gamma schuiven de data dan t.o.v. die drempel.
	// Na tone() schoof Otsu mee en deden de schuiven niets (of het omgekeerde). Met lokaal contrast (CLAHE centreert zelf)
	// een vaste drempel: Otsu erna schoof ook mee.
	if (hard && auto && !lcOn) tPre = otsu(histogram(g), n).t;
	// Vóór tone(): de analyse beslist wat achtergrond is, de schuiven niet (donkerder maken haalt geen spikkels terug).
	let wp = !hard && paper ? paperMask(g, paper) : null;
	tone(g);
	// 'Achtergrond weg' maakte de achtergrond wit, maar lokaal contrast/dot-gain kleurden hem daarna weer grijs.
	if (!hard && p.bgCut > 0) { wp ||= new Float32Array(n); for (let i = 0; i < n; i++) if (g[i] >= 254.5) wp[i] = 1; }
	// Zwart/wit vóór lokaal contrast en dot-gain vastleggen: die tillen een vrijwel zwart vlak (heelal, product op zwart)
	// anders boven de klem en het geordende raster strooit er witte spikkels in.
	const pre = p.mode === 'bluenoise' ? g.slice() : null;
	if (lcOn) {
		// Sterkte 0..20 = mengen met het origineel (0 = echt niets, geen sprong bij de eerste tik); daarboven groeit de clip-limit.
		const a = Math.min(1, lc / 20), o = a < 1 ? g.slice() : null;
		clahe(g, w, h, 1 + lc / 40);
		if (o) for (let i = 0; i < n; i++) g[i] = o[i] + (g[i] - o[i]) * a;
	}
	// Verkleinen middelt randjes weg: mild terugscherpen, meer naarmate er meer bronpixels per dot zijn.
	const amt = num(p.sharpen, 0) / 100 * 2.5 + .45 * Math.min(1, Math.max(0, Math.log2(f) / 1.6));
	if (amt > 0) sharpen(g, w, h, amt);
	if (p.invertImg) for (let i = 0; i < n; i++) g[i] = 255 - g[i];
	if (!hard && dg > 0) dotGain(g, dg);
	// Geordend raster zet ook in bijna-wit losse dots (vuil op het label); diffusie met bleed doet dat vanzelf niet.
	// Vóór de bias: erna werd alles boven 246 / onder 9 hard wit/zwart terwijl de buren meeschoven (contourlijn).
	if (p.mode === 'bluenoise') for (let i = 0; i < n; i++) { const b = p.invertImg ? 255 - pre[i] : pre[i]; g[i] = g[i] > 246 || b > 246 ? 255 : g[i] < 9 || b < 9 ? 0 : g[i]; }
	// Bijna zwart (na levels, vóór auto-gamma) blijft zwart: auto-gamma, lokaal contrast en dot-gain tilden de ruis in een
	// zwarte achtergrond op tot witte spikkels. Zachte knie (lv 4..16): een harde grens gaf een contourlijn.
	// Doel = zwart na de schuiven, en alleen die kant op trekken: lichter maken gaf anders een harde zwarte vlek in de
	// schaduwen; tweezijdig maakte de donkerste pixels lichter dan hun buren.
	if (lv && !hard) {
		const z = new Float32Array(1), up = !!p.invertImg;
		tone(z); if (up) z[0] = 255 - z[0]; if (dg > 0) dotGain(z, dg);
		const t = z[0];
		for (let i = 0; i < n; i++) { const s = (16 - lv[i]) / 12; if (s > 0 && (up ? g[i] < t : g[i] > t)) g[i] += (t - g[i]) * (s >= 1 ? 1 : s * s * (3 - 2 * s)); }
	}
	// Drempel-bias (zie MODES) vóór papierwit: erna maakte een drempel > 128 van papierwit weer grijs, met spikkels.
	// Geklemd: zwart onder 0 stapelde in een zwart vlak diffusiefout op die als spikkelrand het papierwit in lekte.
	const bias = hard ? 0 : 128 - thr;
	if (bias) for (let i = 0; i < n; i++) g[i] = c255(g[i] + bias);
	// Papierwit exact 255: diffusie maakt daar geen fout meer en ontvangt hooguit -108, dus nooit een dot.
	if (wp) { const t = p.invertImg ? 0 : 255; for (let i = 0; i < n; i++) if (wp[i]) g[i] += (t - g[i]) * wp[i]; }
	if (p.mode === 'bluenoise') return [blueDither(g, w, h), graphic];
	// Niet boven wit (licht logo + hoge Drempel = hele label zwart). Negatief niet: daar mag wit zwart worden, zoals bij Drempel.
	if (hard) { const t = !auto || lcOn ? thr : p.invertImg ? 255 - tPre + thr - 128 : Math.min(wt, tPre + thr - 128); return [g.map(v => v < t ? 0 : 255), graphic]; }
	return [diffuse(g, w, h, KERNELS.floyd, Math.min(1, bleed / 100)), graphic];
}

// opts.downscale = bronpixels per dot (render geeft het mee): stuurt de automatische terugscherping.
// img.logo = herkend als logo/tekening: dan doen lokaal contrast (en in Automatisch ook dot-gain) niets (ui verbergt ze).
export function processImage(img, p = {}, { downscale = 1 } = {}) {
	const { data: d, width: w, height: h } = img, n = w * h;
	let g = new Float32Array(n);
	for (let i = 0, j = 0; i < n; i++, j += 4) { const a = d[j + 3] / 255; g[i] = (.299 * d[j] + .587 * d[j + 1] + .114 * d[j + 2]) * a + 255 * (1 - a); }
	if (p.flipH || p.flipV) {
		const f = new Float32Array(n);
		for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) f[y * w + x] = g[(p.flipV ? h - 1 - y : y) * w + (p.flipH ? w - 1 - x : x)];
		g = f;
	}
	const br = (+p.brightness || 0) * 2.55, C = Math.max(-254, Math.min(254, (+p.contrast || 0) * 2.55)), cf = 259 * (C + 255) / (255 * (259 - C));
	// Knie groeit mee met de sterkte (vol vanaf 10): een vaste 24 tilde bij de eerste tik al 230..254 op (halve schaduw weg).
	const gm = 1 / (p.gamma > 0 ? p.gamma : 1), cut = 255 - (+p.bgCut || 0) * 1.2, knee = Math.min(24, (255 - cut) * 2);
	const tone = g => {
		for (let i = 0; i < g.length; i++) {
			let v = 255 * Math.pow(c255(cf * (g[i] + br - 128) + 128) / 255, gm);
			// zachte knie onder de grens, anders ontstaat er een harde rand in lichte vlakken
			if (p.bgCut > 0) { if (v >= cut) v = 255; else if (v > cut - knee) v += (255 - v) * (v - cut + knee) / knee; }
			g[i] = v;
		}
	};
	let o, logo = false;
	if (PRO.has(p.mode)) [o, logo] = pro(g, w, h, p, downscale > 1 ? downscale : 1, tone);
	else {
		tone(g);
		if (p.sharpen > 0) sharpen(g, w, h, p.sharpen / 100 * 2.5);
		// Schets: randen van het negatief zijn dezelfde randen, dus daar de uitvoer omkeren.
		const sk = p.mode === 'sketch';
		if (p.invertImg && !sk) for (let i = 0; i < n; i++) g[i] = 255 - g[i];
		const thr = Number.isFinite(p.threshold) ? p.threshold : 128;
		o = (Object.hasOwn(MODES, p.mode) ? MODES[p.mode] : MODES.threshold)(g, w, h, thr);   // geen 'constructor' uit een kapot bestand
		if (p.invertImg && sk) for (let i = 0; i < n; i++) o[i] = 255 - o[i];
	}
	for (let i = 0, j = 0; i < n; i++, j += 4) { d[j] = d[j + 1] = d[j + 2] = o[i]; d[j + 3] = 255; }
	img.logo = logo;
	return img;
}

// Hoogwaardige schaling naar exact dw×dh: per as area-averaging bij verkleinen (elke bronpixel telt naar zijn oppervlak
// mee, geen aliasing/moiré), lineair bij vergroten. Alpha-gewogen: doorzichtige pixels kleuren de rand niet.
function taps(sn, dn) {
	const f = sn / dn, at = new Int32Array(dn + 1), ix = [], wt = [];
	for (let o = 0; o < dn; o++) {
		at[o] = ix.length;
		if (f >= 1) {
			const a = o * f, b = a + f;
			for (let i = Math.floor(a); i < Math.min(sn, Math.ceil(b)); i++) { const c = Math.min(b, i + 1) - Math.max(a, i); if (c > 1e-9) { ix.push(i); wt.push(c / f); } }
		} else {
			const c = Math.max(0, Math.min(sn - 1, (o + .5) * f - .5)), i = Math.floor(c), t = c - i;
			ix.push(i, Math.min(sn - 1, i + 1)); wt.push(1 - t, t);
		}
	}
	at[dn] = ix.length;
	return { at, ix: Int32Array.from(ix), wt: Float32Array.from(wt) };
}
export function resample(img, dw, dh) {
	const { data: s, width: sw, height: sh } = img;
	dw = Math.max(1, Math.round(dw)); dh = Math.max(1, Math.round(dh));
	const X = taps(sw, dw), Y = taps(sh, dh), t = new Float32Array(dw * sh * 4), out = new Uint8ClampedArray(dw * dh * 4);
	for (let y = 0; y < sh; y++) for (let x = 0; x < dw; x++) {
		let r = 0, g = 0, b = 0, a = 0;
		for (let k = X.at[x]; k < X.at[x + 1]; k++) { const j = (y * sw + X.ix[k]) * 4, q = s[j + 3] * X.wt[k]; r += s[j] * q; g += s[j + 1] * q; b += s[j + 2] * q; a += q; }
		const o = (y * dw + x) * 4; t[o] = r; t[o + 1] = g; t[o + 2] = b; t[o + 3] = a;
	}
	for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
		let r = 0, g = 0, b = 0, a = 0;
		for (let k = Y.at[y]; k < Y.at[y + 1]; k++) { const j = (Y.ix[k] * dw + x) * 4, q = Y.wt[k]; r += t[j] * q; g += t[j + 1] * q; b += t[j + 2] * q; a += t[j + 3] * q; }
		const o = (y * dw + x) * 4;
		if (a > 1e-6) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; } else out[o] = out[o + 1] = out[o + 2] = 255;
		out[o + 3] = a;
	}
	return { data: out, width: dw, height: dh };
}

// Dekking < 1: elke dot houdt zijn waarde met kans `level` (Bayer 8×8). Weggevallen donkere dots worden doorzichtig,
// zodat wat eronder ligt doorschijnt; lichte (bv. wit van invert) blijven zoals ze waren.
export function orderedGray(img, level) {
	const { data: d, width: w, height: h } = img, m = B[8], L = Math.max(0, Math.min(1, +level || 0));
	for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
		const j = (y * w + x) * 4, lum = .299 * d[j] + .587 * d[j + 1] + .114 * d[j + 2], dk = (1 - lum / 255) * (d[j + 3] / 255);
		if (dk * L > (m[(y & 7) * 8 + (x & 7)] + .5) / 64) { d[j] = d[j + 1] = d[j + 2] = 0; d[j + 3] = 255; }
		else if (lum < 128 || !d[j + 3]) { d[j] = d[j + 1] = d[j + 2] = 255; d[j + 3] = 0; }
		else d[j] = d[j + 1] = d[j + 2] = 255;
	}
	return img;
}

export function selftest() {
	const details = [];
	let ok = true;
	const chk = (c, m) => { details.push((c ? 'ok ' : 'FAIL ') + m); if (!c) ok = false; };
	const mk = (w, h, f, a = () => 255) => {
		const data = new Uint8ClampedArray(w * h * 4);
		for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const j = (y * w + x) * 4, v = f(x, y); data[j] = data[j + 1] = data[j + 2] = v; data[j + 3] = a(x, y); }
		return { data, width: w, height: h };
	};
	const every = (im, f) => { for (let y = 0; y < im.height; y++) for (let x = 0; x < im.width; x++) if (f(im.data[(y * im.width + x) * 4] === 0, x, y) === false) return false; return true; };
	const frac = im => { let n = 0; for (let i = 0; i < im.data.length; i += 4) n += im.data[i] === 0; return n / (im.width * im.height); };
	const grad = () => mk(16, 4, x => x * 17);
	const gl = (w, h, f) => { const g = new Float32Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y * w + x] = f(x, y); return g; };
	chk(every(processImage(grad(), { mode: 'threshold', threshold: 128 }), (b, x) => b === x < 8), 'drempel: linkerhelft van 16x4-gradient zwart');
	chk(every(processImage(grad(), { mode: 'threshold', threshold: 128, invertImg: true }), (b, x) => b === x >= 8), 'invert keert om');
	chk(every(processImage(grad(), { mode: 'threshold', flipH: true }), (b, x) => b === x >= 8), 'flipH spiegelt');
	chk(every(processImage(mk(4, 4, (x, y) => y * 80), { mode: 'threshold', flipV: true }), (b, x, y) => b === y >= 2), 'flipV spiegelt');
	chk(every(processImage(mk(4, 4, () => 0, () => 0), { mode: 'threshold' }), b => !b), 'doorzichtig wordt wit');
	chk(frac(processImage(mk(8, 8, () => 128), { mode: 'bayer4' })) === .5, 'bayer4 op 50% grijs = 50% zwart');
	chk(every(processImage(mk(4, 4, () => 230), { mode: 'threshold', threshold: 240, bgCut: 30 }), b => !b), 'bgCut: bijna-wit wordt wit');
	chk(every(processImage(mk(4, 4, () => 100), { mode: 'threshold', brightness: 20 }), b => !b) && every(processImage(mk(4, 4, () => 140), { mode: 'threshold', contrast: -100 }), b => !b), 'helderheid/contrast');
	chk(every(processImage(mk(4, 4, () => 100), { mode: 'threshold', gamma: 2 }), b => !b), 'gamma > 1 maakt lichter');
	chk(every(processImage(mk(8, 8, () => 200), { mode: 'sketch' }), b => !b) && frac(processImage(mk(8, 8, x => x < 4 ? 0 : 255), { mode: 'sketch' })) > 0, 'schets: vlak wit, rand zwart');
	chk(every(processImage(mk(8, 8, () => 200), { mode: 'sketch', invertImg: true }), b => b), 'schets + negatief: uitvoer omgekeerd (vlak zwart)');
	for (const m of DITHER_MODES) {
		const im = processImage(mk(48, 48, (x, y) => (x * 5 + y * 3) % 256, (x, y) => x === 0 ? 0 : 255), { mode: m.id, brightness: 5, contrast: 10, gamma: 1.1, sharpen: 30, bgCut: 5, threshold: 128 });
		let bin = true; for (let i = 0; i < im.data.length; i += 4) if ((im.data[i] !== 0 && im.data[i] !== 255) || im.data[i + 3] !== 255 || im.data[i] !== im.data[i + 1]) bin = false;
		chk(bin, `${m.id}: alleen 0/255, alpha 255`);
	}
	for (const id of ['floyd', 'atkinson', 'stucki', 'jarvis', 'sierra', 'bayer2', 'bayer8', 'halftone']) {
		const f = frac(processImage(mk(48, 48, () => 128), { mode: id }));
		chk(Math.abs(f - .5) < .06, `${id} op 50% grijs ~50% zwart (${f.toFixed(3)})`);
	}
	chk(frac(processImage(mk(48, 48, () => 64), { mode: 'halftone' })) > .65 && frac(processImage(mk(48, 48, () => 255), { mode: 'halftone' })) === 0, 'krantenraster volgt de toon');
	const og = orderedGray(mk(8, 8, () => 0), .5);
	let bl = 0, tr = 0; for (let i = 0; i < og.data.length; i += 4) { bl += og.data[i + 3] === 255 && og.data[i] === 0; tr += og.data[i + 3] === 0; }
	chk(bl === 32 && tr === 32, 'orderedGray 50%: helft zwart, rest doorzichtig');
	chk(every(orderedGray(mk(8, 8, () => 0), 1), b => b) && every(orderedGray(mk(8, 8, () => 255), .5), b => !b), 'orderedGray 100% / wit blijft');

	// ---- golf 3: foto-pijplijn ----
	const ids = DITHER_MODES.map(m => m.id);
	chk(ids[0] === 'auto' && ids.includes('bluenoise') && ['threshold', 'floyd', 'atkinson', 'stucki', 'jarvis', 'sierra', 'bayer2', 'bayer4', 'bayer8', 'halftone', 'sketch'].every(i => ids.includes(i)) && new Set(ids).size === ids.length, 'DITHER_MODES: auto eerst, bluenoise erbij, oude ids blijven');
	chk(IMAGE_PRESETS.map(p => p.id).join() === 'auto,foto,portret,eink,logo,schets' && IMAGE_PRESETS.every(p => p.name && ids.includes(p.params.mode)), 'IMAGE_PRESETS: 6 varianten met geldige modus');
	// Oude modes bit-identiek aan golf 2 (hash van de uitvoer met golf-2-code berekend): oude docs printen exact hetzelfde.
	const photo = () => mk(64, 48, (x, y) => c255(128 + 90 * Math.sin(x / 5) * Math.cos(y / 7) + (x * 7 + y * 13) % 23 - 11 + (x > 40 && y > 20 ? -60 : 0)));
	const fnv = im => { let hh = 0x811c9dc5; for (let i = 0; i < im.data.length; i += 4) hh = Math.imul(hh ^ (im.data[i] ? 1 : 0), 16777619); return hh >>> 0; };
	const LEGACY = { threshold: 208620112, floyd: 1225169971, atkinson: 639921918, stucki: 345487370, jarvis: 447217579, sierra: 1999649341, bayer2: 2668175294, bayer4: 3575603065, bayer8: 3276292715, halftone: 2492225760, sketch: 665776814 };
	const legacyParams = { brightness: 5, contrast: 15, gamma: 1.1, sharpen: 20, bgCut: 10, threshold: 128, auto: true, localContrast: 40, dotGain: 30, bleed: 85 };
	const got = Object.fromEntries(Object.keys(LEGACY).map(m => [m, fnv(processImage(photo(), { ...legacyParams, mode: m }))]));
	chk(Object.keys(LEGACY).every(m => got[m] === LEGACY[m]), 'oude modes bit-identiek aan golf 2, ook met de nieuwe velden erbij' + (Object.keys(LEGACY).every(m => got[m] === LEGACY[m]) ? '' : ' ' + JSON.stringify(got)));
	const sk = [110, 128, 200].map(t => frac(processImage(photo(), { mode: 'sketch', threshold: t })));
	chk(sk[0] < sk[1] && sk[1] < sk[2], `schets: Drempel 110/128/200 geeft steeds meer lijnen (${sk.map(v => (v * 100).toFixed(1)).join('/')}%)`);
	const bn = blueNoise(), sorted = Array.from(bn).sort((a, b) => a - b);
	chk(bn.length === 4096 && sorted.every((v, i) => Math.abs(v - (i + .5) / 4096 * 255) < 1e-3), 'blauwe ruis: 64x64, elke rang precies 1x');
	const b50 = frac(processImage(mk(64, 64, () => 127.5), { mode: 'bluenoise', auto: false, localContrast: 0, dotGain: 0 }));
	const b25 = processImage(mk(64, 64, () => 191), { mode: 'bluenoise', auto: false, localContrast: 0, dotGain: 0 });
	let adj = 0, blk = 0;
	for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { if (b25.data[(y * 64 + x) * 4]) continue; blk++; adj += !b25.data[(y * 64 + ((x + 1) & 63)) * 4]; adj += !b25.data[(((y + 1) & 63) * 64 + x) * 4]; }
	chk(Math.abs(b50 - .5) < .01 && Math.abs(blk / 4096 - .25) < .02 && adj / blk < .25, `blauwe ruis: 50% grijs = ${(b50 * 100).toFixed(1)}% zwart, 25%-dots verspreid (${(adj / blk).toFixed(3)} buren/dot, wit ruis ~0,5)`);
	const flat = mk(64, 48, () => 128), pf = { mode: 'auto', auto: false, localContrast: 0, dotGain: 0, bleed: 100 };
	chk(fnv(processImage(flat, pf)) === fnv(processImage(mk(64, 48, () => 128), { mode: 'floyd' })), 'auto zonder analyse/effecten, bleed 100 = Floyd-Steinberg');
	const fd = frac(processImage(mk(64, 48, () => 128), { ...pf, dotGain: 30 }));
	chk(Math.abs(fd - .3615) < .02, `dot-gain 30: 50% grijs krijgt ~36% dots (${(fd * 100).toFixed(1)}%)`);
	const bt = processImage(grad(), { ...pf, bleed: 0 });
	chk(every(bt, (b, x) => b === x < 8), 'bleed 0 in auto = harde drempel');
	// Lokaal contrast: een vlak blijft een vlak (clip 1 = identiteit), zwak reliëf wordt versterkt.
	const lowC = (lc) => { const g = gl(96, 72, (x, y) => 120 + 8 * Math.sin(x / 3) * Math.sin(y / 4)); if (lc) clahe(g, 96, 72, 1 + lc / 25); let mn = 255, mx = 0; for (const v of g) { mn = Math.min(mn, v); mx = Math.max(mx, v); } return mx - mn; };
	const fl = new Float32Array(96 * 72).fill(77); clahe(fl, 96, 72, 1);
	chk(fl.every(v => Math.abs(v - 77) < .6) && lowC(40) > lowC(0) * 1.8, `CLAHE: vlak ongewijzigd, zwak reliëf ${lowC(0).toFixed(0)} → ${lowC(40).toFixed(0)}`);
	// Logo-herkenning: twee tonen → Otsu-drempel (zelfde zwart/wit terug); foto/verloop → gerasterd.
	const inLogo = (x, y) => Math.hypot(x - 30, y - 30) < 18 || (x > 55 && x < 70 && y > 10 && y < 50);
	const lo = processImage(mk(80, 60, (x, y) => inLogo(x, y) ? 20 : 240), { mode: 'auto' });
	chk(every(lo, (b, x, y) => b === inLogo(x, y)), 'auto: logo (twee tonen) → Otsu-drempel, vorm exact');
	chk(lo.logo === true && processImage(mk(96, 32, x => x * 255 / 95), { mode: 'auto' }).logo === false && processImage(mk(80, 60, (x, y) => inLogo(x, y) ? 20 : 240), { mode: 'threshold' }).logo === false, 'img.logo: alleen bij herkend logo in de pro-pijplijn');
	// Drempel 255: de logo-drempel kwam boven het wit na levels (244) en het hele label werd zwart.
	chk([128, 255].every(t => every(processImage(mk(80, 60, (x, y) => inLogo(x, y) ? 185 : 255), { mode: 'auto', threshold: t }), (b, x, y) => b === inLogo(x, y))), 'auto: licht logo (grijs 185 op wit) = vorm exact zwart, geen raster, ook bij Drempel 255');
	// Otsu-drempel midden in het lege gat: tegen de donkere toon aan verdween een zwart logo bij Helderheid +1.
	chk(every(processImage(mk(80, 60, (x, y) => inLogo(x, y) ? 0 : 255), { mode: 'auto', brightness: 2 }), (b, x, y) => b === inLogo(x, y)), 'auto: zwart logo blijft bij Helderheid +2');
	chk(every(processImage(grad(), { mode: 'constructor', threshold: 128 }), (b, x) => b === x < 8), 'mode-naam van Object.prototype = drempel');
	const gr = processImage(mk(96, 32, x => x * 255 / 95), { mode: 'auto', dotGain: 0 }), fg = frac(gr);
	let mixed = 0; for (let x = 40; x < 56; x++) for (let y = 0; y < 32; y++) mixed += gr.data[(y * 96 + x) * 4] === 0;
	chk(fg > .3 && fg < .7 && mixed > 100 && mixed < 412, `auto: verloop wordt gerasterd (${(fg * 100).toFixed(0)}% zwart, midden gemengd)`);
	chk(otsu(histogram(Float32Array.from({ length: 100 }, (_, i) => i < 50 ? 30 : 200)), 100).t > 30 && otsu(histogram(Float32Array.from({ length: 100 }, (_, i) => i < 50 ? 30 : 200)), 100).t <= 200, 'otsu: drempel tussen de twee tonen');
	// Foto van 15 % op wit (onderwerp vol middentonen) blijft foto; logo met anti-aliasing (randjes) blijft logo.
	const W = 160, H = 120;
	const ph = gl(W, H, (x, y) => x >= 63 && x < 97 && y >= 39 && y < 81 ? c255(120 + 70 * Math.sin(x / 4) * Math.cos(y / 5) + (x * 7 + y * 13) % 17 - 8) : 255);
	const aa = gl(W, H, (x, y) => { let k = 0; for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const u = x + (i + .5) / 4, v = y + (j + .5) / 4; k += Math.hypot(u - 50, v - 60) < 30 || (u > 95 && u < 103 && v > 20 && v < 100); } return 255 - k / 16 * 255; });
	chk(!isGraphic(ph, W, H, histogram(ph), W * H) && isGraphic(aa, W, H, histogram(aa), W * H), 'auto: foto van 15% op wit blijft foto (geen zwarte vlek), logo met anti-aliasing blijft logo');
	// Negatief in de pro-takken: logo-drempel (tPre), papierwit-kleur en bijna-wit-klem keren mee om.
	const aaP = q => processImage(mk(W, H, (x, y) => aa[y * W + x]), { mode: 'auto', ...q }), aN = aaP({}), aI = aaP({ invertImg: true });
	let aaBad = 0; for (let i = 0; i < aN.data.length; i += 4) aaBad += aN.data[i] !== 255 - aI.data[i];
	const negW = frac(processImage(mk(64, 64, () => 255), { mode: 'bluenoise', auto: false, localContrast: 0, dotGain: 0, invertImg: true }));
	// E-ink: diep zwart (ruis 0..4) blijft na lokaal contrast + dot-gain zwart (geen witte spikkels).
	const night = processImage(mk(96, 72, (x, y) => x < 48 ? (x * 7 + y * 3) % 5 : (x - 48) * 5.3), { mode: 'bluenoise', auto: true, localContrast: 45, dotGain: 30 });
	chk(every(night, (b, x) => x >= 48 || b), 'blauwe ruis: zwart vlak met ruis 0..4 (naast een verloop) = 0 witte dots');
	// Logo-modus: helderheid verschuift de data t.o.v. de vaste drempel (monotoon minder zwart), drempel werkt als bias bij diffusie.
	const logoP = { ...IMAGE_PRESETS.find(q => q.id === 'logo').params }, sm = () => mk(96, 72, (x, y) => c255(40 + x * 1.8 + 30 * Math.sin(y / 6)));
	const lb = [0, 40].map(lc => [0, 10, 20, 40].map(b => frac(processImage(sm(), { ...logoP, localContrast: lc, brightness: b }))));
	chk(lb.every(r => r.every((v, i) => !i || v < r[i - 1])), `logo-modus (lokaal contrast 0 / 40): helderheid + geeft steeds minder zwart (${lb.map(r => r.map(v => (v * 100).toFixed(0)).join('/')).join(' ; ')}%)`);
	// Drempel in de standaardmodus en de rasters: hoger = meer zwart (bias weg of omgedraaid bleef anders groen).
	const dr = [...['auto', 'eink', 'logo'].map(id => IMAGE_PRESETS.find(q => q.id === id).params), { mode: 'bayer4' }, { mode: 'halftone' }].map(q => [100, 128, 156].map(t => frac(processImage(sm(), { ...q, threshold: t }))));
	chk(dr.every(([a, b, c]) => a < b && b < c), `Drempel 100/128/156 geeft steeds meer zwart (auto, e-ink, logo, raster 4x4, krantenraster: ${dr.map(r => r.map(v => (v * 100).toFixed(0)).join('/')).join(' ; ')}%)`);
	const fb = [64, 128, 192].map(t => frac(processImage(mk(64, 48, () => 128), { mode: 'floyd', threshold: t })));
	chk(fb[0] < .3 && Math.abs(fb[1] - .5) < .03 && fb[2] > .7, `diffusie: drempel = bias (${fb.map(v => (v * 100).toFixed(0)).join('/')}% zwart bij 64/128/192)`);
	// Bias geklemd: rond een zwart blok in grijs 200 (Drempel 200) geen donkere rand van 1-3 px (ongeklemd 77 tegen 52 %).
	const rimF = (() => { const o = processImage(mk(96, 96, (x, y) => x >= 28 && x < 68 && y >= 28 && y < 68 ? 0 : 200), { mode: 'floyd', threshold: 200 }), r = [0, 0, 0, 0];
		for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) { const d = Math.max(28 - x, x - 67, 28 - y, y - 67), q = d >= 1 && d <= 3 ? 0 : d >= 12 ? 2 : -1; if (q >= 0) { r[q]++; r[q + 1] += o.data[(y * 96 + x) * 4] === 0; } }
		return [r[1] / r[0], r[3] / r[2]]; })();
	chk(Math.abs(rimF[0] - rimF[1]) < .1, `diffusie Drempel 200: geen donkere rand om een zwart vlak (${rimF.map(v => (v * 100).toFixed(0)).join(' / ')}% rand / verder weg)`);
	// Blauwe ruis Drempel 200: bijna-wit loopt geleidelijk naar de bias, geen harde sprong (klem vóór de bias).
	const bnR = []; for (let v = 222; v <= 255; v++) bnR.push(frac(processImage(mk(64, 64, () => v), { mode: 'bluenoise', auto: false, localContrast: 0, dotGain: 0, threshold: 200 })));
	const bnJ = Math.max(...bnR.slice(1).map((v, i) => Math.abs(v - bnR[i])));
	chk(bnJ <= .1, `blauwe ruis Drempel 200: grijs 222..255 zonder harde rand (grootste sprong ${(bnJ * 100).toFixed(1)}%)`);
	// Schuiven beginnen bij 0 zonder sprong: lokaal contrast 1 ~ 1/20 van 20, achtergrond weg 1 raakt grijs 240 niet.
	// Geordend raster (blauwe ruis): gewijzigde dots ~ toonverschil (diffusie zou bij elke kleine wijziging alles omgooien).
	const lcd = lc => { const q = { mode: 'bluenoise', localContrast: 0, dotGain: 0 }, a = processImage(photo(), q), b = processImage(photo(), { ...q, localContrast: lc }); let d = 0; for (let i = 0; i < a.data.length; i += 4) d += a.data[i] !== b.data[i]; return d; };
	chk(lcd(1) * 4 < lcd(20), `lokaal contrast: eerste tik klein (${lcd(1)} vs ${lcd(20)} gewijzigde dots bij 20)`);
	chk(fnv(processImage(mk(64, 64, () => 240), { mode: 'floyd', bgCut: 1 })) === fnv(processImage(mk(64, 64, () => 240), { mode: 'floyd' })), 'achtergrond weg 1: grijs 240 ongemoeid (geen sprong bij de eerste tik)');
	// Schalen: area-averaging (2x2 schaakbord → 1 grijze pixel), lineair vergroten, alpha-gewogen.
	const ck = resample(mk(4, 4, (x, y) => (x + y) & 1 ? 255 : 0), 2, 2);
	chk(Array.from(ck.data.filter((_, i) => i % 4 === 0)).every(v => Math.abs(v - 127.5) <= .5), 'resample: area-averaging middelt (geen aliasing)');
	const up = resample(mk(2, 1, x => x * 255), 4, 1);
	chk(up.data[0] === 0 && up.data[12] === 255 && up.data[4] > 40 && up.data[4] < 90 && up.data[8] > 165 && up.data[8] < 215, 'resample: lineair vergroten');
	const ta = mk(2, 1, () => 0, x => x ? 255 : 0), rt = resample(ta, 1, 1);
	chk(rt.data[0] === 0 && Math.abs(rt.data[3] - 127.5) <= .5, 'resample: doorzichtige pixel kleurt niet mee, alpha gemiddeld');
	const r3 = resample(mk(7, 5, (x, y) => (x * 31 + y * 17) % 256), 3, 2);
	chk(r3.width === 3 && r3.height === 2 && r3.data.length === 24, 'resample: exact de doelmaat');
	// ---- golf 4b: bijna-witte achtergrond van een productfoto wordt papierwit ----
	// Vaste ruis (hash), achtergrond 240 met vignet: vóór de afkap 1,8 / 5,2 / 6,7 % inkt op de achtergrond (auto/foto/e-ink),
	// onderwerp 44,2 / 43,8 / 44,6 % zwart.
	const nz = (x, y) => { let t = Math.imul(x * 374761393 + y * 668265263, 1274126177); t ^= t >>> 13; t = Math.imul(t, 1103515245); return ((t >>> 8) & 0xffff) / 65535 + (((t * 7) >>> 8) & 0xffff) / 65535 - 1; };
	const PW = 320, PH = 240, rr = (x, y) => Math.hypot((x - 160) / 70, (y - 108) / 77);
	const prod = (blk = () => false, back = (x, y) => c255(240 - 40 * (((x - 160) / PW) ** 2 + ((y - 120) / PH) ** 2) + 7 * nz(x, y))) =>
		mk(PW, PH, (x, y) => blk(x, y) ? 0 : rr(x, y) < 1 ? c255(110 + 60 * Math.sin(x / 7) * Math.cos(y / 9) + 6 * nz(x, y) - 40 * (x - 160) / 70) : back(x, y));
	// Inkt-% in een zone (f op de straal rr): 1 meting voor achtergrond (> 1.15) en onderwerp (< .9).
	const zone = (o, f) => { let n = 0, k = 0; for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) if (f(rr(x, y))) { n++; k += o.data[(y * PW + x) * 4] === 0; } return k / n * 100; };
	const prodRun = (id, q, im = prod()) => processImage(im, { ...IMAGE_PRESETS.find(p => p.id === id).params, ...q }, { downscale: 3 });
	const bg = (id, q, im) => zone(prodRun(id, q, im), r => r > 1.15);
	const paperRes = [['auto', 44.24], ['foto', 43.79], ['eink', 44.62]].map(([id, was]) => {
		// dotGain vast op 30: de percentages hierboven zijn daarop gemeten, DG mag los gekalibreerd worden.
		const o = prodRun(id, { dotGain: 30 });
		return { id, bg: zone(o, r => r > 1.15), d: Math.abs(zone(o, r => r < .9) - was) };
	});
	// Drempel > 128 = bias vóór papierwit: de achtergrond blijft papierwit.
	const hiThr = ['auto', 'eink'].map(id => bg(id, { threshold: 160 }));
	chk(hiThr.every(v => v < .5), `drempel 160: papierwit blijft wit (${hiThr.map(v => v.toFixed(2)).join(' / ')}% inkt)`);
	// Papierwit-masker vóór de schuiven: donkerder maken haalt geen spikkels terug (masker erna: 30,9 / 32,5 %).
	const darkBg = ['auto', 'eink'].map(id => bg(id, { brightness: -40 }));
	chk(darkBg.every(v => v < .5), `helderheid -40: papierwit blijft wit (${darkBg.map(v => v.toFixed(2)).join(' / ')}% inkt)`);
	// 'Achtergrond weg' = ook een masker: een lichte, niet-egale achtergrond blijft wit bij Drempel 180 (zonder: 17 / 20 %).
	const cutBg = ['auto', 'eink'].map(id => bg(id, { bgCut: 50, threshold: 180 }, prod(undefined, x => 200 + 40 * x / PW)));
	chk(cutBg.every(v => v === 0), `achtergrond weg 50 + Drempel 180 op verloop 200..240: 0 inkt (${cutBg.map(v => v.toFixed(2)).join(' / ')}%)`);
	// Product op zwart met ruis 0..3: auto-gamma, lokaal contrast en dot-gain tilden die op tot 9-14 % witte spikkels.
	const blackBg = ['auto', 'foto', 'eink'].map(id => bg(id, {}, prod(undefined, (x, y) => 1.5 + 1.5 * nz(x, y))));
	// < 0,01 %: blauwe ruis zet in de staart van de knie nog een losse dot (1 van 54399).
	chk(blackBg.every(v => 100 - v < .01), `product op zwart (ruis 0..3): geen witte spikkels (${blackBg.map(v => (100 - v).toFixed(3)).join(' / ')}% wit)`);
	// Helderheid +80: de bijna-zwart-knie trok naar 0 i.p.v. naar zwart na de schuiven (harde zwarte vlek, sprong 41 / 35 punten).
	// Tweezijdig trekken maakte juist de donkerste band lichter dan zijn buren (5 tegen 11 %).
	const kj = ['auto', 'eink'].map(id => { const o = processImage(mk(256, 32, x => x), { ...IMAGE_PRESETS.find(q => q.id === id).params, brightness: 80 }), b = [];
		for (let x0 = 0; x0 < 40; x0 += 4) { let k = 0; for (let y = 0; y < 32; y++) for (let x = x0; x < x0 + 4; x++) k += o.data[(y * 256 + x) * 4] === 0; b.push(k / 1.28); }
		return [Math.max(...b.slice(1).map((v, i) => Math.abs(v - b[i]))), Math.max(...b) - b[0]]; });
	chk(kj.every(([j, d]) => j < 15 && d <= 2), `helderheid +80 op verloop 0..40: geen harde zwarte vlek, donkerste band het zwartst (sprong / achterstand ${kj.map(v => v.map(x => x.toFixed(1)).join(' ')).join(' ; ')} punten)`);
	const negBg = ['auto', 'eink'].map(id => bg(id, { invertImg: true }));
	chk(!aaBad && negBg.every(v => v === 100) && negW === 1, `negatief (auto/e-ink): AA-logo exact omgekeerd (${aaBad} px niet), papierwit wordt zwart (${negBg.map(v => v.toFixed(1)).join(' / ')}%), wit vlak vol (${negW})`);
	// Drempel 220 + zwart vlak tegen het onderwerp: de rand van 1-4 px in het papierwit ernaast blijft leeg (bias geklemd;
	// zonder klem 10,8 / 14,8 % spikkels).
	const inB = (x, y) => x >= 200 && x < 262 && y >= 92 && y < 126;
	const rim = ['auto', 'foto'].map(id => {
		const o = prodRun(id, { threshold: 220 }, prod(inB));
		let nr = 0, ir = 0;
		for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) { const d = Math.max(200 - x, x - 261, 92 - y, y - 125); if (d >= 1 && d <= 4 && rr(x, y) > 1.15) { nr++; ir += o.data[(y * PW + x) * 4] === 0; } }
		return ir / nr * 100;
	});
	chk(rim.every(v => v === 0), `drempel 220: geen spikkelrand naast een zwart vlak (${rim.map(v => v.toFixed(1)).join(' / ')}% inkt)`);
	// Effen/doorzichtig beeld in auto: levels trekken het niet naar middengrijs (anders een laag spikkels op wit).
	const plain = (v, a = 255) => frac(processImage(mk(96, 72, () => v, () => a), IMAGE_PRESETS[0].params));
	chk(plain(255) === 0 && plain(0, 0) === 0 && plain(0) === 1, `auto: effen wit/doorzichtig = 0 dots, effen zwart = vol (${plain(255)}/${plain(0, 0)}/${plain(0)})`);
	chk(paperRes.every(r => r.bg < .5 && r.d < 1), `productfoto: achtergrond papierwit, onderwerp gelijk (${paperRes.map(r => `${r.id} ${r.bg.toFixed(2)}% inkt, onderwerp ±${r.d.toFixed(2)}`).join(' / ')})`);
	chk(!paperLevel(gl(96, 32, x => x * 255 / 95), 96, 32) && !paperLevel(gl(96, 72, (x, y) => y < 36 ? 200 + y * 1.5 : 90 + 30 * Math.sin(x / 3)), 96, 72) && paperLevel(gl(96, 72, (x, y) => 247 + 3 * nz(x, y)), 96, 72)?.cut > 230,
		'papierwit alleen bij een egale lichte rand (niet bij verloop of lucht boven donker)');
	// Prestatie (spec: < 40 ms voor 320x240 incl. CLAHE); beste van 3 tegen toevallige pieken.
	const big = mk(320, 240, (x, y) => c255(128 + 100 * Math.sin(x / 9) * Math.cos(y / 13) + (x * 7 + y * 3) % 31 - 15));
	const tm = Math.min(...[0, 1, 2].map(() => { const c = { data: new Uint8ClampedArray(big.data), width: 320, height: 240 }, t0 = Date.now(); processImage(c, { mode: 'auto', localContrast: 40, sharpen: 20 }, { downscale: 3.75 }); return Date.now() - t0; }));
	chk(tm < 40, `auto-pijplijn 320x240 in ${tm} ms (< 40)`);
	return { ok, details };
}
