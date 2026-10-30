// Pc behoudt Serial; browsers zonder Serial gebruiken de losse BLE-driver.
import * as serial from './printer.js';
import * as ble from './printer-ble.js';

export const transportFor = (nav = globalThis.navigator) => nav?.serial ? 'serial' : 'ble';
let active = null;
let listening = false;
const driver = () => active || (transportFor() === 'serial' ? serial : ble);
export function initPrinter(callbacks = {}) {
	active = driver();
	active.initPrinter(callbacks);
	if (active === ble) {
		callbacks.onConnection?.(false);
		callbacks.onStatus?.('Verbind je BLE-printer. Safari vereist de Beacio-extensie.');
		if (!listening) {
			listening = true;
			globalThis.addEventListener('pagehide', ble.release);
			globalThis.addEventListener('pageshow', ble.resume);
			globalThis.addEventListener('beacio:extension:ready', ble.restore);
		}
		void ble.restore();
	}
}
export const isConnected = () => driver().isConnected();
export const isBusy = () => driver().isBusy();
export const connect = (pick, choose) => driver().connect(pick, choose);
// Vaste correctie voor de eigen M110S/40×30-rol: gebruikersmeting rechts circa2mm, onder1–1,5mm extra wit.
// Padding bewaart alle rasterpunten; verschuiven binnen hetzelfde canvas zou de laatste rijen afsnijden.
export function labelFrame(frame, print) {
	if (frame.W !== 320 || frame.H !== 240 || +print.offset) return frame;
	const dx = 8, dy = 6, W = frame.W + dx, H = frame.H + dy;
	const rgba = new Uint8ClampedArray(W * H * 4); rgba.fill(255);
	for (let y = 0; y < frame.H; y++) rgba.set(frame.rgba.subarray(y * frame.W * 4, (y + 1) * frame.W * 4), ((y + dy) * W + dx) * 4);
	return { rgba, W, H };
}
export function preparePrintDoc(doc) {
	if (doc.label.w !== 40 || doc.label.h !== 30 || +doc.print.offset) return doc;
	// Alleen het standaard buitenkader; eigen kaders en vergrendelde ontwerpen blijven intact.
	for (const e of doc.elements) if (e.type === 'border' && !e.locked && !e.rot && e.x === 1 && e.y === 1 && e.w === 38 && e.h === 28) {
		Object.assign(e, { x:.5, y:.5, w:39, h:29 });
	}
	return doc;
}
export const printLabels = (count, renderNth, print, progress) => driver().printLabels(count,
	async i => labelFrame(await renderNth(i), print), print, progress);

export function selftest() {
	const ok = transportFor({ serial: {}, bluetooth: {} }) === 'serial'
		&& transportFor({ bluetooth: {} }) === 'ble' && transportFor({}) === 'ble';
	const source = { rgba:Uint8ClampedArray.from({ length:320 * 240 * 4 }, (_, i) => i % 251), W:320, H:240 };
	const shifted = labelFrame(source, { offset:0 });
	const preserved = shifted.W === 328 && shifted.H === 246 && shifted.rgba[0] === 255
		&& shifted.rgba[(6 * 328 + 8) * 4] === 0 && shifted.rgba.at(-1) === source.rgba.at(-1)
		&& source.rgba.every((v, i) => shifted.rgba[((Math.floor(i / (320 * 4)) + 6) * 328 + 8) * 4 + i % (320 * 4)] === v)
		&& labelFrame(source, { offset:1 }) === source
		&& labelFrame({ ...source, W:384 }, { offset:0 }).W === 384;
	const doc = { label:{w:40,h:30}, print:{offset:0}, elements:[{type:'border',x:1,y:1,w:38,h:28}] };
	preparePrintDoc(doc);
	return { ok:ok && preserved && doc.elements[0].w === 39 && doc.elements[0].x === .5, details: ['Pc blijft Serial; BLE wordt bij verbinden opnieuw gedetecteerd door de BLE-driver.', '40×30 pc en mobiel: 8 dots rechts/6 dots omlaag, alle bronpixels behouden; andere maat/handmatige offset ongemoeid.'] };
}
