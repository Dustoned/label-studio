// Pc behoudt Serial; browsers zonder Serial gebruiken de losse BLE-driver.
import * as serial from './printer.js';
import * as ble from './printer-ble.js';

export const transportFor = (nav = globalThis.navigator) => nav?.serial ? 'serial' : 'ble';
let active = null;
const driver = () => active || (transportFor() === 'serial' ? serial : ble);
export function initPrinter(callbacks = {}) {
	active = driver();
	active.initPrinter(callbacks);
	if (active === ble) {
		callbacks.onConnection?.(false);
		callbacks.onStatus?.('Verbind je BLE-printer. Safari vereist de Beacio-extensie.');
	}
}
export const isConnected = () => driver().isConnected();
export const isBusy = () => driver().isBusy();
export const connect = pick => driver().connect(pick);
export const printLabels = (...args) => driver().printLabels(...args);

export function selftest() {
	const ok = transportFor({ serial: {}, bluetooth: {} }) === 'serial'
		&& transportFor({ bluetooth: {} }) === 'ble' && transportFor({}) === 'ble';
	return { ok, details: ['Pc blijft Serial; BLE wordt bij verbinden opnieuw gedetecteerd door de BLE-driver.'] };
}
