// Gedeelde helpers. Niets met DOM/localStorage op module-niveau: node importeert dit voor tools/check.js.
// Phomemo M110: 203 dpi = 8 dots/mm, printkop 48 mm = 384 dots.
export const DPM = 8, MAX_W = 384;

export const $ = id => document.getElementById(id);
const ABC = '0123456789abcdefghijklmnopqrstuvwxyz';
export const uid = () => Array.from({length:8}, () => ABC[Math.random() * 36 | 0]).join('');
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const hex = b => Array.from(b, v => v.toString(16).padStart(2, '0')).join(' ');
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// Hoek naar 0..360 (ook negatief).
export const normDeg = a => ((a % 360) + 360) % 360;
// toFixed haalt float-ruis weg (0.1 + 0.2 = 0.30000000000000004).
export const round = (v, step = 0.1) => +(Math.round(v / step) * step).toFixed((String(step).split('.')[1] || '').length);

// flush() zodat de laatste wijziging bij sluiten van de pagina niet verloren gaat.
export function debounce(fn, ms) {
	let t = null, args = [];
	const d = (...a) => { args = a; clearTimeout(t); t = setTimeout(d.flush, ms); };
	d.flush = () => { if (t === null) return; clearTimeout(t); t = null; fn(...args); };
	return d;
}

// DOM-helpers voor ui en iconbrowser (document pas bij aanroep).
export function h(tag, p, ...kids) {
	const e = document.createElement(tag);
	if (p) for (const k in p) {
		const v = p[k];
		// spellcheck:false moet wél door (anders kronkels in CSV en codes); andere false = attribuut weglaten.
		if (v == null || (v === false && k !== 'spellcheck')) continue;
		if (k === 'class') e.className = v;
		else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
		else if (k.includes('-') || k === 'role') e.setAttribute(k, v === true ? '' : v);
		else e[k] = v;
	}
	for (const c of kids.flat()) if (c != null && c !== false) e.append(c);
	return e;
}
export const setText = (el, s) => { if (el.textContent !== s) el.textContent = s; };

// Zoeken zonder hoofdletters en accenten (emoji, iconen, wiet-pakket, kolomnamen).
export const fold = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
// Zoekwoorden: 1 plek voor alle zoekfuncties (kopieën liepen uiteen en gaven 0 treffers).
export const words = q => fold(q).split(/[\s,]+/).filter(Boolean);

export function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }
export function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } }

// Scheidingsteken uit de kopregel, alleen buiten quotes: het eerste van tab ; , dat erin staat (NL-Excel quote geen komma's
// in kopnamen); staat er geen in de kop, dan is het één kolom (een namenlijst "Jansen, Piet" blijft heel). Quotes met ""
// als escape; een regeleinde binnen quotes hoort bij het veld (Alt+Enter-cel uit Excel). 1e rij = kolomnamen (lege kop =
// geen kolom: Excel zet vaak ';;' achter de laatste); rijen zonder enige waarde (ook ';;') vallen weg.
// Een 'sep=;'-regel bovenaan (export voor Excel) is geen kop: die geeft het scheidingsteken.
export function parseCSV(t) {
	const m = /^\uFEFF?sep=(.)\r?\n/i.exec(String(t || '')), s = String(t || '').slice(m ? m[0].length : 0), n = { '\t': 0, ';': 0, ',': 0 };
	// Zelfde quote-regel als de parser: alleen een quote aan het begin van een veld opent (mid = veld heeft al tekst).
	let q = false, any = false, mid = false;
	for (let i = 0; i < s.length; i++) {
		const ch = s[i];
		if (q) { if (ch !== '"') mid ||= !!ch.trim(); else if (s[i + 1] === '"') { mid = true; i++; } else q = false; }
		else if (ch === '"' && !mid) q = any = true;   // kop van alleen gequote cellen: niet doorzoeken in de data
		else if (ch === '\n' || ch === '\r') { if (any) break; }
		else if (ch in n) { n[ch]++; mid = false; }
		else if (ch.trim()) any = mid = true;
	}
	const sep = m ? m[1] : ['\t', ';', ','].find(c => n[c] > 0) ?? null, rows = [];
	let row = [], cur = '';
	q = false;
	for (let i = 0; i < s.length; i++) {
		const ch = s[i];
		if (q) { if (ch === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
		// Alleen een quote aan het begin van een veld opent; een inch-teken (3/4") midden in een veld blijft tekst.
		else if (ch === '"' && !cur.trim()) q = true;
		else if (ch === sep) { row.push(cur); cur = ''; }
		else if (ch === '\n' || ch === '\r') { if (ch === '\r' && s[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
		else cur += ch;
	}
	row.push(cur); rows.push(row);
	const [head, ...data] = rows.map(r => r.map(v => v.trim())).filter(r => r.some(v => v !== ''));
	if (!data.length) return [];
	// Nogmaals leeg na het wegvallen van kolommen zonder kop: een notitie naast de tabel werd anders een leeg label.
	return data.map(v => { const r = {}; head.forEach((h, i) => { if (h) r[h] = v[i] ?? ''; }); return r; }).filter(r => Object.values(r).some(v => v !== ''));
}

const p2 = n => String(n).padStart(2, '0');
const fmtDate = d => `${p2(d.getDate())}-${p2(d.getMonth() + 1)}-${d.getFullYear()}`;
const isoDate = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
// Kolomnamen net als de ingebouwde velden zonder spaties/hoofdletters vergelijken ({ Naam } = kolom "naam"); exact eerst.
function cell(row, k) {
	if (!row) return undefined;
	if (Object.hasOwn(row, k)) return row[k];
	const key = k.trim().toLowerCase(), ck = Object.keys(row).find(c => c.trim().toLowerCase() === key);
	return ck === undefined ? undefined : row[ck];
}
// Kolom van een veld: eerst op de key, anders op het veldlabel zoals Invullen het toont (kolom 'naam' vult veld Naam).
// Een kolom die de key van een ander veld is, telt niet als label: anders vult kolom 'soort' twee velden. De eigen key wel
// (kop 'Café' = key 'cafe': cell() vindt die niet, want cell() haalt geen accenten weg).
const plain = s => fold(s).replace(/[.:]+$/, '').trim();
export function fieldCol(row, f, fields = []) {
	const c = cell(row, typeof f?.key === 'string' ? f.key : '');
	if (c !== undefined || !row || !plain(f?.label)) return c;
	const lb = plain(f.label), keys = new Set((Array.isArray(fields) ? fields : []).filter(x => x !== f).map(x => plain(x?.key)));
	const ck = Object.keys(row).find(k => plain(k) === lb && !keys.has(plain(k)));
	return ck === undefined ? undefined : row[ck];
}
// Eenheid staat al in de labeltekst ('{thc}%', '€ {prijs}'): '18%' of '€ 9,00' uit Excel gaf anders '18%%'. Alleen direct
// aan een getal, zodat '3,5 kg' bij eenheid 'g' blijft staan.
function noUnit(s, unit) {
	const u = String(unit ?? '').trim();
	if (!u) return s;
	const e = u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return s.replace(new RegExp(`^\\s*${e}\\s*(?=[-+]?\\d)|(?<=\\d)\\s*${e}\\s*$`, 'i'), '');
}
// 'jjjj-mm-dd' (eigen veldwaarde) -> lokale middernacht; 30-02 e.d. = null.
export function parseDay(s) {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
	if (!m) return null;
	const [y, mo, d] = m.slice(1).map(Number), t = new Date(y, mo - 1, d);
	return t.getFullYear() === y && t.getMonth() === mo - 1 && t.getDate() === d ? t : null;
}
// waar/onwaar = NL-Excel, yes/no = Engelse lijsten.
const YES = new Set(['ja', '1', 'true', 'x', 'waar', 'yes']), NO = new Set(['nee', '0', 'false', '', 'onwaar', 'no']);
const bool = v => typeof v === 'boolean' ? v : (s => YES.has(s) ? true : NO.has(s) ? false : null)(String(v ?? '').trim().toLowerCase());

// CSV-kolom met dezelfde key gaat voor de ingevulde waarde: een lijst met kolommen strain;thc;type print meteen over de
// velden. Een datum uit de lijst blijft letterlijk (de lijst is al de echte datum); alleen de eigen veldwaarde krijgt de
// offset. raw = waarde voor regels.
export function fieldValues(fields, row = null, now = new Date()) {
	const display = {}, raw = {};
	for (const f of Array.isArray(fields) ? fields : []) {
		const key = typeof f?.key === 'string' ? f.key : '';
		if (!key || Object.hasOwn(raw, key)) continue;
		const col = fieldCol(row, f, fields), v = col !== undefined ? col : f.value;
		let d, r;
		if (f.type === 'toggle') { r = bool(v) ?? f.value === true; d = r ? 'ja' : 'nee'; }
		else if (f.type === 'date') {
			const s = String(v ?? '').trim(), base = col !== undefined ? null : s ? parseDay(s) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
			const off = Math.round(+f.offset) || 0;
			// Kalenderdagen via de Date-constructor: klopt over maand-/jaargrens en zomertijd heen.
			if (base) { const t = new Date(base.getFullYear(), base.getMonth(), base.getDate() + off); d = fmtDate(t); r = isoDate(t); }
			else d = r = s;   // uit de lijst, of geen datum ('morgen'): letterlijk tonen
		} else {
			const s = f.type === 'number' ? noUnit(String(v ?? ''), f.suffix) : String(v ?? '');
			// Keuze uit een lijst ('sativa') op de schrijfwijze van de optie, anders matcht de regel 'Sativa' niet.
			r = d = f.type === 'choice' && Array.isArray(f.options) ? f.options.find(o => String(o).trim().toLowerCase() === s.trim().toLowerCase()) ?? s : s;
		}
		display[key] = d; raw[key] = r;
	}
	return { display, raw };
}

// Dezelfde vergelijking bij tekenen en bij het vastzetten van een verwijderd veld.
export function ruleMatches(r, raw) {
	if (!r || !raw || typeof r.field !== 'string' || !Object.hasOwn(raw, r.field)) return false;
	const v = raw[r.field], eq = typeof v === 'boolean' ? bool(r.equals) : String(r.equals ?? '').trim().toLowerCase();
	return typeof v === 'boolean' ? v === eq : String(v ?? '').trim().toLowerCase() === eq;
}
// Regels in volgorde; een regel die niet matcht laat de eerdere uitkomst staan. Vergelijken zonder hoofdletters/spaties.
export function applyRules(el, raw) {
	const out = { invert: !!el?.invert, hidden: !!el?.hidden };
	for (const r of Array.isArray(el?.rules) ? el.rules : []) {
		if (!ruleMatches(r, raw)) continue;
		for (const k of ['invert', 'hidden']) if (typeof r.set?.[k] === 'boolean') out[k] = r.set[k];
	}
	return out;
}

// {naam|filter}: wifi = \ ; , : " escapen (anders breekt WIFI:S:..;P:..;; op een ; in het wachtwoord). Onbekend = ongewijzigd.
const FILTERS = { wifi: v => v.replace(/[\\;,:"]/g, '\\$&') };
// Volgorde CSV > veld > ingebouwd: een veld met kolom in de lijst toont al de kolomwaarde (fieldValues), daarna een losse
// kolom, dan {datum}/{tijd}/{teller}. Een veld 'datum' gaat zo voor de ingebouwde {datum}. Onbekend = letterlijk laten staan.
// display = fieldValues(...).display als de aanroeper die al heeft (render: 1x per render i.p.v. per element).
// TOKEN = tekst heeft een {veld} (zelfde vorm als substitute vervangt); zonder /g, dus test() is stateloos.
export const TOKEN = /\{[^{}]+\}/;
// Een filter verandert niet dat elke kopie een eigen tellernummer krijgt.
export const COUNTER_TOKEN = /\{\s*teller\s*(?:\|[^{}]*)?\}/i;
// Zichtbaarheid na veldregels, zoals de renderer; een verborgen basis kan door een keuze zichtbaar worden.
export function usesToken(doc, re, row = null) {
	const raw = fieldValues(doc?.fields, row).raw;
	return (doc?.elements || []).some(e => !applyRules(e, raw).hidden && re.test(String(e.text ?? '') + '\n' + String(e.data ?? '')));
}
export function substitute(text, { row = null, counter, digits = 0, now = new Date(), fields = null, display = null } = {}) {
	let fv = null;
	const look = k => {
		const key = k.trim().toLowerCase();
		if (fields) { fv ||= display || fieldValues(fields, row, now).display; if (Object.hasOwn(fv, key)) return fv[key]; }
		const c = cell(row, k);
		if (c !== undefined) return c;
		if (key === 'datum') return fmtDate(now);
		const off = /^datum\s*([+-])\s*(\d+)$/.exec(key);
		// Kalenderdagen via setDate: klopt over maand-/jaargrens en zomertijd heen.
		if (off) return fmtDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + (off[1] === '-' ? -1 : 1) * +off[2]));
		if (key === 'tijd') return `${p2(now.getHours())}:${p2(now.getMinutes())}`;
		if (key === 'teller' && Number.isFinite(counter)) return (counter < 0 ? '-' : '') + String(Math.abs(Math.round(counter))).padStart(digits || 0, '0');
	};
	return String(text ?? '').replace(/\{([^{}]+)\}/g, (m, k) => {
		const i = k.indexOf('|'), v = look(i < 0 ? k : k.slice(0, i)), f = i < 0 ? '' : k.slice(i + 1).trim().toLowerCase();
		if (v === undefined) return m;
		return Object.hasOwn(FILTERS, f) ? FILTERS[f](String(v)) : v;
	});
}

export function selftest() {
	const details = [];
	const eq = (name, got, exp) => { const ok = JSON.stringify(got) === JSON.stringify(exp); details.push(`${ok ? 'ok' : 'FAIL'} ${name}${ok ? '' : `: ${JSON.stringify(got)} != ${JSON.stringify(exp)}`}`); return ok; };
	const res = [];
	res.push(eq('csv ; + quotes', parseCSV('naam;prijs\n"Appel; rood";1,20'), [{naam:'Appel; rood', prijs:'1,20'}]));
	res.push(eq('csv tab + "" + lege regels + ontbrekend veld', parseCSV('a\tb\r\n\r\n"x ""y"""\t2\n3'), [{a:'x "y"', b:'2'}, {a:'3', b:''}]));
	res.push(eq('csv komma', parseCSV('a,b\n1,"2,5"'), [{a:'1', b:'2,5'}]));
	res.push(eq('zoekwoorden: accenten, hoofdletters, komma', [words(' Café  Leaf,x '), words(' , ')], [['cafe', 'leaf', 'x'], []]));
	res.push(eq('csv alleen kop', parseCSV('a;b'), []));
	res.push(eq('csv 1 kolom met komma in de waarde', parseCSV('naam\nJansen, Piet\nBakker, Els'), [{naam:'Jansen, Piet'}, {naam:'Bakker, Els'}]));
	res.push(eq('csv scheidingsteken binnen quotes telt niet', parseCSV('"Naam, voluit";prijs\nA;1'), [{'Naam, voluit':'A', prijs:'1'}]));
	res.push(eq('csv regeleinde binnen quotes (Excel-cel)', parseCSV('naam\tadres\nPiet\t"Dorpsstraat 1\n1234 AB Ergens"\nEls\tKerkweg 2'), [{naam:'Piet', adres:'Dorpsstraat 1\n1234 AB Ergens'}, {naam:'Els', adres:'Kerkweg 2'}]));
	res.push(eq('csv gequote kop: geen scheidingsteken uit de data', [parseCSV('"naam"\nJansen, Piet\nBakker, Els'), parseCSV('"naam"\t"plaats"\nJansen, Piet\tAmsterdam, NL')],
		[[{naam:'Jansen, Piet'}, {naam:'Bakker, Els'}], [{naam:'Jansen, Piet', plaats:'Amsterdam, NL'}]]));
	res.push(eq('csv " midden in een veld = tekst (ook in de kop)', [parseCSV('naam;maat\nSchroef 3/4";M6\nMoer;M8\n12" pizza;x'), parseCSV('Maat 3/4";Prijs\nA;1')],
		[[{naam:'Schroef 3/4"', maat:'M6'}, {naam:'Moer', maat:'M8'}, {naam:'12" pizza', maat:'x'}], [{'Maat 3/4"':'A', Prijs:'1'}]]));
	res.push(eq('csv rijen met alleen scheidingstekens weg', parseCSV('naam;prijs\nKaas;1\n;\n;;\r\n'), [{naam:'Kaas', prijs:'1'}]));
	res.push(eq('csv meer komma\'s in de kop dan ; of tabs (NL-Excel, geplakt blok)', [parseCSV('Naam, voluit;Adres, straat\nPiet;Dorpsstraat 1'), parseCSV('Naam, voluit\tPrijs, incl\nPiet\t1,20')],
		[[{'Naam, voluit':'Piet', 'Adres, straat':'Dorpsstraat 1'}], [{'Naam, voluit':'Piet', 'Prijs, incl':'1,20'}]]));
	res.push(eq('csv lege kop (;; achter de laatste kolom) = geen kolom', parseCSV('naam;prijs;;\r\nAppel;1,20;;'), [{naam:'Appel', prijs:'1,20'}]));
	res.push(eq('csv sep=-regel (ook BOM/CRLF) = scheidingsteken, geen kop', [parseCSV('sep=;\nnaam;prijs\nKaas;1'), parseCSV('\uFEFFSEP=,\r\n"Naam; voluit",prijs\r\nKaas,1')],
		[[{naam:'Kaas', prijs:'1'}], [{'Naam; voluit':'Kaas', prijs:'1'}]]));
	res.push(eq('csv quote na scheidingsteken opent (kop)', parseCSV('naam,"prijs; incl"\nKaas,"1,20"'), [{naam:'Kaas', 'prijs; incl':'1,20'}]));
	res.push(eq('csv sep=-regel gaat voor de kop', parseCSV('sep=;\nPrijs, incl\n1,20'), [{'Prijs, incl':'1,20'}]));
	res.push(eq('csv rij met alleen tekst in een kolom zonder kop = weg', [parseCSV('naam;prijs;;\nAppel;1,20;;\n;;;let op: incl btw'), parseCSV('naam;prijs\nKaas;1\n;;opmerking')],
		[[{naam:'Appel', prijs:'1,20'}], [{naam:'Kaas', prijs:'1'}]]));
	const now = new Date(2026, 0, 30, 9, 5);
	res.push(eq('datum', substitute('{datum}', {now}), '30-01-2026'));
	res.push(eq('datum+3 over maandgrens', substitute('{datum+3}', {now}), '02-02-2026'));
	res.push(eq('datum-31 over jaargrens', substitute('{datum-31}', {now}), '30-12-2025'));
	res.push(eq('tijd', substitute('om {tijd}', {now}), 'om 09:05'));
	res.push(eq('teller padding', substitute('#{teller}', {counter:7, digits:3}), '#007'));
	res.push(eq('teller zonder waarde blijft', substitute('{teller}', {}), '{teller}'));
	res.push(eq('tellertoken met filter: herkennen voor controle en doorschuiven',
		['{teller}', '{ TELLER | wifi }', '{teller|onbekend}', '{teller|}', '{teller2}', '{teller', '{naam|teller}'].map(s => COUNTER_TOKEN.test(s)),
		[true, true, true, true, false, false, false]));
	res.push(eq('teller met filter houdt nummer en voorloopnullen', substitute('{teller|wifi}', {counter:7, digits:3}), '007'));
	const ruledCounter = { fields: [{ key:'toon', type:'toggle', value:true }], elements: [
		{ hidden:true, data:'{teller|wifi}', rules:[{ field:'toon', equals:true, set:{ hidden:false } }] }
	] };
	res.push(eq('tellertoken volgt zichtbaarheid uit veld en CSV', [usesToken(ruledCounter, COUNTER_TOKEN), usesToken(ruledCounter, COUNTER_TOKEN, { toon:'nee' }),
		usesToken(ruledCounter, COUNTER_TOKEN, { toon:'ja' }), usesToken({ elements:[{ hidden:true, text:'{teller}' }] }, COUNTER_TOKEN)], [true, false, true, false]));
	res.push(eq('kolom + onbekend token', substitute('{naam} {onbekend} {constructor}', {row:{naam:'Kaas'}, now}), 'Kaas {onbekend} {constructor}'));
	res.push(eq('kolom zonder spaties/hoofdletters', substitute('{ naam } / {Naam} / {datum}', {row:{naam:'Kaas', Datum:'kol'}, now}), 'Kaas / Kaas / kol'));
	res.push(eq('kolom gaat voor datum', substitute('{datum}', {row:{datum:'morgen'}, now}), 'morgen'));
	// --- golf 3: invulvelden en regels ---
	const F = [
		{ key:'strain', type:'text', value:'Amnesia Haze' }, { key:'type', type:'choice', options:['Indica', 'Hybride', 'Sativa'], value:'Hybride' },
		{ key:'thc', type:'number', suffix:'%', value:'22' }, { key:'datum', type:'date', value:'', offset:0 },
		{ key:'tht', type:'date', value:'2026-01-30', offset:3 }, { key:'bio', type:'toggle', value:true }, { key:'constructor', type:'text', value:'c' },
	];
	const fv = fieldValues(F, null, now);
	res.push(eq('fieldValues display', fv.display, { strain:'Amnesia Haze', type:'Hybride', thc:'22', datum:'30-01-2026', tht:'02-02-2026', bio:'ja', constructor:'c' }));
	res.push(eq('fieldValues raw', fv.raw, { strain:'Amnesia Haze', type:'Hybride', thc:'22', datum:'2026-01-30', tht:'2026-02-02', bio:true, constructor:'c' }));
	const csv = fieldValues(F, { Strain:'OG Kush', type:'sativa', bio:'x', tht:'05-02-2026', thc:'' }, now);
	res.push(eq('fieldValues: CSV-kolom gaat voor (keuze op optie-schrijfwijze, toggle x, datum uit de lijst letterlijk, lege cel)',
		[csv.display.strain, csv.raw.type, csv.raw.bio, csv.display.tht, csv.raw.tht, csv.display.thc, csv.display.datum], ['OG Kush', 'Sativa', true, '05-02-2026', '05-02-2026', '', '30-01-2026']));
		// golf 4: kolom op het veldlabel (key gaat voor), eenheid uit de lijst niet dubbel
		const FL = [{ key:'strain', label:'Naam', type:'text', value:'A' }, { key:'type', label:'Soort', type:'choice', options:['Indica', 'Sativa'], value:'Sativa' }, { key:'nr', label:'Plant nr.', type:'text', value:'1' }];
		const lb = fieldValues(FL, { naam:'OG', SOORT:'indica', 'plant nr':'7' }).raw, kb = fieldValues([{ key:'soort', label:'Extract', value:'e' }, { key:'type', label:'Soort', value:'t' }], { soort:'x' }).raw;
		res.push(eq('fieldValues: kolom op veldlabel (accent/punt), key wint van label', [lb.strain, lb.type, lb.nr, kb.soort, kb.type, fieldCol({ 'Prijs:':'9' }, { key:'p', label:'Prijs' }), fieldCol(null, FL[0]),
			fieldValues([{ key:'cafe', label:'Café', value:'x' }], { 'Café':'B' }).display.cafe, fieldValues([{ key:'prijs', label:'Prijs', value:'x' }], { 'Prijs:':'9' }).display.prijs],
			['OG', 'Indica', '7', 'x', 't', '9', undefined, 'B', '9']));
		const U = [{ key:'thc', type:'number', suffix:'%', value:'22' }, { key:'g', type:'number', suffix:'g', value:'1' }, { key:'p', type:'number', suffix:'€', value:'1' }, { key:'t', type:'text', value:'18%' }];
		res.push(eq('fieldValues: eenheid uit de lijst/het veld valt weg (alleen aan een getal)', [fieldValues(U, { thc:'18%', g:'3,5 g', p:'€ 9,00' }).display, fieldValues(U, { thc:'18 %', g:'3,5 kg', p:'9,00 €' }).raw,
			fieldValues(U, { thc:'', g:'3,5g' }).display.thc, fieldValues([{ ...U[0], value:'18%' }]).display.thc],
			[{ thc:'18', g:'3,5', p:'9,00', t:'18%' }, { thc:'18', g:'3,5 kg', p:'9,00', t:'18%' }, '', '18']));
	// golf 4: alleen de eigen veldwaarde krijgt de offset; een lijstdatum (ook iso of leeg) blijft zoals hij in de lijst staat
	res.push(eq('fieldValues: lijstdatum zonder offset, eigen waarde met offset', [{ tht:'2026-02-05' }, { tht:'' }, { Tht:'5-2-2026' }, null].map(r => fieldValues([F[4]], r, now).display.tht)
		.concat(fieldValues([{ key:'d', type:'date', value:'', offset:2 }], { x:'1' }, now).display.d), ['2026-02-05', '', '5-2-2026', '02-02-2026', '01-02-2026']));
	res.push(eq('fieldValues: toggle-waarden uit CSV', ['ja', 'NEE', '1', '0', 'true', 'false', 'x', '', 'misschien'].map(v => fieldValues([F[5]], { bio:v }).raw.bio),
		[true, false, true, false, true, false, true, false, true]));
	// Standaard aan én uit: anders valt een niet herkende waarde toevallig op de verwachte uitkomst.
	res.push(eq('fieldValues: toggle WAAR/ONWAAR (NL-Excel) en yes/no', [true, false].flatMap(value => ['WAAR', 'ONWAAR', 'yes', 'no'].map(v => fieldValues([{ ...F[5], value }], { bio:v }).raw.bio)),
		[true, false, true, false, true, false, true, false]));
	res.push(eq('fieldValues: ongeldige datum letterlijk, -offset over jaargrens, dubbele key = eerste',
		[fieldValues([{ key:'d', type:'date', value:'morgen' }]).display.d, fieldValues([{ key:'d', type:'date', value:'2026-01-01', offset:-1 }]).display.d,
			fieldValues([{ key:'d', type:'date', value:'2026-02-30' }]).display.d, fieldValues([{ key:'a', value:'1' }, { key:'a', value:'2' }]).display.a],
		['morgen', '31-12-2025', '2026-02-30', '1']));
	res.push(eq('fieldValues: leeg/kapot', [fieldValues(null), fieldValues([null, { key:5 }, {}])], [{ display:{}, raw:{} }, { display:{}, raw:{} }]));
	res.push(eq('substitute met velden', substitute('{strain} {thc}% {Type} {bio} {constructor}', { fields:F, now }), 'Amnesia Haze 22% Hybride ja c'));
	res.push(eq('substitute: veld datum gaat voor ingebouwd, {datum+3} blijft ingebouwd', substitute('{datum}|{datum+3}', { fields:[{ key:'datum', type:'date', value:'2026-05-01' }], now }), '01-05-2026|02-02-2026'));
	res.push(eq('substitute: CSV > veld > ingebouwd', substitute('{strain}|{kolom}|{teller}|{x}', { fields:F, row:{ strain:'Kush', kolom:'k' }, counter:2, digits:2, now }), 'Kush|k|02|{x}'));
	res.push(eq('substitute zonder fields ongewijzigd', substitute('{strain}', { now }), '{strain}'));
	res.push(eq('substitute: meegegeven display gaat voor herberekenen', substitute('{strain}', { fields:F, display:{ strain:'X' }, now }), 'X'));
	// golf 4: filter-suffix {x|wifi} voor WIFI:-QR's; kolom, veld en ingebouwd; onbekend filter = ongewijzigd, onbekend token blijft
	const PW = String.raw`a;b,c:d"e\f`, WF = [{ key:'pw', type:'text', value:PW }];
	res.push(eq('substitute |wifi: veld, kolom, ingebouwd, spaties/hoofdletters', [substitute('P:{pw|wifi};', { fields:WF }), substitute('{ssid|wifi}', { row:{ SSID:'Huis;Net' } }),
		substitute('{tijd|wifi}', { now }), substitute('{ pw | WIFI }', { fields:WF })], [String.raw`P:a\;b\,c\:d\"e\\f;`, String.raw`Huis\;Net`, String.raw`09\:05`, String.raw`a\;b\,c\:d\"e\\f`]));
	res.push(eq('substitute |filter: onbekend filter, leeg filter, onbekend token, zonder filter', [substitute('{pw|xyz}', { fields:WF }), substitute('{pw|}', { fields:WF }),
		substitute('{onbekend|wifi}', { now }), substitute('{pw}', { fields:WF })], [PW, PW, '{onbekend|wifi}', PW]));
	const R = [{ field:'type', equals:'Hybride', set:{ invert:true } }, { field:'bio', equals:false, set:{ hidden:true } }];
	res.push(eq('applyRules', [applyRules({ rules:R }, fv.raw), applyRules({ rules:R, invert:false, hidden:true }, { type:'indica', bio:false }),
		applyRules({ rules:R }, { type:' hybride ' }), applyRules({ invert:true }, fv.raw), applyRules({ rules:R }, {}), applyRules({ rules:[{ field:'bio', equals:'nee', set:{ hidden:true, x:1 } }] }, { bio:false })],
		[{ invert:true, hidden:false }, { invert:false, hidden:true }, { invert:true, hidden:false }, { invert:true, hidden:false }, { invert:false, hidden:false }, { invert:false, hidden:true }]));
	res.push(eq('applyRules: latere regel wint, set false zet terug', applyRules({ invert:true, rules:[{ field:'t', equals:'a', set:{ invert:false } }, { field:'t', equals:'b', set:{ invert:true } }] }, { t:'a' }), { invert:false, hidden:false }));
	res.push(eq('round', [round(0.1 + 0.2), round(1.26, 0.5), round(2.346, 0.01)], [0.3, 1.5, 2.35]));
	res.push(eq('clamp', [clamp(5, 0, 3), clamp(-1, 0, 3)], [3, 0]));
	res.push(eq('uid 8 tekens', /^[0-9a-z]{8}$/.test(uid()), true));
	res.push(eq('hex', hex([0, 15, 255]), '00 0f ff'));
	// Timer van 10 s: flush draait meteen en ruimt hem op, de tweede flush doet niets.
	let n = 0;
	const db = debounce(v => { n += v; }, 1e4);
	db(2); db(3); db.flush(); db.flush();
	res.push(eq('debounce: flush 1x met laatste args', n, 3));
	return { ok: res.every(Boolean), details };
}
