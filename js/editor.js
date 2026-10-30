// Interactie bovenop de preview: selectie, slepen, resize/rotatie, snappen, zoom en sneltoetsen.
// Rekent intern in mm (doc-eenheid) op de elementwaarden; getBoxes() levert alleen hidden na de veldregels.
import { DPM, clamp, normDeg } from './util.js';
import { RATIO, printableArea, aabb, span as union } from './doc.js';

const RAD = Math.PI / 180, GRID = 0.5, MIN_MM = 0.5;
const HS = 10, HIT = 8, ROT_PX = 24, SNAP_PX = 6, DRAG_PX = 3, MIN_HIT = 8; // CSS-px
// ZMIN onder 50% (0,236 px/dot): de zoomknoppen springen naar 50..800%.
const ZMIN = 0.2, ZMAX = 32, FIT_MAX = 12, FIT_PAD = 64;
// Hoekhandle = verhouding vast voor alles wat render contain tekent (zelfde set als doc.js) plus tekst (schaalt de letter mee).
const RATIO_TYPES = new Set(['text', ...RATIO]);
const ratioLocked = el => RATIO_TYPES.has(el.type) && !(el.type === 'image' && el.fit && el.fit !== 'contain');   // vullend/rekken mag vervormen
const GUIDE = '#ec4899', MUTED = '#9ca3af', HATCH = 'rgba(107,114,128,.45)', HATCH_BG = 'rgba(107,114,128,.07)', HATCH_PX = 7;
const CURSORS = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'];
// Hoeken eerst: bij kleine boxen wint de hoek van de rand-handle.
const HANDLES = [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [1, 0], [0, 1], [-1, 0]];
const NUDGE = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] };

const q = v => Math.round(v * 100) / 100;
const fmt = v => String(Math.round(v * 10) / 10).replace('.', ',');
// Alleen echte tekstinvoer blokkeert de sneltoetsen; na een klik op een vinkje, schuif of keuzelijst werken ze gewoon.
// Datum/tijd tellen mee: Backspace in het datumveld van Invullen wiste anders het geselecteerde element.
const TEXT_IN = /^(text|search|number|email|url|tel|password|date|time|datetime-local|month|week)$/i;
export const typing = t => !!t && (t.isContentEditable || t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && TEXT_IN.test(t.type)));
// Pijltjes op een schuif/keuzelijst/vinkje doen wat die control zelf doet (waarde wijzigen), niet het element verschuiven.
const ownArrows = t => !!t && /^(INPUT|SELECT)$/.test(t.tagName);

// ---------- pure helpers (node-testbaar) ----------
function gestureFrame([a, b]) {
	return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) };
}

// Met de klok mee in schermcoordinaten (y omlaag), zoals ctx.rotate.
function rotatePoint(px, py, cx, cy, deg) {
	const a = deg * RAD, c = Math.cos(a), s = Math.sin(a), dx = px - cx, dy = py - cy;
	return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c };
}
// Punt terug naar het ongeroteerde frame van de box.
const toLocal = (px, py, b) => rotatePoint(px, py, b.x + b.w / 2, b.y + b.h / 2, -(b.rot || 0));
function hitBox(px, py, b, padX = 0, padY = padX) {
	const p = toLocal(px, py, b);
	return p.x >= b.x - padX && p.x <= b.x + b.w + padX && p.y >= b.y - padY && p.y <= b.y + b.h + padY;
}
const contains = (o, i) => i.x >= o.x && i.y >= o.y && i.x + i.w <= o.x + o.w && i.y + i.h <= o.y + o.h;
const snapGrid = (v, g) => Math.round(v / g) * g;
// Hoek (graden, met de klok mee, 0 = recht omhoog) van het punt gezien vanuit het midden.
const angleFrom = (cx, cy, px, py) => Math.atan2(px - cx, cy - py) / RAD;
// Dichtstbijzijnde doel binnen thr voor een van de ankerwaarden: { d: doel - anker, t: doel } of null.
function snapTo(vals, targets, thr) {
	let best = null;
	for (const v of vals) for (const t of targets) { const d = t - v; if (Math.abs(d) <= thr && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, t }; }
	return best;
}
// Verschuiving voor een te verplaatsen omhullende: randen/midden aan doelen, anders linker-/bovenrand op het raster.
function snapMove(bb, targets, thr, grid) {
	const sx = snapTo([bb.x, bb.x + bb.w / 2, bb.x + bb.w], targets.x, thr), sy = snapTo([bb.y, bb.y + bb.h / 2, bb.y + bb.h], targets.y, thr);
	return {
		dx: sx ? sx.d : grid ? snapGrid(bb.x, grid) - bb.x : 0, dy: sy ? sy.d : grid ? snapGrid(bb.y, grid) - bb.y : 0,
		gx: sx ? sx.t : null, gy: sy ? sy.t : null,
	};
}
// Delen van het label buiten de printkop (links bij 180° draaien, rechts zonder; X-verschuiving telt mee).
function nonPrintable(doc) {
	const L = doc.label, P = printableArea(doc), x = P.x + P.w, out = [];
	if (P.x > 1e-6) out.push({ x: 0, y: 0, w: P.x, h: L.h });
	if (x < L.w - 1e-6) out.push({ x, y: 0, w: L.w - x, h: L.h });
	return out;
}
// Snapdoelen in mm: labelranden/-midden, midden van het printbare vlak, en randen/midden van de overige zichtbare elementen.
function snapTargets(doc, exclude = [], off = el => el.hidden) {
	const L = doc.label, P = printableArea(doc), x = [0, L.w / 2, L.w, P.x + P.w / 2], y = [0, L.h / 2, L.h, P.y + P.h / 2];
	for (const el of doc.elements || []) {
		if (off(el) || exclude.includes(el.id)) continue;
		const a = aabb(el);
		x.push(a.x, a.x + a.w / 2, a.x + a.w); y.push(a.y, a.y + a.h / 2, a.y + a.h);
	}
	return { x, y };
}
// Schaal uit de CSS-rects (getBoundingClientRect), nooit uit view.width: het view-canvas rendert in het scherpe voorbeeld
// op een veelvoud van W×H dots. W = labelbreedte in dots.
function viewFrame(v, o, W) {
	const ppm = (W ? v.width / (W / DPM) : 0) || 1;
	return { v, o, ppm, x0: (o.left - v.left) / ppm, y0: (o.top - v.top) / ppm, x1: (o.right - v.left) / ppm, y1: (o.bottom - v.top) / ppm };
}
const toMM = (e, f) => ({ x: (e.clientX - f.v.left) / f.ppm, y: (e.clientY - f.v.top) / f.ppm });

// Resize van box b via handle (hx,hy ∈ -1|0|1) naar wereldpunt (px,py). De tegenoverliggende rand/hoek blijft staan,
// ook bij rotatie (rekenwerk in het lokale frame). snap = { x:[], y:[], thr, grid } of null (vrij).
function resizeBox(b, hx, hy, px, py, { ratio = false, snap = null } = {}) {
	const rot = b.rot || 0, cx = b.x + b.w / 2, cy = b.y + b.h / 2, l = rotatePoint(px, py, cx, cy, -rot);
	const ax = cx - hx * b.w / 2, ay = cy - hy * b.h / 2, straight = normDeg(rot) < 1e-6;
	let w = hx ? hx * (l.x - ax) : b.w, h = hy ? hy * (l.y - ay) : b.h, gx = null, gy = null;
	// Randen snappen alleen ongeroteerd (dan vallen lokale en wereldassen samen); geroteerd snapt alleen de maat op het raster.
	const sx = snap && straight && hx ? snapTo([ax + hx * w], snap.x, snap.thr) : null;
	const sy = snap && straight && hy ? snapTo([ay + hy * h], snap.y, snap.thr) : null;
	const gridW = v => !snap?.grid ? v : straight ? hx * (snapGrid(ax + hx * v, snap.grid) - ax) : snapGrid(v, snap.grid);
	const gridH = v => !snap?.grid ? v : straight ? hy * (snapGrid(ay + hy * v, snap.grid) - ay) : snapGrid(v, snap.grid);
	if (!ratio) {
		if (hx) { w = sx ? hx * (sx.t - ax) : gridW(w); gx = sx ? sx.t : null; }
		if (hy) { h = sy ? hy * (sy.t - ay) : gridH(h); gy = sy ? sy.t : null; }
		// Alleen de gesleepte as: een lijn van 0,3 mm verlengen maakte hem anders 0,5 mm dik.
		if (hx && w < MIN_MM) { w = MIN_MM; gx = null; }
		if (hy && h < MIN_MM) { h = MIN_MM; gy = null; }
	} else {
		let k;
		if (hx && hy) {
			if (sx && (!sy || Math.abs(sx.d) <= Math.abs(sy.d))) { k = hx * (sx.t - ax) / b.w; gx = sx.t; }
			else if (sy) { k = hy * (sy.t - ay) / b.h; gy = sy.t; }
			// Projectie op de diagonaal: voelt natuurlijk, ongeacht welke kant de muis op gaat.
			else k = gridW((w * b.w + h * b.h) / (b.w * b.w + b.h * b.h) * b.w) / b.w;
		} else if (hx) { k = (sx ? hx * (sx.t - ax) : gridW(w)) / b.w; gx = sx ? sx.t : null; }
		else { k = (sy ? hy * (sy.t - ay) : gridH(h)) / b.h; gy = sy ? sy.t : null; }
		// Al dunner dan min (lijn): niet kleiner, maar ook niet ineens dikker.
		const kMin = Math.min(1, MIN_MM / Math.min(b.w, b.h));
		if (!(k >= kMin)) { k = kMin; gx = gy = null; }
		w = b.w * k; h = b.h * k;
	}
	// Nieuw midden: anker + halve nieuwe maat; een as zonder handle blijft gecentreerd.
	const ox = hx ? ax - cx + hx * w / 2 : 0, oy = hy ? ay - cy + hy * h / 2 : 0, c = rotatePoint(cx + ox, cy + oy, cx, cy, rot);
	return { x: c.x - w / 2, y: c.y - h / 2, w, h, rot, gx, gy };
}

// Geometrie van wat een gebaar verplaatst/vervormt: gelijk aan de start = geen undo-stap.
const geo = list => list.map(x => [x.x, x.y, x.w, x.h, x.rot, x.size, x.letterSpacing, x.outline].join()).join(';');
// Verschuiving [dx, dy] waarbij minstens 1 mm van omhullende bb op het label blijft, anders is hij niet meer aan te klikken.
// Staat bb al buiten die band, dan alleen niet verder weg: anders sprong hij bij elk pijltje (soms de verkeerde kant op).
const keepOn = (bb, L, dx, dy) => [clamp(bb.x + dx, Math.min(bb.x, 0, 1 - bb.w), Math.max(bb.x, L.w - Math.min(1, bb.w))) - bb.x,
	clamp(bb.y + dy, Math.min(bb.y, 0, 1 - bb.h), Math.max(bb.y, L.h - Math.min(1, bb.h))) - bb.y];
// Zijhandles alleen waar ze niet over de hoeken vallen. Dun in één richting (lijn): alleen de eindhandles, anders
// verdikte een hoek/rand de lijn (raster, min-maat) en pakte de middelste handle de klik om te verplaatsen.
// keep (verhouding vast): de hoeken blijven, anders kon je dunne tekst op touch (geen Shift) alleen breder maken.
function handles(b, f, keep) {
	const big = HS * 3 / f.ppm, thinW = b.w < big, thinH = b.h < big;
	if (thinW !== thinH) return HANDLES.filter(([hx, hy]) => (keep && hx && hy) || (thinH ? !hy : !hx));
	return HANDLES.filter(([hx, hy]) => (hx && hy) || (hx ? b.h >= big : b.w >= big));
}
// Bovenste zichtbare element onder p (mm); dunne elementen krijgen minstens MIN_HIT CSS-px vangvlak.
function pickAt(list, p, ppm, off) {
	const tol = MIN_HIT / ppm;
	for (let i = list.length - 1; i >= 0; i--) {
		const el = list[i];
		if (off(el)) continue;
		if (!hitBox(p.x, p.y, el, Math.max(0, (tol - el.w) / 2), Math.max(0, (tol - el.h) / 2))) continue;
		// Een rand is een kader: alleen de rand zelf pakt de klik, binnenin blijft wat eronder ligt bereikbaar.
		if (el.type === 'border') {
			const l = toLocal(p.x, p.y, el), band = Math.max(2, 10 / ppm);
			if (l.x > el.x + band && l.x < el.x + el.w - band && l.y > el.y + band && l.y < el.y + el.h - band) continue;
		}
		return el;
	}
	return null;
}

export function selftest() {
	const details = [], near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
	let ok = true;
	const t = (name, cond) => { details.push(`${cond ? 'ok' : 'FAIL'} ${name}`); ok = ok && !!cond; };
	const box = (r, x, y, w, h) => near(r.x, x) && near(r.y, y) && near(r.w, w) && near(r.h, h);
	const p = rotatePoint(1, 0, 0, 0, 90);
	t('rotatePoint 90 met de klok mee', near(p.x, 0) && near(p.y, 1));
	const rb = { x: 0, y: 0, w: 10, h: 2, rot: 90 };
	t('hitBox geroteerd binnen', hitBox(5, 4, rb));
	t('hitBox geroteerd buiten', !hitBox(9, 1, rb));
	t('hitBox padding', hitBox(5, 2.5, { x: 0, y: 0, w: 10, h: 2 }, 0, 0.6) && !hitBox(5, 2.5, { x: 0, y: 0, w: 10, h: 2 }));
	t('aabb 90 graden', box(aabb(rb), 4, -4, 2, 10));
	t('union', box(union([{ x: 0, y: 0, w: 2, h: 2 }, { x: 5, y: 1, w: 1, h: 4 }]), 0, 0, 6, 5));
	t('contains', contains({ x: 0, y: 0, w: 10, h: 10 }, { x: 1, y: 1, w: 2, h: 2 }) && !contains({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 1, w: 2, h: 2 }));
	const T = { x: [0, 20, 40], y: [0, 15, 30] };
	let s = snapMove({ x: 0.3, y: 7, w: 10, h: 4 }, T, 0.5, 0.5);
	t('snap aan labelrand', near(s.dx, -0.3) && s.gx === 0);
	s = snapMove({ x: 3.2, y: 12.8, w: 10, h: 4 }, T, 0.5, 0.5);
	t('snap midden aan labelmidden', near(s.dy, 0.2) && s.gy === 15);
	t('anders raster 0,5 mm', near(s.dx, -0.2) && s.gx === null);
	t('zonder raster vrij', snapMove({ x: 3.2, y: 7, w: 1, h: 1 }, T, 0.1, 0).dx === 0);
	const b = { x: 0, y: 0, w: 10, h: 5, rot: 0 };
	t('resize vrij', box(resizeBox(b, 1, 1, 14, 12), 0, 0, 14, 12));
	t('resize nw verhouding vast, anker blijft', box(resizeBox(b, -1, -1, -10, -1, { ratio: true }), -8.4, -4.2, 18.4, 9.2));
	t('resize rand + verhouding = andere as gecentreerd', box(resizeBox(b, 1, 0, 20, 2.5, { ratio: true }), 0, -2.5, 20, 10));
	t('resize geroteerd: anker blijft staan', box(resizeBox({ x: 0, y: 0, w: 10, h: 4, rot: 90 }, 1, 0, 5, 9), -1, 1, 12, 4));
	let r = resizeBox(b, 1, 1, 19.8, 7.2, { snap: { x: [20], y: [], thr: 0.5, grid: 0.5 } });
	t('resize snapt rand + raster', box(r, 0, 0, 20, 7) && r.gx === 20 && r.gy === null);
	t('resize min-maat', box(resizeBox(b, 1, 1, -50, -50), 0, 0, MIN_MM, MIN_MM));
	t('resize verhouding min-maat', near(resizeBox(b, 1, 1, -50, -50, { ratio: true }).h, MIN_MM));
	const line = { x: 0, y: 0, w: 20, h: 0.3 };
	t('lijn verlengen: dikte blijft', near(resizeBox(line, 1, 0, 30, 0).h, 0.3) && near(resizeBox(line, 1, 0, 25, 0, { ratio: true }).w, 25));
	t('dunne lijn: alleen eindhandles', handles(line, { ppm: 20 }).join(';') === '1,0;-1,0' && handles({ w: 0.3, h: 20 }, { ppm: 20 }).join(';') === '0,-1;0,1'
		&& handles({ w: 20, h: 10 }, { ppm: 20 }).length === 8);
	t('dunne tekst: hoeken blijven, dunne lijn niet', handles(line, { ppm: 20 }, ratioLocked({ type: 'text' })).join(';') === '-1,-1;1,-1;1,1;-1,1;1,0;-1,0'
		&& handles(line, { ppm: 20 }, ratioLocked({ type: 'shape' })).join(';') === '1,0;-1,0');
	t('pijltjes: minstens 1 mm op het label', keepOn({ x: 38, y: 0, w: 4, h: 2 }, { w: 40, h: 30 }, 5, 0).join() === '1,0' && keepOn({ x: 0, y: 0, w: 4, h: 2 }, { w: 40, h: 30 }, -5, -5).join() === '-3,-1');
	t('pijltje tegen de rand (gedraaid): geen restje', keepOn(union([{ x: 39.33, y: 5, w: 10, h: 4, rot: 30 }]), { w: 40, h: 30 }, 0.5, 0).map(q).join() === '0,0');
	t('al buiten het label: geen sprong, alleen niet verder weg', keepOn({ x: 45, y: 0, w: 4, h: 4 }, { w: 40, h: 30 }, 0, -0.5)[0] === 0
		&& keepOn({ x: 45, y: 0, w: 4, h: 4 }, { w: 40, h: 30 }, 0.5, 0)[0] === 0 && keepOn({ x: 45, y: 0, w: 4, h: 4 }, { w: 40, h: 30 }, -0.5, 0)[0] === -0.5);
	t('angleFrom', near(angleFrom(0, 0, 1, 0), 90) && near(angleFrom(0, 0, 0, -1), 0) && near(normDeg(angleFrom(0, 0, -1, 0)), 270));
	const wide = { label: { w: 60, h: 30 }, elements: [{ id: 'a', x: 2, y: 3, w: 4, h: 5 }, { id: 'h', x: 50, y: 1, w: 2, h: 2, hidden: true }] };
	const np = nonPrintable(wide), npr = nonPrintable({ ...wide, print: { rotate180: true } });
	t('niet-printbaar rechts van 48 mm', np.length === 1 && box(np[0], 48, 0, 12, 30));
	t('180° draaien: niet-printbaar links', npr.length === 1 && box(npr[0], 0, 0, 12, 30));
	const under = { id: 'u', type: 'text', x: 10, y: 10, w: 20, h: 10 }, rand = { id: 'r', type: 'border', x: 0, y: 0, w: 40, h: 30 }, hid = el => !!el.hidden;
	t('klik binnen een rand = element eronder', pickAt([under, rand], { x: 20, y: 15 }, 8, hid) === under && pickAt([rand], { x: 20, y: 15 }, 8, hid) === null);
	t('klik op de rand = de rand', pickAt([under, rand], { x: 0.5, y: 15 }, 8, hid) === rand && pickAt([under, { ...rand, hidden: true }], { x: 0.5, y: 15 }, 8, hid) === null);
	t('label <= 48 mm: geen arcering', !nonPrintable({ label: { w: 40, h: 30 } }).length && !nonPrintable({ label: { w: 48, h: 30 } }).length);
	t('sneltoetsen alleen geblokkeerd bij tekstinvoer', !typing({ tagName: 'INPUT', type: 'checkbox' }) && !typing({ tagName: 'INPUT', type: 'range' }) && !typing({ tagName: 'SELECT' })
		&& typing({ tagName: 'INPUT', type: 'number' }) && typing({ tagName: 'TEXTAREA' }) && typing({ isContentEditable: true })
		&& typing({ tagName: 'INPUT', type: 'date' }) && typing({ tagName: 'INPUT', type: 'time' }));
	t('verhouding vast: emoji/icoon/qr/passende afbeelding, niet rekken', ['emoji', 'icon', 'qr', 'text'].every(type => ratioLocked({ type })) && ratioLocked({ type: 'image', fit: 'contain' })
		&& !ratioLocked({ type: 'image', fit: 'stretch' }) && !ratioLocked({ type: 'shape' }));
	const T2 = snapTargets(wide, []);
	t('snapdoel midden printbaar vlak', T2.x.includes(24) && T2.x.includes(30) && T2.y.includes(15));
	t('snapdoelen: element mee, verborgen niet', T2.x.includes(4) && T2.y.includes(8) && !T2.x.includes(51));
	t('snapdoelen: uitgesloten element niet', !snapTargets(wide, ['a']).x.includes(4));
	s = snapMove({ x: 14.2, y: 7, w: 20, h: 4 }, T2, 0.5, 0.5);
	t('verplaatsen snapt aan midden printbaar vlak', near(s.dx, -0.2) && s.gx === 24);
	// Scherp voorbeeld: CSS 960×720 bij W=320 dots (zoom 3), ongeacht de canvasbuffer (bv. 2880×2160).
	const vr = { left: 100, top: 50, width: 960, height: 720 }, f = viewFrame(vr, { ...vr, right: 1060, bottom: 770 }, 320);
	t('frame schaal uit CSS-rect (24 px/mm)', near(f.ppm, 24) && near(f.x1, 40) && near(f.y1, 30) && near(f.x0, 0));
	const m = toMM({ clientX: 580, clientY: 410 }, f);
	t('muis naar mm onafhankelijk van canvasresolutie', near(m.x, 20) && near(m.y, 15));
	const pinchTest = gestureFrame([{ x:10, y:20 }, { x:30, y:20 }]);
	t('twee vingers: midden en afstand, samenvallende vingers blijven eindig', pinchTest.x === 20 && pinchTest.y === 20 && pinchTest.d === 20
		&& gestureFrame([{ x:1, y:1 }, { x:1, y:1 }]).d === 1);
	return { ok, details };
}

// ---------- editor ----------
// Extra (niet gepind): onZoom(z) bij elke zoomwijziging; stage = scroll-/fit-container.
export function createEditor({ view, overlay, app, getBoxes, onEditText, onContextMenu, onZoom, stage: host }) {
	const ctx = overlay.getContext('2d');
	let zoom = 2, autoFit = true, W = 0, H = 0, g = null, hover = null, guides = [], last = null, raf = 0, nudge = null;
	overlay.style.touchAction = 'none';

	const touches = new Map();
	let pinch = null;
	const touchFrame = () => gestureFrame([...touches.values()]);
	function touchDown(e) {
		if (e.pointerType !== 'touch') return;
		touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
		if (touches.size >= 2) host.setPointerCapture(e.pointerId);
		if (touches.size < 2) return;
		// Een begonnen objectsleep terugzetten zodra het een zoomgebaar wordt.
		if (g?.kind === 'move') for (const [el, x, y] of g.start) Object.assign(el, { x, y });
		else if (g?.el) Object.assign(g.el, g.b0);
		g = null; guides = []; app.changed({ history: false });
		pinch = touchFrame(); autoFit = false;
		e.preventDefault(); e.stopPropagation();
	}
	function touchMove(e) {
		if (!touches.has(e.pointerId)) return;
		touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
		if (!pinch) return;
		e.preventDefault(); e.stopPropagation();
		if (touches.size < 2) return;
		const next = touchFrame();
		applyZoom(zoom * next.d / pinch.d, pinch.x, pinch.y);
		host.scrollLeft += pinch.x - next.x; host.scrollTop += pinch.y - next.y;
		pinch = next;
	}
	function touchUp(e) {
		touches.delete(e.pointerId);
		if (!pinch) return;
		e.preventDefault(); e.stopPropagation();
		if (!touches.size) pinch = null;
		else if (touches.size >= 2) pinch = touchFrame();
	}
	host.style.touchAction = 'none';
	host.addEventListener('pointerdown', touchDown, true);
	host.addEventListener('pointermove', touchMove, true);
	host.addEventListener('pointerup', touchUp, true);
	host.addEventListener('pointercancel', touchUp, true);

	const els = () => app.doc.elements;
	const byId = id => els().find(e => e.id === id);
	// Onzichtbaar zoals render het tekende (el.hidden na de veldregels); zonder render-box: el.hidden zelf.
	const off = el => { const b = getBoxes?.()?.get?.(el.id); return typeof b?.hidden === 'boolean' ? b.hidden : !!el.hidden; };

	const frame = () => viewFrame(view.getBoundingClientRect(), overlay.getBoundingClientRect(), W);
	const targets = exclude => snapTargets(app.doc, exclude, off);
	const pick = (p, f) => pickAt(els(), p, f.ppm, off);

	// Lokale y (t.o.v. het midden) van de rotatie-handle: boven, anders onder, anders binnenin (overlay = labelvlak).
	function rotLocal(b, f) {
		const off = ROT_PX / f.ppm, m = HS / f.ppm, cx = b.x + b.w / 2, cy = b.y + b.h / 2;
		for (const ly of [-(b.h / 2 + off), b.h / 2 + off]) {
			const p = rotatePoint(cx, cy + ly, cx, cy, b.rot || 0);
			if (p.x >= f.x0 + m && p.x <= f.x1 - m && p.y >= f.y0 + m && p.y <= f.y1 - m) return ly;
		}
		return -(b.h / 2) + off;
	}
	function handleAt(p, f) {
		const s = app.selected(), el = s.length === 1 && !s[0].locked && !off(s[0]) ? s[0] : null;
		if (!el) return null;
		const b = el, l = toLocal(p.x, p.y, b), r = HIT / f.ppm, cx = b.x + b.w / 2, cy = b.y + b.h / 2;
		if (Math.hypot(l.x - cx, l.y - cy - rotLocal(b, f)) <= r) return { el, kind: 'rotate' };
		for (const [hx, hy] of handles(b, f, ratioLocked(el))) if (Math.abs(l.x - cx - hx * b.w / 2) <= r && Math.abs(l.y - cy - hy * b.h / 2) <= r) return { el, kind: 'resize', hx, hy };
		return null;
	}
	const resizeCursor = (hx, hy, rot) => CURSORS[((Math.round((Math.atan2(hy, hx) / RAD + rot) / 45) % 4) + 4) % 4];

	function hoverAt(e) {
		const f = frame(), p = toMM(e, f), h = handleAt(p, f), el = h ? null : pick(p, f), id = el?.id ?? null;
		overlay.style.cursor = h ? (h.kind === 'rotate' ? 'grab' : resizeCursor(h.hx, h.hy, h.el.rot || 0)) : el && !el.locked ? 'move' : 'default';
		if (id !== hover) { hover = id; redraw(); }
	}

	// Alleen de primaire pointer: een tweede vinger op touch is ook button 0 en verschoof anders het verkeerde element.
	function onDown(e) {
		if (e.button !== 0 || !e.isPrimary) return;
		endNudge();
		const f = frame(), p = toMM(e, f), add = e.shiftKey || e.ctrlKey || e.metaKey, h = handleAt(p, f);
		overlay.setPointerCapture(e.pointerId);
		last = e;
		if (h) {
			const el = h.el;
			g = { ...h, p0: p, moved: false, b0: { ...el }, t0: { size: el.size, letterSpacing: el.letterSpacing || 0, outline: el.outline || 0 }, t: targets([el.id]), mv: [el], k0: geo([el]) };
			if (h.kind === 'rotate') overlay.style.cursor = 'grabbing';
			return;
		}
		const el = pick(p, f), sel = app.selection;
		if (!el) {
			if (!add && sel.length) app.select([]);
			g = { kind: 'marquee', p0: p, p1: p, moved: false, base: add ? [...sel] : [] };
			return;
		}
		let ids = sel.includes(el.id) ? sel : [el.id];
		if (add) ids = sel.includes(el.id) ? sel.filter(id => id !== el.id) : [...sel, el.id];
		if (ids !== sel) app.select(ids);
		if (!ids.includes(el.id)) return;
		const mv = ids.map(byId).filter(x => x && !x.locked);
		// Klik zonder slepen op een al geselecteerd element in een groep = alleen dat element selecteren (bij loslaten).
		g = { kind: 'move', p0: p, moved: false, click: !add && sel.length > 1 && sel.includes(el.id) ? el.id : null,
			start: mv.map(x => [x, x.x, x.y]), bb0: union(mv), t: targets(mv.map(x => x.id)), mv, k0: geo(mv) };
	}

	function step(shift, alt) {
		const f = frame(), p = toMM(last, f), dx = p.x - g.p0.x, dy = p.y - g.p0.y;
		if (!g.moved) {
			if (Math.hypot(dx, dy) * f.ppm < DRAG_PX) return;
			g.moved = true;
			// Slepen vanaf een vergrendeld element (niets verplaatsbaar) wordt een selectiekader.
			if (g.kind === 'move' && !g.start.length) Object.assign(g, { kind: 'marquee', base: [] });
		}
		const thr = SNAP_PX / f.ppm, sn = !alt && g.t ? { ...g.t, thr, grid: GRID } : null;
		guides = [];
		if (g.kind === 'marquee') {
			g.p1 = p;
			const r = { x: Math.min(g.p0.x, p.x), y: Math.min(g.p0.y, p.y), w: Math.abs(dx), h: Math.abs(dy) }, ids = [...g.base];
			for (const el of els()) if (!off(el) && !ids.includes(el.id) && contains(r, aabb(el))) ids.push(el.id);
			if (ids.join() !== app.selection.join()) app.select(ids);
			redraw();
			return;
		}
		const el = g.el, k0 = geo(g.mv);
		if (g.kind === 'move') {
			const lockY = shift && Math.abs(dx) >= Math.abs(dy), lockX = shift && !lockY, b = g.bb0, L = app.doc.label;
			let mx = lockX ? 0 : dx, my = lockY ? 0 : dy;
			if (sn) {
				const s = snapMove({ ...b, x: b.x + mx, y: b.y + my }, sn, thr, GRID);
				if (!lockX) { mx += s.dx; if (s.gx != null) guides.push(['x', s.gx]); }
				if (!lockY) { my += s.dy; if (s.gy != null) guides.push(['y', s.gy]); }
			}
			[mx, my] = keepOn(b, L, mx, my);
			for (const [x, x0, y0] of g.start) { x.x = q(x0 + mx); x.y = q(y0 + my); }
		} else if (g.kind === 'resize') {
			const ratio = shift || (!!(g.hx && g.hy) && ratioLocked(el)), r = resizeBox(g.b0, g.hx, g.hy, p.x, p.y, { ratio, snap: sn });
			el.x = q(r.x); el.y = q(r.y); el.w = q(r.w); el.h = q(r.h);
			// Tekst schaalt mee bij proportioneel slepen (zoals in label-apps); een randhandle verandert alleen de box (herwrap).
			// k = 1: de startwaarden ongewijzigd terug, afronden maakte van 0,425 stil 0,43 (lege undo-stap).
			if (el.type === 'text') {
				const k = ratio ? r.w / g.b0.w : 1;
				Object.assign(el, k === 1 ? g.t0 : { size: Math.max(0.5, Math.round(g.t0.size * k * 10) / 10), letterSpacing: q(g.t0.letterSpacing * k), outline: q(g.t0.outline * k) });
			}
			if (r.gx != null) guides.push(['x', r.gx]);
			if (r.gy != null) guides.push(['y', r.gy]);
		} else {
			const b = g.b0, cx = b.x + b.w / 2, cy = b.y + b.h / 2;
			// Relatief t.o.v. het grijppunt: geen sprong als je de handle net naast het midden pakt.
			let a = b.rot + angleFrom(cx, cy, p.x, p.y) - angleFrom(cx, cy, g.p0.x, g.p0.y);
			if (shift) a = Math.round(a / 15) * 15;
			else if (sn) { const n = Math.round(a / 90) * 90; if (Math.abs(a - n) < 4) a = n; }
			el.rot = Math.round(normDeg(a) * 10) / 10 % 360;
		}
		// Niets veranderd (tikje, raster zette hem terug): alleen hulplijnen/maat tekenen.
		if (geo(g.mv) === k0) return redraw();
		// Undo-stap pas bij loslaten (onUp). Geen redraw hier: main.js tekent de overlay na de render in hetzelfde frame.
		app.changed({ history: false });
	}

	function onMove(e) {
		if (!e.isPrimary) return;
		if (!g) return hoverAt(e);
		last = e;
		step(e.shiftKey, e.altKey);
	}
	function onUp(e) {
		if (!e.isPrimary || !g) return;
		const done = g;
		g = null; guides = [];
		// Eén undo-stap per gebaar, alleen als het eindresultaat afwijkt van de start: heen en terug gaf anders een lege stap.
		if (done.moved && done.kind !== 'marquee') { if (geo(done.mv) !== done.k0) app.changed(); }
		else if (!done.moved && done.click) app.select([done.click]);
		hoverAt(e);
		redraw();
	}
	const onLeave = () => { if (!g && hover) { hover = null; redraw(); } };
	function onDbl(e) {
		const f = frame(), el = pick(toMM(e, f), f);
		if (el?.type === 'text') onEditText(el.id);
	}
	function onCtx(e) {
		e.preventDefault();
		if (g) return;
		const f = frame(), el = pick(toMM(e, f), f);
		// Leeg vlak: id null, de ui toont dan Plakken / Alles selecteren. Selecteren doet ui.contextMenu zelf.
		onContextMenu(el ? el.id : null, e.clientX, e.clientY);
	}
	function onWheel(e) {
		if (!(e.ctrlKey || e.metaKey)) return;
		e.preventDefault();
		autoFit = false;
		applyZoom(zoom * Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.002)), e.clientX, e.clientY);
	}

	const blocked = e => e.defaultPrevented || e.isComposing || typing(e.target) || !!document.querySelector('dialog[open]');
	function onKeyDown(e) {
		if (g) {
			// Shift/Alt tijdens slepen meteen toepassen, niet pas bij de volgende muisbeweging.
			if (e.key === 'Shift' || e.key === 'Alt') { if (e.key === 'Alt') e.preventDefault(); if (last) step(e.shiftKey, e.altKey); }
			return;
		}
		if (blocked(e)) return;
		const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase(), sel = app.selection, stop = () => e.preventDefault();
		// Andere toets (Ctrl+Z, Delete...) tijdens een pijltjes-gebaar: dat gebaar eerst als eigen stap vastleggen.
		if (!NUDGE[k]) endNudge();
		if (mod) {
			if (e.altKey) return;
			if (k === 'z') { stop(); if (e.shiftKey) app.redo(); else app.undo(); }
			else if (k === 'y') { stop(); app.redo(); }
			else if (k === 'a') { stop(); app.select(els().filter(x => !off(x)).map(x => x.id)); }
			else if (!sel.length) return;
			else if (k === 'd') { stop(); app.duplicate(sel); }
			return;
		}
		if (e.altKey) return;
		if (k === 'escape') { if (sel.length) app.select([]); return; }
		if (!sel.length) return;
		if (k === 'delete' || k === 'backspace') { stop(); app.remove(sel); return; }
		const d = NUDGE[k];
		if (!d || ownArrows(e.target)) return;
		stop();
		const st = e.shiftKey ? 5 : 0.5, mv = app.selected().filter(x => !x.locked);
		if (!mv.length) return;
		// Op het 0,01-raster: tegen de rand gaf keepOn anders een restje (bv. 0,0001) en een lege undo-stap.
		const [dx, dy] = keepOn(union(mv), app.doc.label, d[0] * st, d[1] * st).map(q);
		if (!dx && !dy) return;
		const id = mv.map(x => x.id).join();
		if (nudge?.id !== id) { endNudge(); nudge = { id, mv, k0: geo(mv) }; }
		for (const x of mv) { x.x = q(x.x + dx); x.y = q(x.y + dy); }
		app.changed({ history: false });
	}
	// Pijltje ingedrukt (ook herhaald) = één gebaar, zoals slepen: undo-stap pas bij loslaten en alleen als het resultaat
	// afwijkt van de start (heen en terug gaf anders een lege stap). blur: loslaten in een ander venster komt hier niet aan.
	function endNudge() {
		const n = nudge;
		nudge = null;
		if (n && geo(n.mv) !== n.k0) app.changed();
	}
	function onKeyUp(e) {
		if (g && (e.key === 'Shift' || e.key === 'Alt')) { if (e.key === 'Alt') e.preventDefault(); if (last) step(e.shiftKey, e.altKey); }
		if (NUDGE[e.key.toLowerCase()]) endNudge();
	}
	// Kopiëren/knippen via het copy/cut-event: zo krijgt ook het OS-klembord de elementen (als tekst). Anders bleef een
	// eerder geplakte afbeelding daar staan en plakte elke Ctrl+V die in plaats van het element.
	function onCopy(e) {
		// Tekst op de pagina geselecteerd (printerlog): gewoon die kopiëren, niet het element (en knippen wiste het element).
		if (!getSelection().isCollapsed && document.activeElement !== overlay) return;
		if (blocked(e) || !app.selection.length) return;
		// Knippen = alleen wat verwijderd wordt: vergrendeld bleef staan en kwam via plakken dubbel terug.
		const cut = e.type === 'cut', ids = cut ? app.selected().filter(x => !x.locked).map(x => x.id) : app.selection;
		if (!ids.length) return;
		e.preventDefault();
		e.clipboardData.setData('text/plain', app.copy(ids));
		if (cut) app.remove(ids);
	}
	// Plakken via het paste-event: bevat het OS-klembord een bestand (afbeelding), dan is dat voor de ui.
	function onPaste(e) {
		if (blocked(e)) return;
		if ([...e.clipboardData.items].some(i => i.kind === 'file')) return;
		// Na onze kopie elders tekst gekopieerd: niet stil een oud element plakken.
		if (app.newerClip(e.clipboardData.getData('text/plain'))) return;
		e.preventDefault();
		app.paste();
	}

	// ---------- maat / zoom ----------
	function syncSize() {
		const nw = Math.round(app.doc.label.w * DPM), nh = Math.round(app.doc.label.h * DPM);
		if (nw !== W || nh !== H) {
			W = nw; H = nh;
			const z = autoFit && fitZoom();
			if (z && z !== zoom) { zoom = z; onZoom(zoom); }
		}
		const cw = W * zoom + 'px', ch = H * zoom + 'px';
		for (const c of [view, overlay]) if (c.style.width !== cw || c.style.height !== ch) { c.style.width = cw; c.style.height = ch; }
	}
	function fitZoom() {
		if (!W || !H) return 0;
		const cw = host.clientWidth - FIT_PAD, ch = host.clientHeight - FIT_PAD;
		return cw > 0 && ch > 0 ? clamp(Math.min(cw / W, ch / H, FIT_MAX), ZMIN, ZMAX) : 0;
	}
	// Zoom rond (cx,cy): het punt onder de muis blijft staan als de stage scrollt.
	function applyZoom(z, cx, cy) {
		z = clamp(z, ZMIN, ZMAX);
		if (Math.abs(z - zoom) > 1e-6) {
			const r0 = view.getBoundingClientRect(), fx = cx == null || !r0.width ? 0 : (cx - r0.left) / r0.width, fy = cy == null || !r0.height ? 0 : (cy - r0.top) / r0.height;
			zoom = z;
			syncSize();
			if (cx != null) { const r = view.getBoundingClientRect(); host.scrollLeft += r.left + fx * r.width - cx; host.scrollTop += r.top + fy * r.height - cy; }
			onZoom(zoom);
		}
		redraw();
	}
	function fit() {
		autoFit = true;
		const z = fitZoom();
		// Kleine afwijkingen negeren: anders kan ResizeObserver blijven pingpongen.
		if (z && Math.abs(z - zoom) / zoom > 0.005) applyZoom(z); else redraw();
	}
	const later = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (autoFit) fit(); else redraw(); }); };

	// ---------- tekenen ----------
	function path(b) {
		ctx.save(); ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.rotate((b.rot || 0) * RAD);
		ctx.beginPath(); ctx.rect(-b.w / 2, -b.h / 2, b.w, b.h);
		ctx.restore();
	}
	function redraw() {
		syncSize();
		// Buffer max ~16 Mpx: ver ingezoomd anders honderden MB, en boven Chromes canvasgrens werd er niets meer getekend.
		const f = frame(), ds = Math.min(window.devicePixelRatio || 1, Math.sqrt(16e6 / Math.max(1, f.o.width * f.o.height)));
		const bw = Math.max(1, Math.round(f.o.width * ds)), bh = Math.max(1, Math.round(f.o.height * ds));
		if (overlay.width !== bw || overlay.height !== bh) { overlay.width = bw; overlay.height = bh; }
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, bw, bh);
		if (!f.o.width) return;
		const k = bw / f.o.width, u = 1 / f.ppm, acc = getComputedStyle(overlay).getPropertyValue('--accent').trim() || '#2563eb';
		ctx.setTransform(f.ppm * k, 0, 0, f.ppm * k, (f.v.left - f.o.left) * k, (f.v.top - f.o.top) * k);
		const stroke = (color, width, dash) => { ctx.strokeStyle = color; ctx.lineWidth = width * u; ctx.setLineDash(dash ? [4 * u, 3 * u] : []); ctx.stroke(); };
		for (const np of nonPrintable(app.doc)) {
			// Arcering onder alles: laat zien dat dit stuk van het label niet onder de printkop komt.
			ctx.save(); ctx.beginPath(); ctx.rect(np.x, np.y, np.w, np.h); ctx.clip();
			ctx.fillStyle = HATCH_BG; ctx.fill();
			ctx.beginPath();
			for (let s = np.x - np.h, st = HATCH_PX * u; s < np.x + np.w; s += st) { ctx.moveTo(s, np.y + np.h); ctx.lineTo(s + np.h, np.y); }
			stroke(HATCH, 1, false);
			ctx.restore();
		}
		const sel = app.selected(), hv = hover && !g && !app.selection.includes(hover) && byId(hover);
		if (hv && !off(hv)) { path(hv); stroke(acc, 1, false); }
		for (const el of sel) { path(el); stroke(off(el) ? MUTED : acc, 1.5, el.locked || off(el)); }
		if (sel.length > 1) { const a = union(sel); ctx.beginPath(); ctx.rect(a.x, a.y, a.w, a.h); stroke(acc, 1, true); }
		const one = sel.length === 1 ? sel[0] : null;
		if (one?.locked) {
			// Slotje rechtsboven: verklaart waarom er geen handles zijn.
			const a = aabb(one), x = Math.min(a.x + a.w + 7 * u, f.x1 - 6 * u), y = Math.max(a.y - 2 * u, f.y0 + 9 * u);
			ctx.fillStyle = acc; ctx.fillRect(x - 4 * u, y - 3 * u, 8 * u, 6 * u);
			ctx.beginPath(); ctx.arc(x, y - 3 * u, 2.5 * u, Math.PI, 0); stroke(acc, 1.5, false);
		} else if (one && !off(one)) {
			const b = one, s = HS * u, ly = rotLocal(b, f);
			ctx.save(); ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.rotate(b.rot * RAD);
			ctx.fillStyle = '#fff';
			ctx.beginPath(); ctx.moveTo(0, ly < 0 ? -b.h / 2 : b.h / 2); ctx.lineTo(0, ly); stroke(acc, 1.5, false);
			ctx.beginPath(); ctx.arc(0, ly, s / 2 + u, 0, Math.PI * 2); ctx.fill(); stroke(acc, 1.5, false);
			for (const [hx, hy] of handles(b, f, ratioLocked(one))) { ctx.beginPath(); ctx.rect(hx * b.w / 2 - s / 2, hy * b.h / 2 - s / 2, s, s); ctx.fill(); stroke(acc, 1.5, false); }
			ctx.restore();
		}
		if (g?.kind === 'marquee' && g.moved) {
			ctx.beginPath(); ctx.rect(Math.min(g.p0.x, g.p1.x), Math.min(g.p0.y, g.p1.y), Math.abs(g.p1.x - g.p0.x), Math.abs(g.p1.y - g.p0.y));
			ctx.globalAlpha = 0.08; ctx.fillStyle = acc; ctx.fill(); ctx.globalAlpha = 1; stroke(acc, 1, false);
		}
		for (const [axis, v] of guides) {
			ctx.beginPath();
			if (axis === 'x') { ctx.moveTo(v, f.y0); ctx.lineTo(v, f.y1); } else { ctx.moveTo(f.x0, v); ctx.lineTo(f.x1, v); }
			stroke(GUIDE, 1, false);
		}
		if (!g?.moved || g.kind === 'marquee' || !last) return;
		const el = g.el, bb = g.kind === 'move' ? union(g.start.map(([x]) => x)) : null;
		const text = g.kind === 'move' ? `X ${fmt(bb.x)}  Y ${fmt(bb.y)} mm` : g.kind === 'resize' ? `${fmt(el.w)} × ${fmt(el.h)} mm` : `${fmt(el.rot)}°`;
		ctx.setTransform(k, 0, 0, k, 0, 0); ctx.setLineDash([]);
		ctx.font = '11px system-ui, sans-serif';
		const tw = ctx.measureText(text).width + 10, tx = clamp(last.clientX - f.o.left + 14, 2, f.o.width - tw - 2), ty = clamp(last.clientY - f.o.top + 20, 2, f.o.height - 20);
		ctx.fillStyle = 'rgba(17,24,39,.88)'; ctx.fillRect(tx, ty, tw, 18);
		ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(text, tx + 5, ty + 9);
	}

	// ---------- koppelen ----------
	const listeners = [[overlay, 'pointerdown', onDown], [overlay, 'pointermove', onMove], [overlay, 'pointerup', onUp], [overlay, 'pointercancel', onUp],
		[overlay, 'pointerleave', onLeave], [overlay, 'dblclick', onDbl], [overlay, 'contextmenu', onCtx],
		[window, 'keydown', onKeyDown], [window, 'keyup', onKeyUp], [document, 'paste', onPaste], [document, 'copy', onCopy], [document, 'cut', onCopy], [window, 'blur', endNudge]];
	for (const [t, n, fn] of listeners) t.addEventListener(n, fn);
	host.addEventListener('wheel', onWheel, { passive: false });
	// Overlay-maat zet syncSize zelf, selectie tekent main.js frame(): hier alleen de stage en een nieuw label.
	new ResizeObserver(later).observe(host);
	app.on('doc', redraw);
	syncSize();
	fit();

	return {
		redraw,
		// Rond het midden van het zichtbare vlak, zoals Ctrl+wiel rond de muis: anders verschoof het beeld naar linksboven.
		setZoom(z) { autoFit = false; const r = host.getBoundingClientRect(); applyZoom(+z || zoom, r.left + host.clientLeft + host.clientWidth / 2, r.top + host.clientTop + host.clientHeight / 2); },
		getZoom: () => zoom,
		fit,
	};
}
