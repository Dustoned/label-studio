// Opstart, render-lus en print-flow. Alleen start() raakt de DOM, en alleen in de browser.
import * as util from './util.js';
import * as printer from './printer-transport.js';
import * as docMod from './doc.js';
import * as render from './render.js';
import * as imaging from './imaging.js';
import * as fonts from './fonts.js';
import * as icons from './icons.js';
import * as presets from './presets.js';
import * as editorMod from './editor.js';
import * as ui from './ui.js';

const { $, clamp, parseCSV, DPM, COUNTER_TOKEN, usesToken } = util;
const { app } = docMod;

let editor = null, mini = null, boxes = new Map(), pending = false, raf = 0, dirty = true, user = false, csvSrc = null, csvRows = [], lastScale = 0, lastInput = 0, refineT = 0;
// Gebruikersrenders kort na elkaar (slepen, typen, wiel-zoom) = snel zonder supersampling; REFINE_MS daarna glad.
// Alleen gebruikersrenders tellen: een geladen svg/font na een zoom maakte de render anders 'snel' (dip naar 1x, en met
// twee iconen een eindeloze grof-scherp-lus).
const FAST_MS = 100, REFINE_MS = 150;

// CSV alleen opnieuw parsen als de tekst echt veranderde (refresh vraagt er elk frame om).
function rows() {
	const c = app.doc.batch.csv;
	if (c !== csvSrc) { csvSrc = c; try { csvRows = parseCSV(c); } catch { csvRows = []; } }
	return csvRows;
}
function previewRow() { const r = rows(); return r.length ? r[clamp((parseInt(app.doc.batch.row) || 1) - 1, 0, r.length - 1)] : null; }
function previewCtx() { const c = app.doc.counter; return { row: previewRow(), counter: +c.start || 0, now: new Date() }; }

// Scherp voorbeeld: renderen op schermresolutie (zoom × devicePixelRatio), Printpixels = exact het printraster.
function viewScale(fast = false) {
	const L = app.doc.label;
	return ui.previewScale(editor?.getZoom() || 1, globalThis.devicePixelRatio || 1, Math.round(L.w * DPM) * Math.round(L.h * DPM), ui.printPixels(), fast);
}
// Monitorwissel of browserzoom verandert de pixeldichtheid; matchMedia meldt dat 1×, dus telkens opnieuw aanmelden.
function watchDpr() {
	matchMedia(`(resolution: ${globalThis.devicePixelRatio || 1}dppx)`).addEventListener('change', () => { schedule(true); watchDpr(); }, { once: true });
}

// Alle wijzigingen in één frame samen: full = opnieuw renderen, anders alleen overlay + panelen. asset = niet door de gebruiker.
function schedule(full = true, asset = false) { if (full) { dirty = true; if (!asset) user = true; } if (!raf) raf = requestAnimationFrame(frame); }
function frame() {
	raf = 0;
	if (dirty) {
		dirty = false;
		const t = performance.now(), fast = user && t - lastInput < FAST_MS;
		if (user) lastInput = t;
		user = false;
		clearTimeout(refineT);
		// boxes = per element de zichtbaar-vlag na de veldregels; pending = er laadt nog een beeld/icoon/emoji-font.
		try {
			lastScale = viewScale(fast); if (fast) refineT = setTimeout(() => schedule(true, true), REFINE_MS);
			const r = render.renderDoc($('view'), app.doc, previewCtx(), { scale: lastScale, placeholders: true, fast });
			boxes = r.boxes; pending = !!r.pending;
		}
		catch (e) { console.error('Renderen mislukt', e); }
	}
	try { editor?.redraw(); } catch (e) { console.error('Overlay mislukt', e); }
	// Ook na een render zonder app-event (font/svg geladen): de balk volgt de verse boxes.
	try { mini?.update(); } catch (e) { console.error('Mini-werkbalk mislukt', e); }
	try { ui.refresh(); } catch (e) { console.error('Interface bijwerken mislukt', e); }
}

// printer.isBusy() gaat pas aan na het verbinden: tweemaal Ctrl+P tijdens het verbinden printte de hele batch dubbel.
let printBusy = false;
// Label i (0-based over rijen × kopieën) krijgt teller start + i*stap; de transportmodule kiest Serial of BLE.
// d = vaste kopie: bewerken tijdens een lange batch kwam anders half in de batch, langs de controle vooraf.
async function print(onlyRow = false) {
	if (printBusy || printer.isBusy()) return;
	const d = structuredClone(app.doc), all = rows(), list = onlyRow || !all.length ? [previewRow()] : all;
	const copies = clamp(Math.round(+d.print.copies) || 1, 1, 99), total = list.length * copies;
	const start = +d.counter.start || 0, step = Number.isFinite(+d.counter.step) ? +d.counter.step : 1, now = new Date();
	const cv = document.createElement('canvas'), ctxOf = i => ({ row: list[Math.floor(i / copies)] || null, counter: start + i * step, now });
	// Eerst elk label controleren, vóór het eerste byte: een ongeldige code in rij 2 of een nog niet geladen barcode-
	// bibliotheek/afbeelding gaf anders stil een label zonder code. Zonder {teller} zijn kopieën gelijk: 1 per rij.
	const stride = list.some(row => usesToken(d, COUNTER_TOKEN, row)) ? 1 : copies, rowNo = i => onlyRow || !all.length ? 0 : Math.floor(i / copies) + 1;
	printBusy = true;
	ui.printing(0, total);
	let n = 0;
	try {
		// Eerst 'Printen 0/N' laten tekenen: de controle blokkeert bij 500 rijen met QR ~2 s. Alleen rAF lost op vóór het tekenen.
		await new Promise(r => requestAnimationFrame(() => setTimeout(r)));
		// Een icoon/emoji dat alleen in een latere rij staat begint pas in deze controle te laden (~50 ms): even wachten en
		// opnieuw kijken i.p.v. weigeren. Hooguit ~2 s voor de hele batch: een beeld dat nooit klaar raakt houdt het kort.
		const until = performance.now() + 2000, check = i => render.renderDoc(cv, d, ctxOf(i), { scale: 1, placeholders: false });
		for (let i = 0; i < total; i += stride) {
			let r = check(i);
			while (r.pending && performance.now() < until) { await new Promise(res => setTimeout(res, 50)); r = check(i); }
			const bad = r.issues[0];
			if (!bad) continue;
			const nm = d.elements.find(e => e.id === bad.id)?.name || 'element';
			ui.toast(`Niet geprint: ${rowNo(i) ? `rij ${rowNo(i)}, ` : ''}${bad.msg.startsWith(nm) ? '' : nm + ': '}${bad.msg}`, 'err');
			return;
		}
		const renderNth = i => {
			const r = render.renderDoc(cv, d, ctxOf(i), { scale: 1, placeholders: false });
			return { rgba: cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, r.W, r.H).data, W: r.W, H: r.H };
		};
		n = await printer.printLabels(total, renderNth, d.print, (k, t) => ui.printing(k, t)) || 0;
	}
	catch (e) { console.error(e); ui.toast('Printen mislukt: ' + (e?.message || e), 'err'); }
	finally { printBusy = false; ui.printing(null); }
	// Afgebroken batch is een fout: ingezoomd valt de rode printfout-toast weg en bleef alleen 'geprint' in het groen.
	if (n > 0) ui.toast(n < total ? `${n} van ${total} labels geprint` : n === 1 ? 'Label geprint' : `${n} labels geprint`, n < total ? 'err' : 'ok');
	// Doorschuiven alleen als de teller echt op het label staat en niemand hem tijdens het printen veranderde.
	const c = app.doc.counter;
	// Via session: ook in de undo-snapshots, anders zet Ctrl+Z de teller terug en print je dezelfde nummers opnieuw.
	if (n > 0 && c.autoAdvance && +c.start === start && list.some(row => usesToken(app.doc, COUNTER_TOKEN, row))) app.session(D => { D.counter.start = start + n * step; });
}

async function runSelftests() {
	const [emoji, weedpack, minibar, iconbrowser, inlineedit, serial, ble] = await Promise.all(['emoji', 'weedpack', 'minibar', 'iconbrowser', 'inlineedit', 'printer', 'printer-ble']
		.map(n => import(`./${n}.js`).catch(e => { console.error(n + '.js laden mislukt', e); return null; })));
	const mods = { util, printer, serial, ble, doc: docMod, render, imaging, fonts, icons, emoji, weedpack, presets, editor: editorMod, minibar, iconbrowser, inlineedit, ui };
	const lines = [];
	let ok = true;
	for (const [name, m] of Object.entries(mods)) {
		if (typeof m?.selftest !== 'function') { ok = false; lines.push(`${name}: FAIL geen selftest()`); continue; }
		try {
			const r = await m.selftest(), good = !!r?.ok;
			ok &&= good;
			lines.push(`${name}: ${good ? 'ok' : 'FAIL'}${r?.details?.length ? ' - ' + r.details.join(' | ') : ''}`);
		} catch (e) { ok = false; lines.push(`${name}: FAIL ${e?.message || e}`); }
	}
	console.log(ok ? 'SELFTEST PASS' : 'SELFTEST FAIL');
	(ok ? console.info : console.error)(lines.join('\n'));
	ui.toast(ok ? 'Selftest geslaagd' : 'Selftest mislukt (zie console)', ok ? 'ok' : 'err');
	return ok;
}

function start() {
	app.init();
	// Centreren, Netjes maken en plaatsen op wat je ziet (render meet de inhoud), niet op de box.
	const meet = el => render.contentBox(el, app.doc.fields, previewRow(), app.doc.counter);
	app.setExtent(meet);
	editor = editorMod.createEditor({ view: $('view'), overlay: $('overlay'), app, getBoxes: () => boxes, stage: $('stageScroll'),
		onEditText: ui.editText, onContextMenu: ui.contextMenu,
		onZoom: z => { ui.zoomChanged(z); if (viewScale() !== lastScale) schedule(true); } });
	const actions = { print, rows, previewRow, connect: () => printer.connect(true), redraw: schedule, inline: null };
	ui.build({ editor, actions });
	// Mini-werkbalk is los geladen: ontbreekt of faalt de module, dan werkt de rest gewoon. getBoxes = dezelfde zichtbaar-map
	// als de editor (minibar.js rekent zelf naar mm). avoid: op een smal scherm ligt het paneel over het canvas.
	// onMenu: 'Meer opties' = het elementmenu onder de knop; sizeOf: getekende tekstmaat bij automatische grootte.
	import('./minibar.js').then(m => { mini = m.createMinibar({ host: $('stage'), view: $('view'), app, getBoxes: () => boxes, onOpen: ui.openEdit, avoid: $('drawer'),
		onMenu: (ids, x, y, top) => ui.contextMenu(ids[0], x, y, top), sizeOf: ui.autoSize }); })
		.catch(e => console.error('minibar.js laden mislukt', e));
	// Tekst op het canvas bewerken: ook los geladen; ontbreekt hij, dan opent dubbelklik/typen gewoon het paneel.
	import('./inlineedit.js').then(m => { actions.inline = m.createInlineEditor({ view: $('view'), app, getBoxes: () => boxes, fitSize: ui.autoSize }); })
		.catch(e => console.error('inlineedit.js laden mislukt', e));
	// Klik op de lege stage rond het label = deselecteren (de editor luistert alleen op #overlay). Scrollbalk telt niet.
	const bare = [$('stage'), $('stageScroll'), $('paper'), $('labelWrap'), $('stage').querySelector('.stage-foot')];
	$('stage').addEventListener('pointerdown', e => {
		if (e.button || e.shiftKey || e.ctrlKey || e.metaKey || !bare.includes(e.target) || !app.selection.length) return;
		if (e.offsetX >= e.target.clientWidth || e.offsetY >= e.target.clientHeight) return;
		app.select([]);
	});
	// Canvas is een tab-stop: Tab/Shift+Tab loopt door de elementen (zoals ontwerpprogramma's). Voorbij het laatste/eerste
	// element: selectie weg en Tab mag het canvas verlaten (geen toetsenbordval).
	$('overlay').addEventListener('keydown', e => {
		if (e.key !== 'Tab' || e.ctrlKey || e.metaKey || e.altKey) return;
		// Zichtbaar zoals getekend (na de veldregels), net als Ctrl+A in de editor.
		const ids = app.doc.elements.filter(x => !(boxes.get(x.id)?.hidden ?? x.hidden)).map(x => x.id), i = app.selection.length === 1 ? ids.indexOf(app.selection[0]) : -1;
		const j = i < 0 ? (e.shiftKey ? ids.length - 1 : 0) : i + (e.shiftKey ? -1 : 1);
		if (j < 0 || j >= ids.length) { app.select([]); return; }
		e.preventDefault();
		app.select([ids[j]]);
		ui.revealSel([ids[j]]);   // ingezoomd: de gekozen (toetsenbordfocus) in beeld
	});
	// Serial herverbindt stil; BLE wacht op een expliciete knopklik voor de apparaatkeuze.
	printer.initPrinter({ onStatus: ui.status, onLog: ui.log, onConnection: ui.connection });
	app.on('change', () => schedule(true));
	app.on('doc', () => schedule(true));
	app.on('select', () => schedule(false));
	app.on('history', () => schedule(false));
	// onAssetsChanged meldt ook geladen fonts. Alleen wat dit label raakt: fonts/iconen van de template-thumbs gaven anders
	// per stuk een volle scherpe render (gemeten: 8 renders bij het openen, de thumbs wachtten erop). Een beeld meldt zonder
	// familie: alleen opnieuw als de laatste render nog op iets wachtte (anders 60+ renders bij het bladeren door templates).
	// Elke asset wist ook het 'al netjes'-geheugen: een later geladen font/beeld verandert de meting, niet het doc.
	render.onAssetsChanged(f => { app.setExtent(meet); if (typeof f === 'string' ? ui.assetHits(app.doc, f) : pending) schedule(true, true); });
	app.on('saveerror', () => ui.toast('Opslaan in de browser mislukt (opslag vol of geblokkeerd). Exporteer je label als .json.', 'err'));
	addEventListener('keydown', e => {
		if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'p') { e.preventDefault(); print(false); }
	});
	// {tijd}/{datum} in de preview actueel houden.
	setInterval(() => { if (usesToken(app.doc, /\{\s*(tijd|datum)/i, previewRow()) || app.doc.fields.some(f => f.type === 'date')) schedule(true); }, 30000);
	watchDpr();
	schedule(true);
	// Iconen zonder nodes (offline geladen, of een undo-snapshot van vóór het aanvullen) alsnog vullen.
	ui.rehydrate();
	app.on('doc', () => ui.rehydrate());
	app.on('change', d => { if (d?.undo) ui.rehydrate(); });
	addEventListener('online', () => ui.iconsBack());
	if (/[?&]selftest\b/.test(location.search)) runSelftests();
}

if (typeof document !== 'undefined') {
	try { start(); }
	catch (e) { console.error('Opstarten mislukt', e); ui.toast('Opstarten mislukt: ' + (e?.message || e), 'err'); }
}
