// Zwevende mini-werkbalk boven de selectie (zoals Figma/Canva): alleen de meest gebruikte acties, de rest via '...'.
// Bij import geen DOM (node-selftest): alles pas in createMinibar(). place/toHost/nextSize/visibleFor/roveTo zijn puur.
import { DPM, clamp } from './util.js';
import { span as union } from './doc.js';
import { iconSvg } from './ui.js';

// CSS-px. GAP_ROT houdt de rotatie-handle van de editor vrij (24 px buiten de box + straal 6).
const PAD = 8, GAP = 10, GAP_ROT = 38;
const SIZE_MIN = 0.5, SIZE_MAX = 150;

// Knop -> ui-icoon (zelfde set en lijndikte als de rest van de app); de andere sleutels heten in ui.js hetzelfde.
const ICON = { left: 'txL', center: 'txC', right: 'txR', middle: 'cenB', fill: 'expand' };

// [sleutel/icoon, tooltip, type (null = altijd), muteert]. Muterende knoppen verdwijnen bij een geheel vergrendelde selectie.
// Tooltips noemen de actie: 'Links uitlijnen' deed hier iets anders (tekst) dan in Bewerken > Uitlijnen (box verplaatsen).
const BTNS = [
	['smaller', 'Kleiner', 'text', true], ['bigger', 'Groter', 'text', true], ['bold', 'Vet', 'text', true],
	['left', 'Tekst links', 'text', true], ['center', 'Tekst midden', 'text', true], ['right', 'Tekst rechts', 'text', true],
	['image', 'Varianten', 'image', false], ['qr', 'Code bewerken', 'qr', false], ['barcode', 'Code bewerken', 'barcode', false],
	['middle', 'Midden op label', null, true], ['fill', 'Vul het label', null, true], ['dup', 'Dupliceren', null, false],
	['trash', 'Verwijderen', null, true], ['more', 'Meer opties', null, false],
];

// Zichtbare knoppen voor een selectie: typeknoppen alleen als alles hetzelfde type is.
function visibleFor(list) {
	const type = list.length && list.every(e => e.type === list[0].type) ? list[0].type : null, locked = !list.some(e => !e.locked);
	return BTNS.filter(([, , t, mut]) => (!t || t === type) && !(mut && locked)).map(b => b[0]);
}

// mm-omhullende -> host-px. Schaal zoals de editor: CSS-breedte van #view / (labelbreedte in hele dots / DPM).
function toHost(a, vr, hr, labelW) {
	const ppm = vr.width / (Math.round(labelW * DPM) / DPM || 1);
	return { x: vr.left - hr.left + a.x * ppm, y: vr.top - hr.top + a.y * ppm, w: a.w * ppm, h: a.h * ppm };
}

// Overlap-oppervlak van rechthoek a met de lijst rs.
const overlap = (a, rs) => rs.reduce((t, r) => t + Math.max(0, Math.min(a.x + a.w, r.x + r.w) - Math.max(a.x, r.x)) * Math.max(0, Math.min(a.y + a.h, r.y + r.h) - Math.max(a.y, r.y)), 0);
// Balk (bw×bh) boven selectie s, gecentreerd. B = zichtbaar vlak (buiten beeld = null), O = waarbinnen de balk mag (standaard
// B; de integrator geeft bovenin de stage-marge erbij). Boven heeft voorrang, maar dekt hij daar een ander element (obst) af
// en onder niet, dan eronder; overal overlap = de minste. Past hij nergens, dan bovenin vastgeklemd.
function place(s, bw, bh, B, gap = GAP, pad = PAD, O = B, obst = []) {
	if (s.x + s.w < B.x || s.x > B.x + B.w || s.y + s.h < B.y || s.y > B.y + B.h) return null;
	const x = clamp(s.x + s.w / 2 - bw / 2, O.x + pad, Math.max(O.x + pad, O.x + O.w - pad - bw));
	const top = O.y + pad, bot = O.y + O.h - pad, cands = [];
	if (s.y - gap - bh >= top) cands.push({ y: s.y - gap - bh });
	if (s.y + s.h + gap + bh <= bot) cands.push({ y: s.y + s.h + gap });
	if (!cands.length) return { x, y: clamp(s.y - gap - bh, top, Math.max(top, bot - bh)) };
	let best = null;
	for (const c of cands) { c.o = overlap({ x, y: c.y, w: bw, h: bh }, obst); if (!best || c.o < best.o) best = c; }
	return { x, y: best.y };
}

// Toolbar-toetsen (WAI-ARIA): pijltjes = vorige/volgende zichtbare knop (rondom), Home/End = eerste/laatste; -1 = geen van deze.
const roveTo = (i, n, key) => i < 0 || !n ? -1 : key === 'ArrowRight' ? (i + 1) % n : key === 'ArrowLeft' ? (i - 1 + n) % n : key === 'Home' ? 0 : key === 'End' ? n - 1 : -1;

// ±10% per klik (gelijke stap voor het oog), minstens 0,1 mm, afgerond op 0,1 zoals de Grootte-schuif.
const nextSize = (s, dir) => clamp(Math.round((dir > 0 ? Math.max(s * 1.1, s + 0.1) : Math.min(s / 1.1, s - 0.1)) * 10) / 10, SIZE_MIN, SIZE_MAX);

// Kleiner/Groter -> { size, fit }. Automatische grootte: vanaf wat je ziet (sizeOf). Past de nieuwe maat in de box, dan
// Krimpen (lange lijstwaarden worden nog kleiner), anders Vrij (expliciet groter, mag buiten de box).
function sizeStep(e, dir, sizeOf) {
	if (e.fit !== 'shrink' && e.fit !== 'fill') return { size: nextSize(+e.size || SIZE_MIN, dir), fit: e.fit };
	const size = nextSize(sizeOf(e), dir);
	return { size, fit: sizeOf({ ...e, size, fit: 'shrink' }) < size - 0.05 ? 'none' : 'shrink' };
}

// Grenzen B min een paneel dat er (smal scherm) overheen ligt: de balk blijft in het vrije deel ernaast. a in host-px.
function clip(B, a) {
	if (!a || !(a.w > 0) || a.x >= B.x + B.w || a.x + a.w <= B.x) return B;
	const left = a.x - B.x, right = B.x + B.w - (a.x + a.w);
	return left >= right ? { ...B, w: Math.max(0, left) } : { ...B, x: a.x + a.w, w: Math.max(0, right) };
}

// avoid = element dat over de host kan liggen (het zijpaneel op een smal scherm).
// onMenu(ids, x, y, top) = elementmenu onder 'Meer opties'; sizeOf(el) = getekende tekstmaat in mm bij
// Passen = Krimpen/Groeien (anders veranderden Kleiner/Groter niets zichtbaars).
export function createMinibar({ host, view, app, getBoxes, onOpen, avoid, onMenu, sizeOf }) {
	const d = host.ownerDocument, win = d.defaultView, overlay = host.querySelector('#overlay'), sc = view.closest('.stage-scroll');
	const bar = d.createElement('div');
	bar.className = 'minibar';
	bar.hidden = true;
	bar.setAttribute('role', 'toolbar');
	bar.setAttribute('aria-label', 'Snelle acties');
	bar.setAttribute('aria-keyshortcuts', 'Alt+F10');
	let raf = 0, drag = false, sig = '', bw = 0, bh = 0, tf = '';

	const sel = () => app.selected();
	const free = () => sel().filter(e => !e.locked);
	const ids = list => list.map(e => e.id);
	const texts = () => free().filter(e => e.type === 'text');
	const put = (e, k, v) => e[k] !== v && ((e[k] = v), true);
	// Elke klik = eigen undo-stap (muis en toetsenbord gelijk).
	const edit = fn => { let ch = false; for (const e of texts()) ch = fn(e) || ch; if (ch) app.changed(); };
	const align = a => () => edit(e => put(e, 'align', a));
	const resize = dir => edit(e => { const s = sizeStep(e, dir, sizeOf), ch = put(e, 'size', s.size); return put(e, 'fit', s.fit) || ch; });
	const ACT = {
		smaller: () => resize(-1),
		bigger: () => resize(1),
		bold: () => { const on = !texts().every(e => e.bold); edit(e => put(e, 'bold', on)); },
		left: align('left'), center: align('center'), right: align('right'),
		image: () => onOpen(), qr: () => onOpen(), barcode: () => onOpen(),
		middle: () => app.center(ids(free())), fill: () => app.fill(ids(free())), dup: () => app.duplicate(ids(sel())),
		trash: () => app.remove(ids(free())),
		// Het menu onder de knop (Kopiëren, Volgorde, Vergrendelen...): met Bewerken al open deed 'more' niets zichtbaars.
		more: ev => { const r = ev.currentTarget.getBoundingClientRect(); onMenu(ids(sel()), r.left, r.bottom + 4, r.top); },
	};
	const PRESS = { bold: T => T.every(e => e.bold), left: T => T.every(e => e.align === 'left'), center: T => T.every(e => e.align === 'center'), right: T => T.every(e => e.align === 'right') };

	const items = BTNS.map(([key, title, type]) => {
		if (!type && !bar.querySelector('.mb-sep')) bar.append(Object.assign(d.createElement('span'), { className: 'mb-sep' }));
		const b = d.createElement('button');
		b.type = 'button';
		b.className = 'mb-btn' + (key === 'trash' ? ' danger' : '');
		b.title = title;
		b.setAttribute('aria-label', title);
		b.innerHTML = iconSvg(ICON[key] || key);
		b.addEventListener('click', ACT[key]);
		bar.append(b);
		return { key, type, b };
	});
	const sep = bar.querySelector('.mb-sep');
	// Eén tab-stop voor de hele balk (roving tabindex); de pijltjes lopen langs de knoppen.
	let cur = null;
	const rove = (it, focus = false) => {
		cur = it;
		for (const i of items) { const v = i === it ? '0' : '-1'; if (i.b.getAttribute('tabindex') !== v) i.b.setAttribute('tabindex', v); }
		if (focus) it.b.focus();
	};
	rove(items[0]);
	bar.addEventListener('keydown', e => {
		if (e.altKey || e.ctrlKey || e.metaKey) return;
		// Esc = terug naar het canvas, selectie blijft; nog een Esc daar deselecteert (zoals in de inline tekst).
		if (e.key === 'Escape') { e.preventDefault(); overlay.focus({ preventScroll: true }); return; }
		const vis = items.filter(i => !i.b.hidden), j = roveTo(vis.findIndex(i => i.b === d.activeElement), vis.length, e.key);
		if (j < 0) return;
		e.preventDefault();   // ook: anders verschuift de editor het element met de pijltjes
		rove(vis[j], true);
	});
	// Klikken pakt de focus niet: de caret blijft in de inline tekst en de sneltoetsen blijven op het canvas.
	bar.addEventListener('mousedown', e => { e.preventDefault(); const it = items.find(i => i.b.contains(e.target)); if (it) rove(it); });
	// De balk ligt boven het scrollvlak: het wiel erover scrollt de stage, Ctrl/Cmd zoomt zoals op het canvas (editor).
	bar.addEventListener('wheel', e => {
		e.preventDefault();
		if (e.ctrlKey || e.metaKey) { sc.dispatchEvent(new win.WheelEvent('wheel', e)); return; }
		const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? sc.clientHeight : 1, sx = e.shiftKey && !e.deltaX;
		sc.scrollBy(k * (sx ? e.deltaY : e.deltaX), k * (sx ? 0 : e.deltaY));
	}, { passive: false });
	// Voor de voetbalk: Tab uit de balk gaat naar Printvoorbeeld, Shift+Tab daarvandaan komt er weer in.
	host.insertBefore(bar, host.querySelector('.stage-foot'));
	// Alt+F10 (zoals in editors) = naar de balk, vanaf het canvas of de inline tekst; Tab op het canvas loopt langs de elementen.
	const enter = e => {
		if (!e.altKey || e.ctrlKey || e.metaKey || e.key !== 'F10') return;
		update();
		if (bar.hidden) return;
		e.preventDefault();
		rove(cur, true);
	};
	host.addEventListener('keydown', enter);

	// Onzichtbaar zoals render het tekende (na de veldregels); de box zelf = de elementwaarden (mm).
	const off = el => { const b = getBoxes?.()?.get?.(el.id); return typeof b?.hidden === 'boolean' ? b.hidden : !!el.hidden; };
	const show = on => { if (bar.hidden === on) bar.hidden = !on; };

	function update() {
		if (raf) { win.cancelAnimationFrame(raf); raf = 0; }
		// Vóór het verbergen: verdwijnt de knop met de focus (Verwijderen), dan gaat de focus mee naar de volgende.
		const list = sel(), had = bar.contains(d.activeElement);
		if (drag || !list.length) return show(false);
		const vis = new Set(visibleFor(list)), T = texts();
		let typed = false;
		for (const { key, type, b } of items) {
			const on = vis.has(key);
			if (b.hidden === on) b.hidden = !on;
			if (on && type) typed = true;
			if (on && PRESS[key]) { const p = String(T.length > 0 && PRESS[key](T)); if (b.getAttribute('aria-pressed') !== p) b.setAttribute('aria-pressed', p); }
		}
		if (sep.hidden === typed) sep.hidden = !typed;
		if (cur.b.hidden) rove(items.find(i => !i.b.hidden), had);
		const hr = host.getBoundingClientRect(), o = { left: hr.left + host.clientLeft, top: hr.top + host.clientTop }, vr = view.getBoundingClientRect(), L = app.doc.label;
		// Grenzen = zichtbaar deel van het scrollvlak (zonder scrollbalken en de voetbalk), zonder het zijpaneel.
		const r = sc.getBoundingClientRect(), a = avoid.getBoundingClientRect();
		const B = clip({ x: r.left - o.left + sc.clientLeft, y: r.top - o.top + sc.clientTop, w: sc.clientWidth, h: sc.clientHeight }, { x: a.left - o.left, w: a.width });
		// Nooit breder dan het vrije vlak (telefoon): dan twee rijen (flex-wrap) i.p.v. over de rail en buiten beeld.
		const mw = Math.max(0, Math.floor(B.w - 2 * PAD)) + 'px';
		if (bar.style.maxWidth !== mw) { bar.style.maxWidth = mw; bw = 0; }
		// Maat alleen opnieuw meten als de knoppenset of de maximale breedte verandert (meten = layout).
		const s0 = [...vis].join();
		if (s0 !== sig || !bw) { show(true); bw = bar.offsetWidth; bh = bar.offsetHeight; sig = s0; }
		const s = toHost(union(list), vr, o, L.w);
		// Bovenin mag de balk in de lege stage-marge (boven het scrollvlak); onderkant en zijkanten blijven B (scrollbalk, voetbalk).
		const O = { ...B, y: 0, h: B.y + B.h };
		// Andere elementen niet afdekken; randen en vlakken over (bijna) het hele label tellen niet (die raak je altijd).
		const mine = new Set(list.map(e => e.id)), big = L.w * L.h * 0.9;
		const obst = app.doc.elements.filter(e => !mine.has(e.id) && e.type !== 'border' && !off(e) && e.w * e.h < big).map(e => toHost(union([e]), vr, o, L.w));
		const one = list.length === 1 && !list[0].locked && !off(list[0]);
		const p = place(s, bw, bh, B, one ? GAP_ROT : GAP, PAD, O, obst);
		if (!p) return show(false);
		const t = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
		if (t !== tf) { bar.style.transform = t; tf = t; }
		show(true);
	}
	const schedule = () => { if (!raf) raf = win.requestAnimationFrame(() => { raf = 0; update(); }); };

	// Verbergen tijdens slepen/marquee (update() bij de eerste wijziging); pas na loslaten weer op de nieuwe plek.
	// Niet al bij indrukken: een gewone klik liet de balk anders knipperen. Alleen de primaire pointer, zoals de editor:
	// een tweede vinger die loslaat toonde de balk midden in het slepen.
	const down = e => { if (e.isPrimary) drag = true; };
	const up = e => { if (e.isPrimary && drag) { drag = false; schedule(); } };
	overlay.addEventListener('pointerdown', down);
	win.addEventListener('pointerup', up);
	win.addEventListener('pointercancel', up);
	sc.addEventListener('scroll', schedule, { passive: true });
	// #view verandert van CSS-maat bij zoom of labelmaat; host bij paneel/venster.
	const ro = new win.ResizeObserver(schedule);
	ro.observe(view);
	ro.observe(host);
	// Selectie weg = meteen verbergen, niet pas in de rAF: anders pakt Tab voorbij het laatste element nog de verdwijnende
	// balk (focus valt dan naar body). Had de balk de focus (Verwijderen met Enter), dan terug naar het canvas.
	const gone = () => {
		if (sel().length) return;
		if (bar.contains(d.activeElement)) overlay.focus({ preventScroll: true });
		show(false);
	};
	// change/doc/select volgt de balk via main.js frame() -> update(); het opstartframe kan al voorbij zijn, dus zelf 1x plaatsen.
	app.on('select', gone);
	schedule();

	return { update };
}

export function selftest() {
	const details = [], near = (a, b) => Math.abs(a - b) < 1e-6;
	let ok = true;
	const t = (name, cond) => { details.push(`${cond ? 'ok' : 'FAIL'} ${name}`); ok = ok && !!cond; };
	const B = { x: 0, y: 0, w: 800, h: 600 };
	let p = place({ x: 300, y: 200, w: 200, h: 50 }, 100, 36, B, 10);
	t('boven de selectie, gecentreerd', p.x === 350 && p.y === 154);
	t('links geklemd binnen host', place({ x: 0, y: 200, w: 40, h: 50 }, 100, 36, B, 10).x === 8);
	t('rechts geklemd binnen host', place({ x: 760, y: 200, w: 40, h: 50 }, 100, 36, B, 10).x === 692);
	p = place({ x: 300, y: 20, w: 200, h: 50 }, 100, 36, B, 10);
	t('geen ruimte boven = eronder', p.y === 80);
	p = place({ x: 300, y: 20, w: 200, h: 570 }, 100, 36, B, 10);
	t('nergens ruimte = bovenin geklemd', p.y === 8);
	t('grenzen met offset (scrollvlak)', place({ x: 300, y: 60, w: 50, h: 20 }, 100, 36, { x: 24, y: 24, w: 600, h: 400 }, 10).y === 90);
	const C = { x: 0, y: 0, w: 800, h: 600 };
	t('paneel erover: vrije kant blijft over', clip(C, { x: 480, w: 320 }).w === 480 && clip(C, { x: 0, w: 320 }).x === 320 && clip(C, { x: 0, w: 320 }).w === 480
		&& clip(C, { x: 820, w: 300 }) === C && clip(C, { x: 300, w: 0 }) === C && clip(C, null) === C);
	t('selectie onder het paneel = verborgen', place({ x: 600, y: 200, w: 100, h: 50 }, 100, 36, clip(C, { x: 480, w: 320 }), 10) === null);
	const S = { x: 300, y: 200, w: 200, h: 50 };
	t('element vlak boven = eronder', place(S, 100, 36, B, 10, 8, B, [{ x: 320, y: 150, w: 60, h: 30 }]).y === 260);
	p = place(S, 100, 36, B, 10, 8, B, [{ x: 350, y: 160, w: 100, h: 30 }, { x: 350, y: 255, w: 100, h: 10 }]);
	t('boven én onder bezet = minste overlap', p.y === 260);
	const B2 = { x: 0, y: 24, w: 800, h: 576 };
	p = place({ x: 300, y: 60, w: 200, h: 50 }, 100, 36, B2, 10, 8, { ...B2, y: 0, h: 600 });
	t('ruimte alleen in de stage-marge boven B = toch erboven', p.y === 14);
	t('selectie buiten beeld = verborgen', place({ x: 900, y: 10, w: 10, h: 10 }, 100, 36, B, 10) === null && place({ x: 10, y: -50, w: 10, h: 10 }, 100, 36, B, 10) === null);
	// 40 mm = 320 dots; zoom 2 = 640 CSS-px = 16 px/mm. Host op (100,50), view op (160,90).
	const s = toHost({ x: 10, y: 5, w: 20, h: 10 }, { left: 160, top: 90, width: 640 }, { left: 100, top: 50 }, 40);
	t('mm -> host-px (16 px/mm)', near(s.x, 220) && near(s.y, 120) && near(s.w, 320) && near(s.h, 160));
	const r = toHost(union([{ x: 0, y: 0, w: 10, h: 2, rot: 90 }]), { left: 0, top: 0, width: 320 }, { left: 0, top: 0 }, 40);
	t('gedraaid: omhullende (aabb)', near(r.x, 32) && near(r.y, -32) && near(r.w, 16) && near(r.h, 80));
	t('selectie van twee = unie', (u => near(u.x, 1) && near(u.w, 19) && near(u.h, 9))(union([{ x: 1, y: 1, w: 4, h: 4 }, { x: 15, y: 6, w: 5, h: 4 }])));
	t('grootte +/- 10%, min 0,1, geklemd', nextSize(5, 1) === 5.5 && nextSize(5.5, -1) === 5 && nextSize(0.5, 1) === 0.6 && nextSize(0.6, -1) === 0.5
		&& nextSize(0.5, -1) === 0.5 && nextSize(150, 1) === 150 && nextSize(2.5, 1) === 2.8);
	// Nep-sizeOf: de box past tot 8 mm; Groeien tekent 8, Krimpen min(maat, 8).
	const box8 = x => x.fit === 'shrink' ? Math.min(x.size, 8) : 8, ss = (fit, dir) => sizeStep({ fit, size: 5 }, dir, box8);
	t('Kleiner/Groter: Vrij blijft Vrij; Groeien vanaf de getekende 8 mm: kleiner = Krimpen, groter = Vrij',
		ss('none', 1).size === 5.5 && ss('none', 1).fit === 'none' && ss('fill', -1).size === 7.3 && ss('fill', -1).fit === 'shrink'
		&& ss('fill', 1).size === 8.8 && ss('fill', 1).fit === 'none');
	const v = list => visibleFor(list).join();
	t('tekst: grootte/vet/uitlijning + altijd', v([{ type: 'text' }]) === 'smaller,bigger,bold,left,center,right,middle,fill,dup,trash,more');
	t('beeld: varianten; code: eigen knop', v([{ type: 'image' }]) === 'image,middle,fill,dup,trash,more' && v([{ type: 'qr' }]).startsWith('qr,') && v([{ type: 'barcode' }]).startsWith('barcode,'));
	t('gemengde selectie: alleen altijd-knoppen', v([{ type: 'text' }, { type: 'icon' }]) === 'middle,fill,dup,trash,more');
	t('elke knop heeft een ui-icoon', BTNS.every(([k]) => !iconSvg(ICON[k] || k).includes('d=""')));
	t('vergrendeld: alleen niet-muterend', v([{ type: 'text', locked: true }]) === 'dup,more' && v([{ type: 'image', locked: true }]) === 'image,dup,more');
	t('deels vergrendeld: alles (raakt alleen vrije)', v([{ type: 'text', locked: true }, { type: 'text' }]) === v([{ type: 'text' }]));
	t('toolbar-toetsen: pijltjes rondom, Home/End, rest niet', roveTo(0, 5, 'ArrowRight') === 1 && roveTo(4, 5, 'ArrowRight') === 0 && roveTo(0, 5, 'ArrowLeft') === 4
		&& roveTo(2, 5, 'Home') === 0 && roveTo(2, 5, 'End') === 4 && roveTo(2, 5, 'ArrowUp') === -1 && roveTo(2, 5, 'Enter') === -1 && roveTo(-1, 5, 'ArrowRight') === -1 && roveTo(0, 0, 'End') === -1);
	return { ok, details };
}
