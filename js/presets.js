import { ICON_CATEGORIES, WEED_ICONS, ID_RE, loadIconSet } from './icons.js';
import { substitute, fieldValues, applyRules, DPM } from './util.js';
import { adaptTemplate, aabb, FIELD_TYPES, KEY, ELEMENT_DEFAULTS } from './doc.js';
import { FONTS, fontFaces, ensureFont } from './fonts.js';
import { SHAPES, BORDER_STYLES, BARCODES, CODES2D, renderDoc } from './render.js';
import { DITHER_MODES } from './imaging.js';
import legacy, { intoPrintable } from './templates/legacy.js';
import weed from './templates/weed.js';
import home from './templates/home.js';
import office from './templates/office.js';
import fun from './templates/fun.js';

// Gangbare M110-rollen; breedte = dwars over de printkop (max 48 mm printbaar, 50 mm-rollen bestaan).
const R = (w, h, group, extra = '') => ({ id: `${w}x${h}`, name: `${w} × ${h} mm${extra}`, w, h, shape: 'rect', group });
const C = d => ({ id: `r${d}`, name: `Rond ${d} mm`, w: d, h: d, shape: 'round', group: 'Rond' });
export const LABEL_SIZES = [
	R(40, 30, 'Liggend', ' (standaard)'), R(50, 30, 'Liggend'), R(30, 20, 'Liggend'), R(40, 20, 'Liggend'), R(50, 25, 'Liggend'),
	R(50, 40, 'Liggend'), R(30, 15, 'Liggend'), R(25, 15, 'Liggend'), R(20, 10, 'Liggend'), R(48, 30, 'Liggend', ' (volle printbreedte)'),
	R(40, 60, 'Staand'), R(40, 80, 'Staand'), R(50, 70, 'Staand'), R(50, 80, 'Staand'), R(30, 40, 'Staand'),
	R(20, 20, 'Vierkant'), R(25, 25, 'Vierkant'), R(30, 30, 'Vierkant'), R(40, 40, 'Vierkant'), R(50, 50, 'Vierkant'),
	C(20), C(25), C(30), C(40), C(50),
	R(14, 40, 'Smal & kabel', ' (kabel)'), R(15, 30, 'Smal & kabel'), R(15, 50, 'Smal & kabel'),
];

// Categorie-ids gepind in SPEC-wave3; wiet bovenaan.
export const TEMPLATE_CATEGORIES = [
	{ id: 'weed', name: 'Wiet & coffeeshop' },
	{ id: 'kitchen', name: 'Keuken & voorraad' },
	{ id: 'home', name: 'Huis & opslag' },
	{ id: 'garden', name: 'Tuin & planten' },
	{ id: 'office', name: 'Kantoor & archief' },
	{ id: 'shipping', name: 'Verzending & retour' },
	{ id: 'shop', name: 'Winkel & prijzen' },
	{ id: 'inventory', name: 'Inventaris & tech' },
	{ id: 'party', name: 'Feest & cadeau' },
	{ id: 'fun', name: 'Stickers & fun' },
	{ id: 'name', name: 'Naam & school' },
	{ id: 'safety', name: 'Waarschuwing & veiligheid' },
	{ id: 'event', name: 'Evenement' },
	{ id: 'basis', name: 'Basis' },
];
// Oude categorie-ids (legacy.js) blijven geldig maar vallen samen met hun nieuwe tegenhanger: anders staat bv. 'Keuken &
// voorraad' twee keer als chip in de galerij.
const LEGACY_CAT = { weed: 'weed', basis: 'basis', winkel: 'shop', keuken: 'kitchen', verzending: 'shipping', kantoor: 'office',
	huis: 'home', namen: 'name', feest: 'party', waarschuwing: 'safety', stickers: 'fun' };
// Per bestand de categorieën die het mag vullen (SPEC-wave3-tabel); legacy apart.
const FILES = {
	weed: { list: weed, cats: ['weed'] },
	home: { list: home, cats: ['kitchen', 'home', 'garden'] },
	office: { list: office, cats: ['office', 'shipping', 'shop', 'inventory'] },
	fun: { list: fun, cats: ['party', 'fun', 'name', 'safety', 'event'] },
};

// Legacy met dezelfde naam als een nieuw template krijgt '(klassiek)': anders staan er twee gelijke kaartjes in de galerij.
const NEW = Object.values(FILES).flatMap(f => f.list), NEW_NAMES = new Set(NEW.map(t => t.name));
export const TEMPLATES = [
	...NEW,
	...legacy.map(t => ({ ...t, name: NEW_NAMES.has(t.name) ? t.name + ' (klassiek)' : t.name, category: LEGACY_CAT[t.category], tags: [] })),
];

// ———— selftest (puur, draait in node)
// Lijsten uit de modules zelf (hun eigen selftests pinnen ze), anders lopen kopieën hier uit de pas.
const SPEC_FONTS = FONTS.map(f => f.family), SPEC_SHAPES = SHAPES.map(s => s.id), SPEC_BORDERS = BORDER_STYLES.map(s => s.id);
// COMMON = velden die elk type heeft, FIELDS = de eigen velden per type (beide zonder id).
const DEF = ELEMENT_DEFAULTS, COMMON = Object.keys(DEF.text).filter(k => k !== 'id' && Object.values(DEF).every(d => k in d));
const FIELDS = {
	...Object.fromEntries(Object.entries(DEF).map(([t, d]) => [t, Object.keys(d).filter(k => k !== 'id' && !COMMON.includes(k))])),
	image: ['src', 'fit'],   // alleen als lege foto-plek (src '', fit 'cover', zie selftest)
};
const SPEC_DITHER = DITHER_MODES.map(m => m.id);
const ENUMS = {
	align: ['left', 'center', 'right', 'justify'], valign: ['top', 'middle', 'bottom'], fit: ['none', 'shrink', 'fill'],
	fill: ['none', 'black', 'gray'], dash: ['solid', 'dashed', 'dotted'], set: ['outline', 'filled'], ecc: ['L', 'M', 'Q', 'H'],
};
const BAR_SYMS = BARCODES.map(([id]) => id), QR_SYMS = CODES2D.map(([id]) => id);

// shortcut: grove breedte-schatting per teken (Arial-em) x fontfactor, ~10% marge; echte meting kan pas in de browser.
const FONT_W = { 'Arial': 1, 'Arial Black': 1.3, 'Montserrat': 1.12, 'Oswald': 0.8, 'Anton': 0.82, 'Bebas Neue': 0.6, 'Playfair Display': 1,
	'Patrick Hand': 0.86, 'Pacifico': 1.15, 'Dancing Script': 0.88, 'Cinzel': 1.22, 'Great Vibes': 0.82, 'Lato': 0.96, 'Permanent Marker': 1.15,
	'Fredoka': 1.02, 'Roboto Slab': 1.04, 'Bangers': 0.92 };
const CAPS_ONLY = ['Bebas Neue', 'Cinzel'];
function charW(ch, caps) {
	if (caps && /[a-z]/.test(ch)) ch = ch.toUpperCase();
	if (/[iljI.,:;!|'·]/.test(ch)) return 0.28;
	if (/[ftr\-()]/.test(ch)) return 0.34;
	if (/[mwMW%]/.test(ch)) return 0.88;
	if (ch === ' ') return 0.28;
	if (/[A-Z&€]/.test(ch)) return 0.7;
	if (/[0-9a-z_]/.test(ch)) return 0.56;
	return 0.62;
}
function lineWidth(s, el) {
	if (el.font === 'Roboto Mono') return s.length * (0.6 * el.size + (el.letterSpacing || 0));
	const f = (FONT_W[el.font || 'Arial'] || 1.1) * (el.bold ? 1.07 : 1), caps = CAPS_ONLY.includes(el.font);
	let w = 0;
	for (const ch of s) w += charW(ch, caps) * el.size * f + (el.letterSpacing || 0);
	return w;
}
const sample = t => t.replace(/\{datum[+-]?\d*\}/g, '00-00-0000').replace(/\{tijd\}/g, '00:00').replace(/\{teller\}/g, '000').replace(/\{[^}]+\}/g, 'Voorbeeldnaam');
function textFits(el, size, text = sample(el.text)) {
	// letterafstand schaalt mee met de lettergrootte, net als in render.js
	const e = { ...el, size, letterSpacing: (el.letterSpacing || 0) * size / el.size }, lh = el.lineHeight || 1.15;
	let lines = 0;
	for (const para of text.split('\n')) {
		if (el.wrap === false) { if (lineWidth(para, e) > el.w) return false; lines++; continue; }
		let cur = '';
		for (const word of para.split(' ')) {
			const next = cur ? cur + ' ' + word : word;
			if (lineWidth(next, e) <= el.w) cur = next;
			else { if (!cur || lineWidth(word, e) > el.w) return false; lines++; cur = word; }
		}
		lines++;
	}
	return lines * size * lh <= el.h * 1.02;
}
// Wit (dots) dat een QR buiten zijn box nodig heeft voor 4 modules rustzone, slechtste datalengte vanaf versie vmin:
// [links/boven, rechts/onder]. Zoals render: bwip op schaal 1 = 2 dots per module, gehele schaal, op hele dots
// gecentreerd; breder dan box + 1 = 'Code te breed' (wordt niet geprint). Een box die een versie krap vult met grote
// modules vraagt het meeste wit; daarom zijn de QR-maten in de templates hierop gekozen.
function qrNeed(B, vmin = 1) {
	let a = -Infinity, b = -Infinity;
	for (let v = vmin; v <= 40; v++) {
		const m = 17 + 4 * v, d = 2 * Math.max(1, Math.floor(B / (2 * m))), w = m * d;
		if (w > B + 1) break;
		const o = Math.round((B - w) / 2);
		a = Math.max(a, 4 * d - o); b = Math.max(b, 4 * d - (B - w - o));
	}
	return [a, b];
}
// QR-templates met de labelmaat waarop hun rustzone gemeten wordt: de rol van de speler (40x30), wifi ook op zijn eigen
// 50x30. vmin 2 = een wifi-string heeft altijd >= 18 tekens, te veel voor versie 1.
const QR_ROOM = [['weed-qr-strain', 40, 30, 1], ['basis-qr', 40, 30, 1], ['wifi-qr', 40, 30, 2], ['wifi-qr', 50, 30, 2], ['fun-ticket', 40, 30, 1],
	['office-inventaris', 40, 30, 1], ['office-wifi', 40, 30, 2], ['inventaris', 40, 30, 1], ['office-cadeaubon', 40, 30, 1], ['fun-toegang', 40, 30, 1],
	['fun-badge', 40, 30, 1], ['ticket', 40, 30, 1]];
const hasQr = t => !!t?.doc.elements.some(e => e.type === 'qr' && e.symbology === 'qrcode');
// Wit (dots) van de QR-box tot inkt of labelrand [links, boven, rechts, onder] + zwarte dots in de box, op de echte render:
// schaal 1, QR's weg, fonts en iconen geladen. Een box meten kan niet (tekstboxen zijn groter dan hun inkt). Standaard- en
// lange invulling (die vult zijn box); per kant over de box plus de hoeken die de rustzone [a, z] ernaast vraagt.
async function qrRoom(D, [a, z], lib) {
	const q = D.elements.find(e => e.type === 'qr'), x0 = Math.round(q.x * DPM), y0 = Math.round(q.y * DPM), x1 = x0 + Math.round(q.w * DPM), y1 = y0 + Math.round(q.h * DPM);
	const doc = { ...D, elements: D.elements.filter(e => e.type !== 'qr').map(e => e.type === 'icon' && !e.nodes?.length && Object.hasOwn(lib, e.icon) ? { ...e, nodes: lib[e.icon] } : e) };
	await Promise.all(doc.elements.filter(e => e.type === 'text').map(e => ensureFont(e.font || 'Arial', { bold: !!e.bold, italic: !!e.italic })));
	const long = (D.fields || []).map(f => f.type === 'text' ? { ...f, value: 'W'.repeat(40) } : f.type === 'number' ? { ...f, value: '8'.repeat(12) } : f);
	const cv = document.createElement('canvas'), out = [Infinity, Infinity, Infinity, Infinity, 0];
	for (const fields of [D.fields || [], long]) {
		let r = renderDoc(cv, doc, { fields });
		// iconen en het emoji-font laden async
		for (let i = 0; r.pending && i < 100; i++) { await new Promise(res => setTimeout(res, 50)); r = renderDoc(cv, doc, { fields }); }
		const { W, H } = r, p = cv.getContext('2d').getImageData(0, 0, W, H).data, white = (x, y) => x >= 0 && y >= 0 && x < W && y < H && p[(y * W + x) * 4] > 0;
		const run = (x, y, dx, dy) => { let n = 0; while (white(x, y)) { n++; x += dx; y += dy; } return n; };
		for (let y = Math.max(0, y0 - a); y < Math.min(H, y1 + z); y++) { out[0] = Math.min(out[0], run(x0 - 1, y, -1, 0)); out[2] = Math.min(out[2], run(x1, y, 1, 0)); }
		for (let x = Math.max(0, x0 - a); x < Math.min(W, x1 + z); x++) { out[1] = Math.min(out[1], run(x, y0 - 1, 0, -1)); out[3] = Math.min(out[3], run(x, y1, 0, 1)); }
		for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (!white(x, y)) out[4]++;
	}
	return out;
}
const ean13ok = d => /^\d{13}$/.test(d) && [...d.slice(0, 12)].reduce((s, c, i) => s + +c * (i % 2 ? 3 : 1), 0) % 10 === (10 - +d[12]) % 10;

// —— golf 3: invulvelden + regels (zelfde regels als doc.js bij normaliseren)
const BUILTIN = /^(datum([+-]\d+)?|tijd|teller)$/;
// {naam|wifi}: het filter hoort niet bij de veldnaam
const tokens = s => [...String(s ?? '').matchAll(/\{([^{}|]+)(?:\|[^{}]*)?\}/g)].map(m => m[1].trim().toLowerCase());
const MARGIN = 1.5, PRINT_RIGHT = 47.5;
// strict = nieuwe 40x30-templates: alles wat variabel is moet een veld zijn, elk veld moet iets doen.
function checkFields(t, at, strict) {
	const { fields, elements } = t.doc;
	if (fields === undefined) { if (strict) at('geen fields'); return; }
	if (!Array.isArray(fields) || (strict && !fields.length)) return at('fields leeg of geen lijst');
	const keys = new Map(), used = new Set(), shown = new Set(), ruled = new Map();
	for (const f of fields) {
		const w = `veld ${f?.key}`;
		if (!f || !KEY.test(f.key) || keys.has(f.key)) { at(`${w}: key ongeldig of dubbel`); continue; }
		keys.set(f.key, f);
		if (!FIELD_TYPES.includes(f.type)) at(`${w}: type ${f.type}`);
		// velden gaan voor op de ingebouwde tokens; alleen een datumveld 'datum' mag (vaste dag, SPEC-wave3)
		if (/^(tijd|teller)$/.test(f.key) || (f.key === 'datum' && f.type !== 'date')) at(`${w}: sleutel botst met {${f.key}}`);
		if (typeof f.label !== 'string' || !f.label.trim() || f.label.length > 24) at(`${w}: label leeg of langer dan 24`);
		if (f.type === 'toggle' ? typeof f.value !== 'boolean' : typeof f.value !== 'string') at(`${w}: waarde`);
		if (f.type === 'choice' && !(Array.isArray(f.options) && f.options.length >= 2 && new Set(f.options).size === f.options.length && f.options.includes(f.value))) at(`${w}: opties`);
		if (f.type === 'date' && ((f.value !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(f.value)) || !Number.isInteger(f.offset ?? 0))) at(`${w}: datum`);
		if (f.type === 'number' && f.value.trim() && !/^-?\d+([.,]\d+)?$/.test(f.value.trim())) at(`${w}: '${f.value}' is geen getal`);
	}
	elements.forEach((el, i) => {
		for (const k of [...tokens(el.text), ...tokens(el.data)]) {
			if (keys.has(k)) { used.add(k); shown.add(k); }
			else if (strict && !BUILTIN.test(k)) at(`#${i}: {${k}} is geen veld`);
		}
		if (el.rules !== undefined && !Array.isArray(el.rules)) return at(`#${i}: rules geen lijst`);
		let unhide = false;
		for (const r of el.rules || []) {
			const f = keys.get(r?.field), set = r?.set && typeof r.set === 'object' ? Object.entries(r.set) : [];
			if (!f) { at(`#${i}: regel op onbekend veld ${r?.field}`); continue; }
			used.add(f.key);
			if (f.type === 'toggle' ? typeof r.equals !== 'boolean' : f.type === 'choice' ? !f.options.includes(r.equals) : typeof r.equals !== 'string') at(`#${i}: regel equals ${r.equals}`);
			if (!set.length || set.some(([k, v]) => !['invert', 'hidden'].includes(k) || typeof v !== 'boolean')) at(`#${i}: regel set`);
			if (r.set?.hidden === false) unhide = true;
			if (f.type === 'choice') { if (!ruled.has(f.key)) ruled.set(f.key, new Set()); ruled.get(f.key).add(r.equals); }
		}
		if (el.hidden && !unhide) at(`#${i}: altijd verborgen`);
	});
	for (const k of keys.keys()) if (!used.has(k)) at(`veld ${k} wordt nergens gebruikt`);
	// keuze alleen via regels (niet als tekst getoond): elke optie moet zichtbaar iets doen, anders lijkt klikken in Invullen stuk
	for (const [k, opts] of ruled) if (!shown.has(k)) for (const o of keys.get(k).options) if (!opts.has(o)) at(`veld ${k}: optie ${o} zonder regel`);
	// wisselelementen (icoon/tekst per optie) op één plek: per optie precies één zichtbaar, een losse markering 0 of 1;
	// een lege/onbekende keuze (CSV) raakt geen regel en mag dan hooguit één variant tonen
	for (const f of keys.values()) for (const o of f.type === 'toggle' ? [true, false] : f.type === 'choice' && Array.isArray(f.options) ? [...f.options, ''] : []) {
		const seen = new Map();
		for (const el of elements) {
			const rs = Array.isArray(el.rules) ? el.rules.filter(r => r?.field === f.key && typeof r.set?.hidden === 'boolean') : [];
			if (!rs.length) continue;
			const vis = !rs.filter(r => r.equals === o).reduce((h, r) => r.set.hidden, !!el.hidden), box = [el.type, el.x, el.y, el.w, el.h].join();
			const [n, v] = seen.get(box) || [0, 0];
			seen.set(box, [n + 1, v + vis]);
		}
		for (const [box, [n, v]] of seen) if (n > 1 && o !== '' ? v !== 1 : v > 1) at(`keuze ${f.key}=${o}: ${v} van ${n} zichtbaar op ${box}`);
	}
}

export async function selftest() {
	const details = [];
	let ok = true;
	const fail = msg => { ok = false; details.push('FOUT: ' + msg); };
	const iconNames = new Set(ICON_CATEGORIES.flatMap(c => c.icons));
	const catIds = new Set(TEMPLATE_CATEGORIES.map(c => c.id));
	const sizeKey = new Set(LABEL_SIZES.map(s => `${s.w}x${s.h}${s.shape}`));
	const strictIds = new Set(Object.values(FILES).flatMap(f => f.list.map(t => t.id)));
	const now = new Date(2026, 9, 29, 16, 20);
	if (LABEL_SIZES.length < 20) fail('minder dan 20 labelmaten');
	if (new Set(LABEL_SIZES.map(s => s.id)).size !== LABEL_SIZES.length) fail('dubbele labelmaat-id');
	for (const s of LABEL_SIZES) {
		if (!(s.w > 0 && s.w <= 50 && s.h > 0)) fail(`maat ${s.id} buiten bereik`);
		if (s.shape === 'round' && s.w !== s.h) fail(`ronde maat ${s.id} niet vierkant`);
		if (!['rect', 'round'].includes(s.shape) || !s.name || !s.group) fail(`maat ${s.id} onvolledig`);
	}
	if (new Set(TEMPLATE_CATEGORIES.map(c => c.id)).size !== TEMPLATE_CATEGORIES.length || new Set(TEMPLATE_CATEGORIES.map(c => c.name)).size !== TEMPLATE_CATEGORIES.length) fail('dubbele categorie-id of -naam');
	for (const t of legacy) if (!Object.hasOwn(LEGACY_CAT, t.category)) fail(`${t.id}: legacy-categorie ${t.category} onbekend`);
	if (TEMPLATES.length < 30) fail('minder dan 30 templates');
	if (new Set(TEMPLATES.map(t => t.id)).size !== TEMPLATES.length) fail('dubbele template-id');
	if (new Set(TEMPLATES.map(t => t.name)).size !== TEMPLATES.length) fail('dubbele template-naam (twee gelijke kaartjes in de galerij)');
	// SPEC-wave3: een CSV met kolommen strain;thc;type print meteen over de velden van het strain-label.
	const sp = TEMPLATES.find(t => t.id === 'weed-strain-pot')?.doc.fields || [];
	if (!['strain', 'thc', 'type'].every(k => sp.some(f => f.key === k)) || sp.find(f => f.key === 'type')?.options?.join() !== 'Indica,Hybride,Sativa') fail('weed-strain-pot mist de velden strain/thc/type (Indica/Hybride/Sativa)');
	// een gewone kolom 'E-mail' vult de badge-QR (label 'E-mail (QR)' matchte geen kolom: elke badge kreeg de voorbeeld-QR)
	if (fieldValues(TEMPLATES.find(t => t.id === 'fun-badge')?.doc.fields, { 'E-mail': 'a@b.nl' }).raw.email !== 'a@b.nl') fail('fun-badge: kolom E-mail vult het e-mailveld niet');
	// open netwerk: T:WPA met leeg wachtwoord verbindt niet, dan de T:nopass-code
	for (const id of ['office-wifi', 'wifi-qr']) {
		const d = TEMPLATES.find(t => t.id === id)?.doc, qrs = pw => (d?.elements || []).filter(e => e.type === 'qr' && !applyRules(e, fieldValues(d.fields, { wachtwoord: pw }).raw).hidden).map(e => e.data.slice(0, 13)).join();
		if (qrs('') !== 'WIFI:T:nopass' || qrs('x') !== 'WIFI:T:WPA;S:') fail(`${id}: wifi-QR zonder/met wachtwoord ${qrs('')} / ${qrs('x')}`);
		const kop = pw => (d?.elements || []).some(e => e.text === 'WACHTWOORD' && !applyRules(e, fieldValues(d.fields, { wachtwoord: pw }).raw).hidden);
		if (kop('') || !kop('x')) fail(`${id}: kopje WACHTWOORD bij open netwerk`);
	}
	// typfout in een CSV-keuze licht niets op (de standaardoptie printte anders als gekozen)
	for (const t of [...home, ...fun]) for (const f of t.doc.fields) if (f.type === 'choice') {
		const raw = fieldValues(t.doc.fields, { [f.key]: 'ZZonbekend' }).raw, mine = e => e.rules?.some(r => r.field === f.key);
		const lit = t.doc.elements.find(e => mine(e) && (x => !x.hidden && (x.invert || e.rules.some(r => r.field === f.key && r.set.hidden === false)))(applyRules(e, raw)));
		if (lit) fail(`${t.id}: onbekende ${f.key} licht ${lit.text || lit.icon || lit.char || lit.type} op`);
	}
	for (const [file, { list, cats }] of Object.entries(FILES)) {
		if (list.length < 24) fail(`${file}.js: ${list.length} templates (< 24)`);
		for (const t of list) {
			if (!cats.includes(t.category)) fail(`${t.id}: categorie ${t.category} hoort niet in ${file}.js`);
			if (!/^[a-z0-9]+-[a-z0-9-]+$/.test(t.id) || (file === 'weed' && !t.id.startsWith('weed-'))) fail(`${t.id}: id zonder bestandsprefix`);
		}
	}
	// checkFields vangt zelf een veld 'tijd' (toonde 55 i.p.v. de klok) en twee zichtbare varianten op één plek (ook bij een
	// lege keuze en bij aan/uit)
	const neg = [], hide = { type: 'text', text: 'x', x: 0, y: 0, w: 1, h: 1, rules: [{ field: 'k', equals: 'b', set: { hidden: true } }, { field: 'j', equals: true, set: { hidden: true } }] };
	checkFields({ doc: { fields: [{ key: 'tijd', label: 'Tijd', type: 'text', value: '1' }, { key: 'datum', label: 'Dag', type: 'date', value: '' },
		{ key: 'k', label: 'K', type: 'choice', options: ['a', 'b'], value: 'a' }, { key: 'j', label: 'J', type: 'toggle', value: false }],
		elements: [{ text: '{tijd} {datum}' }, hide, hide] } }, m => neg.push(m), false);
	if (!neg.includes('veld tijd: sleutel botst met {tijd}') || neg.some(m => m.includes('{datum}'))
		|| !['k=a', 'k=', 'j=false'].every(k => neg.includes(`keuze ${k}: 2 van 2 zichtbaar op text,0,0,1,1`))) fail(`checkFields: ${neg.join('; ')}`);
	let minShrink = 1, minShrinkAt = '';
	for (const t of TEMPLATES) {
		const at = m => fail(`${t.id}: ${m}`), strict = strictIds.has(t.id);
		const { label: L, elements } = t.doc;
		if (!t.name || !catIds.has(t.category)) at('naam/categorie');
		if (!Array.isArray(t.tags) || t.tags.some(g => typeof g !== 'string' || !g.trim()) || (strict && t.tags.length < 3)) at('tags');
		for (const k of Object.keys(t.doc)) if (!['label', 'fields', 'elements'].includes(k)) at(`doc.${k} onbekend`);
		if (!sizeKey.has(`${L.w}x${L.h}${L.shape}`)) at(`labelmaat ${L.w}x${L.h} ${L.shape} staat niet in LABEL_SIZES`);
		if (strict && !(L.w === 40 && L.h === 30 && L.shape === 'rect')) at('nieuwe templates zijn exact 40x30 rect');
		if (!elements.length) at('geen elementen');
		checkFields(t, at, strict);
		const ctx = { fields: t.doc.fields, counter: 1, digits: 3, now };
		elements.forEach((el, i) => {
			const where = `#${i} ${el.type}`;
			if (!FIELDS[el.type]) return at(`${where}: type niet toegestaan in templates`);
			for (const k of Object.keys(el)) if (!COMMON.includes(k) && !FIELDS[el.type].includes(k)) at(`${where}: onbekend veld ${k}`);
			for (const [k, vals] of Object.entries(ENUMS)) if (k in el && !(k === 'fit' && el.type === 'image') && !vals.includes(el[k])) at(`${where}: ${k}=${el[k]}`);
			if (![el.x, el.y, el.w, el.h].every(Number.isFinite) || el.w <= 0 || el.h <= 0) return at(`${where}: ongeldige box`);
			// geroteerde box: omhullende rond het midden
			const b = aabb(el), x1 = b.x + b.w, y1 = b.y + b.h;
			if (b.x < -0.01 || b.y < -0.01 || x1 > L.w + 0.01 || y1 > L.h + 0.01) at(`${where}: buiten het label`);
			if (L.w > 48 && x1 > PRINT_RIGHT + 0.01) at(`${where}: voorbij ${PRINT_RIGHT} mm (niet printbaar)`);
			// nieuwe templates: randen op >= 1 mm, de rest binnen 1,5 mm marge (rol-tolerantie van de printer)
			const m = el.type === 'border' ? 1 : MARGIN;
			if (strict && (b.x < m - 0.01 || b.y < m - 0.01 || x1 > L.w - m + 0.01 || y1 > L.h - m + 0.01)) at(`${where}: binnen ${m} mm van de rand`);
			if (L.shape === 'round') {
				if (el.type === 'border') at(`${where}: rechthoekige rand op rond label`);
				if (['text', 'barcode', 'qr', 'icon', 'emoji'].includes(el.type)) for (const [px, py] of [[el.x, el.y], [el.x + el.w, el.y], [el.x, el.y + el.h], [el.x + el.w, el.y + el.h]])
					if (Math.hypot(px - L.w / 2, py - L.h / 2) > L.w / 2 + 0.3) { at(`${where}: hoek buiten de cirkel`); break; }
			}
			if (el.type === 'text') {
				if (!SPEC_FONTS.includes(el.font || 'Arial')) at(`${where}: font ${el.font}`);
				// snit die het font niet heeft: faux-bold/-italic ziet er rommelig uit op 203 dpi
				const faces = fontFaces(el.font || 'Arial');
				if ((el.bold && !faces.bold) || (el.italic && !faces.italic)) at(`${where}: ${el.font} heeft geen ${el.bold && !faces.bold ? 'bold' : 'italic'}`);
				if (!(el.size > 0) || typeof el.text !== 'string' || !el.text) return at(`${where}: tekst/grootte`);
				const fit = el.fit || 'none', variable = /\{(?!datum|tijd|teller)[^}]+\}/.test(el.text);
				if (fit === 'none' && (variable || strict)) at(`${where}: tekst zonder fit:'shrink'/'fill'`);
				if (fit === 'none' && !textFits(el, el.size)) at(`${where}: "${el.text}" past niet`);
				if (fit !== 'none') {
					// nieuwe templates schatten op de ingevulde voorbeeldwaarden, legacy op een vaste voorbeeldnaam
					const text = strict ? substitute(el.text, ctx) : sample(el.text);
					let sz = el.size;
					while (sz > 0.5 && !textFits(el, sz, text)) sz -= 0.05;
					const ratio = sz / el.size;
					// variabele velden mogen flink krimpen, vaste voorbeeldtekst hoort op ontwerpgrootte (bijna) te passen
					if (sz < 1.4 || (!variable && !strict && ratio < 0.85)) at(`${where}: "${text}" krimpt tot ${sz.toFixed(2)} mm`);
					if (!variable && !strict && ratio < minShrink) { minShrink = ratio; minShrinkAt = `${t.id} "${el.text}"`; }
				}
			}
			if (el.type === 'barcode') {
				if (!BAR_SYMS.includes(el.symbology)) at(`${where}: symbologie ${el.symbology}`);
				// invulveld in een EAN mag (de gebruiker vult een echt nummer in): de voorbeeldwaarde moet dan geldig zijn
				const data = strict ? substitute(el.data, ctx) : el.data;
				if (el.symbology === 'ean13' && !ean13ok(data)) at(`${where}: EAN-13 controlecijfer`);
				if (/\{/.test(data) && el.symbology !== 'code128') at(`${where}: veld in numerieke code`);
			}
			if (el.type === 'qr' && !QR_SYMS.includes(el.symbology)) at(`${where}: symbologie ${el.symbology}`);
			// lege plek bijsnijden: een foto van elke verhouding vult hem (passend liet bij een liggende foto veel wit)
			if (el.type === 'image' && (el.src !== '' || el.fit !== 'cover')) at(`${where}: foto in een template = lege plek (src '', fit 'cover')`);
			if (el.type === 'shape' && !SPEC_SHAPES.includes(el.shape)) at(`${where}: vorm ${el.shape}`);
			if (el.type === 'border' && !SPEC_BORDERS.includes(el.style)) at(`${where}: randstijl ${el.style}`);
			if (el.type === 'icon') {
				// Iconify-svg en Tabler-nodes hydrateert de ui bij laden; hier alleen of de bron klopt
				if (el.source === 'iconify') { if (!ID_RE.test(el.icon) || (el.svg ?? '') !== '') at(`${where}: iconify ${el.icon}`); }
				else if ((el.source ?? 'tabler') !== 'tabler' || !iconNames.has(el.icon) || !Array.isArray(el.nodes)) at(`${where}: icoon ${el.icon}`);
			}
			if (el.type === 'emoji') {
				if (typeof el.char !== 'string' || !/^\p{Extended_Pictographic}/u.test(el.char)) at(`${where}: emoji ${el.char}`);
				if (el.style !== 'mono') at(`${where}: emoji-stijl ${el.style} (templates = mono, print scherp)`);
				if ('weight' in el && !(el.weight >= 300 && el.weight <= 700)) at(`${where}: gewicht ${el.weight}`);
				if ('mode' in el && !SPEC_DITHER.includes(el.mode)) at(`${where}: modus ${el.mode}`);
				if (Math.abs(el.w - el.h) > 0.01) at(`${where}: emoji-box niet vierkant`);
			}
		});
	}
	// golf 4b: QR-rustzone >= 4 modules bij elke datalengte (oude maten: ticket 51 dots, basis-qr 176 dots vroegen te veel wit)
	if (qrNeed(51).join() !== '7,8' || qrNeed(48).join() !== '5,5' || qrNeed(176)[0] <= 20) fail(`qrNeed ${qrNeed(51)} ${qrNeed(48)} ${qrNeed(176)}`);
	for (const t of TEMPLATES) if (hasQr(t) && !QR_ROOM.some(([id]) => id === t.id)) fail(`${t.id}: QR niet in QR_ROOM (rustzone ongemeten)`);
	for (const [id] of QR_ROOM) if (!hasQr(TEMPLATES.find(t => t.id === id))) fail(`QR_ROOM: ${id} heeft geen QR`);
	// meten kan alleen op een render (browser)
	if (typeof document !== 'undefined') {
		const lib = await loadIconSet('outline').catch(() => ({}));
		for (const [id, w, h, vmin] of QR_ROOM) {
			const D = adaptTemplate(TEMPLATES.find(t => t.id === id).doc, { w, h, shape: 'rect' }), B = Math.round(D.elements.find(e => e.type === 'qr').w * DPM);
			const [a, z] = qrNeed(B, vmin), [l, t, r, b, ink] = await qrRoom(D, [a, z], lib);
			if (ink || a > Math.min(l, t) || z > Math.min(r, b)) fail(`${id} op ${w}x${h}: QR ${B} dots vraagt ${a}/${z} dots wit, er is ${Math.min(l, t)}/${Math.min(r, b)}${ink ? `, ${ink} dots inkt in de box` : ''}`);
		}
	}
	const wt = TEMPLATES.filter(t => t.category === 'weed'), weedEls = wt.flatMap(t => t.doc.elements);
	if (TEMPLATE_CATEGORIES[0].id !== 'weed' || TEMPLATES[0].category !== 'weed') fail('wiet-categorie niet bovenaan');
	if (wt.length < 10) fail('minder dan 10 wiet-templates');
	if (!weedEls.some(e => e.type === 'emoji') || !weedEls.some(e => e.type === 'icon' && WEED_ICONS.tabler.includes(e.icon))) fail('wiet-templates zonder emoji of wieticoon');
	// golf 3: de rol van de speler (wit 40x30 rect) krijgt >= 96 nieuwe ontwerpen
	const exact = t => t.doc.label.w === 40 && t.doc.label.h === 30 && t.doc.label.shape === 'rect';
	const n4030 = Object.values(FILES).reduce((n, f) => n + f.list.filter(exact).length, 0);
	if (n4030 < 96) fail(`${n4030} nieuwe 40x30-templates (< 96)`);
	// de pers-functie zelf: rand eindigt exact op 47,5 mm, icoon houdt zijn maat, smalle labels blijven onaangeroerd
	const sq = intoPrintable({ w: 50, h: 30 }, [{ type: 'border', x: 1, y: 1, w: 48, h: 28 }, { type: 'icon', x: 40, y: 2, w: 8, h: 8 }, { type: 'text', x: 3, y: 3, w: 44, h: 5 }]);
	if (sq[0].x !== 1 || Math.abs(sq[0].x + sq[0].w - PRINT_RIGHT) > 0.002 || sq[1].w !== 8 || sq[1].x + 8 > PRINT_RIGHT || sq[2].x + sq[2].w > 46) fail('intoPrintable');
	if (intoPrintable({ w: 40, h: 30 }, sq) !== sq) fail('intoPrintable raakt smalle labels aan');
	details.push(`${LABEL_SIZES.length} maten, ${TEMPLATE_CATEGORIES.length} categorieën, ${TEMPLATES.length} templates (${wt.length} wiet); `
		+ `${n4030} nieuwe 40x30 (${Object.entries(FILES).map(([f, { list }]) => `${f} ${list.length}`).join(', ')}) + ${legacy.length} legacy; `
		+ `sterkste krimp legacy ${(minShrink * 100).toFixed(0)}% (${minShrinkAt}); QR-rustzone ${typeof document === 'undefined' ? 'alleen in de browser' : `gemeten op ${QR_ROOM.length} labels`}`);
	return { ok, details };
}
