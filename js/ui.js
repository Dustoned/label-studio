// Interface van Label Studio. Alles wordt 1× gebouwd; refresh() zet daarna alleen waarden en zichtbaarheid in place.
// Niets met de DOM op module-niveau: node kan de pure helpers (selftest) importeren.
import { DPM, MAX_W, $, clamp, normDeg, round, debounce, load, store, substitute, fieldValues, applyRules, fieldCol, h, setText, fold, words, TOKEN } from './util.js';
import { app, ELEMENT_DEFAULTS, TYPE_NAMES, RATIO, createElement, newDoc, migrate, normalizeTemplateDoc, userTemplates, adaptTemplate, rolls, span } from './doc.js';
import { SHAPES, BORDER_STYLES, BARCODES, CODES2D, HALIGN, VALIGN, renderThumb, measureText, onAssetsChanged, loadIcon, fitSize, imageLogo } from './render.js';
import { FONTS, FONT_CATEGORIES, ensureFont } from './fonts.js';
import { LABEL_SIZES, TEMPLATE_CATEGORIES, TEMPLATES } from './presets.js';
import * as icons from './icons.js';
import * as imaging from './imaging.js';
import { typing } from './editor.js';
import { transportFor } from './printer-transport.js';
const { ICON_CATEGORIES, loadIconSet, searchIcons, iconToSvg, svgUrl } = icons;
const { DITHER_MODES, IMAGE_KEYS } = imaging;

// ---------- eigen UI-iconen (24×24, lijn) ----------
const IC = {
	plus: 'M12 5v14M5 12h14', minus: 'M5 12h14',
	undo: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11', redo: 'M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
	fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5', fitText: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5M9 9.5h6M12 9.5v5',
	printer: 'M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v7H7z',
	help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.2a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.2 1-1.2 1.8v.3M12 17h.01"/>',
	filePlus: 'M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8zM14 3v5h5M12 11v6M9 14h6',
	save: 'M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6', download: 'M12 4v11M7 10l5 5 5-5M5 20h14', upload: 'M12 16V5M7 10l5-5 5 5M5 20h14',
	text: 'M5 7V5h14v2M12 5v14M9 19h6', heading: 'M6 5v14M18 5v14M6 12h12',
	barcode: 'M4 5v14M7 5v14M9.5 5v14M13 5v14M15.5 5v14M18 5v14M20 5v14',
	qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5zM14 20h2M20 14v2',
	image: '<rect x="3.5" y="5" width="17" height="14" rx="1.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 3.5 3 2.5-2 5 4"/>',
	shapes: '<circle cx="7.5" cy="7.5" r="3.5"/><path d="M13 4h7v7h-7zM7.5 13.5l4 6.5h-8z"/>',
	star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z',
	frame: 'M3.5 3.5h17v17h-17zM7 7h10v10H7z', layers: 'M12 4l8.5 4.5L12 13 3.5 8.5zM3.5 12.5L12 17l8.5-4.5M3.5 16.5L12 21l8.5-4.5',
	table: 'M4 5h16v14H4zM4 10h16M4 14.5h16M10 5v14', grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z', plusSq: 'M4 4h16v16H4zM12 8v8M8 12h8',
	eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
	eyeOff: 'M3 3l18 18M10.6 5.6c.5-.1.9-.1 1.4-.1 6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-2.6 3.4M6.6 6.7C4 8.4 2.5 12 2.5 12S6 18.5 12 18.5c1.8 0 3.4-.5 4.7-1.3M9.9 9.9a3 3 0 0 0 4.2 4.2',
	lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3', unlock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 6.7-1.4',
	trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3', copy: 'M8 8h12v12H8zM16 8V4H4v12h4',
	dup: 'M8 8h12v12H8zM16 8V4H4v12h4M14 11v6M11 14h6', paste: 'M9 3h6v3H9zM9 4.5H6v16h12v-16h-3',
	toFront: 'M12 20V9M7.5 13.5L12 9l4.5 4.5M5 4h14', fwd: 'M12 19V6M7 11l5-5 5 5', bwd: 'M12 5v13M7 13l5 5 5-5', toBack: 'M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14',
	alL: 'M4 4v16M8 7h11v4H8zM8 14h6v4H8z', alC: 'M12 4v16M6 7h12v4H6zM8.5 14h7v4h-7z', alR: 'M20 4v16M5 7h11v4H5zM10 14h6v4h-6z',
	alT: 'M4 4h16M7 8h4v11H7zM14 8h4v6h-4z', alM: 'M4 12h16M7 6h4v12H7zM14 8.5h4v7h-4z', alB: 'M4 20h16M7 5h4v11H7zM14 10h4v6h-4z',
	disH: 'M4 4v16M20 4v16M9.5 8h5v8h-5z', disV: 'M4 4h16M4 20h16M8 9.5h8v5H8z',
	txL: 'M4 6h16M4 10h10M4 14h16M4 18h10', txC: 'M4 6h16M7 10h10M4 14h16M7 18h10', txR: 'M4 6h16M10 10h10M4 14h16M10 18h10', txJ: 'M4 6h16M4 10h16M4 14h16M4 18h16',
	vaT: 'M4 4h16M8 8h8v6H8z', vaM: 'M4 12h4M16 12h4M8 9h8v6H8z', vaB: 'M4 20h16M8 10h8v6H8z',
	flipH: 'M12 3v18M9 7l-5 10h5zM15 7l5 10h-5z', flipV: 'M3 12h18M7 9L17 4v5zM7 15l10 5v-5z',
	grip: '<g fill="currentColor" stroke="none"><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></g>',
	search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.4-4.4"/>',
	chevL: 'M15 6l-6 6 6 6', chevR: 'M9 6l6 6-6 6', chevD: 'M6 9l6 6 6-6',
	bt: 'M7 7.5l10 9-5 4.5V3l5 4.5-10 9',
	calendar: 'M4 6h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4', calPlus: 'M4 6h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4M12 13v5M9.5 15.5h5',
	clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>', hash: 'M5 9h14M5 15h14M10.5 4L9 20M15 4l-1.5 16',
	rotL: 'M4 12a8 8 0 1 0 2.4-5.7M4 4.5v4h4', rotR: 'M20 12a8 8 0 1 1-2.4-5.7M20 4.5v4h-4',
	ratio: 'M4 6h16v12H4zM8 11V9h2.5M16 13v2h-2.5', check: 'M5 12.5l4.5 4.5L19 7',
	warn: 'M12 4l9 16H3zM12 10v4.5M12 17.5h.01', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8h.01"/>',
	swap: 'M7 7h12M15 3l4 4-4 4M17 17H5M9 13l-4 4 4 4', selAll: 'M4 4h3M10 4h4M17 4h3v3M20 10v4M20 17v3h-3M14 20h-4M7 20H4v-3M4 14v-4',
	wand: 'M4 20L15 9M14 4v3M19 9h-3M17.5 5.5l-2 2M18 14v2M20 15h-4M8 4v2M9 5H7',
	cenH: 'M12 4v16M3 12h6M6 9l3 3-3 3M21 12h-6M18 9l-3 3 3 3', cenV: 'M4 12h16M12 3v6M9 6l3 3 3-3M12 21v-6M9 18l3-3 3 3',
	cenB: '<circle cx="12" cy="12" r="2.5"/><path d="M12 3v5M12 16v5M3 12h5M16 12h5"/>',
	expand: 'M4 9V4h5M4 4l5 5M20 9V4h-5M20 4l-5 5M4 15v5h5M4 20l5-5M20 15v5h-5M20 20l-5-5',
	smile: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14a4.5 4.5 0 0 0 7 0M9.5 9.5h.01M14.5 9.5h.01"/>',
	form: 'M4 4.5h16v5H4zM4 14.5h16v5H4zM7 7h5M7 17h3', roll: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/>',
	menu: 'M4 7h16M4 12h16M4 17h16',
	// mini-werkbalk: tekst kleiner/groter/vet = Tabler text-decrease/-increase/bold
	smaller: 'M4 19v-10.5a3.5 3.5 0 1 1 7 0v10.5M4 13h7M15 13h6', bigger: 'M4 19v-10.5a3.5 3.5 0 1 1 7 0v10.5M4 13h7M18 10v6M15 13h6',
	bold: 'M7 5h6a3.5 3.5 0 0 1 0 7h-6zM13 12h1a3.5 3.5 0 0 1 0 7h-7v-7',
	more: '<g fill="currentColor" stroke="none"><circle cx="5.5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18.5" cy="12" r="1.6"/></g>',
};
const TYPE_IC = { text: 'text', barcode: 'barcode', qr: 'qr', image: 'image', shape: 'shapes', icon: 'star', border: 'frame', emoji: 'smile' };
export const iconSvg = (name, size = 18) => {
	const b = IC[name] || '';
	return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${b.includes('<') ? b : `<path d="${b}"/>`}</svg>`;
};

// ---------- vaste lijsten ----------
const TABS = [['fill', 'Invullen', 'form'], ['templates', 'Templates', 'grid'], ['add', 'Toevoegen', 'plusSq'], ['icons', 'Iconen', 'star'], ['layers', 'Lagen', 'layers'], ['data', 'Data', 'table'], ['label', 'Label & print', 'printer']];
const SUBS = [['weed', 'Wiet'], ['tabler', 'Algemeen'], ['online', 'Online'], ['emoji', 'Emoji']];
// Iconify zoekt alleen op Engelse namen: de chips tonen NL, maar zoeken Engels.
const ONLINE_QUICK = [['', 'Wiet & smoke'], ['joint', 'joint'], ['bong', 'bong'], ['leaf', 'blad'], ['mushroom', 'paddo'], ['pill', 'pil'],
	['fire', 'vuur'], ['skull', 'schedel'], ['heart', 'hart'], ['crown', 'kroon']];
const OFFLINE_MSG = 'Online iconen laden mislukt. Ben je online?';
// shortcut: pixelbudget voor het voorbeeldcanvas (alleen bij extreem inzoomen op lange labels), tegel-rendering pas als dit te grof blijkt.
const MAX_PX = 24e6;
const BC_HINT = { code128: 'Alle tekens. De meest gebruikte barcode.', ean13: '12 cijfers (het 13e controlecijfer rekent hij zelf uit).',
	ean8: '7 cijfers (+ controlecijfer).', upca: '11 cijfers (+ controlecijfer).', upce: '7 cijfers, begint met 0 of 1.',
	code39: 'Hoofdletters, cijfers, spatie en - . $ / + %', code93: 'Alle tekens, compacter dan Code 39.', itf14: '13 cijfers (+ controlecijfer), voor omdozen.',
	interleaved2of5: 'Alleen cijfers, even aantal.', codabar: 'Cijfers met start/stop A-D, bv. A40156B.', msi: 'Alleen cijfers.', pharmacode: 'Een getal van 3 t/m 131070.' };
// Voorbeelddata alleen invullen als de huidige inhoud zelf een voorbeeld was: echte gebruikersdata nooit overschrijven.
// Zonder controlecijfer: een voorbeeld met een cijfer meer bleef anders staan met een fout controlecijfer (Ongeldige code).
const BC_RE = { ean13: /^\d{12}$/, ean8: /^\d{7}$/, upca: /^\d{11}$/, upce: /^[01]\d{6}$/, itf14: /^\d{13}$/, interleaved2of5: /^(\d\d)+$/,
	codabar: /^[A-D][0-9$:/.+-]+[A-D]$/i, msi: /^\d+$/, pharmacode: /^\d{1,6}$/, code39: /^[0-9A-Z .$/+%-]+$/ };
const BC_EX = { code128: 'ABC-12345', ean13: '590123412345', ean8: '9638507', upca: '03600029145', upce: '0123456', itf14: '1234567890123', interleaved2of5: '12345678',
	codabar: 'A40156B', msi: '1234567', pharmacode: '1234', code39: 'CODE-39', code93: 'CODE93' };
const EXAMPLES = new Set([...Object.values(BC_EX), ELEMENT_DEFAULTS.barcode.data, '']);
// Micro QR past maar ~15 tekens: zonder hint lijkt "Ongeldige code" bij een gewone URL een bug.
const QR_HINT = { microqrcode: 'Micro QR: kort, max. ongeveer 15 tekens (35 cijfers). Voor links: kies QR-code.', pdf417: 'Breed en plat: geef hem een brede box.' };
const ECC = [['L', 'L', null, 'Laag (7%)'], ['M', 'M', null, 'Middel (15%)'], ['Q', 'Q', null, 'Hoog (25%)'], ['H', 'H', null, 'Maximaal (30%)']];
const QR_QUICK = [['https://', 'Website (URL)'], ['WIFI:T:WPA;S:Netwerknaam;P:Wachtwoord;;', 'Wifi-netwerk'], ['tel:+31612345678', 'Telefoonnummer'],
	['mailto:naam@voorbeeld.nl', 'E-mailadres'], ['SMSTO:+31612345678:Hallo!', 'Sms-bericht'], ['geo:52.3676,4.9041', 'Locatie (kaart)'],
	['BEGIN:VCARD\nVERSION:3.0\nFN:Voornaam Achternaam\nTEL:+31612345678\nEMAIL:naam@voorbeeld.nl\nEND:VCARD', 'Visitekaartje (vCard)']];
const BASE_TOKENS = [['{datum}', 'Datum van vandaag'], ['{datum+1}', 'Datum + 1 dag'], ['{datum+3}', 'Datum + 3 dagen'], ['{datum+7}', 'Datum + 7 dagen'],
	['{datum+30}', 'Datum + 30 dagen'], ['{datum-1}', 'Datum - 1 dag'], ['{tijd}', 'Tijd'], ['{teller}', 'Teller']];
const SMART = [['calendar', 'Datum', '{datum}'], ['calPlus', 'Houdbaar tot', 'THT {datum+3}'], ['clock', 'Tijd', '{tijd}'], ['hash', 'Teller', 'Nr. {teller}']];
const TOKEN_KEY = { text: 'text', barcode: 'data', qr: 'data' };
const FALLBACK = { sans: 'sans-serif', serif: 'serif', display: 'sans-serif', hand: 'cursive', mono: 'monospace', retro: 'monospace' };
const MEDIA = [[10, 'Labels met tussenruimte'], [11, 'Doorlopende rol'], [38, 'Zwarte markering']];
const PHYS = 96 / 25.4 / DPM;   // CSS-px per dot op ware grootte
const NAME_KEY = 'pm110.v2.name', UI_KEY = 'pm110.v2.ui';

// ---------- pure helpers (node-testbaar) ----------
const fmt = v => { const n = Math.round(+v * 100) / 100; return Number.isFinite(n) ? String(n) : ''; };
const fmtNl = v => fmt(v).replace('.', ',');
function fitBox(w, h, max) { const s = Math.min(1, max / Math.max(w, h, 1)); return [Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s))]; }
const insertAt = (s, tok, a = s.length, b = a) => s.slice(0, a) + tok + s.slice(b);
// Eindindex in de elementen-array; in de lagenlijst staat de bovenste laag bovenaan, dus "boven t" = na t in de array.
function dropIndex(ids, from, target, above) { const rest = ids.filter(id => id !== from), ti = rest.indexOf(target); return ti < 0 || !ids.includes(from) ? -1 : ti + (above ? 1 : 0); }
const zoomPct = z => Math.round(z / PHYS * 100);
// Zoomknoppen: vaste stappen (in %); vanaf een tussenstand (passend, Ctrl+scroll) de eerstvolgende in die richting.
// Voorbij de laatste stap (passend op een groot scherm kan 1000% zijn) blijft hij staan, nooit de verkeerde kant op.
const ZOOM_STEPS = [50, 75, 100, 125, 150, 200, 300, 400, 600, 800];
const zoomStep = (pct, dir) => dir > 0 ? ZOOM_STEPS.find(s => s > pct + 0.5) ?? Math.max(pct, ZOOM_STEPS.at(-1)) : ZOOM_STEPS.findLast(s => s < pct - 0.5) ?? Math.min(pct, ZOOM_STEPS[0]);
// Voorbeeld op 2x schermresolutie (zoom = CSS-px per dot): de browser schaalt glad terug, zo krijgt de
// zwart/wit-drempel toch zachte randen (supersampling). fast (tijdens slepen) = 1x schermresolutie.
// Printpixels = exact het printraster.
const SSAA = 2;
export const previewScale = (zoom, dpr, dots, pixels, fast = false) =>
	pixels ? 1 : clamp(Math.min(zoom * dpr * (fast ? 1 : SSAA), Math.sqrt(MAX_PX / Math.max(1, dots))), 1, 8) || 1;
const iconifyParts = id => { const s = String(id || ''), i = s.indexOf(':'); return i < 0 ? ['', s] : [s.slice(0, i), s.slice(i + 1)]; };
// Zelfde rol = zelfde breedte, hoogte en vorm (rond-masker telt mee: rond op rechthoek is "andere maat").
const sameSize = (a, b) => +a?.w === +b?.w && +a?.h === +b?.h && (a?.shape || 'rect') === (b?.shape || 'rect');
const sizeName = L => `${fmt(L?.w)}×${fmt(L?.h)}${L?.shape === 'round' ? ' rond' : ''}`.replace(/\./g, ',');
// Zoeken op naam + tags, zonder hoofdletters en accenten (zoals iconen en emoji).
const tplHay = t => fold([t?.name, ...(Array.isArray(t?.tags) ? t.tags : [])].join(' '));
// Iconify-licentie: NC (CC BY-NC, CC BY-NC-SA) mag niet op iets dat je verkoopt; dat staat dan vooraan in de regel.
const licNC = l => /(^|-)NC(-|$)/i.test(String(l?.spdx || '')) || /non-?commercial/i.test(String(l?.title || ''));
const licText = m => `${licNC(m?.license) ? 'Niet-commercieel · ' : ''}${m?.title}: ${m?.license?.title || m?.license?.spdx}${m?.author?.name ? ' · ' + m.author.name : ''}`;
// Structuur van de invulvelden (niet de waarden): alleen bij een andere structuur bouwt Invullen rijen bij.
const fieldRowSig = f => [f?.key, f?.type, f?.type === 'choice' ? (f.options || []).join('\u0002') : ''].join('\u0001');
// Alleen een selectie met een nieuw id opent Bewerken; kleiner worden (undo-prune, deselecteren) niet.
const grew = (a, b) => b.some(id => !a.includes(id));
// Scroll-verschuiving op één as om [a0,a1] met marge m in het zicht [v0,v1] te krijgen: 0 als hij er al in valt, anders
// minimaal; past hij niet, dan de beginrand in beeld.
const revealDelta = (a0, a1, v0, v1, m) => a1 - a0 > v1 - v0 - 2 * m || a0 < v0 + m ? a0 - v0 - m : a1 > v1 - m ? a1 - v1 + m : 0;
// Raakt een geladen font dit doc? Fonts melden hun familie (render: tekst, Noto Emoji voor mono-emoji). Beelden melden
// niets: die regelen main.js en requeueSoon zelf via pending. QR/barcode wachten nergens op (bwip-js laadt vóór de app).
export const assetHits = (doc, family) => (doc?.elements || []).some(e => (e.type === 'text' && e.font === family) || (e.type === 'emoji' && family === 'Noto Emoji'));
// Met filter ('{naam|wifi}') telt de sleutel ook, zoals substitute die invult.
const tokenKeys = s => [...String(s ?? '').matchAll(/\{\s*([a-z0-9]+)\s*(?:\|[^{}]*)?\}/gi)].map(m => m[1].toLowerCase());
const safeName = s => String(s || '').replace(/[\\/:*?"<>|]+/g, '-').trim();

// ---------- DOM-helpers ----------
export function ic(name, size = 18) { const t = document.createElement('template'); t.innerHTML = iconSvg(name, size); return t.content.firstElementChild; }
const ib = (icon, label, onclick, cls = '') => h('button', { type: 'button', class: 'btn ghost ib ' + cls, title: label, 'aria-label': label, onclick }, ic(icon));
const tb = (icon, text, onclick, cls = '', title) => h('button', { type: 'button', class: 'btn ' + cls, title: title || null, onclick }, icon && ic(icon, 16), h('span', {}, text));
const chip = (text, onclick, title) => h('button', { type: 'button', class: 'chip', title: title || null, onclick }, text);
const tip = (el, s) => { if (el.title !== s) { el.title = s; el.setAttribute('aria-label', s); } };
const vis = el => !el.closest('[hidden]');
const isField = t => !!t?.closest?.('input,textarea,select,[contenteditable="true"],[contenteditable=""]');
// Velden die in het label landen (paneel, kopieën): daar is Ctrl+Z de app-undo. Zoeken en losse invoer (.local) niet.
const docField = t => isField(t) && !!t.closest('#drawer, #topbar') && !t.matches('input[type=search], .local');
// Tijdens app-undo/redo vanuit een veld mag ook het gefocuste veld zijn waarde terugkrijgen (anders schrijft de
// volgende toets de oude waarde terug).
let histSync = false;
const busy = el => document.activeElement === el && !histSync;
// Open/dicht per sectie onthouden; key is uniek per paneel (zelfde titel komt in meer panelen voor).
const acc = (key, title, open, ...kids) => {
	const d = h('details', { class: 'sec', open: S.secs[key] ?? open }, h('summary', {}, title), ...kids);
	d.addEventListener('toggle', () => { if (d.open !== (S.secs[key] ?? open)) { S.secs[key] = d.open; saveUi(); } });
	return d;
};
const dsec = (title, ...kids) => h('section', { class: 'dsec' }, title && h('h3', {}, title), ...kids);
// Chips op één regel: het muiswiel scrolt horizontaal (een gewone scrollbalk vraagt op desktop Shift).
// more-l/-r = er staan chips buiten beeld (CSS-fade): zonder zichtbare scrollbalk zag de rij er anders compleet uit.
export function hscroll(el) {
	el.classList.add('one');
	// Aan het eind van de rij scrolt het wiel weer het paneel (anders zat je daar vast).
	el.addEventListener('wheel', e => { if (!e.deltaX && e.deltaY && el.scrollWidth > el.clientWidth) { const s = el.scrollLeft; el.scrollLeft += e.deltaY; if (el.scrollLeft !== s) e.preventDefault(); } }, { passive: false });
	const upd = () => { const m = el.scrollWidth - el.clientWidth; el.classList.toggle('more-l', el.scrollLeft > 1); el.classList.toggle('more-r', el.scrollLeft < m - 1); };
	el.addEventListener('scroll', upd, { passive: true });
	// Rijen worden verborgen gebouwd (breedte 0) en wiet-/emoji-chips komen later: maat en inhoud volgen.
	new ResizeObserver(upd).observe(el);
	new MutationObserver(upd).observe(el, { childList: true });
	return el;
}

// ---------- staat ----------
let E = null, A = null, built = false, P = null, imgIn = null, fontPop = null, menu = null, caret = null, colSig = null, saveNames = [];
let iconUI = null, iconSeq = 0, dataUI = null, mine = null, dragId = null;
let onlineUI = null, onlineSeq = 0, emojiUI = null, emojiSeq = 0, emojiP = null, emojiLabels = null;
let weedUI = null, weedSeq = 0, weedP = null, weedIdx = null, fillUI = null, ibP = null, closeFile = () => {};
// edit = paneel toont Bewerken (sessiestaat, niet opgeslagen); secs = open/dicht per accordeon-sectie.
const S = { tab: 'templates', open: true, edit: false, side: 'right', secs: {}, iconSet: 'outline', iconCat: '', iconReplace: null, alignTo: 'label', printLabel: null,
	iconTab: 'weed', weedCat: '', emojiGroup: 'weed', emojiStyle: 'mono', pixels: false, onlyMine: true };
const subShown = {};
// 'isub' i.p.v. het oude 'sub': de iconen-lade opent zo eenmalig weer op het nieuwe wiet-pakket.
const saveUi = () => store(UI_KEY, { tab: S.tab, open: S.open, isub: S.iconTab, pixels: S.pixels, onlyMine: S.onlyMine, side: S.side, secs: S.secs });
// Collecties (Icônes-achtig bladeren) pas laden bij eerste gebruik; ontbreekt de module, dan blijft Zoeken werken.
const ibMod = () => ibP ||= import('./iconbrowser.js').catch(e => { ibP = null; throw e; });
// Invoegen vanuit een galerij (iconen, randen, velden) houdt het paneel waar het is; de rest opent Bewerken.
let quiet = 0;
const calm = fn => { quiet++; try { return fn(); } finally { quiet--; } };
// Emoji-module + -data pas laden als de Emoji-tab opengaat; mislukt = volgende keer opnieuw proberen.
const emojiMod = () => emojiP ||= import('./emoji.js').catch(e => { emojiP = null; throw e; });
// Wiet-pakket (assets/weed-icons.json) pas bij eerste gebruik; index id → icoon voor hydratatie en invoegen.
const weedPack = () => weedP ||= import('./weedpack.js').then(async m => {
	const pack = await m.loadWeedPack();
	weedIdx = new Map(pack.categories.flatMap(c => c.icons.map(i => [i.id, i])));
	return { m, pack };
}).catch(e => { weedP = null; throw e; });
// Templates laden altijd op de huidige rol: adaptTemplate past ze aan (labelmaat verandert nooit).
function adapt(tdoc, L) {
	return adaptTemplate(tdoc, { w: L.w, h: L.h, shape: L.shape || 'rect' }, { print: app.doc.print });
}
// Na aanpassen onleesbaar (staand -> liggend e.d., uniform geschaald): een tekst onder 55 % van het ontwerp, of kleiner
// geworden en onder 1,25 mm (10 dots). Die bieden we op deze rol niet aan bij "Andere maten". Gemeten op 40x30: zo vallen
// verzendlabel/ordnerrug/zaadjes/archiefdoos (31-54 %, 0,66-1,39 mm) weg; kleine bijschriften van 1,4-1,5 mm blijven.
// src = genormaliseerd bron-doc, out = adapt(src): zelfde elementvolgorde.
const MIN_TEXT_K = .55, MIN_TEXT_MM = 1.25;
function tooSmall(src, out) {
	const a = src?.elements || [];
	return (out?.elements || []).some((e, i) => {
		const o = a[i], sz = o?.type !== e.type ? null : e.type === 'text' ? [o.size, e.size] : e.type === 'barcode' && e.showText !== false ? [o.textSize, e.textSize] : null;
		if (!sz || !(sz[0] > 0)) return false;
		const k = sz[1] / sz[0];
		return k < MIN_TEXT_K || (k < 1 && sz[1] < MIN_TEXT_MM);
	});
}
const panels = [], typeRoots = {}, typeSecs = {}, areas = {}, fieldSelects = [], layerRows = new Map();

// Paneel = bouwblok met scope() → de objecten die het bewerkt; ups = in-place updaters (alleen als zichtbaar).
function panel(root, scope) { const p = { root, scope, ups: [] }; panels.push(p); P = p; return p; }
const vals = (p, k) => p.scope().map(o => o[k]);
const mixed = vs => vs.some(v => v !== vs[0]);
function put(p, k, v, co = true) {
	const ts = p.scope();
	if (!ts.length || ts.every(o => o[k] === v)) return;   // zelfde waarde = geen (lege) undo-stap
	for (const o of ts) o[k] = v;
	app.changed(co ? { coalesce: 'ui:' + k + ':' + ts.map(o => o.id || '').join(',') } : {});
}
const typeScope = t => () => app.selected().filter(e => e.type === t);
// B/H in de inspector: wat render contain tekent (icoon, emoji, qr, passende afbeelding) houdt zijn verhouding, anders
// klopt de box niet meer met wat je ziet; de rest verandert alleen die zijde.
function setSize(p, k, v) {
	const ts = p.scope(), o = k === 'w' ? 'h' : 'w';
	if (!ts.length || ts.every(e => e[k] === v)) return;
	for (const e of ts) {
		if (RATIO.has(e.type) && !(e.type === 'image' && e.fit !== 'contain') && e[k] > 0) e[o] = Math.round(e[o] * v / e[k] * 1000) / 1000;
		e[k] = v;
	}
	app.changed({ coalesce: 'ui:' + k + ':' + ts.map(e => e.id).join(',') });
}

// ---------- controls ----------
function showNum(inp, vs, mul = 1, force = false) {
	if (!force && busy(inp)) return;
	const m = mixed(vs), s = m || vs[0] == null ? '' : fmt(vs[0] * mul);
	if (inp.value !== s) inp.value = s;
	inp.placeholder = m ? 'gemengd' : '';
}
// Tijdens typen alleen geldige waarden toepassen; bij Enter/blur wordt geklemd en netjes getoond.
function numIn(k, o = {}) {
	const p = P, { min = -Infinity, max = Infinity, step = 0.5, int = false, live = true, onSet } = o;
	const inp = h('input', { type: 'number', step, inputMode: 'decimal', class: 'num' });
	if (min > -Infinity) inp.min = min;
	if (max < Infinity) inp.max = max;
	const parse = () => { let v = parseFloat(inp.value); if (!Number.isFinite(v)) return null; return int ? Math.round(v) : v; };
	const set = v => onSet ? onSet(v) : put(p, k, v);
	if (live) inp.addEventListener('input', () => { const v = parse(); if (v != null && v >= min && v <= max) set(v); });
	inp.addEventListener('change', () => { const v = parse(); if (v != null) set(clamp(v, min, max)); showNum(inp, vals(p, k), 1, true); });
	p.ups.push(() => showNum(inp, vals(p, k)));
	return inp;
}
const fillRange = r => r.style.setProperty('--p', clamp((r.value - r.min) / (r.max - r.min || 1) * 100, 0, 100) + '%');
// auto() -> getekende waarde als die automatisch is (dan veld leeg met 'Auto'), anders 0; onSet zoals bij numIn.
function slider(k, o) {
	const p = P, { min, max, step, mul = 1, unit = '', inMin = min, inMax = max, auto = null, onSet = null } = o;
	const r = h('input', { type: 'range', min, max, step });
	const n = h('input', { type: 'number', min: inMin, max: inMax, step, class: 'num', inputMode: 'decimal' });
	const apply = v => onSet ? onSet(v) : put(p, k, v);
	const set = (raw, lo, hi) => { const v = parseFloat(raw); if (Number.isFinite(v) && v >= lo && v <= hi) apply(v / mul); };
	const show = (force = false) => {
		const vs = vals(p, k), au = auto?.();
		if (!vs.length) return;
		if (!busy(r)) { const s = fmt(+(au || vs[0]) * mul); if (r.value !== s) r.value = s; fillRange(r); }
		if (!au) return showNum(n, vs, mul, force);
		if ((force || !busy(n)) && n.value !== '') n.value = '';
		if (n.placeholder !== 'Auto') n.placeholder = 'Auto';
	};
	r.addEventListener('input', () => { set(r.value, min, max); fillRange(r); });
	n.addEventListener('input', () => set(n.value, inMin, inMax));
	n.addEventListener('change', () => { const v = parseFloat(n.value); if (Number.isFinite(v)) apply(clamp(v, inMin, inMax) / mul); show(true); });
	p.ups.push(() => { show(); const tt = auto?.() ? 'Automatisch (Opmaak > Passen); een maat kiezen zet hem vast' : ''; if (n.title !== tt) n.title = tt; });
	return h('div', { class: 'slider' }, r, n, h('span', { class: 'unit' }, unit));
}
function seg(k, opts, o = {}) {
	const p = P, w = h('div', { class: 'seg', role: 'group' });
	const bs = opts.map(([v, text, icn, title]) => {
		const b = h('button', { type: 'button', 'aria-pressed': 'false', title: icn ? text : title || null, 'aria-label': icn ? text : null }, icn ? ic(icn, 16) : text);
		b.addEventListener('click', () => o.onSet ? o.onSet(v) : put(p, k, v, false));
		w.append(b);
		return [v, b];
	});
	p.ups.push(() => { const vs = o.get ? [o.get()] : vals(p, k); for (const [v, b] of bs) b.setAttribute('aria-pressed', String(vs.length > 0 && vs.every(x => x === v))); });
	return w;
}
function tog(k, content, title, cls = '') {
	const p = P, b = h('button', { type: 'button', class: 'tog ' + cls, title, 'aria-label': title, 'aria-pressed': 'false' }, content);
	b.addEventListener('click', () => put(p, k, !vals(p, k)[0], false));
	p.ups.push(() => b.setAttribute('aria-pressed', String(!!vals(p, k)[0])));
	return b;
}
function sel(k, opts, o = {}) {
	const p = P, s = h('select', {});
	for (const [v, t] of opts) s.add(new Option(t, v));
	s.addEventListener('change', () => put(p, k, o.num ? +s.value : s.value, false));
	p.ups.push(() => { const vs = vals(p, k), v = mixed(vs) || !vs.length ? '' : String(vs[0]); if (s.value !== v) s.value = v; });
	return s;
}
// Invert/verborgen die een invulveld bepaalt (keuzegroep, schakelaar): de basiswaarde is dan geen knop meer. Wie hem toch
// omzette, kreeg een variant die altijd zichtbaar/omgekeerd bleef naast de gekozen optie.
const ruleOf = (e, k) => (Array.isArray(e?.rules) ? e.rules : []).find(r => typeof r?.set?.[k] === 'boolean');
// Vast = de basis is het tegendeel van wat de regels zetten (gezond). Staat de basis al op de regelwaarde (zo'n kapotte
// variant van vóór deze fix), dan blijft de knop bruikbaar om hem te herstellen.
const ruleLocked = (e, k) => { const rs = (Array.isArray(e?.rules) ? e.rules : []).filter(r => typeof r?.set?.[k] === 'boolean'); return rs.length > 0 && rs.every(r => r.set[k] !== !!e[k]); };
const ruleTip = (e, k) => { const r = ruleOf(e, k), f = r && app.doc.fields.find(x => x.key === r.field); return r ? `Bepaald door invulveld "${f?.label || r.field}" (Invullen)` : ''; };
// Zoals render het tekent: na de regels, met dezelfde voorbeeldrij.
const rulesRaw = () => fieldValues(app.doc.fields, A.previewRow()).raw;
const effective = (e, raw = rulesRaw()) => e?.rules?.length ? applyRules(e, raw) : { invert: !!e?.invert, hidden: !!e?.hidden };
function check(k, text, o = {}) {
	const p = P, c = h('input', { type: 'checkbox', role: o.sw ? 'switch' : null }), l = h('label', { class: o.sw ? 'chk switch' : 'chk' }, c, h('span', {}, text));
	c.addEventListener('change', () => put(p, k, c.checked, false));
	p.ups.push(() => {
		const ts = p.scope(), ruled = o.rule ? ts.find(e => ruleLocked(e, k)) : null, raw = ruled ? rulesRaw() : null;
		const vs = ruled ? ts.map(e => effective(e, raw)[k]) : vals(p, k);
		c.checked = !!vs[0]; c.indeterminate = vs.some(v => !!v !== !!vs[0]);
		if (o.rule) { c.disabled = !!ruled; l.title = ruled ? ruleTip(ruled, k) : ''; l.classList.toggle('disabled', !!ruled); }
	});
	return l;
}
// o.ph mag een functie zijn (placeholder die meebeweegt, bv. de verwachte kolomkoppen in Data).
function area(k, o = {}) {
	const ph = () => (typeof o.ph === 'function' ? o.ph() : o.ph) || '';
	const p = P, t = h('textarea', { rows: o.rows || 2, placeholder: ph(), spellcheck: false });
	t.addEventListener('input', () => put(p, k, t.value));
	p.ups.push(() => {
		if (busy(t)) return;
		const vs = vals(p, k), m = mixed(vs), s = m ? '' : String(vs[0] ?? ''), pl = m ? 'gemengd' : ph();
		if (t.value !== s) t.value = s;
		if (t.placeholder !== pl) t.placeholder = pl;
	});
	return t;
}
// Labelregel + control; show(t) verbergt de regel als hij voor het eerste doel niet van toepassing is.
function row(label, ctrl, show) {
	const p = P, r = h('div', { class: 'f' }, h('span', { class: 'fl' }, label), ctrl);
	const ins = ctrl.matches('input,select,textarea') ? [ctrl] : [...ctrl.querySelectorAll('input,select,textarea')];
	for (const i of ins) if (!i.hasAttribute('aria-label')) i.setAttribute('aria-label', label);
	if (!ins.length && ctrl.tagName !== 'BUTTON' && !ctrl.hasAttribute('aria-label')) ctrl.setAttribute('aria-label', label);
	if (show) p.ups.push(() => { const t = p.scope()[0]; r.hidden = !t || !show(t); });
	return r;
}
const fld = (label, inp, title) => h('label', { class: 'fld', title: title || null }, h('span', {}, label), inp);
const pre = (tx, aria, inp, unit) => { inp.setAttribute('aria-label', aria); return h('label', { class: 'pre', title: aria }, h('span', { class: 'pre-t' }, tx), inp, unit && h('span', { class: 'unit' }, unit)); };

// ---------- thumbnails: lazy (alleen zichtbaar), verspreid over frames ----------
const thumbs = new Set(), sigThumbs = new Set(), thumbQ = new Set();
let thumbRaf = 0, io = null;
function queueThumb(t) { if (!t) return; thumbQ.add(t); if (!thumbRaf) thumbRaf = requestAnimationFrame(runThumbs); }
// Bovenste eerst (positie uit de IntersectionObserver): in volgorde van klaar-zijn kwam de eerste rij als laatste (gemeten).
function runThumbs() {
	thumbRaf = 0;
	const t0 = performance.now();
	while (thumbQ.size) {
		let b = null;
		for (const t of thumbQ) if (!b || t.y < b.y || (t.y === b.y && t.x < b.x)) b = t;
		thumbQ.delete(b); drawThumb(b);
		if (performance.now() - t0 > 10) break;
	}
	if (thumbQ.size) thumbRaf = requestAnimationFrame(runThumbs);
}
function drawThumb(t) {
	if (!thumbs.has(t)) return;
	try {
		const d = t.doc();
		if (!d) return;   // nog niet klaar (bv. iconen laden); wordt later opnieuw gevraagd
		const c = renderThumb(d, t.px);
		if (t.cv.width !== c.width || t.cv.height !== c.height) { t.cv.width = c.width; t.cv.height = c.height; }
		const x = t.cv.getContext('2d');
		x.clearRect(0, 0, c.width, c.height); x.drawImage(c, 0, 0);
		t.drawn = t.sig ? t.sig() : 1; t.pend = c.pending;
	} catch (e) { t.drawn = 'fout'; console.warn('thumbnail mislukt', e); }
}
// Buiten beeld = als ongetekend markeren: de IntersectionObserver tekent hem dan bij terugkomen opnieuw (anders bleef een
// thumb die wegscrolde vóór zijn icoon/font binnen was voorgoed zonder).
// Alleen thumbs die het geladen font gebruiken (assetHits): elke font-melding tekende anders alle zichtbare opnieuw.
// null = alles (weer online), undefined = een beeld (foto/icoon-raster): alleen thumbs die bij het tekenen nog wachtten
// (t.pend, zoals main.js), anders tekende elk geladen beeld alle thumbs met een icoon/foto opnieuw.
const reAssets = new Set();
const requeueSoon = debounce(() => {
	const fs = [...reAssets], all = reAssets.has(null);
	reAssets.clear();
	for (const t of thumbs) if (t.drawn != null && (all || fs.some(f => f === undefined ? t.pend : assetHits(t.doc(), f)))) { if (t.vis) queueThumb(t); else t.drawn = null; }
}, 250);
const requeueThumbs = f => { reAssets.add(f); requeueSoon(); };
function thumbIO() {
	return io ||= new IntersectionObserver(es => {
		for (const e of es) {
			const t = e.target._t;
			if (!t) continue;
			t.vis = e.isIntersecting; t.y = e.boundingClientRect.top; t.x = e.boundingClientRect.left;
			if (t.vis && (t.drawn == null || (t.sig && t.drawn !== t.sig()))) queueThumb(t);
		}
	}, { rootMargin: '160px', scrollMargin: '160px' });   // scrollMargin: de scrollende lade knipt anders vóór de rootMargin af
}
function thumbButton({ px, doc, title, onclick, sig = null, cls = '' }) {
	const cv = h('canvas', { class: 'thumb', width: 1, height: 1 });
	const btn = h('button', { type: 'button', class: 'thumb-btn ' + cls, title, 'aria-label': title, onclick }, h('span', { class: 'thumb-box' }, cv));
	const t = { cv, px, doc, sig, vis: false, drawn: null, x: Infinity, y: Infinity };
	cv._t = t; thumbs.add(t); if (sig) sigThumbs.add(t);
	thumbIO().observe(cv);
	return { btn, t };
}
function dropThumb(t) { thumbs.delete(t); sigThumbs.delete(t); thumbQ.delete(t); io?.unobserve(t.cv); }

const shapeDocs = new Map();
const shapeDoc = id => {
	if (!shapeDocs.has(id)) shapeDocs.set(id, normalizeTemplateDoc({ label: { w: 12, h: 12, shape: 'rect' }, elements: [{ type: 'shape', shape: id, x: 1.5, y: 1.5, w: 9, h: 9, stroke: 0.7, fill: 'none' }] }));
	return shapeDocs.get(id);
};
// Printgeometrie hoort erbij: X-verschuiving/180 graden veranderen het printbare vlak, dus ook de aangepaste templates.
const labelSig = () => { const L = app.doc.label, P = app.doc.print; return `${L.w}x${L.h}${L.shape}@${+P.offset || 0}${P.rotate180 ? 'r' : ''}`; };
const borderCache = new Map();
function borderDoc(style) {
	const L = app.doc.label, key = labelSig() + style;
	if (!borderCache.has(key)) {
		if (borderCache.size > 200) borderCache.clear();
		borderCache.set(key, normalizeTemplateDoc({ label: { w: L.w, h: L.h, shape: L.shape }, elements: [{ type: 'border', style, x: 1, y: 1, w: Math.max(1, L.w - 2), h: Math.max(1, L.h - 2), stroke: 0.6 }] }));
	}
	return borderCache.get(key);
}

// ---------- iconen in documenten ----------
// Templates bevatten alleen icoonnamen; nodes worden hier uit de Tabler-set gekopieerd (filled mist er veel → outline).
// Iconify-iconen zonder svg: eerst uit het wiet-pakket (offline, lokaal), anders online via fetchIconifySvg.
// { n: aantal gevuld, failed: set niet te laden (offline) }; lege iconen worden later alsnog gevuld (rehydrate).
const needsIcons = doc => (doc?.elements || []).some(e => e.type === 'icon' && e.icon && (e.source === 'iconify' ? !e.svg : !e.nodes?.length));
async function hydrateIcons(doc) {
	let n = 0, failed = false, tablerDown = false, packTried = false;
	for (const e of doc?.elements || []) {
		if (e.type !== 'icon' || !e.icon) continue;
		if (e.source === 'iconify') {
			if (e.svg) continue;
			if (!packTried) { packTried = true; await weedPack().catch(() => {}); }
			try {
				const svg = weedIdx?.get(e.icon)?.svg || await icons.fetchIconifySvg(e.icon);
				if (svg) { e.svg = svg; n++; }
			} catch { failed = true; }   // offline en niet in het pakket: later opnieuw
			continue;
		}
		if ((Array.isArray(e.nodes) && e.nodes.length) || tablerDown) continue;
		try {
			// hasOwn: een naam uit een bestand als 'constructor' raakte anders het Object-prototype (kopie gooit).
			let lib = await loadIconSet(e.set === 'filled' ? 'filled' : 'outline');
			if (!Object.hasOwn(lib, e.icon) && e.set === 'filled') { lib = await loadIconSet('outline'); if (Object.hasOwn(lib, e.icon)) e.set = 'outline'; }
			if (Object.hasOwn(lib, e.icon)) { e.nodes = structuredClone(lib[e.icon]); n++; }
		} catch { failed = tablerDown = true; }   // offline: icoon blijft leeg, de rest werkt
	}
	return { n, failed };
}
// Het huidige label alsnog vullen: bij start, na laden/undo (een oude snapshot kan lege iconen hebben) en weer online.
export function rehydrate() {
	const d = app.doc;
	return hydrateIcons(d).then(r => { if (r.n && d === app.doc) app.changed({ history: false }); return r; });
}
const OFFLINE_ICONS = 'Iconen konden niet laden (offline?). Ze verschijnen vanzelf zodra je weer online bent.';
// Weer online / set alsnog geladen: offline gerenderde template-thumbs opnieuw en het label aanvullen.
export function iconsBack() {
	let stale = 0;
	for (const [id, e] of tplDocs) if (e.stale) { tplDocs.delete(id); stale++; }
	if (stale) requeueThumbs(null);
	return rehydrate();
}

// ---------- build ----------
export function build({ editor, actions }) {
	E = editor; A = actions;
	const u = load(UI_KEY);
	if (u?.tab === 'borders') u.tab = 'add';   // Randen is golf 4 een sectie onder Toevoegen
	if (u && TABS.some(t => t[0] === u.tab)) { S.tab = u.tab; S.open = u.open !== false; }
	if (u && SUBS.some(t => t[0] === u.isub)) S.iconTab = u.isub;
	if (typeof u?.onlyMine === 'boolean') S.onlyMine = u.onlyMine;
	S.pixels = !!u?.pixels;
	S.side = u?.side === 'left' ? 'left' : 'right';
	if (u?.secs && typeof u.secs === 'object') S.secs = u.secs;   // vóór het bouwen: acc() leest dit
	if (app.doc.fields.length) { S.tab = 'fill'; S.open = true; }
	// Smal ligt het paneel over het label: bij de eerste start dicht, de rail laat zien waar je begint.
	else if (!u && !matchMedia('(min-width: 901px)').matches) S.open = false;
	// Icoondata voor de template-thumbs meteen ophalen, parallel aan het bouwen (anders pas na de eerste thumb-vraag).
	weedPack().catch(() => {}); loadIconSet('outline').catch(() => {});
	for (const el of document.querySelectorAll('[data-icon]')) el.prepend(ic(el.dataset.icon, +el.dataset.size || 18));
	imgIn = h('input', { type: 'file', accept: 'image/*', hidden: true });
	imgIn.addEventListener('change', () => { const f = imgIn.files[0], id = imgIn._replace; imgIn.value = ''; if (f) addImage(f, id); });
	document.body.append(imgIn);
	buildTopbar(); buildRail(); buildDrawer(); buildMenu(); buildDialogs(); wireGlobal();
	onAssetsChanged(f => requeueThumbs(f));   // meldt ook geladen fonts (familie), beelden zonder argument
	// 'Ander icoon/emoji…' vervangt alleen het element waarvoor het gestart is; andere selectie = gewoon weer invoegen.
	app.on('select', () => { if (S.iconReplace && !(app.selection.length === 1 && app.selection[0] === S.iconReplace)) S.iconReplace = null; });
	// Nieuw geselecteerd element = paneel naar Bewerken; niets geselecteerd = terug naar de tab.
	let prevSel = [];
	app.on('select', () => {
		const now = app.selection, add = grew(prevSel, now);
		prevSel = now.slice();
		if (!now.length) { if (S.edit) { S.edit = false; refresh(); } return; }
		if (!add || quiet) return;
		// Ingeklapt blijft ingeklapt: openen alleen via rail, dubbelklik of de mini-werkbalk (vanzelf openen versmalde de
		// stage onder de muis: het element sprong weg en slepen ging 3-4x te ver).
		S.edit = true;
		refresh();
	});
	// Schermlezer: Tab op het canvas kiest een element zonder dat de focus verhuist; zeg welk ('Tekst: Mijn label, 2 van 7').
	// Alleen met de focus op het canvas: Lagen en de mini-werkbalk hebben hun eigen namen. Telling = Tab-volgorde (main.js).
	app.on('select', () => {
		if (document.activeElement?.id !== 'overlay' || !$('selSay')) return;
		const s = app.selection, raw = rulesRaw(), els = app.doc.elements.filter(e => !effective(e, raw).hidden), e = s.length === 1 && els.find(x => x.id === s[0]);
		const sub = e ? layerSub(e).slice(0, 60) : '';
		setText($('selSay'), e ? `${e.name || TYPE_NAMES[e.type] || e.type}${sub ? ': ' + sub : ''}, ${els.indexOf(e) + 1} van ${els.length}` : s.length ? `${s.length} elementen` : 'Geen selectie');
	});
	// Nieuw/geladen label met invulvelden: meteen het formulier, dat is waar je dan wilt zijn. Niet bij een overname uit een
	// ander venster: dat is hetzelfde label.
	app.on('doc', d => { if (built && !d?.sync && app.doc.fields.length) openTab('fill', true); });
	built = true;
	openTab(S.tab, S.open);
	zoomChanged(E.getZoom());
	prewarmWeed();
}
// Wiet-raster vooraf vullen in rusttijd: de eerste klik op Iconen parste anders ~100 ms aan svg's in de klik (gemeten;
// op tragere laptops 0,7-1,4 s). Zelfde pool en volgorde als showWeed zonder categorie; die ziet daarna alles al staan.
const idle = f => (globalThis.requestIdleCallback || (g => setTimeout(() => g({ timeRemaining: () => 8 }), 50)))(f);
function prewarmWeed() {
	weedPack().then(wp => {
		const list = wp.pack.categories.flatMap(c => c.icons);
		let i = 0;
		const step = dl => {
			for (let n = 0; i < list.length && !subShown.weed && (n < 4 || dl.timeRemaining() > 2); i++, n++) {
				fillWeed(weedCell(i), list[i]);
			}
			if (i < list.length && !subShown.weed) idle(step);
		};
		idle(step);
	}).catch(() => {});   // mislukt: showWeed toont bij openen zelf de fout + opnieuw
}

function buildTopbar() {
	const nm = $('docName');
	// De naam hoort bij het label (doc.name, mee in undo/redo); de oude losse sleutel 1x overnemen.
	const old = load(NAME_KEY);
	if (typeof old === 'string' && old) { if (!app.doc.name) app.session(D => { D.name = old.slice(0, 60); }); store(NAME_KEY, ''); }
	nm.addEventListener('input', () => setDocName(nm.value));
	const syncName = () => { const n = docName(); if (!busy(nm) && nm.value !== n) nm.value = n; showName(n); };
	app.on('change', syncName); app.on('doc', syncName);
	syncName();
	// Bestand-menu: naam, nieuw, opslaan, export/import, sneltoetsen. Zelfde gedrag als het contextmenu.
	const fb = $('btnFile'), fm = $('fileMenu');
	closeFile = (focus = false) => { if (fm.hidden) return; fm.hidden = true; fb.setAttribute('aria-expanded', 'false'); if (focus) fb.focus(); };
	fb.onclick = () => {
		if (!fm.hidden) return closeFile();
		fm.hidden = false;
		const r = fb.getBoundingClientRect(), w = fm.offsetWidth;
		fm.style.left = clamp(r.left, 8, Math.max(8, innerWidth - w - 8)) + 'px';
		fm.style.top = r.bottom + 4 + 'px';
		fb.setAttribute('aria-expanded', 'true');
		fm.querySelector('.mi')?.focus();
	};
	// Capture: dicht met focus op Bestand vóór de actie, dan geeft een dialoog die erna opent de focus ook daar terug.
	fm.addEventListener('click', e => { if (e.target.closest('.mi')) closeFile(true); }, true);
	// Tab uit het menu sluit het; null (klik op Naam of de scheidslijn) niet.
	fm.addEventListener('focusout', e => { const t = e.relatedTarget; if (t && !fm.contains(t) && t !== fb) closeFile(); });
	fm.addEventListener('keydown', e => {
		if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeFile(true); return; }
		if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
		e.preventDefault();
		// Vanuit Naam (geen .mi, i = -1): omhoog = het laatste item, niet het voorlaatste.
		const v = [...fm.querySelectorAll('.mi')], i = v.indexOf(document.activeElement);
		v[((i < 0 && e.key === 'ArrowUp' ? 0 : i) + (e.key === 'ArrowDown' ? 1 : -1) + v.length) % v.length]?.focus();
	});
	document.addEventListener('pointerdown', e => { if (!fm.hidden && !fm.contains(e.target) && !fb.contains(e.target)) closeFile(); }, true);
	addEventListener('resize', () => closeFile());
	$('btnNew').onclick = newLabel;
	$('btnSaveTpl').onclick = openSave;
	$('btnExport').onclick = exportDoc;
	$('btnImport').onclick = () => $('fileImport').click();
	$('fileImport').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importFile(f); };
	$('btnUndo').onclick = () => app.undo();
	$('btnRedo').onclick = () => app.redo();
	$('btnTidy').onclick = () => {
		const raw = rulesRaw();
		if (!app.doc.elements.some(e => !effective(e, raw).hidden)) return toast('Er staat nog niets op het label.');
		// Al netjes = geen undo-stap: dan zou Ctrl+Z (zoals de toast belooft) een eerdere wijziging terugdraaien.
		let ch = false;
		const off = app.on('change', () => { ch = true; });
		try { app.tidy(); } finally { off(); }
		toast(ch ? 'Netjes gemaakt. Ctrl+Z zet het terug.' : 'Staat al netjes.', ch ? 'ok' : '');
	};
	const px = $('pixelsToggle');
	px.checked = S.pixels;
	$('labelWrap').classList.toggle('pixels', S.pixels);
	px.onchange = () => { S.pixels = px.checked; saveUi(); $('labelWrap').classList.toggle('pixels', S.pixels); A.redraw(); };
	const zoomBy = d => E.setZoom(PHYS * zoomStep(E.getZoom() / PHYS * 100, d) / 100);
	$('zoomOut').onclick = () => zoomBy(-1);
	$('zoomIn').onclick = () => zoomBy(1);
	$('zoomFit').onclick = () => E.fit();
	$('btnConnect').onclick = () => A.connect();
	$('btnPrint').onclick = () => A.print(false);
	$('btnHelp').onclick = () => $('dlgHelp').showModal();
	panel($('topbar'), () => [app.doc.print]);
	const c = numIn('copies', { min: 1, max: 99, step: 1, int: true });
	c.setAttribute('aria-label', 'Aantal kopieën');
	$('copiesBox').append(c);
}

function buildRail() {
	const rail = $('rail');
	for (const [id, name, icn] of TABS) rail.append(h('button', { type: 'button', class: 'rail-btn', role: 'tab', id: 'tab-' + id, 'aria-controls': 'pane-' + id,
		'aria-selected': 'false', title: name, onclick: () => S.edit ? openTab(id, true) : openTab(id) }, ic(icn, 20), h('span', {}, name)));
	// Tablist-patroon (verticaal): pijltjes/Home/End verplaatsen alleen de focus, Enter/spatie opent. preventDefault houdt
	// de editor erbuiten: die verschoof anders het geselecteerde element.
	rail.addEventListener('keydown', e => {
		if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
		const tabs = [...rail.querySelectorAll('[role=tab]')], i = tabs.indexOf(document.activeElement), n = tabs.length;
		const j = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: n - 1 }[e.key];
		if (j == null || i < 0) return;
		e.preventDefault();
		tabs[(j + n) % n].focus();
	});
}

// open undefined = klik op de rail: zelfde tab nogmaals klikken klapt de lade in. Een tab kiezen verlaat Bewerken.
function openTab(id, open) {
	S.open = open ?? !(S.tab === id && S.open);
	S.tab = id; S.edit = false;
	if (!S.open || id !== 'icons') S.iconReplace = null;   // lade dicht of andere tab: vervangen vervalt
	saveUi();
	if (S.open && id === 'icons') openSub(S.iconTab);
	refresh();
}
const openIcons = sub => { S.iconTab = sub; openTab('icons', true); };
// Eén plek die bepaalt wat het paneel toont: Bewerken (bij selectie) of de gekozen tab.
function syncPanes() {
	const ed = S.edit && app.selection.length > 0;
	for (const [t] of TABS) { $('tab-' + t).setAttribute('aria-selected', String(S.open && !ed && t === S.tab)); $('pane-' + t).hidden = ed || t !== S.tab; }
	$('pane-edit').hidden = !ed; $('drawerBack').hidden = !ed;
	// 560-900 px: paneel dicht/open verschuift alleen de marge van .stage-scroll (geen resize), dus de minibalk zelf laten volgen.
	const was = $('app').classList.contains('drawer-closed');
	$('app').classList.toggle('drawer-closed', !S.open);
	if (was !== !S.open) A.redraw(false);
	const tn = TABS.find(t => t[0] === S.tab)[1];
	setText($('drawerTitle'), ed ? 'Bewerken' : tn);
	if (ed) tip($('drawerBack'), 'Terug naar ' + tn);
}
// Voor de mini-werkbalk en dubbelklik: Bewerken openen op de eerste sectie van het type.
export function openEdit() {
	if (!built || !app.selection.length) return;
	S.edit = true; S.open = true;
	refresh();
	const d = typeSecs[app.selected()[0]?.type];
	if (d) { d.open = true; d.scrollIntoView({ block: 'nearest' }); flash(d); }
}
// Korte oplichting: stond de gevraagde sectie al open en in beeld, dan zie je toch dat de klik iets deed.
function flash(el) {
	// Minder beweging: geen animatie, dus ook nooit een animationend (de listener bleef anders hangen).
	if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
	el.classList.remove('flash'); void el.offsetWidth;
	el.classList.add('flash');
	el.addEventListener('animationend', () => el.classList.remove('flash'), { once: true });
}

function buildDrawer() {
	const body = $('drawerBody');
	$('drawerClose').onclick = () => openTab(S.tab, false);
	$('drawerBack').onclick = () => { S.edit = false; refresh(); };
	const side = $('drawerSide'), close = $('drawerClose'), tbar = $('topbar'), sp = tbar.querySelector('.spacer');
	const sideUi = () => {
		$('app').classList.toggle('side-left', S.side === 'left');
		// Topbalk-bediening aan de paneelkant: alleen de spacer verhuist (DOM-volgorde = tabvolgorde = wat je ziet).
		if (S.side === 'left') tbar.append(sp); else $('btnFile').after(sp);
		tip(side, S.side === 'right' ? 'Paneel naar links' : 'Paneel naar rechts');
		close.replaceChildren(ic(S.side === 'right' ? 'chevR' : 'chevL'));
	};
	side.onclick = () => { S.side = S.side === 'right' ? 'left' : 'right'; sideUi(); saveUi(); A.redraw(false); };
	sideUi();
	// Esc verlaat het veld (focus terug naar het canvas); een tweede Esc deselecteert via de editor. Een gevuld zoekveld
	// wist Esc eerst zelf, een open keuzelijst sluit de browser zelf.
	$('drawer').addEventListener('keydown', e => {
		const t = e.target;
		if (e.key !== 'Escape' || e.isComposing || !isField(t) || t.tagName === 'SELECT' || (t.type === 'search' && t.value)) return;
		e.preventDefault(); e.stopPropagation(); t.blur();
	});
	const mk = id => body.appendChild(h('section', { class: 'pane', id: 'pane-' + id, role: 'tabpanel', 'aria-labelledby': 'tab-' + id, hidden: true }));
	buildFill(mk('fill')); buildTemplates(mk('templates')); buildAdd(mk('add')); buildIcons(mk('icons')); buildLayers(mk('layers')); buildData(mk('data'));
	mk('label').append(buildLabelPage());
	body.appendChild(h('section', { class: 'pane', id: 'pane-edit', role: 'region', 'aria-label': 'Bewerken', hidden: true })).append(buildSelPage());
}

// ---------- lade: Invullen ----------
// Eén groot invoerelement per veld; rijen worden alleen bijgebouwd als de veldstructuur verandert (key/type/opties),
// waarden gaan in place. Altijd app.doc opnieuw lezen: undo/laden vervangt het object.
const fieldOf = key => app.doc.fields.find(f => f.key === key);
// Eerste {token} van de tekst dat een invulveld is (Maak invulveld/opheffen, dubbelklik naar Invullen).
const fieldKey = e => { const keys = new Set(app.doc.fields.map(f => f.key)); return tokenKeys(e?.text).find(k => keys.has(k)) || null; };
// Oude labels missen nieuwe veldkoppelingen. Alleen exact herkenbare templateonderdelen meenemen, nooit op nabijheid gokken.
function templateFieldLinks(doc) {
	const template = TEMPLATES.find(t => t.name === doc.name);
	if (!template) return [];
	const ref = adaptTemplate(template.doc, doc.label, { print: doc.print });
	const signature = el => JSON.stringify(Object.entries(el).filter(([k]) => !['id', 'name', 'rules', 'nodes', 'svg'].includes(k)).sort(([a], [b]) => a.localeCompare(b)));
	return doc.elements.flatMap(e => {
		const match = ref.elements.find(r => r.rules.length && signature(r) === signature(e));
		return match ? [{ id:e.id, rules:match.rules }] : [];
	});
}
function templateFieldParts(doc, keys = null) {
	const template = TEMPLATES.find(t => t.name === doc.name);
	if (!template) return [];
	const fields = new Set(keys || (template.doc.fields || []).filter(f => !doc.fields.some(x => x.key === f.key)).map(f => f.key));
	return templateFieldLinks(doc).filter(e => e.rules.some(r => fields.has(r.field))).map(e => e.id);
}

function buildFill(root) {
	const list = h('div', { class: 'ff-list', title: 'Enter = volgende veld' });
	const empty = h('div', { class: 'ff-empty' }, ic('form', 28), h('strong', {}, 'Nog geen invulvelden'),
		h('span', {}, 'Kies een template met velden.'),
		h('button', { type: 'button', class: 'btn sm', onclick: () => openTab('templates', true) }, 'Templates bekijken'));
	const cleanup = h('button', { type: 'button', class: 'btn', id: 'cleanupFieldParts', hidden: true, onclick: () => {
		app.remove(templateFieldParts(app.doc));
		toast('Restanten van verwijderde velden opgeruimd. Ongedaan maken zet ze terug.');
	} }, 'Restanten opruimen');
	// Enter = volgende veld; op een keuzeknop eerst die keuze maken.
	list.addEventListener('keydown', e => {
		if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
		const r = [...fillUI.rows.values()].find(x => x.el.contains(e.target));
		if (!r) return;
		e.preventDefault();
		// De prullenbak nooit via Enter (na een muisklik heeft hij focus): Enter = altijd door naar het volgende veld.
		// Verplaatst de klik zelf de focus ('+ dagen' -> dagenveld), dan blijft hij daar.
		if (e.target.tagName === 'BUTTON' && !e.target.matches('.ff-del')) { e.target.click(); if (document.activeElement !== e.target) return; }
		const rs = [...list.children].map(el => [...fillUI.rows.values()].find(x => x.el === el)).filter(Boolean), i = rs.indexOf(r);
		if (rs[i + 1]) focusRow(rs[i + 1]); else e.target.blur();
	});
	// Rij wisselen kan ook hier: met een lijst toont het label de rij, niet wat je invult.
	const cnt = h('span', { class: 'muted' }), nav = h('div', { class: 'rownav ff-rownav', hidden: true },
		ib('chevL', 'Vorige rij', () => stepRow(-1)), cnt, ib('chevR', 'Volgende rij', () => stepRow(1)));
	fillUI = { list, empty, nav, cnt, cleanup, rows: new Map() };
	root.append(dsec(null, nav, list, cleanup, empty));
	panels.push({ root, scope: () => [], ups: [refreshFill] });
}
// Voorbeeldrij = sessiestaat (buiten de undo, maar ook niet door Ctrl+Z teruggezet); gedeeld door Data en Invullen.
// Eerst klemmen zoals het scherm (een ingekorte lijst laat batch.row staan): anders deed de eerste klik niets.
const stepRow = d => { const n = A.rows().length; if (!n) return; const v = clamp(clamp(parseInt(app.doc.batch.row) || 1, 1, n) + d, 1, n); app.session(D => { D.batch.row = v; }); };
// Eerste klik in een getalveld kiest de hele waarde (overtypen); de mouseup van die klik zou de selectie anders opheffen.
// Een sleep-selectie bij die eerste klik blijft staan.
function selectOnClick(inp) {
	let first = false;
	inp.addEventListener('mousedown', () => { first = document.activeElement !== inp; });
	inp.addEventListener('mouseup', e => { if (first && inp.selectionStart === inp.selectionEnd) { e.preventDefault(); inp.select(); } first = false; });
}
function focusRow(r) { const t = r.focus(); if (!t) return; t.focus(); if (t.select && t.type !== 'date') t.select(); }
function focusField(key) { const r = fillUI?.rows.get(key); if (r) focusRow(r); }
function fieldRow(f) {
	const key = f.key, lab = h('span', { class: 'ff-label' }), csv = h('span', { class: 'ff-csv', hidden: true });
	const del = ib('trash', 'Invulveld verwijderen', () => {
		if (!app.deleteField(key, templateFieldParts(app.doc, [key]), templateFieldLinks(app.doc))) { toast('Ontgrendel eerst de gekoppelde labelelementen.', 'err'); return; }
		toast('Invulveld en gekoppelde labelelementen verwijderd. Ctrl+Z zet ze terug.');
	}, 'sm ff-del');
	// Geen tab-stop: Tab+Enter vanuit een veld wiste anders het volgende veld.
	del.tabIndex = -1;
	const r = { key, sig: fieldRowSig(f), el: null, focus: () => null, ups: [] };
	let body, pills = null, inp = null;
	if (f.type === 'choice') {
		pills = (f.options || []).map(o => {
			const b = h('button', { type: 'button', class: 'pill', 'aria-pressed': 'false', onclick: () => app.setField(key, o) }, String(o));
			return [o, b];
		});
		body = h('div', { class: 'pills', role: 'group' }, pills.map(p => p[1]));
		r.focus = () => (pills.find(([, b]) => b.getAttribute('aria-pressed') === 'true') || pills[0])?.[1];
		r.ups.push(c => { for (const [o, b] of pills) b.setAttribute('aria-pressed', String(String(c.value) === String(o))); });
	} else if (f.type === 'toggle') {
		const c = h('input', { type: 'checkbox', role: 'switch' }), t = h('span', {});
		c.addEventListener('change', () => app.setField(key, c.checked));
		body = h('label', { class: 'switch ff-switch' }, c, t);
		r.focus = () => c;
		r.ups.push(x => { c.checked = !!x.value; setText(t, x.value ? 'Ja' : 'Nee'); });
	} else if (f.type === 'date') {
		const today = h('button', { type: 'button', class: 'pill', 'aria-pressed': 'false', onclick: () => app.setField(key, '') }, 'Vandaag');
		const day = h('input', { type: 'date', class: 'ff-date', 'aria-label': 'Kies datum' });
		day.addEventListener('change', () => app.setField(key, /^\d{4}-\d{2}-\d{2}$/.test(day.value) ? day.value : ''));
		const off = h('input', { type: 'number', class: 'num ff-off', step: 1, min: -365, max: 3650, inputMode: 'numeric', 'aria-label': 'Aantal dagen erbij' });
		selectOnClick(off);
		// offset is geen veldwaarde (setField zet alleen value): in place zetten, slider-reeks = 1 undo-stap.
		off.addEventListener('input', () => {
			opened = true;   // wie het veld bewerkt houdt het open: bij 0 verdween het anders onder de cursor
			const v = parseInt(off.value, 10), x = fieldOf(key);
			if (!x || !Number.isFinite(v) || v < -365 || v > 3650 || (+x.offset || 0) === v) return;
			x.offset = v; app.changed({ coalesce: 'field:' + key + ':offset' });
		});
		// Bij verlaten klemmen en tonen wat geldt: 4000 of leeg bleef anders staan terwijl het label de oude offset hield.
		off.addEventListener('change', () => {
			const x = fieldOf(key), v = clamp(parseInt(off.value, 10), -365, 3650);
			if (x && Number.isFinite(v) && (+x.offset || 0) !== v) { x.offset = v; app.changed({ coalesce: 'field:' + key + ':offset' }); }
			off.value = String(+fieldOf(key)?.offset || 0);
		});
		const out = h('span', { class: 'ff-out' });
		// Dagen erbij (houdbaar tot) is zeldzaam: achter een knopje; staat er al een offset, dan altijd zichtbaar.
		const plus = h('label', { class: 'ff-plus', hidden: true }, h('span', {}, '+'), off, h('span', {}, 'dagen'), out);
		let opened = false;
		const addOff = h('button', { type: 'button', class: 'pill', title: 'Dagen erbij tellen (bv. houdbaar tot)',
			onclick: () => { opened = true; plus.hidden = false; addOff.hidden = true; off.focus(); off.select(); } }, '+ dagen');
		body = h('div', { class: 'ff-daterow' }, h('div', { class: 'pills', role: 'group' }, today, day, addOff), plus);
		r.focus = () => plus.hidden ? day : off;
		r.ups.push(x => {
			const show = opened || !!(+x.offset);
			if (plus.hidden === show) { plus.hidden = !show; addOff.hidden = show; }
			today.setAttribute('aria-pressed', String(!x.value));
			if (!busy(day) && day.value !== String(x.value || '')) day.value = String(x.value || '');
			const o = String(+x.offset || 0);
			if (!busy(off) && off.value !== o) off.value = o;
			const s = fieldValues([x], null, new Date()).display[key] || '';
			setText(out, s ? '= ' + s : '');
		});
	} else {
		const num = f.type === 'number';
		// Tekstveld = textarea: een <input> slikt regeleindes (adres uit Maak invulveld) en de eerste toets schreef dan de
		// geplakte regel terug. Enter = volgende veld (lijst-handler), Shift+Enter = nieuwe regel.
		inp = num ? h('input', { type: 'text', class: 'ff-in', spellcheck: false, autocomplete: 'off', maxLength: 200, inputMode: 'decimal' })
			: h('textarea', { class: 'ff-in', rows: 1, spellcheck: false, autocomplete: 'off', maxLength: 500 });
		inp.addEventListener('input', () => app.setField(key, inp.value));
		if (num) selectOnClick(inp);   // template-waarden (22, 3,5) zijn voorbeelden: klik = overtypen, geen '2218'
		const sfx = h('span', { class: 'ff-sfx' });
		body = num ? h('div', { class: 'ff-num' }, inp, sfx) : inp;
		r.focus = () => inp;
		r.ups.push(x => {
			if (!busy(inp)) { const s = String(x.value ?? ''); if (inp.value !== s) inp.value = s; }
			if (!num) inp.rows = clamp(inp.value.split('\n').length, 1, 4);
			inp.placeholder = String(x.placeholder || '');
			setText(sfx, String(x.suffix || '')); sfx.hidden = !x.suffix;
		});
	}
	r.el = h('div', { class: 'ff' }, h('div', { class: 'ff-head' }, lab, csv, del), body);
	// aria-label volgt het label (zelfde key kan in een ander template 'Inhoud' i.p.v. 'Gewicht' heten).
	const named = [...r.el.querySelectorAll('input:not([aria-label]),textarea:not([aria-label]),.pills')];
	r.ups.push(x => {
		const lb = String(x.label || x.key);
		setText(lab, lb);
		for (const i of named) if (i.getAttribute('aria-label') !== lb) i.setAttribute('aria-label', lb);
		// CSV-kolom die dit veld vult gaat voor (batch-print): laat zien dat je typen dan niet ziet. Zelfde opzoeking als het
		// label (util.fieldCol): kop 'Strain' of het label 'Naam' uit Excel = dit veld.
		const v = fieldCol(A.previewRow(), x, app.doc.fields), has = v !== undefined, col = has ? fedCols().get(x.key) : '';
		csv.hidden = !has;
		if (has) { setText(csv, 'uit lijst: ' + String(v).slice(0, 24)); csv.title = `Kolom "${col}" uit je lijst (Data) gaat voor deze waarde`; }
		// Lijst gaat voor: eigen invoer gedimd (blijft bewerkbaar: de waarde zonder lijst), de rijwaarde gemarkeerd.
		r.el.classList.toggle('is-over', has);
		if (pills) for (const [o, b] of pills) b.classList.toggle('is-row', has && String(o).trim().toLowerCase() === String(v).trim().toLowerCase());
		const tt = has ? 'Lijst gaat voor; dit is de waarde zonder lijst' : '';
		if (inp && inp.title !== tt) inp.title = tt;
	});
	return r;
}
// Foto-plek (afbeelding op het label) als rij na de velden: één knop kiest het bestand en vult precies die plek.
function photoRow(id) {
	const lab = h('span', { class: 'ff-label' }), btn = tb('image', 'Kies foto', () => pickImage(id), 'ff-photo');
	const r = { key: 'img:' + id, el: h('div', { class: 'ff' }, h('div', { class: 'ff-head' }, lab), btn), focus: () => btn, ups: [] };
	r.ups.push(e => { setText(lab, e.name || 'Foto'); setText(btn.lastChild, e.src ? 'Andere foto' : 'Kies foto'); btn.classList.toggle('primary', !e.src); });
	return r;
}
function refreshFill() {
	const u = fillUI, fs = app.doc.fields, imgs = app.doc.elements.filter(e => e.type === 'image' && !e.locked);
	const keep = new Set([...fs.map(f => f.key), ...imgs.map(e => 'img:' + e.id)]);
	for (const [k, r] of u.rows) if (!keep.has(k)) { r.el.remove(); u.rows.delete(k); }
	const place = (r, x, i) => { if (u.list.children[i] !== r.el) u.list.insertBefore(r.el, u.list.children[i] || null); for (const up of r.ups) up(x); };
	fs.forEach((f, i) => {
		let r = u.rows.get(f.key);
		if (r && r.sig !== fieldRowSig(f)) { r.el.remove(); r = null; }
		if (!r) { r = fieldRow(f); u.rows.set(f.key, r); }
		place(r, f, i);
	});
	imgs.forEach((e, j) => {
		let r = u.rows.get('img:' + e.id);
		if (!r) { r = photoRow(e.id); u.rows.set(r.key, r); }
		place(r, e, fs.length + j);
	});
	u.empty.hidden = fs.length + imgs.length > 0;
	const remnants = new Set(templateFieldParts(app.doc));
	u.cleanup.hidden = !app.doc.elements.some(e => remnants.has(e.id) && !e.locked);
	const n = A.rows().length;
	u.nav.hidden = !n || !fs.length;
	if (!u.nav.hidden) setText(u.cnt, `Rij ${clamp(parseInt(app.doc.batch.row) || 1, 1, n)} van ${n}`);
}
// Tekst → invulveld / selectie → keuzegroep, dan meteen naar Invullen met dat veld in focus.
// app.makeField/makeChoice geven het nieuwe veld terug, of null als er niets gemaakt is.
function newField(make, why = 'Er is geen invulveld gemaakt.') {
	let f;
	try { f = make(); } catch (e) { return toast('Invulveld maken mislukt: ' + e.message, 'err'); }
	if (!f) return toast(why, 'warn');
	openTab('fill', true);
	focusField(f.key);
	toast(`Invulveld "${f.label || f.key}" staat nu onder Invullen.`, 'ok');
}

// ---------- lade: Toevoegen ----------
// Elk invoegpad loopt via app.place: leeg label = vullen, anders een nette vrije plek (place selecteert zelf).
// stay = paneel blijft waar het is (invoegen vanuit een galerij); anders opent Bewerken via de select-handler.
// at = drop-punt in mm: place zet het daar (gecentreerd, binnen marge en printvlak), alleen als er al inhoud staat (leeg = vullen).
function addEl(type, ov = {}, stay = false, at = null) {
	const el = createElement(type, ov, app.doc);
	stay ? calm(() => app.place(el, at)) : app.place(el, at);
	return el;
}

function buildAdd(root) {
	const tile = (icn, name, onclick, title) => h('button', { type: 'button', class: 'tile', onclick, title: title || null }, ic(icn, 22), h('span', { class: 'tile-name' }, name));
	const basics = [
		// Na toevoegen meteen typen: de eerste toets vervangt 'Tekst' (zoals een nieuw tekstvak in een ontwerpprogramma).
		tile('text', 'Tekst', () => editText(addEl('text', { align: 'center', valign: 'middle' }).id)),
		tile('heading', 'Koptekst', () => addEl('text', { text: 'Koptekst', font: 'Montserrat', size: 6.5, bold: true, align: 'center', valign: 'middle', wrap: false, fit: 'shrink' })),
		tile('barcode', 'Barcode', () => addEl('barcode')),
		tile('qr', 'QR-code', () => addEl('qr')),
		tile('image', 'Afbeelding', () => pickImage(), 'Afbeelding kiezen, slepen of plakken (Ctrl+V)'),
		tile('frame', 'Rand', () => applyBorder(null)),
		tile('star', 'Icoon', () => openIcons(S.iconTab === 'emoji' ? 'weed' : S.iconTab), 'Kies een icoon in Iconen'),
		tile('smile', 'Emoji', () => openIcons('emoji'), 'Kies een emoji'),
		tile('shapes', 'Vorm', () => addEl('shape')),
	];
	const shapes = h('div', { class: 'shape-grid' }, SHAPES.map(s => thumbButton({ px: 72, doc: () => shapeDoc(s.id), title: s.name, onclick: () => addEl('shape', { shape: s.id }, true) }).btn));
	const fields = SMART.map(([icn, name, tok]) => {
		const sub = h('span', { class: 'tile-sub' });
		const b = h('button', { type: 'button', class: 'tile wide', title: `Voegt ${tok} in`, onclick: () => addEl('text', { text: tok }) }, ic(icn, 20), h('span', { class: 'tile-name' }, name), sub);
		return { b, sub, tok };
	});
	const borders = h('div');
	buildBorders(borders);
	root.append(dsec('Basis', h('div', { class: 'tiles' }, basics)),
		acc('add.shapes', 'Vormen', false, shapes), acc('add.borders', 'Randen', false, borders),
		acc('add.smart', 'Automatisch', false, h('div', { class: 'tiles one' }, fields.map(f => f.b))));
	panels.push({ root, scope: () => [], ups: [() => {
		const c = app.doc.counter, now = new Date();
		for (const f of fields) setText(f.sub, substitute(f.tok, { now, counter: +c.start || 0, digits: c.digits }));
	}] });
}

// ---------- lade: Templates ----------
// Thumbnails tonen het template zoals het op JOUW rol landt (adaptTemplate), gecachet per (id, labelmaat).
const tplDocs = new Map();
function tplThumbDoc(tpl, th) {
	const L = app.doc.label, key = tpl.id + '@' + labelSig();
	let e = tplDocs.get(key);
	if (!e) {
		if (tplDocs.size > 600) tplDocs.clear();
		e = { doc: null };
		tplDocs.set(key, e);
		try {
			const d = adapt(tpl.doc, L);
			if (!needsIcons(d)) e.doc = d;
			else hydrateIcons(d).then(r => { e.stale = r.failed; }).finally(() => { e.doc = d; th.drawn = null; if (th.vis || th.warm) queueThumb(th); });
		} catch (err) { console.warn('template', tpl.id, err); }
	}
	return e.doc;
}

function buildTemplates(root) {
	const q = h('input', { type: 'search', placeholder: 'Zoek op naam of tag…', 'aria-label': 'Templates zoeken' });
	let cat = 'all', placed = null;
	const cats = [['all', 'Alle'], ['mine', 'Mijn templates'], ...TEMPLATE_CATEGORIES.map(c => [c.id, c.name])];
	const chipBtns = cats.map(([id, n]) => { const b = chip(n, () => { cat = id; filter(); }); b.dataset.id = id; return b; });
	const only = h('input', { type: 'checkbox', role: 'switch' });
	only.addEventListener('change', () => { S.onlyMine = only.checked; saveUi(); filter(); });
	const card = tpl => {
		const L = tpl.doc?.label || {};
		const { btn, t } = thumbButton({ px: 220, doc: () => tplThumbDoc(tpl, t), sig: labelSig, title: tpl.name, cls: 'tpl-card', onclick: () => loadTemplate(tpl.name, tpl.doc, false) });
		btn.append(h('span', { class: 'tpl-meta' }, h('span', { class: 'tpl-name' }, tpl.name), h('span', { class: 'tpl-size' }, sizeName(L))));
		return { btn, t, tpl, label: L, hay: tplHay(tpl), name: fold(tpl.name), exact: null, tiny: false };
	};
	// Twee secties (past exact / andere maten), elk met dezelfde categorie-indeling; kaarten verhuizen alleen bij een andere rol.
	const mkSec = () => { const h3 = h('h3', {}); return { h3, el: h('section', { class: 'dsec tpl-sec' }, h3) }; };
	const secA = mkSec(), secB = mkSec();
	const groups = TEMPLATE_CATEGORIES.map(c => {
		const list = TEMPLATES.filter(t => t.category === c.id).map(card);
		if (!list.length) return null;
		const mk = sec => { const grid = h('div', { class: 'tpl-grid' }), el = h('div', { class: 'tpl-cat' }, h('h4', {}, c.name), grid); sec.el.append(el); return { el, grid }; };
		return { id: c.id, list, a: mk(secA), b: mk(secB) };
	}).filter(Boolean);
	const emptyA = h('p', { class: 'empty' });
	const more = h('button', { type: 'button', class: 'btn sm more-btn', onclick: () => { S.onlyMine = false; saveUi(); filter(); only.focus(); } });   // de knop verdwijnt: focus naar de schakelaar
	secA.el.append(emptyA, more);
	mine = { grid: h('div', { class: 'tpl-grid' }), empty: h('p', { class: 'empty' }, 'Nog niets opgeslagen (Ctrl+S).'), sig: null, cards: [] };
	mine.el = h('section', { class: 'dsec' }, h('h3', {}, 'Mijn templates'), mine.grid, mine.empty);
	function place() {
		const L = app.doc.label, sig = labelSig();
		if (sig === placed) return;
		placed = sig;
		for (const g of groups) {
			let moved = false;
			for (const c of g.list) {
				const ex = sameSize(c.label, L);
				if (c.exact !== ex) { c.exact = ex; moved = true; }
				try { c.tiny = !ex && tooSmall(normalizeTemplateDoc(c.tpl.doc), adapt(c.tpl.doc, L)); } catch { c.tiny = false; }
			}
			// Alles in vaste volgorde opnieuw aanhangen (verplaatst bestaande knoppen, bouwt niets nieuw).
			if (moved) for (const c of g.list) (c.exact ? g.a.grid : g.b.grid).append(c.btn);
		}
		setText(secA.h3, `Jouw formaat (${sizeName(L)})`);
		setText(secB.h3, 'Andere maten');
		secB.h3.title = `Aangepast aan ${sizeName(L)}`;
	}
	function filter() {
		place();
		const w = words(q.value), s = w.join(' '), has = t => w.every(x => t.includes(x));
		only.checked = S.onlyMine;
		for (const b of chipBtns) b.setAttribute('aria-pressed', String(b.dataset.id === cat));
		let m = 0;
		for (const c of mine.cards) { const show = !s || has(c.name); c.el.hidden = !show; if (show) m++; }
		// Leeg = alleen onder 'Mijn templates' tonen (met de lege-staat), niet als extra blok bij Alle.
		// Onder 'Mijn templates' zelf altijd een melding, ook bij een zoekterm zonder treffer.
		mine.el.hidden = !(cat === 'all' || cat === 'mine') || (cat === 'all' && (!mine.cards.length || (s && !m)));
		mine.empty.hidden = m > 0;
		setText(mine.empty, s && mine.cards.length ? 'Niets gevonden.' : 'Nog niets opgeslagen (Ctrl+S).');
		let nA = 0, nB = 0;
		// Zoeken = beste titel-match bovenaan (kaart én categorie), via CSS order: geen DOM-verhuizing per toetsaanslag.
		for (const g of groups) {
			let a = 0, b = 0, ma = 0, mb = 0;
			for (const c of g.list) {
				const show = cat !== 'mine' && (cat === 'all' || cat === g.id) && (!s || has(c.hay)) && !c.tiny, sc = show && s ? tplScore(c.name, w[0]) : 0;
				c.btn.hidden = !show; c.btn.style.order = sc ? String(-sc) : '';
				if (show) c.exact ? (a++, ma = Math.max(ma, sc)) : (b++, mb = Math.max(mb, sc));
			}
			g.a.el.hidden = !a; g.b.el.hidden = !b; nA += a; nB += b;
			g.a.el.style.order = ma ? String(-ma) : ''; g.b.el.style.order = mb ? String(-mb) : '';
		}
		secA.el.hidden = cat === 'mine';
		secB.el.hidden = cat === 'mine' || S.onlyMine || !nB;
		emptyA.hidden = nA > 0;
		setText(emptyA, s ? 'Niets gevonden.' : 'Geen templates in deze categorie.');
		more.hidden = !S.onlyMine || !nB;
		setText(more, `Toon ook andere maten (${nB})`);
	}
	mine.filter = filter;
	q.addEventListener('input', filter);
	root.append(dsec(null, h('div', { class: 'searchbox' }, ic('search', 16), q), hscroll(h('div', { class: 'chips' }, chipBtns)),
		h('label', { class: 'switch only-mine', title: 'Alleen templates die exact op je huidige labelmaat en -vorm ontworpen zijn' }, only, h('span', {}, 'Alleen mijn formaat'))),
		mine.el, secA.el, secB.el);
	refreshMine();
	// Opgeslagen/verwijderd in een ander venster: anders laadde een kaart hier nog de oude versie (null = alles gewist).
	addEventListener('storage', e => { if (e.key === 'pm110.v2.templates' || e.key === null) refreshMine(); });
	// Eerste kaarten in rusttijd voorbereiden (aanpassen, iconen, tekenen): Templates openen toonde anders eerst grijze vlakken.
	idle(() => { for (const c of groups.flatMap(g => g.list).filter(c => c.exact && !c.btn.hidden).slice(0, 8)) { c.t.warm = true; queueThumb(c.t); } });
	// Andere rol gekozen: secties opnieuw indelen (alleen als de lade zichtbaar is; openen doet refresh).
	panels.push({ root, scope: () => [], ups: [() => { if (labelSig() !== placed) filter(); }] });
}

// Alleen na opslaan/verwijderen bijwerken (handtekening-diff), nooit per refresh. Kaarten per name@updated hergebruiken:
// alleen nieuwe bouwen, weggevallen weghalen (een herbouw liet elke thumb even leeg flitsen).
function refreshMine() {
	if (!mine) return;
	const list = userTemplates.list(), sig = list.map(t => t.name + '@' + t.updated).join('|');
	if (sig === mine.sig) return;
	mine.sig = sig;
	const old = new Map(mine.cards.map(c => [c.key, c]));
	mine.cards = list.map(t => { const k = t.name + '@' + t.updated, c = old.get(k); old.delete(k); return c || mineCard(t, k); });
	for (const c of old.values()) { dropThumb(c.th); c.el.remove(); }
	// Alleen verplaatsen wat niet al op zijn plek staat: verplaatsen haalt een knop even uit de DOM (focus weg).
	mine.cards.forEach((c, i) => { if (mine.grid.children[i] !== c.el) mine.grid.insertBefore(c.el, mine.grid.children[i] || null); });
	mine.filter();
}
function mineCard(t, key) {
	const src = { id: 'mine:' + key, doc: t.doc };
	const { btn, t: th } = thumbButton({ px: 220, doc: () => tplThumbDoc(src, th), sig: labelSig, title: t.name, cls: 'tpl-card', onclick: () => loadTemplate(t.name, t.doc, true) });
	btn.append(h('span', { class: 'tpl-meta' }, h('span', { class: 'tpl-name' }, t.name), h('span', { class: 'tpl-size' }, sizeName(t.doc.label))));
	const del = ib('trash', `Template "${t.name}" verwijderen`, async ev => {
		ev.stopPropagation();
		if (!await ask('Template verwijderen?', `"${t.name}" wordt definitief uit je browser verwijderd.`, 'Verwijderen', true)) return;
		const i = mine.cards.indexOf(c);
		userTemplates.remove(t.name); refreshMine(); toast('Template verwijderd');
		(mine.cards[i] || mine.cards.at(-1))?.btn.focus();   // de knop met focus is weg: naar de buurkaart
	}, 'tpl-del');
	const c = { key, th, btn, el: h('div', { class: 'tpl-wrap' }, btn, del), name: fold(t.name) };
	return c;
}

// Titel-relevantie: naam begint ermee (4) > een woord begint ermee (3) > naam bevat het (2) > alleen een tag (1).
const tplScore = (name, s) => name.startsWith(s) ? 4 : name.split(/[^\p{L}\p{N}]+/u).some(w => w.startsWith(s)) ? 3 : name.includes(s) ? 2 : 1;
// Ingevulde waarden naar een ander template met hetzelfde veld (key + type + eenheid): ontwerpen vergelijken zonder overtypen.
// Niet: demo-waarden (die horen bij het vorige ontwerp), een andere eenheid (300 g werd 300 kg) en een onbekende keuze.
// Alleen value, geen offset (THT +3 hoort bij het ontwerp). -> aantal meegenomen.
function carryFields(from, to, demo = () => false) {
	let n = 0;
	for (const f of Array.isArray(to) ? to : []) {
		const o = (Array.isArray(from) ? from : []).find(x => x?.key === f?.key && x.type === f.type && (x.suffix ?? '') === (f.suffix ?? ''));
		if (!o || o.value === f.value || o.value === '' || o.value == null || demo(o.key, o.value) || (f.type === 'choice' && !(f.options || []).map(String).includes(String(o.value)))) continue;
		f.value = o.value; n++;
	}
	return n;
}
// Demo-waarde = staat zo in het template waar dit label vandaan komt (de labelnaam; overleeft ook herladen). Niet 'staat in
// een of ander template': korte waarden als '2' (gram) zijn daar ook demo, en dan ging de echte invulling verloren.
const isDemo = (k, v) => (TEMPLATES.find(t => t.name === docName())?.doc?.fields || []).some(f => f.key === k && f.value === v);
// Kalibratie, lijst en teller horen bij de printer/sessie, niet bij een ontwerp: meenemen naar het nieuwe label.
// csv = false: een lijst uit het bestand zelf blijft (import).
function keepSession(d, csv = true) {
	const c = app.doc;
	d.print = structuredClone(c.print); d.counter = structuredClone(c.counter);
	if (csv || !d.batch.csv) d.batch = structuredClone(c.batch);
}
// Alleen de laatst gestarte laadactie (template, import, nieuw) mag het label vervangen: een trage icoon-fetch van een
// eerder geklikt template overschrijft anders het label waar je al aan werkt.
let loadSeq = 0;
// Je rol is leidend: het template wordt aangepast aan de huidige labelmaat (die verandert nooit), 1 undo-stap.
// Printinstellingen (kalibratie), lijst en teller horen bij de printer/sessie, niet bij een ontwerp: die blijven staan.
async function loadTemplate(name, src, full) {
	const my = ++loadSeq;
	try {
		const base = full ? migrate(src) : src;
		let L, d, r, sig;
		// Rol of maat gewisseld terwijl de iconen laadden: opnieuw aanpassen aan wat nu is ingesteld (de rol is leidend).
		do {
			sig = labelSig(); L = { ...app.doc.label }; d = adapt(base, L);
			r = await hydrateIcons(d);
			if (my !== loadSeq) return;
		} while (sig !== labelSig());
		const kept = carryFields(app.doc.fields, d.fields, isDemo);
		keepSession(d);
		d.name = name;
		app.replace(d);
		toast(`${sameSize(base?.label || {}, L) ? '' : `Aangepast aan ${sizeName(L)}: `}"${name}" geladen${kept ? ', invulling meegenomen' : ''}. Ctrl+Z zet je vorige label terug.`, 'ok');
		if (r.failed) toast(OFFLINE_ICONS, 'warn');
		const f0 = app.doc.fields[0];
		if (f0) focusField(f0.key);
	} catch (e) { if (my === loadSeq) toast('Template laden mislukt: ' + e.message, 'err'); }
}

// ---------- lade: Iconen ----------
// Drie bronnen in één lade; elke sub-tab bouwt 1× en laadt zijn data pas bij de eerste keer openen.
function buildIcons(root) {
	const subBtns = {}, subs = {};
	const segEl = h('div', { class: 'seg subtabs', role: 'group', 'aria-label': 'Soort' }, SUBS.map(([k, n]) => subBtns[k] = h('button', { type: 'button', 'aria-pressed': 'false', onclick: () => openSub(k) }, n)));
	const bannerTxt = h('span', {});
	const banner = h('div', { class: 'banner', hidden: true }, ic('swap', 16), bannerTxt, h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { setReplace(null); subBtns[S.iconTab].focus(); } }, 'Annuleren'));
	subs.weed = buildWeed();
	subs.tabler = h('div', { hidden: true });
	buildTabler(subs.tabler);
	subs.online = buildOnline();
	subs.emoji = buildEmojiPane();
	root.append(h('div', { class: 'dsec' }, segEl), banner, subs.weed, subs.tabler, subs.online, subs.emoji);
	iconUI.subBtns = subBtns; iconUI.subs = subs;
	// Bronvermelding als tooltip i.p.v. een uitlegregel onder elk raster.
	subBtns.weed.title = 'Wiet- en smoke-iconen uit open collecties, offline (licenties: CREDITS.md)';
	subBtns.tabler.title = 'Tabler Icons (MIT)';
	subBtns.online.title = 'Iconify: open collecties, wordt in je label opgeslagen (print ook offline)';
	subBtns.emoji.title = 'Emoji-namen: emojibase (MIT)';
	panels.push({ root, scope: () => [], ups: [() => {
		const r = replaceEl();
		banner.hidden = !r;
		if (r) setText(bannerTxt, 'Kies een vervanger.');
	}] });
}
function openSub(id) {
	S.iconTab = id; saveUi();
	// Subtab van een ander type (emoji <-> icoon): een klik voegt dan toe, dus de vervang-banner mag niet blijven staan.
	if (S.iconReplace && !replaceEl(id === 'emoji' ? 'emoji' : 'icon')) setReplace(null);
	onlineUI.lic.hidden = true;
	for (const [k] of SUBS) { iconUI.subs[k].hidden = k !== id; iconUI.subBtns[k].setAttribute('aria-pressed', String(k === id)); }
	if (!subShown[id]) { subShown[id] = true; ({ weed: showWeed, online: showOnline, emoji: showEmoji }[id] || showIcons)(); }
}

// ---------- lade: Iconen → Wiet (eigen pakket, offline) ----------
function buildWeed() {
	const q = h('input', { type: 'search', placeholder: 'Zoek: joint, bong, blad, brownie…', 'aria-label': 'Wiet-iconen zoeken' });
	q.addEventListener('input', debounce(() => showWeed(), 160));
	const chips = hscroll(h('div', { class: 'chips' }));
	const msg = h('p', { class: 'hint center', role: 'status' }), retry = h('button', { type: 'button', class: 'btn sm', hidden: true, onclick: () => { q.focus(); showWeed(); } }, 'Opnieuw proberen');
	const grid = h('div', { class: 'icon-grid' });
	weedUI = { q, chips, chipBtns: null, msg, retry, grid, pool: [] };
	return h('div', { hidden: true },
		dsec(null, h('div', { class: 'searchbox' }, ic('search', 16), q), chips),
		h('div', { class: 'dsec' }, msg, retry, grid));
}
// Pool groeit alleen; verborgen knoppen worden hergebruikt (zoals emoji).
function weedCell(i) {
	const u = weedUI;
	if (!u.pool[i]) {
		const img = h('img', { alt: '', width: 28, height: 28, decoding: 'async' }), b = h('button', { type: 'button', class: 'icon-cell' }, img);
		b.addEventListener('click', () => pickWeed(b.dataset.id));
		u.grid.append(b);
		u.pool[i] = { b, img, key: '' };
	}
	return u.pool[i];
}
// Eén vulregel voor prewarm en showWeed: een vooraf gevuld vakje wordt niet opnieuw gevuld.
function fillWeed(c, it) {
	if (c.key === it.id) return;
	c.key = it.id; c.b.dataset.id = it.id; c.b.title = it.name || it.id; c.b.setAttribute('aria-label', 'Icoon ' + (it.name || it.id));
	c.img.src = it.svg ? svgUrl(it.svg) : '';
}
async function showWeed() {
	const u = weedUI, my = ++weedSeq, s = u.q.value.trim();
	u.retry.hidden = true;
	let wp;
	try { wp = await weedPack(); }
	catch { if (my === weedSeq) { for (const c of u.pool) c.b.hidden = true; setText(u.msg, 'Wiet-pakket laden mislukt.'); u.retry.hidden = false; } return; }
	if (my !== weedSeq) return;
	const cats = wp.pack.categories;
	if (!u.chipBtns) {
		u.chipBtns = [['', 'Alle'], ...cats.map(c => [c.id, c.name])].map(([id, n]) => {
			const b = chip(n, () => { S.weedCat = id; u.q.value = ''; showWeed(); });
			b.dataset.v = id; return b;
		});
		u.chips.append(...u.chipBtns);
	}
	for (const b of u.chipBtns) b.setAttribute('aria-pressed', String(!s && b.dataset.v === S.weedCat));
	const list = s ? wp.m.searchWeedPack(wp.pack, s) : S.weedCat ? cats.find(c => c.id === S.weedCat)?.icons || [] : cats.flatMap(c => c.icons);
	list.forEach((it, i) => {
		const c = weedCell(i);
		c.b.hidden = false;
		fillWeed(c, it);
	});
	for (let i = list.length; i < u.pool.length; i++) u.pool[i].b.hidden = true;
	setText(u.msg, list.length ? '' : s ? `Niets voor "${s}"; probeer Online.` : 'Geen iconen in deze groep.');
}
// Vervangen: zelfde id blijft geselecteerd (select meldt niets), dus zelf terug naar Bewerken.
function replaced(el) { assetRequests.delete(el); app.changed(); app.select([el.id]); setReplace(null); openEdit(); }
function pickWeed(id) {
	const it = id && weedIdx?.get(id);
	if (!it?.svg) return;
	const icon = { source: 'iconify', svg: it.svg, icon: id, nodes: [] }, el = replaceEl('icon');
	if (el) { Object.assign(el, icon); return replaced(el); }
	addIcon(icon);
}
// Eerst de inkt meten: plaatsen centreert daarop, en een nooit gemeten svg telde anders als zijn hele viewBox (scheef).
async function addIcon(icon) {
	const doc = app.doc;
	await loadIcon({ ...ELEMENT_DEFAULTS.icon, ...icon });
	return sameTarget(doc) ? addEl('icon', icon, true) : null;
}
// Vervangen geldt alleen zolang precies dat element geselecteerd is (anders overschrijft een klik stil een ander element).
const replaceEl = type => {
	const id = S.iconReplace, el = id && app.selection.length === 1 && app.selection[0] === id && app.doc.elements.find(e => e.id === id);
	return el && (!type || el.type === type) ? el : null;
};
// Een late download hoort niet bij een nieuw label of een inmiddels verwijderd doel.
const sameTarget = (doc, el = null) => app.doc === doc && (!el || doc.elements.includes(el));
const assetRequests = new WeakMap();
function assetRequest(el = null) {
	const doc = app.doc, token = {};
	if (el) assetRequests.set(el, token);
	return () => sameTarget(doc, el) && (!el || assetRequests.get(el) === token);
}

function buildTabler(root) {
	const q = h('input', { type: 'search', placeholder: 'Zoek: pijl, hart, koffie, wifi…', 'aria-label': 'Iconen zoeken' });
	q.addEventListener('input', debounce(() => showIcons(), 160));
	const setSeg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Icoonstijl' });
	const setBtns = [['outline', 'Lijn', null], ['filled', 'Gevuld', 'Gevuld bestaat niet voor elk icoon']].map(([v, t, title]) => {
		const b = h('button', { type: 'button', 'aria-pressed': 'false', title, onclick: () => { S.iconSet = v; showIcons(); } }, t);
		b.dataset.v = v; setSeg.append(b); return b;
	});
	S.iconCat = ICON_CATEGORIES[0].id;
	const catBtns = ICON_CATEGORIES.map(c => { const b = chip(c.name, () => { S.iconCat = c.id; q.value = ''; showIcons(); }); b.dataset.v = c.id; return b; });
	const msg = h('p', { class: 'hint center', role: 'status' }), retry = h('button', { type: 'button', class: 'btn sm', hidden: true, onclick: () => { q.focus(); showIcons(); } }, 'Opnieuw proberen');
	const grid = h('div', { class: 'icon-grid' });
	const pool = Array.from({ length: 120 }, () => {
		const img = h('img', { alt: '', width: 28, height: 28, decoding: 'async' }), b = h('button', { type: 'button', class: 'icon-cell', hidden: true }, img);
		b.addEventListener('click', () => pickIcon(b.dataset.name));
		grid.append(b);
		return { b, img, key: '' };
	});
	root.append(dsec(null, h('div', { class: 'searchrow' }, h('div', { class: 'searchbox' }, ic('search', 16), q), setSeg), hscroll(h('div', { class: 'chips' }, catBtns))),
		h('div', { class: 'dsec' }, msg, retry, grid));
	iconUI = { q, setBtns, catBtns, msg, retry, pool };
}
function markIconUI() {
	const u = iconUI, q = u.q.value.trim();
	for (const b of u.setBtns) b.setAttribute('aria-pressed', String(b.dataset.v === S.iconSet));
	for (const b of u.catBtns) b.setAttribute('aria-pressed', String(!q && b.dataset.v === S.iconCat));
}
async function showIcons() {
	const u = iconUI, my = ++iconSeq, set = S.iconSet;
	markIconUI();
	u.retry.hidden = true; setText(u.msg, 'Iconen laden…');
	let lib, names;
	try { lib = await loadIconSet(set); }
	catch { if (my === iconSeq) { setText(u.msg, 'Iconen laden mislukt. Ben je online?'); u.retry.hidden = false; } return; }
	iconsBack();   // set is er (weer): offline leeg gebleven iconen nu vullen
	if (my !== iconSeq) return;
	const q = u.q.value.trim();
	try { names = q ? await searchIcons(q, set, u.pool.length) : ICON_CATEGORIES.find(c => c.id === S.iconCat)?.icons || []; } catch { names = []; }
	if (my !== iconSeq) return;
	names = names.filter(n => lib[n]).slice(0, u.pool.length);
	u.pool.forEach((c, i) => {
		const n = names[i];
		c.b.hidden = !n;
		if (!n) return;
		const key = set + ':' + n;
		if (c.key === key) return;
		c.key = key; c.b.dataset.name = n; c.b.title = n; c.b.setAttribute('aria-label', 'Icoon ' + n);
		c.img.src = svgUrl(iconToSvg(lib[n], { set, stroke: 2 }));
	});
	setText(u.msg, names.length ? '' : q ? `Niets gevonden voor "${q}".` : 'Geen iconen in deze stijl; probeer Lijn.');
}
async function pickIcon(name) {
	if (!name) return;
	const set = S.iconSet, el = replaceEl('icon'), current = assetRequest(el);
	let lib;
	try { lib = await loadIconSet(set); } catch { return toast('Iconen laden mislukt', 'err'); }
	if (!current() || el && replaceEl('icon') !== el) return;
	const nodes = lib[name];
	if (!nodes) return;
	const icon = { source: 'tabler', svg: '', icon: name, set, nodes: structuredClone(nodes) };
	if (el) { Object.assign(el, icon); return replaced(el); }
	await addIcon(icon);
}
function setReplace(id) { S.iconReplace = id; refresh(); }
async function switchIconSet(p, set) {
	// Alleen wat echt wisselt: de actieve stijl nog eens klikken gaf anders een lege undo-stap.
	// Terug naar de huidige stijl annuleert ook een nog ladende andere stijl.
	const targets = p.scope().filter(e => e.source !== 'iconify'), current = targets.map(e => assetRequest(e));
	let lib;
	try { lib = await loadIconSet(set); } catch { return toast('Iconen laden mislukt', 'err'); }
	const els = targets.filter((e, i) => current[i]() && e.set !== set);
	let miss = 0;
	for (const e of els) { if (Object.hasOwn(lib, e.icon)) { e.set = set; e.nodes = structuredClone(lib[e.icon]); } else miss++; }
	if (miss) toast(miss === els.length ? 'Dit icoon bestaat niet als gevulde versie.' : 'Niet elk icoon bestaat als gevulde versie.', 'warn');
	if (miss < els.length) app.changed();
}

// ---------- lade: Iconen → Online (Iconify) ----------
function buildOnline() {
	const q = h('input', { type: 'search', placeholder: 'Zoek in 200.000+ iconen (Engels)…', 'aria-label': 'Online iconen zoeken' });
	q.addEventListener('input', debounce(() => showOnline(), 300));
	const chips = ONLINE_QUICK.map(([v, n]) => { const b = chip(n, () => { q.value = v; showOnline(); }, v ? `Zoek "${v}"` : 'Wiet- en smoke-iconen'); b.dataset.v = v; return b; });
	const msg = h('p', { class: 'hint center', role: 'status' }), retry = h('button', { type: 'button', class: 'btn sm', hidden: true, onclick: () => { q.focus(); for (const c of pool) c.key = ''; showOnline(); } }, 'Opnieuw proberen');
	const grid = h('div', { class: 'icon-grid' });
	const pool = Array.from({ length: 96 }, () => {
		const img = h('img', { alt: '', width: 28, height: 28, loading: 'lazy', decoding: 'async' }), b = h('button', { type: 'button', class: 'icon-cell', hidden: true }, img), c = { b, img, key: '' };
		b.addEventListener('click', () => pickIconify(b.dataset.id));
		// Zonder internet laden de plaatjes niet: dan één duidelijke melding i.p.v. lege vakjes. key wissen: hetzelfde id
		// later (chip/zoekopdracht) moet de src opnieuw zetten, anders blijft het een kapot vakje.
		img.addEventListener('error', () => { b.hidden = true; c.key = ''; if (pool.every(x => x.b.hidden)) { setText(msg, OFFLINE_MSG); retry.hidden = false; } });
		grid.append(b);
		return c;
	});
	// Zoeken of Collecties bladeren (iconbrowser.js, met eigen zoekveld). Beide delen 1× gebouwd, wisselen = hidden.
	const searchPart = h('div', {}, dsec(null, h('div', { class: 'searchbox' }, ic('search', 16), q), hscroll(h('div', { class: 'chips' }, chips))), h('div', { class: 'dsec' }, msg, retry, grid));
	const colRoot = h('div', { hidden: true });
	const modeBtns = [['search', 'Zoeken'], ['coll', 'Collecties']].map(([v, t]) => { const b = h('button', { type: 'button', 'aria-pressed': String(v === 'search'), onclick: () => showColl(v === 'coll') }, t); b.dataset.v = v; return b; });
	// Licentieregel onderaan, plakkend: verschijnen duwt het raster niet meer onder de muis weg.
	const lic = h('p', { class: 'hint lic lic-dock', hidden: true });
	let cb = null;
	async function showColl(on) {
		lic.hidden = true;
		searchPart.hidden = on; colRoot.hidden = !on;
		for (const b of modeBtns) b.setAttribute('aria-pressed', String((b.dataset.v === 'coll') === on));
		if (!on) return cb?.hide();
		try { const m = await ibMod(); cb ||= m.createCollections(colRoot, { onPick: (id, meta) => pickIconify(id, meta), toast }); cb.show(); }
		catch (e) { console.error('iconbrowser.js laden mislukt', e); toast('Collecties laden mislukt. Ben je online?', 'err'); showColl(false); }
	}
	onlineUI = { q, chips, msg, retry, pool, lic, grid };
	return h('div', { hidden: true },
		h('div', { class: 'dsec' }, h('div', { class: 'seg subtabs', role: 'group', 'aria-label': 'Online bladeren' }, modeBtns)), searchPart, colRoot, lic);
}
// Licentieregel na invoegen: alleen CC-BY vraagt naamsvermelding, de rest laat de regel weg. NC (cbi, ps) = niet voor
// verkoop: kort ervoor gezet en oranje, geen pop-up.
function showLic(m) {
	const l = onlineUI.lic;
	const by = /^CC-BY/i.test(m?.license?.spdx || '') || licNC(m?.license);
	l.hidden = !by;
	if (by) { setText(l, licText(m)); l.classList.toggle('nc', licNC(m.license)); }
}
async function showOnline() {
	const u = onlineUI, my = ++onlineSeq, q = u.q.value.trim();
	u.lic.hidden = true;   // nieuwe zoekopdracht: de regel hoort bij het vorige icoon
	for (const b of u.chips) b.setAttribute('aria-pressed', String(b.dataset.v === q));
	u.retry.hidden = true;
	let list;
	if (!q) {
		await weedPack().catch(() => {});   // standaardraster komt uit het pakket: geen netwerk
		if (my !== onlineSeq) return;
		list = icons.WEED_ICONS.iconify.map(id => { const [prefix, name] = iconifyParts(id); return { id, name, collection: prefix }; });
	} else {
		// Met resultaten in beeld: raster dimmen i.p.v. een statusregel erboven (die duwde het 17 px onder de muis weg).
		if (u.pool.some(c => !c.b.hidden)) u.grid.setAttribute('aria-busy', 'true'); else setText(u.msg, 'Zoeken…');
		try { list = await findWeb(q, u.pool.length); }
		catch (e) {
			if (my !== onlineSeq) return;
			u.grid.removeAttribute('aria-busy');
			for (const c of u.pool) c.b.hidden = true;
			// Iconify knijpt snel achter elkaar zoeken af (429): dat is geen offline-probleem.
			setText(u.msg, /HTTP 429/.test(e?.message) ? 'Te veel zoekopdrachten; probeer zo opnieuw.' : OFFLINE_MSG); u.retry.hidden = false;
			return;
		}
		if (my !== onlineSeq) return;
	}
	list = list.slice(0, u.pool.length);
	const svgs = await webSvg(list.map(it => it.id));
	if (my !== onlineSeq) return;
	u.pool.forEach((c, i) => {
		const it = list[i];
		c.b.hidden = !it;
		if (!it || c.key === it.id) return;
		c.key = it.id; c.b.dataset.id = it.id; c.b.title = `${it.name} (${it.collection})`; c.b.setAttribute('aria-label', 'Icoon ' + it.name);
		c.img.src = svgs[i] ? svgUrl(svgs[i]) : icons.iconifyUrl(it.id);
	});
	u.grid.removeAttribute('aria-busy');
	setText(u.msg, list.length ? '' : q ? `Niets voor "${q}" (zoek in het Engels).` : '');
}
// svg's: eerst het wiet-pakket (lokaal), dan icons.svgFor (één JSON-verzoek per prefix, cache gedeeld met Collecties).
// Mislukt = null (svgFor vergeet hem, zodat 'Opnieuw proberen' echt opnieuw vraagt). Zoekopdrachten 1x per sessie.
const webFinds = new Map();
const webSvg = ids => Promise.all(ids.map(id => weedIdx?.get(id)?.svg || icons.svgFor(...iconifyParts(id)).catch(() => null)));
const findWeb = (q, limit) => {
	const k = q.toLowerCase() + '|' + limit;
	if (!webFinds.has(k)) webFinds.set(k, icons.searchIconify(q, { limit }).catch(e => { webFinds.delete(k); throw e; }));
	return webFinds.get(k);
};
// meta = vanuit Collecties: de licentie; anders die opzoeken in de gecachte collectielijst. De svg via de .json-cache van het
// raster (na wat bladeren geeft de losse .svg-route een tijd HTTP 429). Licentie pas na een gelukte invoeging, anders lijkt
// het icoon er te staan.
async function pickIconify(id, meta = null) {
	if (!id) return;
	const el = replaceEl('icon'), current = assetRequest(el);
	let svg;
	try { svg = (await webSvg([id]))[0] || await icons.fetchIconifySvg(id); } catch { return toast('Icoon ophalen mislukt. Ben je online?', 'err'); }
	if (!current() || el && replaceEl('icon') !== el) return;
	const icon = { source: 'iconify', svg, icon: id, nodes: [] };
	if (el) { Object.assign(el, icon); replaced(el); }
	else if (!await addIcon(icon)) return;
	if (meta) showLic(meta);
	else ibMod().then(m => m.licenseOf(iconifyParts(id)[0])).then(showLic).catch(() => {});
}

// ---------- lade: Iconen → Emoji ----------
function buildEmojiPane() {
	const q = h('input', { type: 'search', placeholder: 'Zoek emoji…', 'aria-label': 'Emoji zoeken' });
	q.addEventListener('input', debounce(() => showEmoji(), 200));
	const styleSeg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Emoji-stijl' });
	const styleBtns = [['mono', 'Mono', 'Strak zwart (Noto Emoji)'], ['color', 'Kleur', 'Kleuren-emoji, omgezet naar printerpuntjes']].map(([v, t, title]) => {
		const b = h('button', { type: 'button', 'aria-pressed': 'false', title, onclick: () => { S.emojiStyle = v; markEmoji(); } }, t);
		b.dataset.v = v; styleSeg.append(b); return b;
	});
	const chips = hscroll(h('div', { class: 'chips' }));
	const msg = h('p', { class: 'hint center', role: 'status' }), retry = h('button', { type: 'button', class: 'btn sm', hidden: true, onclick: () => { q.focus(); showEmoji(); } }, 'Opnieuw proberen');
	const grid = h('div', { class: 'emoji-grid' });
	emojiUI = { q, styleBtns, chips, chipBtns: null, msg, retry, grid, pool: [] };
	return h('div', { hidden: true },
		dsec(null, h('div', { class: 'searchrow' }, h('div', { class: 'searchbox' }, ic('search', 16), q), styleSeg), chips),
		h('div', { class: 'dsec' }, msg, retry, grid));
}
function markEmoji() {
	const u = emojiUI, q = u.q.value.trim();
	for (const b of u.styleBtns) b.setAttribute('aria-pressed', String(b.dataset.v === S.emojiStyle));
	for (const b of u.chipBtns || []) b.setAttribute('aria-pressed', String(!q && b.dataset.v === String(S.emojiGroup)));
	u.grid.classList.toggle('em-mono', S.emojiStyle === 'mono');
	for (const c of u.pool) if (c.ch) setText(c.b, emojiFace(c.ch, S.emojiStyle === 'mono'));
	if (S.emojiStyle === 'mono') ensureFont('Noto Emoji');
}
// Mono zoals de print (render.drawEmoji): zonder U+FE0F, anders tekent Chrome de kleurglyph i.p.v. Noto Emoji.
const emojiFace = (ch, mono) => mono ? String(ch).replace(/\uFE0F/g, '') : String(ch);
// Pool groeit alleen (nooit opnieuw opbouwen); verborgen knoppen worden hergebruikt.
function emojiCell(i) {
	const u = emojiUI;
	if (!u.pool[i]) {
		const b = h('button', { type: 'button', class: 'emoji-cell' });
		b.addEventListener('click', () => pickEmoji(b.dataset.c));
		u.grid.append(b);
		u.pool[i] = { b, ch: '' };
	}
	return u.pool[i];
}
async function showEmoji() {
	const u = emojiUI, my = ++emojiSeq, q = u.q.value.trim(), g = S.emojiGroup;
	u.retry.hidden = true;
	const fail = () => { if (my !== emojiSeq) return; for (const c of u.pool) c.b.hidden = true; setText(u.msg, 'Emoji laden mislukt. Ben je online?'); u.retry.hidden = false; };
	let m;
	try { m = await emojiMod(); } catch { return fail(); }
	if (my !== emojiSeq) return;
	if (!u.chipBtns) {
		u.chipBtns = [['weed', 'Wiet & smoke'], ['recent', 'Recent'], ...m.EMOJI_GROUPS.map(x => [x.id, x.name])].map(([id, n]) => {
			const b = chip(n, () => { S.emojiGroup = id; u.q.value = ''; showEmoji(); });
			b.dataset.v = String(id); return b;
		});
		u.chips.append(...u.chipBtns);
	}
	markEmoji();
	// Namen voor de tooltips op de achtergrond; wiet en recent werken ook zonder data (offline).
	if (!emojiLabels) m.loadEmoji().then(all => { emojiLabels ||= new Map(all.map(e => [emojiFace(e.char, true), e.label])); for (const c of u.pool) if (c.ch) { c.b.title = emojiLabels.get(emojiFace(c.ch, true)) || c.ch; c.b.setAttribute('aria-label', 'Emoji ' + c.b.title); } }).catch(() => {});
	let list;
	if (!q && g === 'weed') list = m.WEED_EMOJI;
	else if (!q && g === 'recent') list = m.recentEmoji();
	else {
		setText(u.msg, 'Emoji laden…');
		try { list = q ? await m.searchEmoji(q) : (await m.loadEmoji()).filter(e => e.group === g).map(e => e.char); } catch { return fail(); }
		if (my !== emojiSeq) return;
	}
	list.forEach((ch, i) => {
		const c = emojiCell(i);
		c.b.hidden = false;
		if (c.ch === ch) return;
		c.ch = ch; c.b.dataset.c = ch; setText(c.b, emojiFace(ch, S.emojiStyle === 'mono'));
		const label = emojiLabels?.get(emojiFace(ch, true)) || ch;   // sleutel zonder U+FE0F: emojibase en WEED_EMOJI schrijven hem verschillend
		c.b.title = label; c.b.setAttribute('aria-label', 'Emoji ' + label);
	});
	for (let i = list.length; i < u.pool.length; i++) u.pool[i].b.hidden = true;
	setText(u.msg, list.length ? '' : q ? `Niets gevonden voor "${q}".` : g === 'recent' ? 'Nog geen recente emoji.' : 'Geen emoji in deze groep.');
}
function pickEmoji(ch) {
	if (!ch) return;
	emojiMod().then(m => m.pushRecentEmoji(ch)).catch(() => {});
	const el = replaceEl('emoji');
	if (el) { el.char = ch; return replaced(el); }
	addEl('emoji', { char: ch, style: S.emojiStyle }, true);
}

// ---------- lade: Randen ----------
// Een in Lagen verborgen rand alleen als je hem zelf selecteerde: anders deed de Rand-tegel zichtbaar niets.
const currentBorder = () => app.selected().find(e => e.type === 'border') || app.doc.elements.find(e => e.type === 'border' && !e.hidden);
// Eén rand per label is het gangbare geval: bestaande rand wisselt van stijl (de Rand-tegel selecteert hem alleen; een
// tweede rand lag precies onzichtbaar op de eerste), anders komt er een bij.
function applyBorder(style) {
	const cur = currentBorder();
	if (cur) { if (style && cur.style !== style) { cur.style = style; app.changed(); } calm(() => app.select([cur.id])); return; }
	addEl('border', style ? { style } : {}, true);
}
function buildBorders(root) {
	const btns = BORDER_STYLES.map(s => {
		const { btn } = thumbButton({ px: 180, doc: () => borderDoc(s.id), sig: labelSig, title: s.name, onclick: () => applyBorder(s.id) });
		btn.append(h('span', { class: 'bd-name' }, s.name));
		btn.dataset.v = s.id;
		return btn;
	});
	root.append(h('div', { class: 'border-grid', title: 'Staat er al een rand, dan wisselt hij van stijl' }, btns));
	panels.push({ root, scope: () => [], ups: [() => { const b = currentBorder(); for (const x of btns) x.setAttribute('aria-pressed', String(!!b && b.style === x.dataset.v)); }] });
}

// ---------- lade: Lagen ----------
function buildLayers(root) {
	const list = h('div', { class: 'layers', role: 'listbox', 'aria-label': 'Lagen', 'aria-multiselectable': 'true', title: 'Sleep om te ordenen, Shift-klik = meer, dubbelklik = bewerken' });
	const empty = h('p', { class: 'empty' }, 'Nog geen elementen.');
	root.append(dsec(null, list, empty));
	panels.push({ root, scope: () => [], ups: [() => refreshLayers(list, empty)] });
}
function layerRow(id) {
	const name = h('span', { class: 'ly-name' }), sub = h('span', { class: 'ly-sub' }), tic = h('span', { class: 'ly-ic' });
	const eye = h('button', { type: 'button', class: 'btn ghost ib sm ly-btn' }), lock = h('button', { type: 'button', class: 'btn ghost ib sm ly-btn' });
	const del = h('button', { type: 'button', class: 'btn ghost ib sm ly-btn ly-delete', onclick: () => app.remove([id]) }, ic('trash', 16));
	const row = h('div', { class: 'layer', draggable: true, role: 'option', tabIndex: 0, 'aria-selected': 'false' },
		h('span', { class: 'ly-grip', 'aria-hidden': 'true' }, ic('grip', 14)), tic, h('span', { class: 'ly-txt' }, name, sub), eye, lock, del);
	// Klik selecteert en houdt Lagen open (Shift-klik, oog en slot blijven bruikbaar); dubbelklik of Enter = Bewerken.
	row.addEventListener('click', e => {
		if (e.target.closest('.ly-btn')) return;
		const s = app.selection;
		calm(() => app.select(e.shiftKey || e.ctrlKey || e.metaKey ? (s.includes(id) ? s.filter(x => x !== id) : [...s, id]) : [id]));
		if (app.selection.includes(id)) revealSel([id]);
	});
	row.addEventListener('dblclick', e => { if (!e.target.closest('.ly-btn')) { app.select([id]); openEdit(); } });
	row.addEventListener('keydown', e => {
		if (e.target !== row) return;
		if (e.key === ' ') { e.preventDefault(); calm(() => app.select([id])); revealSel([id]); }
		else if (e.key === 'Enter') { e.preventDefault(); app.select([id]); openEdit(); revealSel([id]); }
		else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); (e.key === 'ArrowUp' ? row.previousElementSibling : row.nextElementSibling)?.focus(); }
	});
	eye.addEventListener('click', () => flipFlag([id], 'hidden'));
	lock.addEventListener('click', () => flipFlag([id], 'locked'));
	row.addEventListener('dragstart', e => { dragId = id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id); row.classList.add('dragging'); });
	row.addEventListener('dragend', () => { dragId = null; row.classList.remove('dragging'); clearDrop(); });
	row.addEventListener('dragover', e => {
		if (!dragId || dragId === id) return;
		e.preventDefault();
		const r = row.getBoundingClientRect(), above = e.clientY < r.top + r.height / 2;
		if (row._above !== above || !row.matches('.drop-above,.drop-below')) { clearDrop(); row.classList.add(above ? 'drop-above' : 'drop-below'); row._above = above; }
	});
	row.addEventListener('drop', e => {
		e.preventDefault();
		const from = dragId; clearDrop();
		if (!from || from === id) return;
		const to = dropIndex(app.doc.elements.map(x => x.id), from, id, row._above);
		if (to >= 0) app.reorder(from, to);
	});
	const r = { row, name, sub, tic, eye, lock, del, t: '', hid: null, lck: null };
	layerRows.set(id, r);
	return r;
}
function clearDrop() { for (const r of layerRows.values()) r.row.classList.remove('drop-above', 'drop-below'); }
// Zoals op het label: {velden} ingevuld, iconen met hun mensennaam, dunne rechthoek = lijn (Lagen sprak het canvas tegen).
// display: veldwaarden 1x per lijst (Lagen draait elk frame tijdens slepen), anders rekent substitute ze per regel uit.
function layerSub(e, display = null) {
	if (e.type === 'text' || e.type === 'barcode' || e.type === 'qr') {
		const s = String((e.type === 'text' ? e.text : e.data) || '').split('\n')[0], c = app.doc.counter;
		return substitute(s, { fields: app.doc.fields, row: A.previewRow(), counter: +c.start || 0, digits: c.digits, display });
	}
	if (e.type === 'icon') return iconName(e);
	if (e.type === 'emoji') return e.char;
	if (e.type === 'shape') return e.shape === 'rect' && Math.min(+e.w, +e.h) <= 0.5 ? 'Lijn' : SHAPES.find(s => s.id === e.shape)?.name || e.shape;
	return e.type === 'border' ? BORDER_STYLES.find(s => s.id === e.style)?.name || e.style : '';
}
// Mensennaam uit het wiet-pakket, anders de id zonder collectie en streepjes ('streamline-cyber:cannabis-leaf' -> 'cannabis leaf').
const iconName = e => String((e.source === 'iconify' && weedIdx?.get(e.icon)?.name) || (e.source === 'iconify' ? iconifyParts(e.icon)[1] : e.icon) || '').replace(/[-_]+/g, ' ');
function refreshLayers(list, empty) {
	const els = app.doc.elements, sel = new Set(app.selection), live = new Set(els.map(e => e.id)), fv = fieldValues(app.doc.fields, A.previewRow()), raw = fv.raw;
	// Verwijderde regel met focus (Delete in Lagen): focus naar de regel op die plek, anders viel hij naar de pagina.
	const fr = document.activeElement?.closest?.('.layer'), fi = fr && list.contains(fr) ? [...list.children].indexOf(fr) : -1;
	for (const [id, r] of layerRows) if (!live.has(id)) { r.row.remove(); layerRows.delete(id); }
	for (let i = els.length - 1, pos = 0; i >= 0; i--, pos++) {
		const e = els[i], r = layerRows.get(e.id) || layerRow(e.id);
		if (list.children[pos] !== r.row) list.insertBefore(r.row, list.children[pos] || null);
		if (r.t !== e.type) { r.t = e.type; r.tic.replaceChildren(ic(TYPE_IC[e.type] || 'layers', 16)); }
		setText(r.name, e.name || TYPE_NAMES[e.type] || e.type);
		setText(r.sub, layerSub(e, fv.display).slice(0, 60));
		const s = sel.has(e.id);
		r.row.classList.toggle('sel', s); r.row.setAttribute('aria-selected', String(s));
		// Zichtbaarheid zoals op het label (na de veldregels); door een veld bepaald = oog uit, met uitleg.
		const hid = !!effective(e, raw).hidden, tip = ruleLocked(e, 'hidden') ? ruleTip(e, 'hidden') : '';
		r.row.classList.toggle('is-hidden', hid);
		if (r.hid !== hid || r.tip !== tip) { r.hid = hid; r.tip = tip; r.eye.replaceChildren(ic(hid ? 'eyeOff' : 'eye', 16)); r.eye.title = tip || (hid ? 'Tonen' : 'Verbergen'); r.eye.disabled = !!tip; r.eye.setAttribute('aria-label', r.eye.title); r.eye.setAttribute('aria-pressed', String(hid)); }
		if (r.lck !== !!e.locked) { r.lck = !!e.locked; r.lock.replaceChildren(ic(e.locked ? 'lock' : 'unlock', 16)); r.lock.title = e.locked ? 'Ontgrendelen' : 'Vergrendelen'; r.lock.setAttribute('aria-label', r.lock.title); r.lock.setAttribute('aria-pressed', String(r.lck)); }
		r.del.disabled = !!e.locked;
		r.del.title = e.locked ? 'Ontgrendel deze laag om te verwijderen' : 'Laag verwijderen';
		r.del.setAttribute('aria-label', r.del.title);
	}
	if (fi >= 0 && !list.contains(document.activeElement)) list.children[Math.min(fi, list.children.length - 1)]?.focus();
	empty.hidden = els.length > 0;
}
function flipFlag(ids, k) {
	const els = app.doc.elements.filter(e => ids.includes(e.id) && !ruleLocked(e, k));
	if (!els.length) return;
	const v = !els.every(e => e[k]);
	for (const e of els) e[k] = v;
	app.changed();
}

// ---------- lade: Data ----------
function buildData(root) {
	const p = panel(root, () => [app.doc.batch]);
	// Placeholder = de kolomkoppen die dit label verwacht (veld-keys), met de huidige waarden als voorbeeldrij.
	const csv = area('csv', { rows: 7, ph: csvHint });
	csv.classList.add('mono'); csv.setAttribute('aria-label', 'Lijst (CSV)'); csv.title = 'Plak uit Excel of Sheets (tab, ; of ,). Eerste regel = kolomnamen.';
	const fileIn = h('input', { type: 'file', accept: '.csv,.tsv,.txt,text/csv,text/plain', hidden: true });
	fileIn.addEventListener('change', () => { const f = fileIn.files[0]; fileIn.value = ''; if (f) loadCsvFile(f); });
	const info = h('span', { class: 'muted' });
	const cols = h('div', { class: 'chips' }), colsEmpty = h('p', { class: 'hint' }, 'Eerste regel = kolomnamen.');
	const colsAcc = acc('data.cols', 'Kolommen', false, cols, colsEmpty);
	// Voorbeeldrij = sessiestaat (buiten de undo, maar ook niet door Ctrl+Z teruggezet); max = aantal rijen.
	// Eigen paneel met de geklemde rij, zoals label en Invullen: een ingekorte lijst laat batch.row staan ('12 van 5').
	panel(root, () => [{ row: clamp(parseInt(app.doc.batch.row) || 1, 1, Math.max(1, A.rows().length)) }]);
	const rowIn = numIn('row', { min: 1, step: 1, int: true, onSet: v => app.session(D => { D.batch.row = clamp(v, 1, Math.max(1, A.rows().length)); }) });
	rowIn.setAttribute('aria-label', 'Voorbeeldrij');
	const ofN = h('span', { class: 'muted' }), kv = h('div', { class: 'kv' }), kvPool = [];
	// Lege lijst: de koppen van dit label in één klik (de keys staan verder nergens in beeld).
	const heads = ib('plus', 'Kolomkoppen van dit label invoegen', () => {
		const b = app.doc.batch, ks = app.doc.fields.map(f => f.key);
		if (b.csv.trim() || !ks.length) return;
		b.csv = ks.join(';') + '\n'; app.changed();
		csv.value = b.csv; csv.focus(); csv.setSelectionRange(csv.value.length, csv.value.length);
	});
	const btnAll = tb('printer', 'Print alle rijen', () => A.print(false), 'primary'), btnOne = tb('printer', 'Alleen deze rij', () => A.print(true));
	const rowNav = h('div', { class: 'rownav' }, ib('chevL', 'Vorige rij', () => stepRow(-1)), rowIn, ofN, ib('chevR', 'Volgende rij', () => stepRow(1)));
	p.ups.push(() => {
		const rows = A.rows(), keys = Object.keys(rows[0] || {}), d = app.doc;
		rowNav.hidden = !rows.length;
		heads.hidden = !!d.batch.csv.trim() || !d.fields.length;
		setText(info, rows.length ? `${rows.length} ${rows.length === 1 ? 'rij' : 'rijen'} · ${keys.length} ${keys.length === 1 ? 'kolom' : 'kolommen'}` : 'Nog geen lijst');
		rowIn.max = Math.max(1, rows.length);
		setText(ofN, `van ${rows.length}`);
		const r = A.previewRow() || {};
		keys.forEach((k, i) => {
			let e = kvPool[i];
			if (!e) { e = { k: h('span', { class: 'k' }), v: h('span', { class: 'v' }) }; kvPool.push(e); kv.append(e.k, e.v); }
			e.k.hidden = e.v.hidden = false; setText(e.k, k); setText(e.v, String(r[k] ?? ''));
		});
		for (let i = keys.length; i < kvPool.length; i++) kvPool[i].k.hidden = kvPool[i].v.hidden = true;
		const copies = clamp(Math.round(+d.print.copies) || 1, 1, 99), total = rows.length * copies;
		setText(btnAll.lastChild, rows.length ? `${rows.length === 1 ? 'Print 1 rij' : `Print alle ${rows.length} rijen`}${copies > 1 ? ` (${total} labels)` : ''}` : 'Print alle rijen');
		btnAll.disabled = btnOne.disabled = !rows.length || !!S.printLabel;
	});
	root.append(
		acc('data.list', 'Lijst', true,
			csv, fileIn,
			h('div', { class: 'row-between' }, info, h('div', { class: 'btn-pair' }, heads, ib('upload', 'CSV openen', () => fileIn.click()),
				ib('trash', 'Lijst wissen', () => { if (!app.doc.batch.csv) return; app.doc.batch.csv = ''; app.doc.batch.row = 1; app.changed(); }))),
			rowNav, kv, h('div', { class: 'btn-col' }, btnAll, btnOne)),
		colsAcc,
	);
	dataUI = { cols, colsEmpty, colsAcc, chips: [], pool: [] };
	panel(root, () => [app.doc.counter]);
	const next = h('p', { class: 'hint' });
	P.ups.push(() => { const c = app.doc.counter; setText(next, `Volgende label: ${substitute('{teller}', { counter: +c.start || 0, digits: c.digits })}`); });
	root.append(
		acc('data.counter', 'Teller', false,
			h('div', { class: 'grid3' }, fld('Start', numIn('start', { step: 1, int: true })), fld('Stap', numIn('step', { step: 1, int: true })),
				fld('Cijfers', numIn('digits', { min: 1, max: 10, step: 1, int: true }), 'Aantal cijfers, aangevuld met voorloopnullen')),
			h('div', { class: 'checks' }, check('autoAdvance', 'Na printen doorschuiven')), next),
		acc('data.tokens', 'Automatisch', false,
			h('div', { class: 'chips' }, BASE_TOKENS.map(([t, n]) => chip(t, () => insertToken(t), n)))),
	);
}
// Excel bewaart "CSV" vaak als Windows-1252 (ongeldige UTF-8) en 'Unicode-tekst' als UTF-16 met BOM (als UTF-8 gelezen
// een NUL tussen elke letter: geen kolom paste nog). fatal: alleen echt ongeldige UTF-8 valt terug; een vervangteken dat al
// in het bestand stond maakte anders alle accenten in de lijst onleesbaar. TextDecoder haalt de BOM zelf weg.
function decodeCsv(buf) {
	const b = new Uint8Array(buf), enc = b[0] === 0xFF && b[1] === 0xFE ? 'utf-16le' : b[0] === 0xFE && b[1] === 0xFF ? 'utf-16be' : 'utf-8';
	if (enc !== 'utf-8') return new TextDecoder(enc).decode(buf);
	try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { return new TextDecoder('windows-1252').decode(buf); }
}
async function loadCsvFile(f) {
	try {
		// Eerst lezen, dan pas het label pakken: een tegelijk gesleept .json vervangt het label intussen.
		const csv = decodeCsv(await f.arrayBuffer());
		app.doc.batch.csv = csv; app.doc.batch.row = 1;
		app.changed();
		openTab('data', true);
		const n = A.rows().length;
		toast(n ? `Lijst geladen: ${n} ${n === 1 ? 'rij' : 'rijen'}` : 'Lijst geladen, maar er zijn geen rijen gevonden', n ? 'ok' : 'warn');
	} catch (e) { toast('Lijst openen mislukt: ' + e.message, 'err'); }
}
// 'Veld' heet alleen een invulveld: datum/tijd/teller = Automatisch.
function fillTokSel(s, cols, fs = []) {
	const g1 = h('optgroup', { label: 'Automatisch' }, BASE_TOKENS.map(([t, n]) => new Option(n, t)));
	const g2 = fs.length ? [h('optgroup', { label: 'Invulvelden' }, fs.map(f => new Option(String(f.label || f.key), `{${f.key}}`)))] : [];
	const g3 = cols.length ? [h('optgroup', { label: 'Kolommen uit je lijst' }, cols.map(c => new Option(c, `{${c}}`)))] : [];
	s.replaceChildren(new Option('+ Invoegen', ''), g1, ...g2, ...g3);
	s.value = '';
}
// Placeholder van de lijst: de koppen die dit label verwacht + de huidige waarden; zonder invulvelden een voorbeeld.
function csvHint() {
	const fs = app.doc.fields;
	if (!fs.length) return 'naam;prijs\nAppel;1,20\nPeer;0,95';
	const d = fieldValues(fs, null).display;
	return fs.map(f => f.key).join(';') + '\n' + fs.map(f => String(d[f.key] ?? f.value ?? '')).join(';');
}
// Welke lijstkolom vult welk invulveld (veld-key -> kolom)? util.fieldCol is precies de regel van het label (key, dan label;
// de key van een ander veld telt niet als label): een rij met per kolom zijn eigen index geeft de kolom. Gecachet op kop + velden.
function fedMap(keys, fs) {
	const m = new Map();
	if (!keys.length) return m;
	const row = Object.fromEntries(keys.map((k, i) => [k, i]));
	for (const f of fs) { const i = fieldCol(row, f, fs); if (keys[i] !== undefined) m.set(f.key, keys[i]); }
	return m;
}
let fedSig = null, fedCache = new Map();
function fedCols() {
	const keys = Object.keys(A.rows()[0] || {}), fs = app.doc.fields;
	const sig = keys.join('\u0001') + '\u0002' + fs.map(f => f.key + ':' + f.type + '=' + (f.label || '')).join('\u0001');
	if (sig !== fedSig) { fedSig = sig; fedCache = fedMap(keys, fs); }
	return fedCache;
}
const fedField = k => { for (const [fk, col] of fedCols()) if (col === k) return fieldOf(fk) || null; return null; };
const escRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const tokUsed = k => { const re = new RegExp('\\{\\s*' + escRe(k.trim()) + '\\s*(\\|[^{}]*)?\\}', 'i'); return app.doc.elements.some(e => re.test(String(e.text ?? '') + '\n' + String(e.data ?? ''))); };
// Chips/opties alleen opnieuw als de CSV-kop of de veldstructuur verandert.
function refreshColumns() {
	const keys = Object.keys(A.rows()[0] || {}), fs = app.doc.fields;
	const sig = keys.join('\u0001') + '\u0002' + fs.map(f => f.key + '=' + (f.label || '')).join('\u0001');
	if (sig !== colSig) {
		colSig = sig;
		for (const s of fieldSelects) fillTokSel(s, keys, fs);
		if (dataUI) {
			// Pool zoals kvPool: typen in de kopregel hergebruikt de knoppen (k uit de entry, niet uit een closure).
			const u = dataUI;
			keys.forEach((k, i) => {
				let c = u.pool[i];
				if (!c) { c = {}; c.b = chip('', () => insertToken(`{${c.k}}`)); u.cols.append(c.b); u.pool.push(c); }
				c.k = k; c.st = null; c.b.hidden = false; setText(c.b, `{${k}}`);
			});
			for (let i = keys.length; i < u.pool.length; i++) u.pool[i].b.hidden = true;
			u.chips = u.pool.slice(0, keys.length); u.colsEmpty.hidden = keys.length > 0;
		}
	}
	// Per refresh alleen klasse/tooltip (max ~10 chips, en alleen met Data in beeld): elementteksten veranderen zonder kop.
	// Een kolom die nergens op past viel anders niet op terwijl Print er 5 labels van maakt. Ook bij 0 chips: de kop zakt dan
	// terug naar 'Kolommen' (anders bleef '2 passen niet' staan na Lijst wissen).
	if (!dataUI || !vis(dataUI.cols)) return;
	let bad = 0;
	for (const c of dataUI.chips) {
		const f = fedField(c.k), st = f ? 'f:' + (f.label || f.key) : tokUsed(c.k) ? 't' : 'x';
		if (st === 'x') bad++;
		if (st === c.st) continue;
		c.st = st;
		c.b.classList.toggle('used', !!f); c.b.classList.toggle('nofit', st === 'x');
		// Met de kolomnaam: een lange naam kapt de chip af (app.css).
		c.b.title = `{${c.k}}: ` + (f ? `vult veld ${f.label || f.key}` : st === 't' ? 'staat op het label' : 'past op geen veld (klik = invoegen)');
	}
	setText(dataUI.colsAcc.firstChild, bad ? `Kolommen · ${bad} ${bad === 1 ? 'past' : 'passen'} niet` : 'Kolommen');
}
function trackCaret(ta) { ta.addEventListener('blur', () => { caret = { ta, s: ta.selectionStart, e: ta.selectionEnd }; }); }
function insertToken(tok) {
	const s = app.selected(), el = s.length === 1 && TOKEN_KEY[s[0].type] ? s[0] : null;
	if (!el) {
		// Kolom die al een invulveld vult: niet nog eens los over het template, maar dat veld laten zien.
		const k = /^\{(.+)\}$/.exec(tok)?.[1], f = k && !BASE_TOKENS.some(b => b[0] === tok) ? fedField(k) : null;
		if (f) {
			openTab('fill', true);
			const r = fillUI?.rows.get(f.key);
			if (r) { r.el.scrollIntoView({ block: 'nearest' }); flash(r.el); }
			toast(`Kolom ${k} vult al het veld ${f.label || f.key}.`);
			return;
		}
		addEl('text', { text: tok }, true);
		return;
	}
	const k = TOKEN_KEY[el.type], cur = String(el[k] ?? ''), ta = areas[el.type];
	let a = cur.length, b = a;
	if (caret && caret.ta === ta && ta.value === cur) { a = caret.s; b = caret.e; }
	el[k] = insertAt(cur, tok, a, b);
	app.changed();
	if (ta) caret = { ta, s: a + tok.length, e: a + tok.length };
}

// ---------- Label & print, Bewerken ----------
// Maat via app.resizeLabel: schaalt mee bij Automatisch netjes, en een rand om het label groeit altijd mee.
function setLabel(patch) {
	const L = app.doc.label, nw = patch.w ?? L.w, nh = patch.h ?? L.h, shape = patch.shape && patch.shape !== L.shape ? patch.shape : null;
	if (nw === L.w && nh === L.h && !shape) return;   // niets veranderd = geen undo-stap
	// Ook alleen de vorm: rond houdt resizeLabel de inhoud binnen de cirkel.
	app.resizeLabel(nw, nh, { shape });
}

function buildLabelPage() {
	const page = h('div');
	const ble = transportFor() === 'ble';
	page.append(acc('lp.connection', 'Printer verbinden', false,
		h('p', { id: 'connectionStatus', role: 'status' }, 'Nog niet verbonden.'),
		h('button', { type: 'button', class: 'btn', id: 'panelConnect', onclick: () => A.connect() }, ble ? 'BLE verbinden' : 'Printer koppelen'),
		...(ble ? [h('button', { type: 'button', class: 'btn', onclick: () => A.connect(true) }, 'Andere printer kiezen'),
			h('p', {}, 'Je gekozen printer wordt onthouden en na herladen automatisch opnieuw verbonden als Safari dit toestaat.'),
			h('p', {}, 'iPhone met iOS 26.2+: installeer Beacio, schakel de Safari-extensie in voor deze website en herlaad de pagina.'),
			h('a', { href: 'https://beacio.com/', target: '_blank', rel: 'noopener noreferrer' }, 'Beacio installeren en instellen'),
			h('p', {}, 'Zet de printer aan en verbreek de verbinding in de merk-app. Kies Q450E bij verbinden.'),
			h('p', {}, 'Open in Safari zelf. Bluetooth via deze extensie werkt niet vanuit een beginscherm-app.'),
			h('p', {}, 'BLE voor de M110S is nog niet op jouw printer getest. Begin met één label.')]
			: [h('p', {}, 'Pc: verbind via Chrome of Edge met je gekoppelde labelprinter.')])));
	panel(page, () => [app.doc.label]);
	const sizeSel = h('select', { 'aria-label': 'Labelformaat' });
	sizeSel.add(new Option('Eigen formaat', ''));
	const groups = new Map();
	for (const s of LABEL_SIZES) {
		let g = groups.get(s.group);
		if (!g) { g = h('optgroup', { label: s.group || 'Overig' }); groups.set(s.group, g); sizeSel.append(g); }
		g.append(new Option(s.name, s.id));
	}
	sizeSel.addEventListener('change', () => { const s = LABEL_SIZES.find(x => x.id === sizeSel.value); if (s) setLabel({ w: s.w, h: s.h, shape: s.shape || 'rect' }); });
	P.ups.push(() => { const L = app.doc.label, s = LABEL_SIZES.find(x => x.w === L.w && x.h === L.h && (x.shape || 'rect') === (L.shape || 'rect')); sizeSel.value = s ? s.id : ''; });
	// Mijn rollen bovenaan: de maten die je echt hebt. Lijst alleen herbouwen als hij verandert (toevoegen/verwijderen/standaard).
	const rollsEl = h('div', { class: 'rolls', role: 'group', 'aria-label': 'Mijn rollen' });
	const rollName = h('input', { type: 'text', class: 'local', placeholder: 'Naam, bv. Wit 50×30', maxLength: 40, spellcheck: false, 'aria-label': 'Naam van de nieuwe rol' });
	// Alleen een geslaagde bewerking krijgt de bevestiging: false = opslag vol of (verwijderen) de laatste rol.
	const rollOp = (fn, arg, msg, fail = 'Mijn rollen opslaan mislukt: de browser-opslag is vol (grote afbeeldingen?).') => {
		const had = rollsEl.contains(document.activeElement), ok = rolls[fn](arg);
		refresh();
		// De lijst is opnieuw gebouwd (knop met focus weg): naar de nieuwe standaard-ster (staat vooraan), anders de eerste rol.
		if (had && !rollsEl.contains(document.activeElement)) (rollsEl.querySelector(fn === 'setDefault' ? '.roll-def' : '.roll-pick') || rollName).focus();
		if (ok === false) { toast(fail, 'err'); return false; }
		if (msg) toast(msg, 'ok');
		return true;
	};
	const rollAdd = ib('plus', 'Huidige maat toevoegen', () => {
		const L = app.doc.label, name = rollName.value.trim() || `Rol ${sizeName(L)}`;
		if (rollOp('add', { w: L.w, h: L.h, shape: L.shape || 'rect', name }, `"${name}" staat nu in Mijn rollen.`)) rollName.value = '';
	}, 'sm');
	rollName.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); rollAdd.click(); } });
	const rollsBox = acc('lp.roll', 'Mijn rollen', true, h('div', { class: 'f stack' }, rollsEl, h('div', { class: 'roll-add' }, rollName, rollAdd)));
	let rollSig = null, rollRows = [];
	P.ups.push(() => {
		const list = rolls.list(), sig = JSON.stringify(list), L = app.doc.label;
		if (sig !== rollSig) {
			rollSig = sig;
			const di = 0;   // de eerste rol is de standaard (setDefault zet hem vooraan)
			rollRows = list.map((roll, i) => {
				const name = roll.name;
				const pick = h('button', { type: 'button', class: 'roll-pick', 'aria-pressed': 'false', title: `Label op ${sizeName(roll)} mm zetten`,
					onclick: () => setLabel({ w: +roll.w, h: +roll.h, shape: roll.shape || 'rect' }) },
				ic('roll', 16), h('span', { class: 'roll-name' }, name), h('span', { class: 'roll-size' }, sizeName(roll) + ' mm'));
				const star = ib('star', i === di ? 'Standaardrol: nieuwe labels starten hierop' : 'Maak dit je standaardrol', () => { if (i !== di) rollOp('setDefault', i, `"${name}" is nu je standaardrol.`); }, 'sm roll-def');
				star.setAttribute('aria-pressed', String(i === di));
				const last = list.length < 2, del = ib('trash', last ? 'Je hebt minstens één rol nodig' : `Rol "${name}" verwijderen`,
					() => rollOp('remove', i, `"${name}" uit Mijn rollen gehaald.`), 'sm');
				del.disabled = last;
				return { roll, pick, el: h('div', { class: 'roll' }, pick, star, del) };
			});
			rollsEl.replaceChildren(...rollRows.map(r => r.el));
		}
		for (const r of rollRows) r.pick.setAttribute('aria-pressed', String(sameSize(r.roll, L)));
		rollAdd.disabled = list.some(r => sameSize(r, L));
		tip(rollAdd, rollAdd.disabled ? 'Deze maat staat al in Mijn rollen' : 'Huidige labelmaat en -vorm opslaan in Mijn rollen');
	});
	const tipped = (el, t) => { el.title = t; return el; };
	page.append(
		rollsBox,
		acc('lp.size', 'Formaat', false,
			row('Andere maat', sizeSel),
			// live:false = pas toepassen bij Enter/verlaten: meeschalen per toetsaanslag (1 → 12 → 120) zou de inhoud verminken.
			h('div', { class: 'grid2' }, tipped(pre('B', 'Breedte in mm', numIn('w', { min: 5, max: 50, step: 1, live: false, onSet: v => setLabel({ w: v }) }), 'mm'), 'Breedte (dwars over de rol, max 48 mm)'),
				pre('H', 'Hoogte in mm', numIn('h', { min: 5, max: 300, step: 1, live: false, onSet: v => setLabel({ h: v }) }), 'mm')),
			row('Vorm', seg('shape', [['rect', 'Rechthoek'], ['round', 'Rond']], { onSet: v => setLabel({ shape: v }) }))),
	);
	panel(page, () => [app.doc.layout]);
	page.append(
		acc('lp.tidy', 'Netjes', false,
			h('div', { class: 'checks' }, tipped(check('autoTidy', 'Automatisch netjes', { sw: true }), 'Bij een andere labelmaat schaalt alles mee')),
			tipped(row('Marge', slider('margin', { min: 0, max: 5, step: 0.5, unit: 'mm' })), 'Vrije rand voor Vullen, Netjes maken en nieuwe elementen')),
	);
	panel(page, () => [app.doc.print]);
	const log = h('pre', { class: 'log', id: 'log' });
	// Kopieën staat in de topbalk (altijd zichtbaar); hier niet nog eens.
	page.append(
		acc('lp.print', 'Printen', false,
			tipped(row('Zwartheid', slider('density', { min: 1, max: 15, step: 1 })), 'Te licht? Hoger.'),
			row('Snelheid', slider('speed', { min: 1, max: 5, step: 1 })),
			row('Papier', sel('media', MEDIA, { num: true })),
			tipped(row('X-verschuiving', h('div', { class: 'with-unit' }, numIn('offset', { min: 0, max: 20, step: 0.5 }), h('span', { class: 'unit' }, 'mm'))), 'Print niet in het midden? Verschuif.'),
			h('div', { class: 'checks' }, check('rotate180', '180° draaien'))),
		acc('lp.log', 'Technische details', false, log),
	);
	return page;
}

// Volgorde in beeld: kop, Basis van het type, Keuzegroep, Positie, Uitlijnen, Weergave. De algemene secties worden wél
// eerst gebouwd: de controls binden aan het panel P van dat moment, en de typeloop zet P op het type-panel.
function buildSelPage() {
	const page = h('div');
	const p = panel(page, () => app.selected());
	const tic = h('span', { class: 'type-ic' }), tname = h('span', { class: 'type-name' });
	const name = h('input', { type: 'text', class: 'name-in', spellcheck: false, maxLength: 60, 'aria-label': 'Naam van het element' });
	name.addEventListener('input', () => put(p, 'name', name.value));
	p.ups.push(() => {
		const s = app.selected(), one = s.length === 1, t = s.length && s.every(e => e.type === s[0].type) ? s[0].type : 'mixed';
		if (tic.dataset.t !== t) { tic.dataset.t = t; tic.replaceChildren(ic(TYPE_IC[t] || 'layers', 18)); }
		// Eén element: het type staat al in het icoon (tooltip) en de naam; de kop herhaalde het anders drie keer.
		setText(tname, one ? TYPE_NAMES[t] || t : `${s.length} elementen`);
		tname.hidden = one;
		const tt = one ? TYPE_NAMES[t] || t : '';
		if (tic.title !== tt) tic.title = tt;
		name.placeholder = one ? TYPE_NAMES[t] || '' : '';
		name.hidden = !one;
		if (one && !busy(name) && name.value !== (s[0].name || '')) name.value = s[0].name || '';
	});
	const ids = () => app.selection.slice();
	const al = how => () => { const i = ids(); app.align(i, how, i.length > 1 && S.alignTo === 'selection' ? 'selection' : 'label'); };
	const dH = ib('disH', 'Horizontaal verdelen (3 of meer)', () => app.distribute(ids(), 'h')), dV = ib('disV', 'Verticaal verdelen (3 of meer)', () => app.distribute(ids(), 'v'));
	const toRow = row('Uitlijnen op', seg('', [['label', 'Label'], ['selection', 'Selectie']], { get: () => S.alignTo, onSet: v => { S.alignTo = v; refresh(); } }));
	p.ups.push(() => { toRow.hidden = app.selection.length < 2; });
	// Meerdere teksten/vormen → één keuzeveld (bv. Indica / Hybride / Sativa): de gekozen optie wordt omgekeerd gemarkeerd.
	const choiceSec = acc('ed.choice', 'Keuzegroep', true,
		tb('form', 'Maak keuzegroep', () => newField(() => app.makeChoice(ids()), 'Kies minstens 2 teksten met een verschillende vaste tekst (zonder {velden}).'), 'sm',
			'Eén keuze onder Invullen van deze teksten/vormen; de gekozen optie wordt wit op zwart'));
	p.ups.push(() => { const s = app.selected(); choiceSec.hidden = s.length < 2 || !s.every(e => e.type === 'text' || e.type === 'shape'); });
	const vsep = () => h('span', { class: 'vsep', 'aria-hidden': 'true' });
	const del = ib('trash', 'Verwijderen (Delete)', () => app.remove(ids()), 'danger');
	const head = h('div', { class: 'insp-head' }, tic, h('div', { class: 'head-txt' }, tname, name), del);
	const posSec = acc('ed.pos', 'Positie', false,
		h('div', { class: 'grid2' },
			pre('X', 'X-positie in mm', numIn('x', { step: 0.5 }), 'mm'), pre('Y', 'Y-positie in mm', numIn('y', { step: 0.5 }), 'mm'),
			pre('B', 'Breedte in mm', numIn('w', { min: 0.5, step: 0.5, onSet: v => setSize(p, 'w', v) }), 'mm'), pre('H', 'Hoogte in mm', numIn('h', { min: 0.5, step: 0.5, onSet: v => setSize(p, 'h', v) }), 'mm'),
			pre('↻', 'Rotatie in graden', numIn('rot', { min: -360, max: 360, step: 1 }), '°'),
			h('div', { class: 'btn-pair' }, ib('rotL', '90° linksom draaien', () => rotBy(-90)), ib('rotR', '90° rechtsom draaien', () => rotBy(90)))),
		h('div', { class: 'checks' }, check('locked', 'Vergrendeld'), check('hidden', 'Verborgen', { rule: true })));
	const alignSec = acc('ed.align', 'Uitlijnen', false,
		h('div', { class: 'toolrow' },
			ib('cenH', 'Horizontaal centreren op het label', () => app.center(ids(), 'h')),
			ib('cenV', 'Verticaal centreren op het label', () => app.center(ids(), 'v')),
			ib('cenB', 'Centreren op het label (beide richtingen)', () => app.center(ids(), 'both')),
			ib('expand', 'Vullen binnen de marge (Label & print)', () => app.fill(ids()))),
		h('div', { class: 'toolrow' }, ib('alL', 'Links uitlijnen', al('left')), ib('alC', 'Midden uitlijnen (horizontaal)', al('hcenter')), ib('alR', 'Rechts uitlijnen', al('right')), vsep(),
			ib('alT', 'Boven uitlijnen', al('top')), ib('alM', 'Midden uitlijnen (verticaal)', al('vcenter')), ib('alB', 'Onder uitlijnen', al('bottom'))),
		h('div', { class: 'toolrow' }, dH, dV),
		toRow);
	// Alles vergrendeld: verwijderen en uitlijnen slaan dat over (doc.js), dus uit met de reden i.p.v. stil niets doen.
	const lockBtns = [del, ...alignSec.querySelectorAll('.toolrow button')];
	p.ups.push(() => {
		const n = app.selection.length, lk = app.selected().every(e => e.locked);
		for (const b of lockBtns) {
			b.disabled = lk || ((b === dH || b === dV) && n < 3);
			const t = lk ? 'Vergrendeld' : b.getAttribute('aria-label');
			if (b.title !== t) b.title = t;
		}
	});
	// Volgorde en dupliceren zijn geen uitlijnen: eigen ingeklapte sectie.
	const orderSec = acc('ed.order', 'Volgorde', false,
		h('div', { class: 'toolrow' }, ib('toFront', 'Helemaal naar voren', () => app.bringToFront(ids())), ib('fwd', 'Naar voren', () => app.forward(ids())),
			ib('bwd', 'Naar achteren', () => app.backward(ids())), ib('toBack', 'Helemaal naar achteren', () => app.sendToBack(ids())), vsep(), ib('dup', 'Dupliceren (Ctrl+D)', () => app.duplicate(ids()))));
	const viewSec = acc('ed.view', 'Weergave', false,
		row('Dekking', slider('opacity', { min: 0, max: 100, step: 5, mul: 100, unit: '%' })),
		h('div', { class: 'checks' }, check('invert', 'Inverteren (wit op zwart)', { rule: true })));
	page.append(head);
	const B = { text: buildText, barcode: buildBarcode, qr: buildQr, image: buildImage, shape: buildShape, icon: buildIcon, emoji: buildEmoji, border: buildBorder };
	for (const [t, fn] of Object.entries(B)) {
		const r = h('div', { hidden: true });
		panel(r, typeScope(t)); fn(P, r);
		typeRoots[t] = r; typeSecs[t] = r.querySelector('details.sec');   // eerste sectie = Basis van dat type
		page.append(r);
	}
	page.append(choiceSec, posSec, alignSec, orderSec, viewSec);
	return page;
}
function rotBy(d) { for (const e of app.selected()) e.rot = normDeg((+e.rot || 0) + d); app.changed(); }

function buildText(p, root) {
	const ta = area('text', { rows: 3, ph: 'Typ je tekst…' });
	areas.text = ta; trackCaret(ta);
	const tokSel = h('select', { class: 'tok-sel', 'aria-label': 'Veld invoegen' });
	tokSel.addEventListener('change', () => { const v = tokSel.value; tokSel.value = ''; if (v) insertToken(v); });
	fieldSelects.push(tokSel); fillTokSel(tokSel, []);
	const fontBtn = h('button', { type: 'button', class: 'btn font-btn', 'aria-haspopup': 'dialog', title: 'Lettertype kiezen' }, h('span', { class: 'fb-name' }), ic('chevD', 16));
	// Tweede klik op de knop sluit (zoals de galerijen), nu de pop de knop niet meer bedekt.
	fontBtn.addEventListener('click', () => fontPop && !fontPop.el.hidden && fontPop.anchor === fontBtn ? (fontPop.el.hidden = true) : openFontPicker(fontBtn, vals(p, 'font')[0], f => {
		const t = p.scope()[0];
		put(p, 'font', f, false);
		ensureFont(f, { bold: !!t?.bold, italic: !!t?.italic });
	}));
	p.ups.push(() => { const f = String(vals(p, 'font')[0] || ''), n = fontBtn.firstChild; if (n.textContent !== f) { n.textContent = f; n.style.fontFamily = `"${f}", sans-serif`; } });
	// Tekst → invulveld: daarna vul je hem in via Invullen (en een CSV-kolom met dezelfde naam batch-print erover).
	// Is de tekst al een invulveld, dan heft dezelfde knop het op (de enige toetsenbord-route; de prullenbak in Invullen is
	// geen tab-stop).
	const mkf = tb('form', 'Maak invulveld', () => {
		const e = p.scope()[0], fk = fieldKey(e);
		if (!e) return;
		if (!fk) return newField(() => app.makeField(e.id));
		app.removeField(fk, A.previewRow());
		toast('Invulveld opgeheven; de tekst staat weer vast op het label. Ctrl+Z zet het terug.');
	}, 'sm', 'Maak van deze tekst een invulveld onder Invullen');
	// makeField weigert tekst met {velden} (nesten kan niet): dan uitgeschakeld met de reden in de knop.
	p.ups.push(() => {
		const s = p.scope(), t = String(s[0]?.text ?? ''), fk = fieldKey(s[0]), tok = TOKEN.test(t);
		mkf.hidden = s.length !== 1;
		mkf.disabled = !fk && (tok || !t.trim());
		setText(mkf.lastChild, fk ? 'Invulveld opheffen' : tok ? 'Bevat al een veld' : 'Maak invulveld');
		const tt = fk ? 'Weer vaste tekst op het label (huidige waarde)' : 'Maak van deze tekst een invulveld onder Invullen';
		if (mkf.title !== tt) mkf.title = tt;
	});
	// Passen = Krimpen/Groeien: de grootte is automatisch. Dan 'Auto' + de getekende maat op de schuif; zelf een maat kiezen
	// zet Passen zo dat je hem ziet (anders deed het veld niets).
	// Krimpen die gewoon past tekent op size: dan gewoon het getal, 'Auto' alleen als de getekende maat afwijkt.
	const sizeAuto = () => { const ts = p.scope(); if (!ts.length || !ts.every(e => e.fit === 'shrink' || e.fit === 'fill')) return 0; const a = autoSize(ts[0]); return Math.abs(a - +ts[0].size) > 0.05 ? a : 0; };
	const setSizeV = v => {
		const ts = p.scope();
		if (!ts.length) return;
		let ch = false;
		for (const e of ts) {
			if (e.size !== v) { e.size = v; ch = true; }
			if (e.fit === 'shrink' || e.fit === 'fill') { const f = autoSize({ ...e, fit: 'shrink' }) < v - 0.05 ? 'none' : 'shrink'; if (e.fit !== f) { e.fit = f; ch = true; } }
		}
		if (ch) app.changed({ coalesce: 'ui:size:' + ts.map(e => e.id).join(',') });
	};
	root.append(
		acc('ed.text', 'Tekst', true,
			h('div', { class: 'f stack' }, ta, h('div', { class: 'ta-tools' }, tokSel, ib('fitText', 'Box passend om de tekst', fitTextBox, 'sm')), mkf),
			row('Lettertype', fontBtn),
			row('Grootte', slider('size', { min: 1, max: 30, step: 0.1, inMin: 0.5, inMax: 150, unit: 'mm', auto: sizeAuto, onSet: setSizeV })),
			row('Stijl', h('div', { class: 'seg' }, tog('bold', 'B', 'Vet', 'tog-b'), tog('italic', 'I', 'Cursief', 'tog-i'), tog('underline', 'U', 'Onderstrepen', 'tog-u'), tog('strike', 'S', 'Doorhalen', 'tog-s'))),
			row('Uitlijning', seg('align', [['left', 'Links', 'txL'], ['center', 'Midden', 'txC'], ['right', 'Rechts', 'txR'], ['justify', 'Uitvullen', 'txJ']])),
			row('Verticaal', seg('valign', [['top', 'Boven', 'vaT'], ['middle', 'Midden', 'vaM'], ['bottom', 'Onder', 'vaB']]))),
		acc('ed.text.more', 'Opmaak', false,
			row('Passen', seg('fit', [['none', 'Vrij', null, 'Vaste grootte'], ['shrink', 'Krimpen', null, 'Kleiner maken tot het past'], ['fill', 'Groeien', null, 'Zo groot mogelijk in de box']])),
			row('Regelafstand', slider('lineHeight', { min: 0.7, max: 3, step: 0.05 })),
			row('Letterafstand', slider('letterSpacing', { min: -1, max: 5, step: 0.05, unit: 'mm' })),
			row('Contour', slider('outline', { min: 0, max: 1.5, step: 0.05, unit: 'mm' })),
			h('div', { class: 'checks' }, check('wrap', 'Automatisch afbreken'), check('vertical', 'Verticaal gestapeld'))),
	);
}
// Grootte (mm) zoals render hem tekent bij Passen = Krimpen/Groeien, met de voorbeeldrij (een CSV-waarde is langer of
// korter dan de ingevulde).
export function autoSize(e) {
	if (e?.type !== 'text' || (e.fit !== 'shrink' && e.fit !== 'fill')) return +e?.size || 0;
	return fitSize(e, app.doc.fields, A.previewRow(), app.doc.counter);
}
// Nieuwe x/y bij maat nw×nh: het uitlijnpunt (align/valign, zoals render) blijft op zijn plek, meegedraaid met rot.
// Uitvullen telt als links (render zet de laatste regel links). Anders sprong gecentreerde tekst na 'Box passend' weg.
const keepAnchor = (e, nw, nh) => {
	const ax = HALIGN[e.align] ?? 0, ay = VALIGN[e.valign] ?? 0, r = (+e.rot || 0) * Math.PI / 180;
	const dx = (ax - .5) * (e.w - nw), dy = (ay - .5) * (e.h - nh);
	return [round(+e.x + (e.w - nw) / 2 + dx * Math.cos(r) - dy * Math.sin(r), 0.001), round(+e.y + (e.h - nh) / 2 + dx * Math.sin(r) + dy * Math.cos(r), 0.001)];
};
// Nieuwe box [x, y, w, h] om tekstmaat m (mm), of null als er niets verandert (dan ook geen undo-stap: anders deed de
// eerste Ctrl+Z daarna zichtbaar niets).
const textFit = (e, m) => {
	if (!(m?.h > 0)) return null;
	let nh = round(m.h + 0.2, 0.1), nw = !e.wrap && m.w > 0 ? round(m.w + 0.4, 0.1) : e.w;
	// Groeien/Krimpen volgen het vak: groter maken laat de tekst meegroeien (elke klik groter), dus alleen krimpen.
	if (e.fit === 'fill' || e.fit === 'shrink') { nh = Math.min(nh, e.h); nw = Math.min(nw, e.w); }
	return nh !== e.h || nw !== e.w ? [...keepAnchor(e, nw, nh), nw, nh] : null;
};
function fitTextBox() {
	let ch = false;
	for (const e of app.selected().filter(x => x.type === 'text')) {
		// Met de voorbeeldrij en op de getekende maat (bij Krimpen/Groeien is size niet wat je ziet; measureText rekent die uit).
		try {
			const b = textFit(e, measureText(e, app.doc.fields, A.previewRow(), app.doc.counter));
			if (b) { [e.x, e.y, e.w, e.h] = b; ch = true; }
		} catch (err) { console.warn(err); }
	}
	if (ch) app.changed();
}

function buildBarcode(p, root) {
	const ta = area('data', { rows: 2, ph: 'Inhoud van de barcode' });
	areas.barcode = ta; trackCaret(ta);
	const setSym = v => {
		let ch = false;
		for (const e of p.scope()) {
			const re = BC_RE[v], data = EXAMPLES.has(e.data) && (!re || !re.test(e.data)) && BC_EX[v] ? BC_EX[v] : e.data;
			if (e.symbology !== v || e.data !== data) { e.symbology = v; e.data = data; ch = true; }
		}
		if (ch) app.changed();
	};
	root.append(acc('ed.barcode', 'Barcode', true,
		h('div', { class: 'f stack' }, ta),
		row('Type', symPick(p, BARCODES, BC_HINT, setSym, ta)),
		h('div', { class: 'checks' }, check('showText', 'Tekst onder de streepjes')),
		row('Tekstgrootte', slider('textSize', { min: 1.5, max: 6, step: 0.1, unit: 'mm' }), t => t.showText)));
}
// Symbologie als galerij: naam + een korte regel wat erin past (was een wisselende hint onder het veld).
function symPick(p, list, hints, onSet, ta) {
	const opts = list.map(([id, n]) => {
		const b = h('button', { type: 'button', class: 'font-opt', 'aria-pressed': 'false', onclick: () => onSet(id) }, h('span', { class: 'fo-name' }, n), hints[id] && h('span', { class: 'fo-sample' }, hints[id]));
		b.dataset.v = id; return b;
	});
	const g = gallery('Type kiezen', opts);
	p.ups.push(() => {
		const v = vals(p, 'symbology')[0];
		setText(g.name, list.find(x => x[0] === v)?.[1] || '');
		for (const b of opts) b.setAttribute('aria-pressed', String(b.dataset.v === v));
		ta.title = hints[v] || '';
	});
	return g.btn;
}

function buildQr(p, root) {
	const ta = area('data', { rows: 3, ph: 'Link, tekst of gegevens' });
	areas.qr = ta; trackCaret(ta);
	const quick = h('select', { 'aria-label': 'Snel invullen' }, new Option('Kies een soort…', ''), QR_QUICK.map(([v, t]) => new Option(t, v)));
	quick.addEventListener('change', () => { const v = quick.value; quick.value = ''; if (v) put(p, 'data', v, false); });
	const adv = acc('ed.qr.more', 'Geavanceerd', false,
		row('Foutcorrectie', seg('ecc', ECC)));
	adv.title = 'Hogere foutcorrectie: beter leesbaar bij schade, fijnere blokjes';
	p.ups.push(() => { adv.hidden = p.scope()[0]?.symbology !== 'qrcode'; });
	root.append(acc('ed.qr', '2D-code', true,
		h('div', { class: 'f stack' }, ta),
		row('Snel invullen', quick),
		row('Type', symPick(p, CODES2D, QR_HINT, v => put(p, 'symbology', v, false), ta))),
		adv);
}

// Alles wat de pixels van een afbeelding bepaalt (voor de varianten: opnieuw tekenen alleen als dit verandert).
const imgKey = e => e ? [e.id, e.src?.length || 0, String(e.src || '').slice(-48), e.w, e.h, e.fit, e.flipH, e.flipV, e.invert, ...IMAGE_KEYS.map(k => e[k])].join('|') : '';
// Variant = DEZE foto met de preset erover, zoals een klik hem zou maken (zelfde box, dus zelfde dots als op de print).
function variantDoc(e, params) {
	if (!e?.src) return null;
	return normalizeTemplateDoc({ label: { w: e.w, h: e.h, shape: 'rect' }, elements: [{ ...e, ...params, x: 0, y: 0, rot: 0, hidden: false, locked: false, opacity: 1 }] });
}
function buildImage(p, root) {
	const first = () => p.scope()[0];
	const fixRatio = () => {
		for (const e of p.scope()) {
			if (!e.src) continue;
			const im = new Image(), id = e.id;
			im.onload = () => {
				const el = app.doc.elements.find(x => x.id === id), nh = el && im.naturalWidth ? round(el.w * im.naturalHeight / im.naturalWidth, 0.1) : null;
				if (nh != null && nh !== el.h) { el.h = nh; app.changed(); }
			};
			im.src = e.src;
		}
	};
	// Lege foto-plek: één duidelijke knop i.p.v. alleen het vervang-icoon (en geen varianten van niets).
	const empty = h('div', { class: 'banner' }, ic('image', 16), h('span', {}, 'Lege foto-plek'), tb(null, 'Kies foto', () => pickImage(first()?.id), 'sm primary'));
	const tools = h('div', { class: 'btn-pair btn-row' }, ib('upload', 'Afbeelding vervangen', () => pickImage(first()?.id)), ib('ratio', 'Verhouding herstellen', fixRatio));
	// Varianten: 6 thumbnails van deze foto (imaging.IMAGE_PRESETS); klik = toepassen, 1 undo-stap, al zo = geen undo-stap.
	const presets = imaging.IMAGE_PRESETS, vThumbs = [];
	const apply = params => {
		const ts = p.scope().filter(e => Object.entries(params).some(([k, v]) => e[k] !== v));
		if (!ts.length) return;
		for (const e of ts) Object.assign(e, params);
		app.changed();
	};
	const vBtns = presets.map(pr => {
		const { btn, t } = thumbButton({ px: 128, doc: () => variantDoc(first(), pr.params), title: `Variant ${pr.name} toepassen`, onclick: () => apply(pr.params) });
		btn.append(h('span', { class: 'bd-name' }, pr.name.split(' (')[0]));   // volledige naam in de tooltip
		vThumbs.push(t);
		return { btn, pr };
	});
	// Tijdens slepen aan een slider niet 6x per tik herberekenen: pas na een korte rust.
	let vBase = '';
	const redrawVariants = debounce(() => { for (const t of vThumbs) { t.drawn = null; if (t.vis) queueThumb(t); } }, 250);
	p.ups.push(() => {
		const e = first(), k = imgKey(e);
		if (k !== vBase) { vBase = k; redrawVariants(); }
		for (const { btn, pr } of vBtns) btn.setAttribute('aria-pressed', String(!!e && Object.entries(pr.params).every(([kk, v]) => e[kk] === v)));
	});
	const varGrid = h('div', { class: 'variant-grid' }, vBtns.map(v => v.btn));
	p.ups.push(() => { const has = !!first()?.src; empty.hidden = has; tools.hidden = !has; varGrid.hidden = !has; });
	// Reset = variant Auto = de defaults van het model (doc.js spreidt die params; selftest bewaakt dat).
	const resetAuto = () => apply(presets[0].params);
	root.append(
		acc('ed.image', 'Afbeelding', true, empty, tools, varGrid,
			row('Passen', seg('fit', [['contain', 'Passend', null, 'Hele afbeelding zichtbaar'], ['cover', 'Bijsnijden', null, 'Box vullen, randen vallen weg'], ['stretch', 'Rekken', null, 'Uitrekken tot de box']])),
			row('Spiegelen', h('div', { class: 'seg' }, tog('flipH', ic('flipH', 16), 'Horizontaal spiegelen'), tog('flipV', ic('flipV', 16), 'Verticaal spiegelen')))),
		acc('ed.image.adjust', 'Aanpassen', false,
			row('Helderheid', slider('brightness', { min: -100, max: 100, step: 1 })),
			row('Contrast', slider('contrast', { min: -100, max: 100, step: 1 })),
			row('Gamma', slider('gamma', { min: 0.2, max: 3, step: 0.05 })),
			// Lokaal contrast/dot-gain bestaan alleen in de nieuwe pijplijn (Automatisch, Blauwe ruis); dot-gain niet in de harde
			// drempel (Automatisch met bleed 0 = Logo/tekening). Bij de andere methodes deden ze niets. Herkend logo: lokaal contrast
			// staat uit, in Automatisch ook dot-gain (harde drempel).
			row('Lokaal contrast', slider('localContrast', { min: 0, max: 100, step: 1 }), t => imaging.PRO.has(t.mode) && !imageLogo(t)),
			row('Scherpte', slider('sharpen', { min: 0, max: 100, step: 1 })),
			row('Dot-gain', slider('dotGain', { min: 0, max: 100, step: 1, unit: '%' }), t => t.mode === 'bluenoise' || (t.mode === 'auto' && +t.bleed > 0 && !imageLogo(t))),
			row('Achtergrond weg', slider('bgCut', { min: 0, max: 100, step: 1 })),
			row('Drempel', slider('threshold', { min: 0, max: 255, step: 1 })),
			tb('rotL', 'Reset naar auto', resetAuto, 'sm ghost', 'Alle beeldinstellingen terug naar automatisch')),
		acc('ed.image.bw', 'Zwart-wit', false,
			row('Methode', sel('mode', DITHER_MODES.map(m => [m.id, m.name]))),
			h('div', { class: 'checks' }, check('invertImg', 'Negatief (licht en donker omkeren)'))),
	);
}

function buildShape(p, root) {
	const btns = SHAPES.map(s => { const { btn } = thumbButton({ px: 64, doc: () => shapeDoc(s.id), title: s.name, onclick: () => put(p, 'shape', s.id, false) }); btn.dataset.v = s.id; return btn; });
	const g = gallery('Vorm kiezen', h('div', { class: 'shape-grid sm' }, btns));
	p.ups.push(() => { const v = vals(p, 'shape')[0]; setText(g.name, SHAPES.find(s => s.id === v)?.name || ''); for (const b of btns) b.setAttribute('aria-pressed', String(b.dataset.v === v)); });
	root.append(acc('ed.shape', 'Vorm', true,
		row('Vorm', g.btn),
		row('Rand', slider('stroke', { min: 0, max: 3, step: 0.1, unit: 'mm' })),
		row('Vulling', seg('fill', [['none', 'Geen'], ['black', 'Zwart'], ['gray', 'Grijs']])),
		row('Lijn', seg('dash', [['solid', 'Vol', null, 'Doorgetrokken'], ['dashed', 'Streep', null, 'Streepjes'], ['dotted', 'Punt', null, 'Puntjes']])),
		row('Hoekradius', slider('radius', { min: 0, max: 10, step: 0.1, unit: 'mm' }), t => t.shape === 'rect')));
}

function buildIcon(p, root) {
	const img = h('img', { class: 'icon-prev', alt: '', width: 40, height: 40 }), nm = h('div', { class: 'icon-name' });
	// Licentie van de Iconify-collectie (uit de gecachte collectielijst); offline of onbekend = geen regel.
	const lic = h('p', { class: 'hint lic', hidden: true });
	let licFor = null;
	p.ups.push(() => {
		const e = p.scope()[0];
		if (!e) return;
		const web = e.source === 'iconify', key = web ? `i|${e.icon}|${e.svg?.length || 0}` : `${e.icon}|${e.set}|${e.stroke}|${e.nodes?.length || 0}`;
		if (img.dataset.k !== key) { img.dataset.k = key; img.src = web ? (e.svg ? svgUrl(e.svg) : '') : e.nodes?.length ? svgUrl(iconToSvg(e.nodes, { set: e.set, stroke: e.stroke })) : ''; }
		setText(nm, iconName(e)); if (nm.title !== (e.icon || '')) nm.title = e.icon || '';
		const pre = web ? iconifyParts(e.icon)[0] : '';
		if (pre !== licFor) {
			licFor = pre; lic.hidden = true;
			if (pre) ibMod().then(m => m.licenseOf(pre)).then(l => {
				if (licFor !== pre || !l?.license?.title) return;
				setText(lic, licText(l)); lic.classList.toggle('nc', licNC(l.license)); lic.hidden = false;
			}).catch(() => {});
		}
	});
	root.append(acc('ed.icon', 'Icoon', true,
		h('div', { class: 'icon-card' }, h('div', { class: 'icon-tile' }, img), h('div', { class: 'icon-meta' }, nm,
			tb('swap', 'Ander icoon…', () => { const e = p.scope()[0]; setReplace(e?.id || null); openIcons(e?.source !== 'iconify' ? 'tabler' : weedIdx && !weedIdx.has(e.icon) ? 'online' : 'weed'); }, 'sm'))),
		lic,
		row('Stijl', seg('set', [['outline', 'Lijn'], ['filled', 'Gevuld']], { onSet: v => switchIconSet(p, v) }), t => t.source !== 'iconify'),
		row('Lijndikte', slider('stroke', { min: 0.5, max: 4, step: 0.1 }), t => t.set !== 'filled' && t.source !== 'iconify')));
}

function buildEmoji(p, root) {
	const prev = h('div', { class: 'emoji-prev', 'aria-hidden': 'true' });
	const color = t => t.style === 'color';
	p.ups.push(() => {
		const e = p.scope()[0];
		if (!e) return;
		setText(prev, emojiFace(e.char || '', !color(e)));
		prev.classList.toggle('em-mono', !color(e));
		prev.style.fontWeight = color(e) ? '' : String(e.weight || 500);
	});
	// Rasteren (methode, drempel ...) geldt alleen voor kleur-emoji: eigen ingeklapte sectie, weg bij Mono.
	const bw = acc('ed.emoji.bw', 'Zwart-wit', false,
		row('Methode', sel('mode', DITHER_MODES.map(m => [m.id, m.name]))),
		row('Drempel', slider('threshold', { min: 0, max: 255, step: 1 })),
		row('Helderheid', slider('brightness', { min: -100, max: 100, step: 1 })),
		row('Contrast', slider('contrast', { min: -100, max: 100, step: 1 })));
	p.ups.push(() => { const e = p.scope()[0]; bw.hidden = !e || !color(e); });
	root.append(acc('ed.emoji', 'Emoji', true,
		h('div', { class: 'icon-card' }, h('div', { class: 'icon-tile' }, prev), h('div', { class: 'icon-meta' },
			tb('swap', 'Andere emoji…', () => { setReplace(p.scope()[0]?.id || null); openIcons('emoji'); }, 'sm'))),
		row('Stijl', seg('style', [['mono', 'Mono', null, 'Strak zwart (Noto Emoji)'], ['color', 'Kleur', null, 'Kleuren-emoji, gerasterd naar zwart-wit']])),
		row('Gewicht', slider('weight', { min: 300, max: 700, step: 50 }), t => !color(t))),
		bw);
}

function buildBorder(p, root) {
	const btns = BORDER_STYLES.map(s => { const { btn } = thumbButton({ px: 96, doc: () => borderDoc(s.id), sig: labelSig, title: s.name, onclick: () => put(p, 'style', s.id, false) }); btn.dataset.v = s.id; return btn; });
	const g = gallery('Rand kiezen', h('div', { class: 'border-grid sm' }, btns));
	p.ups.push(() => { const v = vals(p, 'style')[0]; setText(g.name, BORDER_STYLES.find(s => s.id === v)?.name || ''); for (const b of btns) b.setAttribute('aria-pressed', String(b.dataset.v === v)); });
	root.append(acc('ed.border', 'Rand', true,
		row('Stijl', g.btn),
		row('Dikte', slider('stroke', { min: 0.2, max: 3, step: 0.1, unit: 'mm' })),
		// Zelfde operatie als Vullen: kader op het printbare vlak (48 mm-kop, X-verschuiving, 180°), 1 undo-stap.
		ib('expand', 'Passend op label (1 mm binnen het printbare deel)', () => app.fill(p.scope().map(e => e.id)), 'sm')));
}

// ---------- popovers: font-kiezer en galerijen ----------
// Onder of boven het anker (waar hij past, anders waar de meeste ruimte is) met een scrollende lijst: nooit over het anker
// of de topbalk. Horizontaal binnen het paneel.
function placePop(el, anchor) {
	el.hidden = false; el.style.maxHeight = '';
	const r = anchor.getBoundingClientRect(), top = $('topbar').getBoundingClientRect().bottom, d = $('drawer').getBoundingClientRect(), w = el.offsetWidth;
	const below = innerHeight - r.bottom - 12, above = r.top - top - 12, down = el.offsetHeight <= below || below >= above;
	el.style.maxHeight = Math.max(120, down ? below : above) + 'px';
	const hh = el.offsetHeight;
	el.style.top = (down ? r.bottom + 4 : r.top - 4 - hh) + 'px';
	const lo = d.width ? Math.max(8, d.left) : 8, hi = Math.max(lo, (d.width ? Math.min(innerWidth - 8, d.right) : innerWidth - 8) - w);
	el.style.left = clamp(clamp(r.right - w, lo, hi), 8, Math.max(8, innerWidth - w - 8)) + 'px';
}
// Galerij i.p.v. select (vorm, rand, symbologie): trigger met de huidige naam, pop 1× gebouwd en daarna alleen hidden.
function gallery(label, body) {
	const el = h('div', { class: 'pop gal-pop', role: 'dialog', 'aria-label': label, hidden: true }, h('div', { class: 'pop-list' }, body));
	const btn = h('button', { type: 'button', class: 'btn font-btn gal-btn', 'aria-haspopup': 'dialog', title: label }, h('span', { class: 'fb-name' }), ic('chevD', 16));
	const close = (focus = true) => { if (el.hidden) return; el.hidden = true; if (focus) btn.focus(); };
	btn.addEventListener('click', () => {
		if (!el.hidden) return close();
		placePop(el, btn);
		(el.querySelector('[aria-pressed=true]') || el.querySelector('button'))?.focus();
	});
	el.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
	el.addEventListener('click', e => { if (e.target.closest('button')) close(); });
	document.addEventListener('pointerdown', e => { if (!el.hidden && !el.contains(e.target) && !btn.contains(e.target)) close(false); }, true);
	addEventListener('resize', () => close(false));
	document.body.append(el);
	return { btn, name: btn.firstChild };
}
function openFontPicker(anchor, current, onPick) {
	const fp = fontPop ||= buildFontPop();
	fp.onPick = onPick; fp.anchor = anchor;
	for (const b of fp.opts) b.setAttribute('aria-selected', String(b.dataset.family === current));
	fp.q.value = ''; fp.setCat('all');
	placePop(fp.el, anchor);
	fp.opts.find(b => b.dataset.family === current)?.scrollIntoView({ block: 'center' });
	fp.q.focus();
}
function buildFontPop() {
	const el = h('div', { class: 'pop', role: 'dialog', 'aria-label': 'Lettertype kiezen', hidden: true });
	const q = h('input', { type: 'search', placeholder: 'Zoek een lettertype…', 'aria-label': 'Lettertype zoeken' });
	let cat = 'all';
	// Emoji-font hoort bij het emoji-element, niet in de gewone lettertype-keuze.
	const cats = Object.entries(FONT_CATEGORIES).filter(([id]) => id !== 'emoji');
	const chipBtns = [['all', 'Alle'], ...cats].map(([id, n]) => { const b = chip(n, () => setCat(id)); b.dataset.id = id; return b; });
	const list = h('div', { class: 'pop-list', role: 'listbox', 'aria-label': 'Lettertypen' });
	// Google-fonts pas laden als de regel in beeld komt: geen 40 stylesheets tegelijk.
	// Blijft observeren: weer in beeld = opnieuw vragen (na een mislukte poging, offline, komt er zo een nieuwe; anders kost het niets).
	const lazy = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) ensureFont(e.target.dataset.family); }, { root: list, rootMargin: '120px' });
	const groups = [], opts = [];
	for (const [id, n] of cats) {
		const head = h('div', { class: 'pop-head' }, n), items = [];
		list.append(head);
		for (const f of FONTS.filter(x => x.category === id)) {
			const ff = `"${f.family}", ${FALLBACK[id] || 'sans-serif'}`;
			const nm = h('span', { class: 'fo-name' }, f.family), sm = h('span', { class: 'fo-sample' }, 'Aa 123');
			nm.style.fontFamily = sm.style.fontFamily = ff;
			const b = h('button', { type: 'button', class: 'font-opt', role: 'option', 'aria-selected': 'false', title: f.family + (f.google ? '' : ' (systeemfont)') }, nm, sm);
			b.dataset.family = f.family;
			b.addEventListener('click', () => pick(f.family));
			list.append(b); items.push(b); opts.push(b); lazy.observe(b);
		}
		groups.push({ id, head, items });
	}
	const none = h('p', { class: 'empty', hidden: true }, 'Geen lettertype gevonden.');
	list.append(none);
	function filter() {
		const s = q.value.trim().toLowerCase();
		let any = false;
		for (const b of chipBtns) b.setAttribute('aria-pressed', String(b.dataset.id === cat));
		for (const g of groups) {
			let n = 0;
			for (const b of g.items) { const show = (cat === 'all' || cat === g.id) && (!s || b.dataset.family.toLowerCase().includes(s)); b.hidden = !show; if (show) n++; }
			g.head.hidden = !n; any ||= n > 0;
		}
		none.hidden = any;
	}
	function setCat(id) { cat = id; filter(); }
	function close(focus = true) { el.hidden = true; if (focus) fp.anchor?.focus(); }
	function pick(f) { close(); fp.onPick?.(f); }
	q.addEventListener('input', filter);
	q.addEventListener('keydown', e => {
		if (e.key === 'Enter') { const b = opts.find(x => !x.hidden); if (b) { e.preventDefault(); pick(b.dataset.family); } }
		else if (e.key === 'ArrowDown') { e.preventDefault(); opts.find(x => !x.hidden)?.focus(); }
	});
	list.addEventListener('keydown', e => {
		if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
		e.preventDefault();
		const v = opts.filter(x => !x.hidden), i = v.indexOf(document.activeElement);
		(v[i + (e.key === 'ArrowDown' ? 1 : -1)] || (e.key === 'ArrowUp' ? q : null))?.focus();
	});
	el.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
	document.addEventListener('pointerdown', e => { if (!el.hidden && !el.contains(e.target) && !fp.anchor?.contains(e.target)) close(false); }, true);
	addEventListener('resize', () => close(false));
	el.append(h('div', { class: 'pop-top' }, h('div', { class: 'searchbox' }, ic('search', 16), q), h('div', { class: 'chips' }, chipBtns)), list);
	document.body.append(el);
	const fp = { el, q, opts, setCat, onPick: null, anchor: null };
	return fp;
}

// ---------- contextmenu ----------
function buildMenu() {
	const m = $('ctxMenu');
	const item = (icn, label, kbd, fn, cls = '') => {
		const b = h('button', { type: 'button', class: 'mi ' + cls, role: 'menuitem' }, ic(icn, 16), h('span', { class: 'mi-l' }, label), kbd ? h('kbd', {}, kbd) : null);
		// Focus terug pas na de frame-update: verbergt de actie de mini-werkbalk (Verwijderen), dan naar het canvas.
		b.addEventListener('click', () => { const ids = menu.ids; closeMenu(); fn(ids); requestAnimationFrame(menuReturn); });
		m.append(b);
		return b;
	};
	const sep = () => m.appendChild(h('div', { class: 'msep', role: 'separator' }));
	menu = { ids: [] };
	menu.dup = item('dup', 'Dupliceren', 'Ctrl+D', ids => app.duplicate(ids));
	// Ook naar het OS-klembord (zoals Ctrl+C): anders plakte Ctrl+V daarna een eerder geplakte afbeelding.
	menu.copy = item('copy', 'Kopiëren', 'Ctrl+C', ids => { navigator.clipboard?.writeText(app.copy(ids)).catch(() => {}); });
	menu.paste = item('paste', 'Plakken', 'Ctrl+V', () => app.paste());
	menu.s1 = sep();
	menu.front = item('toFront', 'Helemaal naar voren', '', ids => app.bringToFront(ids));
	menu.fwd = item('fwd', 'Naar voren', '', ids => app.forward(ids));
	menu.bwd = item('bwd', 'Naar achteren', '', ids => app.backward(ids));
	menu.back = item('toBack', 'Helemaal naar achteren', '', ids => app.sendToBack(ids));
	menu.s2 = sep();
	menu.lock = item('lock', 'Vergrendelen', '', ids => flipFlag(ids, 'locked'));
	menu.hide = item('eyeOff', 'Verbergen', '', ids => flipFlag(ids, 'hidden'));
	menu.s3 = sep();
	menu.del = item('trash', 'Verwijderen', 'Del', ids => app.remove(ids), 'danger');
	// Zichtbaar zoals getekend (na de veldregels), net als Ctrl+A: anders wiste Delete ook door een regel verborgen elementen.
	menu.all = item('selAll', 'Alles selecteren', 'Ctrl+A', () => { const raw = rulesRaw(); app.select(app.doc.elements.filter(e => !effective(e, raw).hidden).map(e => e.id)); });
	m.addEventListener('keydown', e => {
		if (e.key === 'Escape') { e.stopPropagation(); closeMenu(); menuReturn(); return; }
		if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
		e.preventDefault();
		const v = [...m.querySelectorAll('.mi:not([hidden]):not(:disabled)')], i = v.indexOf(document.activeElement);
		v[(i + (e.key === 'ArrowDown' ? 1 : -1) + v.length) % v.length]?.focus();
	});
	document.addEventListener('pointerdown', e => { if (!m.hidden && !m.contains(e.target)) closeMenu(); }, true);
	addEventListener('blur', closeMenu); addEventListener('resize', closeMenu);
	// Na een wijziging (bv. Delete via het toetsenbord) horen de items bij elementen die er niet meer zijn.
	for (const ev of ['change', 'doc', 'select']) app.on(ev, closeMenu);
	$('stageScroll').addEventListener('scroll', closeMenu, { passive: true });
}
function closeMenu() { const m = $('ctxMenu'); if (!m.hidden) m.hidden = true; }
// Esc of een gekozen item: focus terug naar wie het menu opende (Meer opties of het canvas); hij viel anders naar body en
// de volgende Tab begon bovenaan de pagina. Klik ernaast/scrollen houdt de focus waar hij heen ging.
let menuOpener = null;
function menuReturn() {
	const o = menuOpener;
	menuOpener = null;
	(o?.isConnected && o.checkVisibility?.() !== false ? o : $('overlay'))?.focus({ preventScroll: true });
}
// above = bovenkant van een anker (mini-werkbalk): past het menu er niet onder, dan erboven i.p.v. over de knop heen.
export function contextMenu(id, x, y, above = null) {
	if (!built) return;
	if (id && !app.selection.includes(id)) app.select([id]);
	const ids = id ? app.selection.slice() : [], has = ids.length > 0, els = app.selected();
	menu.ids = ids;
	for (const k of ['dup', 'copy', 'front', 'fwd', 'bwd', 'back', 'lock', 'hide', 'del', 's1', 's2', 's3']) menu[k].hidden = !has;
	menu.del.hidden = !has || els.every(e => e.locked);   // verwijderen slaat vergrendelde over
	menu.s3.hidden = menu.del.hidden;   // streep vóór Verwijderen: anders eindigt het menu met een lege lijn
	menu.all.hidden = has;
	menu.paste.disabled = !app.canPaste();
	setText(menu.lock.querySelector('.mi-l'), has && els.every(e => e.locked) ? 'Ontgrendelen' : 'Vergrendelen');
	const free = els.filter(e => !ruleLocked(e, 'hidden'));
	menu.hide.disabled = has && !free.length; menu.hide.title = menu.hide.disabled ? ruleTip(els[0], 'hidden') : '';
	setText(menu.hide.querySelector('.mi-l'), free.length && free.every(e => e.hidden) ? 'Tonen' : 'Verbergen');
	const m = $('ctxMenu'), a = document.activeElement;
	menuOpener = a && a !== document.body && !m.contains(a) ? a : null;   // een item uit een vorig menu is geen opener
	m.hidden = false;
	const r = m.getBoundingClientRect();
	m.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + 'px';
	const up = above != null && y + r.height > innerHeight - 8 && above - 4 - r.height >= 8;
	m.style.top = (up ? above - 4 - r.height : Math.max(8, Math.min(y, innerHeight - r.height - 8))) + 'px';
	m.querySelector('.mi:not([hidden]):not(:disabled)')?.focus();
}

// ---------- dialogen, bestanden ----------
const docName = () => String(app.doc?.name || '');
function setDocName(n) { if (app.doc.name === n) return; app.doc.name = n; app.changed({ coalesce: 'docname' }); }
// De naam kapt af in de topbalk: volledig in de tooltip (title, niet aria-label: de knoptekst blijft de toegankelijke naam).
function showName(n) { const t = n || 'Naamloos label'; setText($('fileName'), t); $('btnFile').title = 'Bestand: ' + t; }
function ask(title, msg, okText = 'OK', danger = false) {
	const d = $('dlgAsk');
	setText($('askTitle'), title); setText($('askMsg'), msg); setText($('askOk'), okText);
	$('askOk').classList.toggle('danger', danger);
	d.returnValue = '';
	return new Promise(res => { d.addEventListener('close', () => res(d.returnValue === 'ok'), { once: true }); d.showModal(); $('askCancel').focus(); });
}
function buildDialogs() {
	const inp = $('saveName'), hint = $('saveHint');
	inp.addEventListener('input', () => setText(hint, saveNames.includes(inp.value.trim()) ? 'Deze naam bestaat al en wordt overschreven.' : ''));
	$('saveForm').addEventListener('submit', e => {
		const n = inp.value.trim();
		if (!n) { e.preventDefault(); inp.focus(); return; }
		if (!userTemplates.save(n, app.doc)) { e.preventDefault(); setText(hint, 'Opslaan mislukt (opslag vol of ongeldige naam). Kies een andere naam of exporteer.'); return; }
		setDocName(n); refreshMine(); toast(`Opgeslagen als template "${n}"`, 'ok');
	});
	$('saveCancel').onclick = () => $('dlgSave').close();
	$('askCancel').onclick = () => $('dlgAsk').close('');
	$('helpClose').onclick = () => $('dlgHelp').close();
	// Klik op de achtergrond sluit (de inhoud vult de dialog, dus target === dialog = backdrop). Alleen als hij daar ook
	// begon: een tekstselectie die buiten eindigt geeft ook een click op de dialog (en de getypte naam was weg).
	for (const d of document.querySelectorAll('dialog')) {
		let down = null;
		d.addEventListener('pointerdown', e => { down = e.target; });
		d.addEventListener('click', e => { if (e.target === d && down === d) d.close(); });
	}
}
function openSave() {
	if ($('dlgSave').open) return;
	saveNames = userTemplates.list().map(t => t.name);
	$('saveList').replaceChildren(...saveNames.map(n => new Option(n, n)));
	const inp = $('saveName');
	inp.value = docName();
	inp.dispatchEvent(new Event('input'));
	$('dlgSave').showModal();
	inp.select();
}
function exportDoc() {
	const a = h('a', { href: URL.createObjectURL(new Blob([userTemplates.exportJSON(app.doc)], { type: 'application/json' })), download: (safeName(docName()) || 'label') + '.json' });
	document.body.append(a); a.click(); a.remove();
	setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
// Zoals loadTemplate: kalibratie en teller zijn van deze printer/sessie; een lijst alleen overnemen als het bestand er een heeft.
async function importFile(f) {
	const my = ++loadSeq;
	try {
		const d = userTemplates.importJSON(await f.text());
		const r = await hydrateIcons(d);
		if (my !== loadSeq) return;
		keepSession(d, false);
		d.name = f.name.replace(/\.json$/i, '');
		app.replace(d);
		toast('Label geïmporteerd. Ctrl+Z zet het vorige terug.', 'ok');
		if (r.failed) toast(OFFLINE_ICONS, 'warn');
	} catch (e) { if (my === loadSeq) toast('Importeren mislukt: ' + e.message, 'err'); }
}
function newLabel() {
	++loadSeq;
	const d = newDoc();
	keepSession(d);
	d.name = '';
	app.replace(d);
	toast('Nieuw label. Ctrl+Z zet het vorige terug.');
}
function pickImage(replaceId = null) { imgIn._replace = replaceId; imgIn.click(); }
// Max 1200 px lange zijde → dataURL, op wit (de print legt doorzichtig toch op wit): zo mag een grote PNG ook JPEG worden
// (localStorage is klein; een uitgeknipte foto bleef anders een ~6x grotere PNG).
function readImage(file) {
	return new Promise((res, rej) => {
		const url = URL.createObjectURL(file), im = new Image();
		im.onload = () => {
			// Svg met HTML erin (foreignObject, bv. draw.io) besmet het canvas: toDataURL gooide dan buiten de Promise (hing stil).
			try {
				// Svg is vector: op 1200 px tekenen, niet op zijn eigen maat (1em = 16 px) en dan wazig opblazen.
				const nw = im.naturalWidth || 600, nh = im.naturalHeight || 600, s = file.type === 'image/svg+xml' ? 1200 / Math.max(nw, nh) : 1;
				const [w, hh] = fitBox(nw * s, nh * s, 1200), c = document.createElement('canvas');
				c.width = w; c.height = hh;
				const x = c.getContext('2d');
				x.fillStyle = '#fff'; x.fillRect(0, 0, w, hh);
				x.drawImage(im, 0, 0, w, hh);
				const jpg = file.type === 'image/jpeg';
				let src = jpg ? '' : c.toDataURL('image/png');
				if (jpg || src.length > 1.5e6) src = c.toDataURL('image/jpeg', 0.92);
				res({ src, w, h: hh });
			} catch { rej(new Error('deze afbeelding kan niet worden omgezet')); }
			finally { URL.revokeObjectURL(url); }
		};
		im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('dit bestand is geen bruikbare afbeelding')); };
		im.src = url;
	});
}
async function addImage(file, replaceId, at = null) {
	if (!file || !/^image\//.test(file.type)) return toast('Kies een afbeeldingsbestand (png, jpg, svg, webp…)', 'err');
	const doc = app.doc, old = replaceId && doc.elements.find(e => e.id === replaceId);
	const current = assetRequest(old);
	try {
		const { src, w, h: hh } = await readImage(file), L = app.doc.label, ar = hh / w;
		if (!current() || replaceId && !old) return;
		if (old) { const was = old.src; old.src = src; app.changed(); toast(was ? 'Afbeelding vervangen' : 'Foto geplaatst', 'ok'); return; }
		let bw = Math.min(L.w * 0.6, 30), bh = bw * ar;
		if (bh > L.h * 0.8) { bh = L.h * 0.8; bw = bh / ar; }
		addEl('image', { src, w: round(bw, 0.1), h: round(bh, 0.1), name: file.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'Afbeelding' }, false, at);
	} catch (e) { toast('Afbeelding laden mislukt: ' + e.message, 'err'); }
}
// at = drop-punt (mm) op het label; meer foto's tegelijk schuiven 2 mm op, zoals plakken.
function handleFiles(files, at = null) {
	let i = 0;
	for (const f of files) {
		if (/^image\//.test(f.type)) { addImage(f, null, at && { x: at.x + i * 2, y: at.y + i * 2 }); i++; }
		else if (/\.(csv|tsv|txt)$/i.test(f.name)) loadCsvFile(f);
		else if (/\.json$/i.test(f.name)) importFile(f);
		else toast(`${f.name}: onbekend bestandstype`, 'err');
	}
}

function wireGlobal() {
	let depth = 0;
	const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
	const hint = $('dropHint');
	addEventListener('dragenter', e => { if (!hasFiles(e)) return; depth++; hint.hidden = false; });
	addEventListener('dragleave', e => { if (!hasFiles(e)) return; if (--depth <= 0) { depth = 0; hint.hidden = true; } });
	addEventListener('dragover', e => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
	// Losgelaten op het label = daar landen (zelfde mm-omrekening als de editor); elders = slim plaatsen.
	addEventListener('drop', e => {
		if (!hasFiles(e)) return;
		e.preventDefault(); depth = 0; hint.hidden = true;
		const r = $('view').getBoundingClientRect(), ppm = r.width / app.doc.label.w;
		const on = ppm > 0 && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
		handleFiles([...e.dataTransfer.files], on ? { x: (e.clientX - r.left) / ppm, y: (e.clientY - r.top) / ppm } : null);
	});
	// Pijltjes in paneel, rail, topbalk, popover of menu verschuiven nooit het element: de editor luistert op window
	// en kende alleen invoervelden als 'eigen pijltjes'. Eigen pijltjes-handlers erbinnen lopen eerst; scrollen blijft.
	document.addEventListener('keydown', e => { if (e.key.startsWith('Arrow') && e.target?.closest?.('#drawer, #rail, #topbar, .pop, .ctxmenu, .minibar')) e.stopPropagation(); });
	// De editor laat plakken met een bestand op het klembord expres door naar hier.
	$('stageScroll').addEventListener('scroll', placeToasts, { passive: true });   // label schuift onder een melding
	// Zelfde regel als de editor (typing): na een klik op een vinkje of keuzelijst viel het plakken anders tussen beide.
	document.addEventListener('paste', e => {
		if (typing(e.target) || document.querySelector('dialog[open]')) return;
		const files = [...(e.clipboardData?.files || [])].filter(f => /^image\//.test(f.type));
		if (files.length) { e.preventDefault(); files.forEach(f => addImage(f)); }
	});
	// Ctrl+Z/Y in een veld dat in het label landt = app-undo (zoals de knop en de toast beloven). De native undo van een
	// hergebruikt veld zette anders tekst van een vorig label terug, in een ander veld.
	document.addEventListener('keydown', e => {
		const k = e.key.toLowerCase();
		if (!(e.ctrlKey || e.metaKey) || e.altKey || (k !== 'z' && k !== 'y') || !docField(e.target)) return;
		e.preventDefault();
		histSync = true;
		try { if (k === 'y' || e.shiftKey) app.redo(); else app.undo(); refresh(); } finally { histSync = false; }
	}, true);
	// Typen op één geselecteerde tekst = meteen bewerken (zoals dubbelklik), Enter ook. Niet bij {velden}: één toets zou ze
	// wissen. Delete/Backspace krijgt een melding: één verkeerde toets wiste anders stil een element. Ook met de focus op een
	// paneel-/laagknop (de editor wist daar ook); in een tekstveld wist hij niets, dus dan geen melding.
	document.addEventListener('keydown', e => {
		const t = e.target;
		if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing || document.querySelector('dialog[open]')) return;
		const s = app.selected();
		if ((e.key === 'Delete' || e.key === 'Backspace') && s.length) {
			if (s.every(x => x.locked)) { if (!typing(t)) toast('Vergrendeld: eerst ontgrendelen.'); return; }
			const n = app.doc.elements.length;
			setTimeout(() => { if (app.doc.elements.length < n) toast('Verwijderd. Ctrl+Z zet het terug.'); });   // na de editor
			return;
		}
		if (!(t === document.body || t?.id === 'overlay')) return;
		const el = s.length === 1 && s[0].type === 'text' && !s[0].locked ? s[0] : null;
		if (!el) return;
		if (e.key === 'Enter') { e.preventDefault(); editText(el.id); return; }
		// '?' = hulp, spatie = in ontwerpprogramma's pannen: die nooit als eerste teken over de tekst heen.
		if (e.key.length !== 1 || e.key === '?' || e.key === ' ' || TOKEN.test(String(el.text ?? ''))) return;
		e.preventDefault();
		// Inline geopend = zijn textarea heeft de focus; anders het tekstvak in het paneel.
		const ta = editText(el.id) ? document.activeElement : areas.text;
		if (ta?.tagName === 'TEXTAREA') { ta.value = e.key; ta.dispatchEvent(new Event('input')); }
	}, true);
	addEventListener('keydown', e => {
		const mod = e.ctrlKey || e.metaKey;
		if (mod && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); openSave(); return; }
		if (e.key === 'Escape') { closeMenu(); closeFile(); }
		if (e.key === '?' && !mod && !typing(e.target) && !document.querySelector('dialog[open]')) { e.preventDefault(); $('dlgHelp').showModal(); }
	});
}

// ---------- publieke hooks voor main ----------
export function zoomChanged(z) { if (built && Number.isFinite(z)) { setText($('zoomPct'), zoomPct(z) + '%'); placeToasts(); } }
export const printPixels = () => S.pixels;
export function status(text, cls = '') {
	const s = $('pStatus');
	setText($('connectionStatus'), text);
	setText(s, text); s.className = 'p-status ' + (cls || '');
	// Neutraal ('Klik op Printer koppelen...', 'Verbinden...') herhaalde de knop en kapte af: dan alleen stip + knop, tekst in de tooltip.
	s.hidden = !cls;
	$('printer').title = text;
	if (cls === 'err') toast(text, 'err');
}
export function connection(on) {
	$('pDot').classList.toggle('on', !!on); $('btnConnect').hidden = !!on;
	$('panelConnect').hidden = !!on;
}
export function log(text) {
	const l = $('log');
	l.textContent = (l.textContent + new Date().toLocaleTimeString('nl-NL') + '  ' + text + '\n').slice(-20000);
	l.scrollTop = l.scrollHeight;
}
export function printing(n, total) {
	S.printLabel = n == null ? null : `Printen ${n}/${total}…`;
	const b = $('btnPrint');
	b.disabled = n != null; b.classList.toggle('busy', n != null);
	refresh();   // ook de printknoppen in Data (die volgen S.printLabel alleen via refresh)
}
function updPrintBtn() {
	const copies = clamp(Math.round(+app.doc.print.copies) || 1, 1, 99), n = Math.max(1, A.rows().length) * copies, c = $('printCount');
	setText($('printLabel'), S.printLabel || 'Print');
	setText(c, String(n)); c.hidden = !!S.printLabel || n < 2;
	$('btnPrint').title = S.printLabel || (n > 1 ? `${n} labels printen (Ctrl+P)` : 'Label printen (Ctrl+P)');
}
// Eerst op het canvas (inlineedit); tekst met {velden} of een invulveld weigert hij (false): een invulveld bewerk je dan
// in Invullen (focusField), andere {velden} in het paneel. -> true = inline.
export function editText(id) {
	const el = app.doc.elements.find(e => e.id === id);
	if (!el) return false;
	if (app.selection.length !== 1 || app.selection[0] !== id) app.select([id]);
	// Telefoon (< 560 px, zie app.css) met open paneel: het paneel ligt over het label, dan het paneel-tekstvak.
	if (!S.open || matchMedia('(min-width: 560px)').matches) try { if (A.inline?.open(id)) return true; } catch (e) { console.error('Tekst op het canvas bewerken mislukt', e); }
	const fk = fieldKey(el);
	if (fk) { openTab('fill', true); focusField(fk); return false; }
	S.edit = true; S.open = true;   // ook smal: typen vraagt het paneel
	refresh();
	if (typeSecs[el.type]) typeSecs[el.type].open = true;   // focus in een dichte sectie gaat verloren
	const ta = areas[el.type];
	// Met {velden} caret aan het eind: alles geselecteerd wiste één toets ze.
	if (ta) { ta.focus(); if (TOKEN.test(String(el.text ?? ''))) ta.setSelectionRange(ta.value.length, ta.value.length); else ta.select(); }
	return false;
}
// Toetsenbord- of Lagen-selectie in beeld scrollen (ingezoomd stond hij anders buiten beeld). Niet bij elke selectie: een
// klik of sleep op een half zichtbaar element zou dan onder de muis wegschuiven. Smal met open paneel wijkt .stage-scroll
// al uit (app.css), dus clientWidth is het zichtbare deel.
export function revealSel(ids = app.selection) {
	const sc = $('stageScroll'), L = app.doc.label, els = app.doc.elements.filter(e => ids.includes(e.id));
	if (!els.length || !(L.w > 0)) return;
	const v = $('view').getBoundingClientRect(), r = sc.getBoundingClientRect(), k = v.width / L.w, a = span(els);
	sc.scrollLeft += revealDelta(v.left + a.x * k, v.left + (a.x + a.w) * k, r.left, r.left + sc.clientWidth, 24);
	sc.scrollTop += revealDelta(v.top + a.y * k, v.top + (a.y + a.h) * k, r.top, r.top + sc.clientHeight, 24);
}
export function toast(msg, kind = '') {
	const box = $('toasts');
	const t = h('div', { class: 'toast ' + kind }, ic(kind === 'err' || kind === 'warn' ? 'warn' : kind === 'ok' ? 'check' : 'info', 16), h('span', {}, msg));
	box.append(t);
	while (box.children.length > 4) box.firstChild.remove();
	placeToasts();
	setTimeout(() => { t.classList.add('out'); setTimeout(() => { t.remove(); placeToasts(); }, 300); }, kind === 'err' ? 6000 : 3200);
}
// Meldingen in een vrije strook van de stage (boven of onder het label), nooit over het label: onder elkaar, anders naast
// elkaar; vult het label de stage (ingezoomd), dan over de voetregel; anders valt de oudste weg. Bovenaan stond de tweede
// anders half over het label (gemeten). Strook = [van, tot, lucht] in viewport-px.
function placeToasts() {
	const box = $('toasts'), stage = $('stage');
	if (!box.children.length) return;
	const S0 = stage.getBoundingClientRect(), sc = $('stageScroll').getBoundingClientRect(), v = $('view').getBoundingClientRect();
	const foot = stage.querySelector('.stage-foot').getBoundingClientRect().top;
	const top = Math.max(v.top, sc.top), bot = Math.min(v.bottom, sc.bottom), on = bot > top && v.right > sc.left && v.left < sc.right;
	const tiers = on ? [[[S0.top, top, 8], [bot, foot, 8]], [[bot, S0.bottom, 0]]] : [[[S0.top, foot, 8]]];
	for (;;) {
		for (const strips of tiers) for (const row of [false, true]) {
			box.classList.toggle('row', row);
			const hh = box.offsetHeight, s = strips.find(([a, b, m]) => b - a >= hh + 2 * m);
			if (s) { box.style.top = (s[0] === S0.top ? s[2] : s[1] - S0.top - s[2] - hh) + 'px'; return; }
		}
		if (box.children.length < 2) break;
		box.firstChild.remove();
	}
	box.classList.remove('row');
	box.style.top = '8px';
}

// Na elke render: alleen waarden/zichtbaarheid bijwerken van wat in beeld is.
export function refresh() {
	if (!built) return;
	syncPanes();   // eerst: de panel-ups hieronder draaien alleen voor wat zichtbaar is
	const d = app.doc, sel = app.selected();
	$('btnUndo').disabled = !app.canUndo(); $('btnRedo').disabled = !app.canRedo();
	updPrintBtn();
	// Uit het label, niet uit het canvas: het scherpe voorbeeld heeft meer pixels dan dots.
	const L = d.label, W = Math.round(L.w * DPM), H = Math.round(L.h * DPM), off = Math.max(0, Math.round((+d.print.offset || 0) * DPM));   // klem zoals printer.js
	setText($('dims'), `${fmtNl(L.w)} × ${fmtNl(L.h)} mm`);
	const dt = `${W} × ${H} printerpunten`;
	if ($('dims').title !== dt) $('dims').title = dt;
	$('widthWarn').hidden = W + off <= MAX_W;
	if (W + off > MAX_W) setText($('widthWarn'), `Breder dan de printkop: de ${d.print.rotate180 ? 'linker' : 'rechter'}kant valt weg`);
	$('labelWrap').classList.toggle('round', L.shape === 'round');
	const t = sel.length && sel.every(e => e.type === sel[0].type) ? sel[0].type : null;
	for (const [k, r] of Object.entries(typeRoots)) r.hidden = k !== t;
	refreshColumns();
	for (const p of panels) if (vis(p.root)) for (const u of p.ups) u();
	for (const th of sigThumbs) if (th.vis && th.drawn !== th.sig()) queueThumb(th);
}

export async function selftest() {
	if (!app.doc) app.init();   // node (tools/check.js): geen start(); in de browser is het doc er al
	const details = [];
	const t = (c, m) => { if (!c) details.push('FOUT: ' + m); };
	const potTemplate = TEMPLATES.find(x => x.id === 'weed-strain-pot');
	const pot = adaptTemplate(potTemplate.doc, { w:40, h:30, shape:'rect' }); pot.name = potTemplate.name;
	const oldPot = structuredClone(pot);
	for (const e of oldPot.elements) e.rules = [];
	const thcParts = new Set(templateFieldParts(oldPot, ['thc']));
	t(oldPot.elements.some(e => e.text === 'THC' && thcParts.has(e.id))
		&& !oldPot.elements.some(e => e.text === 'GRAM' && thcParts.has(e.id)), 'oud potlabel: THC-kop hoort bij THC, GRAM niet');
	const typeParts = new Set(templateFieldParts(oldPot, ['type']));
	t(oldPot.elements.filter(e => e.type === 'shape' && typeParts.has(e.id)).length === 3, 'oud potlabel: keuzevak en twee tussenschotten horen bij Soort');
	oldPot.fields = [];
	oldPot.elements = oldPot.elements.filter(e => !tokenKeys(e.text || e.data).length && !['INDICA', 'HYBRIDE', 'SATIVA'].includes(e.text));
	const remnants = new Set(templateFieldParts(oldPot));
	t(oldPot.elements.filter(e => !remnants.has(e.id)).every(e => e.type === 'border'), 'lege oude potlabel: alle veldrestanten weg, buitenrand blijft');
	oldPot.elements.find(e => e.text === 'THC').text = 'Eigen kop';
	t(!templateFieldParts(oldPot).includes(oldPot.elements.find(e => e.text === 'Eigen kop').id), 'aangepaste tekst wordt niet als template-restant gegokt');
	for (const template of TEMPLATES.filter(x => !x.doc.fields)) {
		const legacy = normalizeTemplateDoc(template.doc); legacy.name = template.name;
		t(templateFieldParts(legacy).length === 0, 'template zonder veldmetadata blijft bruikbaar: ' + template.name);
	}
	const savedDoc = app.doc, target = { id: 'foto' }, targetDoc = { elements: [target] };
	try {
		app.doc = targetDoc;
		t(sameTarget(targetDoc) && sameTarget(targetDoc, target) && !sameTarget(targetDoc, { id: 'foto' }), 'async doel: hetzelfde label en exact hetzelfde element');
		const first = assetRequest(target), add = assetRequest(), last = assetRequest(target);
		t(!first() && last() && add(), 'async vervangen: laatste verzoek wint, losse toevoeging blijft geldig');
		targetDoc.elements.length = 0;
		t(!sameTarget(targetDoc, target) && !last(), 'async doel: verwijderd element blijft verwijderd');
		app.doc = { elements: [target] };
		t(!sameTarget(targetDoc) && !sameTarget(targetDoc, target) && !add(), 'async doel: nieuw label weigert oud laadresultaat');
	} finally { app.doc = savedDoc; }
	t(fitBox(2400, 1200, 1200).join() === '1200,600', 'fitBox schaalt de lange zijde naar 1200');
	t(fitBox(900, 1800, 1200).join() === '600,1200', 'fitBox staand');
	t(fitBox(300, 200, 1200).join() === '300,200', 'fitBox vergroot niet');
	t(insertAt('ab', 'X', 1) === 'aXb' && insertAt('abc', 'X', 1, 2) === 'aXc' && insertAt('ab', 'X') === 'abX', 'insertAt');
	t(dropIndex(['a', 'b', 'c'], 'a', 'c', true) === 2, 'dropIndex: boven de bovenste = bovenaan');
	t(dropIndex(['a', 'b', 'c'], 'c', 'a', false) === 0, 'dropIndex: onder de onderste = onderaan');
	t(dropIndex(['a', 'b', 'c'], 'a', 'b', false) === 0 && dropIndex(['a', 'b', 'c'], 'a', 'b', true) === 1, 'dropIndex: naast de buur');
	t(dropIndex(['a', 'b'], 'z', 'a', true) === -1, 'dropIndex: onbekend id');
	t(fmt(2.5) === '2.5' && fmt(3) === '3' && fmt(1 / 3) === '0.33' && fmt('x') === '', 'fmt');
	t(zoomPct(PHYS) === 100 && zoomPct(PHYS * 2) === 200, 'zoomPct: 100% = ware grootte');
	t(/^<svg[^>]+viewBox="0 0 24 24"[\s\S]*<path d="M12 5v14M5 12h14"\/><\/svg>$/.test(iconSvg('plus')), 'iconSvg pad');
	t(iconSvg('help').includes('<circle'), 'iconSvg ruwe markup');
	t(TABS.every(([, , i]) => IC[i]) && Object.values(TYPE_IC).every(i => IC[i]), 'alle tab-/type-iconen bestaan');
	t(Object.keys(BC_HINT).length === BARCODES.length && BARCODES.every(([id]) => BC_HINT[id]), 'elke barcode heeft een hint');
	t(Object.entries(BC_RE).every(([k, re]) => !BC_EX[k] || re.test(BC_EX[k])), 'barcode-voorbeelden zijn geldig volgens hun eigen regel');
	// golf 3
	t(TABS[0][0] === 'fill' && SUBS[0][0] === 'weed' && IC.form && IC.roll, 'Invullen = eerste tab, wiet-pakket = eerste icoon-subtab');
	t(sameSize({ w: 40, h: 30 }, { w: 40, h: 30, shape: 'rect' }) && !sameSize({ w: 40, h: 30 }, { w: 30, h: 40 }) && !sameSize({ w: 40, h: 40, shape: 'round' }, { w: 40, h: 40 }), 'sameSize: maat + vorm');
	t(sizeName({ w: 40, h: 30 }) === '40×30' && sizeName({ w: 30, h: 30, shape: 'round' }) === '30×30 rond' && sizeName({ w: 25.5, h: 15 }) === '25,5×15', 'sizeName');
	t(tplHay({ name: 'Strain Pot', tags: ['Sativa', 'thc'] }) === 'strain pot sativa thc' && tplHay({ name: 'X' }) === 'x', 'tplHay: naam + tags');
	t(tplHay({ name: 'Café menu' }).includes(fold('cafe')) && tplHay({ name: 'Cafe' }).includes(fold('Café')), 'tplHay: zoeken zonder accenten');
	t(words(' Wifi, QR ').join() === 'wifi,qr' && words('qr wifi').every(x => tplHay({ name: 'Wifi-QR' }).includes(x)) && !words('  ').length, 'words: templates zoeken per woord, volgorde maakt niet uit');
	t([['upca', BC_EX.ean13], ['ean13', BC_EX.itf14], ['ean8', BC_EX.interleaved2of5], ['upce', BC_EX.interleaved2of5]].every(([k, v]) => !BC_RE[k].test(v)), 'typewissel: voorbeeld met een cijfer te veel wordt vervangen (geen fout controlecijfer)');
	t(decodeCsv(new Uint8Array([0xFF, 0xFE, 0x61, 0, 0x3B, 0, 0xE9, 0]).buffer) === 'a;é' && decodeCsv(new Uint8Array([0xEF, 0xBB, 0xBF, 0x61, 0xC3, 0xA9]).buffer) === 'aé' && decodeCsv(new Uint8Array([0x61, 0xE9]).buffer) === 'aé', 'decodeCsv: UTF-16 met BOM, UTF-8 (BOM weg), Windows-1252');
	t(decodeCsv(new Uint8Array([0xC3, 0xA9, 0x3B, 0xEF, 0xBF, 0xBD]).buffer) === 'é;�', 'decodeCsv: geldige UTF-8 met een echt vervangteken blijft UTF-8');
	t(fieldRowSig({ key: 'a', type: 'choice', options: ['x', 'y'], value: 'x' }) === fieldRowSig({ key: 'a', type: 'choice', options: ['x', 'y'], value: 'y' }) && fieldRowSig({ key: 'a', type: 'choice', options: ['x'] }) !== fieldRowSig({ key: 'a', type: 'choice', options: ['x', 'y'] }), 'fieldRowSig: waarde telt niet, opties wel');
	t(tokenKeys('{thc}% {Gram} {datum+3} x').join() === 'thc,gram' && tokenKeys('{naam|wifi} {a|}').join() === 'naam,a', 'tokenKeys (ook met filter)');
	t(needsIcons({ elements: [{ type: 'icon', icon: 'mdi:cannabis', source: 'iconify', svg: '' }] }) && !needsIcons({ elements: [{ type: 'icon', icon: 'leaf', source: 'tabler', nodes: [['path', {}]] }] }), 'needsIcons: iconify zonder svg / tabler met nodes');
	t(previewScale(1, 1, 320 * 240, false) === 2 && previewScale(1.5, 2, 320 * 240, false) === 6, 'previewScale = zoom × dpr × 2 (supersampling)');
	t(previewScale(0.4, 1, 320 * 240, false) === 1 && previewScale(10, 2, 320 * 240, false) === 8, 'previewScale geklemd op 1..8');
	t(previewScale(6, 2, 320 * 240, true) === 1 && previewScale(6, 2, 320 * 240, true, true) === 1, 'Printpixels = scale 1');
	t(previewScale(2.5, 1, 320 * 240, false, true) === 2.5 && previewScale(0.5, 1, 320 * 240, false, true) === 1, 'previewScale fast = zoom × dpr (zonder supersampling)');
	t(Math.abs(previewScale(8, 1, 400 * 2400, false) - 5) < 1e-9, 'previewScale houdt het pixelbudget aan');
	t(previewScale(NaN, 1, 100, false) === 1, 'previewScale zonder zoom = 1');
	t(iconifyParts('mdi:cannabis').join() === 'mdi,cannabis' && iconifyParts('game-icons:joint').join() === 'game-icons,joint' && iconifyParts('x').join() === ',x', 'iconifyParts');
	t(['cenH', 'cenV', 'cenB', 'expand', 'wand', 'smile', 'swap'].every(i => IC[i]), 'nieuwe knop-iconen bestaan');
	t(SUBS.map(s => s[0]).join() === 'weed,tabler,online,emoji' && new Set(ONLINE_QUICK.map(q => q[0])).size === ONLINE_QUICK.length, 'icoon-subtabs en snelzoek-chips');
	const tall = { label: { w: 40, h: 80 }, elements: [{ type: 'text', text: 'Kast 2', x: 3, y: 59, w: 34, h: 4, size: 2.8 }] }, wide = { label: { w: 50, h: 30 }, elements: [{ type: 'text', text: 'Hallo', x: 3, y: 3, w: 40, h: 8, size: 5 }] };
	const R = { w: 40, h: 30, shape: 'rect' }, ad = d => adaptTemplate(structuredClone(d), R);
	t(tooSmall(normalizeTemplateDoc(tall), ad(tall)) && !tooSmall(normalizeTemplateDoc(wide), ad(wide)) && !tooSmall(normalizeTemplateDoc(tall), normalizeTemplateDoc(tall)), 'tooSmall: staand 40x80 op 40x30 onleesbaar, 50x30 niet');
	const fm = fedMap(['Strain', 'Prijs', 'bio'], [{ key: 'strain', type: 'text', value: 'x' }, { key: 'type', type: 'choice', options: ['A'], value: 'A' }, { key: 'bio', type: 'toggle', value: false }]);
	t(fm.get('strain') === 'Strain' && !fm.has('type') && fm.get('bio') === 'bio' && ![...fm.values()].includes('Prijs'), 'fedMap: kolom -> veld zoals het label (hoofdletters, schakelaar), losse kolom vult niets');
	// golf 4b: kolom 'soort' is de key van een ander veld en vult dus niet ook de schakelaar met label 'Soort' (zoals render)
	const fs2 = [{ key: 'bio', type: 'toggle', label: 'Soort', value: false }, { key: 'soort', type: 'choice', options: ['A'], value: 'A' }, { key: 'p', type: 'number', label: 'Prijs:' }];
	const fm2 = fedMap(['soort', 'prijs'], fs2);
	t(fm2.get('soort') === 'soort' && !fm2.has('bio') && fm2.get('p') === 'prijs', 'fedMap = util.fieldCol: key van een ander veld vult geen label, label zonder dubbele punt wel');
	// golf 4
	t(TABS.map(x => x[0]).join() === 'fill,templates,add,icons,layers,data,label', 'tabvolgorde golf 4 (Randen onder Toevoegen, Label & print als tab)');
	t(IC.menu && IC.printer && IC.chevR && IC.swap, 'menu-/paneel-iconen bestaan');
	t(grew(['a'], ['a', 'b']) && grew([], ['a']) && !grew(['a', 'b'], ['a']) && !grew([], []) && !grew(['a'], ['a']), 'grew: alleen een nieuw id opent Bewerken');
	t(revealDelta(10, 20, 0, 100, 5) === 0 && revealDelta(110, 120, 0, 100, 5) === 25 && revealDelta(-20, -10, 0, 100, 5) === -25, 'revealDelta: in beeld = 0, anders minimaal');
	t(revealDelta(-50, 200, 0, 100, 5) === -55 && revealDelta(30, 200, 0, 100, 5) === 25, 'revealDelta: groter dan het zicht = beginrand in beeld');
	let q0 = quiet;
	calm(() => { q0 = quiet; });
	t(q0 === 1 && quiet === 0, 'calm telt op en weer af');
	try { calm(() => { throw new Error('x'); }); } catch {}
	t(quiet === 0, 'calm zet terug na een fout');
	// golf 4 usability
	const to = [{ key: 'strain', type: 'text', value: 'Wedding Cake' }, { key: 'type', type: 'choice', options: ['Indica', 'Sativa'], value: 'Indica' }, { key: 'thc', type: 'text', value: '25' }, { key: 'x', type: 'choice', options: ['A'], value: 'A' }];
	const n = carryFields([{ key: 'strain', type: 'text', value: 'Gelato' }, { key: 'type', type: 'choice', value: 'Sativa' }, { key: 'thc', type: 'number', value: '18' }, { key: 'x', type: 'choice', value: 'B' }], to, (k, v) => v === 'Demo');
	t(n === 2 && to[0].value === 'Gelato' && to[1].value === 'Sativa' && to[2].value === '25' && to[3].value === 'A', 'carryFields: zelfde key+type mee, ander type of onbekende keuze niet');
	const t2 = [{ key: 'strain', type: 'text', value: 'X' }];
	t(carryFields([{ key: 'strain', type: 'text', value: 'Demo' }], t2, (k, v) => v === 'Demo') === 0 && t2[0].value === 'X', 'carryFields: demo-waarde niet mee');
	const t3 = [{ key: 'gewicht', type: 'number', suffix: 'kg', value: '1' }];
	t(carryFields([{ key: 'gewicht', type: 'number', suffix: 'g', value: '300' }], t3) === 0 && t3[0].value === '1', 'carryFields: andere eenheid (g -> kg) niet mee');
	t(tplScore('naambadge (werk)', 'naam') === 4 && tplScore('bong-naamkaartje', 'naam') === 3 && tplScore('xnaamy', 'naam') === 2 && tplScore('grinder', 'naam') === 1, 'tplScore: begin > woord > bevat > tag');
	t(emojiFace('☮️', true) === '☮' && emojiFace('☮️', false) === '☮️', 'emoji mono zonder U+FE0F (zoals de print)');
	t(IC.fitText && IC.fitText !== IC.fit, 'eigen icoon voor Box passend om de tekst');
	const bx = { x: 0, y: 0, w: 10, h: 10 };
	t(keepAnchor({ ...bx, align: 'center', valign: 'middle' }, 4, 6).join() === '3,2' && keepAnchor({ ...bx, align: 'justify' }, 4, 6).join() === '0,0' && keepAnchor({ ...bx, align: 'right', valign: 'bottom' }, 4, 6).join() === '6,4' && keepAnchor({ ...bx, rot: 180 }, 4, 6).join() === '6,4', 'keepAnchor: Box passend houdt het uitlijnpunt vast (ook gedraaid)');
	// golf 4b
	t(zoomStep(100, 1) === 125 && zoomStep(100, -1) === 75 && zoomStep(137, 1) === 150 && zoomStep(137, -1) === 125 && zoomStep(800, 1) === 800 && zoomStep(50, -1) === 50 && zoomStep(124.7, 1) === 150 && zoomStep(1000, -1) === 800 && zoomStep(1000, 1) === 1000 && zoomStep(40, -1) === 40, 'zoomStep: vaste stappen, tussenstand = eerstvolgende, voorbij het eind blijft staan');
	t(licNC({ spdx: 'CC-BY-NC-SA-4.0' }) && licNC({ spdx: 'CC-BY-NC-4.0' }) && licNC({ title: 'Non-Commercial' }) && !licNC({ spdx: 'CC-BY-4.0' }) && !licNC({ spdx: 'MIT' }) && !licNC(null), 'licNC: alleen NC-licenties');
	t(licText({ title: 'CBI', license: { title: 'CC BY-NC-SA 4.0', spdx: 'CC-BY-NC-SA-4.0' }, author: { name: 'X' } }) === 'Niet-commercieel · CBI: CC BY-NC-SA 4.0 · X' && licText({ title: 'MDI', license: { title: 'Apache 2.0' } }) === 'MDI: Apache 2.0', 'licText: NC-waarschuwing vooraan');
	const AD = { elements: [{ type: 'text', font: 'Anton' }, { type: 'shape' }] };
	const ks = { batch: { csv: 'a;b\n1;2' } }, ks2 = { batch: { csv: 'x' } };
	keepSession(ks, false); keepSession(ks2);
	t(ks.batch.csv === 'a;b\n1;2' && ks.print !== app.doc.print && JSON.stringify(ks.print) === JSON.stringify(app.doc.print) && JSON.stringify(ks.counter) === JSON.stringify(app.doc.counter) && ks2.batch.csv === app.doc.batch.csv, 'keepSession: kalibratie en teller mee, import houdt eigen lijst');
	t(assetHits(AD, 'Anton') && !assetHits(AD, 'Oswald') && assetHits({ elements: [{ type: 'emoji' }] }, 'Noto Emoji') && !assetHits({ elements: [] }, 'Anton') && !assetHits(null, 'x'), 'assetHits: font alleen bij die tekst of mono-emoji');
	// golf 5
	const P0 = imaging.IMAGE_PRESETS[0].params;
	t(IMAGE_KEYS.every(k => k in P0 && P0[k] === ELEMENT_DEFAULTS.image[k]), 'Reset naar auto = variant Auto = alle beeldinstellingen op de defaults');
	// Box passend bij Groeien: alleen krimpen (geen groei-lus), en een tweede klik verandert niets meer.
	const fb = { x: 0, y: 0, w: 10, h: 5, fit: 'fill', wrap: false, align: 'center', valign: 'middle' }, fm3 = { w: 20, h: 3 }, f1 = textFit(fb, fm3);
	t(f1 && f1[2] <= fb.w && f1[3] <= fb.h && f1[3] === 3.2 && textFit({ ...fb, x: f1[0], y: f1[1], w: f1[2], h: f1[3] }, fm3) === null, 'textFit: Groeien krimpt alleen, nog een keer = niets');
	t(textFit({ ...fb, fit: 'none' }, fm3)?.slice(2).join() === '20.4,3.2' && textFit(fb, { w: 0, h: 0 }) === null, 'textFit: Vrij volgt de tekst, lege maat = niets');
	// hydrateIcons: 'constructor' uit een bestand raakt het Object-prototype niet, gevuld zonder dat icoon valt terug op lijn,
	// iconify uit het wiet-pakket zonder netwerk. Alleen in node: nep-fetch voor de Tabler-sets (blijft daarna in de
	// icons-cache staan; na ui draait in check.js niets meer dat iconen laadt).
	if (typeof document === 'undefined') {
		const real = globalThis.fetch;
		globalThis.fetch = async url => {
			if (!/tabler-nodes-(outline|filled)\.json$/.test(url)) throw new Error('geen netwerk in de selftest: ' + url);
			return { ok: true, status: 200, json: async () => /filled/.test(url) ? {} : { leaf: [['path', { d: 'M1 1h2' }]] } };
		};
		try {
			const hd = { elements: [{ type: 'icon', icon: 'constructor' }, { type: 'icon', icon: 'leaf', set: 'filled' }, { type: 'icon', icon: 'mdi:cannabis', source: 'iconify', svg: '' }] }, r = await hydrateIcons(hd), [c0, l0, w0] = hd.elements;
			t(r.n === 2 && !r.failed && !c0.nodes?.length && l0.set === 'outline' && l0.nodes?.length === 1 && /^<svg/.test(w0.svg), `hydrateIcons: constructor genegeerd, gevuld -> lijn, iconify uit het pakket (${JSON.stringify(r)})`);
		} finally { globalThis.fetch = real; }
	}
	// readImage (alleen in de browser: canvas): svg met alleen een viewBox op 1200 px, svg met HTML erin netjes geweigerd.
	if (typeof document !== 'undefined') {
		const svgFile = body => new File([`<svg xmlns="http://www.w3.org/2000/svg" ${body}</svg>`], 'x.svg', { type: 'image/svg+xml' });
		const vb = await readImage(svgFile('viewBox="0 0 200 100"><rect width="200" height="100"/>')).catch(e => e);
		t(vb.w === 1200 && vb.h === 600, `readImage: svg met alleen viewBox wordt 1200x600 (${vb.w}x${vb.h}${vb.message || ''})`);
		const fo = await readImage(svgFile('width="20" height="20"><foreignObject width="20" height="20"><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject>')).then(() => 'geaccepteerd', e => e.message);
		t(fo === 'deze afbeelding kan niet worden omgezet', 'readImage: svg met foreignObject geweigerd, hangt niet (' + fo + ')');
	}
	return { ok: !details.length, details: details.length ? details : ['ui-helpers ok'] };
}
