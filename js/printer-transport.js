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
export const printLabels = (...args) => driver().printLabels(...args);

// Nieuwe fysieke afdruk na rollback: hoogte goed, rechts meer wit. Alleen bestaande X-offset gebruiken.
export function printSettings(doc) {
	return doc.label.w === 40 && doc.label.h === 30 && !+doc.print.offset
		? { ...doc.print, offset:0.5 } : doc.print;
}

export function selftest() {
	const ok = transportFor({ serial: {}, bluetooth: {} }) === 'serial'
		&& transportFor({ bluetooth: {} }) === 'ble' && transportFor({}) === 'ble';
	const doc = { label:{w:40,h:30}, print:{offset:0, rotate180:false} }, settings = printSettings(doc);
	const px = new Uint8ClampedArray(320 * 240 * 4); px.fill(255);
	px.set([0,0,0,255], 0); px.set([0,0,0,255], px.length - 4);
	const raster = serial.encodeRaster(px, 320, 240, settings.offset * 8, false);
	const positioned = settings.offset === .5 && doc.print.offset === 0 && raster[6] === 240 && raster[7] === 0
		&& raster[8] === 8 && raster[8 + 239 * 41 + 40] === 16
		&& printSettings({...doc, label:{w:50,h:30}}) === doc.print
		&& printSettings({...doc, print:{offset:1}}).offset === 1;
	return { ok:ok && positioned, details: ['Pc blijft Serial; BLE wordt bij verbinden opnieuw gedetecteerd door de BLE-driver.'] };
}
