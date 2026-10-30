// Emoji-kiezer: Nederlandse emojibase-data (MIT), lazy uit de CDN. Bij import niets met DOM/localStorage (node-tests).
import { load, store, fold, words } from './util.js';

const DATA_URL = 'https://cdn.jsdelivr.net/npm/emojibase-data@15.3.2/nl/data.json';
const RECENT = 'pm110.v2.recentEmoji', MAX_RECENT = 40;

// emojibase-groepen; 2 = losse huidskleur/haar-componenten, die zijn geen emoji om te plaatsen.
export const EMOJI_GROUPS = [
	{ id: 0, name: 'Smileys & emotie' }, { id: 1, name: 'Mensen & lichaam' }, { id: 3, name: 'Dieren & natuur' },
	{ id: 4, name: 'Eten & drinken' }, { id: 5, name: 'Reizen & plaatsen' }, { id: 6, name: 'Activiteiten' },
	{ id: 7, name: 'Objecten' }, { id: 8, name: 'Symbolen' }, { id: 9, name: 'Vlaggen' },
];

export const WEED_EMOJI = ['🌿', '🍃', '🌱', '🍀', '🌾', '🪴', '🌵', '🚬', '💨', '🔥', '🌬️', '🍄', '🍪', '🍫', '🧁', '🍰', '🍯', '🍬',
	'🍭', '💊', '💉', '🧪', '⚗️', '🫙', '⚖️', '🌈', '😵‍💫', '🥴', '😎', '🤤', '😮‍💨', '😵', '🤪', '😂', '😴', '💤', '🛸', '👽', '🧠', '✌️',
	'🤙', '☮️', '🎶', '🎧', '🍕', '🍔', '🍟', '🍩', '🍿', '🥤', '🌙', '✨', '💚', '💯'];

// Engelse en straattaal-zoekwoorden: de NL-emojidata kent 'wiet', 'weed' of '420' niet als tag.
const W = WEED_EMOJI;
const ALIASES = {
	wiet: W.slice(0, 12), weed: W.slice(0, 12), cannabis: ['🌿', '🍃', '🌱', '🪴'], marihuana: ['🌿', '🍃', '🌱', '🪴'], hasj: ['🍫', '🌿', '🔥'],
	'420': W, coffeeshop: W, smoke: ['💨', '🚬', '🔥', '🌬️', '😮‍💨'], blowen: ['🚬', '💨', '🔥', '🌿', '😮‍💨'], joint: ['🚬', '💨', '🔥', '🌿'],
	blunt: ['🚬', '💨', '🔥'], bong: ['🧪', '⚗️', '💨'], high: ['😵‍💫', '🥴', '🤤', '🤪', '😎', '🛸', '👽', '🧠', '🌈'],
	stoned: ['😵‍💫', '🥴', '🤤', '😴', '💤', '😎', '🛸'], munchies: ['🍕', '🍔', '🍟', '🍩', '🍪', '🍫', '🍿', '🥤', '🤤'],
	edible: ['🍪', '🍫', '🧁', '🍰', '🍯', '🍬', '🍭'], spacecake: ['🧁', '🍰', '🍪', '🍫'], paddo: ['🍄'], shroom: ['🍄'],
	kweek: ['🌱', '🪴', '🌿', '💡', '💧'], grow: ['🌱', '🪴', '🌿', '💧'], chill: ['😎', '✌️', '☮️', '🎶', '🎧', '😴'], peace: ['✌️', '☮️'],
	lit: ['🔥', '💯', '✨'], gram: ['⚖️', '🫙'], pot: ['🫙', '🪴', '🌿'],
	hart: ['❤️'],   // NL-label 'hart' is het orgaan 🫀
};

// emojibase zet vaak een U+FE0F achter een emoji die al emoji-weergave heeft; voor vergelijken telt die niet.
const key = c => String(c).replace(/\uFE0F/g, '');

// Puur deel van loadEmoji (selftest): alleen basis-emoji, geen huidskleur-varianten, geen groep 2 of groeploze letters.
function toEntries(data) {
	return (Array.isArray(data) ? data : [])
		.filter(e => e && typeof e.emoji === 'string' && e.emoji && Number.isInteger(e.group) && e.group !== 2)
		.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
		.map(e => ({ char: e.emoji, label: String(e.label || ''), tags: Array.isArray(e.tags) ? e.tags.map(String) : [], group: e.group }));
}

let cache = null;
export async function loadEmoji() {
	// promise cachen: gelijktijdige aanvragen delen één fetch; bij falen opnieuw proberen mogelijk
	cache ||= fetch(DATA_URL).then(r => {
		if (!r.ok) throw new Error('Emoji laden mislukt (HTTP ' + r.status + ')');
		return r.json();
	}).then(toEntries).catch(e => { cache = null; throw e; });
	return cache;
}

function tokenScore(e, t) {
	const label = fold(e.label), words = label.split(/[\s:,-]+/), tags = e.tags.map(fold);
	if (label === t) return 0;
	if (words.includes(t)) return 1;
	if (tags.includes(t)) return 2;
	if (label.startsWith(t) || words.some(w => w.startsWith(t))) return 3;
	if (tags.some(g => g.startsWith(t))) return 4;
	if (t.length >= 3 && label.includes(t)) return 5;
	if (t.length >= 3 && tags.some(g => g.includes(t))) return 6;
	return -1;
}

function rankEmoji(list, query, limit) {
	const tokens = words(query);
	const seen = new Set(), out = [];
	const add = c => { const k = key(c); if (!seen.has(k) && out.length < limit) { seen.add(k); out.push(c); } };
	if (!tokens.length) { for (const e of list) add(e.char); return out; }
	const hits = [];
	list.forEach((e, i) => {
		let score = 0;
		for (const t of tokens) {
			const alias = Object.hasOwn(ALIASES, t) ? ALIASES[t].findIndex(c => key(c) === key(e.char)) : -1;   // geen 'constructor'
			// alias wint altijd van het label; alias-volgorde = bedoelde volgorde
			const r = tokenScore(e, t), s = alias >= 0 ? alias / 100 : r < 0 ? -1 : r + 1;
			if (s < 0) { score = -1; break; }
			score += s;
		}
		if (score >= 0) hits.push([score, i, e.char]);
	});
	// Gelijke score: korter label eerst ('hart' -> 'wit hart' vóór 'groen hart'), dan emojibase-volgorde.
	hits.sort((a, b) => a[0] - b[0] || list[a[1]].label.length - list[b[1]].label.length || a[1] - b[1]);
	for (const h of hits) add(h[2]);
	return out;
}

export async function searchEmoji(query, limit = 300) {
	return rankEmoji(await loadEmoji(), query, limit);
}

export function recentEmoji() {
	const v = load(RECENT);
	return Array.isArray(v) ? v.filter(c => typeof c === 'string' && c).slice(0, MAX_RECENT) : [];
}

export function pushRecentEmoji(char) {
	if (typeof char !== 'string' || !char) return recentEmoji();
	const list = [char, ...recentEmoji().filter(c => key(c) !== key(char))].slice(0, MAX_RECENT);
	store(RECENT, list);
	return list;
}

export async function selftest() {
	const details = [];
	let ok = true;
	const check = (cond, msg) => { if (!cond) { ok = false; details.push('FOUT: ' + msg); } };
	check(WEED_EMOJI.length >= 40 && new Set(WEED_EMOJI.map(key)).size === WEED_EMOJI.length, 'WEED_EMOJI >= 40 uniek');
	check(WEED_EMOJI.every(c => /\p{Extended_Pictographic}/u.test(c)), 'WEED_EMOJI zijn emoji');
	check(EMOJI_GROUPS.length === 9 && !EMOJI_GROUPS.some(g => g.id === 2) && EMOJI_GROUPS.every(g => g.name), 'groepen zonder 2');
	for (const [k, v] of Object.entries(ALIASES)) check(k === fold(k) && v.length && v.every(c => /\p{Extended_Pictographic}/u.test(c)), 'alias ' + k);

	// vaste mini-dataset in emojibase-vorm (zonder netwerk)
	const raw = [
		{ label: 'kruid', emoji: '🌿', tags: ['blad'], group: 3, order: 3 },
		{ label: 'blad in de wind', emoji: '🍃', tags: ['blad', 'waaiend', 'wind'], group: 3, order: 4 },
		{ label: 'koekje', emoji: '🍪', tags: ['dessert', 'zoet'], group: 4, order: 6 },
		{ label: 'paddenstoel', emoji: '🍄', tags: ['zwam'], group: 3, order: 5 },
		{ label: 'buitenaards wezen', emoji: '👽️', tags: ['ufo', 'wezen'], group: 0, order: 1 },
		{ label: 'café', emoji: '☕️', tags: ['koffie', 'warme drank'], group: 4, order: 7 },
		{ label: 'zwaaiende hand', emoji: '👋', tags: ['hand'], group: 1, order: 2,
			skins: [{ label: 'zwaaiende hand: lichte huidskleur', emoji: '👋🏻', group: 1 }] },
		{ label: 'lichte huidskleur', emoji: '🏻', tags: [], group: 2, order: 0 },
		{ label: 'regionale indicator A', emoji: '🇦', tags: [] },
	];
	const list = toEntries(raw);
	check(list.length === 7 && !list.some(e => e.char === '🏻' || e.char === '🇦' || e.char === '👋🏻'), 'alleen basis-emoji, geen groep 2/skins/groeploos');
	check(list[0].char === '👽️' && list[1].char === '👋', 'volgorde op order');
	check(Object.keys(list[0]).join() === 'char,label,tags,group', 'entry-velden');
	check(toEntries(null).length === 0 && toEntries([null, { emoji: 1 }]).length === 0, 'kapotte data');
	const s = (q, n = 50) => rankEmoji(list, q, n);
	check(s('kruid')[0] === '🌿', 'zoek label');
	check(s('blad').join() === '🍃,🌿', 'labelwoord gaat voor tag');
	check(s('Blad wind').join() === '🍃', 'meerdere woorden = EN');
	check(s('cafe')[0] === '☕️' && s('koffie')[0] === '☕️', 'accenten + tag');
	check(s('weed')[0] === '🌿' && s('weed').includes('🍃'), 'Engelse alias weed');
	check(s('420').length === 5 && s('420')[0] === '🌿', 'alias 420');
	check(s('ufo')[0] === '👽️' && s('high').includes('👽️'), 'alias matcht ook met U+FE0F');
	check(s('xyzzy').length === 0, 'geen treffers');
	check(s(',').join() === s('').join(), 'alleen een komma = lege zoekopdracht');
	let threw = false; try { s('constructor'); s('__proto__'); s('toString'); } catch { threw = true; }
	check(!threw, 'zoeken op prototype-namen gooit niet');
	check(s('').length === 7 && s('', 3).length === 3 && s('blad', 1).length === 1, 'leeg + limit');
	check(s('zw').join() === '👋,🍄', 'prefix: labelwoord voor tag');
	const harts = toEntries([{ label: 'hart', emoji: '🫀', tags: ['orgaan'], group: 1, order: 1 }, { label: 'rood hart', emoji: '❤️', tags: ['hart'], group: 8, order: 2 }]);
	check(rankEmoji(harts, 'hart', 9).join() === '❤️,🫀', 'alias gaat voor exact label');

	// recent: in node met een tijdelijke nep-localStorage; in de browser de echte opslag niet aanraken
	check(Array.isArray(recentEmoji()), 'recentEmoji gooit niet');
	if (typeof localStorage === 'undefined') {
		const mem = {};
		globalThis.localStorage = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); } };
		try {
			pushRecentEmoji('🌿'); pushRecentEmoji('👽'); pushRecentEmoji('👽️'); pushRecentEmoji('');
			check(recentEmoji().join() === '👽️,🌿', 'recent: nieuwste eerst, FE0F-dubbel weg, leeg genegeerd');
			for (let i = 0; i < 60; i++) pushRecentEmoji(String.fromCodePoint(0x1F600 + i));
			check(recentEmoji().length === MAX_RECENT && recentEmoji()[0] === String.fromCodePoint(0x1F600 + 59), 'recent max 40');
			mem[RECENT] = '{kapot';
			check(recentEmoji().length === 0, 'kapotte opslag = leeg');
		} finally { delete globalThis.localStorage; }
		globalThis.localStorage = { getItem: () => { throw new Error('geblokkeerd'); }, setItem: () => { throw new Error('vol'); } };
		try { check(recentEmoji().length === 0 && pushRecentEmoji('🌿').join() === '🌿', 'geblokkeerde opslag gooit niet'); }
		finally { delete globalThis.localStorage; }
	}
	// offline begonnen: de fout mag niet in de cache blijven (alleen node: in de browser de echte CDN niet raken)
	if (typeof document === 'undefined') {
		const real = globalThis.fetch;
		let n = 0;
		globalThis.fetch = async () => ({ ok: ++n > 1, status: n > 1 ? 200 : 503, json: async () => ({}) });
		try {
			cache = null;
			const ok1 = await loadEmoji().then(() => true, () => false), ok2 = await loadEmoji().then(() => true, () => false);
			check(!ok1 && ok2 && n === 2, 'loadEmoji: na mislukte download opnieuw');
		} finally { globalThis.fetch = real; cache = null; }
	}
	details.push(`${WEED_EMOJI.length} wiet-emoji, ${Object.keys(ALIASES).length} aliassen, ${EMOJI_GROUPS.length} groepen`);
	return { ok, details };
}
