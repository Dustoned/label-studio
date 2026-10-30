// BLE blijft los van de bevroren, werkende Web Serial-driver.
// UUIDs/commandopdeling: https://github.com/mkuhlmann/pyphomemo/blob/main/src/pyphomemo/printer.py
// shortcut: M110-profiel; Q450E/firmware 2.4.4 vereist nog een echte iPhone/printer-proef.
import { encodeRaster, buildJob } from './printer.js';
import { DPM, hex, sleep } from './util.js';

const uuid = n => `0000${n}-0000-1000-8000-00805f9b34fb`;
const SERVICE = uuid('ff00'), WRITE = uuid('ff02'), NOTIFY = uuid('ff03');

export function createBlePrinter({ getBluetooth = () => globalThis.navigator?.bluetooth,
	pause = sleep, timeout = 15000 } = {}) {
	let cb = { onStatus() {}, onLog() {}, onConnection() {} };
	let device = null, writer = null, notify = null, pending = false, busy = false;
	let tail = [], reply = null;
	const status = (text, cls = '') => cb.onStatus(text, cls);
	const isConnected = () => !!writer && !!device?.gatt?.connected;
	const limit = (promise, label) => new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(`${label}: geen antwoord binnen ${timeout / 1000} s.`)), timeout);
		Promise.resolve(promise).then(v => { clearTimeout(timer); resolve(v); }, e => { clearTimeout(timer); reject(e); });
	});
	function clearConnection() {
		reply?.finish(new Error('Bluetooth-verbinding verbroken; controleer het laatste label.'));
		if (notify) notify.removeEventListener('characteristicvaluechanged', received);
		if (device) device.removeEventListener('gattserverdisconnected', disconnected);
		const old = device;
		device = writer = notify = null;
		tail = [];
		try { old?.gatt?.disconnect(); } catch { /* Reeds verbroken. */ }
		cb.onConnection(false);
	}
	function disconnected() {
		clearConnection();
		status('Bluetooth-verbinding verbroken. Verbind opnieuw.', 'err');
	}
	function received(event) {
		const value = event.target.value;
		const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
		cb.onLog(`BLE RX ${hex(bytes)}`);
		const data = [...tail, ...bytes];
		let accepted = false, rejected = false;
		for (let i = 0; i + 2 < data.length; i++) if (data[i] === 0x1a) {
			if (data[i + 1] === 0x0b && data[i + 2] === 0xb8) rejected = true;
			if (data[i + 1] === 0x0f && data[i + 2] === 0x0c) accepted = true;
		}
		tail = data.slice(-2);
		if (rejected) reply?.finish(new Error('Printer weigert het label (1a 0b b8). BLE-compatibiliteit niet bevestigd.'));
		else if (accepted && reply?.armed) reply.finish();
	}
	async function connect(pick = false) {
		if (isConnected()) return true;
		if (!pick || pending || busy) return false;
		const bluetooth = getBluetooth();
		if (!bluetooth?.requestDevice) {
			status('Web Bluetooth ontbreekt. Activeer Beacio in Safari en probeer opnieuw.', 'err');
			return false;
		}
		pending = true;
		let selected = null, expired = false;
		try {
			// Geen await vóór de picker: Safari moet de knopklik nog als gebruikersgebaar zien.
			const selection = bluetooth.requestDevice({ filters: [
				{ services: [SERVICE] }, { namePrefix: 'Q450' }, { namePrefix: 'M110' }, { namePrefix: 'Phomemo' }
			], optionalServices: [SERVICE] });
			status('Kies je BLE-labelprinter…');
			// De gebruiker bepaalt de scantijd; alleen GATT-operaties krijgen een timeout.
			selected = await selection;
			device = selected;
			device.addEventListener('gattserverdisconnected', disconnected);
			const connection = device.gatt.connect();
			// Een laat geslaagde GATT-connectie na timeout mag niet blijven hangen.
			Promise.resolve(connection).then(() => { if (expired) selected.gatt.disconnect(); }, () => {});
			const server = await limit(connection, 'Bluetooth verbinden');
			const service = await limit(server.getPrimaryService(SERVICE), 'BLE-service FF00');
			const chars = await limit(service.getCharacteristics(), 'BLE-kenmerken');
			cb.onLog(`BLE FF00: ${chars.map(c => `${c.uuid} [${['write', 'writeWithoutResponse', 'notify', 'indicate'].filter(k => c.properties[k]).join(', ')}]`).join('; ')}`);
			const write = chars.find(c => c.uuid.toLowerCase() === WRITE);
			notify = chars.find(c => c.uuid.toLowerCase() === NOTIFY);
			if (!write || !(write.properties.writeWithoutResponse && write.writeValueWithoutResponse || write.properties.write && write.writeValueWithResponse)
				|| !notify || !(notify.properties.notify || notify.properties.indicate)) {
				throw new Error('Onbekend BLE-profiel: FF02 schrijven en FF03 meldingen vereist. Er is niets verstuurd.');
			}
			notify.addEventListener('characteristicvaluechanged', received);
			await limit(notify.startNotifications(), 'BLE-meldingen');
			if (!device?.gatt.connected) throw new Error('Bluetooth-verbinding verbroken.');
			writer = write;
			cb.onConnection(true);
			status('BLE verbonden · printondersteuning nog te bevestigen');
			return true;
		} catch (e) {
			expired = true;
			clearConnection();
			status(e.name === 'NotFoundError' ? 'Geen BLE-printer gekozen of geschikt profiel gevonden.' : e.message, 'err');
			return false;
		} finally { pending = false; }
	}
	function waitForReply() {
		// shortcut: ACK heeft geen opdracht-id; een sterk vertraagde ACK blijft ambigu.
		// Na fouten verbreken we daarom de verbinding; bevestig dit gedrag met echte hardware.
		let settle;
		const promise = new Promise(resolve => { settle = resolve; });
		const state = { armed: false, error: null, done: false, promise,
			finish(error = null) {
				// Een weigering ná een ACK maar vóór het einde van de verzendpauze telt ook.
				if (error) state.error = error;
				state.done = true;
				settle();
			}
		};
		tail = [];
		reply = state;
		return state;
	}
	async function printLabels(count, renderNth, print, onProgress = () => {}) {
		if (busy || pending) return 0;
		if (!isConnected()) { status('Verbind eerst via de knop ‘BLE verbinden’.', 'err'); return 0; }
		if (!Number.isInteger(count) || count < 1) return 0;
		busy = true;
		let printed = 0;
		try {
			for (let i = 0; i < count; i++) {
				const { rgba, W, H } = await renderNth(i);
				if (!Number.isInteger(W) || !Number.isInteger(H) || W < 1 || W > 50 * DPM || H < 1 || H > 65535 || rgba.length !== W * H * 4) throw new Error('Ongeldig labelraster.');
				const job = buildJob(encodeRaster(rgba, W, H, Math.max(0, Math.round(print.offset * DPM) || 0), !!print.rotate180), print);
				const response = waitForReply();
				const send = async bytes => {
					for (let start = 0; start < bytes.length; start += 20) {
						if (response.error) throw response.error;
						if (!isConnected()) throw new Error('Bluetooth-verbinding verbroken.');
						const chunk = bytes.slice(start, start + 20);
						const method = writer.properties.writeWithoutResponse && writer.writeValueWithoutResponse ? 'writeValueWithoutResponse' : 'writeValueWithResponse';
						await limit(writer[method](chunk), 'BLE schrijven');
						await pause(20);
					}
				};
				status(`BLE: label ${i + 1} / ${count} versturen…`);
				// Exacte buildJob-bytes, met afzonderlijke firmwarecommando's en rasterheader.
				for (const [a, b] of [[0, 4], [4, 8], [8, 12], [12, 15]]) {
					await send(job.slice(a, b)); await pause(30);
				}
				await send(job.slice(15, 23));
				await send(job.slice(23, -8));
				await pause(300);
				response.armed = true;
				await send(job.slice(-8));
				await pause(500);
				await limit(response.promise, 'Printerbevestiging ontbreekt; label mogelijk al geprint');
				if (response.error) throw response.error;
				reply = null;
				printed++;
				onProgress?.(printed, count);
			}
			status(`${printed} label(s) door de printer bevestigd.`, 'ok');
		} catch (e) {
			clearConnection();
			status(`${e.message} ${printed}/${count} label(s) bevestigd. Controleer vóór opnieuw printen.`, 'err');
		} finally { reply = null; busy = false; }
		return printed;
	}
	return { initPrinter(callbacks = {}) { cb = { ...cb, ...callbacks }; },
		isConnected, isBusy: () => busy || pending, connect, printLabels };
}

const printer = createBlePrinter();
export const { initPrinter, isConnected, isBusy, connect, printLabels } = printer;

export async function selftest() {
	const details = [];
	const assert = (yes, text) => { if (!yes) throw new Error(text); details.push(text); };
	function mock(mode = 'ack') {
		const listeners = new Map(), writes = [];
		const emit = bytes => notification.listener?.({ target: { value: new DataView(Uint8Array.from(bytes).buffer) } });
		const notification = { uuid: NOTIFY, properties: { notify: true },
			addEventListener(_, fn) { this.listener = fn; }, removeEventListener() { this.listener = null; },
			async startNotifications() {} };
		const writable = { uuid: WRITE, properties: { writeWithoutResponse: true }, async writeValueWithoutResponse(data) {
			writes.push(...data);
			if (mode === 'write-error') throw new Error('schrijffout');
			if (mode === 'disconnect') { device.gatt.connected = false; listeners.get('gattserverdisconnected')?.(); }
			if (data.length === 8 && data[0] === 0x1f && data[1] === 0xf0) {
				if (mode === 'ack') { emit([0x99, 0x1a]); emit([0x0f]); emit([0x0c, 0x77]); }
				if (mode === 'reject') emit([0x1a, 0x0f, 0x0c, 0x1a, 0x0b, 0xb8]);
			}
		} };
		if (mode === 'with-response') {
			writable.properties.write = true;
			writable.writeValueWithResponse = writable.writeValueWithoutResponse;
			delete writable.writeValueWithoutResponse;
			mode = 'ack';
		}
		const service = { async getCharacteristics() { return mode === 'unknown' ? [notification] : [writable, notification]; } };
		const device = { addEventListener(n, f) { listeners.set(n, f); }, removeEventListener(n) { listeners.delete(n); },
			gatt: { connected: false, async connect() { this.connected = true; return this; },
				async getPrimaryService(id) { if (id !== SERVICE) throw new Error('UUID'); return service; },
				disconnect() { this.connected = false; } } };
		let picks = 0;
		const bluetooth = { requestDevice() { picks++; return Promise.resolve(device); } };
		const p = createBlePrinter({ getBluetooth: () => bluetooth, pause: async () => {}, timeout: 20 });
		return { p, writes, bluetooth, setMode(value) { mode = value; }, get picks() { return picks; } };
	}
	const print = { speed: 5, density: 10, media: 10, offset: 0 };
	const frame = { W: 8, H: 1, rgba: new Uint8Array(32) };
	try {
		const m = mock();
		m.p.initPrinter();
		assert(m.picks === 0 && !await m.p.connect(false), 'init/passief verbinden opent geen picker');
		assert(await m.p.printLabels(1, () => frame, print) === 0 && m.picks === 0, 'print zonder verbinding opent geen picker');
		const connecting = m.p.connect(true);
		assert(m.picks === 1, 'picker start synchroon vanuit knopgebaar');
		assert(await connecting, 'bekend GATT-profiel verbindt');
		assert(await m.p.printLabels(1, () => frame, print) === 1, 'gefragmenteerde ACK bevestigt label');
		assert(hex(m.writes) === hex(buildJob(encodeRaster(frame.rgba, 8, 1, 0, false), print)), 'BLE behoudt alle bevroren printbytes');
		const wide = mock(); await wide.p.connect(true);
		const wideFrame = { W: 400, H: 1, rgba: new Uint8Array(1600) };
		const wideRaster = encodeRaster(wideFrame.rgba, 400, 1, 0, false);
		assert(await wide.p.printLabels(1, () => wideFrame, print) === 1 && wideRaster[4] === 48
			&& hex(wide.writes) === hex(buildJob(wideRaster, print)),
			'50mm-label behoudt frozen job met 384px printbreedte');
		const fallback = mock('with-response'); await fallback.p.connect(true);
		assert(await fallback.p.printLabels(1, () => frame, print) === 1,
			'writeWithResponse werkt wanneer writeWithoutResponse-methode ontbreekt');
		for (const mode of ['reject', 'write-error', 'disconnect', 'silent']) {
			const test = mock(mode); await test.p.connect(true);
			assert(await test.p.printLabels(1, () => frame, print) === 0 && !test.p.isBusy() && !test.p.isConnected(), `${mode}: geen vals succes, verbinding en busy opgeruimd`);
		}
		const unknown = mock('unknown');
		assert(!await unknown.p.connect(true) && !unknown.writes.length, 'onbekend profiel weigert zonder schrijfacties');
		const b = mock(); await b.p.connect(true);
		let release;
		const running = b.p.printLabels(1, () => new Promise(r => { release = r; }), print);
		assert(await b.p.printLabels(1, () => frame, print) === 0, 'gelijktijdige print geblokkeerd');
		release(frame); await running;
		const batch = mock(); await batch.p.connect(true);
		assert(await batch.p.printLabels(2, () => frame, print, () => batch.setMode('reject')) === 1,
			'batch telt uitsluitend bevestigde labels vóór weigering');
		const late = mock();
		let injected = null;
		const dynamic = createBlePrinter({ getBluetooth: () => injected, pause: async () => {}, timeout: 20 });
		dynamic.initPrinter();
		assert(!await dynamic.connect(true), 'ontbrekende extensie wordt gemeld');
		injected = late.bluetooth;
		assert(await dynamic.connect(true), 'later geïnjecteerde Web Bluetooth wordt opnieuw gedetecteerd');
		return { ok: true, details };
	} catch (e) { return { ok: false, details: [...details, e.message] }; }
}
