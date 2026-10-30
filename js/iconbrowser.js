// Online-iconen bladeren zoals Icônes: alle zwart-wit-collecties van Iconify, raster per collectie, favorieten.
// Niets met de DOM op module-niveau (node importeert dit voor selftest); DOM pas in createCollections().
// ui laadt deze module pas dynamisch, dus de statische import van ui.js (iconen) is geen laadkring.
import { debounce, fold, words, h, setText } from './util.js';
import { iconifyUrl, svgFor, svgUrl, PART_RE, ICONIFY } from './icons.js';
import { ic, hscroll } from './ui.js';

const FAV_KEY = 'pm110.v2.iconfav', BLOCK = 300, SAMPLES = 6;
const FAIL_MSG = 'Laden mislukt. Ben je online?';

// ---------- pure delen (node-testbaar) ----------
const part = s => { if (!PART_RE.test(String(s))) throw new Error('Ongeldige Iconify-naam: ' + s); return s; };
const collectionsUrl = () => `${ICONIFY}/collections`;
const collectionUrl = p => `${ICONIFY}/collection?prefix=${part(p)}&info=true`;
const nl = n => Number.isFinite(+n) ? (+n).toLocaleString('nl-NL') : '';
const licTitle = c => c?.license?.title || c?.license?.spdx || '';

// Kleurcollecties (palette:true, emoji) dither je niet netjes naar zwart; hidden = verouderd bij Iconify.
function monoCollections(json) {
	const out = [];
	for (const [prefix, c] of Object.entries(json && typeof json === 'object' ? json : {}))
		if (c && c.palette === false && !c.hidden && PART_RE.test(prefix))
			out.push({ ...c, prefix, samples: (Array.isArray(c.samples) ? c.samples : []).filter(s => PART_RE.test(s)).slice(0, SAMPLES) });
	return out;
}
// Volgorde van de API blijft (Material, UI 24px, ...); een categorie die later terugkomt valt in de eerste groep.
function groupByCategory(list) {
	const m = new Map();
	for (const c of list) { const k = c.category || 'Overig'; if (!m.has(k)) m.set(k, []); m.get(k).push(c); }
	return [...m];
}
// Categorieën overlappen (mdi: 9032 vermeldingen, 7447 iconen), dus 'Alle' = de unieke lijst. hidden = oude namen.
function unpackCollection(json) {
	const hidden = new Set(Array.isArray(json?.hidden) ? json.hidden : []), all = new Set(), cats = [];
	const keep = list => (Array.isArray(list) ? list : []).filter(n => typeof n === 'string' && PART_RE.test(n) && !hidden.has(n));
	const obj = v => v && typeof v === 'object' ? v : {};
	for (const [name, list] of Object.entries(obj(json?.categories))) {
		const names = keep(list);
		if (names.length) { cats.push([name, names]); for (const n of names) all.add(n); }
	}
	for (const n of keep(json?.uncategorized)) all.add(n);
	const aliases = Object.entries(obj(json?.aliases)).filter(([a, p]) => typeof p === 'string' && PART_RE.test(a) && all.has(p));
	return { names: [...all].sort(), cats, aliases };
}
// /search?prefix= matcht (gemeten) alleen op namen en aliassen: lokaal geeft hetzelfde, direct, offline en zonder 429.
function filterNames(names, aliases, q) {
	const t = words(q);
	if (!t.length) return names;
	const hit = n => t.every(x => n.includes(x)), out = names.filter(hit), seen = new Set(out), base = new Set(names);
	for (const [a, p] of aliases) if (!seen.has(p) && base.has(p) && hit(a)) { seen.add(p); out.push(p); }
	// exacte naam eerst (woorden met '-' ertussen), dan namen die met het eerste woord beginnen
	const rank = n => n === t.join('-') ? 0 : n.startsWith(t[0]) ? 1 : 2;
	return out.sort((a, b) => rank(a) - rank(b));
}

// Opslag injecteerbaar voor selftest; localStorage kan ontbreken of gooien (privévenster, geblokkeerd).
function readFavs(st) {
	try {
		st ??= globalThis.localStorage;
		const v = JSON.parse(st.getItem(FAV_KEY));
		return Array.isArray(v) ? [...new Set(v.filter(p => typeof p === 'string' && PART_RE.test(p)))] : [];
	} catch { return []; }
}
function writeFavs(list, st) { try { (st ?? globalThis.localStorage).setItem(FAV_KEY, JSON.stringify(list)); return true; } catch { return false; } }
const toggleFav = (list, p) => list.includes(p) ? list.filter(x => x !== p) : [...list, p];

// ---------- netwerk ----------
const cache = new Map();
// Promise cachen: heen-en-weer haalt niets opnieuw op; bij falen weer weg, zodat 'Opnieuw' echt opnieuw vraagt.
function getJSON(url, then = j => j) {
	if (!cache.has(url)) cache.set(url, fetch(url).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(then)
		.catch(e => { cache.delete(url); throw e; }));
	return cache.get(url);
}

export async function licenseOf(prefix) {
	try {
		const all = await getJSON(collectionsUrl()), c = all && Object.hasOwn(all, prefix) ? all[prefix] : null;
		return c ? { title: c.name || prefix, license: c.license || null, author: c.author || null } : null;
	} catch { return null; }
}

// ---------- DOM ----------
const press = (el, on) => el.setAttribute('aria-pressed', String(!!on));
const starBtn = onclick => h('button', { type: 'button', class: 'btn ghost ib sm ibr-star', title: 'Favoriet', 'aria-label': 'Favoriet', 'aria-pressed': 'false', onclick }, ic('star', 16));

// Lijst en raster worden 1× gebouwd; wisselen = hidden, een andere collectie hergebruikt de cellen en chips.
export function createCollections(root, { onPick, toast }) {
	let favs = readFavs(), recs = null, cur = null, data = null, catIdx = 0, list = [], shown = 0, seq = 0, lastRow = null;
	const byPrefix = new Map(), byRow = new WeakMap(), secs = [];

	// ---- lijst van collecties
	const lq = h('input', { type: 'search', placeholder: 'Zoek collectie…', 'aria-label': 'Collecties zoeken' });
	lq.addEventListener('input', debounce(() => filterList(), 120));
	const lmsg = h('p', { class: 'hint center', role: 'status' }), lretry = h('button', { type: 'button', class: 'btn sm', hidden: true, onclick: () => loadList() }, 'Opnieuw');
	const favBox = h('div'), favSec = h('section', { class: 'dsec', hidden: true }, h('h3', {}, 'Favorieten'), favBox);
	secs.push({ sec: favSec, box: favBox });
	const cats = h('div');
	const listV = h('div', {}, h('section', { class: 'dsec' }, h('div', { class: 'searchbox' }, ic('search', 16), lq), h('div', { class: 'ibr-state' }, lmsg, lretry)), favSec, cats);
	// Voorbeeld-iconen pas maken als een rij in beeld komt: 188 rijen × 6 = 1100+ img's die niemand ziet.
	const io = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) { io.unobserve(e.target); fillSamples(byRow.get(e.target)); } });

	// ---- één collectie
	const back = h('button', { type: 'button', class: 'btn ghost ib sm', title: 'Terug naar collecties', 'aria-label': 'Terug naar collecties', onclick: () => showList() }, ic('chevL', 16));
	const title = h('h3', { class: 'ibr-title' }), favBtn = starBtn(() => cur && toggle(cur.c.prefix));
	const count = h('span'), lic = h('a', { target: '_blank', rel: 'noopener noreferrer' }), by = h('span');
	const cq = h('input', { type: 'search', placeholder: 'Filter op naam…', 'aria-label': 'Iconen filteren' });
	cq.addEventListener('input', debounce(() => apply(), 120));
	const chipRow = hscroll(h('div', { class: 'chips', hidden: true })), chips = [];
	const cmsg = h('p', { class: 'hint center', role: 'status' }), cretry = h('button', { type: 'button', class: 'btn sm', hidden: true, onclick: () => retry() }, 'Opnieuw');
	const grid = h('div', { class: 'icon-grid' }), cells = [];
	grid.addEventListener('click', e => { const b = e.target.closest('.icon-cell'); if (b?.dataset.id) pick(b.dataset.id); });
	const more = h('button', { type: 'button', class: 'btn sm ibr-more', hidden: true, onclick: () => {
		// laatste blok: de knop verbergt zichzelf, focus dan naar het eerste nieuwe icoon i.p.v. <body>
		const had = document.activeElement === more, n0 = shown;
		shown += BLOCK; paint();
		if (had && more.hidden) cells[n0]?.b.focus({ preventScroll: true });
	} });
	const head = h('div', { class: 'ibr-head' }, back, title, favBtn);
	const colV = h('section', { class: 'dsec', hidden: true }, head, h('p', { class: 'hint ibr-sub' }, count, lic, by),
		h('div', { class: 'searchbox' }, ic('search', 16), cq), chipRow, h('div', { class: 'ibr-state' }, cmsg, cretry), grid, more);

	const wrap = h('div', { hidden: true }, listV, colV);
	root.append(wrap);

	async function loadList() {
		if (recs) return;
		if (document.activeElement === lretry) lq.focus({ preventScroll: true });   // Opnieuw verdwijnt: focus niet naar <body>
		lretry.hidden = true; setText(lmsg, 'Laden…');
		let json;
		try { json = await getJSON(collectionsUrl()); } catch { setText(lmsg, FAIL_MSG); lretry.hidden = false; return; }
		if (recs) return;   // tweede show() tijdens het laden
		buildRows(monoCollections(json));
		lq.placeholder = `Zoek in ${recs.length} collecties…`;
		filterList();
	}
	function buildRows(all) {
		recs = [];
		for (const [cat, items] of groupByCategory(all)) {
			const box = h('div');
			cats.append(h('section', { class: 'dsec' }, h('h3', {}, cat), box));
			secs.push({ sec: box.parentNode, box });
			for (const c of items) {
				const rec = { c, hay: fold((c.name || c.prefix) + ' ' + c.prefix) };
				({ row: rec.row, star: rec.star } = makeRow(rec));
				box.append(rec.row);
				recs.push(rec); byPrefix.set(c.prefix, rec);
			}
		}
		for (const p of favs) { const r = byPrefix.get(p); if (r) { r.fav = makeRow(r); favBox.append(r.fav.row); press(r.star, true); press(r.fav.star, true); } }
	}
	// Eén rij = knop + voorbeelden + ster. Een favoriet krijgt een tweede rij onder Favorieten; de eigen rij blijft staan
	// (verhuizen schoof een andere collectie onder de muis, en de tweede klik zette die dan als favoriet).
	// De licentiekolom toont de korte code (MPL-2.0 i.p.v. Mozilla Public License 2.0); de volledige naam staat in de tooltip.
	function makeRow(rec) {
		const c = rec.c, name = c.name || c.prefix, samples = h('span', { class: 'ibr-samples' }), v = { rec, samples, filled: false };
		const open = h('button', { type: 'button', class: 'ibr-open', title: [name, c.author?.name, licTitle(c)].filter(Boolean).join(' · '), onclick: () => openCol(rec, v.row) },
			h('span', { class: 'ibr-name' }, name), h('span', { class: 'ibr-n' }, nl(c.total)), samples, h('span', { class: 'ibr-lic' }, c.license?.spdx || licTitle(c)));
		v.star = starBtn(() => toggle(c.prefix));
		v.row = h('div', { class: 'ibr-row' }, open, v.star);
		byRow.set(v.row, v); io.observe(v.row);
		return v;
	}
	function fillSamples(v) {
		if (!v || v.filled) return;
		v.filled = true;
		const c = v.rec.c;
		for (const s of c.samples) {
			const img = h('img', { alt: '', width: 18, height: 18, decoding: 'async', hidden: true }), id = c.prefix + ':' + s;
			const show = src => { img.src = src; img.hidden = false; };
			v.samples.append(img);
			svgFor(c.prefix, s).then(svg => show(svg ? svgUrl(svg) : iconifyUrl(id)), () => show(iconifyUrl(id)));
		}
	}
	function filterList() {
		if (!recs) return;
		const t = words(lq.value);
		for (const r of recs) { r.row.hidden = !t.every(x => r.hay.includes(x)); if (r.fav) r.fav.row.hidden = r.row.hidden; }
		let any = false;
		for (const s of secs) { s.sec.hidden = ![...s.box.children].some(r => !r.hidden); any ||= !s.sec.hidden; }
		setText(lmsg, any ? '' : 'Geen collectie gevonden.');
	}
	function toggle(p) {
		favs = toggleFav(readFavs(), p);   // vers lezen: een ander venster kan intussen een ster gezet hebben
		if (!writeFavs(favs)) toast('Favoriet niet bewaard: opslag vol.', 'warn');
		const rec = byPrefix.get(p), on = favs.includes(p), y0 = rec?.row.getBoundingClientRect().top;
		if (rec) {
			if (on) { rec.fav ||= makeRow(rec); favBox.append(rec.fav.row); }
			else {
				// de rij met de focus verdwijnt: focus naar de ster van de eigen rij, anders valt hij naar <body>
				if (rec.fav?.row.contains(document.activeElement)) rec.star.focus({ preventScroll: true });
				rec.fav?.row.remove();
			}
			press(rec.star, on); if (rec.fav) press(rec.fav.star, on);
		}
		if (cur?.c.prefix === p) press(favBtn, on);
		filterList();
		// De Favorieten-sectie erboven groeit of krimpt: scroll mee, zodat de eigen rij onder de muis blijft.
		const sc = rec && scroller(rec.row), dy = rec && !listV.hidden ? rec.row.getBoundingClientRect().top - y0 : 0;
		if (sc && dy) sc.scrollTop += dy;
	}
	const scroller = el => { for (let e = el.parentElement; e; e = e.parentElement) if (e.scrollHeight > e.clientHeight && /auto|scroll/.test(getComputedStyle(e).overflowY)) return e; return null; };

	async function openCol(rec, row = rec.row) {
		const my = ++seq, c = rec.c, L = c.license || {};
		cur = rec; lastRow = row; data = null; catIdx = 0; cq.value = '';
		listV.hidden = true; colV.hidden = false;
		setText(title, c.name || c.prefix); press(favBtn, favs.includes(c.prefix));
		setText(count, `${nl(c.total)} iconen · `); setText(lic, licTitle(c) || 'Licentie onbekend'); setText(by, c.author?.name ? ' · ' + c.author.name : '');
		if (/^https:\/\//.test(L.url || '')) lic.href = L.url; else lic.removeAttribute('href');
		chipRow.hidden = true; list = []; paint(); cretry.hidden = true; setText(cmsg, 'Laden…');
		head.scrollIntoView({ block: 'nearest' }); back.focus({ preventScroll: true });
		let d;
		try { d = await getJSON(collectionUrl(c.prefix), unpackCollection); }
		catch { if (my === seq) { setText(cmsg, FAIL_MSG); cretry.hidden = false; } return; }
		if (my !== seq) return;
		data = d;
		const names = ['Alle', ...d.cats.map(x => x[0])];
		while (chips.length < names.length) {
			const i = chips.length, b = h('button', { type: 'button', class: 'chip', 'aria-pressed': 'false', onclick: () => { catIdx = i; apply(); } });
			chips.push(b); chipRow.append(b);
		}
		chips.forEach((b, i) => { b.hidden = i >= names.length; if (i < names.length) setText(b, names[i]); });
		chipRow.hidden = names.length < 2; chipRow.scrollLeft = 0;
		apply();
	}
	function apply() {
		if (!data) return;
		list = filterNames(catIdx ? data.cats[catIdx - 1][1] : data.names, data.aliases, cq.value); shown = BLOCK;
		chips.forEach((b, i) => press(b, i === catIdx));
		paint();
		setText(cmsg, list.length ? '' : 'Niets gevonden.');
	}
	// Blokken van 300: nooit duizenden img-nodes tegelijk; cellen blijven in de pool voor de volgende collectie.
	function paint() {
		const n = Math.min(list.length, shown), p = cur?.c.prefix;
		while (cells.length < n) {
			const img = h('img', { alt: '', width: 26, height: 26, decoding: 'async' }), b = h('button', { type: 'button', class: 'icon-cell' }, img);
			grid.append(b); cells.push({ b, img, key: '' });
		}
		cells.forEach((c, i) => {
			c.b.hidden = i >= n;
			// verborgen cel laat zijn svg los: Chrome houdt elk svg-plaatje als eigen document vast (~120 MB na wat 'Meer laden')
			if (i >= n) { c.key = ''; c.img.removeAttribute('src'); return; }
			const id = p + ':' + list[i];
			if (c.key === id) return;
			c.key = id; c.b.dataset.id = id; c.b.title = list[i]; c.b.setAttribute('aria-label', 'Icoon ' + list[i]);
			// verbergen tot de nieuwe svg er is: src weghalen toont in Chrome een kapot-plaatje-icoon
			c.img.hidden = true;
			svgFor(p, list[i]).then(svg => { if (c.key === id) { c.img.src = svg ? svgUrl(svg) : iconifyUrl(id); c.img.hidden = false; } },
				() => { if (c.key !== id) return; c.key = ''; setText(cmsg, FAIL_MSG); cretry.hidden = false; });
		});
		more.hidden = list.length <= n;
		setText(more, `Meer laden (${nl(list.length - n)})`);
	}
	async function pick(id) {
		const c = cur?.c;
		if (!c) return;
		const meta = { title: c.name || c.prefix, license: c.license || null, author: c.author || null };
		try { await onPick(id, meta); } catch { toast('Icoon invoegen mislukt.', 'err'); }
	}
	// Opnieuw: alleen het mislukte opnieuw vragen (mislukte cellen hebben key ''); filter en categorie blijven staan.
	function retry() {
		if (!cur) return;
		if (!data) return openCol(cur, lastRow);
		cretry.hidden = true; if (list.length) setText(cmsg, ''); paint(); back.focus({ preventScroll: true });
	}
	function showList() {
		// favoriet uit in de kop: de Favorieten-rij is weg, dan terug naar de eigen rij
		const r = lastRow?.isConnected ? lastRow : cur?.row;
		// data weg: een nog lopende filter-debounce stopt dan in apply() i.p.v. 'undefined:'-iconen op te vragen
		++seq; cur = null; data = null;
		colV.hidden = true; listV.hidden = false;
		r?.scrollIntoView({ block: 'nearest' }); r?.querySelector('.ibr-open').focus({ preventScroll: true });
	}

	return {
		show() { wrap.hidden = false; loadList(); },
		hide() { wrap.hidden = true; },
	};
}

export function selftest() {
	const details = [];
	let ok = true;
	const check = (cond, msg) => { if (!cond) { ok = false; details.push('FOUT: ' + msg); } };
	const cols = {
		mdi: { name: 'Material Design Icons', total: 7447, palette: false, category: 'Material', samples: ['account', 'Bad', 'home'], license: { title: 'Apache 2.0', spdx: 'Apache-2.0' } },
		twemoji: { name: 'Twemoji', palette: true, category: 'Emoji' }, old: { name: 'Oud', palette: false, hidden: true }, nopal: { name: 'Zonder palette' },
		tabler: { name: 'Tabler', palette: false, category: 'UI 24px' }, 'game-icons': { name: 'Game Icons', palette: false }, 'Bad Prefix': { palette: false },
		ph: { name: 'Phosphor', palette: false, category: 'Material' },
	};
	const mono = monoCollections(cols);
	check(mono.map(c => c.prefix).join() === 'mdi,tabler,game-icons,ph', 'filter palette:false (kleur, hidden, zonder palette, rare prefix weg)');
	check(mono[0].samples.join() === 'account,home' && licTitle(mono[0]) === 'Apache 2.0', 'samples gefilterd, licentie');
	check(groupByCategory(mono).map(([k, v]) => k + ':' + v.length).join() === 'Material:2,UI 24px:1,Overig:1', 'groeperen op categorie');
	check(monoCollections(null).length === 0 && monoCollections('x').length === 0, 'kapotte collections-respons');
	const u = unpackCollection({ uncategorized: ['zz', 'leaf', 'old-name'], categories: { Natuur: ['leaf', 'tree', 'old-name'], Leeg: ['old-name'], Raar: ['Bad Name', 5] },
		hidden: ['old-name'], aliases: { weed: 'cannabis', boom: 'tree', 'x y': 'tree', kapot: { parent: 'tree' } } });
	check(u.names.join() === 'leaf,tree,zz', 'unieke namen, gesorteerd, hidden en ongeldige weg');
	check(u.cats.map(c => c[0] + ':' + c[1].join('+')).join() === 'Natuur:leaf+tree', 'categorieën zonder hidden/lege');
	check(u.aliases.map(a => a.join('>')).join() === 'boom>tree', 'aliassen alleen naar bestaande iconen');
	check(unpackCollection(null).names.length === 0 && unpackCollection({ categories: 'x' }).cats.length === 0, 'kapotte collectie-respons');
	check(filterNames(u.names, u.aliases, ' ') === u.names, 'leeg filter = alles');
	check(filterNames(u.names, u.aliases, 'BOOM').join() === 'tree', 'filter via alias, hoofdletterongevoelig');
	check(filterNames(['canadian-maple-leaf', 'leaf', 'leaf-off'], [], 'leaf').join() === 'leaf,leaf-off,canadian-maple-leaf', 'filter-rangorde');
	check(filterNames(['leaf-off', 'leaf'], [], 'leaf off').join() === 'leaf-off', 'meerdere woorden');
	check(filterNames(['leaf-maple-off', 'leaf-off'], [], 'leaf off').join() === 'leaf-off,leaf-maple-off', 'exacte naam van meerdere woorden eerst');
	const mem = init => { const m = new Map(init); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), m }; };
	const st = mem();
	check(readFavs(st).length === 0, 'geen favorieten');
	writeFavs(toggleFav(toggleFav(readFavs(st), 'mdi'), 'tabler'), st);
	check(readFavs(st).join() === 'mdi,tabler' && st.m.get(FAV_KEY) === '["mdi","tabler"]', 'favoriet aan + opslaan');
	writeFavs(toggleFav(readFavs(st), 'mdi'), st);
	check(readFavs(st).join() === 'tabler', 'favoriet uit');
	check(readFavs(mem([[FAV_KEY, '{kapot']])).length === 0 && readFavs(mem([[FAV_KEY, '{"a":1}']])).length === 0, 'kapotte opslag');
	check(readFavs(mem([[FAV_KEY, '["mdi","mdi","../x",5,"ph"]']])).join() === 'mdi,ph', 'ongeldige/dubbele favorieten weg');
	const boom = { getItem() { throw new Error('geblokkeerd'); }, setItem() { throw new Error('vol'); } };
	check(readFavs(boom).length === 0 && writeFavs(['mdi'], boom) === false, 'opslag die gooit');
	check(collectionsUrl() === 'https://api.iconify.design/collections', 'collections-URL');
	check(collectionUrl('game-icons') === 'https://api.iconify.design/collection?prefix=game-icons&info=true', 'collectie-URL');
	for (const bad of ['', 'a/b', '../x', 'A', 'a&b=1', 'x y', '__proto__']) {
		let threw = false;
		try { collectionUrl(bad); } catch { threw = true; }
		check(threw, 'ongeldige prefix geweigerd: ' + bad);
	}
	details.push(`${mono.length} nep-collecties, ${u.names.length} nep-iconen`);
	return { ok, details };
}
