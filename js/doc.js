// Documentmodel v2, migratie, centrale store met undo/redo en gebruikerstemplates.
// Niets met DOM/localStorage op module-niveau: node importeert dit voor tools/check.js.
import { uid, clamp, round, debounce, load, store, sleep, DPM, MAX_W, fieldValues, fieldCol, ruleMatches, applyRules, substitute, TOKEN, parseDay } from './util.js';
import { IMAGE_PRESETS } from './imaging.js';
import { HALIGN, VALIGN } from './render.js';

export const DOC_VERSION = 2;
export const ELEMENT_TYPES = ['text','barcode','qr','image','shape','icon','border','emoji'];
export const TYPE_NAMES = { text:'Tekst', barcode:'Barcode', qr:'QR / 2D-code', image:'Afbeelding', shape:'Vorm', icon:'Icoon', border:'Rand', emoji:'Emoji' };

// Standaard boxmaat (mm) bij aanmaken; border krijgt label min 1 mm rondom (zie boxed).
const BOX = { text:[30,8], barcode:[34,12], qr:[18,18], image:[20,20], shape:[14,14], icon:[12,12], border:[38,28], emoji:[14,14] };
// Inhoud wordt contain getekend: deze types schalen altijd uniform, anders klopt de box niet meer met wat je ziet.
export const RATIO = new Set(['icon', 'emoji', 'qr', 'image']);
const COMMON = { id:'', type:'', name:'', x:0, y:0, w:0, h:0, rot:0, locked:false, hidden:false, invert:false, opacity:1, rules:[] };
const OWN = {
	text: { text:'Tekst', font:'Arial', size:5, bold:false, italic:false, underline:false, strike:false, align:'left', valign:'top',
		lineHeight:1.15, letterSpacing:0, wrap:true, fit:'none', vertical:false, outline:0 },
	barcode: { data:'123456789012', symbology:'code128', showText:true, textSize:2.5 },
	qr: { data:'https://example.com', symbology:'qrcode', ecc:'M' },
	// Golf 3: nieuwe foto's op de automatische pijplijn; oude docs houden hun mode (oude modes negeren de nieuwe velden).
	// Beeldwaarden = de Auto-variant: kalibreren in imaging.js raakt zo ook nieuwe foto's en 'Reset naar auto'.
	image: { src:'', fit:'contain', flipH:false, flipV:false, ...IMAGE_PRESETS[0].params },
	shape: { shape:'rect', stroke:0.5, fill:'none', radius:0, dash:'solid' },
	icon: { icon:'star', set:'outline', nodes:[], stroke:2, source:'tabler', svg:'' },
	border: { style:'line', stroke:0.6 },
	emoji: { char:'🌿', style:'mono', weight:500, mode:'floyd', threshold:128, brightness:0, contrast:0 },
};
export const ELEMENT_DEFAULTS = Object.fromEntries(ELEMENT_TYPES.map(t =>
	[t, { ...COMMON, type:t, name:TYPE_NAMES[t], w:BOX[t][0], h:BOX[t][1], ...OWN[t] }]));

const LABEL = { w:40, h:30, shape:'rect' };
const PRINT = { density:10, speed:5, media:10, copies:1, rotate180:false, offset:0 };
const COUNTER = { start:1, step:1, digits:3, autoAdvance:true };
const BATCH = { csv:'', row:1 };
const LAYOUT = { autoTidy:true, margin:1.5 };

// Diepe kopie die strings deelt (JS-strings zijn immutable): 100 history-snapshots met een foto-dataURL
// kosten zo geen 100x het geheugen, wat structuredClone wel zou doen.
const dup = v => Array.isArray(v) ? v.map(dup) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, dup(x)])) : v;
const same = (d, v) => Array.isArray(d) ? Array.isArray(v) : typeof d === typeof v && (typeof d !== 'number' || Number.isFinite(v));
// Alleen bekende velden met het juiste type overnemen; de rest = default. Dit is de vertrouwensgrens voor imports.
function fill(def, src) {
	const o = {};
	for (const k in def) o[k] = src && typeof src === 'object' && same(def[k], src[k]) ? dup(src[k]) : dup(def[k]);
	return o;
}
const pos = v => Number.isFinite(v) && v > 0;
const r3 = v => Math.round(v * 1000) / 1000;

// --- invulvelden (doc.fields) en element-regels (el.rules); ook dit is vertrouwensgrens voor imports ---
export const FIELD_TYPES = ['text', 'number', 'choice', 'date', 'toggle'];
export const KEY = /^[a-z0-9]+$/;
const str = v => typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : '';
const keyOf = v => typeof v === 'string' ? v.trim().toLowerCase() : '';
// Ongeldige of dubbele key = veld weg (tokens blijven dan letterlijk zichtbaar); onbekend type of keuze zonder opties = tekst.
function normFields(src) {
	const out = [], keys = new Set();
	for (const f of Array.isArray(src) ? src : []) {
		const key = keyOf(f?.key);
		if (!KEY.test(key) || keys.has(key)) continue;
		keys.add(key);
		const options = [...new Set((Array.isArray(f.options) ? f.options : []).map(o => str(o).trim()).filter(Boolean))];
		const type = FIELD_TYPES.includes(f.type) && (f.type !== 'choice' || options.length) ? f.type : 'text', o = { key, label:str(f.label).trim() || key, type };
		if (type === 'toggle') o.value = f.value === true;
		else if (type === 'choice') { o.options = options; o.value = options.includes(str(f.value)) ? str(f.value) : options[0]; }
		else if (type === 'date') { o.value = parseDay(f.value) ? f.value : ''; o.offset = Number.isFinite(f.offset) ? clamp(Math.round(f.offset), -3650, 3650) : 0; }
		else { o.value = str(f.value); o.placeholder = str(f.placeholder); if (type === 'number') o.suffix = str(f.suffix); }
		out.push(o);
	}
	return out;
}
// set ⊆ { invert, hidden }; equals: boolean (toggle) of string (keuze). Regels naar een (nog) onbekend veld doen niets.
function normRules(src) {
	const out = [];
	for (const r of Array.isArray(src) ? src : []) {
		const field = keyOf(r?.field), set = {};
		for (const k of ['invert', 'hidden']) if (typeof r?.set?.[k] === 'boolean') set[k] = r.set[k];
		if (KEY.test(field) && Object.keys(set).length) out.push({ field, equals:typeof r.equals === 'boolean' ? r.equals : str(r.equals), set });
	}
	return out;
}
// Harde grens ruim boven het UI-maximum (50 x 300 mm): een kapot bestand mag geen canvas van 800.000 dots maken.
const LABEL_MAX = { w:100, h:300 };
const labelOf = doc => ({ w: pos(doc?.label?.w) ? Math.min(doc.label.w, LABEL_MAX.w) : LABEL.w, h: pos(doc?.label?.h) ? Math.min(doc.label.h, LABEL_MAX.h) : LABEL.h });
const known = type => typeof type === 'string' && Object.hasOwn(ELEMENT_DEFAULTS, type);   // geen 'constructor'/'__proto__'

// De kop print 384 dots; printer.encodeRaster schuift de X-verschuiving naar rechts en laat alles voorbij dot 384 weg.
// Zonder draaien valt dus de rechterkant weg, met 180° draaien (raster gespiegeld) de LINKERkant.
const PRINT_W = MAX_W / DPM;
export function printableArea(doc) {
	const L = labelOf(doc), o = Math.max(0, Math.round((+doc?.print?.offset || 0) * DPM) || 0) / DPM, w = r3(Math.max(1, Math.min(L.w, PRINT_W - o)));
	return { x:doc?.print?.rotate180 ? r3(L.w - w) : 0, y:0, w, h:L.h };
}

const cl3 = v => Math.ceil(v * 1000 - 1e-6) / 1000;
// Printbaar vlak min marge; marge max een kwart van de kleinste zijde, zodat er altijd ruimte overblijft.
// Rond label: de grootste rechthoek binnen de (marge-)ellips, anders valt inhoud in de hoeken buiten de sticker.
function marginArea(doc) {
	const P = printableArea(doc), raw = doc?.layout?.margin;
	const m = clamp(Number.isFinite(raw) ? raw : LAYOUT.margin, 0, Math.min(P.w, P.h) / 4);
	if (doc?.label?.shape !== 'round') return { x:P.x + m, y:P.y + m, w:P.w - 2 * m, h:P.h - 2 * m, m };
	const L = labelOf(doc), ax = (L.w / 2 - m) * Math.SQRT1_2, ay = (L.h / 2 - m) * Math.SQRT1_2;
	const x0 = cl3(Math.max(P.x, L.w / 2 - ax)), y0 = cl3(Math.max(P.y, L.h / 2 - ay));
	const x1 = fl3(Math.min(P.x + P.w, L.w / 2 + ax)), y1 = fl3(Math.min(P.y + P.h, L.h / 2 + ay));
	return { x:x0, y:y0, w:r3(Math.max(1, x1 - x0)), h:r3(Math.max(1, y1 - y0)), m };
}
// Binnenvlak voor vullen/plaatsen: een zichtbare kaderrand (>= 70% van het vlak) duwt het verder naar binnen,
// anders raakt inhoud op de marge de randlijn. 2x de lijndikte = ruwe maat voor dubbele/sierlijke stijlen.
function innerArea(doc) {
	const A = marginArea(doc), P = printableArea(doc);
	let x0 = A.x, y0 = A.y, x1 = A.x + A.w, y1 = A.y + A.h;
	for (const b of doc?.elements || []) {
		if (b.type !== 'border' || b.hidden || b.w < P.w * .7 || b.h < P.h * .7) continue;
		const i = 2 * b.stroke + A.m;
		x0 = Math.max(x0, b.x + i); y0 = Math.max(y0, b.y + i); x1 = Math.min(x1, b.x + b.w - i); y1 = Math.min(y1, b.y + b.h - i);
	}
	[x0, y0, x1, y1] = [x0, y0, x1, y1].map(r3);
	// Rand te dik voor het label: dan alleen de marge.
	return x1 - x0 >= 2 && y1 - y0 >= 2 ? { x:x0, y:y0, w:r3(x1 - x0), h:r3(y1 - y0), m:A.m } : A;
}

// Volledig element uit een (deels) bekend bron-object; ontbrekende box = standaardbox, gecentreerd in het printbare vlak.
// Maat begrensd op 4x de grootste labelzijde: groter is altijd een kapot bestand (en kost elk frame een reuzencanvas).
function boxed(src, doc) {
	const el = fill(ELEMENT_DEFAULTS[src.type], src), L = labelOf(doc), P = printableArea(doc), big = 4 * Math.max(L.w, L.h);
	const border = src.type === 'border';
	el.w = Math.min(big, pos(src.w) ? src.w : border ? Math.max(1, P.w - 2) : BOX[src.type][0]);
	el.h = Math.min(big, pos(src.h) ? src.h : border ? Math.max(1, L.h - 2) : BOX[src.type][1]);
	el.x = Number.isFinite(src.x) ? src.x : border ? r3(P.x + 1) : round(P.x + (P.w - el.w) / 2);
	el.y = Number.isFinite(src.y) ? src.y : border ? 1 : round((L.h - el.h) / 2);
	el.rules = normRules(src.rules);
	// fill() kijkt alleen naar het type: 'constructor' als uitlijning gaf via de opzoektabellen x = NaN.
	if (el.type === 'text') {
		if (!['left', 'center', 'right', 'justify'].includes(el.align)) el.align = 'left';
		if (!['top', 'middle', 'bottom'].includes(el.valign)) el.valign = 'top';
	}
	// Alleen ingebedde afbeeldingen (ui maakt altijd een dataURL): een URL uit een geïmporteerd bestand zou bij elke render
	// een externe server raken (IP/tijd) en het canvas besmetten (tekenen mislukt -> niet printen).
	if (el.type === 'image' && !/^data:image\//i.test(el.src)) el.src = '';
	return el;
}

function normEl(src, doc, ids) {
	if (!src || !known(src.type)) return null;
	const el = boxed(src, doc);
	if (!el.id || ids.has(el.id)) el.id = uid();
	ids.add(el.id);
	return el;
}

function autoName(type, doc) {
	const n = (doc?.elements || []).filter(e => e.type === type).length;
	return TYPE_NAMES[type] + (n ? ' ' + (n + 1) : '');
}

export function createElement(type, overrides = {}, doc) {
	if (!known(type)) throw new Error('Onbekend elementtype: ' + type);
	const el = boxed({ ...overrides, type }, doc);
	el.id = uid();
	el.name = typeof overrides.name === 'string' && overrides.name ? overrides.name : autoName(type, doc);
	// Rand mag tot de printrand, al het andere blijft binnen de marge van het printbare vlak.
	const A = type === 'border' ? printableArea(doc) : marginArea(doc);
	// Verhouding-vaste types uniform klemmen: los geklemd wordt een QR 17x7 en klopt de box niet met wat je ziet.
	if (RATIO.has(type)) { const k = Math.min(1, A.w / el.w, A.h / el.h); el.w = fl3(el.w * k); el.h = fl3(el.h * k); }
	else { el.w = Math.min(el.w, A.w); el.h = Math.min(el.h, A.h); }
	el.x = clamp(el.x, A.x, r3(A.x + A.w - el.w)); el.y = clamp(el.y, A.y, r3(A.y + A.h - el.h));
	return el;
}

export function cloneElement(el, doc) {
	const c = dup(el), taken = new Set((doc?.elements || []).map(e => e.id));
	do c.id = uid(); while (taken.has(c.id));
	// Minstens 1 mm blijft op het label (zoals slepen), anders raakt een vaak geplakte kopie zoek. Op de omhullende: een
	// gedraaid element steekt anders voorbij zijn box.
	const L = labelOf(doc), b = aabb(el);
	c.x = r3(el.x + Math.min(2, L.w - Math.min(1, b.w) - b.x)); c.y = r3(el.y + Math.min(2, L.h - Math.min(1, b.h) - b.y));
	return c;
}

// Nieuw label op de standaardrol (eerste van Mijn rollen); label = expliciete maat (selftest, geïsoleerde store).
export function newDoc(label = rolls.list()[0]) {
	const doc = { v:DOC_VERSION, name:'', label:{ ...LABEL }, print:{ ...PRINT }, counter:{ ...COUNTER }, batch:{ ...BATCH }, layout:{ ...LAYOUT }, fields:[], elements:[] };
	Object.assign(doc.label, fill(LABEL, label), labelOf({ label }));
	// Gecentreerd en krimpend: wat je over 'Mijn label' typt blijft in het vak en in het midden.
	doc.elements.push(createElement('text', { text:'Mijn label', size:6, bold:true, fit:'shrink', align:'center', valign:'middle' }, doc));
	return doc;
}

function fromV2(src) {
	// Naam hoort bij het doc: zo zetten undo/redo en herladen hem mee terug.
	const doc = { v:DOC_VERSION, name:str(src.name).slice(0, 60), label:fill(LABEL, src.label), print:fill(PRINT, src.print), counter:fill(COUNTER, src.counter),
		batch:fill(BATCH, src.batch), layout:fill(LAYOUT, src.layout), fields:normFields(src.fields), elements:[] };
	// Onbekende vorm (kapot/handgemaakt bestand) = rechthoek, zoals normRoll en adaptTemplate.
	Object.assign(doc.label, labelOf(doc), { shape:doc.label.shape === 'round' ? 'round' : 'rect' });
	const ids = new Set();
	for (const e of Array.isArray(src.elements) ? src.elements : []) { const el = normEl(e, doc, ids); if (el) doc.elements.push(el); }
	return doc;
}

// v1 vulde elementen altijd vanuit deze defaults; ontbrekende velden in oude saves dus hiermee aanvullen.
const V1_DEF = {
	text: { text:'Tekst', font:'Arial', size:5, bold:true, align:'left', x:2, y:2 },
	qr: { text:'https://example.com', size:20, x:2, y:2 },
	barcode: { text:'123456789012', format:'CODE128', w:36, h:12, showText:true, x:2, y:2 },
	image: { src:'', w:20, threshold:128, dither:true, invert:false, x:2, y:2 },
};
const V1_FMT = { CODE128:'code128', EAN13:'ean13', EAN8:'ean8', UPC:'upca', CODE39:'code39' };
// v1 tekende een afbeelding met h = w * natuurlijke verhouding vanaf linksboven; v2 centreert contain in de box. Zonder die
// verhouding schuift een liggend logo omlaag en krimpt een staande foto. v1 sloeg altijd een canvas-PNG op: maat uit IHDR.
function pngRatio(src) {
	const m = /^data:image\/png;base64,([A-Za-z0-9+/]{32})/.exec(typeof src === 'string' ? src : '');
	if (!m) return 0;
	const b = atob(m[1]), be32 = i => (b.charCodeAt(i) * 2 ** 24) + (b.charCodeAt(i + 1) << 16) + (b.charCodeAt(i + 2) << 8) + b.charCodeAt(i + 3);
	const w = be32(16), h = be32(20);
	return b.startsWith('\x89PNG') && w > 0 && h > 0 ? h / w : 0;
}

function fromV1(s) {
	const doc = fromV2({ label:{ w:s.w, h:s.h }, batch:{ csv:s.batch, row:1 },
		print:{ density:s.density, speed:s.speed, media:s.media, copies:s.copies, rotate180:s.rotate, offset:s.offset } });
	const L = doc.label, ids = new Set();
	const conv = {
		// v1-tekst: x was relatief aan de uitlijning (links: vanaf links, midden: vanaf het labelmidden, rechts: vanaf rechts).
		text: e => {
			const ax = Math.abs(e.x), box = e.align === 'center' ? { x:Math.max(0, 2 * e.x), w:L.w - 2 * ax }
				: e.align === 'right' ? { x:0, w:L.w - e.x } : { x:e.x, w:L.w - e.x };
			return { text:e.text, font:e.font, size:e.size, bold:e.bold, align:e.align, y:e.y, ...box,
				h:round(String(e.text).split('\n').length * e.size * 1.15, 0.01) };
		},
		qr: e => ({ data:e.text, x:e.x, y:e.y, w:e.size, h:e.size }),
		barcode: e => ({ data:e.text, symbology:V1_FMT[e.format] || 'code128', x:e.x, y:e.y, w:e.w, h:e.h, showText:e.showText, textSize:3 }),
		// v1-dither gebruikte de drempel alleen als kwantiseerpunt (toon bleef gelijk); v2-diffusie gebruikt hem als bias,
		// dus 128 houdt de v1-toon. Zonder dither is het een echte drempel en blijft hij staan.
		image: e => ({ src:e.src, x:e.x, y:e.y, w:e.w, h:r3(e.w * (pngRatio(e.src) || 1)), threshold:e.dither ? 128 : e.threshold, mode:e.dither ? 'floyd' : 'threshold', invertImg:e.invert }),
	};
	for (const raw of Array.isArray(s.elements) ? s.elements : []) {
		if (!raw || !Object.hasOwn(V1_DEF, raw.type)) continue;   // geen 'constructor'/'__proto__'
		const n = conv[raw.type]({ ...V1_DEF[raw.type], ...raw });
		// Tekst buiten het label kon in v1; houd minstens 1 mm box over.
		if (Number.isFinite(n.w)) n.w = Math.max(1, n.w);
		doc.elements.push(normEl({ ...n, type:raw.type, id:raw.id }, doc, ids));
	}
	return doc;
}

// v1 = platte state { w, h, density, ..., elements } zonder `v` en zonder `label`.
export function migrate(input) {
	if (typeof input === 'string') try { input = JSON.parse(input); } catch { input = null; }
	if (!input || typeof input !== 'object' || Array.isArray(input)) return newDoc();
	return 'v' in input || input.label ? fromV2(input) : fromV1(input);
}

export const normalizeTemplateDoc = tdoc => fromV2(tdoc && typeof tdoc === 'object' ? tdoc : {});

// Assen-uitgelijnde omhullende van de geroteerde box (rotatie rond het midden). Ook voor editor en ui.
export function aabb(el) {
	const a = (el.rot || 0) * Math.PI / 180, c = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a));
	const w = el.w * c + el.h * sn, h = el.w * sn + el.h * c;
	return { x:el.x + el.w / 2 - w / 2, y:el.y + el.h / 2 - h / 2, w, h };
}

// --- layout-wiskunde (pure functies op één element; de store-operaties doen de changed()) ---
// Maten naar beneden afronden: zo komt x + w nooit door afronding over de rand van het vlak.
const fl3 = v => Math.floor(v * 1000 + 1e-6) / 1000;
// 0 = recht (0/180°), 1 = kwartslag (90/270°), -1 = schuin.
const quarter = rot => { const r = ((rot || 0) % 180 + 180) % 180; return r < .5 || r > 179.5 ? 0 : Math.abs(r - 90) < .5 ? 1 : -1; };
// Grootste box met dezelfde verhouding waarvan de (geroteerde) omhullende in W x H past.
function fitUniform(el, W, H) {
	const b = aabb(el), k = Math.min(b.w > 0 ? W / b.w : Infinity, b.h > 0 ? H / b.h : Infinity);
	if (Number.isFinite(k)) { el.w = fl3(el.w * k); el.h = fl3(el.h * k); }
}
// Omhullende wordt W x H: bij een kwartslag w/h wisselen, schuin kan niet exact en past dan uniform.
function setBox(el, W, H) {
	const q = quarter(el.rot);
	if (q < 0) fitUniform(el, W, H);
	else [el.w, el.h] = q ? [fl3(H), fl3(W)] : [fl3(W), fl3(H)];
}
// b = wat er gecentreerd wordt (standaard de box, met meting de zichtbare inhoud).
function centerIn(el, A, axis = 'both', b = aabb(el)) {
	if (axis !== 'v') el.x = r3(el.x + A.x + (A.w - b.w) / 2 - b.x);
	if (axis !== 'h') el.y = r3(el.y + A.y + (A.h - b.h) / 2 - b.y);
}
const frame = (b, P) => Object.assign(b, { x:r3(P.x + 1), y:r3(P.y + 1), w:Math.max(1, r3(P.w - 2)), h:Math.max(1, r3(P.h - 2)) });
function fillEl(el, doc) {
	if (el.type === 'border') { el.rot = 0; return frame(el, printableArea(doc)); }   // kader om het printbare vlak: recht
	const A = innerArea(doc);
	if (RATIO.has(el.type)) fitUniform(el, A.w, A.h);
	else if (el.type !== 'barcode') setBox(el, A.w, A.h);
	// Grens op de streephoogte (el.h): bij een kwartslag ligt die horizontaal, anders wordt de code te kort om te scannen.
	else { const cap = labelOf(doc).h * .45; if (quarter(el.rot) === 1) setBox(el, Math.min(A.w, cap), A.h); else setBox(el, A.w, Math.min(A.h, cap)); }
	if (el.type === 'text') el.fit = 'fill';
	centerIn(el, A);
}
// Zichtbare inhoud (mm) volgens de meting (gedraaid = de omhullende); null = geen (bruikbare) meting: dan telt de box.
function seen(el, ext) {
	// Omgekeerd = zwart vlak over de hele box: dan is de box de zichtbare inhoud. Ook als alleen een (nu niet actieve)
	// keuze-regel omkeert, anders krimpt die chip zodra je een andere optie kiest.
	if (typeof ext !== 'function' || el.invert || (el.rules || []).some(r => r?.set?.invert === true)) return null;
	let e = null;
	try { e = ext(el); } catch {}
	return e && Number.isFinite(e.x) && Number.isFinite(e.y) && pos(e.w) && pos(e.h) ? e : null;
}
// Vullen op een leeg label: gecentreerde tekst op zijn zichtbare inhoud midden (zonder onderstokken staat de regelbox te hoog).
function centerSeen(el, doc, ext) {
	if (el.type !== 'text') return;
	const ax = el.align === 'center' ? (el.valign === 'middle' ? 'both' : 'h') : el.valign === 'middle' ? 'v' : null, e = ax && seen(el, ext);
	if (e) centerIn(el, innerArea(doc), ax, e);
}
// Vak om de zichtbare inhoud e (mm): tekst houdt zijn regels (breedte + speling, de tekst blijft staan waar hij staat),
// een contain-foto zijn beeld. Tekst wordt precies zijn regelbox, dus valign maakt daarna niets meer uit.
const HUG = .2;
function hug(el, e, ext) {
	const t = el.type === 'text', a = t ? HALIGN[el.align] ?? 0 : .5;
	// De meting centreert op de inkt, render zet de regel in het vak: een vak om de inkt schoof de regel (en daarmee de groep)
	// elke keer een stukje op. Links vs rechts uitgelijnd meten geeft de regel zelf (meting smaller dan de regel = onbruikbaar).
	let x = e.x, lw = e.w;
	const lt = t && seen({ ...el, align:'left' }, ext), rt = lt && seen({ ...el, align:'right' }, ext);
	if (rt && el.w - (rt.x - lt.x) <= e.w + 1 / DPM) { lw = el.w - (rt.x - lt.x); x = el.x + (rt.x - lt.x) * a; }
	// Afbrekende tekst nooit breder (dan lopen regels anders), een losse regel mag uitgroeien tot wat hij is.
	const w = cl3(!t ? e.w : el.wrap !== false ? Math.min(el.w, lw + HUG) : lw + HUG);
	let y = e.y, h = e.h;
	// De meting laat bij tekst zonder onderstokken de lege ruimte eronder weg; een vak van die hoogte laat krimpen/vullen de
	// tekst kleiner maken. De regelbox volgt uit boven- vs onder-uitgelijnd meten: het verschil is de vrije ruimte in het vak.
	// Altijd de regelbox, ook als de inkt hoger is (sierletters): render zet de regel midden in een groter vak, dan zakte de
	// inkt elke klik verder en kromp hij.
	const top = t && seen({ ...el, valign:'top' }, ext), bot = top && seen({ ...el, valign:'bottom' }, ext);
	if (bot) { y = e.y - (top.y - el.y); h = el.h - (bot.y - top.y); }
	Object.assign(el, { x:r3(x - (w - lw) * a), y:r3(y), w, h:cl3(h) });
}
// Maten in mm die met de box mee moeten schalen, anders klopt de onderlinge verhouding niet meer.
const SCALED = { text:['size', 'letterSpacing', 'outline'], barcode:['textSize'], shape:['stroke', 'radius'] };
const scaleOwn = (el, k) => { for (const f of SCALED[el.type] || []) el[f] = r3(el[f] * k); };
// Alles wat schalen/kader-zetten verandert (box + SCALED).
const geo = el => Object.fromEntries(['x', 'y', 'w', 'h', ...(SCALED[el.type] || [])].map(k => [k, el[k]]));
// Box op schaal (sx, sy) rond oorsprong o -> doel t; verhouding-vaste types uniform met k.
function scaleEl(el, sx, sy, k, o, t) {
	const cx = el.x + el.w / 2, cy = el.y + el.h / 2;
	if (RATIO.has(el.type) || sx === sy) { el.w = r3(el.w * k); el.h = r3(el.h * k); }
	else { const [a, b] = quarter(el.rot) === 1 ? [sy, sx] : [sx, sy]; el.w = r3(el.w * a); el.h = r3(el.h * b); }
	scaleOwn(el, k);
	el.x = r3(t.x + (cx - o.x) * sx - el.w / 2); el.y = r3(t.y + (cy - o.y) * sy - el.h / 2);
}
// Rand die nu het hele (printbare) label omlijst: die volgt een nieuwe labelmaat als kader.
const near = (a, b) => Math.abs(a - b) < .05;
const isFrame = (b, P, L) => (near(b.x, 1) || near(b.x, P.x + 1)) && near(b.y, 1) && near(b.y + b.h, P.h - 1) && (near(b.x + b.w, P.x + P.w - 1) || near(b.x + b.w, L.w - 1));
export const span = (list, box = aabb) => { const bbs = list.map(box), x = Math.min(...bbs.map(b => b.x)), y = Math.min(...bbs.map(b => b.y));
	return { x, y, w:Math.max(...bbs.map(b => b.x + b.w)) - x, h:Math.max(...bbs.map(b => b.y + b.h)) - y }; };
const mid = R => ({ x:R.x + R.w / 2, y:R.y + R.h / 2 });
// Groep als geheel verschuiven tot het midden van zijn omhullende (box of zichtbare inhoud) in P ligt; de opmaak blijft.
// C = de boxen blijven daarbinnen (of schuiven niet verder naar buiten dan ze al stonden): op de inkt centreren sleept
// een korte tekst in een breed vak anders zijn vak van het label.
const into = (d, b, bw, c, cw) => clamp(d, Math.min(c, b) - b, Math.max(c + cw, b + bw) - b - bw);
function shiftTo(list, P, axis = 'both', box = aabb, C = null) {
	const G = span(list, box), B = C && span(list);
	let dx = axis !== 'v' ? P.x + (P.w - G.w) / 2 - G.x : 0, dy = axis !== 'h' ? P.y + (P.h - G.h) / 2 - G.y : 0;
	if (C) { dx = into(dx, B.x, B.w, C.x, C.w); dy = into(dy, B.y, B.h, C.y, C.h); }
	for (const el of list) { el.x = r3(el.x + dx); el.y = r3(el.y + dy); }
}
// Groep als geheel binnen C houden: alleen verkleinen en zo weinig mogelijk schuiven, de opmaak blijft.
function keepIn(list, C) {
	const G = span(list), kg = Math.min(1, C.w / G.w, C.h / G.h), gw = G.w * kg, gh = G.h * kg;
	const t = { x:clamp(G.x + G.w / 2, C.x + gw / 2, C.x + C.w - gw / 2), y:clamp(G.y + G.h / 2, C.y + gh / 2, C.y + C.h - gh / 2) };
	if (kg < 1 || Math.abs(t.x - mid(G).x) > 1e-6 || Math.abs(t.y - mid(G).y) > 1e-6) for (const el of list) scaleEl(el, kg, kg, kg, mid(G), t);
}

// Tekstboxen in de vrije as laten meegroeien (max factor g) tot het binnenvlak A: richting een buur hooguit tot de halve
// tussenruimte (zo raken twee groeiende teksten elkaar nooit), binnen een rechte vorm eronder (balk) blijven, en geen
// groei waar al iets overlapt of binnen een ronde/andere vorm (die rand kruist de tekst anders in de hoeken).
function growTexts(D, A, axis, g) {
	const [p, d, q, e] = axis === 'y' ? ['y', 'h', 'x', 'w'] : ['x', 'w', 'y', 'h'], eps = 1e-6;
	const items = D.elements.filter(el => el.type !== 'border' && shownEl(el)).map(el => ({ el, b:aabb(el) })), plan = [];
	for (const { el, b } of items) {
		if (el.type !== 'text' || quarter(el.rot) !== 0) continue;
		const a0 = b[p], a1 = b[p] + b[d], extra = b[d] * (g - 1) / 2;
		let lo = Math.max(A[p], a0 - extra), hi = Math.min(A[p] + A[d], a1 + extra);
		for (const o of items) {
			const c = o.b, c0 = c[p], c1 = c[p] + c[d];
			if (o.el === el || c[q] >= b[q] + b[e] - eps || b[q] >= c[q] + c[e] - eps) continue;   // niet naast elkaar in deze as
			if (c1 <= a0 + eps) lo = Math.max(lo, (c1 + a0) / 2);
			else if (c0 >= a1 - eps) hi = Math.min(hi, (a1 + c0) / 2);
			else if (c0 <= a0 + eps && c1 >= a1 - eps && o.el.type === 'shape' && o.el.shape === 'rect' && quarter(o.el.rot) === 0) {
				const r = Math.min(o.el.radius || 0, c[d] / 2);
				lo = Math.max(lo, c0 + r); hi = Math.min(hi, c1 - r);
			} else { lo = a0; hi = a1; }
		}
		plan.push([el, Math.min(lo, a0), Math.max(hi, a1)]);
	}
	// Begin omhoog en maat omlaag afronden: twee teksten die tot dezelfde halve tussenruimte groeien raken elkaar niet.
	for (const [el, lo, hi] of plan) { el[p] = cl3(lo); el[d] = fl3(hi - el[p]); }
}

// Strak-tegen-de-rand-randen terugzetten kan alleen bij rekbare, rechte elementen (balk = tekst of rechthoek, of een code).
const SNAP = .15, stretchy = el => (el.type === 'text' || el.type === 'barcode' || (el.type === 'shape' && el.shape === 'rect')) && quarter(el.rot) === 0;
// Template op een andere labelmaat: de ingestelde rol is leidend (zoals pro-apps). Het binnenvlak van het template gaat
// uniform geschaald (min(sx, sy)) en gecentreerd naar het binnenvlak van het doel (printbaar vlak + layout.margin); de
// marge zelf schaalt dus niet mee. Ronde templates vullen hun hele vierkant, dus daar telt het vierkant, niet de
// ingeschreven rechthoek. Randen worden een kader (label min 1 mm), rond-masker vervalt op een rechthoekig label.
// opts.print = de printinstellingen van de gebruiker: het printbare vlak (X-verschuiving, 180°) is dat van JOUW printer.
export function adaptTemplate(tdoc, label, { print } = {}) {
	const D = normalizeTemplateDoc(tdoc), L0 = { ...D.label }, P0 = printableArea(D), T = print && typeof print === 'object' ? fill(PRINT, print) : D.print;
	const L = { w:pos(label?.w) ? r3(Math.min(label.w, LABEL_MAX.w)) : L0.w, h:pos(label?.h) ? r3(Math.min(label.h, LABEL_MAX.h)) : L0.h, shape:label?.shape === 'round' ? 'round' : 'rect' };
	// Zelfde maat maar ander printbaar vlak (180 graden, X-verschuiving op 48/50 mm): dan wel schuiven.
	const P1 = printableArea({ label:L, print:T });
	if (near(L.w, L0.w) && near(L.h, L0.h) && L.shape === (L0.shape === 'round' ? 'round' : 'rect') && near(P1.x, P0.x) && near(P1.w, P0.w)) { D.print = T; return D; }
	const A0 = innerArea({ ...D, label:{ ...L0, shape:'rect' } }), content = D.elements.filter(el => el.type !== 'border');
	// Het kader (grootste rand om het label) en wat er strak tegenaan lag (balken, blokken; ook tegen de papierrand): die
	// randen liggen na het schalen weer strak, anders zweeft zo'n balk los of steekt hij over het kader.
	const fb = D.elements.filter(b => b.type === 'border' && !b.hidden && b.w >= P0.w * .7 && b.h >= P0.h * .7).sort((a, b) => b.w * b.h - a.w * a.h)[0];
	const F0 = fb && { x:fb.x, y:fb.y, w:fb.w, h:fb.h }, R0 = [F0, P0].filter(Boolean);
	const gaps = (b, R) => [b.x - R.x, b.y - R.y, R.x + R.w - b.x - b.w, R.y + R.h - b.y - b.h].map(v => Math.abs(v) < SNAP ? v : null);
	const snaps = content.filter(stretchy).map(el => [el, R0.map(R => gaps(aabb(el), R))]).filter(([, s]) => s.flat().some(v => v !== null));
	// Lag alle inhoud binnen het kader, dan blijft hij daar binnen; anders (bewust tot de papierrand) het printbare vlak.
	const G0 = content.length ? span(content) : null, inF = !!F0 && !!G0 && G0.x >= F0.x - SNAP && G0.y >= F0.y - SNAP && G0.x + G0.w <= F0.x + F0.w + SNAP && G0.y + G0.h <= F0.y + F0.h + SNAP;
	D.label = L; D.print = T;
	const P = printableArea(D);
	for (const b of D.elements) if (b.type === 'border') { b.rot = 0; frame(b, P); }
	const A = innerArea(D), sx = A.w / A0.w, sy = A.h / A0.h, k = Math.min(sx, sy), R = [fb, P].filter(Boolean), C = inF ? fb : P;
	for (const el of content) scaleEl(el, k, k, k, mid(A0), mid(A));
	if (!content.length) return D;
	// Inhoud die in het template al buiten het binnenvlak stak: als groep terug binnen het kader/printbare vlak (alleen verkleinen).
	keepIn(content, C);
	const g = Math.max(sx, sy) / k;
	if (g > 1.01) growTexts(D, A, sx > sy ? 'x' : 'y', g);
	for (const [el, s] of snaps) {
		const e = [el.x, el.y, el.x + el.w, el.y + el.h];
		for (let i = 0; i < 4; i++) {
			const j = s.findIndex(v => v[i] !== null);
			if (j < 0) continue;
			const Q = R[j], d = Math.max(0, s[j][i]);   // nooit over het kader/de papierrand (bron-afronding van -0,001 mm)
			e[i] = [Q.x + d, Q.y + d, Q.x + Q.w - d, Q.y + Q.h - d][i];
		}
		if (e[2] - e[0] > .5 && e[3] - e[1] > .5) Object.assign(el, { x:r3(e[0]), y:r3(e[1]), w:fl3(e[2] - e[0]), h:fl3(e[3] - e[1]) });
	}
	return D;
}

// "Slim plaatsen": midden van het binnenvlak, en is dat bezet dan de grootste vrije strook.
// MIN_AREA: een strook die het element kleiner dan ~half (lineair) maakt dan in het midden telt niet; anders 4 mm-iconen.
// MIN_H: ondergrens per type (x labelhoogte, tekst = 1 regel van 3 mm); een foto van 8 mm is ruis op 203 dpi.
// Foto mag tot 80% hoog (zoals de ui hem aanmaakt), de rest tot PLACE_H.
const PLACE_H = .45, PAD = 1, MIN_SIDE = 2, MIN_AREA = .25, MIN_H = { image:.6 }, MIN_REL = .25, MIN_TEXT = 3, IMG_H = .8, ROOM_K = .4;
function sizeIn(el, R, maxH) {
	if (el.type === 'text') return { w:fl3(R.w), h:fl3(Math.min(R.h, maxH, String(el.text).split('\n').length * el.size * el.lineHeight)) };
	const r = el.w > 0 && el.h > 0 ? el.w / el.h : 1;
	// Eigen verhouding houden (ook barcode/vorm): een smalle strook geeft anders een platgedrukte code.
	let h = Math.min(maxH, R.h), w = h * r;
	if (w > R.w) { w = R.w; h = w / r; }
	return { w:fl3(w), h:fl3(h) };
}
// Vrije stukken van [lo, hi] buiten de bezette intervallen.
function freeSpans(lo, hi, spans) {
	const out = [];
	let at = lo;
	for (const [a, b] of spans.sort((u, v) => u[0] - v[0])) { if (a > at) out.push([at, Math.min(a, hi)]); at = Math.max(at, b); }
	if (hi > at) out.push([at, hi]);
	return out.filter(([a, b]) => b - a > 1e-6);
}
// Vrije stroken in A naast de bezette boxen (met PAD): eerst rijen over de volle breedte, dan kolommen over de volle hoogte.
const strips = (A, occ) => [['y', 'h'], ['x', 'w']].flatMap(([p, d]) => freeSpans(A[p], A[p] + A[d], occ.map(b => [b[p] - PAD, b[p] + b[d] + PAD]))
	.map(([lo, hi]) => p === 'y' ? { x:A.x, w:A.w, y:lo, h:hi - lo } : { x:lo, w:hi - lo, y:A.y, h:A.h }));
// Maximale hoogte bij plaatsen (slim plaatsen en neerzetten op een punt geven zo dezelfde maat).
const placeH = (el, doc) => labelOf(doc).h * (el.type === 'image' ? IMG_H : PLACE_H);
// Keuze-varianten (basis verborgen, een veldregel toont ze) horen bij de inhoud: anders schalen/plaatsen alleen de
// varianten die nu zichtbaar zijn mee en staan de andere opties straks scheef of onder een nieuw element.
const shownEl = e => !e.hidden || (e.rules || []).some(r => r.set?.hidden === false);
const hit = (a, b) => a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6;
// Groep uniform schalen (hooguit factor cap) en centreren in R; geeft de factor terug (0 = kan niet).
// G = wat R moet vullen (standaard de boxen, met meting de zichtbare inhoud).
function fitGroup(list, R, cap = Infinity, G = span(list)) {
	const k = Math.min(cap, G.w > 0 ? R.w / G.w : Infinity, G.h > 0 ? R.h / G.h : Infinity);
	if (!Number.isFinite(k)) return 0;
	for (const el of list) scaleEl(el, k, k, k, mid(G), mid(R));
	return k;
}
function smartPlace(el, doc, content, ext) {
	const A = innerArea(doc), L = labelOf(doc), maxH = placeH(el, doc);
	const at = R => { const z = sizeIn(el, R, maxH); return { ...z, x:R.x + (R.w - z.w) / 2, y:R.y + (R.h - z.h) / 2 }; };
	const occ = content.map(aabb).filter(b => hit(b, A));
	let best = at(A), room = null, alt = null;
	const vis = e => seen(e, ext) || aabb(e);
	const minArea = best.w * best.h * MIN_AREA, minH = Math.min(best.h, el.type === 'text' ? MIN_TEXT : L.h * (MIN_H[el.type] ?? MIN_REL));
	if (occ.some(b => hit(b, best))) {
		for (const S of strips(A, occ)) {
			const c = at(S);
			if (Math.min(c.w, c.h) >= MIN_SIDE && c.h >= minH - 1e-9 && c.w * c.h >= minArea && (!alt || c.w * c.h > alt.w * alt.h + 1e-9)) alt = c;
		}
		// Geen bruikbare strook: de inhoud maakt plaats; kan dat niet, dan toch in het midden (overlap) i.p.v. onleesbaar klein.
		best = alt || (room = makeRoom(content, A, best, at, vis)) || best;
	}
	Object.assign(el, { w:best.w, h:best.h, x:r3(best.x), y:r3(best.y) });
	if (el.type === 'text') el.fit = 'shrink';
	// Plaats gemaakt of in een vrije strook: nieuw element + de inhoud samen optisch midden op het label (anders blijft er aan
	// één kant wit over), de boxen binnen het binnenvlak. Vergrendeld in de buurt van een strook: niet schuiven (dan kan de rest
	// over het vergrendelde element schuiven).
	if (room || (alt && !content.some(e => e.locked))) shiftTo([el, ...content.filter(e => !e.locked)], printableArea(doc), 'both', vis, A);
}
// Op de maat die het in het midden zou krijgen, gecentreerd op punt p, binnen de marge.
function dropAt(el, doc, p) {
	const M = marginArea(doc), z = sizeIn(el, innerArea(doc), placeH(el, doc));
	Object.assign(el, { w:z.w, h:z.h, x:r3(clamp(p.x - z.w / 2, M.x, M.x + M.w - z.w)), y:r3(clamp(p.y - z.h / 2, M.y, M.y + M.h - z.h)) });
	if (el.type === 'text') el.fit = 'shrink';
}
// Nieuw element links of boven op zijn eigen maat (max de helft van het vlak), de bestaande inhoud als groep verkleind
// (nooit vergroot) in de rest: naast of onder elkaar, waar beide het grootst blijven. Vergrendeld in de weg, of de kleinste
// van de twee onder ROOM_K = null (dan liever overlap dan alles onleesbaar klein).
// vis = zichtbare inhoud: dwars op de splitsing komt die midden, zodat tekst en het nieuwe element optisch op één lijn staan.
function makeRoom(content, A, z0, at, vis = aabb) {
	if (content.some(e => e.locked && hit(aabb(e), A))) return null;
	// Vergrendeld buiten A (marge, rand-zone) blijft staan: niet meeschalen of -schuiven.
	content = content.filter(e => !e.locked);
	const G = span(content);
	let pick = null;
	for (const [p, d] of [['x', 'w'], ['y', 'h']]) {
		const S = { ...A, [d]:Math.min(z0[d], A[d] / 2) }, z = at(S), R = { ...A, [p]:A[p] + S[d] + PAD, [d]:A[d] - S[d] - PAD };
		const k = Math.min(1, R.w / G.w, R.h / G.h), score = Math.min(z.w / z0.w, z.h / z0.h, k);
		if (R[d] > 0 && (!pick || score > pick.score + 1e-9)) pick = { score, z, R, cross:p === 'x' ? 'v' : 'h' };
	}
	if (!pick || pick.score < ROOM_K) return null;
	fitGroup(content, pick.R, 1);
	shiftTo(content, pick.R, pick.cross, vis, A);
	return pick.z;
}

// Netjes maken (zie store.tidy). Tekst met {tokens} houdt zijn vak: zijn inhoud wisselt per veldwaarde/CSV-rij, een vak
// om de huidige waarde maakt elke langere waarde kleiner.
const fixedText = el => !(el.type === 'text' && TOKEN.test(el.text));
function tidyDoc(D, ext) {
	const P = printableArea(D);
	for (const b of D.elements) if (b.type === 'border' && !b.locked) frame(b, P);
	const shown = D.elements.filter(e => e.type !== 'border' && shownEl(e)), list = shown.filter(e => !e.locked), ink = new Map();
	if (!list.length) return;
	for (const el of list) {
		// Vak om de inhoud kan alleen rechtop (verticale tekst heeft geen regelbox om naartoe te krimpen).
		const e = (el.type === 'text' || el.type === 'image') && fixedText(el) && !((el.rot || 0) % 360) && !el.vertical ? seen(el, ext) : null;
		if (e) { hug(el, e, ext); ink.set(el, e); }
		else if (el.type === 'text' && el.fit === 'none') el.fit = 'shrink';
	}
	const A0 = innerArea(D), G = span(list, e => ink.get(e) || aabb(e)), B = span(list), g = mid(G);
	// Grootste schaal waarbij de boxen (een vak houdt zijn onderstok-ruimte) met de inkt midden in R nog op het label staan;
	// anders hangt het onderste vak over de labelrand en zijn zijn grepen onbereikbaar.
	const cap = R => { const M = mid(R); return Math.min(...[[P.x + P.w - M.x, B.x + B.w - g.x], [M.x - P.x, g.x - B.x], [P.y + P.h - M.y, B.y + B.h - g.y], [M.y - P.y, g.y - B.y]].map(([n, d]) => d > 1e-6 ? n / d : Infinity)); };
	const kIn = R => Math.min(G.w > 0 ? R.w / G.w : Infinity, G.h > 0 ? R.h / G.h : Infinity, cap(R));
	// Vergrendelde elementen zijn obstakels: de groep gaat in de vrije strook ernaast waarin hij het grootst wordt
	// (zoals slim plaatsen); geen bruikbare strook = toch het hele binnenvlak.
	const occ = shown.filter(e => e.locked).map(aabb).filter(b => hit(b, A0));
	let A = A0, best = 0;
	if (occ.length) for (const R of strips(A0, occ)) {
		const k = kIn(R);
		if (Number.isFinite(k) && k > best) { best = k; A = R; }
	}
	fitGroup(list, A, cap(A), G);
	// Na het schalen opnieuw meten: krimpen/vullen op hele dots schaalt de inhoud niet lineair (gemeten 0,5 mm uit het midden).
	if (ink.size) shiftTo(list, A, 'both', e => (fixedText(e) && seen(e, ext)) || aabb(e), P);
}
// Presetrijen houden hun vakmaten; lege gaten sluiten zonder tekst of iconen op te rekken.
function reflowPreset(D) {
	const list = D.elements.filter(e => e.type !== 'border' && shownEl(e));
	// Vrij geplaatste rotaties en vergrendelde inhoud zijn geen automatisch te verplaatsen raster.
	if (!list.length || list.some(e => e.locked || e.rot)) return;
	const groups = (items, axis, size) => {
		const out = [];
		for (const e of [...items].sort((a, b) => a[axis] - b[axis])) {
			let row = out.at(-1);
			if (!row || e[axis] > row.end + 0.01) out.push(row = { items: [], start: e[axis], end: e[axis] + e[size] });
			row.items.push(e); row.end = Math.max(row.end, e[axis] + e[size]);
		}
		return out;
	};
	const A = innerArea(D), rows = groups(list, 'y', 'h');
	for (const row of rows) {
		const cols = groups(row.items, 'x', 'w');
		const gap = Math.min(1.5, ...cols.slice(1).map((c, i) => c.start - cols[i].end));
		const width = cols.reduce((n, c) => n + c.end - c.start, 0) + (cols.length - 1) * (Number.isFinite(gap) ? gap : 0);
		let x = A.x + (A.w - width) / 2;
		for (const col of cols) {
			for (const e of col.items) e.x = r3(e.x + x - col.start);
			x += col.end - col.start + gap;
		}
	}
	const gap = Math.min(1.5, ...rows.slice(1).map((r, i) => r.start - rows[i].end));
	const height = rows.reduce((n, r) => n + r.end - r.start, 0) + (rows.length - 1) * (Number.isFinite(gap) ? gap : 0);
	let y = A.y + (A.h - height) / 2;
	for (const row of rows) {
		for (const e of row.items) e.y = r3(e.y + y - row.start);
		y += row.end - row.start + gap;
	}
}
// Verschil binnen TIDY_EPS (mm) = al netjes.
const TIDY_EPS = 1 / DPM, close = (a, b) => Object.keys(a).every(k => typeof a[k] === 'number' ? Math.abs(a[k] - b[k]) <= TIDY_EPS : a[k] === b[k] || JSON.stringify(a[k]) === JSON.stringify(b[k]));

const CUR = 'pm110.v2.current', TPL = 'pm110.v2.templates', V1_CUR = 'pm110.current', V1_TPL = 'pm110.templates', ROLLS = 'pm110.v2.rolls';
const MAX_HIST = 100, GROUP_MS = 1000;

// Veld-keys: a-z0-9, uniek, en niet de ingebouwde velden (een tekstveld 'datum' zou {datum} elders overnemen).
const BUILTIN = new Set(['datum', 'tijd', 'teller']);
function freeKey(doc, base) {
	const b = (base || '').normalize('NFD').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'veld', taken = new Set(doc.fields.map(f => f.key));
	let key = b;
	for (let n = 2; taken.has(key) || BUILTIN.has(key); n++) key = b + n;
	return key;
}
// Veldlabel in het formulier: eerste regel tot ':' of max 16 tekens op een woordgrens, zonder leestekens aan het eind.
function shortLabel(t) {
	let s = (String(t ?? '').split('\n').map(l => l.trim()).find(Boolean) || '').split(':')[0].trim();
	if (s.length > 16) s = s.slice(0, 17).match(/^(.*\S)\s/)?.[1] || s.slice(0, 16);
	return s.replace(/[\s.,;:!?…\-–—/(]+$/u, '');
}
// Veld weg: een datum van vandaag blijft dynamisch ({datum+N}), de rest wordt de huidige waarde; een filter ({x|wifi})
// blijft op het token staan of wordt meteen op de waarde toegepast.
const tokenBack = (f, flt, fields, row) => f.type === 'date' && !f.value && fieldCol(row, f, fields) === undefined
	? `{datum${f.offset ? (f.offset > 0 ? '+' : '-') + Math.abs(f.offset) : ''}${flt}}` : substitute(`{${f.key}${flt}}`, { fields, row });

// persist:false = geïsoleerde store voor selftest (raakt de echte opslag en het echte document niet).
function makeStore(persist = true) {
	const ev = {};
	let hist = [], idx = -1, group = null, groupT = 0, clip = null, clipText = '', listening = false, extentFn = null, base = null, tidied = null;
	const emit = (name, detail) => { for (const fn of [...(ev[name] || [])]) try { fn(detail); } catch (e) { console.error(e); } };
	// Opslag vol (grote foto's): melden via 'saveerror', anders is het werk na herladen stil weg.
	let saveOk = true;
	const save = persist ? debounce(() => { const ok = store(CUR, s.doc); if (!ok && saveOk) emit('saveerror'); saveOk = ok; }, 300) : () => {};
	const snap = () => dup(s.doc);
	const push = () => {
		hist.splice(idx + 1); hist.push(snap());
		if (hist.length > MAX_HIST + 1) hist.shift();
		idx = hist.length - 1;
		emit('history');
	};
	const reset = () => { hist = [snap()]; idx = 0; group = null; emit('history'); };
	const idSet = x => new Set(x == null ? [] : Array.isArray(x) ? x : [x]);
	const els = x => { const set = idSet(x); return s.doc.elements.filter(e => set.has(e.id)); };
	const has = id => s.doc.elements.some(e => e.id === id);
	const prune = () => { const n = s.selection.length; s.selection = s.selection.filter(has); if (s.selection.length !== n) emit('select'); };
	const order = () => s.doc.elements.map(e => e.id).join();
	const reorderWith = fn => { const E = s.doc.elements, before = order(); fn(E); if (order() !== before) s.changed(); };
	const restore = () => { s.doc = dup(hist[idx]); group = null; save(); emit('change', { undo:true }); emit('history'); prune(); };
	// Eén undo-stap per layout-operatie, en geen lege stap als er niets veranderde.
	const mutate = fn => { const key = () => JSON.stringify([s.doc.label, s.doc.elements]), before = key(); fn(s.doc); if (key() !== before) s.changed(); };
	const complete = el => Object.keys(ELEMENT_DEFAULTS[el.type]).every(k => k in el);

	const s = {
		doc: null,
		selection: [],
		init() {
			let doc = persist ? load(CUR) : null;
			if (doc) doc = migrate(doc);
			else if (persist && (doc = load(V1_CUR))) { doc = migrate(doc); store(CUR, doc); }
			s.doc = doc || newDoc(persist ? undefined : LABEL);
			s.selection = [];
			reset();
			if (persist && !listening && typeof addEventListener === 'function') {
				listening = true;
				// Einde van een sleep-/slider-gebaar sluit de coalesce-groep: twee sleepacties = twee undo-stappen.
				for (const t of ['pointerup', 'pointercancel']) addEventListener(t, () => { group = null; }, true);
				// Mislukte save (opslag vol) heeft geen timer meer: bij sluiten opnieuw proberen, misschien is er nu ruimte.
				const last = () => { if (!saveOk) save(); save.flush(); };
				addEventListener('pagehide', last);
				// Lukt ook die laatste poging niet: vragen voor sluiten. De melding was er maar 1x, daarna faalde bewaren stil.
				addEventListener('beforeunload', e => { last(); if (!saveOk) e.preventDefault(); });
				// Tweede venster schreef het label: overnemen (Ctrl+Z zet het vorige terug), anders overschrijft dit venster dat werk stil.
				// Een reeks overnames = 1 undo-stap: elke stap hield anders een eigen kopie van de foto vast.
				addEventListener('storage', e => { if (e.key === CUR && e.newValue) s.replace(e.newValue, { coalesce:'sync' }); });
				addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') last(); });
			}
			emit('doc'); emit('select');
			return s;
		},
		changed({ history = true, coalesce = null } = {}) {
			if (!s.doc) return;
			save();
			if (history) {
				const now = Date.now();
				if (coalesce && coalesce === group && idx === hist.length - 1 && now - groupT < GROUP_MS) { hist[idx] = snap(); emit('history'); }
				else push();
				group = coalesce; groupT = now;
			}
			emit('change');
		},
		// Sessiestaat buiten de undo (teller na printen, voorbeeldrij): ook in elke snapshot zetten, anders zet Ctrl+Z
		// de teller terug en print je dezelfde nummers opnieuw.
		session(fn) {
			if (!s.doc) return;
			fn(s.doc);
			for (const h of hist) fn(h);
			save();
			emit('change');
		},
		replace(doc, { history = true, coalesce = null } = {}) {
			s.doc = migrate(doc);
			// Overname uit een ander venster: selectie houden (geen nieuw label), anders sprong dit venster bij elke wijziging weg.
			s.selection = coalesce === 'sync' ? s.selection.filter(has) : [];
			if (!history || !hist.length) reset();
			else if (coalesce && coalesce === group && idx === hist.length - 1) { hist[idx] = snap(); emit('history'); }
			else push();
			group = coalesce;
			// Overname staat al in de opslag: terugschrijven kost een volle kopie en kan het nieuwere werk van het andere venster overschrijven.
			if (coalesce !== 'sync') save();
			emit('doc', { sync: coalesce === 'sync' }); emit('select');
		},
		select(x) {
			group = null;
			const sel = [...idSet(x)].filter(id => s.doc && has(id));
			if (sel.join() === s.selection.join()) return;
			s.selection = sel;
			emit('select');
		},
		selected: () => s.selection.map(id => s.doc.elements.find(e => e.id === id)).filter(Boolean),
		undo() { if (idx > 0) { idx--; restore(); } },
		redo() { if (idx < hist.length - 1) { idx++; restore(); } },
		canUndo: () => idx > 0,
		canRedo: () => idx < hist.length - 1,
		on(name, fn) { (ev[name] ||= new Set()).add(fn); return () => ev[name].delete(fn); },

		add(el) {
			if (!el || !known(el.type)) return null;
			// Half element (zonder alle velden) alsnog via createElement, zodat render nooit gaten ziet.
			if (!complete(el)) el = createElement(el.type, el, s.doc);
			if (!el.id || has(el.id)) el.id = uid();
			s.doc.elements.push(el);
			s.selection = [el.id]; emit('select');
			s.changed();
			return el;
		},
		// Vergrendeld blijft staan (SPEC-wave4: locked niet muteren), zoals de minibalk: Ctrl+A + Delete wist geen achtergrondkader.
		remove(x) {
			const set = idSet(x), E = s.doc.elements, n = E.length;
			E.splice(0, n, ...E.filter(e => !set.has(e.id) || e.locked));
			if (E.length === n) return;
			if (s.doc.fields.length) reflowPreset(s.doc);
			prune();
			s.changed();
		},
		duplicate(x) {
			const E = s.doc.elements, src = els(x), out = [];
			for (const el of src.reverse()) { const c = cloneElement(el, s.doc); E.splice(E.indexOf(el) + 1, 0, c); out.unshift(c); }
			if (!out.length) return [];
			s.selection = out.map(e => e.id); emit('select');
			s.changed();
			return out;
		},
		reorder(id, toIndex) {
			reorderWith(E => { const i = E.findIndex(e => e.id === id); if (i >= 0) E.splice(clamp(toIndex | 0, 0, E.length - 1), 0, ...E.splice(i, 1)); });
		},
		bringToFront(x) { const set = idSet(x); reorderWith(E => E.splice(0, E.length, ...E.filter(e => !set.has(e.id)), ...E.filter(e => set.has(e.id)))); },
		sendToBack(x) { const set = idSet(x); reorderWith(E => E.splice(0, E.length, ...E.filter(e => set.has(e.id)), ...E.filter(e => !set.has(e.id)))); },
		forward(x) {
			const set = idSet(x);
			reorderWith(E => { for (let i = E.length - 2; i >= 0; i--) if (set.has(E[i].id) && !set.has(E[i + 1].id)) [E[i], E[i + 1]] = [E[i + 1], E[i]]; });
		},
		backward(x) {
			const set = idSet(x);
			reorderWith(E => { for (let i = 1; i < E.length; i++) if (set.has(E[i].id) && !set.has(E[i - 1].id)) [E[i], E[i - 1]] = [E[i - 1], E[i]]; });
		},
		// Uitlijnen op de zichtbare (geroteerde) omhullende; vergrendelde elementen blijven staan maar tellen mee als anker.
		align(x, how, to) {
			const list = els(x);
			if (!list.length) return;
			to ||= list.length > 1 ? 'selection' : 'label';
			const bbs = list.map(aabb);
			// Op het printbare vlak, zoals Centreren: 'rechts' op een 50 mm-label viel anders voorbij de 48 mm-kop.
			const ref = to === 'selection' ? span(list) : printableArea(s.doc);
			let moved = false;
			list.forEach((el, i) => {
				const b = bbs[i];
				const dx = how === 'left' ? ref.x - b.x : how === 'right' ? ref.x + ref.w - b.x - b.w : how === 'hcenter' ? ref.x + (ref.w - b.w) / 2 - b.x : 0;
				const dy = how === 'top' ? ref.y - b.y : how === 'bottom' ? ref.y + ref.h - b.y - b.h : how === 'vcenter' ? ref.y + (ref.h - b.h) / 2 - b.y : 0;
				if (el.locked || (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9)) return;
				el.x = r3(el.x + dx); el.y = r3(el.y + dy); moved = true;
			});
			if (moved) s.changed();
		},
		// Gelijke tussenruimte tussen de buitenste twee; minstens 3 elementen nodig. Een rand (Ctrl+A) is kader, geen inhoud.
		distribute(x, axis = 'h') {
			const list = els(x).filter(e => e.type !== 'border');
			if (list.length < 3) return;
			const [p, d] = axis === 'v' ? ['y', 'h'] : ['x', 'w'];
			const items = list.map(el => ({ el, b:aabb(el) })).sort((a, b) => a.b[p] - b.b[p]);
			const first = items[0].b, last = items.at(-1).b;
			const gap = (last[p] + last[d] - first[p] - items.reduce((t, it) => t + it.b[d], 0)) / (items.length - 1);
			let at = first[p] + first[d] + gap, moved = false;
			for (const { el, b } of items.slice(1, -1)) {
				const delta = at - b[p];
				if (!el.locked && Math.abs(delta) > 1e-9) { el[p] = r3(el[p] + delta); moved = true; }
				at += b[d] + gap;
			}
			if (moved) s.changed();
		},
		// Geeft tekst voor het OS-klembord: zonder bleef een eerder geplakte afbeelding daar staan en won die bij Ctrl+V.
		copy(x) {
			const list = els(x), t = list.map(e => e.text || e.data || e.char || e.name || e.type).join('\n');
			if (list.length) {
				const keys = new Set(list.flatMap(e => [...(e.rules || []).map(r => r.field),
					...[e.text, e.data].flatMap(v => [...String(v ?? '').matchAll(/\{([^{}|]+)(?:\|[^{}]*)?\}/g)].map(m => keyOf(m[1])))]));
				clip = JSON.stringify({ elements:list, fields:s.doc.fields.filter(f => keys.has(f.key)) }); clipText = t;
			}
			return t;
		},
		canPaste: () => !!clip,
		// Andere tekst op het OS-klembord dan onze laatste kopie = daarna elders gekopieerd: die wint (Windows maakt van \n soms \r\n).
		newerClip: t => !!t && t.replace(/\r\n/g, '\n') !== clipText,
		paste() {
			if (!clip) return [];
			const saved = JSON.parse(clip), out = saved.elements.map(e => cloneElement(e, s.doc)), renamed = new Map();
			// Een ander label mist deze velden, of gebruikt dezelfde key voor een andere waarde.
			for (const f of saved.fields) {
				const old = s.doc.fields.find(v => v.key === f.key);
				if (old && JSON.stringify(old) === JSON.stringify(f)) continue;
				const key = old ? freeKey({ fields:[...s.doc.fields, ...saved.fields] }, f.key) : f.key;
				renamed.set(f.key, key); f.key = key; s.doc.fields.push(dup(f));
			}
			for (const el of out) {
				for (const p of ['text', 'data']) if (typeof el[p] === 'string') el[p] = el[p].replace(/\{([^{}|]+)((?:\|[^{}]*)?)\}/g,
					(m, k, filter) => renamed.has(keyOf(k)) ? `{${renamed.get(keyOf(k))}${filter}}` : m);
				for (const r of el.rules || []) r.field = renamed.get(r.field) || r.field;
			}
			s.doc.elements.push(...out);
			// Volgende plak schuift weer 2 mm op.
			clip = JSON.stringify({ elements:out, fields:saved.fields });
			s.selection = out.map(e => e.id); emit('select');
			s.changed();
			return out;
		},

		// fn(el) -> zichtbare inhoud {x,y,w,h} in mm (main: render.contentBox); null = weer op de boxen.
		setExtent(fn) { extentFn = typeof fn === 'function' ? fn : null; tidied = null; },
		// Layout-operaties rekenen in het printbare vlak (48 mm-kop); vergrendelde elementen blijven staan.
		// Eén element: in het vlak, en tekst ook in zijn vak (anders beweegt er bij een vol tekstvak niets). Meer elementen:
		// als groep, zodat de onderlinge opmaak blijft; vergrendelde blijven staan en tellen niet mee.
		// Met meting telt de zichtbare inhoud: tekst zonder onderstokken staat dan optisch midden i.p.v. zijn regelbox.
		// Een rand in de selectie (Ctrl+A) blijft kader: anders was hij de groep en bewoog er niets. Alleen randen = die centreren.
		center(x, axis = 'both') {
			const vis = e => seen(e, extentFn) || aabb(e);
			mutate(D => {
				const P = printableArea(D), all = els(x).filter(e => !e.locked), rest = all.filter(e => e.type !== 'border'), list = rest.length ? rest : all;
				if (list.length > 1) return shiftTo(list, P, axis, vis);
				for (const el of list) {
					if (el.type === 'text') { if (axis !== 'v') el.align = 'center'; if (axis !== 'h') el.valign = 'middle'; }
					centerIn(el, P, axis, vis(el));
				}
			});
		},
		// Meer elementen: elk apart vullen legde ze allemaal over elkaar. Randen blijven een kader, de rest gaat erbinnen als groep.
		fill(x) {
			mutate(D => {
				const list = els(x).filter(e => !e.locked), rest = list.filter(e => e.type !== 'border');
				if (rest.length < 2) return list.forEach(el => fillEl(el, D));
				for (const el of list) if (el.type === 'border') fillEl(el, D);
				fitGroup(rest, innerArea(D));
			});
		},
		// Netjes maken: randen als kader, de rest als groep uniform schalen tot het binnenvlak vol is (verborgen blijft staan).
		// Met meting (setExtent; de ui meet met render) gaan vakken eerst om hun zichtbare inhoud, zodat telt wat je ziet. Zonder meting krimpt overlopende tekst (fit 'none') in zijn vak, anders hangt hij er na het
		// schalen nog verder uit.
		// De groep vult het vlak op zijn zichtbare inhoud (zonder de lege onderstok-ruimte), de vakken liggen er strak omheen.
		tidy() {
			// Uitkomst van de vorige klik: render meet op hele dots, dus de lus komt niet altijd tot rust en een tweede klik
			// schoof nog tot 1 mm. Niets gewijzigd sinds de vorige keer = al netjes.
			if (JSON.stringify(s.doc) === tidied) return;
			mutate(D => {
				const before = dup(D.elements);
				if (D.fields.length) reflowPreset(D);
				// Meten en schalen tot het vast staat: na het schalen meet render net anders (hele dots, afbrekende tekst breekt
				// in het strakke vak anders), dan deed pas de volgende klik de rest. Hooguit 6 rondes, mocht het heen en weer gaan.
				for (let i = 0, prev = before; i < 6; i++) { tidyDoc(D, extentFn); if (D.elements.every((e, j) => close(e, prev[j]))) break; prev = dup(D.elements); }
				// Al netjes (alles binnen TIDY_EPS): niets veranderen, geen lege undo-stap.
				if (D.elements.every((e, i) => close(e, before[i]))) D.elements.forEach((e, i) => Object.assign(e, before[i]));
			});
			tidied = JSON.stringify(s.doc);
		},
		// Schaalt t.o.v. het printbare vlak, zodat inhoud na 40 -> 50 mm niet voorbij de 48 mm-kop schuift; met een kader van
		// kadervak naar kadervak (het kader blijft 1 mm van de rand), anders komt een balk strak tegen het kader los of steekt
		// hij erover. shape = vorm mee wisselen (zelfde undo-stap).
		resizeLabel(w, h, { scaleContent = s.doc.layout.autoTidy, shape = null } = {}) {
			if (!pos(w) || !pos(h)) return;
			// Schalen vanaf de maat vóór de eerste maatwijziging: met k = min(sx, sy) kromp alles anders bij elke heen-en-terug.
			// Alleen geometrie terug (rehydrate vult iconen zonder history); elke andere wijziging = nieuwe history-stap = nieuwe basis.
			if (base?.at !== hist[idx]) base = { w:s.doc.label.w, h:s.doc.label.h, els:s.doc.elements.map(geo) };
			mutate(D => {
				Object.assign(D.label, { w:base.w, h:base.h });
				D.elements.forEach((el, i) => Object.assign(el, base.els[i]));
				const L0 = { ...D.label }, P0 = printableArea(D);
				const frames = new Set(D.elements.filter(e => e.type === 'border' && isFrame(e, P0, L0)));
				D.label.w = r3(w); D.label.h = r3(h);
				if (shape) D.label.shape = shape;
				const P = printableArea(D), [f] = frames, O0 = f ? { x:f.x, y:f.y, w:f.w, h:f.h } : P0;
				for (const b of frames) frame(b, P);
				const O = f || P, sx = O.w / O0.w, sy = O.h / O0.h;
				if (scaleContent) for (const el of D.elements) if (!frames.has(el)) scaleEl(el, sx, sy, Math.min(sx, sy), O0, O);
				// Rond: de hoeken van het vlak vallen buiten de sticker (de preview knipt ze weg, de print niet), zoals adaptTemplate.
				const content = D.elements.filter(e => e.type !== 'border');
				if (scaleContent && D.label.shape === 'round' && content.length) keepIn(content, marginArea(D));
			});
			base.at = hist[idx];
		},
		// Elk invoegen vanuit de ui: leeg label (alleen randen) -> vullen, anders slim plaatsen; daarna add + select.
		// at = drop-punt (mm): daar neerzetten; de rest maakt dan geen plaats (de gebruiker koos de plek zelf).
		place(el, at = null) {
			if (!el || !known(el.type)) return null;
			if (!complete(el)) el = createElement(el.type, el, s.doc);
			const content = s.doc.elements.filter(e => e.type !== 'border' && shownEl(e));
			// Lege foto-plek (template) = daar komt de foto, in plaats van een tweede foto erover; plek, fit en regels blijven.
			const spot = el.type === 'image' && el.src ? content.find(e => e.type === 'image' && !e.src && !e.locked) : null;
			if (spot) {
				for (const k of Object.keys(OWN.image)) if (k !== 'fit') spot[k] = dup(el[k]);
				s.selection = [spot.id]; emit('select');
				s.changed();
				return spot;
			}
			if (el.type === 'border' || !content.length) { fillEl(el, s.doc); centerSeen(el, s.doc, extentFn); }
			else if (Number.isFinite(at?.x) && Number.isFinite(at?.y)) dropAt(el, s.doc, at);
			else smartPlace(el, s.doc, content, extentFn);
			return s.add(el);
		},

		// --- invulvelden: het formulier zet alleen waarden; tikken in één veld = 1 undo-stap ---
		setField(key, value) {
			const f = s.doc.fields.find(x => x.key === key);
			if (!f) return false;
			const v = f.type === 'toggle' ? value : str(value);
			if (f.type === 'toggle' ? typeof v !== 'boolean' : f.type === 'choice' ? !f.options.includes(v) : f.type === 'date' && v !== '' && !parseDay(v)) return false;
			if (f.value !== v) { f.value = v; s.changed({ coalesce:'field:' + key }); }
			return true;
		},
		// Tekst van een element wordt een tekstveld; het element toont daarna {key}. Tekst met tokens niet (nesten kan niet).
		makeField(id) {
			const el = s.doc.elements.find(e => e.id === id);
			if (!el || el.type !== 'text' || TOKEN.test(el.text)) return null;
			const label = shortLabel(/^Tekst( \d+)?$/.test(el.name) ? '' : el.name) || shortLabel(el.text) || 'Veld';
			const f = { key:freeKey(s.doc, label), label, type:'text', value:el.text, placeholder:'' };
			s.doc.fields.push(f);
			el.text = `{${f.key}}`;
			s.changed();
			return f;
		},
		// Geselecteerde teksten = de opties; elke tekst (en een vorm om precies één optie-tekst) wordt zwart als zijn optie
		// gekozen is. Wat nu al omgekeerd staat, wordt de gekozen waarde, zodat het label er hetzelfde uitziet.
		makeChoice(x) {
			const list = els(x), texts = list.filter(e => e.type === 'text' && e.text.trim() && !TOKEN.test(e.text));
			const options = [...new Set(texts.map(e => e.text.trim()))];
			if (options.length < 2) return null;
			const key = freeKey(s.doc, 'keuze');
			const inside = el => { const b = aabb(el); return texts.filter(t => { const p = mid(aabb(t)); return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h; }); };
			const optOf = el => {
				if (el.type === 'text') return texts.includes(el) ? el.text.trim() : null;
				if (el.type !== 'shape') return null;
				// Vorm om meer opties = kader, geen chip (omgekeerd = zwart vlak onder zwarte optieteksten).
				const t = inside(el);
				return t.length === 1 ? t[0].text.trim() : null;
			};
			// Dezelfde groep nogmaals maken mag geen tweede veld met strijdige highlights toevoegen.
			const existing = s.doc.fields.find(f => f.type === 'choice' && options.length === f.options.length && options.every(o => f.options.includes(o))
				&& list.filter(el => optOf(el) !== null).every(el => el.rules.some(r => r.field === f.key && r.equals === optOf(el) && r.set.invert === true)));
			if (existing) return existing;
			// Ook een omgekeerde vorm om een optie telt als gekozen, anders springt de highlight naar de eerste optie.
			const f = { key, label:'Keuze', type:'choice', options, value:(h => h ? optOf(h) : options[0])(list.find(e => e.invert && optOf(e) !== null)) };
			const E = s.doc.elements;
			for (const el of list) {
				const o = optOf(el);
				if (o === null) continue;
				el.invert = false;
				// Bij uitbreiding bepaalt de nieuwe groep de highlight; oude verbergregels blijven intact.
				for (const r of el.rules) delete r.set.invert;
				el.rules = [...el.rules.filter(r => Object.keys(r.set).length), { field:key, equals:o, set:{ invert:true } }];
				// Omgekeerd = dicht zwart vlak: een vorm boven zijn tekst (eerst teksten, dan kaders = de gewone volgorde) wiste
				// de optietekst. De vorm gaat daarom net onder de laagste tekst die erin staat.
				if (el.type !== 'shape') continue;
				const lo = Math.min(...inside(el).map(t => E.indexOf(t))), i = E.indexOf(el);
				if (i > lo) E.splice(lo, 0, ...E.splice(i, 1));
			}
			s.doc.fields.push(f);
			s.changed();
			return f;
		},
		// De prullenbak verwijdert ook de gekoppelde tekst/code/keuzegroep; opheffen blijft een aparte actie.
		deleteField(key, parts = [], links = []) {
			const i = s.doc.fields.findIndex(f => f.key === key);
			if (i < 0) return false;
			const linked = el => [el.text, el.data].some(v => [...String(v ?? '').matchAll(/\{([^{}|]+)(?:\|[^{}]*)?\}/g)]
				.some(m => m[1].trim().toLowerCase() === key)) || el.rules.some(r => r.field === key);
			const extra = new Set(parts);
			const targets = new Set(s.doc.elements.filter(el => linked(el) || extra.has(el.id)));
			if ([...targets].some(el => el.locked)) return false;
			for (const link of links) {
				const el = s.doc.elements.find(e => e.id === link.id);
				if (el && !el.locked && !el.rules.length) el.rules = dup(link.rules);
			}
			s.doc.elements = s.doc.elements.filter(el => !targets.has(el));
			s.doc.fields.splice(i, 1);
			reflowPreset(s.doc);
			prune();
			s.changed();
			return true;
		},
		// Veld weg: tokens worden de huidige waarde en regels op dit veld worden vastgezet zoals ze nu uitpakken.
		removeField(key, row = null) {
			const F = s.doc.fields, i = F.findIndex(f => f.key === key);
			if (i < 0) return false;
			// De zichtbare lijstrij gaat voor de veldwaarde, ook bij regels en gefilterde tokens.
			const f = F[i], raw = fieldValues(F, row).raw;
			const back = (m, k) => { const j = k.indexOf('|'); return (j < 0 ? k : k.slice(0, j)).trim().toLowerCase() === key ? tokenBack(f, j < 0 ? '' : k.slice(j), F, row) : m; };
			for (const el of s.doc.elements) {
				for (const p of ['text', 'data']) if (typeof el[p] === 'string') el[p] = el[p].replace(/\{([^{}]+)\}/g, back);
				const kept = [];
				for (const r of el.rules) {
					if (r.field !== key) { kept.push(r); continue; }
					if (!ruleMatches(r, raw)) continue;
					for (const [k, v] of Object.entries(r.set)) {
						el[k] = v;
						// Deze vaste waarde won van eerdere regels; latere regels blijven hem kunnen overschrijven.
						for (const prev of kept) delete prev.set[k];
					}
				}
				el.rules = kept.filter(r => Object.keys(r.set).length);
			}
			F.splice(i, 1);
			s.changed();
			return true;
		},
	};
	return s;
}

// REGEL: lees altijd app.doc opnieuw (undo/laden vervangt het object). Muteer in place, roep dan changed().
export const app = makeStore(true);

// Eenmalig: v1-templates (platte v1-state) overnemen; de v1-key blijft staan.
function tplMap() {
	const t = load(TPL);
	if (t && typeof t === 'object') return t;
	const v1 = load(V1_TPL), out = {};
	if (!v1 || typeof v1 !== 'object') return out;
	for (const [name, d] of Object.entries(v1)) out[name] = { doc:migrate(d), updated:Date.now() };
	store(TPL, out);
	return out;
}

export const userTemplates = {
	list: () => Object.entries(tplMap()).filter(([, v]) => v && v.doc).map(([name, v]) => ({ name, doc:v.doc, updated:v.updated || 0 }))
		.sort((a, b) => a.name.localeCompare(b.name, 'nl')),
	save(name, doc) {
		name = String(name ?? '').trim();
		// '__proto__' op een gewoon object zet het prototype: niets opgeslagen maar wel 'gelukt'.
		if (!name || name === '__proto__') return false;
		const t = tplMap(), d = migrate(doc);
		// Zoals v1: CSV-data hoort niet bij het ontwerp.
		d.batch = { ...BATCH };
		t[name] = { doc:d, updated:Date.now() };
		return store(TPL, t);
	},
	remove(name) { const t = tplMap(); delete t[name]; return store(TPL, t); },
	exportJSON: doc => JSON.stringify(doc, null, 1),
	importJSON(text) {
		// Kapotte JSON = dezelfde Nederlandse melding, niet de Engelse parse-fout.
		let d = null;
		try { d = JSON.parse(text); } catch {}
		if (!d || typeof d !== 'object' || !Array.isArray(d.elements)) throw new Error('geen label-bestand');
		return migrate(d);
	},
};

// Mijn rollen (localStorage 'pm110.v2.rolls'): de eerste is de standaard waar een nieuw label op start. Lege of kapotte
// opslag = de rol van de speler; dubbele maten worden niet opnieuw toegevoegd.
const DEFAULT_ROLLS = [{ w:40, h:30, shape:'rect', name:'Wit 40×30' }];
function normRoll(r) {
	if (!r || !pos(r.w) || !pos(r.h) || r.w > LABEL_MAX.w || r.h > LABEL_MAX.h) return null;
	const w = r3(r.w), h = r3(r.h), shape = r.shape === 'round' ? 'round' : 'rect';
	return { w, h, shape, name:str(r.name).trim().slice(0, 40) || `${w}×${h}${shape === 'round' ? ' rond' : ''}` };
}
const rollList = () => { const l = load(ROLLS), out = (Array.isArray(l) ? l : []).map(normRoll).filter(Boolean); return out.length ? out : dup(DEFAULT_ROLLS); };
const sameRoll = (a, b) => a.w === b.w && a.h === b.h && a.shape === b.shape;
export const rolls = {
	list: rollList,
	add(roll) {
		const r = normRoll(roll), l = rollList();
		if (!r) return false;
		return l.some(x => sameRoll(x, r)) || store(ROLLS, [...l, r]);
	},
	// Minstens één rol: een lege lijst valt terug op de standaardrol, dan leek verwijderen te lukken maar kwam hij terug.
	remove(i) { const l = rollList(); if (!(i >= 0 && i < l.length) || l.length < 2) return false; l.splice(i, 1); return store(ROLLS, l); },
	setDefault(i) { const l = rollList(); if (!(i >= 0 && i < l.length)) return false; l.unshift(...l.splice(i, 1)); return store(ROLLS, l); },
};

// async: de opslag-vol-test wacht op de debounced save (alleen in node).
export async function selftest() {
	const details = [], res = [];
	const ok = (name, cond, info = '') => { details.push(`${cond ? 'ok' : 'FAIL'} ${name}${cond ? '' : ' ' + info}`); res.push(!!cond); };
	const J = JSON.stringify;
	const v1 = { w:40, h:30, density:12, speed:4, media:38, copies:2, rotate:true, offset:1.5, batch:'naam\nKaas', elements:[
		{ type:'text', text:'Regel 1\nRegel 2', font:'Georgia', size:5, bold:true, align:'left', x:2, y:3, id:'t1' },
		{ type:'text', text:'Midden', font:'Arial', size:4, bold:false, align:'center', x:3, y:10, id:'t2' },
		{ type:'text', text:'Rechts', font:'Arial', size:4, bold:false, align:'right', x:4, y:20, id:'t2' },
		{ type:'qr', text:'https://x.nl', size:20, x:2, y:2, id:'q' },
		{ type:'barcode', text:'012345678905', format:'UPC', w:36, h:12, showText:false, x:2, y:15, id:'b' },
		{ type:'image', src:'data:image/png;base64,AA', w:16, threshold:100, dither:false, invert:true, x:20, y:5, id:'i' },
		{ type:'onbekend', x:1 },
		{ type:'text', text:'oud', x:1, y:1 },
	] };

	// --- migratie ---
	const d = migrate(dup(v1)), E = d.elements, [t1, t2, t3, q, b, im, old] = E;
	ok('v1: versie/label/print/batch', d.v === 2 && J(d.label) === J({ w:40, h:30, shape:'rect' })
		&& J(d.print) === J({ density:12, speed:4, media:38, copies:2, rotate180:true, offset:1.5 })
		&& J(d.batch) === J({ csv:'naam\nKaas', row:1 }) && J(d.counter) === J(COUNTER), J(d));
	ok('v1: onbekend type weg', E.length === 7, E.length);
	ok('v1: tekst links', t1.x === 2 && t1.w === 38 && t1.y === 3 && t1.h === 11.5 && t1.align === 'left' && t1.font === 'Georgia' && t1.bold, J(t1));
	ok('v1: tekst midden (midden blijft op labelmidden + x)', t2.x === 6 && t2.w === 34 && t2.align === 'center' && t2.h === 4.6, J(t2));
	ok('v1: tekst rechts', t3.x === 0 && t3.w === 36 && t3.align === 'right', J(t3));
	ok('v1: dubbel id vervangen', new Set(E.map(e => e.id)).size === 7 && t2.id === 't2' && t3.id !== 't2');
	ok('v1: qr', q.data === 'https://x.nl' && q.w === 20 && q.h === 20 && q.symbology === 'qrcode' && q.ecc === 'M' && !('text' in q), J(q));
	ok('v1: barcode', b.symbology === 'upca' && b.data === '012345678905' && !b.showText && b.w === 36 && b.h === 12, J(b));
	ok('v1: afbeelding', im.h === 16 && im.w === 16 && im.mode === 'threshold' && im.threshold === 100 && im.invertImg && !im.invert, J(im));
	ok('v1: ontbrekende velden = v1-defaults', old.font === 'Arial' && old.bold === true && old.size === 5 && old.w === 39, J(old));
	ok('v1: gemeenschappelijke velden', E.every(e => e.rot === 0 && e.opacity === 1 && e.hidden === false && e.locked === false && e.name));
	ok('migrate is idempotent', J(migrate(d)) === J(d));
	const srcs = migrate({ v:2, elements:[{ type:'image', src:'https://tracker.example/x.png' }, { type:'image', src:'data:image/png;base64,AA' }, { type:'image', src:'blob:x' }] }).elements.map(e => e.src);
	const v1d = migrate({ w:40, h:30, elements:[{ type:'image', src:'data:image/png;base64,AA', dither:true, threshold:150 }] }).elements[0];
	ok('import: alleen ingebedde afbeeldingen (geen externe URL), v1-dither houdt de v1-toon (drempel 128)', J(srcs) === J(['', 'data:image/png;base64,AA', '']) && v1d.mode === 'floyd' && v1d.threshold === 128, J([srcs, v1d.threshold]));
	ok('migrate(null) = nieuw doc', (n => n.elements.length === 1 && n.elements[0].text === 'Mijn label' && n.v === 2)(migrate(null)));
	// golf 4: starttekst blijft in zijn vak en in het midden; naam hoort bij het doc
	ok('nieuw doc: starttekst krimpt, gecentreerd', (e => e.fit === 'shrink' && e.align === 'center' && e.valign === 'middle')(newDoc(LABEL).elements[0]));
	ok('naam: migreert mee, max 60, geen tekst = leeg', migrate({ v:2, name:'Potje', elements:[] }).name === 'Potje' && migrate({ v:2, name:{ x:1 } }).name === ''
		&& migrate({ v:2, name:'x'.repeat(80) }).name.length === 60 && newDoc(LABEL).name === '' && migrate(dup(v1)).name === '');
	const p = migrate({ v:2, label:{ w:30 }, elements:[{ type:'icon', id:'a', icon:'heart', x:'fout' }, { type:'x' }] });
	ok('v2: ontbrekend = defaults', p.label.h === 30 && p.label.shape === 'rect' && p.elements.length === 1
		&& p.elements[0].set === 'outline' && Array.isArray(p.elements[0].nodes) && p.elements[0].x === 9 && p.elements[0].w === 12 && p.print.speed === 5, J(p));
	const ka = migrate({ v:2, label:{ w:40, h:30, shape:'Round' }, elements:[{ type:'text', align:'constructor', valign:'__proto__' }, { type:'text', align:'justify', valign:'bottom' }] });
	ok('import: onbekende labelvorm = rect, onbekende uitlijning = links/boven (geen x = NaN)', ka.label.shape === 'rect' && migrate({ v:2, label:{ shape:'round' } }).label.shape === 'round'
		&& J(ka.elements.map(e => [e.align, e.valign])) === J([['left', 'top'], ['justify', 'bottom']]), J([ka.label, ka.elements.map(e => [e.align, e.valign])]));
	const tp = normalizeTemplateDoc({ label:{ w:50, h:30 }, elements:[{ type:'border', style:'double' }, { type:'text', text:'{datum}', x:2, y:2, w:20, h:6 }] });
	ok('template: ids + randbox (geklemd op 48 mm-kop)', tp.elements.length === 2 && tp.elements.every(e => e.id) && J(['x','y','w','h'].map(k => tp.elements[0][k])) === J([1, 1, 46, 28]), J(tp.elements[0]));

	// --- createElement ---
	const d30 = { label:{ w:30, h:20 }, elements:[] }, d40 = newDoc(LABEL);
	const bc = createElement('barcode', { x:100, y:-5 }, d30);
	ok('createElement: geklemd binnen marge', bc.w === 27 && bc.h === 12 && bc.x === 1.5 && bc.y === 1.5, J(bc));
	const tx = createElement('text', {}, d40);
	ok('createElement: midden + naam', tx.x === 5 && tx.y === 11 && tx.w === 30 && tx.h === 8 && tx.name === 'Tekst 2' && tx.id.length === 8, J(tx));
	ok('createElement: rand', (r => r.x === 1 && r.y === 1 && r.w === 38 && r.h === 28)(createElement('border', {}, d40)));
	ok('createElement: klem rechts', createElement('qr', { x:30 }, d40).x === 20.5);
	const cl = cloneElement(tx, d40);
	ok('cloneElement', cl.id !== tx.id && cl.x === 7 && cl.y === 13 && cl.text === tx.text);
	let pcl = createElement('icon', { x:26, y:16 }, d40);
	for (let i = 0; i < 8; i++) pcl = cloneElement(pcl, d40);
	ok('cloneElement: vaak plakken blijft minstens 1 mm op het label', pcl.x === 39 && pcl.y === 29, J([pcl.x, pcl.y]));
	let rcl = createElement('text', { x:5, y:10, w:30, h:4, rot:90 }, d40);
	for (let i = 0; i < 17; i++) rcl = cloneElement(rcl, d40);
	ok('cloneElement: gedraaid blijft op de omhullende minstens 1 mm op het label', (b => Math.abs(b.x - 39) < 1e-3 && Math.abs(b.y - 29) < 1e-3)(aabb(rcl)), J(aabb(rcl)));

	// --- store: undo/redo/coalesce/events ---
	const s = makeStore(false).init();
	let nChange = 0;
	const off = s.on('change', () => nChange++);
	const a = s.add(createElement('shape', { x:0, y:0, w:4, h:4 }, s.doc));
	ok('add selecteert', s.selection.length === 1 && s.selection[0] === a.id && s.selected()[0] === a);
	s.undo();
	ok('undo add', s.doc.elements.length === 1 && s.canRedo() && !s.canUndo() && s.selection.length === 0);
	s.redo();
	ok('redo add', s.doc.elements.length === 2 && s.doc.elements[1].id === a.id && !s.canRedo());
	const el = () => s.doc.elements.find(e => e.id === a.id);
	for (const x of [1, 2, 3]) { el().x = x; s.changed({ coalesce:'drag' }); }
	el().y = 5; s.changed({ coalesce:'slider' });
	s.select([a.id]);
	el().x = 9; s.changed({ coalesce:'slider' });
	s.undo();
	ok('coalesce: select breekt groep', el().x === 3 && el().y === 5, J(el()));
	s.undo();
	ok('coalesce: andere sleutel = eigen stap', el().x === 3 && el().y === 1.5, J(el()));
	s.undo();
	ok('coalesce: sleepreeks = 1 stap', el().x === 1.5, J(el()));
	ok('events: change geteld', nChange === 11, nChange);
	off(); s.changed(); ok('events: unsubscribe', nChange === 11);
	for (let i = 0; i < 150; i++) { el().x = i; s.changed(); }
	let undos = 0;
	while (s.canUndo()) { s.undo(); undos++; }
	ok('history max 100', undos === 100, undos);
	// Template laden / importeren / Nieuw = replace mét history: Ctrl+Z zet het vorige label terug.
	const rp = makeStore(false).init();
	rp.replace({ v:2, name:'A', elements:[{ type:'shape', id:'X' }] }); rp.select('X');
	const rA = J(rp.doc);
	rp.replace({ v:2, name:'B', elements:[] });
	const rSel = rp.selection.length; rp.undo(); const rU = J(rp.doc); rp.redo();
	ok('replace mét history: undo = vorige label, redo, selectie leeg', rSel === 0 && rU === rA && rp.doc.name === 'B' && rp.canUndo() && !rp.canRedo(), rU);
	// Overname uit een ander venster: selectie blijft (voor wat er nog is), 'doc' meldt sync.
	let dSync = null; const offD = rp.on('doc', d => { dSync = d?.sync; });
	rp.replace({ v:2, name:'C', elements:[{ type:'shape', id:'X' }, { type:'shape', id:'Y' }] }); rp.select(['X', 'Y']);
	rp.replace({ v:2, name:'C', elements:[{ type:'shape', id:'X' }] }, { coalesce:'sync' });
	ok('replace sync: selectie blijft, doc-event sync', rp.selection.join() === 'X' && dSync === true, J(rp.selection));
	rp.replace({ v:2, name:'D', elements:[{ type:'shape', id:'X' }] }); offD();
	ok('replace gewoon: selectie leeg, doc-event geen sync', rp.selection.length === 0 && dSync === false);

	// --- uitlijnen/verdelen/volgorde ---
	s.replace({ v:2, label:{ w:40, h:30 }, elements:[
		{ type:'shape', id:'A', x:0, y:0, w:4, h:4 }, { type:'shape', id:'B', x:10, y:5, w:6, h:4 }, { type:'shape', id:'C', x:30, y:10, w:4, h:4 },
		{ type:'shape', id:'D', x:10, y:10, w:10, h:4, rot:90 }, { type:'shape', id:'K', x:20, y:20, w:4, h:4, locked:true },
	] }, { history:false });
	const g = id => s.doc.elements.find(e => e.id === id), xs = ids => ids.map(id => g(id).x);
	s.distribute(['A', 'B', 'C'], 'h');
	ok('distribute h', J(xs(['A', 'B', 'C'])) === J([0, 14, 30]), J(xs(['A', 'B', 'C'])));
	s.distribute(['A', 'B', 'C'], 'v');
	ok('distribute v', g('B').y === 5, g('B').y);
	s.align(['A', 'B', 'C'], 'left', 'selection');
	ok('align left selectie', J(xs(['A', 'B', 'C'])) === J([0, 0, 0]));
	s.align(['A', 'B', 'C'], 'right', 'label');
	ok('align right label', J(xs(['A', 'B', 'C'])) === J([36, 34, 36]));
	s.align(['B'], 'hcenter'); s.align(['B'], 'vcenter');
	ok('align midden label (enkel)', g('B').x === 17 && g('B').y === 13, J(g('B')));
	s.align(['A', 'B', 'C'], 'bottom', 'selection');
	ok('align bottom selectie', g('A').y === 13 && g('B').y === 13 && g('C').y === 13);
	s.align(['D'], 'left', 'label');
	ok('align geroteerd op omhullende', g('D').x === -3 && g('D').y === 10, J(g('D')));
	s.align(['A', 'K'], 'top', 'selection');
	ok('align: vergrendeld blijft staan', g('K').y === 20 && g('A').y === 13);
	const ord = () => s.doc.elements.map(e => e.id).join('');
	s.bringToFront(['A']); const o1 = ord();
	s.sendToBack(['A']); const o2 = ord();
	s.forward(['A', 'B']); const o3 = ord();
	s.backward(['B']); const o4 = ord();
	s.reorder('K', 0); const o5 = ord();
	ok('volgorde', J([o1, o2, o3, o4, o5]) === J(['BCDKA', 'ABCDK', 'CABDK', 'CBADK', 'KCBAD']), J([o1, o2, o3, o4, o5]));
	const dups = s.duplicate(['C']);
	ok('duplicate na origineel + selectie', s.doc.elements.indexOf(g('C')) + 1 === s.doc.elements.indexOf(dups[0]) && dups[0].x === g('C').x + 2 && s.selection[0] === dups[0].id);
	const noClip = !makeStore(false).init().canPaste();
	const cTxt = s.copy(['B']), p1 = s.paste(), p2 = s.paste();
	ok('canPaste: pas na kopieren', noClip && s.canPaste() && cTxt === TYPE_NAMES.shape && s.copy([]) === '', cTxt);
	ok('copy/paste schuift op', p1[0].x === g('B').x + 2 && p2[0].x === g('B').x + 4 && p1[0].id !== p2[0].id && s.doc.elements.at(-1) === p2[0]);
	const mTxt = s.copy(['B', 'C']);
	ok('plakken: elders gekopieerde tekst wint, eigen kopie (ook CRLF) of leeg niet', mTxt.includes('\n') && !s.newerClip(mTxt.replace(/\n/g, '\r\n')) && !s.newerClip('') && !s.newerClip(undefined) && s.newerClip('Hallo wereld'), mTxt);
	const cp = makeStore(false).init();
	cp.replace({ v:2, fields:[{ key:'naam', value:'Amnesia;Haze' }, { key:'naam2', type:'toggle', value:true }, { key:'ongebruikt', value:'x' }],
		elements:[{ id:'T', type:'text', text:'{Naam}', rules:[{ field:'naam2', equals:true, set:{ invert:true } }] },
			{ id:'Q', type:'qr', data:'{naam|wifi}' }] }, { history:false });
	cp.copy(['T', 'Q']); cp.paste();
	ok('plakken in hetzelfde label hergebruikt identieke velden', cp.doc.fields.length === 3 && cp.doc.elements.at(-1).data === '{naam|wifi}');
	cp.replace({ v:2, fields:[{ key:'naam', value:'OG Kush' }], elements:[] }, { history:false });
	const pasted = cp.paste(), displayP = e => substitute(e.text || e.data, { fields:cp.doc.fields });
	ok('plakken in ander label: alleen gebruikte velden mee, botsende keys hernoemd, filters en regels intact',
		cp.doc.fields.length === 3 && cp.doc.fields[0].value === 'OG Kush' && pasted[0].text === '{naam3}'
		&& displayP(pasted[0]) === 'Amnesia;Haze' && displayP(pasted[1]) === String.raw`Amnesia\;Haze`
		&& applyRules(pasted[0], fieldValues(cp.doc.fields).raw).invert && !cp.doc.fields.some(f => f.key === 'ongebruikt'), J(cp.doc));
	cp.paste();
	ok('herhaald plakken na key-botsing maakt geen extra velden', cp.doc.fields.length === 3 && displayP(cp.doc.elements.at(-1)) === String.raw`Amnesia\;Haze`);
	cp.undo(); cp.undo();
	ok('plakken met velden: undo herstelt doel zonder extra velden of elementen', cp.doc.fields.length === 1 && !cp.doc.elements.length && cp.doc.fields[0].value === 'OG Kush');
	s.remove(s.selection);
	ok('remove + selectie leeg', !s.doc.elements.includes(p2[0]) && s.selection.length === 0);
	s.remove(['K', 'A']);
	ok('remove: vergrendeld blijft staan', !!g('K') && !g('A'));
	ok('export/import', J(userTemplates.importJSON(userTemplates.exportJSON(d))) === J(d));
	const msgs = ['{"a":1}', '', '{', 'abc'].map(x => { try { userTemplates.importJSON(x); } catch (e) { return e.message; } });
	ok('import weigert geen label-bestand (ook kapotte JSON, Nederlandse melding)', msgs.every(m => m === 'geen label-bestand'), J(msgs));

	// --- golf 2: emoji/iconify-velden, layout, printbaar vlak ---
	const ED = ELEMENT_DEFAULTS;
	ok('emoji-type + defaults', ELEMENT_TYPES.includes('emoji') && TYPE_NAMES.emoji === 'Emoji' && ED.emoji.char === '🌿' && ED.emoji.style === 'mono'
		&& ED.emoji.weight === 500 && ED.emoji.mode === 'floyd' && ED.emoji.w === 14 && ED.emoji.h === 14 && ED.icon.source === 'tabler' && ED.icon.svg === '');
	// golf 3: zonder deze defaults gooit fill() de foto-instellingen bij opslaan/laden weg; oude docs houden hun mode.
	const mi = migrate({ v:2, label:{ w:40, h:30 }, elements:[{ type:'image', mode:'floyd' }, { type:'image', mode:'bluenoise', localContrast:77, dotGain:12, bleed:60, auto:false }] }).elements;
	ok('image: auto-pijplijn-velden blijven bewaard, oude mode blijft', ED.image.mode === 'auto' && ED.image.auto === true && mi[0].mode === 'floyd'
		&& J([mi[1].mode, mi[1].localContrast, mi[1].dotGain, mi[1].bleed, mi[1].auto]) === J(['bluenoise', 77, 12, 60, false]));
	const mg = migrate({ v:2, label:{ w:40, h:30 }, elements:[{ type:'icon', icon:'mdi:x', source:'iconify', svg:'<svg/>' }, { type:'emoji', char:'🍄', weight:'zwaar' }] });
	ok('migrate: layout + nieuwe velden', J(mg.layout) === J(LAYOUT) && mg.elements[0].source === 'iconify' && mg.elements[0].svg === '<svg/>'
		&& mg.elements[1].char === '🍄' && mg.elements[1].weight === 500 && J(migrate(dup(v1)).layout) === J(LAYOUT), J(mg));
	ok('migrate: layout behouden', (l => l.autoTidy === false && l.margin === 3)(migrate({ v:2, layout:{ autoTidy:false, margin:3 } }).layout));
	ok('printableArea', J(printableArea({ label:{ w:50, h:30 } })) === J({ x:0, y:0, w:48, h:30 }) && printableArea({ label:{ w:40, h:30 } }).w === 40);
	ok('createElement: 50 mm-label centreert in 48 mm', (e => e.x === 9 && e.x + e.w <= 46.5)(createElement('text', {}, { label:{ w:50, h:30 }, elements:[] })));

	const t = makeStore(false).init(), G = id => t.doc.elements.find(e => e.id === id), box = e => J([e.x, e.y, e.w, e.h]);
	const inA = (b, A, tol = 2e-3) => b.x >= A.x - tol && b.y >= A.y - tol && b.x + b.w <= A.x + A.w + tol && b.y + b.h <= A.y + A.h + tol;
	const L = (w, h, elements, layout) => ({ v:2, label:{ w, h }, layout, elements });
	// fill op een 50 mm-label: alles binnen 48 mm min marge.
	t.replace(L(50, 30, [{ type:'shape', id:'S' }, { type:'qr', id:'Q' }, { type:'barcode', id:'B' }, { type:'text', id:'T' }, { type:'image', id:'I', w:20, h:10 },
		{ type:'shape', id:'S9', rot:90 }, { type:'emoji', id:'E' }, { type:'icon', id:'K', locked:true }]), { history:false });
	const before = J(t.doc.elements), A50 = { x:1.5, y:1.5, w:45, h:27 };
	// Per element: meer tegelijk vult als groep (zie verderop).
	for (const id of ['S', 'Q', 'B', 'T', 'I', 'S9', 'E', 'K']) t.fill([id]);
	ok('fill: vorm = binnenvlak', box(G('S')) === J([1.5, 1.5, 45, 27]), box(G('S')));
	ok('fill: qr contain + gecentreerd', box(G('Q')) === J([10.5, 1.5, 27, 27]), box(G('Q')));
	ok('fill: emoji contain', box(G('E')) === J([10.5, 1.5, 27, 27]), box(G('E')));
	ok('fill: afbeelding houdt verhouding', box(G('I')) === J([1.5, 3.75, 45, 22.5]), box(G('I')));
	ok('fill: barcode volle breedte, hoogte 45%', box(G('B')) === J([1.5, 8.25, 45, 13.5]), box(G('B')));
	ok('fill: tekst = binnenvlak + fit fill', box(G('T')) === J([1.5, 1.5, 45, 27]) && G('T').fit === 'fill', J(G('T')));
	ok('fill: kwartslag gedraaid past op omhullende', G('S9').w === 27 && G('S9').h === 45 && inA(aabb(G('S9')), A50), J(aabb(G('S9'))));
	ok('fill: 50 mm-label -> alles binnen 48 mm', t.doc.elements.every(e => e.locked || (inA(aabb(e), A50) && aabb(e).x + aabb(e).w <= 48)));
	ok('fill: vergrendeld blijft staan', box(G('K')) === J([18, 9, 12, 12]), box(G('K')));
	for (let i = 0; i < 7; i++) t.undo();   // K is vergrendeld: geen stap
	ok('fill: 1 undo-stap per element', J(t.doc.elements) === before && !t.canUndo());
	G('S').x = 2; t.center(['S'], 'h');
	ok('center h (printbaar vlak)', G('S').x === 17 && G('S').y === 8 && t.canUndo(), box(G('S')));
	Object.assign(G('Q'), { x:2, y:3 }); t.center(['Q']);
	ok('center beide', G('Q').x === 15 && G('Q').y === 6, box(G('Q')));
	t.undo(); t.undo();
	ok('center: undo terug', !t.canUndo() && G('S').x === 17, box(G('S')));
	t.center(['S'], 'h');
	ok('center: niets veranderd = geen stap', !t.canUndo());
	// golf 4: een selectie centreert als groep (onderlinge opmaak blijft), ook op het 48 mm-vlak; vergrendeld blijft staan
	Object.assign(G('S'), { x:2, y:2, w:10, h:5 }); Object.assign(G('Q'), { x:20, y:12 }); t.changed();
	const gap = [G('Q').x - G('S').x, G('Q').y - G('S').y], hist0 = t.canUndo();
	t.center(['S', 'Q', 'K']);
	const gs = span([G('S'), G('Q')]);
	ok('center: groep als geheel (afstand blijft, groepsmidden = vlakmidden 48 mm), vergrendeld telt niet mee', J([G('Q').x - G('S').x, G('Q').y - G('S').y]) === J(gap)
		&& Math.abs(gs.x + gs.w / 2 - 24) < 2e-3 && Math.abs(gs.y + gs.h / 2 - 15) < 2e-3 && box(G('K')) === J([18, 9, 12, 12]), J([box(G('S')), box(G('Q'))]));
	t.undo();
	ok('center: groep = 1 undo-stap', G('S').x === 2 && G('Q').x === 20 && hist0, box(G('S')));
	t.center(['T']);
	ok('center: tekst ook in zijn vak (uitlijning midden)', G('T').align === 'center' && G('T').valign === 'middle');
	t.undo(); t.center(['T'], 'h');
	ok('center h: alleen horizontale uitlijning', G('T').align === 'center' && G('T').valign === 'top');
	t.doc.layout.margin = 0; t.fill(['S']);
	ok('fill: marge-optie', box(G('S')) === J([0, 0, 48, 30]), box(G('S')));
	t.replace(L(40, 30, [{ type:'barcode', id:'B9', w:20, h:8, rot:90 }]), { history:false });
	t.fill(['B9']);
	ok('fill: gedraaide barcode = volle lengte, streephoogte max 45%', G('B9').w === 27 && G('B9').h === 13.5, box(G('B9')));
	// Ctrl+A pakt de rand mee: die blijft kader, de inhoud centreert/verdeelt zoals zonder rand (eerst: niets resp. een stapel).
	const CR = [{ type:'border', id:'R', x:1, y:1, w:38, h:28 }, { type:'shape', id:'A', x:3, y:5, w:4, h:4 }, { type:'shape', id:'B', x:15, y:12, w:4, h:4 }, { type:'shape', id:'C', x:20, y:20, w:4, h:4 }];
	const xy = () => J(t.doc.elements.map(e => [e.x, e.y]));
	t.replace(L(40, 30, CR), { history:false }); t.center(['R', 'A', 'B', 'C']); const crC = xy();
	t.replace(L(40, 30, CR), { history:false }); t.distribute(['R', 'A', 'B', 'C'], 'h'); const crD = xy();
	ok('center/verdelen met rand in de selectie: rand blijft, inhoud als zonder rand', crC === J([[1, 1], [9.5, 5.5], [21.5, 12.5], [26.5, 20.5]])
		&& crD === J([[1, 1], [3, 5], [11.5, 12], [20, 20]]), crC + crD);
	// Meer elementen (Ctrl+A): als groep in het vlak, geen stapel; verhouding en afstand blijven, rand = kader, 1 undo-stap.
	t.replace(L(50, 30, [{ type:'border', id:'R' }, { type:'shape', id:'S', x:2, y:2, w:10, h:5 }, { type:'qr', id:'Q', x:20, y:12, w:8, h:8 }, { type:'icon', id:'K', locked:true }]), { history:false });
	const fg0 = J(t.doc.elements), k0 = box(G('K'));
	t.fill(['R', 'S', 'Q', 'K']);
	const fgS = G('S'), fgQ = G('Q'), fgG = span([fgS, fgQ]), fgA = innerArea(t.doc);
	ok('fill: meer elementen = groep (geen overlap, verhouding blijft, vult het vlak binnen de rand)', box(G('R')) === J([1, 1, 46, 28]) && !hit(aabb(fgS), aabb(fgQ))
		&& Math.abs(fgS.w / fgS.h - 2) < 2e-3 && fgQ.w === fgQ.h && Math.abs((fgQ.x - fgS.x) / (fgQ.y - fgS.y) - 1.8) < 2e-3 && inA(fgG, fgA)
		&& (Math.abs(fgG.w - fgA.w) < 2e-3 || Math.abs(fgG.h - fgA.h) < 2e-3) && box(G('K')) === k0, J([box(fgS), box(fgQ), fgA]));
	t.undo();
	ok('fill: groep = 1 undo-stap', J(t.doc.elements) === fg0 && !t.canUndo());

	// Rand: kader op het printbare vlak; binnenvlak blijft vrij van de randlijn.
	t.replace(L(50, 30, [{ type:'border', id:'R', x:5, y:5, w:10, h:10 }]), { history:false });
	t.fill(['R']);
	ok('fill: rand = label min 1 mm, geklemd op 48 mm', box(G('R')) === J([1, 1, 46, 28]), box(G('R')));
	t.replace(L(40, 30, []), { history:false });
	ok('place: leeg label -> fill', box(t.place(createElement('shape', {}, t.doc))) === J([1.5, 1.5, 37, 27]));
	t.replace(L(40, 30, [{ type:'border', id:'R' }]), { history:false });
	const pt = t.place(createElement('text', { text:'Wiet' }, t.doc));
	ok('place: leeg label (alleen rand) -> fill binnen de rand', box(pt) === J([3.7, 3.7, 32.6, 22.6]) && pt.fit === 'fill' && t.selection[0] === pt.id, box(pt));
	const pi = t.place(createElement('icon', {}, t.doc)), IN0 = { x:3.7, y:3.7, w:32.6, h:22.6 };
	ok('place: geen vrije strook -> tekst maakt plaats (naast elkaar), icoon op 45% hoogte, geen overlap', box(pi) === J([3.7, 8.25, 13.5, 13.5]) && !hit(aabb(pi), aabb(pt))
		&& inA(aabb(pt), IN0) && pt.w < 32.6 && Math.abs(pt.w / pt.h - 32.6 / 22.6) < 2e-3, box(pi) + box(pt));
	t.undo();
	ok('place: 1 undo-stap (ook de plaatsmakende tekst terug)', t.doc.elements.length === 2 && !t.doc.elements.includes(pi) && box(t.doc.elements[1]) === J([3.7, 3.7, 32.6, 22.6]), box(t.doc.elements[1]));
	// Taak 3: leeg label -> tekst (vult) -> wieticoon: naast elkaar, niets over elkaar
	t.replace(L(40, 30, []), { history:false });
	const pt3 = t.place(createElement('text', { text:'Hello' }, t.doc)), pi3 = t.place({ type:'icon', icon:'cannabis' });
	ok('place: tekst vult, icoon erbij -> naast elkaar zonder overlap', !hit(aabb(pi3), aabb(pt3)) && pi3.w === 13.5 && inA(aabb(pt3), { x:1.5, y:1.5, w:37, h:27 }), box(pi3) + box(pt3));
	// Taak 2: staande foto naast 'Mijn label' = bruikbaar groot (>= 60% labelhoogte), links, tekst ernaast
	t.replace(L(40, 30, [{ type:'text', id:'T', text:'Mijn label', x:5, y:11, w:30, h:8, size:6 }]), { history:false });
	const ph = t.place(createElement('image', { w:15.9, h:24 }, t.doc));
	ok('place: staande foto naast tekst = groot, links, geen overlap', ph.h >= 18 && ph.x === 1.5 && !hit(aabb(ph), aabb(G('T'))) && G('T').size < 6, box(ph) + box(G('T')));
	t.replace(L(40, 30, [{ type:'image', id:'F', src:'', x:1.5, y:1.5, w:17.5, h:27, rules:[{ field:'x', equals:'', set:{ hidden:true } }] }, { type:'text', id:'P', x:20.5, y:12, w:18, h:15 }]), { history:false });
	const fp = t.place(createElement('image', { src:'data:image/png;base64,AA', w:15.9, h:24, mode:'floyd' }, t.doc));
	ok('place: foto vult de lege foto-plek (geen tweede foto, plek/regels blijven), 1 undo-stap', fp === G('F') && t.doc.elements.length === 2 && G('F').src.startsWith('data:') && G('F').mode === 'floyd'
		&& box(G('F')) === J([1.5, 1.5, 17.5, 27]) && G('F').rules.length === 1 && t.selection[0] === 'F' && (t.undo(), G('F').src === ''), box(fp));
	t.replace(L(40, 30, [{ type:'text', id:'T', text:'Mijn label', x:5, y:11, w:30, h:8, size:6 }]), { history:false });
	const tb0 = box(G('T')), pd = t.place({ type:'icon', icon:'cannabis' }, { x:36, y:5 });
	ok('place op drop-punt: daar (binnen de marge), de rest blijft staan', box(pd) === J([25, 1.5, 13.5, 13.5]) && box(G('T')) === tb0, box(pd));
	t.replace(L(40, 30, [{ type:'text', id:'T', x:1.5, y:1.5, w:37, h:27, fit:'fill', locked:true }]), { history:false });
	ok('place: vergrendelde inhoud in de weg -> toch midden (overlap), vergrendeld blijft', box(t.place({ type:'icon', icon:'cannabis' })) === J([13.25, 8.25, 13.5, 13.5]) && box(G('T')) === J([1.5, 1.5, 37, 27]));
	t.replace(L(40, 30, [{ type:'border', id:'R' }, { type:'shape', id:'K', x:2, y:2, w:36, h:1, locked:true }, { type:'text', id:'T', text:'Hallo', x:3.7, y:3.7, w:32.6, h:22.6 }]), { history:false });
	const pk = t.place({ type:'icon', icon:'cannabis' });
	ok('place: plaats maken laat vergrendeld buiten het binnenvlak staan', box(G('K')) === J([2, 2, 36, 1]) && !hit(aabb(pk), aabb(G('T'))), box(G('K')));

	// Slim plaatsen: midden bezet -> grootste vrije strook.
	t.replace(L(40, 30, [{ type:'text', id:'T', x:5, y:11, w:30, h:8 }]), { history:false });
	const ic = t.place({ type:'icon', icon:'cannabis' });
	const gic = span([ic, G('T')]);
	ok('place: midden bezet -> vrije strook boven, groep daarna midden', box(ic) === J([15.75, 6.25, 8.5, 8.5]) && G('T').y === 15.75 && !hit(aabb(ic), aabb(G('T')))
		&& Math.abs(gic.x + gic.w / 2 - 20) < 2e-3 && Math.abs(gic.y + gic.h / 2 - 15) < 2e-3, box(ic) + box(G('T')));
	// Na centreren is de vrije ruimte boven en onder verdeeld: de strook is de helft daarvan (>= 1 regel van 3 mm).
	const tx2 = t.place(createElement('text', { text:'Regel' }, t.doc)), IA = { x:1.5, y:1.5, w:37, h:27 };
	ok('place: tekst volle breedte + shrink in strook', tx2.w === 37 && tx2.x === 1.5 && tx2.h === 3.75 && tx2.fit === 'shrink'
		&& !hit(aabb(tx2), aabb(G('T'))) && !hit(aabb(tx2), aabb(ic)) && t.doc.elements.every(e => inA(aabb(e), IA)), box(tx2));
	t.replace(L(40, 30, [{ type:'shape', id:'S', x:1.5, y:1.5, w:32, h:27 }]), { history:false });
	const pn = t.place({ type:'icon', icon:'cannabis' });
	ok('place: alleen een smalle strook (4 mm) -> vorm maakt plaats i.p.v. mini-icoon', pn.w === 13.5 && !hit(aabb(pn), aabb(G('S'))) && Math.abs(G('S').w / G('S').h - 32 / 27) < 2e-3, box(pn) + box(G('S')));
	t.replace(L(40, 30, [{ type:'shape', id:'S', x:1.5, y:1.5, w:4, h:4 }]), { history:false });
	ok('place: midden vrij -> gecentreerd', box(t.place(createElement('qr', {}, t.doc))) === J([13.25, 8.25, 13.5, 13.5]));
	t.replace(L(40, 30, [{ type:'shape', id:'S', x:1.5, y:1.5, w:4, h:4 }]), { history:false });
	ok('place: barcode max binnenvlak-breedte, eigen verhouding', (b => b.w === 37 && b.h <= 13.5 && Math.abs(b.w / b.h - 34 / 12) < 1e-3)(t.place(createElement('barcode', {}, t.doc))));

	// Netjes maken: groep uniform schalen, verhoudingen blijven.
	t.replace(L(40, 30, [{ type:'shape', id:'A', x:0, y:0, w:10, h:5 }, { type:'text', id:'B', x:10, y:5, w:10, h:5, size:2 },
		{ type:'shape', id:'H', x:30, y:25, w:2, h:2, hidden:true }, { type:'border', id:'R', x:3, y:3, w:10, h:10 },
		{ type:'shape', id:'V', x:0, y:0, w:10, h:5, hidden:true, rules:[{ field:'k', equals:'b', set:{ hidden:false } }] }]), { history:false });
	t.tidy();
	const [ta, tb] = [G('A'), G('B')], IN = { x:3.7, y:3.7, w:32.6, h:22.6 };
	ok('tidy: rand -> kader', box(G('R')) === J([1, 1, 38, 28]), box(G('R')));
	ok('tidy: groep vult binnenvlak', box(ta) === J([3.7, 6.85, 16.3, 8.15]) && box(tb) === J([20, 15, 16.3, 8.15]) && inA(ta, IN) && inA(tb, IN), box(ta) + box(tb));
	ok('tidy: verhoudingen behouden', Math.abs((tb.x - ta.x) / ta.w - 1) < 1e-3 && Math.abs((tb.y - ta.y) / ta.h - 1) < 1e-3 && ta.w / ta.h === 2 && tb.size === 3.26, J(tb));
	ok('tidy: verborgen blijft staan', box(G('H')) === J([30, 25, 2, 2]));
	ok('tidy: keuze-variant (verborgen + regel) schaalt mee als groep', box(G('V')) === box(ta), box(G('V')) + box(ta));
	t.undo();
	ok('tidy: 1 undo-stap', G('A').w === 10 && G('R').w === 10 && !t.canUndo());
	// golf 4: zonder meting krimpt overlopende tekst in zijn vak; met meting (extent) gaan vakken om de zichtbare inhoud
	t.replace(L(40, 30, [{ type:'text', id:'P', text:'4,95', x:5, y:21, w:30, h:6, size:3 }, { type:'image', id:'I', x:11, y:1.5, w:18, h:18 }]), { history:false });
	t.tidy();
	ok('tidy zonder meting: tekst fit none -> shrink', G('P').fit === 'shrink');
	t.undo();
	// Prijs links smal, overloopt; foto staand. Inkt schaalt met de letter/het beeld (zoals render), zo meet tidy na het schalen hetzelfde.
	// De regel staat op valign in het vak (zoals render), anders vindt tidy geen regelbox.
	const ext = el => el.type === 'text' ? { x:el.x, y:el.y + (el.h - el.size * 3) * (VALIGN[el.valign] ?? 0), w:el.size * 4, h:el.size * 3 }
		: { x:el.x + el.w / 2 - el.h / 3, y:el.y, w:el.h * 2 / 3, h:el.h };
	t.setExtent(ext); t.tidy(); t.setExtent(null);
	const tg = span([G('P'), G('I')]);
	ok('tidy met meting: vak om de inhoud, groep gecentreerd en zo groot als past, fit blijft', G('P').fit === 'none' && Math.abs(G('P').w / G('P').h - 12.2 / 9) < 2e-3 && G('I').w < 18 && Math.abs(G('I').w / G('I').h - 12 / 18) < 2e-3
		&& Math.abs(tg.x + tg.w / 2 - 20) < 2e-3 && Math.abs(tg.y + tg.h / 2 - 15) < 2e-3 && Math.abs(tg.h - 27) < 2e-3 && !hit(aabb(G('P')), aabb(G('I'))), box(G('P')) + box(G('I')));
	t.undo();
	ok('tidy met meting: 1 undo-stap', box(G('P')) === J([5, 21, 30, 6]) && !t.canUndo());
	// golf 4b: meting via setExtent. Nep-render zoals render.contentBox: regelbox = regels x size x lineHeight op align/valign,
	// zonder onderstokken valt 0,2 x size onderaan weg (lege onderstok-ruimte).
	const fx = el => {
		if (el.type !== 'text') return null;
		const ls = String(el.text).split('\n'), H = ls.length * el.size * el.lineHeight, W = Math.max(...ls.map(l => l.length)) * el.size * .5;
		return { x:el.x + (el.w - W) * (HALIGN[el.align] ?? 0), y:el.y + (el.h - H) * (VALIGN[el.valign] ?? 0), w:W, h:H - (/[gjpqy]/.test(el.text) ? 0 : .2 * el.size) };
	};
	const white = el => { const e = fx(el); return [e.y, 30 - e.y - e.h, e.x, 40 - e.x - e.w]; };
	t.replace(L(40, 30, [{ type:'text', id:'H', text:'Hello', size:6, x:5, y:5, w:30, h:12 }]), { history:false });
	t.center(['H']);
	ok('center zonder meting: box midden (zoals voorheen)', box(G('H')) === J([5, 9, 30, 12]), box(G('H')));
	t.undo(); t.setExtent(fx); t.center(['H']);
	const wh = white(G('H'));
	ok('center met setExtent: tekst zonder onderstokken optisch midden (boven = onder, links = rechts)', Math.abs(wh[0] - wh[1]) < 2e-3 && Math.abs(wh[2] - wh[3]) < 2e-3 && G('H').y === 9.6 && t.canUndo(), J(wh));
	t.replace(L(40, 30, [{ type:'text', id:'A', text:'Hello', size:4, x:2, y:3, w:14, h:8, align:'center', valign:'middle' }, { type:'text', id:'B', text:'ja', size:4, x:24, y:18, w:14, h:8 }]), { history:false });
	t.center(['A', 'B']);
	const ga = span([G('A'), G('B')], fx);
	ok('center groep met meting: zichtbare inhoud als geheel midden', Math.abs(ga.x + ga.w / 2 - 20) < 2e-3 && Math.abs(ga.y + ga.h / 2 - 15) < 2e-3, J(ga));
	t.replace(L(40, 30, [{ type:'text', id:'H', text:'Hello', size:4, x:3, y:3, w:30, h:10, align:'center', valign:'middle', fit:'shrink' }]), { history:false });
	t.tidy();
	const th = G('H'), tw = white(th);
	ok('tidy met setExtent: vak = regelbox (krimpen houdt de maat), inhoud vult en staat optisch midden', th.fit === 'shrink' && Math.abs(th.h - th.size * 1.15) < 2e-3
		&& Math.abs(tw[0] - tw[1]) < 3e-3 && Math.abs(tw[2] - tw[3]) < 3e-3 && Math.abs(tw[2] - 1.5) < 3e-3, box(th) + J(tw));
	t.replace(L(40, 30, []), { history:false });
	const pf = t.place(createElement('text', { text:'Hello', align:'center', valign:'middle' }, t.doc)), pw = white(pf);
	ok('place op leeg label met meting: gecentreerde tekst vult en staat optisch midden', pf.fit === 'fill' && pf.w === 37 && Math.abs(pw[0] - pw[1]) < 2e-3 && pf.y > 1.5, box(pf) + J(pw));
	t.replace(L(40, 30, [{ type:'text', id:'H', text:'Hello', size:4, x:3, y:3, w:30, h:10, align:'center', valign:'middle', fit:'shrink' }]), { history:false });
	t.setExtent(null); t.tidy(); t.setExtent(fx);
	ok('tidy zonder meting = op de boxen', Math.abs(G('H').h - 10 * 37 / 30) < 2e-3 && G('H').x === 1.5, box(G('H')));
	// Omgekeerd (ook via een nu niet actieve keuze-regel) = zwart vlak over de box: geen vak om de tekst, de chip vult zijn cel.
	t.replace(L(40, 30, [{ type:'text', id:'C', text:'HYBRIDE', size:2, x:14, y:11, w:12, h:5, align:'center', valign:'middle', rules:[{ field:'type', equals:'X', set:{ invert:true } }] },
		{ type:'text', id:'N', text:'Naam', size:4, x:5, y:3, w:30, h:6, align:'center' }]), { history:false });
	t.tidy();
	ok('tidy met setExtent: omgekeerde keuze-chip houdt zijn box en schaalt mee met de groep', Math.abs(G('C').w / G('C').h - 12 / 5) < 2e-3 && G('C').w > 12, box(G('C')));
	// Tekst met {token}: de waarde wisselt (veld, CSV-rij, teller), dus geen vak om de huidige waarde.
	t.replace({ ...L(40, 30, [{ type:'text', id:'V', text:'{x}', size:3, x:5, y:5, w:30, h:8 }]), fields:[{ key:'x', type:'text', value:'kort' }] }, { history:false });
	t.tidy();
	ok('tidy met setExtent: tekst met {token} houdt zijn vak (alleen de groepsschaal), binnen het label', Math.abs(G('V').w / G('V').h - 30 / 8) < 2e-3 && G('V').w > 30
		&& inA(aabb(G('V')), printableArea(t.doc)), box(G('V')));
	// Tekst onder een icoon: het onderste vak (regelbox met onderstok-ruimte) bleef 0,9 mm over de labelrand hangen.
	t.replace(L(40, 30, [{ type:'icon', id:'K', x:15.75, y:1.5, w:8.5, h:8.5 }, { type:'text', id:'T', text:'Hello', size:6, x:5, y:11, w:30, h:8, align:'center', valign:'middle', fit:'shrink' }]), { history:false });
	t.tidy();
	const tk = span([G('K'), G('T')], e => fx(e) || aabb(e));
	ok('tidy met setExtent: alle boxen op het label, inkt optisch midden', t.doc.elements.every(e => inA(aabb(e), printableArea(t.doc))) && Math.abs(tk.y - (30 - tk.y - tk.h)) < .25, box(G('K')) + box(G('T')) + J(tk));
	// Meting zoals render: op hele dots en gecentreerd op de inkt (zijzijde van de 'H' = midden 0,05 x size naast de regel).
	// Een tweede klik mag niets veranderen en geen undo-stap geven (eerst schoof de groep elke klik een stuk op).
	// Opnieuw meten in een verse store (zonder de bewaarde uitkomst): de lus zelf staat ook stil. jit = een meting die per klik
	// verspringt (render op hele dots komt niet altijd tot rust): een tweede klik zonder wijziging doet dan nog steeds niets.
	const dot = v => Math.round(v * 8) / 8;
	let jit = 0;
	const dm = el => { const e = fx(el); return e && { x:dot(e.x + .05 * el.size) + jit, y:dot(e.y), w:dot(e.w), h:dot(e.h) }; };
	t.setExtent(dm);
	t.replace(L(40, 30, [{ type:'icon', id:'K', x:15.75, y:1.5, w:8.5, h:8.5 }, { type:'text', id:'T', text:'Hello', size:6, x:5, y:11, w:30, h:8, align:'center', valign:'middle', fit:'shrink' }]), { history:false });
	t.tidy();
	const td1 = J(t.doc.elements), tf = makeStore(false).init();
	jit = .5; t.tidy(); t.tidy(); jit = 0;
	const td2 = J(t.doc.elements);
	tf.setExtent(dm); tf.replace(L(40, 30, JSON.parse(td1)), { history:false }); tf.tidy();
	t.undo();
	ok('tidy: tweede keer = niets veranderd, geen undo-stap (ook als de meting verspringt)', td1 === td2 && J(tf.doc.elements) === td1 && !tf.canUndo() && G('T').y === 11 && !t.canUndo(), td2 + J(tf.doc.elements));
	// Sierletter (Pacifico e.d.): inkt 1,3x de regelhoogte, vooral onder de regel. Het vak wordt de regelbox en staat dan vast
	// (een vak om de inkt liet render de regel midden zetten: elke klik zakte de tekst en kromp hij).
	const orn = el => { const e = fx(el); if (!e) return null; const H = el.size * el.lineHeight, y = el.y + (el.h - H) * (VALIGN[el.valign] ?? 0);
		return { x:e.x, y:y - .05 * H, w:e.w, h:1.3 * H }; };
	t.setExtent(orn);
	t.replace(L(40, 30, [{ type:'text', id:'T', text:'Spacecake', size:4, x:5, y:8, w:30, h:6, align:'center', valign:'middle', fit:'shrink' },
		{ type:'text', id:'B', text:'brownie', size:3, x:5, y:16, w:30, h:5, align:'center', valign:'middle', fit:'shrink' }]), { history:false });
	t.tidy();
	const so1 = J(t.doc.elements), so = makeStore(false).init();
	so.setExtent(orn); so.replace(L(40, 30, JSON.parse(so1)), { history:false }); so.tidy();
	ok('tidy met sierletter (inkt hoger dan de regel): vak = regelbox, opnieuw netjes maken = niets veranderd', J(so.doc.elements) === so1 && !so.canUndo()
		&& Math.abs(G('T').h - G('T').size * 1.15) < 2e-3 && Math.abs(G('B').h - G('B').size * 1.15) < 2e-3, so1 + J(so.doc.elements));
	t.setExtent(null);
	// golf 4b: plaats maken -> nieuw element + verkleinde inhoud samen midden (de inhoud hoefde hier niet te krimpen)
	t.replace(L(40, 30, [{ type:'shape', id:'S', x:9, y:1.5, w:22, h:27 }]), { history:false });
	const pm = t.place({ type:'icon', icon:'cannabis' }), gm = span([pm, G('S')]);
	ok('place: plaats gemaakt -> groep als geheel midden in het printbare vlak', Math.abs(gm.x + gm.w / 2 - 20) < 2e-3 && Math.abs(gm.y + gm.h / 2 - 15) < 2e-3
		&& !hit(aabb(pm), aabb(G('S'))) && G('S').w === 22 && pm.w === 13.5, box(pm) + box(G('S')));
	t.replace(L(40, 30, [{ type:'text', id:'T', text:'Hello', size:8, x:1.5, y:1.5, w:37, h:27, align:'center', valign:'middle' }]), { history:false });
	t.setExtent(fx);
	const pc = t.place({ type:'icon', icon:'cannabis' }), tc = fx(G('T'));
	ok('place met meting: plaatsmakende tekst optisch op één lijn met het nieuwe element (dwars midden)', Math.abs(tc.y + tc.h / 2 - 15) < 2e-3 && Math.abs(pc.y + pc.h / 2 - 15) < 2e-3
		&& Math.abs(G('T').y + G('T').h / 2 - 15) > .1 && !hit(aabb(pc), aabb(G('T'))), box(pc) + J(tc));
	// Eén regel bovenin een vak van 27 mm: optisch midden zou het lege deel van het vak over de marge schuiven; het vak wint.
	t.replace(L(40, 30, [{ type:'text', id:'T', text:'Hello', size:8, x:1.5, y:1.5, w:37, h:27, align:'center' }]), { history:false });
	const pc2 = t.place({ type:'icon', icon:'cannabis' }), tc2 = fx(G('T'));
	ok('place met meting: plaatsmakende tekst zo dicht bij het dwarsmidden als het binnenvlak toelaat', inA(aabb(G('T')), IA) && Math.abs(G('T').y + G('T').h - 28.5) < 2e-3
		&& Math.abs(tc2.y + tc2.h / 2 - 15) < 1 && !hit(aabb(pc2), aabb(G('T'))), box(pc2) + box(G('T')) + J(tc2));
	t.replace(L(40, 30, [{ type:'shape', id:'S', x:9, y:1.5, w:22, h:27 }]), { history:false });
	const half = e => e.type === 'shape' ? { x:e.x, y:e.y, w:e.w / 2, h:e.h } : null;
	t.setExtent(half);
	const pv = t.place({ type:'icon', icon:'cannabis' }), gv = span([pv, G('S')], e => half(e) || aabb(e));
	// Optisch midden zou de vorm 3,9 mm van het label schuiven: zo ver naar het midden als het binnenvlak toelaat.
	ok('place met meting: groep naar de zichtbare inhoud, boxen binnen het binnenvlak', !hit(aabb(pv), aabb(G('S'))) && inA(aabb(pv), IA) && inA(aabb(G('S')), IA)
		&& Math.abs(G('S').x + G('S').w - 38.5) < 2e-3 && gv.x + gv.w / 2 < 20, box(pv) + box(G('S')));
	// Korte tekst links/midden in een breed vak + icoon: het vak blijft binnen het binnenvlak (sleepte eerst tot 47,5 mm).
	for (const align of ['left', 'center']) {
		t.replace(L(40, 30, [{ type:'text', id:'T', text:'Hi', size:8, x:1.5, y:1.5, w:37, h:27, align }]), { history:false });
		t.setExtent(fx);
		const ph2 = t.place({ type:'icon', icon:'cannabis' });
		ok(`place met meting: korte tekst (${align}) + icoon -> alle boxen binnen het binnenvlak`, t.doc.elements.every(e => inA(aabb(e), IA)) && !hit(aabb(ph2), aabb(G('T'))), box(ph2) + box(G('T')));
	}
	// Vrije strook (nieuw label: tekst midden, icoon erboven): groep optisch midden, boven- = onderwit.
	t.replace(L(40, 30, [{ type:'text', id:'T', text:'Hello', size:6, x:5, y:11, w:30, h:8, align:'center', valign:'middle', fit:'shrink' }]), { history:false });
	const ps = t.place({ type:'icon', icon:'cannabis' }), pt5 = fx(G('T'));
	ok('place: vrije strook -> groep optisch midden (met meting)', ps.y < G('T').y && !hit(aabb(ps), aabb(G('T'))) && Math.abs(ps.y - (30 - pt5.y - pt5.h)) < .25, box(ps) + J(pt5));
	t.setExtent(null);
	t.replace(L(40, 30, [{ type:'text', id:'T', x:5, y:11, w:30, h:8 }, { type:'shape', id:'K', x:30, y:26, w:2, h:2, locked:true }]), { history:false });
	ok('place: vrije strook + vergrendeld -> rest niet verschoven', box(t.place({ type:'icon', icon:'cannabis' })) === J([15.75, 1.5, 8.5, 8.5]) && G('T').y === 11, box(G('T')));

	// Labelmaat: inhoud schaalt mee van kadervak naar kadervak (zonder kader: het printbare vlak); balk S ligt strak tegen het kader.
	t.replace(L(40, 30, [{ type:'text', id:'T', x:5, y:11, w:30, h:8, size:5 }, { type:'icon', id:'K', x:14, y:9, w:12, h:12 }, { type:'border', id:'R' },
		{ type:'shape', id:'S', x:1, y:1, w:38, h:4 }, { type:'text', id:'D', x:10, y:13, w:20, h:4, rot:90 }]), { history:false });
	const d0 = aabb(G('D'));
	t.resizeLabel(50, 30);
	ok('resizeLabel 40x30 -> 50x30 schaalt mee, balk blijft strak tegen het kader', t.doc.label.w === 50 && box(G('T')) === J([5.842, 11, 36.316, 8]) && G('T').size === 5
		&& box(G('K')) === J([18, 9, 12, 12]) && box(G('R')) === J([1, 1, 46, 28]) && box(G('S')) === J([1, 1, 46, 4]), box(G('T')) + box(G('K')) + box(G('R')) + box(G('S')));
	t.undo();
	ok('resizeLabel: 1 undo-stap', t.doc.label.w === 40 && G('T').x === 5 && !t.canUndo());
	t.resizeLabel(20, 15);
	ok('resizeLabel verkleinen: uniform + lettergrootte, balk strak', box(G('T')) === J([2.895, 5.643, 14.211, 3.714]) && G('T').size === 2.321 && box(G('K')) === J([7.215, 4.715, 5.571, 5.571])
		&& box(G('S')) === J([1, 1, 18, 1.857]), box(G('T')) + box(G('K')) + box(G('S')) + G('T').size);
	t.undo();
	t.resizeLabel(50, 30, { scaleContent:false });
	ok('resizeLabel zonder meeschalen: kader volgt wel', G('T').x === 5 && G('T').w === 30 && box(G('R')) === J([1, 1, 46, 28]));
	t.undo(); t.doc.layout.autoTidy = false; t.resizeLabel(30, 30);
	ok('resizeLabel: default uit layout.autoTidy', G('T').w === 30 && t.doc.label.w === 30);
	t.undo(); t.doc.layout.autoTidy = true;
	t.resizeLabel(0, 30);
	ok('resizeLabel: ongeldige maat = niets', t.doc.label.w === 40 && !t.canUndo());
	// Maat heen en terug (ook via een andere verhouding) = weer het begin, niet elke rondgang kleiner.
	const r0 = J(t.doc.elements);
	t.resizeLabel(50, 30); t.resizeLabel(40, 30);
	const r1 = J(t.doc.elements);
	t.resizeLabel(40, 60);
	const d60 = aabb(G('D'));
	// Kwartslag: de box wisselt w/h, dus de hoogte van het kader (sy) gaat naar el.w.
	ok('resizeLabel: gedraaide tekst (90 graden) wordt hoger, niet breder', Math.abs(d60.h / d0.h - 58 / 28) < 1e-3 && Math.abs(d60.w - d0.w) < 1e-3, J([d0, d60]));
	t.resizeLabel(50, 30); t.resizeLabel(40, 30);
	ok('resizeLabel: heen en terug = begintoestand', r1 === r0 && J(t.doc.elements) === r0 && t.doc.label.w === 40, J([G('T').size, G('K').w]));
	t.undo();
	ok('resizeLabel: undo na heen en terug = vorige maat', t.doc.label.w === 50 && G('T').size === 5, J([t.doc.label, G('T').size]));
	// Bewerking tussen twee maatwijzigingen = nieuwe basis: de tweede maatwijziging zet hem niet stil terug.
	t.replace(L(40, 30, [{ type:'shape', id:'S', x:5, y:5, w:10, h:5 }]), { history:false });
	t.resizeLabel(50, 30); G('S').x = 20; t.changed(); t.resizeLabel(40, 30);
	ok('resizeLabel: bewerking tussen twee maatwijzigingen blijft staan', G('S').x === 16.667, box(G('S')));
	// Rond: inhoud als groep binnen de cirkel/ellips, ook als alleen de vorm wisselt; terug naar rechthoek = het begin.
	t.replace(L(40, 30, [{ type:'text', id:'T', x:1.5, y:1.5, w:37, h:12, size:5 }, { type:'shape', id:'K', x:1.5, y:16, w:37, h:12 }]), { history:false });
	const rr0 = J(t.doc.elements), inOval = () => { const { w, h } = t.doc.label;
		return t.doc.elements.every(e => [[e.x, e.y], [e.x + e.w, e.y], [e.x, e.y + e.h], [e.x + e.w, e.y + e.h]].every(([x, y]) => ((x - w / 2) / (w / 2)) ** 2 + ((y - h / 2) / (h / 2)) ** 2 <= 1)); };
	t.resizeLabel(40, 30, { shape:'round' });
	const ov1 = inOval() && t.doc.label.shape === 'round' && t.canUndo();
	t.resizeLabel(30, 30);
	const ov2 = inOval();
	t.resizeLabel(40, 30, { shape:'rect' });
	ok('resizeLabel rond: inhoud binnen de cirkel (ook alleen de vorm), terug naar rechthoek = begin', ov1 && ov2 && J(t.doc.elements) === rr0 && t.doc.label.shape === 'rect', J([ov1, ov2, t.doc.elements]));

	// --- golf 2-fixes: printbaar vlak volgt draaien/verschuiving, rond label, sessiestaat, vertrouwensgrens ---
	ok('printableArea: 180° draaien = linkerkant valt weg', J(printableArea({ label:{ w:50, h:30 }, print:{ rotate180:true } })) === J({ x:2, y:0, w:48, h:30 }));
	ok('printableArea: X-verschuiving', J(printableArea({ label:{ w:48, h:30 }, print:{ offset:3 } })) === J({ x:0, y:0, w:45, h:30 })
		&& J(printableArea({ label:{ w:50, h:30 }, print:{ offset:3, rotate180:true } })) === J({ x:5, y:0, w:45, h:30 }));
	t.replace({ v:2, label:{ w:50, h:30 }, print:{ rotate180:true }, elements:[{ type:'border', id:'R' }, { type:'shape', id:'S', x:30, y:5, w:10, h:5 }] }, { history:false });
	ok('rand-default binnen het gedraaide printvlak', box(G('R')) === J([3, 1, 46, 28]), box(G('R')));
	t.align(['S'], 'right');
	ok('align rechts op het gedraaide printvlak', G('S').x + G('S').w === 50, box(G('S')));
	t.replace(L(50, 30, [{ type:'shape', id:'S', x:2, y:5, w:45, h:5 }]), { history:false });
	t.align(['S'], 'right'); const sx1 = G('S').x; t.align(['S'], 'hcenter');
	ok('align rechts/midden = 48 mm-vlak, gelijk aan Centreren', sx1 + 45 === 48 && G('S').x === 1.5, J([sx1, G('S').x]));
	const q2 = createElement('qr', {}, { label:{ w:20, h:10 }, elements:[] }), e2 = createElement('emoji', {}, { label:{ w:30, h:15 }, elements:[] });
	ok('createElement: verhouding-vaste types uniform geklemd', q2.w === q2.h && q2.h <= 7 && e2.w === e2.h && e2.h <= 12, J([q2.w, q2.h, e2.w, e2.h]));
	const inCircle = e => [[e.x, e.y], [e.x + e.w, e.y], [e.x, e.y + e.h], [e.x + e.w, e.y + e.h]].every(([x, y]) => Math.hypot(x - 15, y - 15) <= 15 - 1.5 + 1e-3);
	t.replace({ v:2, label:{ w:30, h:30, shape:'round' }, elements:[] }, { history:false });
	const rq = t.place(createElement('qr', {}, t.doc)), rqw = rq.w, rt = t.place(createElement('text', { text:'Oregano' }, t.doc));
	ok('rond label: plaatsen/vullen binnen de cirkel (min marge), qr maakt plaats', inCircle(rq) && inCircle(rt) && rqw > 18 && !hit(aabb(rq), aabb(rt)), box(rq) + box(rt));
	t.tidy();
	ok('rond label: netjes maken binnen de cirkel', t.doc.elements.every(inCircle), J(t.doc.elements.map(box)));
	t.replace(L(40, 30, [{ type:'icon', id:'K', x:1.5, y:1.5, w:8, h:8, locked:true }, { type:'text', id:'A', x:12, y:2, w:20, h:5 }, { type:'text', id:'B', x:12, y:12, w:20, h:5 }]), { history:false });
	t.tidy();
	ok('tidy: vergrendeld element is een obstakel (geen overlap)', !hit(aabb(G('A')), aabb(G('K'))) && !hit(aabb(G('B')), aabb(G('K'))) && box(G('K')) === J([1.5, 1.5, 8, 8]), box(G('A')) + box(G('B')));
	t.replace(L(40, 30, [{ type:'text', id:'T', x:1, y:1 }]), { history:false });
	G('T').x = 5; t.changed();
	t.session(D => { D.counter.start = 6; D.batch.row = 3; });
	t.undo();
	const sOk = G('T').x === 1 && t.doc.counter.start === 6 && t.doc.batch.row === 3;
	t.redo();
	ok('sessiestaat (teller/rij) overleeft undo en redo', sOk && t.doc.counter.start === 6 && G('T').x === 5);
	const bad = migrate('{"v":2,"label":{"w":100000,"h":30},"elements":[{"type":"constructor"},{"type":"toString"},{"type":"__proto__"},{"type":"shape","w":1e9}]}');
	ok('migrate: prototype-namen geen type, labelmaat en elementmaat begrensd', bad.elements.length === 1 && bad.label.w === 100 && bad.elements[0].w === 400, J(bad));
	const bad1 = migrate({ w:40, h:30, elements:[{ type:'constructor' }, { type:'__proto__' }, { type:'toString' }, { type:'text', text:'x' }] });
	ok('migrate v1: prototype-namen geen type', J(bad1.elements.map(e => e.type)) === J(['text']), J(bad1.elements));
	const png = 'data:image/png;base64,' + btoa('\x89PNG\r\n\x1a\n\0\0\0\rIHDR\0\0\0\x28\0\0\0\x14\x08\x06\0\0\0');
	const v1i = migrate({ w:40, h:30, elements:[{ type:'image', src:png, w:20, x:2, y:2 }, { type:'image', src:'data:image/jpeg;base64,AA', w:16 }] }).elements;
	ok('v1-afbeelding houdt zijn verhouding (PNG-kop)', v1i[0].w === 20 && v1i[0].h === 10 && v1i[1].h === 16, J(v1i.map(box)));

	// --- golf 3: invulvelden + regels (migratie/validatie) ---
	const fd = migrate({ v:2, label:{ w:40, h:30 }, fields:[
		{ key:' Strain', label:'Naam', type:'text', value:'Amnesia', placeholder:'Strain-naam', extra:1 }, { key:'strain', type:'text', value:'dubbel' }, { key:'th c', type:'number' },
		{ key:'thc', type:'number', suffix:'%', value:22 }, { key:'type', label:'Soort', type:'choice', options:['Indica', 'Hybride', 'Sativa', 'Sativa', ' ', 3], value:'Paars' },
		{ key:'leeg', type:'choice', options:[], value:'x' }, { key:'d', type:'date', value:'2026-02-30', offset:2.6 }, { key:'d2', type:'date', value:'2026-03-01' },
		{ key:'bio', type:'toggle', value:'ja' }, { key:'raar', type:'kleur', value:'rood' }, null, 'x',
	], elements:[{ type:'text', id:'T', rules:[{ field:'Type', equals:'Hybride', set:{ invert:true, opacity:0 } }, { field:'bio', equals:true, set:{} },
		{ field:'bio', equals:false, set:{ hidden:true } }, { field:'x y', set:{ hidden:true } }, null, { field:'thc', equals:22, set:{ hidden:false } }] }] });
	ok('migrate: velden gevalideerd (key a-z0-9 uniek, types, opties, datum, toggle)', J(fd.fields) === J([
		{ key:'strain', label:'Naam', type:'text', value:'Amnesia', placeholder:'Strain-naam' }, { key:'thc', label:'thc', type:'number', value:'22', placeholder:'', suffix:'%' },
		{ key:'type', label:'Soort', type:'choice', options:['Indica', 'Hybride', 'Sativa', '3'], value:'Indica' }, { key:'leeg', label:'leeg', type:'text', value:'x', placeholder:'' },
		{ key:'d', label:'d', type:'date', value:'', offset:3 }, { key:'d2', label:'d2', type:'date', value:'2026-03-01', offset:0 },
		{ key:'bio', label:'bio', type:'toggle', value:false }, { key:'raar', label:'raar', type:'text', value:'rood', placeholder:'' }]), J(fd.fields));
	ok('migrate: regels gevalideerd (set ⊆ invert/hidden)', J(fd.elements[0].rules) === J([{ field:'type', equals:'Hybride', set:{ invert:true } },
		{ field:'bio', equals:false, set:{ hidden:true } }, { field:'thc', equals:'22', set:{ hidden:false } }]), J(fd.elements[0].rules));
	ok('migrate: oude docs krijgen fields [] en rules []', J(migrate(dup(v1)).fields) === '[]' && migrate(dup(v1)).elements.every(e => J(e.rules) === '[]')
		&& J(newDoc(LABEL).fields) === '[]' && J(ELEMENT_DEFAULTS.text.rules) === '[]' && createElement('shape', { rules:[{ field:'a', equals:'b', set:{ hidden:true } }] }, d40).rules.length === 1);
	ok('migrate met velden is idempotent', J(migrate(fd)) === J(fd));

	// --- adaptTemplate: jouw rol is leidend ---
	const R40 = { w:40, h:30, shape:'rect' }, P40 = { x:0, y:0, w:40, h:30 }, inP = (D, P = printableArea(D)) => D.elements.every(e => inA(aabb(e), P));
	const tpl40 = { label:{ ...R40 }, fields:[{ key:'naam', type:'text', value:'A' }], elements:[{ type:'border', id:'R' }, { type:'text', id:'T', text:'{naam}', x:3, y:3, w:30, h:8 }] };
	ok('adaptTemplate: exacte maat = ongewijzigd (alleen genormaliseerd)', J(adaptTemplate(tpl40, R40)) === J(normalizeTemplateDoc(tpl40)) && adaptTemplate(tpl40, R40).fields[0].key === 'naam');
	const tpl50 = { label:{ w:50, h:30, shape:'rect' }, fields:[{ key:'naam', type:'text', value:'A' }], elements:[
		{ type:'border', id:'R', style:'double', x:1, y:1, w:46, h:28 }, { type:'text', id:'T1', text:'{naam}', x:4, y:4, w:40, h:7, size:6, fit:'shrink' },
		{ type:'icon', id:'K', x:4, y:12, w:12, h:12 }, { type:'text', id:'T2', text:'THC 22%', x:18, y:12, w:26, h:5, size:3, fit:'fill' },
		{ type:'text', id:'T3', text:'1 gram', x:18, y:18, w:26, h:5, size:3 }, { type:'shape', id:'S', shape:'rect', fill:'black', stroke:0, x:4, y:24.5, w:40, h:2 } ] };
	const before50 = J(tpl50), a50 = adaptTemplate(tpl50, R40), A = id => a50.elements.find(e => e.id === id), src = id => tpl50.elements.find(e => e.id === id);
	const k50 = (40 - 2 * 2.7 - 2) / (48 - 2 * 2.7 - 2);   // binnenvlak (rand 1 mm + 2x lijn + marge) doel / bron
	ok('adaptTemplate 50x30 -> 40x30: maat, kader, binnen printbaar vlak, input ongewijzigd', J(a50.label) === J(R40) && box(A('R')) === J([1, 1, 38, 28]) && inP(a50) && J(tpl50) === before50, J(a50.elements.map(box)));
	ok('adaptTemplate: uniform geschaald (icoon vierkant, lettergrootte)', Math.abs(A('K').w - 12 * k50) < 2e-3 && A('K').w === A('K').h && Math.abs(A('T2').size - 3 * k50) < 2e-3
		&& Math.abs(A('T1').w - 40 * k50) < 2e-3 && Math.abs(A('S').h - 2 * k50) < 2e-3, J([A('K').w, A('T2').size, k50]));
	const ids50 = ['T1', 'K', 'T2', 'T3', 'S'], pairs = ids50.flatMap((a, i) => ids50.slice(i + 1).map(b => [a, b]));
	ok('adaptTemplate: geen nieuwe overlap', pairs.every(([a, b]) => hit(aabb(src(a)), aabb(src(b))) || !hit(aabb(A(a)), aabb(A(b)))), J(a50.elements.map(box)));
	ok('adaptTemplate: tekst groeit mee in de vrije as (fit blijft)', A('T2').h > 5 * k50 + .1 && A('T1').h > 7 * k50 + .1 && A('T2').fit === 'fill' && A('T3').fit === 'none'
		&& Math.abs(A('T2').w - 26 * k50) < 2e-3 && A('T3').h > 5 * k50 + .1, J([A('T1').h, A('T2').h, A('T3').h, 5 * k50]));
	const tplR = { label:{ w:40, h:40, shape:'round' }, elements:[{ type:'shape', id:'E', shape:'ellipse', x:2, y:2, w:36, h:36 },
		{ type:'emoji', id:'M', x:14.5, y:5.6, w:11, h:11 }, { type:'text', id:'T', text:'Spacecake', x:6, y:16.4, w:28, h:9.2, fit:'shrink' }] };
	const aR = adaptTemplate(tplR, R40), AR = id => aR.elements.find(e => e.id === id), kR = 27 / 37;
	ok('adaptTemplate rond 40 -> 40x30: rond-masker vervalt, cirkel blijft rond + gecentreerd, binnen printbaar vlak', J(aR.label) === J(R40) && inP(aR)
		&& AR('E').w === AR('E').h && Math.abs(AR('E').w - 36 * kR) < 2e-3 && Math.abs(AR('E').x + AR('E').w / 2 - 20) < 2e-3 && Math.abs(AR('E').y + AR('E').h / 2 - 15) < 2e-3, J(aR.elements.map(box)));
	ok('adaptTemplate rond: tekst binnen een ronde vorm groeit niet', Math.abs(AR('T').w - 28 * kR) < 2e-3 && Math.abs(AR('T').h - 9.2 * kR) < 2e-3, box(AR('T')));
	const aRr = adaptTemplate(tplR, { w:40, h:40 });
	ok('adaptTemplate rond -> rechthoek zelfde maat: alleen het masker vervalt', aRr.label.shape === 'rect' && J(aRr.elements.map(box)) === J(normalizeTemplateDoc(tplR).elements.map(box)), J(aRr.elements.map(box)));
	const tpl30 = { label:{ w:30, h:20 }, elements:[{ type:'shape', id:'B', shape:'rect', fill:'black', x:0, y:0, w:30, h:5 }, { type:'qr', id:'Q', x:20, y:7, w:10, h:10 }, { type:'border', id:'R', style:'rounded' }] };
	const a30 = adaptTemplate(tpl30, R40), b30 = a30.elements.find(e => e.id === 'B');
	ok('adaptTemplate 30x20 -> 40x30: opschalen, uitstekende inhoud blijft binnen printbaar vlak, ronde rand blijft', inP(a30, P40) && b30.w > 30 && b30.w <= 40 + 1e-3
		&& a30.elements.find(e => e.id === 'R').style === 'rounded' && box(a30.elements.find(e => e.id === 'R')) === J([1, 1, 38, 28]), J(a30.elements.map(box)));
	// Strak tegen het kader (zijbalk zoals 'Geopend op'): blijft strak, steekt niet over het kader, de rest blijft binnen het kader.
	const tplB = { label:{ w:30, h:15 }, elements:[{ type:'border', id:'R', x:1, y:1, w:28, h:13, stroke:0.4 }, { type:'text', id:'O', text:'OPEN', invert:true, x:1, y:1, w:10, h:13, fit:'shrink' },
		{ type:'text', id:'T', text:'{datum}', x:12.5, y:4.9, w:16, h:3.6, fit:'shrink' }] };
	const aB = adaptTemplate(tplB, R40), AB = id => aB.elements.find(e => e.id === id), O = AB('O');
	ok('adaptTemplate: balk strak tegen het kader blijft strak (L/T/B), alles binnen het kader', O.x === 1 && O.y === 1 && Math.abs(O.y + O.h - 29) < 2e-3 && O.w > 5
		&& aB.elements.every(e => inA(aabb(e), { x:1, y:1, w:38, h:28 })) && !hit(aabb(O), aabb(AB('T'))), J(aB.elements.map(box)));
	const aP = adaptTemplate(tpl40, { w:50, h:30 }, { print:{ rotate180:true, offset:0 } }), PP = printableArea(aP);
	ok('adaptTemplate: printbaar vlak van jouw printer (180 graden: linkerkant valt weg)', aP.print.rotate180 && PP.x === 2 && inP(aP) && aP.elements[0].x === 3, J([PP, aP.elements.map(box)]));
	const aP50 = adaptTemplate(tpl50, { w:50, h:30 }, { print:{ rotate180:true } });
	ok('adaptTemplate zelfde maat, ander printbaar vlak (180 graden): schuift mee', inP(aP50) && printableArea(aP50).x === 2
		&& J(adaptTemplate(tpl50, { w:50, h:30 })) === J(normalizeTemplateDoc(tpl50)), J(aP50.elements.map(box)));
	// Standaard verborgen chip die een veldregel toont (BIO): tekst groeit er niet onder.
	const tplC = { label:{ ...R40 }, fields:[{ key:'bio', type:'toggle', value:true }], elements:[{ type:'text', id:'T', text:'THC', x:3, y:20, w:26, h:3 },
		{ type:'shape', id:'C', x:30, y:20, w:6, h:3, hidden:true, rules:[{ field:'bio', equals:true, set:{ hidden:false } }] }] };
	const aC = adaptTemplate(tplC, { w:50, h:30 }), AC = id => aC.elements.find(e => e.id === id);
	ok('adaptTemplate: tekst groeit niet onder een keuze-chip (verborgen + regel)', !hit(aabb(AC('T')), aabb(AC('C'))) && AC('T').w > 26, box(AC('T')) + box(AC('C')));
	const aRound = adaptTemplate(tpl40, { w:30, h:30, shape:'round' });
	ok('adaptTemplate rechthoek -> rond: binnen de cirkel', aRound.label.shape === 'round' && aRound.elements.filter(e => e.type !== 'border').every(inCircle), J(aRound.elements.map(box)));

	// --- store: setField / makeField / makeChoice / removeField ---
	const f = makeStore(false).init(), FG = id => f.doc.elements.find(e => e.id === id), fv = k => f.doc.fields.find(x => x.key === k);
	f.replace({ v:2, fields:[{ key:'verpakt', type:'date' }, { key:'naam', type:'text', value:'Amnesia' }], elements:[
		{ id:'D', type:'text', text:'Packing date: {verpakt}' }, { id:'Q', type:'qr', data:'{ VERPAKT|wifi}' },
		{ id:'R', type:'shape', rules:[{ field:'verpakt', equals:'', set:{ hidden:true } }] },
		{ id:'N', type:'text', text:'{naam}' }, { id:'H', type:'text', text:'Packing date' } ] }, { history:false });
	f.select(['D', 'N']);
	const beforeDeleteField = J(f.doc);
	ok('deleteField verwijdert veld, gekoppelde tekst/code/regels en expliciet templatekopje en snoeit selectie', f.deleteField('verpakt', ['H'])
		&& !fv('verpakt') && J(f.doc.elements.map(e => e.id)) === J(['N']) && J(f.selection) === J(['N']));
	f.undo();
	ok('deleteField herstelt veld en label samen met één undo', J(f.doc) === beforeDeleteField && !f.canUndo());
	FG('D').locked = true;
	ok('deleteField beschermt vergrendelde onderdelen zonder gedeeltelijke wijziging', !f.deleteField('verpakt', ['H']) && !!fv('verpakt') && f.doc.elements.length === 5);
	const compact = { label: { w:40, h:30 }, print: {}, elements: [
		{ id:'a', type:'text', x:3, y:16, w:10, h:3 }, { id:'b', type:'text', x:3, y:19, w:10, h:5 },
		{ id:'c', type:'text', x:27, y:16, w:10, h:3 }, { id:'d', type:'text', x:27, y:19, w:10, h:5 },
	] };
	reflowPreset(compact);
	ok('preset: lege middenkolom sluit, kop en waarde blijven samen en groep staat midden',
		compact.elements[0].x === compact.elements[1].x && compact.elements[2].x === compact.elements[3].x
		&& Math.abs(compact.elements[0].x + compact.elements[2].x + 10 - 40) < .01
		&& compact.elements[2].x - compact.elements[0].x === 11.5);
	const compactOnce = J(compact); reflowPreset(compact);
	ok('preset: herverdelen is stabiel', J(compact) === compactOnce);
	compact.elements[0].locked = true; const lockedCompact = J(compact); reflowPreset(compact);
	ok('preset: vergrendelde inhoud blijft beschermd', J(compact) === lockedCompact);
	f.replace({ v:2, label:{ w:40, h:30 }, fields:[{ key:'naam', type:'text', value:'A' }, { key:'soort', type:'choice', options:['Indica', 'Sativa'], value:'Indica' },
		{ key:'bio', type:'toggle', value:false }, { key:'tht', type:'date', value:'', offset:3 }, { key:'thc', type:'number', value:'20' }], elements:[{ type:'text', id:'N', text:'{naam}' }] }, { history:false });
	f.setField('naam', 'Am'); f.setField('naam', 'Amnesia'); f.setField('soort', 'Sativa'); f.setField('bio', true); f.setField('thc', 22);
	ok('setField: waarden + validatie', fv('naam').value === 'Amnesia' && fv('soort').value === 'Sativa' && fv('bio').value === true && fv('thc').value === '22'
		&& !f.setField('soort', 'Paars') && !f.setField('nope', 'x') && !f.setField('bio', 'ja') && !f.setField('tht', '2026-13-01') && !f.setField('tht', '0026-05-01')
		&& f.setField('tht', '2026-12-01') && f.setField('tht', ''));
	f.undo(); f.undo(); f.undo(); f.undo();   // tht (2x gezet = 1 stap), thc, bio, soort
	const u3 = [fv('thc').value, fv('bio').value, fv('soort').value, fv('naam').value];
	f.undo();
	ok('setField: tikken in één veld = 1 undo-stap', J(u3) === J(['20', false, 'Indica', 'Amnesia']) && fv('naam').value === 'A' && !f.canUndo(), J(u3) + fv('naam').value);
	f.replace({ v:2, label:{ w:40, h:30 }, fields:[{ key:'amnesia', type:'text', value:'x' }], elements:[{ type:'text', id:'T', text:'Amnesia', name:'Tekst' },
		{ type:'text', id:'U', text:'Datum', name:'Tekst 3' }, { type:'text', id:'V', text:'Prijs {prijs}' }, { type:'text', id:'W', text:'Strain', name:'Strain-naam' }, { type:'shape', id:'S' }] }, { history:false });
	const mf = f.makeField('T'), md = f.makeField('U'), mw = f.makeField('W');
	ok('makeField: tekst -> veld, element toont {key}, keys uniek en niet ingebouwd', mf.key === 'amnesia2' && mf.label === 'Amnesia' && mf.value === 'Amnesia' && FG('T').text === '{amnesia2}'
		&& fieldValues(f.doc.fields).display.amnesia2 === 'Amnesia' && md.key === 'datum2' && mw.key === 'strainnaam' && mw.label === 'Strain-naam'
		&& f.makeField('V') === null && f.makeField('S') === null && f.makeField('x') === null && f.doc.fields.length === 4, J(f.doc.fields));
	f.undo();
	ok('makeField: 1 undo-stap', FG('W').text === 'Strain' && f.doc.fields.length === 3);
	// golf 4: label kort (tot ':' of 16 tekens op woordgrens, geen leestekens aan het eind); el.name gaat voor de tekst
	const LT = ['Ingrediënten: suiker, bloem', 'Houdbaar tot en met juni', 'Prijs per stuk, incl. btw', 'Supercalifragilisticexpi', 'Gram.', '\n  THC 22%\nx', ':)'];
	f.replace({ v:2, label:{ w:40, h:30 }, elements:[...LT.map((text, i) => ({ type:'text', id:'L' + i, text, name:'Tekst ' + i })), { type:'text', id:'LN', text:'x', name:'Naam van de klant, voluit' }] }, { history:false });
	const ml = [...LT.map((_, i) => f.makeField('L' + i).label), f.makeField('LN').label];
	ok('makeField: label kort en netjes', J(ml) === J(['Ingrediënten', 'Houdbaar tot en', 'Prijs per stuk', 'Supercalifragili', 'Gram', 'THC 22%', 'Veld', 'Naam van de']), J(ml));
	f.replace({ v:2, label:{ w:40, h:30 }, elements:[
		{ type:'shape', id:'SI', shape:'rect', x:1, y:20, w:12, h:6 }, { type:'text', id:'I', text:'Indica', x:2, y:21, w:10, h:4 },
		{ type:'text', id:'H', text:'Hybride', x:14, y:21, w:10, h:4, invert:true }, { type:'text', id:'S', text:'Sativa ', x:26, y:21, w:10, h:4 },
		{ type:'shape', id:'X', shape:'star', x:30, y:2, w:5, h:5 }, { type:'text', id:'Z', text:'{datum}', x:2, y:2, w:20, h:4 } ] }, { history:false });
	const mc = f.makeChoice(['SI', 'I', 'H', 'S', 'X', 'Z']), inv = id => applyRules(FG(id), fieldValues(f.doc.fields).raw).invert;
	ok('makeChoice: teksten = opties, omgekeerde = gekozen, invert-regels (ook vorm om de tekst)', mc.key === 'keuze' && mc.type === 'choice' && J(mc.options) === J(['Indica', 'Hybride', 'Sativa'])
		&& mc.value === 'Hybride' && !inv('I') && inv('H') && !inv('S') && !inv('SI') && !FG('H').invert && FG('SI').rules[0].equals === 'Indica' && !FG('X').rules.length && !FG('Z').rules.length, J(f.doc.elements.map(e => e.rules)));
	f.setField('keuze', 'Indica');
	ok('makeChoice: kiezen = highlight wisselt', inv('I') && inv('SI') && !inv('H') && f.makeChoice(['I']) === null && f.makeChoice(['I', 'Z']) === null);
	const repeatChoice = f.makeChoice(['SI', 'I', 'H', 'S', 'X', 'Z']);
	f.setField(repeatChoice.key, 'Sativa');
	ok('makeChoice nogmaals: bestaand veld, alleen nieuwe keuze gemarkeerd', repeatChoice === mc && f.doc.fields.length === 1
		&& !inv('I') && !inv('SI') && !inv('H') && inv('S'));
	f.setField('keuze', 'Indica');
	f.removeField('keuze');
	ok('removeField: regels vastgezet zoals ze uitpakken', FG('I').invert && FG('SI').invert && !FG('H').invert && f.doc.elements.every(e => !e.rules.length) && !f.doc.fields.length);
	f.replace({ v:2, label:{ w:40, h:30 }, elements:[{ type:'text', id:'I', text:'Indica', x:2, y:21, w:10, h:4 }, { type:'text', id:'S', text:'Sativa', x:26, y:21, w:10, h:4 },
		{ type:'shape', id:'SI', shape:'rect', x:1, y:20, w:12, h:6 }] }, { history:false });
	const zc = f.makeChoice(['I', 'S', 'SI']), zi = id => f.doc.elements.findIndex(e => e.id === id);
	ok('makeChoice: kader boven zijn tekst gaat eronder (omgekeerd vlak wist de tekst niet)', zc && zi('SI') < zi('I') && zi('I') < zi('S') && FG('SI').rules[0].equals === 'Indica', J(f.doc.elements.map(e => e.id)));
	f.replace({ v:2, label:{ w:40, h:30 }, elements:[{ type:'shape', id:'SH', shape:'rect', x:13, y:20, w:12, h:6, invert:true }, { type:'text', id:'I', text:'Indica', x:2, y:21, w:10, h:4 },
		{ type:'text', id:'H', text:'Hybride', x:14, y:21, w:10, h:4 }, { type:'text', id:'S', text:'Sativa', x:26, y:21, w:10, h:4 }] }, { history:false });
	const hc = f.makeChoice(['SH', 'I', 'H', 'S']);
	ok('makeChoice: omgekeerde vorm om een optie = gekozen waarde (highlight blijft)', hc.value === 'Hybride' && inv('SH') && !inv('I'), hc.value);
	f.replace({ v:2, label:{ w:40, h:30 }, elements:[{ type:'shape', id:'K', shape:'rect', x:2, y:10, w:36, h:9 }, { type:'text', id:'I', text:'Indica', x:3, y:12, w:10, h:4 },
		{ type:'text', id:'H', text:'Hybride', x:15, y:12, w:10, h:4 }, { type:'text', id:'S', text:'Sativa', x:27, y:12, w:10, h:4 }] }, { history:false });
	const kc = f.makeChoice(['K', 'I', 'H', 'S']);
	ok('makeChoice: kader om meer opties krijgt geen regel (geen zwart vlak onder de opties)', kc && !FG('K').rules.length && FG('H').rules.length === 1, J(FG('K').rules));
	f.replace({ v:2, label:{ w:40, h:30 }, fields:[{ key:'tht', type:'date', value:'', offset:3 }, { key:'vast', type:'date', value:'2026-01-30', offset:-1 },
		{ key:'prijs', type:'number', value:'4,50' }, { key:'bio', type:'toggle', value:true }, { key:'nu', type:'date', value:'' }],
		elements:[{ type:'text', id:'T', text:'THT {tht} / {Vast} / {prijs} euro / bio {bio} / {tht} / {nu} / {x}' }, { type:'qr', id:'Q', data:'p={prijs}' }] }, { history:false });
	for (const k of ['tht', 'vast', 'prijs', 'bio', 'nu']) f.removeField(k);
	ok('removeField: tokens -> huidige waarde (datum van vandaag blijft dynamisch)', FG('T').text === 'THT {datum+3} / 29-01-2026 / 4,50 euro / bio ja / {datum+3} / {datum} / {x}'
		&& FG('Q').data === 'p=4,50' && !f.doc.fields.length && f.removeField('x') === false, FG('T').text);
	f.replace({ v:2, label:{ w:40, h:30 }, fields:[{ key:'ssid', type:'text', value:'Huis;Net' }, { key:'tht', type:'date', value:'', offset:3 }],
		elements:[{ type:'qr', id:'Q', data:'WIFI:S:{ssid|wifi};P:{tht|wifi};;' }, { type:'text', id:'T', text:'{ssid}' }] }, { history:false });
	f.removeField('ssid'); f.removeField('tht');
	ok('removeField: filter-token {x|wifi} -> gefilterde waarde (datum van vandaag blijft dynamisch mét filter)',
		FG('Q').data === String.raw`WIFI:S:Huis\;Net;P:{datum+3|wifi};;` && FG('T').text === 'Huis;Net', FG('Q').data);
	f.replace({ v:2, fields:[{ key:'naam', label:'Strain', value:'Amnesia' }, { key:'tht', type:'date', value:'', offset:3 }, { key:'bio', type:'toggle', value:true }],
		elements:[{ id:'T', type:'text', text:'{naam|wifi} / {tht}', rules:[{ field:'bio', equals:false, set:{ hidden:true } }] }] }, { history:false });
	const preview = { Strain:'OG;Kush', tht:'31-12-2026', bio:'nee' };
	for (const key of ['naam', 'tht', 'bio']) f.removeField(key, preview);
	ok('removeField met lijstrij: zichtbare waarden, filter, letterlijke datum en regels blijven', FG('T').text === String.raw`OG\;Kush / 31-12-2026`
		&& FG('T').hidden && !FG('T').rules.length && !f.doc.fields.length, J(FG('T')));
	f.undo();
	ok('removeField met lijstrij: undo herstelt veld en regel', f.doc.fields[0].key === 'bio' && FG('T').rules.length === 1 && !FG('T').hidden);
	f.replace({ v:2, fields:[{ key:'bio', type:'toggle', value:true }], elements:[
		{ id:'A', type:'text', text:'Indica', rules:[{ field:'bio', equals:true, set:{ hidden:true } }] },
		{ id:'B', type:'text', text:'Sativa' }, { id:'C', type:'text', text:'Hybride' }] }, { history:false });
	f.makeChoice(['A', 'B']);
	const expanded = f.makeChoice(['A', 'B', 'C']);
	f.setField(expanded.key, 'Sativa');
	ok('makeChoice uitbreiden: nieuwe groep bepaalt highlight, oude verbergregel blijft', !inv('A') && inv('B') && !inv('C')
		&& applyRules(FG('A'), fieldValues(f.doc.fields).raw).hidden);
	f.replace({ v:2, fields:['a', 'b', 'c'].map(key => ({ key, type:'toggle', value:true })), elements:[{ id:'T', type:'text', text:'x', rules:[
		{ field:'a', equals:true, set:{ invert:false, hidden:true } }, { field:'b', equals:true, set:{ invert:true } },
		{ field:'c', equals:false, set:{ invert:false } }, { field:'b', equals:false, set:{ hidden:false } }] }] }, { history:false });
	const beforeRemove = dup(FG('T'));
	f.removeField('b');
	ok('removeField: regelvolgorde en andere properties blijven voor alle overige keuzes gelijk',
		[true, false].every(a => [true, false].every(c => J(applyRules(beforeRemove, { a, b:true, c })) === J(applyRules(FG('T'), { a, c }))))
		&& FG('T').rules.length === 2 && J(FG('T').rules[0].set) === J({ hidden:true }), J(FG('T')));
	f.undo();
	ok('removeField regelvolgorde: undo herstelt alle oorspronkelijke regels', J(FG('T')) === J(beforeRemove) && f.doc.fields.length === 3);

	// --- opslag: alleen in node met nep-opslag; in de browser nooit de echte opslag aanraken ---
	if (typeof localStorage === 'undefined') {
		const desc = { configurable:true, get() { throw new Error('SecurityError'); } };
		Object.defineProperty(globalThis, 'localStorage', desc);
		try { ok('init als localStorage gooit', makeStore(true).init().doc.elements.length === 1); }
		catch (e) { ok('init als localStorage gooit', false, e.message); }
		finally { delete globalThis.localStorage; }
		const mem = {};
		let full = false;
		globalThis.localStorage = { getItem:k => k in mem ? mem[k] : null, setItem:(k, v) => { if (full) throw new Error('QuotaExceededError'); mem[k] = String(v); } };
		try {
			mem[V1_TPL] = J({ Oud:v1 });
			const l = userTemplates.list();
			ok('templates: v1-migratie', l.length === 1 && l[0].name === 'Oud' && l[0].doc.v === 2 && l[0].doc.elements.length === 7 && TPL in mem && V1_TPL in mem);
			ok('templates: opslaan', userTemplates.save('Nieuw', d) && userTemplates.list().length === 2 && userTemplates.list()[0].doc.batch.csv === '');
			userTemplates.remove('Oud');
			ok('templates: verwijderen', J(userTemplates.list().map(t => t.name)) === J(['Nieuw']));
			ok('templates: naam __proto__ = mislukt (niet stil weg)', !userTemplates.save('__proto__', d) && J(userTemplates.list().map(t => t.name)) === J(['Nieuw']));
			mem[V1_CUR] = J(v1);
			const st = makeStore(true).init();
			ok('init: v1-current gemigreerd + bewaard', st.doc.elements.length === 7 && JSON.parse(mem[CUR]).v === 2 && V1_CUR in mem);
			mem[CUR] = J(newDoc());
			ok('init: v2 gaat voor v1', makeStore(true).init().doc.elements.length === 1);
			// Tweede venster schrijft het label: overnemen via de storage-listener; een reeks overnames = 1 undo-stap.
			// Vóór andere persist-stores: hun debounced save zou CUR in de wachttijd schrijven.
			const hs = {};
			globalThis.addEventListener = (type, fn) => (hs[type] ||= []).push(fn);
			try {
				const sy = makeStore(true).init(), own = J(sy.doc);
				delete mem[CUR];
				for (const name of ['B1', 'B2']) for (const fn of hs.storage || []) fn({ key:CUR, newValue:J({ ...newDoc(LABEL), name }) });
				await sleep(350);
				const took = sy.doc.name, wrote = CUR in mem; sy.undo();
				ok('tweede venster: label overgenomen, reeks overnames = 1 undo-stap terug naar het eigen label', took === 'B2' && J(sy.doc) === own && !sy.canUndo(), took);
				ok('tweede venster: overname niet terugschrijven', !wrote, mem[CUR]);
			} finally { delete globalThis.addEventListener; }
		const nm = makeStore(true).init();
		nm.doc.name = 'A'; nm.changed(); nm.doc.name = 'B'; nm.changed(); nm.undo();
		const nmU = nm.doc.name; nm.redo();
		ok('naam: undo/redo zet hem mee terug', nmU === 'A' && nm.doc.name === 'B', nmU);
			ok('rollen: standaard = wit 40x30, nieuw label start erop', J(rolls.list()) === J(DEFAULT_ROLLS) && J(newDoc().label) === J(R40) && !(ROLLS in mem));
			ok('rollen: toevoegen, dubbel niet, ongeldig niet', rolls.add({ w:50, h:30 }) && rolls.add({ w:40, h:30, shape:'rect', name:'x' }) && !rolls.add({ w:0, h:30 }) && !rolls.add(null)
				&& J(rolls.list().map(r => r.name)) === J(['Wit 40×30', '50×30']));
			rolls.setDefault(1);
			delete mem[CUR]; delete mem[V1_CUR];
			ok('rollen: standaard kiezen -> nieuw label en eerste start op die rol', rolls.list()[0].w === 50 && newDoc().label.w === 50 && makeStore(true).init().doc.label.w === 50
				&& !rolls.setDefault(5) && !rolls.remove(-1));
			rolls.remove(0);
			ok('rollen: de laatste rol blijft (verwijderen geweigerd)', !rolls.remove(0) && J(rolls.list()) === J(DEFAULT_ROLLS) && J(JSON.parse(mem[ROLLS])) === J(DEFAULT_ROLLS));
			mem[ROLLS] = '[]';
			ok('rollen: lege opslag = weer de standaardrol', J(rolls.list()) === J(DEFAULT_ROLLS));
			mem[ROLLS] = '{kapot'; const kapot = rolls.list();
			mem[ROLLS] = J([{ w:'x' }, { w:30, h:30, shape:'round' }, { w:500, h:30 }]);
			ok('rollen: kapotte opslag gevalideerd', J(kapot) === J(DEFAULT_ROLLS) && J(rolls.list()) === J([{ w:30, h:30, shape:'round', name:'30×30 rond' }]));
			// Opslag vol: één melding per reeks mislukte saves (debounce 300 ms), na herstel en opnieuw vol weer één.
			const sv = makeStore(true).init(), errs = [];
			let nErr = 0;
			sv.on('saveerror', () => nErr++);
			for (const v of [true, true, false, true]) { full = v; sv.changed(); await sleep(350); errs.push(nErr); }
			full = false;
			ok('opslag vol: melding bij de eerste mislukte save, na herstel opnieuw', J(errs) === J([1, 1, 1, 2]), J(errs));
			// Mislukte save, dan ruimte vrij (template wissen = geen wijziging) en sluiten: pagehide bewaart het werk alsnog.
			const hp = {};
			globalThis.addEventListener = (type, fn) => (hp[type] ||= []).push(fn);
			try {
				const sp = makeStore(true).init();
				full = true; sp.doc.name = 'Nieuw werk'; sp.changed(); await sleep(350);
				const leave = () => { let asked = false; for (const fn of hp.beforeunload || []) fn({ preventDefault: () => { asked = true; } }); return asked; }, askFull = leave();
				full = false;
				for (const fn of hp.pagehide || []) fn();
				ok('opslag vol: sluiten na ruimte vrijmaken bewaart alsnog', JSON.parse(mem[CUR]).name === 'Nieuw werk', JSON.parse(mem[CUR]).name);
				ok('opslag vol: sluiten vraagt zolang bewaren mislukt, daarna niet', askFull && !leave());
			} finally { delete globalThis.addEventListener; }
		} catch (e) { ok('opslag-tests', false, e.message); }
		finally { delete globalThis.localStorage; }
	} else details.push('overgeslagen in browser: opslag-tests (echte opslag blijft onaangeroerd)');
	return { ok: res.every(Boolean), details };
}
