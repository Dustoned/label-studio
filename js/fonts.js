// Fontlijst + lazy laden van Google Fonts. Bij import niets met de DOM (node-tests).

const SYS = [['Arial', 'sans'], ['Arial Black', 'display'], ['Verdana', 'sans'], ['Tahoma', 'sans'], ['Trebuchet MS', 'sans'],
	['Segoe UI', 'sans'], ['Georgia', 'serif'], ['Times New Roman', 'serif'], ['Courier New', 'mono'], ['Consolas', 'mono'],
	['Impact', 'display'], ['Comic Sans MS', 'hand']];
// Derde kolom = welke snitten Google echt heeft: iw = 400/700 + cursief, w = alleen 400/700, '' = alleen 400,
// v = variabel gewicht 300..700 (1 bestand per unicode-subset: laden gaat per teken, niet per snit).
// Een snit die niet bestaat slaat css2 stil over (200, alleen de rest): de tabel zelf moet dus kloppen.
const GOO = [['Roboto', 'sans', 'iw'], ['Open Sans', 'sans', 'iw'], ['Montserrat', 'sans', 'iw'], ['Poppins', 'sans', 'iw'],
	['Inter', 'sans', 'iw'], ['Lato', 'sans', 'iw'], ['Nunito', 'sans', 'iw'], ['Oswald', 'sans', 'w'], ['Bebas Neue', 'display', ''],
	['Anton', 'display', ''], ['Archivo Black', 'display', ''], ['Bangers', 'display', ''], ['Black Ops One', 'retro', ''],
	['Righteous', 'retro', ''], ['Fredoka', 'display', 'w'], ['Baloo 2', 'display', 'w'], ['Lobster', 'retro', ''],
	['Pacifico', 'hand', ''], ['Dancing Script', 'hand', 'w'], ['Great Vibes', 'hand', ''], ['Satisfy', 'hand', ''],
	['Caveat', 'hand', 'w'], ['Kalam', 'hand', 'w'], ['Patrick Hand', 'hand', ''], ['Permanent Marker', 'hand', ''],
	['Shadows Into Light', 'hand', ''], ['Indie Flower', 'hand', ''], ['Amatic SC', 'hand', 'w'], ['Playfair Display', 'serif', 'iw'],
	['Merriweather', 'serif', 'iw'], ['Roboto Slab', 'serif', 'w'], ['Abril Fatface', 'serif', ''], ['Cinzel', 'serif', 'w'],
	['Roboto Mono', 'mono', 'iw'], ['Space Mono', 'mono', 'iw'], ['Special Elite', 'retro', ''], ['Press Start 2P', 'retro', ''],
	['VT323', 'retro', ''], ['Orbitron', 'display', 'w'], ['Stardos Stencil', 'retro', 'w'], ['Noto Emoji', 'emoji', 'v']];

export const FONTS = [...SYS.map(([family, category]) => ({ family, category, google: false })),
	...GOO.map(([family, category]) => ({ family, category, google: true }))];
export const FONT_CATEGORIES = { sans: 'Schreefloos', serif: 'Schreef', display: 'Display', hand: 'Handschrift', mono: 'Mono', retro: 'Retro', emoji: 'Emoji' };

// Zonder prototype: een fontnaam als 'constructor' (kapot bestand) is dan geen Google-font.
const AXES = Object.assign(Object.create(null), Object.fromEntries(GOO.map(([f, , a]) => [f, a])));
const AXSPEC = { iw: ':ital,wght@0,400;0,700;1,400;1,700', w: ':wght@400;700', v: ':wght@300..700', '': '' };
const fontUrl = (family, a) => `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}${AXSPEC[a]}&display=swap`;
const sheets = new Map(), pending = new Map(), ready = new Set(), failed = new Set(), listeners = new Set();
// Mislukt laden (offline, netwerkhapering) niet voor de hele sessie onthouden: na RETRY_MS opnieuw aanvragen en de
// luisteraars melden, zodat een nieuwe render het opnieuw probeert (niet elk frame, dat zou elke keer een <link> injecteren).
const RETRY_MS = 15000;
// Sleutel op de snit die echt geladen wordt: vet bij een font zonder 700 = gewoon 400 (render maakt het synthetisch vet).
// Variabel font: gewicht maakt niet uit, wel welke tekens (subset) er geladen zijn.
const norm = (family, bold, italic, text = '') => AXES[family] === 'v' ? `${family}|v|${text}`
	: `${family}|${bold && AXES[family] !== '' ? 1 : 0}${italic && AXES[family] === 'iw' ? 1 : 0}`;

// Welke echte snitten er zijn; render tekent de rest synthetisch. Systeemfonts: browser regelt het.
export function fontFaces(family) {
	if (!(family in AXES)) return { bold: true, italic: true };
	const a = AXES[family];
	return { bold: a !== '', italic: a === 'iw' };
}

// Geeft de <link> (null = mislukt).
function inject(href) {
	return new Promise(res => {
		const l = document.createElement('link');
		l.rel = 'stylesheet'; l.href = href;
		l.onload = () => res(l);
		l.onerror = () => { l.remove(); res(null); };
		document.head.append(l);
	});
}

function sheet(family) {
	if (!sheets.has(family)) sheets.set(family, (async () => { const l = await inject(fontUrl(family, AXES[family])); if (!l) throw new Error('Font niet bereikbaar: ' + family); return l; })());
	return sheets.get(family);
}
// Stylesheet laadde, een fontbestand niet: Chrome laat die FontFace mislukt en load() weigert dan meteen, zonder nieuwe
// download. Dus de hele familie opnieuw (nieuwe <link> = nieuwe FontFaces); ready ook weg, de oude snitten verdwijnen
// met de link. Stylesheet zelf mislukt (offline gestart): l = null, verder hetzelfde. failed blijft tot het lukt: offline
// print dan nog met het vervangfont.
function refetch(family, sp, l) {
	if (sheets.get(family) !== sp) return;   // al opnieuw aangevraagd (andere snit faalde ook)
	l?.remove(); sheets.delete(family);
	for (const k of [...pending.keys()]) if (k.startsWith(family + '|')) pending.delete(k);
	for (const k of [...ready]) if (k.startsWith(family + '|')) ready.delete(k);
	for (const fn of [...listeners]) try { fn(family); } catch {}
}

// text: alleen voor variabele fonts (emoji) nodig, daar laadt de browser per unicode-subset.
export function ensureFont(family, { bold = false, italic = false, text = '' } = {}) {
	if (!(family in AXES) || typeof document === 'undefined') return Promise.resolve();
	const k = norm(family, bold, italic, text), v = AXES[family] === 'v';
	if (!pending.has(k)) {
		const sp = sheet(family), p = sp.then(() => {
			const f = fontFaces(family);
			if (v) return document.fonts.load(`20px "${family}"`, text || ' ');
			return document.fonts.load(`${italic && f.italic ? 'italic ' : ''}${bold && f.bold ? 'bold ' : ''}20px "${family}"`);
		}).then(() => {
			if (pending.get(k) !== p) return;   // familie intussen opnieuw aangevraagd: deze snit hoort bij de weggehaalde link
			ready.add(k); failed.delete(k);
			for (const fn of [...listeners]) try { fn(family); } catch {}
		}).catch(() => { failed.add(k); const retry = l => setTimeout(() => refetch(family, sp, l), RETRY_MS); sp.then(retry, () => retry(null)); });
		pending.set(k, p);
	}
	return pending.get(k);
}

export const fontReady = (family, bold, italic, text = '') => !(family in AXES) || ready.has(norm(family, bold, italic, text));
// Laden is al eens mislukt (offline): render mag dan met het vervangende lettertype printen i.p.v. eeuwig te weigeren.
export const fontFailed = (family, bold, italic, text = '') => failed.has(norm(family, bold, italic, text));

export function onFontLoaded(fn) { listeners.add(fn); return () => listeners.delete(fn); }
// Chrome haalt latin-ext e.d. (Ł, ő) pas bij het tekenen op, buiten ensureFont om: ook dan opnieuw laten tekenen.
if (typeof document !== 'undefined') document.fonts.addEventListener('loadingdone', e => {
	for (const f of new Set(e.fontfaces.map(x => x.family))) for (const fn of [...listeners]) try { fn(f); } catch {}
});

export async function selftest() {
	const details = [];
	let ok = true;
	const chk = (c, m) => { details.push((c ? 'ok ' : 'FAIL ') + m); if (!c) ok = false; };
	const PIN = 'Arial, Arial Black, Verdana, Tahoma, Trebuchet MS, Segoe UI, Georgia, Times New Roman, Courier New, Consolas, Impact, Comic Sans MS, '
		+ 'Roboto, Open Sans, Montserrat, Poppins, Inter, Lato, Nunito, Oswald, Bebas Neue, Anton, Archivo Black, Bangers, Black Ops One, Righteous, '
		+ 'Fredoka, Baloo 2, Lobster, Pacifico, Dancing Script, Great Vibes, Satisfy, Caveat, Kalam, Patrick Hand, Permanent Marker, Shadows Into Light, '
		+ 'Indie Flower, Amatic SC, Playfair Display, Merriweather, Roboto Slab, Abril Fatface, Cinzel, Roboto Mono, Space Mono, Special Elite, '
		+ 'Press Start 2P, VT323, Orbitron, Stardos Stencil, Noto Emoji';
	chk(FONTS.map(f => f.family).join(', ') === PIN, 'FONTS = pinned lijst (volgorde)');
	chk(FONTS.filter(f => f.google).length === 41 && FONTS.filter(f => !f.google).length === 12, '41 Google + 12 systeem');
	chk(JSON.stringify(FONTS.find(f => f.family === 'Noto Emoji')) === '{"family":"Noto Emoji","category":"emoji","google":true}' && FONT_CATEGORIES.emoji === 'Emoji', 'Noto Emoji in categorie emoji');
	chk(FONTS.every(f => f.category in FONT_CATEGORIES), 'categorieen geldig');
	chk(Object.keys(FONT_CATEGORIES).every(c => FONTS.some(f => f.category === c)), 'elke categorie gevuld');
	chk(fontUrl('Roboto', 'iw') === 'https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,400;0,700;1,400;1,700&display=swap', 'url ital,wght');
	chk(fontUrl('Bebas Neue', '') === 'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap', 'url zonder as');
	chk(fontUrl('Baloo 2', 'w') === 'https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;700&display=swap', 'url wght');
	chk(fontUrl('Noto Emoji', 'v') === 'https://fonts.googleapis.com/css2?family=Noto+Emoji:wght@300..700&display=swap', 'url variabel gewicht');
	const f = n => JSON.stringify(fontFaces(n));
	chk(f('Arial') === '{"bold":true,"italic":true}' && f('Inter') === f('Arial') && f('Pacifico') === '{"bold":false,"italic":false}' && f('Oswald') === '{"bold":true,"italic":false}', 'snitten per familie');
	chk(fontReady('Arial', true, true) && fontReady('Onbekend', false, false), 'systeemfont meteen klaar');
	chk(f('constructor') === f('Arial') && fontReady('toString', false, false), 'naam van Object.prototype = geen Google-font');
	chk(norm('Pacifico', true, true) === norm('Pacifico', false, false), 'vet zonder 700 = 400-sleutel');
	chk(norm('Noto Emoji', true, false, 'x') === norm('Noto Emoji', false, false, 'x') && norm('Noto Emoji', false, false, 'x') !== norm('Noto Emoji', false, false, 'y'), 'emoji-sleutel per teken, niet per gewicht');
	chk(f('Noto Emoji') === '{"bold":true,"italic":false}' && !fontReady('Noto Emoji', false, false, 'x'), 'emoji: gewicht echt, pas klaar na laden');
	if (typeof document !== 'undefined' && typeof FontFaceSetLoadEvent === 'function') {
		let got = null;
		const off = onFontLoaded(fam => { got = fam; });
		document.fonts.dispatchEvent(new FontFaceSetLoadEvent('loadingdone', { fontfaces: [new FontFace('Selftest', 'local(Arial)')] }));
		off();
		chk(got === 'Selftest', 'loadingdone (latin-ext buiten ensureFont om) meldt de familie');
	}
	// Herstel na een mislukte fontdownload (alleen in node: document en timers gestubd, 1e load faalt). Zonder dit printte
	// de app na een netwerkhapering stil de hele sessie met het vervangfont.
	if (typeof document === 'undefined') {
		const st = setTimeout, timers = [], links = [], F = 'Lobster';
		const done = p => Promise.race([p, new Promise(r => st(r, 1000))]).then(() => new Promise(r => st(r, 0)));   // nooit hangen
		let loads = 0, removed = 0, offline = false;
		globalThis.document = { head: { append: l => { links.push(l); queueMicrotask(() => offline ? l.onerror() : l.onload()); } }, createElement: () => ({ remove: () => removed++ }),
			fonts: { load: () => ++loads > 1 ? Promise.resolve() : Promise.reject(new Error('net')) } };
		globalThis.setTimeout = fn => timers.push(fn);
		try {
			await done(ensureFont(F));
			const f1 = fontFailed(F, false, false) && !fontReady(F, false, false);
			timers.splice(0).forEach(fn => fn());
			await done(ensureFont(F));
			chk(f1 && fontReady(F, false, false) && !fontFailed(F, false, false) && loads === 2 && links.length === 2 && removed === 1,
				`mislukte fontdownload: na RETRY_MS opnieuw en dan klaar (${loads} loads, ${links.length} links, ${removed} weg)`);
			// Offline gestart: de stylesheet zelf faalt. Na RETRY_MS een melding (nieuwe render), weer online dan klaar.
			const G = 'Pacifico';
			let heard = 0;
			const off = onFontLoaded(f => { heard += f === G; });
			offline = true; links.length = 0;
			await done(ensureFont(G));
			const g1 = fontFailed(G, false, false) && !fontReady(G, false, false) && !heard;
			offline = false; timers.splice(0).forEach(fn => fn());
			const g2 = heard;
			await done(ensureFont(G));
			off();
			chk(g1 && g2 === 1 && fontReady(G, false, false) && !fontFailed(G, false, false) && links.length === 2 && heard === 2,
				`offline gestart: na RETRY_MS gemeld en opnieuw, dan klaar (${g2} melding, ${links.length} links, ${heard} meldingen)`);
			// 2 snitten: gewoon lukt, vet faalt 1x. Opnieuw ophalen haalt de link weg, dus ook de gewone snit is dan niet meer
			// klaar; anders tekent en print render die stil met het vervangfont.
			const O = 'Oswald';
			let bf = 0;
			document.fonts.load = s => s.startsWith('bold') && !bf++ ? Promise.reject(new Error('net')) : Promise.resolve();
			await done(ensureFont(O));
			await done(ensureFont(O, { bold: true }));
			const o1 = fontReady(O, false, false) && fontFailed(O, true, false);
			timers.splice(0).forEach(fn => fn());
			chk(o1 && !fontReady(O, false, false), 'familie met 2 snitten: vet mislukt = na RETRY_MS ook de gewone snit opnieuw laden');
		} finally { delete globalThis.document; globalThis.setTimeout = st; for (const m of [sheets, pending, ready, failed]) m.clear(); }
	}
	return { ok, details };
}
