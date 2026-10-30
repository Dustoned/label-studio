// Wiet-iconenpakket: gecureerde, monochrome Iconify-iconen met de complete zwarte svg erbij (assets/weed-icons.json),
// zodat ze zonder netwerk werken. Bij import niets met DOM/fetch (node-tests); licenties staan in CREDITS.md.
import { fold, words } from './util.js';
import { ID_RE } from './icons.js';

const PACK_URL = new URL('../assets/weed-icons.json', import.meta.url);
// minimale aantallen per subcategorie (SPEC-wave3); de pakket-ids zelf zijn data, deze tabel bewaakt alleen de inhoud
const MIN_PER_CATEGORY = { blad: 35, joint: 20, bong: 20, vuur: 15, rook: 20, kweek: 15, munchies: 15, vibes: 10 };
const MIN_TOTAL = 150;
// het pakket gaat als svg-tekst in elementen en via een data-URL in een Image: geen scripts, handlers of externe verwijzingen
const UNSAFE_SVG = /<script|<foreignObject|<iframe|<object|<embed|\son[a-z]+\s*=|javascript:|href\s*=\s*(?!["']?#)|url\(\s*["']?(?!#)|@import/i;

// Pure structuurcontrole (selftest + loadWeedPack): { ok, errors, count }.
function validate(pack) {
	const errors = [], err = m => { if (errors.length < 50) errors.push(m); };
	if (!pack || typeof pack !== 'object') return { ok: false, errors: ['geen object'], count: 0 };
	if (!Number.isFinite(pack.version)) err('version ontbreekt');
	const credits = pack.credits && typeof pack.credits === 'object' ? pack.credits : (err('credits ontbreekt'), {});
	for (const [p, c] of Object.entries(credits)) {
		if (!c || typeof c.name !== 'string' || !c.name || typeof c.license !== 'string' || !c.license || typeof c.author !== 'string') err('credits onvolledig: ' + p);
	}
	if (!Array.isArray(pack.categories) || !pack.categories.length) return { ok: false, errors: errors.concat('categories ontbreekt'), count: 0 };
	const catIds = new Set(), ids = new Set(), usedPrefixes = new Set();
	let count = 0;
	for (const c of pack.categories) {
		if (!c || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(String(c.id)) || catIds.has(c.id)) { err('categorie-id ongeldig/dubbel: ' + c?.id); continue; }
		catIds.add(c.id);
		if (typeof c.name !== 'string' || !c.name) err('categorie zonder naam: ' + c.id);
		if (!Array.isArray(c.icons)) { err('categorie zonder icons: ' + c.id); continue; }
		for (const ic of c.icons) {
			count++;
			const id = String(ic?.id);
			if (!ID_RE.test(id)) { err('icoon-id ongeldig: ' + id); continue; }
			if (ids.has(id)) err('icoon dubbel: ' + id);
			ids.add(id);
			const prefix = id.slice(0, id.indexOf(':'));
			usedPrefixes.add(prefix);
			if (!credits[prefix]) err('geen credits voor ' + prefix);
			if (typeof ic.name !== 'string' || !ic.name.trim()) err('icoon zonder naam: ' + id);
			if (!Array.isArray(ic.tags) || ic.tags.length < 2 || !ic.tags.every(t => typeof t === 'string' && t)) err('tags (nl + en) ontbreken: ' + id);
			const svg = typeof ic.svg === 'string' ? ic.svg.trim() : '';
			if (!svg.startsWith('<svg') || !svg.endsWith('</svg>')) err('geen svg-document: ' + id);
			else if (UNSAFE_SVG.test(svg)) err('onveilige svg: ' + id);
		}
	}
	for (const p of Object.keys(credits)) if (!usedPrefixes.has(p)) err('credits voor ongebruikte collectie: ' + p);
	return { ok: !errors.length, errors, count };
}

async function readPack() {
	// node (tools/check.js, selftest): fetch kent geen file://, dus van schijf lezen
	if (PACK_URL.protocol === 'file:') {
		const { readFile } = await import('node:fs/promises');
		return JSON.parse(await readFile(PACK_URL, 'utf8'));
	}
	const r = await fetch(PACK_URL);
	if (!r.ok) throw new Error('Wiet-iconen laden mislukt (HTTP ' + r.status + ')');
	return r.json();
}

let cache = null;
export async function loadWeedPack() {
	// promise cachen: gelijktijdige aanvragen delen één fetch; bij falen later opnieuw proberen
	cache ||= readPack().then(pack => {
		const v = validate(pack);
		if (!v.ok) throw new Error('Wiet-iconenpakket ongeldig: ' + v.errors[0]);
		return pack;
	}).catch(e => { cache = null; throw e; });
	return cache;
}

// Score per zoekwoord (lager = beter, null = geen treffer); alle woorden moeten raken. De categorienaam telt het zwakst,
// anders komt bij 'joint' elke sigaret uit 'Joint & sigaret' even hoog als de joints zelf.
function tokenScore(name, words, catWords, t) {
	if (name.includes(t)) return -1;
	if (words.includes(t)) return 0;
	if (words.some(w => w.startsWith(t))) return 1;
	if (t.length >= 3 && words.some(w => w.includes(t))) return 2;
	if (catWords.some(w => w.startsWith(t))) return 3;
	return null;
}

export function searchWeedPack(pack, q) {
	const cats = Array.isArray(pack?.categories) ? pack.categories : [];
	const all = cats.flatMap(c => Array.isArray(c?.icons) ? c.icons.map(ic => [ic, c]) : []);
	const tokens = words(q);
	if (!tokens.length) return all.map(([ic]) => ic);
	const hits = [];
	all.forEach(([ic, c], i) => {
		// alleen het naamdeel van het id: de collectienaam ('game-icons', 'fluent-emoji-high-contrast') zegt niets over het icoon
		const id = fold(ic.id), nm = id.slice(id.indexOf(':') + 1), name = fold(ic.name).split(/[\s&,/-]+/);
		const words = [nm, ...nm.split('-'), ...name, ...(Array.isArray(ic.tags) ? ic.tags.map(fold) : [])].filter(Boolean);
		const catWords = [fold(c.id), ...fold(c.name).split(/[\s&,]+/)].filter(Boolean);
		let score = 0;
		for (const t of tokens) {
			const s = tokenScore(name, words, catWords, t);
			if (s === null) return;
			score += s;
		}
		hits.push({ ic, score, i });
	});
	return hits.sort((a, b) => a.score - b.score || a.i - b.i).map(h => h.ic);
}

// Het echte pakket via loadWeedPack (node: van schijf, browser: fetch), zo is die loader zelf ook getest.
export async function selftest() {
	const details = [];
	let ok = true;
	const check = (cond, msg) => { if (!cond) { ok = false; details.push('FOUT: ' + msg); } };
	const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="#000000" d="M1 1h22v22H1z"/></svg>';
	const mini = () => ({ version: 1, credits: { mdi: { name: 'Material Design Icons', license: 'Apache-2.0', author: 'Pictogrammers' },
		'game-icons': { name: 'Game Icons', license: 'CC-BY-3.0', author: 'GameIcons' } },
	categories: [
		{ id: 'blad', name: 'Blad & plant', icons: [{ id: 'mdi:cannabis', name: 'Cannabisblad', tags: ['wiet', 'cannabis', 'leaf'], svg }] },
		{ id: 'joint', name: 'Joint & sigaret', icons: [
			{ id: 'game-icons:cigarette', name: 'Sigaret', tags: ['sigaret', 'cigarette', 'roken'], svg },
			{ id: 'mdi:cigar', name: 'Sigaar rook', tags: ['sigaar', 'blunt', 'joint'], svg },
			{ id: 'game-icons:joint', name: 'Joint', tags: ['joint', 'pre-roll', 'spliff'], svg }] },
	] });
	check(validate(mini()).ok && validate(mini()).count === 4, 'mini-pakket geldig: ' + validate(mini()).errors.join('; '));
	const bad = (name, f) => { const p = mini(); f(p); check(!validate(p).ok, 'afgekeurd: ' + name); };
	bad('script', p => { p.categories[0].icons[0].svg = svg.replace('<path', '<script>x()</script><path'); });
	bad('onload', p => { p.categories[0].icons[0].svg = svg.replace('<svg ', '<svg onload="x()" '); });
	bad('externe href', p => { p.categories[0].icons[0].svg = svg.replace('<path', '<image href="https://x.y/a.png"/><path'); });
	bad('externe url()', p => { p.categories[0].icons[0].svg = svg.replace('<path', '<path style="fill:url(https://x.y/a)"/><path'); });
	check(validate((p => { p.categories[0].icons[0].svg = svg.replace('<path', '<use href="#a" mask="url(#m)"/><path'); return p; })(mini())).ok, 'interne #-verwijzingen toegestaan');
	bad('geen svg', p => { p.categories[0].icons[0].svg = '<img src=x>'; });
	bad('dubbel id', p => { p.categories[1].icons[0].id = 'mdi:cannabis'; });
	bad('ongeldig id', p => { p.categories[0].icons[0].id = '../x:y'; });
	bad('credits ontbreken', p => { delete p.credits.mdi; });
	bad('ongebruikte credits', p => { p.credits.ph = { name: 'Phosphor', license: 'MIT', author: 'x' }; });
	bad('te weinig tags', p => { p.categories[0].icons[0].tags = ['wiet']; });
	bad('dubbele categorie', p => { p.categories[1].id = 'blad'; });
	check(!validate(null).ok && !validate({}).ok, 'leeg pakket afgekeurd');
	const ids = (q, p = mini()) => searchWeedPack(p, q).map(i => i.id).join();
	check(ids('') === 'mdi:cannabis,game-icons:cigarette,mdi:cigar,game-icons:joint', 'lege zoekopdracht = alles in volgorde');
	check(ids('joint') === 'game-icons:joint,mdi:cigar,game-icons:cigarette', 'zoek joint (naam > tag > categorie)');
	check(ids('joint,') === ids('joint'), 'komma scheidt woorden');
	check(ids('mdi') === '' && ids('game') === '' && ids('icons') === '' && ids('cigar') === 'mdi:cigar,game-icons:cigarette', 'collectienaam telt niet, icoonnaam wel');
	check(ids('WIET') === 'mdi:cannabis' && ids('cannabis') === 'mdi:cannabis', 'hoofdletters + nl/en');
	check(ids('sig') === 'game-icons:cigarette,mdi:cigar,game-icons:joint', 'prefix');
	check(ids('sigaar rook') === 'mdi:cigar' && ids('sigaar xyzzy') === '', 'alle woorden moeten raken');
	check(ids('plant') === 'mdi:cannabis', 'categorienaam doorzoekbaar');
	check(searchWeedPack(null, 'x').length === 0 && searchWeedPack({ categories: 'x' }, '').length === 0, 'kapot pakket');
	// het echte pakket
	try {
		const pack = await loadWeedPack(), v = validate(pack);
		check(v.ok, 'assets/weed-icons.json: ' + v.errors.slice(0, 3).join('; '));
		check(v.count >= MIN_TOTAL, `>= ${MIN_TOTAL} iconen (${v.count})`);
		const per = Object.fromEntries(pack.categories.map(c => [c.id, c.icons.length]));
		for (const [id, n] of Object.entries(MIN_PER_CATEGORY)) check((per[id] || 0) >= n, `subcategorie ${id} >= ${n} (${per[id] || 0})`);
		check(searchWeedPack(pack, 'wiet').length >= 20 && searchWeedPack(pack, 'joint').length >= 3 && searchWeedPack(pack, 'bong').length >= 5, 'zoeken in pakket');
		check(['hasj', 'marihuana', 'ganja', 'skunk'].every(q => searchWeedPack(pack, q).length >= 20), 'coffeeshop-woorden in pakket');
		check(searchWeedPack(pack, 'high')[0]?.id === 'game-icons:high-grass', "'high' niet via collectie fluent-emoji-high-contrast");
		check(await loadWeedPack() === pack, 'cache');
		details.push(`ok pakket: ${v.count} iconen in ${pack.categories.length} subcategorieën (${Object.entries(per).map(([k, n]) => k + ' ' + n).join(', ')}), ${Object.keys(pack.credits).length} collecties`);
	} catch (e) { check(false, 'pakket laden: ' + (e?.message || e)); }
	return { ok, details };
}
