// Tekent een doc op 8 dots/mm, alles procedureel. Bij import niets met de DOM (node-tests).
import { DPM, substitute, clamp as cl, fieldValues, applyRules, normDeg } from './util.js';
import { iconToSvg, svgUrl } from './icons.js';
import { processImage, orderedGray, resample, PRO, IMAGE_KEYS } from './imaging.js';
import { ensureFont, fontReady, fontFailed, onFontLoaded, fontFaces } from './fonts.js';

export const SHAPES = [
	{ id: 'rect', name: 'Rechthoek' }, { id: 'ellipse', name: 'Ellips' }, { id: 'line', name: 'Lijn' },
	{ id: 'triangle', name: 'Driehoek' }, { id: 'diamond', name: 'Ruit' }, { id: 'hexagon', name: 'Zeshoek' },
	{ id: 'star', name: 'Ster' }, { id: 'heart', name: 'Hart' }, { id: 'arrow', name: 'Pijl' },
	{ id: 'speech', name: 'Tekstballon' }, { id: 'burst', name: 'Knaller' }, { id: 'cross', name: 'Kruis' }, { id: 'check', name: 'Vinkje' },
];
export const BORDER_STYLES = [
	{ id: 'line', name: 'Lijn' }, { id: 'double', name: 'Dubbel' }, { id: 'thick', name: 'Dik' }, { id: 'rounded', name: 'Afgerond' },
	{ id: 'rounded-double', name: 'Afgerond dubbel' }, { id: 'dashed', name: 'Gestreept' }, { id: 'dotted', name: 'Gestippeld' },
	{ id: 'thick-thin', name: 'Dik-dun' }, { id: 'corners', name: 'Hoeken' }, { id: 'brackets', name: 'Haken' }, { id: 'ticket', name: 'Ticket' },
	{ id: 'stamp', name: 'Postzegel' }, { id: 'scallop', name: 'Schulp' }, { id: 'wave', name: 'Golf' }, { id: 'zigzag', name: 'Zigzag' },
	{ id: 'film', name: 'Filmstrip' }, { id: 'dots', name: 'Bolletjes' }, { id: 'stars', name: 'Sterren' }, { id: 'hearts', name: 'Hartjes' },
	{ id: 'ornate', name: 'Sierlijk' }, { id: 'deco', name: 'Art deco' }, { id: 'inset', name: 'Verzonken' }, { id: 'shadow', name: 'Schaduw' },
	{ id: 'tag', name: 'Hanglabel' },
];
// [bwip-js-id, naam]: de keuzes in de ui en wat templates mogen gebruiken.
export const BARCODES = [['code128', 'Code 128'], ['ean13', 'EAN-13'], ['ean8', 'EAN-8'], ['upca', 'UPC-A'], ['upce', 'UPC-E'], ['code39', 'Code 39'], ['code93', 'Code 93'],
	['itf14', 'ITF-14'], ['interleaved2of5', 'Interleaved 2 of 5'], ['codabar', 'Codabar'], ['msi', 'MSI'], ['pharmacode', 'Pharmacode']];
export const CODES2D = [['qrcode', 'QR-code'], ['datamatrix', 'Data Matrix'], ['pdf417', 'PDF417'], ['azteccode', 'Aztec'], ['microqrcode', 'Micro QR']];

const PI = Math.PI, R = Math.round, CORNERS = [[0, 0], [1, 0], [0, 1], [1, 1]], WHITE = 0xFFFFFFFF, BLACK = 0xFF000000;
export const num = (v, d = 0) => Number.isFinite(v) ? v : d;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; };
function lru(map, k, v, max) { map.delete(k); map.set(k, v); if (map.size > max) map.delete(map.keys().next().value); return v; }
function hit(map, k) { const v = map.get(k); if (v !== undefined) { map.delete(k); map.set(k, v); } return v; }
// Herbruikbaar tekenvlak (niet elk frame een nieuw canvas), leeg en in de standaardstaat van een vers canvas.
const pool = {};
function scratch(slot, w, h) {
	const c = pool[slot] ||= mk(w, h), g = c.getContext('2d', { willReadFrequently: true });
	if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } else if (g.reset) g.reset(); else c.width = w;
	return g;
}

const assetFns = new Set();
const emitAssets = () => { for (const fn of [...assetFns]) try { fn(); } catch {} };
export function onAssetsChanged(fn) { assetFns.add(fn); const off = onFontLoaded(fn); return () => { assetFns.delete(fn); off(); }; }

// ---------- geometrie (puur) ----------
function unit(p) {
	const xs = p.map(q => q[0]), ys = p.map(q => q[1]), x0 = Math.min(...xs), y0 = Math.min(...ys), sx = Math.max(...xs) - x0, sy = Math.max(...ys) - y0;
	return p.map(([x, y]) => [(x - x0) / sx, (y - y0) / sy]);
}
function starPts(n, inner) {
	const p = [];
	for (let i = 0; i < n * 2; i++) { const a = -PI / 2 + i * PI / n, r = i % 2 ? inner : 1; p.push([Math.cos(a) * r, Math.sin(a) * r]); }
	return unit(p);
}
const POLY = {
	triangle: [[.5, 0], [1, 1], [0, 1]],
	diamond: [[.5, 0], [1, .5], [.5, 1], [0, .5]],
	hexagon: [[.25, 0], [.75, 0], [1, .5], [.75, 1], [.25, 1], [0, .5]],
	star: starPts(5, .4),
	burst: starPts(14, .72),
	arrow: [[0, .32], [.56, .32], [.56, .04], [1, .5], [.56, .96], [.56, .68], [0, .68]],
	cross: [[.34, 0], [.66, 0], [.66, .34], [1, .34], [1, .66], [.66, .66], [.66, 1], [.34, 1], [.34, .66], [0, .66], [0, .34], [.34, .34]],
	check: [[0, .54], [.15, .39], [.37, .6], [.85, .08], [1, .23], [.37, .92]],
};
const PATHS = new Set(['rect', 'ellipse', 'line', 'heart', 'speech']), SHAPE_IDS = new Set(SHAPES.map(s => s.id));
const MITER = new Set(['rect', 'cross']);   // scherpere hoeken: miter zou buiten de box uitsteken

// Posities langs de rand (inset), hoeken altijd mee en per zijde gelijk verdeeld: symmetrisch, ook bij elke labelmaat.
function alongEdge(w, h, inset, sp) {
	const x0 = inset, y0 = inset, x1 = w - inset, y1 = h - inset, pts = [];
	const nx = Math.max(1, R((x1 - x0) / sp)), ny = Math.max(1, R((y1 - y0) / sp));
	for (let i = 0; i < nx; i++) pts.push([x0 + (x1 - x0) * i / nx, y0], [x1 - (x1 - x0) * i / nx, y1]);
	for (let j = 0; j < ny; j++) pts.push([x1, y0 + (y1 - y0) * j / ny], [x0, y1 - (y1 - y0) * j / ny]);
	return pts;
}

// Woordterugloop; een woord breder dan de box breekt op tekens. m(s) = breedte.
const GRAPHEMES = new Intl.Segmenter();
// Ook na een koppelteken, zoals Chrome (gemeten): niet vóór . , ) / ! ? : ; ] } $ of het einde, vóór een cijfer alleen na
// een ASCII-letter/-cijfer (20%-25% blijft heel). Anders brak de textarea van de inline-editor THC-gehalte anders af dan de print.
// En na de spaties vooraan (inspringen): past het woord er niet achter, dan gaat het heel naar regel 2, zoals Chrome.
const HYPHEN = /(?<=-)(?=[^\d.,)\/!?:;\]}$])|(?<=[A-Za-z\d]-)(?=\d)|(?<=^ +)(?=[^ ])/;
function wrapText(str, maxW, m) {
	const out = [];
	for (const para of str.split('\n')) {
		let cur = '';
		// Spaties vooraan de alinea (inspringen) horen bij het eerste woord, zoals zonder afbreken; die bij een afbreek vallen weg.
		const ws = para.split(' '), i = ws.findIndex(Boolean);
		for (const word of i < 0 ? [para] : [ws.slice(0, i + 1).join(' '), ...ws.slice(i + 1)]) word.split(HYPHEN).forEach((w, j) => {
			const t = cur ? cur + (j ? '' : ' ') + w : w;   // j > 0: vervolg na een koppelteken, zonder spatie
			if (m(t) <= maxW || !cur && !w) { cur = t; return; }
			if (!w) return;   // spatie die niet meer past valt weg, zoals bij elke afbreek (anders een lege extra regel)
			if (cur) { out.push({ t: cur }); cur = ''; }
			// Op grafemen: een emoji (surrogaatpaar, vlag, ❤️, huidskleur, ZWJ-familie) doorknippen gaf losse halve tekens op de print.
			for (let cs = Array.from(GRAPHEMES.segment(w), s => s.segment); cs.length > 1 && m(w) > maxW; w = cs.join('')) {
				// Van voren af: van achteren mat elke stap een bijna heel woord opnieuw (kubisch, duizenden tekens = hang).
				let k = 1;
				while (k < cs.length - 1 && m(cs.slice(0, k + 1).join('')) <= maxW) k++;
				out.push({ t: cs.splice(0, k).join(''), brk: true });   // brk: woord op tekens gebroken
			}
			cur = w;
		});
		out.push({ t: cur, end: true });
	}
	return out;
}

// ---------- paden ----------
function poly(g, pts) { pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); }
function heartPath(g, x, y, w, h) {
	const X = u => x + u * w, Y = v => y + v * h;
	g.moveTo(X(.5), Y(1));
	g.bezierCurveTo(X(.2), Y(.76), X(0), Y(.55), X(0), Y(.31));
	g.bezierCurveTo(X(0), Y(.13), X(.14), Y(0), X(.29), Y(0));
	g.bezierCurveTo(X(.4), Y(0), X(.47), Y(.07), X(.5), Y(.18));
	g.bezierCurveTo(X(.53), Y(.07), X(.6), Y(0), X(.71), Y(0));
	g.bezierCurveTo(X(.86), Y(0), X(1), Y(.13), X(1), Y(.31));
	g.bezierCurveTo(X(1), Y(.55), X(.8), Y(.76), X(.5), Y(1));
	g.closePath();
}
function speechPath(g, x, y, w, h) {
	const yb = y + h * .78, x1 = x + w, r = Math.min(w, h * .78) * .18;
	g.moveTo(x + r, y);
	g.arcTo(x1, y, x1, yb, r); g.arcTo(x1, yb, x, yb, r);
	g.lineTo(x + w * .42, yb); g.lineTo(x + w * .16, y + h); g.lineTo(x + w * .28, yb);
	g.arcTo(x, yb, x, y, r); g.arcTo(x, y, x1, y, r);
	g.closePath();
}
function shapePath(g, id, x, y, w, h, r) {
	g.beginPath();
	if (id === 'rect') return r > 0 ? g.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)) : g.rect(x, y, w, h);
	if (id === 'ellipse') return g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, 2 * PI);
	if (id === 'line') { g.moveTo(x, y + h / 2); g.lineTo(x + w, y + h / 2); return; }
	if (id === 'heart') return heartPath(g, x, y, w, h);
	if (id === 'speech') return speechPath(g, x, y, w, h);
	poly(g, POLY[id].map(([u, v]) => [x + u * w, y + v * h]));
}
// Rechthoek waarvan de BUITENkant op inset i ligt (lijn blijft binnen de box); r = buitenstraal.
function rectS(g, i, w, h, lw, r = 0) {
	const a = i + lw / 2, rw = w - 2 * a, rh = h - 2 * a;
	if (rw <= 0 || rh <= 0) return;
	g.lineWidth = lw; g.beginPath();
	if (r > 0) g.roundRect(a, a, rw, rh, Math.max(.5, Math.min(r - lw / 2, rw / 2, rh / 2))); else g.rect(a, a, rw, rh);
	g.stroke();
}
// Streepjes per zijde zo geschaald dat elke hoek een volle L krijgt (geen afgeknipte streep in de hoek).
function dashRect(g, w, h, t, dash, gap) {
	const a = t / 2, x1 = w - a, y1 = h - a;
	g.lineWidth = t; g.lineCap = 'butt';
	for (const [ax, ay, bx, by] of [[0, a, w, a], [x1, 0, x1, h], [w, y1, 0, y1], [a, h, a, 0]]) {
		const L = Math.hypot(bx - ax, by - ay), n = Math.max(1, R((L + gap) / (dash + gap))), k = L / (n * dash + (n - 1) * gap);
		g.setLineDash([dash * k, gap * k]); g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
	}
	g.setLineDash([]);
}
function dotsAlong(g, pts, r) { g.beginPath(); for (const [x, y] of pts) { g.moveTo(x + r, y); g.arc(x, y, r, 0, 2 * PI); } g.fill(); }
// Hol uitgesneden hoeken + halve inkepingen midden links/rechts. Middelpunten op inset c; d = extra inset:
// zo blijven binnenlijnen concentrisch met de buitenlijn (anders snijdt een binnenlijn door de inkeping).
function ticketPath(g, w, h, c, d, r, n) {
	const R1 = r + d, N1 = n + d, a = Math.atan2(d, Math.sqrt(Math.max(0, R1 * R1 - d * d))), b = Math.atan2(d, Math.sqrt(Math.max(0, N1 * N1 - d * d)));
	const x0 = c, y0 = c, x1 = w - c, y1 = h - c, m = h / 2;
	g.beginPath();
	g.arc(x1, y0, R1, PI - a, PI / 2 + a, true);
	if (n > 0) g.arc(x1, m, N1, 1.5 * PI - b, PI / 2 + b, true);
	g.arc(x1, y1, R1, 1.5 * PI - a, PI + a, true);
	g.arc(x0, y1, R1, -a, -PI / 2 + a, true);
	if (n > 0) g.arc(x0, m, N1, PI / 2 - b, -PI / 2 + b, true);
	g.arc(x0, y0, R1, PI / 2 - a, a, true);
	g.closePath();
}
// Postzegeltanden: halve gaatjes langs de rand, kwartgaatjes in de hoeken.
function stampPath(g, w, h, a, hr) {
	const x0 = a, y0 = a, x1 = w - a, y1 = h - a;
	const nx = Math.max(2, R((x1 - x0) / (hr * 3.4))), ny = Math.max(2, R((y1 - y0) / (hr * 3.4))), sx = (x1 - x0) / nx, sy = (y1 - y0) / ny;
	g.beginPath(); g.moveTo(x0 + hr, y0);
	for (let i = 1; i < nx; i++) { const c = x0 + i * sx; g.lineTo(c - hr, y0); g.arc(c, y0, hr, PI, 0, true); }
	g.lineTo(x1 - hr, y0); g.arc(x1, y0, hr, PI, PI / 2, true);
	for (let j = 1; j < ny; j++) { const c = y0 + j * sy; g.lineTo(x1, c - hr); g.arc(x1, c, hr, 1.5 * PI, PI / 2, true); }
	g.lineTo(x1, y1 - hr); g.arc(x1, y1, hr, 1.5 * PI, PI, true);
	for (let i = nx - 1; i > 0; i--) { const c = x0 + i * sx; g.lineTo(c + hr, y1); g.arc(c, y1, hr, 0, PI, true); }
	g.lineTo(x0 + hr, y1); g.arc(x0, y1, hr, 0, -PI / 2, true);
	for (let j = ny - 1; j > 0; j--) { const c = y0 + j * sy; g.lineTo(x0, c + hr); g.arc(x0, c, hr, PI / 2, -PI / 2, true); }
	g.lineTo(x0, y0 + hr); g.arc(x0, y0, hr, PI / 2, 0, true);
	g.closePath();
}
function scallopPath(g, w, h, b, sr) {
	const x0 = b, y0 = b, x1 = w - b, y1 = h - b, nx = Math.max(1, Math.ceil((x1 - x0) / (2 * sr))), ny = Math.max(1, Math.ceil((y1 - y0) / (2 * sr)));   // ceil: boogstraal <= sr, blijft binnen de box
	const rx = (x1 - x0) / nx / 2, ry = (y1 - y0) / ny / 2;
	g.beginPath();   // eerst: de stroke() erna mag geen oud pad tekenen
	if (x1 <= x0 || y1 <= y0) return;   // vak smaller dan de bogen: negatieve straal, arc() gooit
	g.moveTo(x0, y0);
	for (let i = 0; i < nx; i++) g.arc(x0 + rx * (2 * i + 1), y0, rx, PI, 2 * PI);
	for (let j = 0; j < ny; j++) g.arc(x1, y0 + ry * (2 * j + 1), ry, 1.5 * PI, 2.5 * PI);
	for (let i = nx - 1; i >= 0; i--) g.arc(x0 + rx * (2 * i + 1), y1, rx, 0, PI);
	for (let j = ny - 1; j >= 0; j--) g.arc(x0, y0 + ry * (2 * j + 1), ry, .5 * PI, 1.5 * PI);
	g.closePath();
}
// Periodieke rand (golf/zigzag): geheel aantal perioden per zijde, dus de hoeken sluiten altijd netjes aan.
function edgePath(g, w, h, b, a, lam, fn, perPeriod) {
	g.beginPath();
	for (const [ax, ay, bx, by] of [[b, b, w - b, b], [w - b, b, w - b, h - b], [w - b, h - b, b, h - b], [b, h - b, b, b]]) {
		const L = Math.hypot(bx - ax, by - ay) || 1, n = Math.max(1, R(L / lam)), ux = (bx - ax) / L, uy = (by - ay) / L;
		const steps = perPeriod ? n * perPeriod : Math.max(8, Math.ceil(L / 1.5));
		for (let s = 0; s <= steps; s++) { const u = s / steps, o = fn(u * n) * a; g.lineTo(ax + (bx - ax) * u + uy * o, ay + (by - ay) * u - ux * o); }
	}
	g.closePath();
}
// Getrapte hoeken (art deco): trap van n treden per hoek, kloksgewijs.
function stepPath(g, w, h, i, s, n) {
	const base = [[-n * s, 0]];
	for (let k = 1; k <= n; k++) base.push([-(n - k + 1) * s, k * s], [-(n - k) * s, k * s]);
	g.beginPath();
	[[w - i, i], [w - i, h - i], [i, h - i], [i, i]].forEach(([cx, cy], q) => {
		for (let [dx, dy] of base) { for (let r = 0; r < q; r++) [dx, dy] = [-dy, dx]; g.lineTo(cx + dx, cy + dy); }
	});
	g.closePath();
}
const starAt = (g, x, y, r) => poly(g, POLY.star.map(([u, v]) => [x - r + u * 2 * r, y - r * .95 + v * 1.9 * r]));
const rad = (w, h) => cl(Math.min(w, h) * .14, 1.5 * DPM, 5 * DPM);

// ---------- randen ----------
const BD = {
	line: (g, w, h, t) => rectS(g, 0, w, h, t),
	double(g, w, h, t) { rectS(g, 0, w, h, t); rectS(g, t + Math.max(2, R(t * 1.2)), w, h, t); },
	thick: (g, w, h, t) => rectS(g, 0, w, h, Math.max(3, R(t * 2.5))),
	rounded: (g, w, h, t) => rectS(g, 0, w, h, t, rad(w, h)),
	'rounded-double'(g, w, h, t) {
		const r = rad(w, h), ti = Math.max(1, R(t * .6)), o = t + Math.max(2, R(t * 1.1));
		rectS(g, 0, w, h, t, r); rectS(g, o, w, h, ti, Math.max(ti, r - o));
	},
	dashed: (g, w, h, t) => dashRect(g, w, h, t, Math.max(3, t * 3), Math.max(2, t * 2)),
	dotted(g, w, h, t) { const r = Math.max(1, t * .55); dotsAlong(g, alongEdge(w, h, r, Math.max(r * 2 + 2, t * 2.3)), r); },
	'thick-thin'(g, w, h, t) { const T = Math.max(3, R(t * 2)); rectS(g, 0, w, h, T); rectS(g, T + Math.max(2, R(t)), w, h, Math.max(1, R(t * .5))); },
	corners(g, w, h, t) {
		const L = R(cl(Math.min(w, h) * .2, 2 * DPM, 9 * DPM)), T = Math.max(2, R(t * 1.4));
		for (const [sx, sy] of CORNERS) { g.fillRect(sx ? w - L : 0, sy ? h - T : 0, L, T); g.fillRect(sx ? w - T : 0, sy ? h - L : 0, T, L); }
	},
	brackets(g, w, h, t) {
		const T = Math.max(2, R(t * 1.3)), a = R(cl(Math.min(w, h) * .12, 1.5 * DPM, 5 * DPM));
		for (const x of [0, w - T]) g.fillRect(x, 0, T, h);
		for (const y of [0, h - T]) { g.fillRect(0, y, a, T); g.fillRect(w - a, y, a, T); }
	},
	ticket(g, w, h, t) {
		const r = cl(Math.min(w, h) * .12, 1.5 * DPM, 4 * DPM), n = cl(Math.min(w, h) * .1, 1.2 * DPM, 3.5 * DPM), ti = Math.max(1, R(t * .5)), o = t + Math.max(2, R(t * 1.2));
		g.lineWidth = t; ticketPath(g, w, h, t / 2, 0, r, n); g.stroke();
		g.lineWidth = ti; g.setLineDash([Math.max(2, ti * 3), Math.max(2, ti * 2)]); ticketPath(g, w, h, t / 2, o + ti / 2 - t / 2, r, n); g.stroke(); g.setLineDash([]);
	},
	stamp(g, w, h, t) {
		const hr = cl(R(Math.min(w, h) * .03 + t * .6), 3, 10), lw = Math.max(1, R(t * .8));
		g.lineWidth = lw; g.lineJoin = 'round'; stampPath(g, w, h, lw / 2, hr); g.stroke();
		rectS(g, hr + Math.max(3, R(t * 1.2)), w, h, Math.max(1, R(t * .7)));
	},
	scallop(g, w, h, t) { const sr = cl(R(t * 2.2), 4, 16); g.lineWidth = t; g.lineJoin = 'round'; scallopPath(g, w, h, sr + t / 2, sr); g.stroke(); },
	wave(g, w, h, t) { const a = cl(R(t * 1.2), 3, 24); g.lineWidth = t; g.lineJoin = 'round'; edgePath(g, w, h, a + t / 2, a, a * 6, u => Math.sin(u * 2 * PI), 0); g.stroke(); },
	zigzag(g, w, h, t) { const a = cl(R(t * 1.3), 3, 24); g.lineWidth = t; g.lineJoin = 'round'; edgePath(g, w, h, a + t / 2, a, a * 3, u => 1 - Math.abs(1 - 2 * (u - Math.floor(u))), 2); g.stroke(); },
	film(g, w, h, t) {
		if (h > w) { g.translate(w, 0); g.rotate(PI / 2); [w, h] = [h, w]; }
		const bh = R(cl(h * .16, 2 * DPM, 5 * DPM)), hh = Math.max(2, R(bh * .45)), hw = Math.max(2, R(hh * 1.3)), st = hw * 2.1, ti = Math.max(1, R(t * .6));
		g.fillRect(0, 0, w, bh); g.fillRect(0, h - bh, w, bh); g.fillRect(0, bh, ti, h - 2 * bh); g.fillRect(w - ti, bh, ti, h - 2 * bh);
		const n = Math.max(1, Math.floor((w - hw - 4) / st) + 1), x0 = (w - (n - 1) * st - hw) / 2;
		g.fillStyle = '#fff'; g.beginPath();   // perforatie is echt wit: de band dekt wat eronder ligt
		for (let i = 0; i < n; i++) for (const y of [(bh - hh) / 2, h - bh + (bh - hh) / 2]) g.roundRect(R(x0 + i * st), R(y), hw, hh, Math.min(hw, hh) * .3);
		g.fill(); g.fillStyle = '#000';
	},
	dots(g, w, h, t) { const r = cl(t * 1.1, .35 * DPM, 1.2 * DPM); dotsAlong(g, alongEdge(w, h, r, r * 3.2), r); },
	stars(g, w, h, t) { const r = cl(R(Math.min(w, h) * .045 + t * .5), 6, 14); g.beginPath(); for (const [x, y] of alongEdge(w, h, r, r * 2.8)) starAt(g, x, y, r); g.fill(); },
	hearts(g, w, h, t) { const r = cl(R(Math.min(w, h) * .045 + t * .5), 6, 14); g.beginPath(); for (const [x, y] of alongEdge(w, h, r, r * 2.8)) heartPath(g, x - r, y - r * .92, r * 2, r * 1.84); g.fill(); },
	ornate(g, w, h, t) {
		const ti = Math.max(1, R(t * .5)), d = R(cl(Math.min(w, h) * .13, 1.6 * DPM, 5 * DPM)), a = ti + Math.max(2, R(d * .3)) + t / 2;
		rectS(g, 0, w, h, ti);
		g.lineWidth = t; ticketPath(g, w, h, a, 0, d, 0); g.stroke();
		g.lineWidth = ti;
		for (const [sx, sy] of CORNERS) {   // hoekrozet: binnenboog + punt in de uitsparing
			const cx = sx ? w - a : a, cy = sy ? h - a : a, q = sx ? (sy ? 2 : 1) : (sy ? 3 : 0);
			g.beginPath(); g.arc(cx, cy, d * .58, q * PI / 2, (q + 1) * PI / 2); g.stroke();
			g.beginPath(); g.arc(cx + (sx ? -1 : 1) * d * .2, cy + (sy ? -1 : 1) * d * .2, Math.max(1.5, d * .14), 0, 2 * PI); g.fill();
		}
		const k = Math.min(Math.max(t * 1.6, d * .32), a - ti - 1), L = d * .55;   // juweeltjes midden op de binnenlijn
		g.beginPath();
		for (const [x, y, hor] of [[w / 2, a, 1], [w / 2, h - a, 1], [a, h / 2, 0], [w - a, h / 2, 0]])
			poly(g, hor ? [[x - L, y], [x, y - k], [x + L, y], [x, y + k]] : [[x, y - L], [x + k, y], [x, y + L], [x - k, y]]);
		g.fill();
	},
	deco(g, w, h, t) {
		const s = R(cl(Math.min(w, h) * .06, DPM, 3 * DPM)), ti = Math.max(1, R(t * .5)), o = t + s + Math.max(2, R(t * .8)), q = Math.max(2, R(s * .6));
		g.lineWidth = t; stepPath(g, w, h, t / 2, s, 2); g.stroke();
		g.lineWidth = ti; stepPath(g, w, h, o + ti / 2, s, 1); g.stroke();
		for (const [sx, sy] of CORNERS) g.fillRect(sx ? w - q : 0, sy ? h - q : 0, q, q);
		for (const k of [-1, 0, 1]) { const x = R(w / 2 + k * s * .6 - ti / 2); g.fillRect(x, t, ti, o - t); g.fillRect(x, h - o, ti, o - t); }
	},
	inset(g, w, h, t) {
		rectS(g, 0, w, h, t);
		const s = Math.max(2, R(t * 1.6)), e = t + Math.max(2, R(t * .8)), ti = Math.max(1, R(t * .4)), iw = w - 2 * e, ih = h - 2 * e;
		if (iw <= 0 || ih <= 0) return;
		g.fillRect(e, e, iw, s); g.fillRect(e, e, s, ih);   // dik boven/links, dun onder/rechts = verzonken paneel
		g.fillRect(e, h - e - ti, iw, ti); g.fillRect(w - e - ti, e, ti, ih);
	},
	shadow(g, w, h, t) {
		const s = R(cl(t * 2.2, DPM, 2.5 * DPM));
		rectS(g, 0, w - s, h - s, t);
		g.fillRect(w - s, s, s, h - s); g.fillRect(s, h - s, w - 2 * s, s);
	},
	tag(g, w, h, t) {
		const c = R(Math.min(h * .3, w * .22)), P = i => { const k = i * (Math.SQRT2 - 1); return [[c + k, i], [w - i, i], [w - i, h - i], [c + k, h - i], [i, h - c - k], [i, c + k]]; };
		g.lineWidth = t; g.beginPath(); poly(g, P(t / 2)); g.stroke();
		const ti = Math.max(1, R(t * .45)), gi = t + Math.max(2, R(t * .9));
		g.lineWidth = ti; g.setLineDash([Math.max(2, ti * 3), Math.max(2, ti * 2)]); g.beginPath(); poly(g, P(gi + ti / 2)); g.stroke(); g.setLineDash([]);
		const r = Math.max(2, R(Math.min(h * .08, c * .38)));
		g.lineWidth = Math.max(1, R(t * .8)); g.beginPath(); g.arc(gi + ti + r + Math.max(2, r * .6), h / 2, r, 0, 2 * PI); g.stroke();
	},
};

function drawBorder(g, el, d) {
	g.lineJoin = 'miter'; g.lineCap = 'butt';
	(Object.hasOwn(BD, el.style) ? BD[el.style] : BD.line)(g, d.w, d.h, Math.max(1, R(num(el.stroke, .6) * DPM)));   // geen 'constructor' uit een kapot bestand
}

// ---------- vormen ----------
let grayTile = null;
function grayFill(g) {
	if (!grayTile) {
		grayTile = mk(8, 8);
		const t = grayTile.getContext('2d', { willReadFrequently: true });
		t.fillRect(0, 0, 8, 8);
		t.putImageData(orderedGray(t.getImageData(0, 0, 8, 8), .4), 0, 0);
	}
	return g.createPattern(grayTile, 'repeat');
}
function dashes(g, kind, lw) {
	if (kind === 'dashed') { g.lineCap = 'butt'; g.setLineDash([Math.max(2, lw * 3), Math.max(2, lw * 2)]); }
	else if (kind === 'dotted') { g.lineCap = 'round'; g.setLineDash([.01, Math.max(2, lw * 2)]); }
}
function drawShape(g, el, d) {
	const id = SHAPE_IDS.has(el.shape) ? el.shape : 'rect', sw = Math.max(0, R(num(el.stroke) * DPM));
	if (id === 'line') { const lw = sw || 4; g.lineWidth = lw; dashes(g, el.dash, lw); shapePath(g, id, 0, 0, d.w, d.h); g.stroke(); return; }
	shapePath(g, id, sw / 2, sw / 2, Math.max(1, d.w - sw), Math.max(1, d.h - sw), num(el.radius) * DPM - sw / 2);
	if (el.fill === 'gray') g.imageSmoothingEnabled = false;   // het grijze dotraster mag bij draaien niet vervagen
	if (el.fill === 'black' || el.fill === 'gray') { g.fillStyle = el.fill === 'gray' ? grayFill(g) : '#000'; g.fill(); }
	if (sw) { g.lineWidth = sw; g.lineJoin = MITER.has(id) ? 'miter' : 'round'; dashes(g, el.dash, sw); g.stroke(); }
}

// ---------- tekst ----------
// Synthetisch vet (lijndikte), cursief (schuinte), onderstreping (afstand, dikte) als fractie van px. drawText tekent en
// textInk meet hiermee: twee kopieën liepen uiteen en dan centreert Netjes maken scheef.
const SYN = { bold: .045, skew: .2, ul: .09, th: .065 };
// Zonder prototype: een uitlijning als 'constructor' (kapot bestand) gaf NaN = stil onzichtbare tekst.
export const HALIGN = { __proto__: null, center: .5, right: 1 }, VALIGN = { __proto__: null, middle: .5, bottom: 1 };
// Ook voor inlineedit: de textarea moet met hetzelfde font meten als er geprint wordt.
// Naam ge-escapet: een " of newline (hand-bewerkt bestand) maakte de font-string ongeldig en canvas tekende stil 10px.
export function fontSpec(el, px) {
	const fam = el.font || 'Arial', f = fontFaces(fam);
	return `${el.italic && f.italic ? 'italic ' : ''}${el.bold && f.bold ? 'bold ' : ''}${px}px "${String(fam).replace(/[\0-\x1f]/g, '').replace(/["\\]/g, '\\$&')}", sans-serif`;
}
function layout(g, el, str, px, bw, bh) {
	g.font = fontSpec(el, px);
	const hasLS = 'letterSpacing' in g, ls = hasLS ? num(el.letterSpacing) * px / Math.max(1e-6, num(el.size, 5)) : 0, lh = px * num(el.lineHeight, 1.15);
	if (el.vertical) {
		const cell = lh * .85 + ls, per = el.wrap !== false ? Math.max(1, Math.floor(bh / cell)) : Infinity, cols = [];
		// Per grafeem (zoals wrapText): per codepunt kreeg ❤️ een lege extra cel en werd een vlag twee letterblokjes.
		for (const p of str.split('\n')) { const ch = Array.from(GRAPHEMES.segment(p), s => s.segment); if (!ch.length) cols.push([]); for (let i = 0; i < ch.length; i += per) cols.push(ch.slice(i, i + per)); }
		return { px, ls, lh, cell, cols, w: cols.length * lh, h: Math.max(0, ...cols.map(c => c.length)) * cell };
	}
	if (hasLS) g.letterSpacing = ls + 'px';
	const m = s => s ? g.measureText(s).width - ls : 0;
	const lines = el.wrap !== false ? wrapText(str, bw, m) : str.split('\n').map(t => ({ t, end: true }));
	for (const l of lines) l.w = m(l.t);
	return { px, ls, lh, lines, m, brk: lines.some(l => l.brk), w: Math.max(0, ...lines.map(l => l.w)), h: lines.length * lh };
}
// Woorden heel houden: een op tekens gebroken woord ('Wietkoe' / 'kjes') past vaak op een grotere px dan één hele regel en
// won zo de zoektocht. Alleen als zelfs 1 px niet zonder breken past, mag het op tekens.
function fitLayout(g, el, str, bw, bh) {
	const base = Math.max(1, num(el.size, 5) * DPM), lay = layout(g, el, str, base, bw, bh);
	if (el.fit !== 'shrink' && el.fit !== 'fill') return lay;
	const fitsAny = l => l.w <= bw + .5 && l.h <= bh + .5, whole = l => fitsAny(l) && !l.brk;
	let lo = 1, hi = el.fit === 'shrink' ? base : Math.max(base, bh * 1.6, bw * 1.6, 8), best = layout(g, el, str, lo, bw, bh);
	const fits = whole(lay) || whole(best) ? whole : fitsAny;
	if (el.fit === 'shrink' && fits(lay)) return lay;
	for (let k = 0; k < 14; k++) { const mid = (lo + hi) / 2, l = layout(g, el, str, mid, bw, bh); if (fits(l)) { lo = mid; best = l; } else hi = mid; }
	return best;
}
// Verticale plaatsing van drawText (font staat al op g); textInk meet ermee. y(i, step) = basislijn van regel/teken i,
// midden in zijn regelhoogte.
function baselines(g, el, L, d) {
	const mt = g.measureText('Hg'), asc = num(mt.fontBoundingBoxAscent, L.px * .8), desc = num(mt.fontBoundingBoxDescent, L.px * .2);
	const top = (d.h - L.h) * (VALIGN[el.valign] ?? 0);
	return { top, asc, y: (i, step = L.lh) => top + i * step + (step - asc - desc) / 2 + asc };
}
function drawText(g, el, d, env) {
	const fam = el.font || 'Arial', bold = !!el.bold, italic = !!el.italic, ready = fontReady(fam, bold, italic);
	if (!ready) ensureFont(fam, { bold, italic });
	const str = substitute(String(el.text ?? ''), env);
	if (!str) return;
	// Nog niet geladen = op de print het vervangende lettertype (andere maat/opmaak): niet printen. Mislukt (offline) = wel.
	if (!ready && !fontFailed(fam, bold, italic)) flag(env, el, `het lettertype ${fam} is nog niet geladen (even wachten of online gaan)`);
	const L = fitLayout(g, el, str, d.w, d.h), px = L.px, f = fontFaces(fam), fi = italic && !f.italic, sb = bold && !f.bold ? px * SYN.bold : 0;
	g.font = fontSpec(el, px); g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
	const { y: base } = baselines(g, el, L, d), ol = num(el.outline) * DPM;
	const paint = (s, x, y) => {
		if (fi) { g.save(); g.translate(x, y); g.transform(1, 0, -SYN.skew, 1, 0, 0); x = y = 0; }   // synthetisch cursief
		if (ol > 0) { g.lineWidth = ol + sb; g.strokeText(s, x, y); }
		else { g.fillText(s, x, y); if (sb) { g.lineWidth = sb; g.strokeText(s, x, y); } }   // synthetisch vet
		if (fi) g.restore();
	};
	if (el.vertical) {
		if ('letterSpacing' in g) g.letterSpacing = '0px';
		g.textAlign = 'center';
		const x0 = (d.w - L.w) * (HALIGN[el.align] ?? 0);
		L.cols.forEach((col, c) => col.forEach((ch, k) => paint(ch, x0 + (c + .5) * L.lh, base(k, L.cell))));
		return;
	}
	if ('letterSpacing' in g) g.letterSpacing = L.ls + 'px';
	const th = Math.max(1, px * SYN.th);
	L.lines.forEach((ln, i) => {
		// Alleen splitsen op een spatie na een teken: inspringen/dubbele spatie blijft aan het woord (geen leeg woord met eigen gat).
		const y = base(i), words = el.align === 'justify' && !ln.end ? ln.t.split(/(?<=\S) /) : null;
		let x = el.align === 'center' ? (d.w - ln.w) / 2 : el.align === 'right' ? d.w - ln.w : 0, w = ln.w;
		if (words && words.length > 1) {
			const ws = words.map(L.m), gap = (d.w - ws.reduce((a, b) => a + b, 0)) / (words.length - 1);
			let cx = 0; words.forEach((wd, j) => { paint(wd, cx, y); cx += ws[j] + gap; });
			x = 0; w = d.w;
		} else paint(ln.t, x, y);
		if (el.underline) g.fillRect(x, y + px * SYN.ul, w, th);
		if (el.strike) g.fillRect(x, y - px * .3 - th / 2, w, th);
	});
}
let mctx = null;
// row = voorbeeldrij (een lijstwaarde is langer of korter), counter = doc.counter ({teller} zoals het voorbeeld hem tekent).
// Op de getekende px (Krimpen/Groeien, letterafstand schaalt mee), dan zonder hoogtegrens: zoveel regels als de tekst op die
// maat in de boxbreedte nodig heeft. Verticaal breekt op de boxhoogte (anders 1 lange kolom): die houdt de grens.
const measureEnv = (row, counter, fields) => ({ row, counter: counter ? +counter.start || 0 : 1, digits: num(counter?.digits, 3), now: new Date(), fields });
export function measureText(el, fields = null, row = null, counter = null) {
	mctx ||= mk(1, 1).getContext('2d');
	const str = substitute(String(el.text ?? ''), measureEnv(row, counter, fields)), d = dbox(el);
	const L = layout(mctx, el, str, fitLayout(mctx, el, str, d.w, d.h).px, d.w, el.vertical ? d.h : Infinity);
	return { w: L.w / DPM, h: L.h / DPM };
}

// ---------- codes ----------
const codes = new Map();
function bwip(opts) { const c = document.createElement('canvas'); bwipjs.toCanvas(c, opts); return c; }
function makeCode(sym, text, bw, bh, one, el) {
	// bwip-js kent geen 'codabar' (unknownEncoder): de naam blijft in docs en lijst, de encoder heet rationalizedCodabar.
	const base = { bcid: sym === 'codabar' ? 'rationalizedCodabar' : sym, text };
	if (sym === 'qrcode') base.eclevel = ['L', 'M', 'Q', 'H'].includes(el.ecc) ? el.ecc : 'M';
	try {
		// Eerst op schaal 1 renderen = breedte in modules; dan een gehele schaal zodat elke module exact N dots is.
		if (!one) {
			const c1 = bwip({ ...base, scale: 1 }), sx = Math.max(1, Math.floor(bw / c1.width)), sy = Math.max(1, Math.floor(bh / c1.height));
			const kx = sym === 'pdf417' ? sx : Math.min(sx, sy), ky = sym === 'pdf417' ? sy : kx;
			if (kx === 1 && ky === 1) return c1;
			// bwip op schaal N = schaal 1 nearest-neighbour vergroot (gemeten, alle 2D-types): geen tweede bwip-run.
			// willReadFrequently = software-canvas: een GPU-canvas als bron veranderde het rasteren van het hele label (dunne lijnen).
			const c = mk(c1.width * kx, c1.height * ky), o = c.getContext('2d', { willReadFrequently: true });
			o.imageSmoothingEnabled = false; o.drawImage(c1, 0, 0, c.width, c.height);
			return c;
		}
		const H0 = 10, c1 = bwip({ ...base, scale: 1, height: H0 }), s = Math.max(1, Math.floor(bw / c1.width)), k = c1.height / H0 * s;
		const txt = el.showText !== false ? Math.max(5, R(num(el.textSize, 2.5) * DPM)) : 0;
		// Uniforme schaal (scaleX = scaleY) houdt de tekst onvervormd; de balkhoogte komt via `height` op de box uit.
		const run = extra => {
			const o = { ...base, scale: s, ...extra };
			let hp = Math.max(2, bh - (extra.includetext ? txt * 1.3 : 0)) / k, c = bwip({ ...o, height: hp });
			if (Math.abs(c.height - bh) > 1) { hp = Math.max(1 / k, hp + (bh - c.height) / k); c = bwip({ ...o, height: hp }); }
			return c;
		};
		const tries = txt ? [{ includetext: true, textxalign: 'center', textsize: txt / s }, { includetext: true, textsize: txt / s }, {}] : [{}];
		for (const t of tries) try { return run(t); } catch {}
		return null;
	} catch { return null; }
}
function code(el, data, bw, bh) {
	const one = el.type === 'barcode', sym = el.symbology || (one ? 'code128' : 'qrcode');
	const k = [sym, data, bw, bh, one ? (el.showText !== false) + ':' + el.textSize : el.ecc].join('\u0001');
	const c = hit(codes, k);
	if (c && typeof c === 'object') return c;
	if (c && Date.now() - c < 2000) return null;   // mislukt: kort onthouden (niet elk frame bwip), nooit permanent
	const n = makeCode(sym, data, bw, bh, one, el);
	lru(codes, k, n || Date.now(), 64);
	return n;
}
// Iets dat op de print ontbreekt (ongeldige code, bibliotheek/afbeelding/font nog niet geladen): main weigert dan te printen.
const flag = (env, el, msg) => { env.issues?.push({ id: el.id, msg }); };
function note(g, d, msg, env) {
	if (!env?.ph) return;   // placeholders: alleen in het voorbeeld, nooit op de print of in thumbs
	const fs = Math.max(6, Math.min(d.h * .4, 2.6 * DPM, d.w / Math.max(4, msg.length) * 1.9));
	g.save(); g.fillStyle = g.strokeStyle = '#000'; g.lineWidth = 1; g.setLineDash([3, 3]); g.strokeRect(.5, .5, d.w - 1, d.h - 1); g.setLineDash([]);
	g.font = `bold ${fs}px Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(msg, d.w / 2, d.h / 2, Math.max(1, d.w - 4));
	g.restore();
}
function codeOf(el, d, env) { const s = typeof bwipjs === 'undefined' ? '' : substitute(String(el.data ?? ''), env); return s ? code(el, s, d.w, d.h) : null; }
function drawCode(g, el, d, env) {
	if (typeof bwipjs === 'undefined') { flag(env, el, 'de barcode-bibliotheek is niet geladen (herlaad de pagina als je online bent)'); return note(g, d, 'Code laden...', env); }
	const data = substitute(String(el.data ?? ''), env);
	if (!data) { flag(env, el, 'geen inhoud voor de code'); return note(g, d, 'Voer inhoud in', env); }
	const c = code(el, data, d.w, d.h);
	if (!c) { flag(env, el, `ongeldige inhoud voor ${String(el.symbology || '').toUpperCase() || 'deze code'} ("${data.slice(0, 40)}")`); return note(g, d, 'Ongeldige code', env); }
	// Meer modules dan dots in de box (schaal 1 is het minimum): de code steekt uit, verliest start/stop of rustzone en scant niet.
	if (c.width > d.w + 1 || c.height > d.h + 1) { flag(env, el, `de code past niet in zijn box (te veel tekens of box te klein: ${c.width} x ${c.height} dots nodig)`); return note(g, d, 'Code te breed', env); }
	g.drawImage(c, R((d.w - c.width) / 2), R((d.h - c.height) / 2));
}

// ---------- afbeelding + icoon ----------
const pics = new Map(), svgs = new Map(), rasters = new Map();
let svgSeq = 0;
// wit = doorzichtig, zoals v1 ('darken'): onderliggende elementen blijven zichtbaar
function clearWhite(id) { const p = id.data; for (let i = 0; i < p.length; i += 4) if (p[i]) p[i + 3] = 0; return id; }
function pic(src) {
	let p = hit(pics, src);
	if (!p) {
		const im = new Image();
		p = { im, ok: false, out: new Map(), rs: new Map() };
		im.onload = () => { p.ok = true; emitAssets(); };
		im.onerror = () => { p.bad = true; emitAssets(); };
		im.src = src;
		lru(pics, src, p, 24);
	}
	return p;
}
// Contain-maat in hele dots (foto, icoon): 1 plek, zodat localContent meet wat processPic/drawIcon tekenen.
const fitDots = (w, h, bw, bh) => { const k = Math.min(bw / w, bh / h); return [Math.max(1, R(w * k)), Math.max(1, R(h * k))]; };
// Nieuwe beeldmodes (imaging.PRO) krijgen de eigen area-averaging-verkleining; oude modes houden de browserschaling,
// zodat bestaande docs exact zo blijven printen.
function processPic(p, el, bw, bh, fit) {
	const im = p.im, iw = im.naturalWidth || 1, ih = im.naturalHeight || 1;
	let dw = bw, dh = bh, sx = 0, sy = 0, sw = iw, sh = ih;
	if (fit === 'contain') [dw, dh] = fitDots(iw, ih, bw, bh);
	else if (fit === 'cover') { const s = Math.max(bw / iw, bh / ih); sw = bw / s; sh = bh / s; sx = (iw - sw) / 2; sy = (ih - sh) / 2; }
	const c = mk(dw, dh), o = c.getContext('2d', { willReadFrequently: true });
	let logo = false;
	if (PRO.has(el.mode)) {
		// Bron 1:1 uitlezen en zelf verkleinen (gecachet: een slider-tik doet alleen processImage).
		const k = [dw, dh, sx, sy, sw, sh].join('|');
		let r = hit(p.rs, k);
		if (!r) {
			const cw = Math.max(1, R(sw)), ch = Math.max(1, R(sh)), s = scratch('src', cw, ch);
			s.drawImage(im, sx, sy, sw, sh, 0, 0, cw, ch);
			r = lru(p.rs, k, resample(s.getImageData(0, 0, cw, ch), dw, dh), 3);
			s.canvas.width = s.canvas.height = 1;   // bron kan 1200x1200 zijn: geheugen niet vasthouden
		}
		const id = new ImageData(new Uint8ClampedArray(r.data), dw, dh);
		o.putImageData(clearWhite(processImage(id, el, { downscale: Math.max(sw / dw, sh / dh) })), 0, 0);
		logo = id.logo;
	} else {
		o.imageSmoothingQuality = 'high';
		o.drawImage(im, sx, sy, sw, sh, 0, 0, dw, dh);
		o.putImageData(clearWhite(processImage(o.getImageData(0, 0, dw, dh), el)), 0, 0);
	}
	return { c, x: R((bw - dw) / 2), y: R((bh - dh) / 2), logo };
}
// Per element-id: de laatst getekende foto is als logo herkend (ui verbergt dan de schuiven die niets doen).
const logos = new Map();
export const imageLogo = el => logos.get(el?.id) === true;
function placeholder(g, d, env) {
	if (!env.ph && !env.thumb) return;
	// Lijn meeschalen: 1 dot verdween in een verkleinde thumb tot een grijs waas.
	const lw = Math.max(1, R(Math.min(d.w, d.h) / 60));
	g.lineWidth = lw; g.setLineDash([4 * lw, 3 * lw]); g.strokeRect(lw / 2, lw / 2, d.w - lw, d.h - lw); g.setLineDash([]);
	const s = Math.min(d.w, d.h) * .5, x = (d.w - s) / 2, y = (d.h - s) / 2;
	g.beginPath(); poly(g, [[x, y + s], [x + s * .38, y + s * .45], [x + s * .6, y + s * .72], [x + s * .75, y + s * .58], [x + s, y + s]]); g.fill();
	g.beginPath(); g.arc(x + s * .74, y + s * .24, s * .12, 0, 2 * PI); g.fill();
}
function drawImg(g, el, d, env) {
	// Lege foto-plek (template): op de print zou de foto stil ontbreken.
	if (!el.src) { flag(env, el, 'Foto ontbreekt'); return placeholder(g, d, env); }
	const p = pic(el.src);
	if (!p.ok && !p.bad) env.pending = true;
	if (!p.ok) { flag(env, el, p.bad ? 'afbeelding onleesbaar' : 'afbeelding nog niet geladen'); return note(g, d, p.bad ? 'Afbeelding onleesbaar' : 'Laden...', env); }
	const fit = ['contain', 'cover', 'stretch'].includes(el.fit) ? el.fit : 'contain';
	const k = [d.w, d.h, fit, el.flipH, el.flipV, ...IMAGE_KEYS.map(q => el[q])].join('|');
	// 12: het variantenraster (6 presets) + het element zelf mogen elkaar niet steeds uit de cache duwen.
	const o = hit(p.out, k) || lru(p.out, k, processPic(p, el, d.w, d.h, fit), 12);
	if (!env.thumb) lru(logos, el.id, o.logo, 64);
	// Al gerasterd: schuin glad draaien en opnieuw drempelen verschoof de toon (grijs 192 ~8 punten lichter).
	g.imageSmoothingEnabled = false;
	g.drawImage(o.c, o.x, o.y);
}
// viewBox (anders width/height) bepaalt de verhouding voor contain; Tabler = 24x24.
function svgSize(svg) {
	const head = /<svg\b[^>]*>/i.exec(svg)?.[0] || '', vb = /\sviewBox\s*=\s*["']\s*[-\d.e]+[\s,]+[-\d.e]+[\s,]+([\d.e]+)[\s,]+([\d.e]+)/i.exec(head);
	const attr = n => parseFloat(new RegExp(`\\s${n}\\s*=\\s*["']\\s*([\\d.]+)(px)?\\s*["']`, 'i').exec(head)?.[1]);
	const w = vb ? +vb[1] : attr('width'), h = vb ? +vb[2] : attr('height');
	return w > 0 && h > 0 ? [w, h] : [24, 24];
}
// Op doelmaat rasteren: een 24px-svg opgeschaald wordt wazig. Zonder viewBox schaalt de inhoud niet mee (klein blokje
// linksboven): dan een viewBox op de eigen maat s (svgSize).
const sized = (svg, w, h, s) => svg.replace(/<svg\b[^>]*>/i, t => {
	t = t.replace(/\s(width|height)\s*=\s*("[^"]*"|'[^']*')/gi, '');
	return t.replace(/^<svg/i, `<svg width="${w}" height="${h}"` + (/\sxmlns\s*=/i.test(t) ? '' : ' xmlns="http://www.w3.org/2000/svg"')
		+ (/\sviewBox\s*=/i.test(t) ? '' : ` viewBox="0 0 ${s[0]} ${s[1]}"`));
});
// Eén LRU voor alle rasters (svg x maat), ruim groter dan de werkset van een render (1x + scherpe maat per element).
// Een cache van 4 per svg gooide bij twee kopieën in andere maten steeds een nodige maat weg: eindeloze laad-/renderlus
// en een voorbeeld dat grof-scherp-grof knipperde.
function svgImage(e, w, h, make = true) {
	const k = e.id + '|' + w + 'x' + h;
	let r = hit(rasters, k);
	if (!r && make) {
		const n = { im: new Image(), ok: false };
		n.im.onload = () => { n.ok = true; e.last = n.im; if (rasters.get(k) === n) emitAssets(); };
		// Kapotte svg (hand-bewerkt/geïmporteerd bestand): anders eeuwig 'Laden...' en pending.
		n.im.onerror = () => { n.bad = true; if (rasters.get(k) === n) emitAssets(); };
		n.im.src = svgUrl(sized(e.svg, w, h, e.size));
		r = lru(rasters, k, n, 256);
	}
	return r;
}
const iconSvg = el => el.source === 'iconify' ? (typeof el.svg === 'string' && /<svg\b/i.test(el.svg) ? el.svg : '')
	: Array.isArray(el.nodes) && el.nodes.length ? iconToSvg(el.nodes, { set: el.set === 'filled' ? 'filled' : 'outline', stroke: num(el.stroke, 2) }) : '';
const svgEntry = svg => hit(svgs, svg) || lru(svgs, svg, { id: ++svgSeq, svg, size: svgSize(svg), last: null }, 160);
function drawIcon(g, el, d, env) {
	const svg = iconSvg(el);
	// Icoonnaam zonder svg/nodes = nog niet aangevuld (offline, set laadt nog): op de print zou het stil ontbreken.
	if (!svg) { if (el.icon) { flag(env, el, 'icoon nog niet geladen'); note(g, d, 'Laden...', env); } return; }
	const e = svgEntry(svg), [w, h] = fitDots(...e.size, d.w, d.h), s = env.scale;
	// 1x altijd mee laden (print/thumbs exact); een snelle render (slepen/zoomen) vraagt geen nieuwe maat aan maar toont
	// wat er al is, de scherpe render erna laadt de echte maat.
	const r1 = svgImage(e, w, h), r = s === 1 ? r1 : svgImage(e, Math.max(1, R(w * s)), Math.max(1, R(h * s)), !env.fast);
	if (r1.bad) { flag(env, el, 'icoon onleesbaar'); return note(g, d, 'Icoon onleesbaar', env); }
	// Printmaat laadt nog (het beeld laadt async, de printcheck is synchroon): niet zonder icoon of met een zwart vak printen.
	if (!r1.ok) flag(env, el, 'icoon nog niet geladen');
	if (!r1.ok || !r?.ok) env.pending = true;
	const im = r?.ok ? r.im : e.last;   // andere maat nog bezig (zoomen): vorige tonen i.p.v. een flits
	if (!im) return note(g, d, 'Laden...', env);
	if (im !== r?.im) g.imageSmoothingEnabled = true;
	g.drawImage(im, R((d.w - w) / 2), R((d.h - h) / 2), w, h);
}

// ---------- emoji ----------
const EMOJI_FONT = 'Noto Emoji', MONO_FONT = `"${EMOJI_FONT}", "Segoe UI Symbol", sans-serif`, COLOR_FONT = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
// Eén font-string voor tekenen en meten (drawEmoji/localContent): anders centreert Netjes maken iets anders dan er print.
const monoFont = (el, px) => `${cl(R(num(el.weight, 500)), 300, 700)} ${px}px ${MONO_FONT}`;
const glyphs = new Map(), colorPics = new Map(), asked = new Set();
// Contain op het glyph zelf (actualBoundingBox), niet op de font-em: zo vult het tekentje de box. m gemeten op 100px.
function glyphFit(m, bw, bh) {
	const gw = m.l + m.r, gh = m.a + m.d;
	if (!(gw > 0 && gh > 0)) return null;
	const k = Math.min(bw / gw, bh / gh);
	return { px: 100 * k, x: (bw - gw * k) / 2 + m.l * k, y: (bh - gh * k) / 2 + m.a * k };
}
function glyph(g, font, ch) {
	g.font = font; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
	if ('letterSpacing' in g) g.letterSpacing = '0px';
	// Met de font-status: een meting met het vervangfont (offline start) bleef anders gelden nadat Noto Emoji alsnog laadde.
	const k = font + '|' + ch + '|' + fontReady(EMOJI_FONT, false, false, ch);
	let m = hit(glyphs, k);
	if (!m) { const t = g.measureText(ch); m = lru(glyphs, k, { l: num(t.actualBoundingBoxLeft), r: num(t.actualBoundingBoxRight), a: num(t.actualBoundingBoxAscent), d: num(t.actualBoundingBoxDescent) }, 256); }
	return m;
}
// Kleur-emoji op dot-resolutie door processImage (eigen dither-instellingen), gecachet zoals afbeeldingen.
function colorEmoji(el, ch, bw, bh) {
	const k = [ch, bw, bh, el.mode, el.threshold, el.brightness, el.contrast].join('|');
	let c = hit(colorPics, k);
	if (c) return c;
	c = mk(bw, bh);
	const o = c.getContext('2d', { willReadFrequently: true }), f = glyphFit(glyph(o, '100px ' + COLOR_FONT, ch), bw, bh);
	if (f) { o.font = f.px + 'px ' + COLOR_FONT; o.fillText(ch, f.x, f.y); }
	o.putImageData(clearWhite(processImage(o.getImageData(0, 0, bw, bh), el)), 0, 0);
	return lru(colorPics, k, c, 32);
}
function drawEmoji(g, el, d, env) {
	const ch = String(el.char ?? '').trim();
	if (!ch) return note(g, d, 'Kies een emoji', env);
	if (el.style === 'color') { g.imageSmoothingEnabled = false; return g.drawImage(colorEmoji(el, ch, d.w, d.h), 0, 0); }   // al gerasterd, zoals drawImg
	// Mono zonder U+FE0F: met die emoji-presentatiekiezer slaat Chrome Noto Emoji over en tekent de KLEUR-glyph
	// (Segoe UI Emoji), die door de drempel als leeg of als vlek uitkomt (bv. ⚖️ ✌️ ☮️ ❤️ ☀️).
	const mc = ch.replace(/\uFE0F/g, '');
	// Wachten op Noto Emoji (anders drukt de kleur-fallback een vlek); lukt laden niet, dan met wat er is. ensureFont
	// ontdubbelt en probeert na een fout later opnieuw; lukt dat, dan meldt fonts.js het en wordt opnieuw getekend.
	if (!fontReady(EMOJI_FONT, false, false, mc)) {
		const p = ensureFont(EMOJI_FONT, { text: mc });
		if (!asked.has(mc)) { asked.add(mc); p.then(() => { asked.add(mc + '\u0001'); emitAssets(); }); }
		if (!asked.has(mc + '\u0001')) { env.pending = true; flag(env, el, 'het emoji-lettertype is nog niet geladen'); return note(g, d, 'Laden...', env); }
	}
	const f = glyphFit(glyph(g, monoFont(el, 100), mc), d.w, d.h);
	if (!f) return;
	g.font = monoFont(el, f.px);
	g.fillText(mc, f.x, f.y);
}

// ---------- pijplijn ----------
const DRAW = { text: drawText, barcode: drawCode, qr: drawCode, image: drawImg, shape: drawShape, icon: drawIcon, border: drawBorder, emoji: drawEmoji };
// Bij scale > 1 op dot-resolutie: dither, modules en raster moeten exact de print zijn (alleen als er echt iets staat).
const DOTS = { image: el => !!el.src && pic(el.src).ok, barcode: codeOf, qr: codeOf, emoji: el => el.style === 'color' && !!String(el.char ?? '').trim() };
// Marge rond het omkeer-/dekkingsvlak. Tekst steekt uit (letters, cursief), een vorm hoogstens zijn lijndikte (box kleiner
// dan de lijn); beeld, icoon, emoji en code blijven in de box. Halve box (vroeger) kostte bij ver inzoomen ~19 Mpx per frame.
// Icoon-stroke is een Tabler-lijndikte zonder eenheid (geen mm): telt niet mee.
const padOf = (el, d, env) => el.type === 'border' ? 0 : el.type === 'text' ? Math.ceil(Math.max(16, num(el.size, 5) * DPM * 1.5)) + textOver(el, d, env)
	: el.type === 'shape' ? Math.ceil(num(el.stroke) * DPM) + 8 : 8;
// Tekst die uit zijn vak loopt (Passen geen, veel regels, Terugloop uit) viel buiten het vlak stil weg. Verder dan het label
// valt hij toch weg: begrensd, zodat het vlak bij inzoomen klein blijft.
function textOver(el, d, env) {
	const str = substitute(String(el.text ?? ''), env);
	if (!str) return 0;
	mctx ||= mk(1, 1).getContext('2d');
	const L = fitLayout(mctx, el, str, d.w, d.h);
	return Math.min(Math.max(env.W, env.H), Math.ceil(Math.max(0, L.w - d.w, L.h - d.h)));
}
export const dbox = el => ({ x: R(num(el.x) * DPM), y: R(num(el.y) * DPM), w: Math.max(1, R(num(el.w) * DPM) || 0), h: Math.max(1, R(num(el.h) * DPM) || 0), rot: num(el.rot) });

// Lokaal assenstelsel: oorsprong = linksboven van de box, gedraaid rond het boxmidden.
function frame(g, d) {
	const r = normDeg(d.rot);
	if (!r) { g.translate(d.x, d.y); return; }
	if (r % 90 === 0) {   // kwartslagen pixel-exact houden (barcodes blijven scanbaar)
		const q = r / 90, sw = q % 2 ? d.h : d.w, sh = q % 2 ? d.w : d.h;
		g.translate(R(d.x + d.w / 2 - sw / 2) + sw / 2, R(d.y + d.h / 2 - sh / 2) + sh / 2);
	} else { g.translate(d.x + d.w / 2, d.y + d.h / 2); g.imageSmoothingEnabled = true; }
	g.rotate(r * PI / 180); g.translate(-d.w / 2, -d.h / 2);
}

// Assen-uitgelijnde omhullende (dots, geklemd op het label) van de geroteerde box + p rondom.
function aabb(d, p, W, H) {
	const a = num(d.rot) * PI / 180, c = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a)), hw = d.w / 2 + p, hh = d.h / 2 + p;
	const ex = c * hw + sn * hh + 1, ey = sn * hw + c * hh + 1, cx = d.x + d.w / 2, cy = d.y + d.h / 2;
	const x0 = Math.max(0, Math.floor(cx - ex)), y0 = Math.max(0, Math.floor(cy - ey)), x1 = Math.min(W, Math.ceil(cx + ex)), y1 = Math.min(H, Math.ceil(cy + ey));
	return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

function drawElement(g, el, env) {
	const fn = DRAW[el.type];
	if (!fn) return;
	const d = dbox(el), op = cl(num(el.opacity, 1), 0, 1), s = env.scale;
	// Volledig transparant mag ook geen wit omkeervlak of ontbrekende-assetmelding achterlaten.
	if (!op) return;
	if (s !== 1 && (op < 1 || DOTS[el.type]?.(el, d, env))) return drawDots(g, el, d, env, op);
	g.save();
	try {
		g.fillStyle = g.strokeStyle = '#000';
		if (!el.invert && op >= 1) { frame(g, d); fn(g, el, d, env); return; }
		// Invert/dekking: apart vlak (op uitvoerresolutie), dan pas compositen (anders raakt het effect ook wat eronder ligt).
		const pad = padOf(el, d, env), lw = Math.max(1, R((d.w + 2 * pad) * s)), lh = Math.max(1, R((d.h + 2 * pad) * s)), lg = scratch('fx', lw, lh);
		lg.imageSmoothingEnabled = false; lg.fillStyle = lg.strokeStyle = '#000';
		lg.setTransform(s, 0, 0, s, pad * s, pad * s); fn(lg, el, d, env); lg.setTransform(1, 0, 0, 1, 0, 0);
		if (el.invert) {
			const b = [pad * s, pad * s, d.w * s, d.h * s];
			lg.globalCompositeOperation = 'destination-over'; lg.fillStyle = '#fff'; lg.fillRect(...b);
			lg.globalCompositeOperation = 'difference'; lg.fillRect(...b); lg.globalCompositeOperation = 'source-over';
		}
		const q = normDeg(d.rot), b = op < 1 && q % 90 ? aabb(d, pad, env.W, env.H) : null;
		if (b) {
			// Schuin + dekking: eerst draaien (glad) in een label-uitgelijnd vlak, dan pas het Bayer-raster. Andersom wordt
			// het raster geresampled en opnieuw gedrempeld: 25% dekking werd ~16%, 75% werd ~85%.
			const og = scratch('fx2', Math.max(1, R(b.w * s)), Math.max(1, R(b.h * s)));
			og.setTransform(s, 0, 0, s, -b.x * s, -b.y * s); frame(og, d); og.drawImage(lg.canvas, -pad, -pad, lw / s, lh / s); og.setTransform(1, 0, 0, 1, 0, 0);
			og.putImageData(orderedGray(og.getImageData(0, 0, og.canvas.width, og.canvas.height), op), 0, 0);
			g.drawImage(og.canvas, b.x, b.y, b.w, b.h);
			return;
		}
		if (op < 1) lg.putImageData(orderedGray(lg.getImageData(0, 0, lw, lh), op), 0, 0);
		frame(g, d);
		if (DOTS[el.type]?.(el, d, env) || el.type === 'shape' && el.fill === 'gray') g.imageSmoothingEnabled = false;   // gerasterd + Omkeren schuin: glad draaien verschoof de toon (zoals drawImg)
		g.drawImage(lg.canvas, -pad, -pad, lw / s, lh / s);
	} finally { g.restore(); }
}
// Scale > 1, dot-exact: het element precies zoals bij printen op schaal 1 tekenen, dan nearest-neighbour opschalen.
function drawDots(g, el, d, env, op) {
	let p = el.invert || op < 1 ? padOf(el, d, env) : 0;
	if (DOTS[el.type] === codeOf) { const c = codeOf(el, d, env); if (c) p = Math.max(p, Math.ceil(Math.max(c.width - d.w, c.height - d.h) / 2)); }   // te kleine box: code steekt uit
	const b = aabb(d, p, env.W, env.H);
	if (!b) return;
	const lg = scratch('dot', env.W, env.H);
	lg.imageSmoothingEnabled = false;
	// pending is een losse waarde in de kopie: terugzetten, anders rendert main na het laden niet opnieuw.
	const e1 = { ...env, scale: 1 };
	drawElement(lg, el, e1);
	if (e1.pending) env.pending = true;
	g.save(); g.imageSmoothingEnabled = false; g.drawImage(lg.canvas, b.x, b.y, b.w, b.h, b.x, b.y, b.w, b.h); g.restore();
}

// scale > 1 = scherp voorbeeld (canvas W*scale x H*scale); boxen blijven in dots. placeholders = meldingen tekenen.
// fast = snelle tussenrender (slepen/zoomen): laadt geen nieuwe icoonmaten. issues = wat op de print zou ontbreken.
// thumb = alleen de lege foto-plek tekenen (een template-thumb zonder plek oogt als een half label), geen andere meldingen.
// pending = een beeld, icoonmaat of het emoji-font laadt nog: alleen dan moet een melding zonder familie opnieuw renderen.
// boxes = per element alleen hidden (na de veldregels); editor, minibalk en inline-editor rekenen zelf in mm.
export function renderDoc(canvas, doc, ctx = {}, { scale = 1, placeholders = false, fast = false, thumb = false } = {}) {
	const lab = doc?.label || {}, W = Math.max(1, R(num(lab.w, 40) * DPM)), H = Math.max(1, R(num(lab.h, 30) * DPM)), s = scale > 0 && Number.isFinite(scale) ? scale : 1;
	const cw = Math.max(1, R(W * s)), ch = Math.max(1, R(H * s));
	if (canvas.width !== cw) canvas.width = cw;
	if (canvas.height !== ch) canvas.height = ch;
	const g = canvas.getContext('2d', { willReadFrequently: true });
	g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
	g.fillStyle = '#fff'; g.fillRect(0, 0, cw, ch);
	g.setTransform(s, 0, 0, s, 0, 0); g.imageSmoothingEnabled = false;
	// fields: presets geeft fields mee; anders die van het doc, zodat keuze-regels ook in thumbs en tests kloppen.
	const fields = ctx.fields ?? doc?.fields ?? [], now = ctx.now || new Date();
	const env = { row: ctx.row ?? null, counter: num(ctx.counter, num(doc?.counter?.start, 1)), digits: num(doc?.counter?.digits, 3), now, fields, scale: s, ph: !!placeholders, thumb: !!thumb, fast: !!fast, W, H, issues: [], pending: false };
	// 1× per render: de veldwaarden zijn voor alle elementen dezelfde (substitute leest env.display).
	const fv = fieldValues(fields, env.row, now), raw = fv.raw;
	env.display = fv.display;
	const boxes = new Map();
	for (const el of doc?.elements || []) {
		const fx = el.rules?.length ? applyRules(el, raw) : el;
		// hidden = na de regels: de editor pakt zo alleen wat echt zichtbaar is (keuze-varianten op dezelfde plek).
		boxes.set(el.id, { hidden: !!fx.hidden });
		if (fx.hidden) continue;
		// Kopie alleen als een regel invert omzet: caches en de editor werken op het echte element.
		const e = !fx.invert === !el.invert ? el : { ...el, invert: !!fx.invert };
		try { drawElement(g, e, env); }
		catch { const d = dbox(el); flag(env, el, 'tekenen mislukt'); g.save(); frame(g, d); note(g, d, 'Fout: ' + (el.type || '?'), env); g.restore(); }
	}
	g.setTransform(1, 0, 0, 1, 0, 0);
	// Eindstap zoals v1: de preview is exact de print.
	// Per pixel als 32-bit woord (~3x sneller op scale 4-8); zelfde formule = zelfde printbytes.
	// shortcut: neemt little-endian aan (alle gangbare browsers/CPU's); voor een big-endian-doel terug naar de byte-lus.
	const id = g.getImageData(0, 0, cw, ch), u = new Uint32Array(id.data.buffer), bw = v => .299 * (v & 255) + .587 * (v >>> 8 & 255) + .114 * (v >>> 16 & 255) < 128 ? BLACK : WHITE;
	// Snel (slepen/typen): alleen de drempel; de printwaarheid (2e render) komt in de scherpe render erna.
	if (s === 1 || fast) for (let i = 0; i < u.length; i++) { const v = u[i]; if (v !== WHITE && v !== BLACK) u[i] = bw(v); }
	else {
		// Zelfde drempel, en in dezelfde pass per dot tellen hoeveel hoge-resolutiepixels zwart zijn (voor printTruth).
		const m = dotMap(cw, ch, s, W, H), { xs, ys, blk } = m;
		for (let Y = 0, i = 0; Y < ch; Y++) {
			const row = ys[Y] * W;
			for (let X = 0; X < cw; X++, i++) { let v = u[i]; if (v !== WHITE && v !== BLACK) u[i] = v = bw(v); if (v === BLACK) blk[row + xs[X]]++; }
		}
		printTruth(u, cw, m, W, H, () => { const t = truthCv ||= mk(1, 1); renderDoc(t, doc, ctx, { scale: 1, placeholders }); return t; });
	}
	g.putImageData(id, 0, 0);
	return { W, H, boxes, issues: env.issues, pending: env.pending };
}

// Scherp voorbeeld = print-waarheid, zonder de trap van het printraster. Per dot: hoge resolutie (>= helft van het
// dot-vlak zwart) tegen de echte printdot (scale 1). Een stuk (8-samenhangend) waar ze verschillen dat tegen precies één
// aaneengesloten stuk van de andere kant ligt, is alleen een randje anders (afronding, font-hinting op 1x): dat blijft glad.
// Raakt het niets (verdwijnt/extra spikkel) of twee losse contactplekken (gat in een dunne lijn, ook in een gesloten ring;
// letters die op de print versmelten), dan krijgt dat stuk de printdots: zulke printfouten zie je zo ook in het voorbeeld.
// Geeft het aantal gecorrigeerde dots.
let truthCv = null;
// Welke dot elke hoge-resolutiepixel dekt (pixelmidden, zoals nearest-neighbour), het eerste pixel en aantal per dot.
function dotMap(cw, ch, s, W, H) {
	const xs = new Int32Array(cw), ys = new Int32Array(ch), x0 = new Int32Array(W), y0 = new Int32Array(H), nx = new Int32Array(W), ny = new Int32Array(H);
	for (let X = cw - 1; X >= 0; X--) { const x = xs[X] = Math.min(W - 1, Math.floor((X + .5) / s)); x0[x] = X; nx[x]++; }
	for (let Y = ch - 1; Y >= 0; Y--) { const y = ys[Y] = Math.min(H - 1, Math.floor((Y + .5) / s)); y0[y] = Y; ny[y]++; }
	return { xs, ys, x0, y0, nx, ny, blk: new Uint16Array(W * H) };
}
function printTruth(u, cw, m, W, H, renderPrint) {
	const t = new Uint32Array(renderPrint().getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data.buffer);
	const N = W * H, { blk, nx, ny, x0, y0 } = m, P = new Uint8Array(N), V = new Uint8Array(N);
	let diff = 0;
	for (let d = 0; d < N; d++) { const x = d % W, y = (d - x) / W; P[d] = t[d] === BLACK ? 1 : 0; V[d] = blk[d] * 2 >= nx[x] * ny[y] ? 1 : 0; if (P[d] !== V[d]) diff++; }
	if (!diff) return 0;
	const comp = new Int32Array(N), tch = new Int32Array(N), vis = new Int32Array(N), st = new Int32Array(N), fix = new Uint8Array(N);   // 1 = zwart, 2 = wit
	const nb = (d, fn) => { const x = d % W, y = (d - x) / W; for (let j = -1; j <= 1; j++) { const yy = y + j; if (yy < 0 || yy >= H) continue; for (let i = -1; i <= 1; i++) { const xx = x + i; if ((i || j) && xx >= 0 && xx < W) fn(yy * W + xx); } } };
	let n = 0, k = 0;
	for (let d0 = 0; d0 < N; d0++) {
		if (P[d0] === V[d0] || comp[d0]) continue;
		const ink = P[d0], other = ink ? V : P, cells = [], touch = [];   // ink 1 = print heeft extra inkt, 0 = print mist inkt
		let sp = 0;
		comp[d0] = ++k; st[sp++] = d0;
		while (sp) {
			const d = st[--sp];
			cells.push(d);
			nb(d, e => {
				if (P[e] !== V[e] && P[e] === ink) { if (!comp[e]) { comp[e] = k; st[sp++] = e; } }
				else if (other[e] && tch[e] !== k) { tch[e] = k; touch.push(e); }
			});
		}
		let groups = 0;
		for (const c of touch) {
			if (vis[c] === k) continue;
			if (++groups > 1) break;
			vis[c] = k; st[sp++] = c;
			while (sp) { const d = st[--sp]; nb(d, e => { if (tch[e] === k && vis[e] !== k) { vis[e] = k; st[sp++] = e; } }); }
		}
		if (groups !== 1) for (const d of cells) { fix[d] = ink ? 1 : 2; n++; }
	}
	if (!n) return 0;
	for (let d = 0; d < N; d++) {
		if (!fix[d]) continue;
		const x = d % W, y = (d - x) / W, c = fix[d] === 1 ? BLACK : WHITE;
		for (let Y = y0[y]; Y < y0[y] + ny[y]; Y++) u.fill(c, Y * cw + x0[x], Y * cw + x0[x] + nx[x]);
	}
	return n;
}

// c.pending: zoals bij renderDoc (de ui tekent de thumb alleen bij een beeld-melding opnieuw als hij nog wachtte).
export function renderThumb(doc, maxPx = 160) {
	const full = mk(1, 1), { W, H, pending } = renderDoc(full, doc, {}, { thumb: true });
	const s = maxPx / Math.max(W, H), c = mk(R(W * s), R(H * s)), g = c.getContext('2d');
	if (doc?.label?.shape === 'round') { g.beginPath(); g.ellipse(c.width / 2, c.height / 2, c.width / 2, c.height / 2, 0, 0, 2 * PI); g.clip(); }
	g.imageSmoothingEnabled = s < 1; g.imageSmoothingQuality = 'high';
	g.drawImage(full, 0, 0, c.width, c.height);
	c.pending = pending;
	return c;
}

// ---------- zichtbare inhoud + getekende maat (centreren/netjes maken, 'Auto'-grootte) ----------
// Tekstlayout zoals drawText hem maakt, gecachet: ui en minibar vragen dit elke refresh (ook tijdens slepen).
// Teller/cijfers zoals measureText: de startwaarde van het voorbeeld (de echte teller per label kent alleen de render).
const lays = new Map();
// Laadt er later nog een stuk font (latin-ext: Ł, ő) dan klopt de sleutel nog maar de maat niet meer.
onFontLoaded(() => lays.clear());
function textLay(el, fields, row, counter) {
	if (el?.type !== 'text') return null;
	const str = substitute(String(el.text ?? ''), measureEnv(row, counter, fields));
	if (!str) return null;
	const d = dbox(el), fam = el.font || 'Arial', k = JSON.stringify([str, d.w, d.h, el.size, el.fit, fam, !!el.bold, !!el.italic, el.wrap, el.lineHeight,
		el.letterSpacing, !!el.vertical, el.align, el.valign, el.outline, !!el.underline, !!el.strike, fontReady(fam, !!el.bold, !!el.italic)]);
	const r = hit(lays, k);
	if (r) return r;
	mctx ||= mk(1, 1).getContext('2d');
	const L = fitLayout(mctx, el, str, d.w, d.h);
	return lru(lays, k, { px: L.px, box: textInk(mctx, el, L, d) }, 32);
}
// Vlak (dots, t.o.v. linksboven van de box) van wat drawText tekent. Verticaal de inkt (bovenkant letters tot
// basislijn/onderstok): met de regelbox stond 'Hello' 1,2 mm te laag. Horizontaal minstens de regelbreedte (Netjes maken zet
// het vak daarop; smaller breekt of krimpt de tekst), maar met het midden op de inkt: de zijruimte van de letters (H links
// 1 mm bij 15 mm) zette 'Hello' anders 0,6 mm uit het midden. Onder-/doorhaling en uitvullen lopen over de hele regel.
function textInk(g, el, L, d) {
	const f = fontFaces(el.font || 'Arial'), px = L.px, sb = el.bold && !f.bold ? px * SYN.bold : 0, grow = (num(el.outline) * DPM + sb) / 2;
	const sk = el.italic && !f.italic ? SYN.skew : 0;   // synthetisch cursief (drawText): boven schuift naar rechts, onder naar links
	g.font = fontSpec(el, px); g.textAlign = 'left';   // actualBoundingBoxLeft/Right gelden t.o.v. het uitlijnpunt
	if ('letterSpacing' in g) g.letterSpacing = L.ls + 'px';
	const { top, asc, y: base } = baselines(g, el, L, d), ax = HALIGN[el.align] ?? 0;
	if (el.vertical) return { x: (d.w - L.w) * ax - grow, y: top - grow, w: L.w + 2 * grow, h: L.h + 2 * grow };
	let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, i0 = Infinity, i1 = -Infinity;
	L.lines.forEach((ln, i) => {
		if (!ln.t.trim()) return;
		const y = base(i), m = g.measureText(ln.t), just = el.align === 'justify' && !ln.end && /(?<=\S) /.test(ln.t);
		const x = just ? 0 : (d.w - ln.w) * ax, xe = x + (just ? d.w : ln.w), a = num(m.actualBoundingBoxAscent, asc), de = num(m.actualBoundingBoxDescent, 0);
		x0 = Math.min(x0, x); x1 = Math.max(x1, xe);
		if (just || el.underline || el.strike) { i0 = Math.min(i0, x); i1 = Math.max(i1, xe); }
		if (!just) { i0 = Math.min(i0, x - num(m.actualBoundingBoxLeft, 0) - sk * de); i1 = Math.max(i1, x + num(m.actualBoundingBoxRight, ln.w) + sk * a); }
		y0 = Math.min(y0, y - a);
		y1 = Math.max(y1, y + Math.max(de, el.underline ? px * SYN.ul + Math.max(1, px * SYN.th) : 0));
	});
	const w = Math.max(x1 - x0, i1 - i0);
	return x1 > x0 ? { x: (i0 + i1 - w) / 2 - grow, y: y0 - grow, w: w + 2 * grow, h: y1 - y0 + 2 * grow } : null;
}
// Inkt van een icoonraster zoals de mono-stap hem drukt (op wit, zelfde drempel); null = geen inkt.
function rasterInk(im, w, h) {
	const g = scratch('ink', w, h);
	g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(im, 0, 0, w, h);
	const p = g.getImageData(0, 0, w, h).data;
	let x0 = w, y0 = h, x1 = -1, y1 = -1;
	for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4) if (.299 * p[i] + .587 * p[i + 1] + .114 * p[i + 2] < 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; y1 = y; }
	return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
// e.ink = inkt als verhouding (los van de maat): een nog niet geladen maat rekent daarmee.
function measureInk(e, r, w, h) {
	if (!r.ok || r.ink !== undefined) return;
	const n = r.ink = rasterInk(r.im, w, h);
	e.ink = n && { x: n.x / w, y: n.y / h, w: n.w / w, h: n.h / h };
}
// Vóór het plaatsen (ui): plaatsen centreert op de inkt, en een nooit gemeten svg telde anders als zijn hele viewBox
// (eerste icoon ~0,4 mm scheef). Rastert 1x op een vaste maat; mislukt laden = toch klaar (dan de viewBox).
export function loadIcon(el) {
	const svg = iconSvg(el), e = svg && svgEntry(svg);
	if (!e || e.ink !== undefined) return Promise.resolve();
	const [w, h] = fitDots(...e.size, 240, 240), r = svgImage(e, w, h);
	return new Promise(res => {
		const done = () => { measureInk(e, r, w, h); res(); };
		if (r.ok || r.bad) return done();   // al mislukt: het error-event komt niet nog eens
		r.im.addEventListener('load', done, { once: true });
		r.im.addEventListener('error', () => res(), { once: true });
	});
}
function localContent(el, d, fields, row, counter) {
	if (el.type === 'text') {
		// Nog ladend font = vervangende maten: null (de box), anders bakt Netjes maken/Centreren die in (zoals bij de mono-emoji).
		const fam = el.font || 'Arial', b = !!el.bold, it = !!el.italic;
		return fontReady(fam, b, it) || fontFailed(fam, b, it) ? textLay(el, fields, row, counter)?.box || null : null;
	}
	if (el.type === 'icon') {
		const svg = iconSvg(el);
		if (!svg) return null;
		// Inkt, niet de viewBox: lege marge in de svg (game-icons ~3 %, Tabler meer) zette een groep met icoon scheef.
		// Hetzelfde 1x-raster als drawIcon (geen extra laadwerk). Deze maat nog niet geladen (Netjes maken schaalt en meet
		// meteen opnieuw): de inkt van een eerder gemeten maat naar verhouding (~1 dot); nog nooit gemeten = de viewBox.
		const e = svgEntry(svg), [w, h] = fitDots(...e.size, d.w, d.h), r = svgImage(e, w, h), x = R((d.w - w) / 2), y = R((d.h - h) / 2);
		measureInk(e, r, w, h);
		const k = r.ok ? r.ink : e.ink === undefined ? { x: 0, y: 0, w, h } : e.ink && { x: e.ink.x * w, y: e.ink.y * h, w: e.ink.w * w, h: e.ink.h * h };
		return k && { x: x + k.x, y: y + k.y, w: k.w, h: k.h };
	}
	if (el.type === 'image') {
		if (!el.src || el.fit === 'cover' || el.fit === 'stretch') return null;
		const p = pic(el.src);
		if (!p.ok) return null;
		const [w, h] = fitDots(p.im.naturalWidth || 1, p.im.naturalHeight || 1, d.w, d.h);   // hele dots, zoals processPic
		return { x: R((d.w - w) / 2), y: R((d.h - h) / 2), w, h };
	}
	if (el.type === 'emoji') {
		const ch = String(el.char ?? '').trim(), mc = ch.replace(/\uFE0F/g, ''), color = el.style === 'color';
		// Noto Emoji nog niet geladen = vervangende maten: null (de box), anders bakt Netjes maken/Centreren die in.
		if (!ch || !color && !fontReady(EMOJI_FONT, false, false, mc)) return null;
		mctx ||= mk(1, 1).getContext('2d');
		const m = color ? glyph(mctx, '100px ' + COLOR_FONT, ch) : glyph(mctx, monoFont(el, 100), mc), gw = m.l + m.r, gh = m.a + m.d;
		if (!(gw > 0 && gh > 0)) return null;
		const k = Math.min(d.w / gw, d.h / gh), w = gw * k, h = gh * k;
		return { x: (d.w - w) / 2, y: (d.h - h) / 2, w, h };
	}
	return null;
}
// Zichtbare inhoud in mm (doc-coördinaten); gedraaid = omhullende rond het boxmidden, zoals frame() draait. null = de box.
export function contentBox(el, fields, row = null, counter = null) {
	if (!el) return null;
	const d = dbox(el), b = localContent(el, d, fields, row, counter);   // fouten vangt doc.seen() al
	if (!b) return null;
	const a = num(el.rot) * PI / 180, c = Math.cos(a), s = Math.sin(a), hw = d.w / 2, hh = d.h / 2;
	const P = [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]].map(([x, y]) => [d.x + hw + (x - hw) * c - (y - hh) * s, d.y + hh + (x - hw) * s + (y - hh) * c]);
	const xs = P.map(p => p[0]), ys = P.map(p => p[1]), x0 = Math.min(...xs), y0 = Math.min(...ys);
	return { x: x0 / DPM, y: y0 / DPM, w: (Math.max(...xs) - x0) / DPM, h: (Math.max(...ys) - y0) / DPM };
}
// Getekende lettergrootte (mm) bij Passen = Krimpen/Groeien; anders el.size.
export function fitSize(el, fields, row = null, counter = null) {
	if (el?.type !== 'text' || (el.fit !== 'shrink' && el.fit !== 'fill')) return el?.size;
	const r = textLay(el, fields, row, counter);
	return r ? r.px / DPM : el.size;
}

export async function selftest() {
	const details = [];
	let ok = true;
	const chk = (c, m) => { details.push((c ? 'ok ' : 'FAIL ') + m); if (!c) ok = false; };
	chk(SHAPES.map(s => s.id).join() === 'rect,ellipse,line,triangle,diamond,hexagon,star,heart,arrow,speech,burst,cross,check', 'SHAPES-ids = SPEC');
	chk(BORDER_STYLES.map(s => s.id).join() === 'line,double,thick,rounded,rounded-double,dashed,dotted,thick-thin,corners,brackets,ticket,stamp,scallop,wave,zigzag,film,dots,stars,hearts,ornate,deco,inset,shadow,tag', 'BORDER_STYLES-ids = SPEC');
	chk([...SHAPES, ...BORDER_STYLES].every(s => s.name), 'alle namen gevuld');
	chk(BORDER_STYLES.every(s => typeof BD[s.id] === 'function') && SHAPES.every(s => POLY[s.id] || PATHS.has(s.id)), 'elke rand/vorm heeft een tekenfunctie');
	chk(Object.values(POLY).every(p => p.every(([x, y]) => x >= -1e-9 && x <= 1 + 1e-9 && y >= -1e-9 && y <= 1 + 1e-9)), 'vormpolygonen binnen eenheidsbox');
	const m = s => s.length, wt = (s, w) => JSON.stringify(wrapText(s, w, m).map(l => l.t));
	chk(wt('aa bb cc', 5) === '["aa bb","cc"]', 'wrap op woorden');
	chk(wt('abcdefgh', 3) === '["abc","def","gh"]', 'te lang woord breekt op tekens');
	chk(wt('\u{1F525}\u{1F525}\u{1F525}', 3) === JSON.stringify(Array(3).fill('\u{1F525}')), 'emoji breekt heel (geen losse surrogaat)');
	chk(wt('a\n\nb', 9) === '["a","","b"]', 'lege regels blijven staan');
	chk(wt('aa THC-gehalte', 9) === '["aa THC-","gehalte"]' && wt('pak 10-20', 6) === '["pak","10-20"]' && wt('pak 10-20', 7) === '["pak 10-","20"]'
		&& wt('2 20%-25%', 8) === '["2","20%-25%"]' && wt('a THC-.', 6) === '["a","THC-."]' && wt('a-b', 9) === '["a-b"]', 'afbreken na koppelteken zoals Chrome');
	chk(wt('  ab', 9) === '["  ab"]' && wt('x\n  y', 9) === '["x","  y"]' && wt('aaaa  bb', 4) === '["aaaa","bb"]' && wt('aaaa   bb', 4) === '["aaaa","bb"]', 'spaties vooraan de alinea blijven, bij een afbreek vallen ze weg');
	chk(wt('    abcd', 5) === '["    ","abcd"]', 'inspringen + woord past niet: woord heel op regel 2, zoals Chrome (niet op letters)');
	chk(wt('aaaa ', 4) === '["aaaa"]' && wt('aaaa \nbb', 4) === '["aaaa","bb"]', 'spatie achteraan die niet past: geen lege extra regel');
	// Lang woord zonder spaties (geplakte link/sleutel): gemeten tekens lineair, niet kubisch (van achteren: ~17 miljoen).
	let mc = 0;
	const lw = wrapText('a'.repeat(1000), 10, s => (mc += s.length, s.length));
	chk(lw.length === 100 && lw.every(l => l.t.length === 10) && mc < 2e5, `lang woord op tekens: ${mc} tekens gemeten (< 200000)`);
	const NL = '\u{1F1F3}\u{1F1F1}', HT = '❤️';
	chk(wt(NL.repeat(4), 6) === JSON.stringify(Array(4).fill(NL)) && wt(HT.repeat(3), 3) === JSON.stringify(Array(3).fill(HT)), 'vlag en hartje (meer codepunten) breken heel');
	const pts = alongEdge(100, 60, 5, 10), near = (p, x, y) => Math.abs(p[0] - x) < 1e-9 && Math.abs(p[1] - y) < 1e-9;
	chk(pts.length === 28 && [[5, 5], [95, 5], [95, 55], [5, 55]].every(([x, y]) => pts.filter(p => near(p, x, y)).length === 1), 'randsymbolen: elke hoek precies 1x, gelijk verdeeld');
	const gf = glyphFit({ l: 0, r: 50, a: 80, d: 20 }, 100, 100), gl = glyphFit({ l: -10, r: 60, a: 30, d: 20 }, 100, 50);
	chk(gf.px === 100 && gf.x === 25 && gf.y === 80 && gl.px === 100 && gl.x === 15 && gl.y === 30 && glyphFit({ l: 0, r: 0, a: 0, d: 0 }, 9, 9) === null, 'emoji: contain + centreren op het glyph (bearing meegerekend)');
	chk(svgSize('<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 640 512"><path/></svg>').join() === '640,512'
		&& svgSize('<svg width="30px" height="10"></svg>').join() === '30,10' && svgSize('<svg></svg>').join() === '24,24', 'svg-verhouding uit viewBox/width/height');
	chk(sized('<svg width="1em" height="1em" viewBox="0 0 640 512"><path stroke-width="2"/></svg>', 80, 64, [640, 512])
		=== '<svg width="80" height="64" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512"><path stroke-width="2"/></svg>', 'svg op doelmaat (alleen de root-tag)');
	const nv = '<svg width="20" height="10"><rect width="20" height="10"/></svg>';
	chk(sized(nv, 160, 80, svgSize(nv)) === '<svg width="160" height="80" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 10"><rect width="20" height="10"/></svg>', 'svg zonder viewBox krijgt er een (inhoud schaalt mee)');
	chk(fontSpec({ font: 'Ari"al\n\\' }, 40) === '40px "Ari\\"al\\\\", sans-serif', 'fontnaam met " / \\ / newline ge-escapet (geldige font-string)');
	// Verticaal per grafeem: ❤️, een vlag en e + combinerend accent zijn elk 1 cel.
	chk(layout({}, { vertical: true, wrap: false }, 'A❤️B\u{1F1F3}\u{1F1F1}é', 10, 99, 99).cols[0].length === 5, 'verticale tekst: emoji, vlag en accent heel (1 cel per teken)');
	const ab = aabb({ x: 10, y: 10, w: 20, h: 4, rot: 90 }, 0, 100, 100);
	chk(ab.x <= 18 && ab.y <= 2 && ab.x + ab.w >= 22 && ab.y + ab.h >= 22 && ab.w <= 8 && ab.h <= 24 && aabb({ x: -50, y: 0, w: 10, h: 10, rot: 0 }, 0, 100, 100) === null
		&& aabb({ x: -5, y: -5, w: 10, h: 10, rot: 0 }, 0, 100, 100).x === 0, 'omhullende van geroteerde box, geklemd op het label');
	if (typeof document === 'undefined') { details.push('DOM-tests overgeslagen (geen document)'); return { ok, details }; }

	const cv = document.createElement('canvas'), E = { id: 'e', x: 1, y: 1, w: 38, h: 28, rot: 0, locked: false, hidden: false, invert: false, opacity: 1 };
	const run = (els, lab = { w: 40, h: 30 }, o = {}) => { const r = renderDoc(cv, { label: lab, counter: { start: 1, digits: 3 }, elements: els }, {}, o); return { ...r, p: cv.getContext('2d').getImageData(0, 0, r.W, r.H).data }; };
	const stats = ({ p, W, H }, box) => {
		let n = 0, out = 0, bad = 0, x0 = W, y0 = H, x1 = -1, y1 = -1;
		for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
			const v = p[(y * W + x) * 4];
			if (v !== 0 && v !== 255) bad++;
			if (v) continue;
			n++; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
			if (box && (x < box[0] || y < box[1] || x >= box[2] || y >= box[3])) out++;
		}
		return { n, out, bad, bw: x1 - x0 + 1, bh: y1 - y0 + 1 };
	};
	const white = (r, x, y) => r.p[(y * r.W + x) * 4] === 255;
	for (const b of BORDER_STYLES) {
		const r = run([{ ...E, type: 'border', style: b.id, stroke: .6 }]), s = stats(r, [8, 8, 312, 232]);
		chk(s.n > 60 && !s.out && !s.bad && white(r, 160, 120), `rand ${b.id}: binnen de box, midden leeg (${s.n} dots)`);
	}
	const bdIss = (style, w, h, stroke) => renderDoc(cv, { label: { w: 40, h: 30 }, elements: [{ ...E, type: 'border', style, w, h, stroke }] }, {}, {}).issues.length;
	chk(!bdIss('scallop', 34, 3.4, 1) && !bdIss('scallop', 5, 5, 1.5) && !bdIss('scallop', 2, 2, .6), 'schulprand in een smal vak: geen tekenfout (print niet geweigerd)');
	chk(run([{ ...E, type: 'border', style: 'constructor', stroke: .6 }]).p.join() === run([{ ...E, type: 'border', style: 'line', stroke: .6 }]).p.join(), 'randstijl-naam van Object.prototype = lijn');
	for (const sh of SHAPES) {
		const r = run([{ ...E, x: 10, y: 5, w: 20, h: 20, type: 'shape', shape: sh.id, stroke: .5, fill: 'black', radius: 1, dash: 'solid' }]), s = stats(r, [80, 40, 240, 200]);
		chk(s.n > 40 && !s.out, `vorm ${sh.id}`);
	}
	const rot = stats(run([{ ...E, x: 10, y: 13, w: 20, h: 4, rot: 90, type: 'shape', shape: 'rect', stroke: 0, fill: 'black', radius: 0 }]));
	chk(rot.bw === 32 && rot.bh === 160 && rot.n === 32 * 160, `rotatie 90 pixel-exact (${rot.bw}x${rot.bh}, ${rot.n})`);
	const op = stats(run([{ ...E, x: 5, y: 5, w: 10, h: 10, opacity: .5, type: 'shape', shape: 'rect', stroke: 0, fill: 'black', radius: 0 }]));
	chk(op.n === 3200, `dekking 50% = half zo veel dots (${op.n})`);
	const under = { ...E, type: 'shape', shape: 'rect', stroke: 0, fill: 'black' };
	const zero = run([under, { ...under, x: 10, y: 10, w: 10, h: 10, invert: true, opacity: 0 },
		{ ...E, type: 'image', src: '', opacity: 0 }]);
	chk(zero.p.join() === run([under]).p.join() && !zero.issues.length && !zero.pending,
		'dekking 0%: omgekeerd element laat ondergrond intact, ontbrekende foto blokkeert printen niet');
	for (const invert of [false, true]) {
		const grayDots = [0, 17, 45, 90].map(rot => stats(run([{ ...under, x: 10, y: 5, w: 20, h: 20, fill: 'gray', rot, invert }])).n);
		chk(grayDots[0] > 10000 && grayDots.every(n => Math.abs(n / grayDots[0] - 1) < .02),
			`grijze vorm houdt zijn toon bij draaien (omkeren ${invert}: ${grayDots.join('/')} zwarte dots)`);
	}
	const T = { ...E, type: 'text', text: 'Hallo wereld, dit is een lange tekst', font: 'Arial', size: 6, bold: false, italic: false, underline: false, strike: false, align: 'left', valign: 'top', lineHeight: 1.15, letterSpacing: 0, wrap: true, fit: 'shrink', vertical: false, outline: 0 };
	const tb = { ...T, x: 5, y: 10, w: 30, h: 8 }, txt = stats(run([tb]), [40 - 2, 80 - 2, 280 + 2, 144 + 2]);
	chk(txt.n > 50 && txt.out < 4, `tekst krimpt binnen de box (${txt.n} dots, ${txt.out} erbuiten)`);
	const lay = fitLayout(cv.getContext('2d'), tb, tb.text, 240, 64);
	chk(lay.w <= 240.5 && lay.h <= 64.5 && lay.px < 48, 'fit shrink past');
	const fl = fitLayout(cv.getContext('2d'), { ...tb, fit: 'fill', text: 'A' }, 'A', 240, 64);
	chk(fl.px > 48 && fl.h <= 64.5, 'fit fill vergroot');
	const inv = stats(run([{ ...tb, invert: true, text: 'A', fit: 'none', size: 3 }]));
	chk(inv.n > 240 * 64 * .7, 'invert: box zwart, tekst wit');
	for (const k of ['vertical', 'underline', 'strike', 'italic', 'bold']) chk(stats(run([{ ...tb, [k]: true, align: 'justify', outline: k === 'bold' ? .2 : 0 }])).n > 50, 'tekst ' + k);
	// Uitvullen met inspringen: het eerste woord houdt zijn spaties (geen lege woorden met elk een opgerekt gat).
	const ind = align => { const r = run([{ ...T, x: 1, y: 1, w: 16, h: 20, size: 3, fit: 'none', text: '  Bewaar koel en droog buiten bereik van kinderen', align }]);
		for (let x = 0; x < r.W; x++) for (let y = 8; y < 32; y++) if (!r.p[(y * r.W + x) * 4]) return x; return -1; };
	chk(ind('justify') === ind('left') && ind('left') > 16, `uitvullen met inspringen begint als links (${ind('justify')} / ${ind('left')} dots)`);
	chk([false, true].every(v => run([{ ...tb, vertical: v, valign: 'constructor', align: 'constructor' }]).p.join() === run([{ ...tb, vertical: v, valign: 'top', align: 'left' }]).p.join()), 'uitlijning-naam van Object.prototype = links/boven (tekst niet onzichtbaar)');
	const fq = mk(1, 1).getContext('2d'); fq.font = fontSpec({ font: 'Ari"al\n' }, 40);
	chk(fq.font.startsWith('40px'), `fontnaam met " en newline: canvas neemt de font-string aan (${fq.font})`);
	chk(Math.abs(measureText({ ...T, text: 'a\nb', size: 4, w: 30 }).h - 2 * 4 * 1.15) < 1e-6, 'measureText hoogte = regels x grootte x regelafstand');
	// Voorbeeldrij telt mee; Krimpen + letterafstand: breedte = de getekende (letterafstand schaalt met de px mee).
	const mr = measureText({ ...T, text: '{naam}', size: 4, w: 30, fit: 'none' }, null, { naam: 'a\nb' }), ms = measureText({ ...T, text: 'HAZE', size: 6, w: 15, h: 5, wrap: false, letterSpacing: 1 });
	chk(Math.abs(mr.h - 2 * 4 * 1.15) < 1e-6 && ms.w <= 15 + .07 && ms.w > 10, `measureText: met rij (${mr.h.toFixed(2)} mm hoog), Krimpen + letterafstand past (${ms.w.toFixed(2)} mm)`);
	// {teller} op de ingestelde cijfers, zoals renderDoc hem tekent (niet altijd '001').
	const TC = { ...T, text: '{teller}', size: 4, w: 30, fit: 'none', wrap: false }, tw = c => measureText(TC, null, null, c).w;
	// Verticaal breekt op de boxhoogte: zonder die grens 1 kolom van 49 mm (Box passend schoot buiten het label).
	const mv = measureText({ ...T, text: 'ABCDEFGHIJ', size: 5, w: 20, h: 26, vertical: true, fit: 'none' });
	chk(mv.h <= 26 && mv.w > 10, `measureText verticaal: kolommen binnen de boxhoogte (${mv.w.toFixed(2)} x ${mv.h.toFixed(2)} mm)`);
	chk(tw({ start: 1, digits: 6 }) > tw({ start: 1, digits: 3 }) * 1.7 && Math.abs(tw(null) - tw({ start: 1, digits: 3 })) < 1e-9, `measureText {teller} met doc.counter-cijfers (${tw({ start: 1, digits: 6 }).toFixed(2)} vs ${tw(null).toFixed(2)} mm)`);
	if (typeof bwipjs !== 'undefined') {
		const c = code({ type: 'barcode', symbology: 'code128', showText: true, textSize: 2.5 }, '12345', 272, 96);
		chk(!!c && c.width <= 272 + 2 && Math.abs(c.height - 96) <= 2, `code128 past (${c && c.width}x${c && c.height})`);
		const c1 = bwip({ bcid: 'code128', text: '12345', scale: 1, height: 10 }), c2 = bwip({ bcid: 'code128', text: '12345', scale: 3, height: 10 });
		chk(c2.width === c1.width * 3, 'gehele schaal = gehele dots per module');
		chk(!!code({ type: 'barcode', symbology: 'codabar', showText: true, textSize: 2.5 }, 'A40156B', 272, 96), 'codabar tekent (bwip-naam rationalizedCodabar)');
		chk(code({ type: 'barcode', symbology: 'ean13', showText: true, textSize: 2.5 }, 'abc', 272, 96) === null, 'ongeldige EAN geeft null');
		const q = code({ type: 'qr', symbology: 'qrcode', ecc: 'M' }, 'https://example.com', 144, 144);
		chk(!!q && q.width === q.height && q.width <= 144, 'qr vierkant en binnen de box');
		// 2D vergroot uit schaal 1 = pixel-gelijk aan bwip op die schaal (ook pdf417 met scaleX != scaleY).
		const px = c => c.getContext('2d').getImageData(0, 0, c.width, c.height).data.join();
		const q1 = bwip({ bcid: 'qrcode', text: 'Hallo', eclevel: 'M', scale: 1 }), p1 = bwip({ bcid: 'pdf417', text: 'Hallo', scale: 1 });
		const qk = Math.floor(100 / q1.width), pkx = Math.floor(300 / p1.width), pky = Math.floor(100 / p1.height);
		const mq = makeCode('qrcode', 'Hallo', 100, 100, false, { ecc: 'M' }), mp = makeCode('pdf417', 'Hallo', 300, 100, false, {});
		chk(qk > 1 && pkx !== pky && px(mq) === px(bwip({ bcid: 'qrcode', text: 'Hallo', eclevel: 'M', scale: qk })) && px(mp) === px(bwip({ bcid: 'pdf417', text: 'Hallo', scaleX: pkx, scaleY: pky })),
			`2D-code vergroot = bwip op schaal (qr x${qk}, pdf417 ${pkx}x${pky})`);
		const badEan = [{ ...E, type: 'barcode', data: 'x', symbology: 'ean13', showText: true, textSize: 2.5 }];
		chk(stats(run(badEan, undefined, { placeholders: true })).n > 20 && !stats(run(badEan)).n, 'ongeldige code: melding alleen met placeholders');
	} else details.push('bwip-js niet geladen: codetests overgeslagen');
	// ---- golf 2: scherp voorbeeld (scale), placeholders, emoji, iconify ----
	const until = async (f, ms = 3000) => { const t0 = Date.now(); while (!f() && Date.now() - t0 < ms) await new Promise(r => setTimeout(r, 25)); return f(); };
	const cv4 = document.createElement('canvas');
	const at = (els, s = 1, opt = {}, lab = { w: 40, h: 30 }) => {
		const c = s === 1 ? cv : cv4, r = renderDoc(c, { label: lab, counter: { start: 1, digits: 3 }, elements: els }, {}, { scale: s, ...opt });
		return { dW: r.W, W: c.width, H: c.height, p: c.getContext('2d').getImageData(0, 0, c.width, c.height).data };
	};
	// Elk sxs-blok uniform en gelijk aan de dot op schaal 1 = na downsamplen identiek aan de print.
	const dotDiff = (a, b, s) => { let n = 0; for (let y = 0; y < a.H; y++) for (let x = 0; x < a.W; x++) { const v = a.p[(y * a.W + x) * 4]; for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) if (b.p[((y * s + j) * b.W + x * s + i) * 4] !== v) { n++; j = i = s; } } return n; };
	const blocky = (r, s, box) => { let n = 0; for (let y = box[1]; y < box[3]; y++) for (let x = box[0]; x < box[2]; x++) { const v = r.p[(y * s * r.W + x * s) * 4]; for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) if (r.p[((y * s + j) * r.W + x * s + i) * 4] !== v) { n++; j = i = s; } } return n; };
	const emptyQr = [{ ...E, type: 'qr', data: '', symbology: 'qrcode', ecc: 'M' }], emptyImg = [{ ...E, type: 'image', src: '' }];
	chk(!stats(at(emptyQr)).n && !stats(at(emptyImg)).n && stats(at(emptyQr, 1, { placeholders: true })).n > 20 && stats(at(emptyImg, 1, { placeholders: true })).n > 20, 'placeholders: standaard niets, alleen met placeholders:true een melding');
	if (typeof bwipjs !== 'undefined') chk(renderDoc(cv, { label: { w: 40, h: 30 }, elements: emptyQr }, {}, {}).issues.length === 1, 'lege code wordt gemeld (print weigert)');
	const gc = mk(48, 36), gx = gc.getContext('2d'), gr = gx.createLinearGradient(0, 0, 48, 0);
	gr.addColorStop(0, '#000'); gr.addColorStop(1, '#fff'); gx.fillStyle = gr; gx.fillRect(0, 0, 48, 36); gx.fillStyle = '#c00'; gx.beginPath(); gx.arc(24, 18, 10, 0, 2 * PI); gx.fill();
	const src = gc.toDataURL(), IM = { ...E, type: 'image', src, fit: 'contain', mode: 'floyd', threshold: 128, brightness: 0, contrast: 0, gamma: 1, sharpen: 0, bgCut: 0, invertImg: false, flipH: false, flipV: false };
	pic(src); await until(() => pic(src).ok);
	const RAST = [
		{ ...IM, id: 'im', x: 21, y: 1, w: 18, h: 13, rot: 17 },
		{ ...E, id: 'op', x: 22, y: 15, w: 16, h: 13, opacity: .5, type: 'shape', shape: 'ellipse', stroke: .5, fill: 'black', radius: 0, dash: 'solid' },
		{ ...E, id: 'ce', x: 1, y: 19, w: 10, h: 10, rot: 33, type: 'emoji', char: '\u{1F344}', style: 'color', mode: 'atkinson', threshold: 128, brightness: 10, contrast: 20 },
	];
	if (typeof bwipjs !== 'undefined') RAST.push({ ...E, id: 'q', x: 1, y: 1, w: 17, h: 17, type: 'qr', data: 'https://example.com/scherp', symbology: 'qrcode', ecc: 'M' },
		{ ...E, id: 'dm', x: 11, y: 19, w: 10, h: 10, rot: 90, invert: true, type: 'qr', data: 'Hallo', symbology: 'datamatrix' });
	const r1 = at(RAST), r4 = at(RAST, 4), n1 = stats(r1).n;
	chk(n1 > 500 && r4.W === r1.W * 4 && !dotDiff(r1, r4, 4), `scale 4: codes/afbeelding/kleur-emoji/dekking dot-identiek aan de print (${n1} dots, ${RAST.length} elementen)`);
	chk(r4.dW === r1.W, 'labelmaat blijft in dots, onafhankelijk van scale');
	// Schuine foto/kleur-emoji: al gerasterd, dus niet glad draaien (grijs 192 werd 25 -> 17 % zwart, kleur-emoji -13 %).
	const gsrc = (() => { const c = mk(40, 40), x = c.getContext('2d'); x.fillStyle = 'rgb(192,192,192)'; x.fillRect(0, 0, 40, 40); return c.toDataURL(); })();
	pic(gsrc); await until(() => pic(gsrc).ok);
	const GI = { ...IM, id: 'gi', src: gsrc, x: 10, y: 5, w: 20, h: 20 }, tilt = (el, r) => stats(at([{ ...el, rot: r }])).n;
	const tq = [GI, { ...GI, mode: 'bayer4' }, { ...GI, invert: true }, { ...RAST[2], x: 15, y: 10 }].map(el => tilt(el, 17) / tilt(el, 0));
	chk(tq.every(q => Math.abs(q - 1) < .05), `schuine foto (ook omgekeerd)/kleur-emoji houdt zijn toon (zwart ${tq.map(q => (q * 100).toFixed(0)).join(' / ')}% van recht)`);
	const ce = stats(at([{ ...RAST[2], rot: 0 }]), [8, 152, 88, 232]);
	chk(ce.n > 40 && !ce.out && !ce.bad, `kleur-emoji gedithered binnen de box (${ce.n} dots)`);
	const big = [{ ...T, x: 2, y: 2, w: 36, h: 26, text: 'Ag', fit: 'fill', align: 'center', valign: 'middle' }], b1 = at(big), b4 = at(big, 4), s4 = stats(b4);
	chk(!s4.bad && blocky(b4, 4, [16, 16, 304, 224]) > 100 && Math.abs(s4.n / 16 - stats(b1).n) < stats(b1).n * .05, 'tekst vectorieel scherp op scale 4, mono-drempel op hoge resolutie');
	// ---- golf 2-fixes ----
	const wk = fitLayout(cv.getContext('2d'), { ...T, fit: 'fill', text: 'Wietkoekjes' }, 'Wietkoekjes', 360, 216);
	chk(wk.lines.length === 1 && !wk.brk, `fit fill breekt geen woord op tekens (${wk.lines.map(l => l.t).join('/')})`);
	const sk = fitLayout(cv.getContext('2d'), { ...T, fit: 'shrink', size: 12, text: 'Brownie' }, 'Brownie', 176, 176);
	chk(sk.lines.length === 1 && sk.px < 96, `fit shrink krimpt i.p.v. 'Brow/nie' (${sk.lines.map(l => l.t).join('/')})`);
	// Print-waarheid: het voorbeeld heeft dezelfde losse stukken als de print (gaten in dunne lijnen/contouren zichtbaar),
	// en gewone tekst blijft glad (geen printdot-trap: de hoge resolutie wordt daar niet aangepast).
	const vdict = (els, s) => {
		const a = at(els), b = at(els, s), V = new Uint8Array(a.W * a.H), P = new Uint8Array(a.W * a.H);
		for (let y = 0; y < a.H; y++) for (let x = 0; x < a.W; x++) {
			let n = 0, k = 0;
			for (let Y = Math.ceil(y * s - .5); Y < Math.ceil((y + 1) * s - .5) && Y < b.H; Y++) for (let X = Math.ceil(x * s - .5); X < Math.ceil((x + 1) * s - .5) && X < b.W; X++) { n++; k += !b.p[(Y * b.W + X) * 4]; }
			V[y * a.W + x] = k * 2 >= n ? 1 : 0; P[y * a.W + x] = a.p[(y * a.W + x) * 4] ? 0 : 1;
		}
		return { V, P, W: a.W, H: a.H };
	};
	const parts = (g, W, H) => {
		const id = new Int32Array(W * H), st = [];
		let n = 0;
		for (let d0 = 0; d0 < W * H; d0++) {
			if (!g[d0] || id[d0]) continue;
			id[d0] = ++n; st.push(d0);
			while (st.length) { const d = st.pop(), x = d % W, y = (d - x) / W; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const xx = x + i, yy = y + j, e = yy * W + xx; if (xx >= 0 && yy >= 0 && xx < W && yy < H && g[e] && !id[e]) { id[e] = n; st.push(e); } } }
		}
		return n;
	};
	const ring = vdict([{ ...E, x: 10, y: 7, w: 20, h: 15, type: 'shape', shape: 'ellipse', stroke: .1, fill: 'none', radius: 0, dash: 'solid' }], 3.008);
	const sale = vdict([{ ...T, x: 2, y: 2, w: 36, h: 26, text: 'SALE', outline: .1, fit: 'fill' }], 2.26);
	const nr = [parts(ring.P, ring.W, ring.H), parts(ring.V, ring.W, ring.H)], ns = [parts(sale.P, sale.W, sale.H), parts(sale.V, sale.W, sale.H)];
	chk(nr[0] > 1 && nr[0] === nr[1] && ns[0] === ns[1], `scherp voorbeeld = printwaarheid: dunne lijn/contour breekt zoals op de print (${nr.join('=')}, ${ns.join('=')} stukken)`);
	truthCv = null; renderDoc(cv4, { label: { w: 40, h: 30 }, elements: [] }, {}, { scale: 2, fast: true });
	const tf = truthCv; renderDoc(cv4, { label: { w: 40, h: 30 }, elements: [] }, {}, { scale: 2 });
	chk(!tf && !!truthCv, 'snelle render: geen printwaarheid (dubbel tekenen), de scherpe wel');
	const opRot = q => stats(at([{ ...E, x: 10, y: 5, w: 20, h: 20, rot: 17, opacity: q, type: 'shape', shape: 'rect', stroke: 0, fill: 'black', radius: 0 }])).n
		/ stats(at([{ ...E, x: 10, y: 5, w: 20, h: 20, rot: 17, type: 'shape', shape: 'rect', stroke: 0, fill: 'black', radius: 0 }])).n;
	const o25 = opRot(.25), o75 = opRot(.75);
	chk(Math.abs(o25 - .25) < .03 && Math.abs(o75 - .75) < .03, `dekking op een schuin element klopt (${(o25 * 100).toFixed(1)}% / ${(o75 * 100).toFixed(1)}%)`);
	if (typeof bwipjs !== 'undefined') {
		const iss = renderDoc(cv, { label: { w: 40, h: 30 }, elements: [{ ...E, id: 'bc', type: 'barcode', data: '12345', symbology: 'ean13', showText: true, textSize: 2.5 }] }, {}, {}).issues;
		chk(iss.length === 1 && iss[0].id === 'bc' && /ongeldig/.test(iss[0].msg), 'ongeldige code wordt gemeld (print weigert)');
		const wide = d => renderDoc(cv, { label: { w: 40, h: 30 }, elements: [{ ...E, id: 'w', x: 1.5, y: 9, w: 37, h: 12, type: 'barcode', data: d, symbology: 'code128', showText: true, textSize: 2.5 }] }, {}, {}).issues;
		chk(wide('MARKETING-AFDELING-LAPTOP-001').some(i => i.id === 'w' && /past niet/.test(i.msg)) && !wide('IT-01').length, 'code breder dan zijn box wordt gemeld (print weigert), passende code niet');
	}
	const gfo = 'Press Start 2P';
	if (!fontReady(gfo, false, false) && !fontFailed(gfo, false, false)) {
		const fi = renderDoc(cv, { label: { w: 40, h: 30 }, elements: [{ ...T, id: 'gf', font: gfo, text: 'Hallo' }] }, {}, {}).issues;
		chk(fi.some(i => i.id === 'gf' && /lettertype/.test(i.msg)), 'Google-font nog niet geladen: gemeld (print weigert i.p.v. Arial)');
	}
	const icoSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 20 10"><rect width="20" height="10" fill="#000"/></svg>';
	const ico = [{ ...E, x: 10, y: 5, w: 20, h: 20, type: 'icon', source: 'iconify', svg: icoSvg, icon: 'test:rect', set: 'outline', nodes: [], stroke: 2 }];
	await until(() => stats(at(ico)).n > 0);
	const i1 = stats(at(ico));
	chk(Math.abs(i1.bw - 160) <= 1 && Math.abs(i1.bh - 80) <= 1 && i1.n > 12000, `iconify: contain + gecentreerd (${i1.bw}x${i1.bh})`);
	const ib = []; for (const y of [79, 80, 159, 160]) ib.push(at(ico).p[(y * 320 + 160) * 4]);
	chk(ib.join() === '255,0,0,255', 'iconify: verticaal gecentreerd (rijen 80..159)');
	// Printcheck is synchroon: een nieuw icoon (laadt nog) of een icoonnaam zonder svg moet gemeld worden, niet stil ontbreken.
	const icoIss = el => renderDoc(cv, { label: { w: 40, h: 30 }, elements: [el] }, {}, {}).issues.length;
	const fresh = { ...ico[0], id: 'fr', svg: icoSvg.replace('<rect', `<rect id="f${svgSeq}"`) }, n0 = icoIss(fresh);
	const icoPend = el => renderDoc(cv, { label: { w: 40, h: 30 }, elements: [el] }, {}, {}).pending, p0 = icoPend(fresh);
	await until(() => !icoIss(fresh));
	chk(n0 === 1 && !icoIss(fresh) && icoIss({ ...ico[0], svg: '' }) === 1, `icoon nog niet geladen / zonder svg: gemeld (${n0}), na laden niet meer`);
	chk(p0 === true && icoPend(fresh) === false && icoPend({ ...E, type: 'shape' }) === false, 'pending: icoon laadt nog = true, na laden en zonder beeld false');
	// Dekking < 1 op scale > 1 tekent via een kopie van env (drawDots): pending moet terugkomen, anders blijft 'Laden...' staan.
	const half = { ...ico[0], id: 'hf', opacity: .5, svg: icoSvg.replace('<rect', `<rect id="h${svgSeq}"`) };
	chk(renderDoc(cv4, { label: { w: 40, h: 30 }, elements: [half] }, {}, { scale: 2 }).pending === true, 'pending: nieuw icoon met dekking 50% op scale 2 = true');
	at(ico, 4); await until(() => stats(at(ico, 4)).bw > 600);
	const i4 = stats(at(ico, 4));
	chk(Math.abs(i4.bw - 640) <= 2 && Math.abs(i4.bh - 320) <= 2, `iconify op scale 4 scherp gerasterd (${i4.bw}x${i4.bh})`);
	// Twee kopieën van hetzelfde icoon in andere maten: snel/scherp afwisselen mag na het laden geen nieuwe rasters vragen.
	const two = [{ ...ico[0], id: 'i8', x: 2, y: 2, w: 8, h: 8 }, { ...ico[0], id: 'i12', x: 14, y: 2, w: 12, h: 12 }];
	const both = () => { renderDoc(cv4, { label: { w: 40, h: 30 }, elements: two }, {}, { scale: 1.5, fast: true }); renderDoc(cv4, { label: { w: 40, h: 30 }, elements: two }, {}, { scale: 3 }); };
	both(); await until(() => [...rasters.values()].every(r => r.ok)); both();
	const nR = rasters.size; for (let i = 0; i < 4; i++) both();
	chk(rasters.size === nR && [...rasters.values()].every(r => r.ok), `icoon-rasters stabiel bij snel/scherp (${nR}), geen laadlus`);
	// Kapotte svg: na het laden 'onleesbaar' gemeld, niet eeuwig pending en 'Laden...' (na de rastertest: blijft nooit ok).
	const broken = { ...ico[0], id: 'kp', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24"</svg>' };
	const brk = () => renderDoc(cv, { label: { w: 40, h: 30 }, elements: [broken] }, {}, {});
	await until(() => brk().issues[0]?.msg === 'icoon onleesbaar');
	const bk = brk();
	chk(bk.issues.length === 1 && bk.issues[0].msg === 'icoon onleesbaar' && bk.pending === false, `kapotte svg: onleesbaar gemeld, niet pending (${bk.issues.map(i => i.msg).join()}, ${bk.pending})`);
	const tab = [{ ...E, x: 5, y: 5, w: 30, h: 20, type: 'icon', source: 'tabler', set: 'filled', nodes: [['circle', { cx: '12', cy: '12', r: '10' }]], stroke: 2 }];
	await until(() => stats(at(tab)).n > 0);
	const t1 = stats(at(tab), [80, 40, 240, 200]);
	chk(t1.n > 8000 && !t1.out && Math.abs(t1.bw - t1.bh) <= 2, `tabler-icoon contain + gecentreerd (${t1.bw}x${t1.bh})`);
	const mo = [{ ...E, x: 13, y: 8, w: 14, h: 14, type: 'emoji', char: '\u{1F33F}', style: 'mono', weight: 500 }];
	at(mo);
	if (await until(() => asked.has(mo[0].char + '\u0001') || fontReady(EMOJI_FONT, false, false, mo[0].char), 6000) && fontReady(EMOJI_FONT, false, false, mo[0].char)) {
		const m1 = stats(at(mo), [103, 63, 217, 177]), m4 = at(mo, 4);
		chk(m1.n > 300 && !m1.out && (m1.bw >= 106 || m1.bh >= 106), `mono-emoji (Noto Emoji) vult de box via het glyph (${m1.bw}x${m1.bh})`);
		chk(blocky(m4, 4, [104, 64, 216, 176]) > 50, 'mono-emoji vectorieel op scale 4');
		const fe = [{ ...mo[0], char: '⚖️' }];   // ⚖️ met presentatiekiezer: moet Noto (zwart) zijn, niet de kleur-glyph
		at(fe); await until(() => fontReady(EMOJI_FONT, false, false, '⚖') || asked.has('⚖\u0001'), 6000);
		const fn = stats(at(fe)).n;
		chk(fn > 300, `mono-emoji met U+FE0F tekent zwart (${fn} dots)`);
	} else details.push('Noto Emoji niet geladen (offline?): mono-emoji-tekentest overgeslagen');
	chk(!stats(at(mo.map(e => ({ ...e, char: '' })))).n && stats(at(mo.map(e => ({ ...e, char: '' })), 1, { placeholders: true })).n > 0, 'lege emoji: alleen melding met placeholders');
	if (typeof bwipjs !== 'undefined') {
		const bad = { type: 'barcode', symbology: 'ean13', showText: true, textSize: 2.5 };
		code(bad, 'xyz', 200, 80);
		const k = ['ean13', 'xyz', 200, 80, 'true:2.5'].join('\u0001');
		chk(code(bad, 'xyz', 200, 80) === null && typeof codes.get(k) === 'number', 'mislukte code alleen tijdelijk onthouden');
	}
	chk(renderThumb({ label: { w: 40, h: 30, shape: 'round' }, elements: [] }, 160).width === 160, 'thumb max 160 px');
	// ---- golf 3: invulvelden (regels + tokens) en de foto-pijplijn ----
	const F = (v, on = true) => [{ key: 'type', label: 'Soort', type: 'choice', options: ['Indica', 'Hybride', 'Sativa'], value: v }, { key: 'bio', label: 'Bio', type: 'toggle', value: on }, { key: 'strain', label: 'Naam', type: 'text', value: 'HAZE' }];
	const RB = { ...E, id: 'rb', x: 5, y: 5, w: 10, h: 10, type: 'shape', shape: 'rect', stroke: 0, fill: 'none', radius: 0, rules: [{ field: 'type', equals: 'sativa', set: { invert: true } }] };
	const HB = { ...E, id: 'hb', x: 20, y: 5, w: 10, h: 10, type: 'shape', shape: 'rect', stroke: 0, fill: 'black', radius: 0, rules: [{ field: 'bio', equals: false, set: { hidden: true } }] };
	const fd = (v, on, ctx) => { const r = renderDoc(cv, { label: { w: 40, h: 30 }, fields: F(v, on), elements: [RB, HB] }, ctx || {}); return stats({ ...r, p: cv.getContext('2d').getImageData(0, 0, r.W, r.H).data }).n; };
	chk(fd('Sativa', true) === 2 * 6400 && fd('Indica', true) === 6400 && fd('Indica', false) === 0, `regels: keuze zet invert, toggle verbergt (${fd('Sativa', true)}/${fd('Indica', true)}/${fd('Indica', false)} dots)`);
	chk(fd('Indica', true, { fields: F('Sativa', true) }) === 2 * 6400 && fd('Sativa', true, { row: { type: 'Indica' } }) === 6400, 'regels: ctx.fields gaat voor doc.fields, CSV-kolom gaat voor het veld');
	chk(RB.invert === false && !('hidden' in RB && RB.hidden), 'regels muteren het element niet');
	const TX = { ...T, x: 2, y: 2, w: 36, h: 10, fit: 'shrink', size: 6 }, tk = renderDoc(cv, { label: { w: 40, h: 30 }, fields: F('Indica'), elements: [{ ...TX, text: '{strain}' }] }, {}), tl = renderDoc(cv4, { label: { w: 40, h: 30 }, elements: [{ ...TX, text: 'HAZE' }] }, {});
	chk(cv.getContext('2d').getImageData(0, 0, tk.W, tk.H).data.join() === cv4.getContext('2d').getImageData(0, 0, tl.W, tl.H).data.join(), 'tekst {strain} = veldwaarde');
	const HQI = [{ ...IM, id: 'hq', x: 2, y: 2, w: 36, h: 26, mode: 'auto', auto: true, localContrast: 40, dotGain: 30, bleed: 85 }, { ...IM, id: 'bn', x: 21, y: 15, w: 17, h: 13, rot: 90, mode: 'bluenoise' }];
	const h1 = at(HQI), h4 = at(HQI, 4), hs = stats(h1, [16, 16, 304, 224]);
	chk(hs.n > 1000 && !hs.bad && !dotDiff(h1, h4, 4), `foto auto/bluenoise: puur zwart-wit, dot-identiek op scale 4 (${hs.n} dots)`);
	const pp = pic(src), legacyOut = [...pp.out.keys()].filter(k => k.split('|').includes('floyd')).length;
	chk(legacyOut > 0 && pp.rs.size > 0, 'oude mode via de browserschaling, nieuwe via de eigen verkleining (beide gecachet)');
	// Uit de cache gevallen foto laadt opnieuw: een data-URL is dan meteen 'complete' maar nog niet geladen, niet onleesbaar.
	pics.delete(src);
	const reIss = renderDoc(cv, { label: { w: 40, h: 30 }, elements: [IM] }, {}, {}).issues, reTh = renderThumb({ label: { w: 40, h: 30 }, elements: [IM] }).pending;
	await until(() => pic(src).ok);
	chk(reIss.length === 1 && reIss[0].msg === 'afbeelding nog niet geladen', `foto laadt opnieuw: nog niet geladen, niet onleesbaar (${reIss.map(i => i.msg).join()})`);
	chk(reTh === true && renderThumb({ label: { w: 40, h: 30 }, elements: [IM] }).pending === false, 'thumb.pending alleen zolang de foto laadt');
	// ---- golf 4b: lege foto-plek, getekende maat, zichtbare inhoud ----
	const slot = { ...IM, id: 'slot', src: '', x: 10, y: 5, w: 20, h: 20 }, slotDoc = { label: { w: 40, h: 30 }, elements: [slot] };
	const sIss = renderDoc(cv, slotDoc, {}, {}).issues, th = renderThumb(slotDoc, 160), tp = th.getContext('2d').getImageData(0, 0, th.width, th.height).data;
	let thInk = 0; for (let i = 0; i < tp.length; i += 4) thInk += tp[i] < 128;
	chk(sIss.length === 1 && sIss[0].id === 'slot' && sIss[0].msg === 'Foto ontbreekt' && thInk > 100 && !renderDoc(cv, { ...slotDoc, elements: [{ ...slot, hidden: true }] }, {}, {}).issues.length,
		`lege foto-plek: print weigert ('Foto ontbreekt'), thumb toont de plek (${thInk} px), verborgen plek telt niet`);
	const ink = r => { const s = stats(r); let x0 = r.W, y0 = r.H, x1 = -1, y1 = -1; for (let y = 0; y < r.H; y++) for (let x = 0; x < r.W; x++) if (!r.p[(y * r.W + x) * 4]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { ...s, x0, y0, x1: x1 + 1, y1: y1 + 1 }; };
	const nearCb = (cb, k, tol, tx = tol, ty = tol) => cb && Math.abs(cb.x * DPM - k.x0) <= tx && Math.abs(cb.y * DPM - k.y0) <= ty && Math.abs((cb.x + cb.w) * DPM - k.x1) <= tx && Math.abs((cb.y + cb.h) * DPM - k.y1) <= ty;
	// Tekst: dwars op de regels exact de inkt, langs de regels minstens de inkt met het midden erop (q = 1: 90 graden gedraaid).
	const onInk = (cb, k, tol, q = 0) => { if (!cb) return false; const b = [cb.x, cb.y, cb.x + cb.w, cb.y + cb.h].map(v => v * DPM), K = [k.x0, k.y0, k.x1, k.y1], v = 1 - q;
		return Math.abs(b[q] + b[q + 2] - K[q] - K[q + 2]) / 2 <= tol && b[q + 2] - b[q] >= K[q + 2] - K[q] - tol && Math.abs(b[v] - K[v]) <= tol && Math.abs(b[v + 2] - K[v + 2]) <= tol; };
	const fmt = (cb, k) => `${cb ? [cb.x, cb.y, cb.x + cb.w, cb.y + cb.h].map(v => (v * DPM).toFixed(1)).join(',') : 'null'} ~ ${[k.x0, k.y0, k.x1, k.y1].join(',')}`;
	// Tekst die uit zijn vak loopt (Passen geen): dekking 90% en Omkeren tekenen hem net zo ver als 100% (vlak was box + 1,5x letter).
	const OV = { ...T, id: 'ov', x: 2, y: 2, w: 36, h: 5, size: 3, fit: 'none', text: 'Bewaar koel en droog, buiten bereik van kinderen. Niet voor personen onder de 18 jaar.' };
	const ovr = [[OV, 'y1'], [{ ...OV, y: 20, w: 10, wrap: false }, 'x1']].map(([el, k]) => [{}, { opacity: .9 }, { invert: true }].map(q => ink(run([{ ...el, ...q }]))[k]));
	chk(ovr.every(v => v.every(x => Math.abs(x - v[0]) <= 2)) && ovr[0][0] > 100 && ovr[1][0] > 200 && !dotDiff(at([{ ...OV, opacity: .9 }]), at([{ ...OV, opacity: .9 }], 4), 4),
		`tekst buiten zijn vak: ook bij dekking 90% / Omkeren, ook op scale 4 (onderkant ${ovr[0].join('/')}, rechts ${ovr[1].join('/')} dots)`);
	const FT = { ...T, id: 'ft', x: 3, y: 4, w: 34, h: 14, text: 'Groei', fit: 'fill', align: 'center', valign: 'middle', size: 4 };
	const fz = fitSize(FT, []), fixed = { ...FT, fit: 'none', size: fz };
	chk(Math.abs(fz * DPM - fitLayout(cv.getContext('2d'), FT, 'Groei', 272, 112).px) < 1e-9 && fz > 4 && fitSize({ ...FT, fit: 'none' }, []) === 4
		&& stats(run([FT])).n > 0 && run([FT]).p.join() === run([fixed]).p.join(), `fitSize = getekende maat (${fz.toFixed(3)} mm; vast op die maat = pixel-identiek)`);
	// Later geladen fontstuk (loadingdone, latin-ext Ł/ő): de gecachte tekstmaten gaan weg, anders centreert hij op de vervangmaat.
	if (typeof FontFaceSetLoadEvent === 'function') {
		const nl = lays.size;
		document.fonts.dispatchEvent(new FontFaceSetLoadEvent('loadingdone', { fontfaces: [new FontFace('Selftest', 'local(Arial)')] }));
		chk(nl > 0 && lays.size === 0, `tekstmaten-cache leeg na een geladen fontstuk (${nl} -> ${lays.size})`);
	}
	// 'Hello' (geen onderstokken) gecentreerd op contentBox: boven = onder en links = rechts op 0,25 mm (2 dots), ook groot
	// (Netjes maken: ~15 mm, daar is de zijruimte van de H 1 mm).
	for (const HE of [{ ...T, id: 'he', text: 'Hello', fit: 'none', size: 6, align: 'center', valign: 'middle', x: 2, y: 3, w: 36, h: 12 },
		{ ...T, id: 'hb', text: 'Hello', fit: 'none', size: 15, bold: true, align: 'center', valign: 'middle', x: 1, y: 2, w: 38, h: 20 }]) {
		const hc = contentBox(HE, []), he = ink(run([{ ...HE, x: HE.x + 20 - (hc.x + hc.w / 2), y: HE.y + 15 - (hc.y + hc.h / 2) }])), hw = [he.y0, 240 - he.y1, he.x0, 320 - he.x1];
		chk(Math.abs(hw[0] - hw[1]) <= 2 && Math.abs(hw[2] - hw[3]) <= 2 && onInk(hc, ink(run([HE])), 1.5),
			`contentBox 'Hello' ${HE.size} mm: optisch midden (wit boven/onder/links/rechts ${hw.join('/')} dots), midden op de inkt (${fmt(hc, ink(run([HE])))})`);
	}
	const SH = { ...T, id: 'sh', text: 'Hello', fit: 'none', size: 6, align: 'center', valign: 'middle', x: 2, y: 3, w: 36, h: 12 };
	chk(contentBox(SH, []).x !== contentBox({ ...SH, strike: true }, []).x, 'contentBox: doorhalen telt mee (niet de gecachte maat zonder)');
	const MT = { ...T, id: 'mt', text: 'Hgjp\nkort', fit: 'none', size: 4, align: 'right', valign: 'bottom', x: 4, y: 2, w: 30, h: 24, underline: true };
	chk(onInk(contentBox(MT, []), ink(run([MT])), 1.5), `contentBox tekst: 2 regels rechts/onder, onderstok + onderstreping (${fmt(contentBox(MT, []), ink(run([MT])))})`);
	const RT = { ...T, id: 'rt', text: 'Hello', fit: 'none', size: 6, align: 'center', valign: 'middle', rot: 90, x: 8, y: 9, w: 36, h: 12 };
	chk(onInk(contentBox(RT, []), ink(run([RT])), 2.5, 1), `contentBox gedraaid 90: omhullende (${fmt(contentBox(RT, []), ink(run([RT])))})`);
	// Font nog niet geladen: vervangende maten zouden in Netjes maken/Centreren blijven hangen, dus de box.
	const gw = 'Satisfy';
	if (!fontReady(gw, false, false) && !fontFailed(gw, false, false)) chk(contentBox({ ...RT, font: gw }, []) === null && !!contentBox(RT, []), 'contentBox: font nog niet geladen = null (de box)');
	const CI = { ...IM, id: 'ci', x: 2, y: 2, w: 36, h: 10, fit: 'contain', mode: 'threshold', threshold: 255 }, ci = contentBox(CI, []);
	chk(nearCb(ci, ink(run([CI])), 1) && contentBox({ ...CI, fit: 'cover' }, []) === null && contentBox({ ...CI, src: '' }, []) === null, `contentBox foto contain = beeldvlak, cover/leeg = box (${fmt(ci, ink(run([CI])))})`);
	chk(nearCb(contentBox(ico[0], []), ink(run(ico)), 1) && contentBox({ ...E, type: 'shape' }, []) === null, `contentBox icoon = getekend vlak (${fmt(contentBox(ico[0], []), ink(run(ico)))})`);
	// Icoon met lege marge in de viewBox: de inkt, niet het hele vlak.
	const ipad = [{ ...ico[0], id: 'ipad', svg: icoSvg.replace('<rect width="20" height="10"', '<rect x="2" y="2" width="16" height="4"') }];
	await until(() => stats(at(ipad)).n > 0);
	const pc = contentBox(ipad[0], []), pk = ink(run(ipad));
	chk(nearCb(pc, pk, 1) && pk.y1 - pk.y0 === 32, `contentBox icoon met lege svg-marge = inkt (${fmt(pc, pk)})`);
	// Nooit gemeten svg: na loadIcon is de eerste meting (deze maat laadt nog) al de inkt, niet de viewBox.
	const inew = { ...ipad[0], id: 'inew', svg: ipad[0].svg.replace('<rect', '<rect id="inew"') };
	await loadIcon(inew);
	const nc = contentBox(inew, []);
	chk(nearCb(nc, pk, 1), `loadIcon: eerste meting van een nieuw icoon = inkt (${fmt(nc, pk)})`);
	return { ok, details };
}
