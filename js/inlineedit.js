// Tekst direct op het canvas bewerken (zoals Canva/Figma). De textarea ligt precies over de getekende tekst maar is zelf
// onzichtbaar: je ziet de echte render (= de print) eronder, de textarea levert alleen caret, selectie en invoer.
// Bij import geen DOM (node-selftest): alles pas in createInlineEditor(). editable/place zijn puur.
import { DPM, TOKEN } from './util.js';
import { fontSpec, HALIGN, VALIGN, num, dbox } from './render.js';

// Dots extra breedte bij afbreken: DOM en canvas meten tot ~0,2 dot anders, en Krimpen legt de breedste regel precies op de rand.
const SLACK = .5;

// Alleen wat 1-op-1 te tonen is. {velden}/invulvelden (op het canvas staat de waarde, niet de token), verticale en
// vergrendelde tekst gaan via het paneel.
const editable = el => el?.type === 'text' && !el.locked && !el.vertical && !TOKEN.test(String(el.text ?? ''));

// Zoals render.drawText: box op hele dots, regelblok verticaal volgens valign; niet afbreken = zo breed als de langste
// regel, horizontaal volgens align. k = CSS-px per dot, cw/ch = gemeten inhoud, ls = letterafstand (CSS-px). o = boxmidden.
// CSS telt de letterafstand ook na de laatste letter, render niet: de textarea is ls breder, zo kloppen afbreken en align.
// Afbreken: SLACK dots breder, verdeeld volgens align, zodat de inkt op dezelfde plek blijft.
function place(el, k, cw, ch, ls = 0) {
	const d = dbox(el), bx = d.x * k, by = d.y * k, bw = d.w * k, bh = d.h * k;
	const w = (el.wrap !== false ? bw + SLACK * k : Math.max(bw, cw - ls)) + ls, x = bx + (bw + ls - w) * (HALIGN[el.align] ?? 0), y = by + (bh - ch) * (VALIGN[el.valign] ?? 0);
	return { x, y, w, h: ch, ox: bx + bw / 2 - x, oy: by + bh / 2 - y, rot: d.rot };
}

// fitSize(el) = getekende lettergrootte in mm (ui.autoSize: met voorbeeldrij en teller); geen geldige maat = el.size.
export function createInlineEditor({ view, app, getBoxes, fitSize }) {
	// In de wrap van het canvas (niet in de stage): scrollt en zoomt zo vanzelf mee. De wrap klipt zelf niet: tekst buiten
	// het label vergrootte het scrollvlak (scrollbalk, passend maken herrekende, het label sprong). Daarom een eigen kliplaag.
	const d = view.ownerDocument, mount = view.parentElement;
	const clip = d.createElement('div'), ta = d.createElement('textarea');
	clip.className = 'ie-clip';
	ta.className = 'ie';
	ta.hidden = true;
	ta.spellcheck = false;
	ta.setAttribute('autocomplete', 'off');
	ta.setAttribute('aria-label', 'Tekst bewerken (Esc = klaar)');
	clip.append(ta);
	mount.append(clip);
	let id = null, comp = false;
	const cur = () => id ? app.doc.elements.find(e => e.id === id) : null;

	function layout() {
		const e = cur();
		if (!e) return close();
		const W = Math.round(app.doc.label.w * DPM) || 1, k = view.offsetWidth / W, size = num(e.size, 5), fs = +fitSize(e);
		const px = Math.max(1, (fs > 0 ? fs : size) * DPM), lh = px * num(e.lineHeight, 1.15) * k, ls = num(e.letterSpacing) * px / Math.max(1e-6, size) * k;
		const st = ta.style, wrap = e.wrap !== false;
		// Getypte {veld}: het canvas toont de waarde (andere lengte), dan de tekst zelf tonen, anders staat de caret verkeerd.
		ta.classList.toggle('raw', TOKEN.test(ta.value));
		st.font = fontSpec(e, px * k);
		st.lineHeight = lh + 'px';
		st.letterSpacing = ls + 'px';
		st.whiteSpace = wrap ? 'pre-wrap' : 'pre';
		// Meten op hoogte 0 (links uitgelijnd: anders telt overloop naar links niet mee): scrollHeight = het regelblok.
		st.textAlign = 'left';
		st.width = wrap ? (dbox(e).w + SLACK) * k + ls + 'px' : '0px';
		st.height = '0px';
		const p = place(e, k, ta.scrollWidth, Math.max(1, Math.round(ta.scrollHeight / lh)) * lh, ls);
		st.textAlign = e.align || 'left';
		st.left = view.offsetLeft + p.x + 'px';
		st.top = view.offsetTop + p.y + 'px';
		st.width = p.w + 'px';
		st.height = p.h + 'px';
		st.transformOrigin = `${p.ox}px ${p.oy}px`;
		st.transform = p.rot ? `rotate(${p.rot}deg)` : '';
	}

	function open(nid) {
		const e = app.doc.elements.find(x => x.id === nid), b = getBoxes?.()?.get?.(nid);
		if (!editable(e) || (typeof b?.hidden === 'boolean' ? b.hidden : e.hidden)) return false;
		id = nid;
		ta.value = String(e.text ?? '');
		ta.hidden = false;
		layout();
		ta.focus();
		ta.select();
		return true;
	}
	function close() {
		if (!id) return;
		id = null;
		const had = d.activeElement === ta;
		ta.hidden = true;
		// Toetsenbord blijft op het canvas (Esc nog eens = deselecteren, pijltjes = verschuiven).
		if (had) mount.querySelector('#overlay').focus({ preventScroll: true });
	}

	ta.addEventListener('input', () => {
		const e = cur();
		if (!e) return;
		e.text = ta.value;
		app.changed({ coalesce: 'inline:' + id });
	});
	ta.addEventListener('keydown', e => {
		if (comp || e.isComposing) return;
		const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
		// Tab: terug naar het canvas (daar = volgend element), niet naar de eerstvolgende knop in de DOM (Printvoorbeeld).
		if (k === 'escape' || k === 'tab' && !mod && !e.altKey) { e.preventDefault(); close(); }
		// Native undo van de textarea kwam terug als nieuwe app-stap: app-undo, zoals het tekstvak in het paneel.
		else if (mod && !e.altKey && (k === 'z' || k === 'y')) { e.preventDefault(); if (k === 'y' || e.shiftKey) app.redo(); else app.undo(); }
	});
	// Klik ernaast = sluiten; venster wisselen (geen focus in het document) niet.
	ta.addEventListener('blur', () => { if (d.hasFocus()) close(); });
	ta.addEventListener('compositionstart', () => { comp = true; });
	ta.addEventListener('compositionend', () => { comp = false; });

	app.on('select', () => { if (id && (app.selection.length !== 1 || app.selection[0] !== id)) close(); });
	app.on('doc', close);
	// Ook wijzigingen van elders (paneel, mini-werkbalk, undo): tekst en maat volgen in place.
	app.on('change', () => {
		const e = cur();
		if (!id) return;
		if (!e || e.locked || e.vertical) return close();
		const t = String(e.text ?? '');
		if (!comp && t !== ta.value) ta.value = t;
		layout();
	});
	const relayout = () => { if (id) layout(); };
	const win = d.defaultView;
	new win.ResizeObserver(relayout).observe(view);   // zoom/labelmaat
	d.fonts.addEventListener('loadingdone', relayout);

	return { open };
}

export function selftest() {
	const details = [], near = (a, b) => Math.abs(a - b) < 1e-6;
	let ok = true;
	const t = (name, cond) => { details.push(`${cond ? 'ok' : 'FAIL'} ${name}`); ok = ok && !!cond; };
	t('bewerkbaar: alleen gewone tekst', editable({ type: 'text', text: 'Hallo' }) && editable({ type: 'text', text: '' }) && !editable({ type: 'text', text: 'THC {thc}%' })
		&& !editable({ type: 'text', text: 'a', locked: true }) && !editable({ type: 'text', text: 'a', vertical: true }) && !editable({ type: 'icon' }) && !editable(null));
	// 10x5 mm op 20x10 mm, k = 2 CSS-px per dot: box 160,80 320x160 CSS-px.
	const B = { x: 10, y: 5, w: 20, h: 10 };
	let p = place({ ...B, align: 'center', valign: 'middle' }, 2, 0, 40);
	t('midden/midden: regelblok verticaal gecentreerd, draaipunt = boxmidden', near(p.x, 159.5) && near(p.y, 140) && near(p.w, 321) && near(p.h, 40) && near(p.ox, 160.5) && near(p.oy, 20));
	// SLACK (0,5 dot = 1 px bij k 2) breder: links blijft de linkerrand, midden het midden, rechts de rechterrand van de box.
	const al = a => place({ ...B, align: a }, 2, 0, 40);
	t('afbreken: iets breder dan de box, inkt blijft op zijn plek', near(al('left').x, 160) && near(al('left').w, 321) && near(al('center').x + al('center').w / 2, 320)
		&& near(al('right').x + al('right').w, 480) && near(al('right').x, 159));
	t('boven / onder', near(place({ ...B, valign: 'top' }, 2, 0, 40).y, 80) && near(place({ ...B, valign: 'bottom' }, 2, 0, 40).y, 200));
	t('uitlijning-naam van Object.prototype = links/boven (geen NaN)', near(place({ ...B, align: 'constructor', valign: 'toString' }, 2, 0, 40).x, 160) && near(place({ ...B, align: 'constructor', valign: 'toString' }, 2, 0, 40).y, 80));
	t('te hoog: steekt boven en onder uit (zoals render)', near(place({ ...B, valign: 'middle' }, 2, 0, 200).y, 60));
	const nw = a => place({ ...B, wrap: false, align: a }, 2, 400, 40);
	t('niet afbreken, breder dan de box: volgens align', near(nw('left').x, 160) && near(nw('center').x, 120) && near(nw('right').x, 80) && near(nw('center').w, 400) && near(nw('center').ox, 200));
	t('niet afbreken, smaller dan de box: boxbreedte', near(place({ ...B, wrap: false, align: 'center' }, 2, 100, 40).w, 320));
	// ls 10: CSS-regel 'abc' = inkt + 10. Rechts: inkt eindigt op de boxrand; niet afbreken + midden: inkt gecentreerd op de box.
	t('letterafstand: ls breder, inkt op dezelfde plek als render', near(place({ ...B, align: 'right' }, 2, 0, 40, 10).w, 331) && near(place({ ...B, align: 'right' }, 2, 0, 40, 10).x, 159)
		&& near(place({ ...B, wrap: false, align: 'center' }, 2, 410, 40, 10).x, 120) && near(place({ ...B, wrap: false, align: 'center' }, 2, 410, 40, 10).w, 410)
		&& near(place({ ...B, align: 'center' }, 2, 0, 40, 10).ox, 160.5));
	p = place({ x: 10.06, y: 0, w: 20.04, h: 10, rot: 30 }, 1, 0, 10);
	t('box op hele dots, rotatie mee', near(p.x, 80) && near(p.w, 160.5) && p.rot === 30);
	t('font = render.fontSpec (snit alleen als die bestaat)', fontSpec({ font: 'Arial', bold: true, italic: true }, 12) === 'italic bold 12px "Arial", sans-serif'
		&& fontSpec({ font: 'Pacifico', bold: true, italic: true }, 8) === '8px "Pacifico", sans-serif' && fontSpec({}, 5) === '5px "Arial", sans-serif');
	return { ok, details };
}
