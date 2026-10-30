// BLE blijft los van de bevroren, werkende Web Serial-driver.
// UUIDs/commandopdeling: https://github.com/mkuhlmann/pyphomemo/blob/main/src/pyphomemo/printer.py
// shortcut: M110-profiel; Q450E/firmware 2.4.4 vereist nog een echte iPhone/printer-proef.
import { encodeRaster, buildJob } from './printer.js';
import { DPM, hex, sleep, load, store } from './util.js';

const uuid = n => `0000${n}-0000-1000-8000-00805f9b34fb`;
const SERVICE = uuid('ff00'), WRITE = uuid('ff02'), NOTIFY = uuid('ff03');

export function createBlePrinter({ getBluetooth = () => globalThis.navigator?.bluetooth,
	pause = sleep, now = () => performance.now(), timeout = 15000,
	memory = { read: () => null, write() {} } } = {}) {
	let cb = { onStatus() {}, onLog() {}, onConnection() {} };
	let device = null, writer = null, notify = null, pending = false, busy = false;
	let chunkSize = 20;
	let remembered = null, restoring = false, suspended = false, generation = 0;
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
		chunkSize = 20;
		tail = [];
		try { Promise.resolve(old?.gatt?.disconnect()).catch(() => {}); } catch { /* Reeds verbroken. */ }
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
	async function connect(pick = false, choose = false) {
		if (suspended || pending || busy || (pick && restoring)) return false;
		if (choose) { clearConnection(); remembered = null; }
		if (isConnected()) return true;
		if (!pick && !remembered) return false;
		const bluetooth = getBluetooth();
		if (!bluetooth?.requestDevice) {
			status('Web Bluetooth ontbreekt. Activeer Beacio in Safari en probeer opnieuw.', 'err');
			return false;
		}
		pending = true;
		const epoch = generation;
		let selected = null, expired = false;
		try {
			// Geen await vóór de picker: Safari moet de knopklik nog als gebruikersgebaar zien.
			const selection = remembered || bluetooth.requestDevice({ filters: [
				{ services: [SERVICE] }, { namePrefix: 'Q450' }, { namePrefix: 'M110' }, { namePrefix: 'Phomemo' }
			], optionalServices: [SERVICE] });
			status(remembered ? 'Opnieuw verbinden met je printer…' : 'Kies je BLE-labelprinter…');
			// De gebruiker bepaalt de scantijd; alleen GATT-operaties krijgen een timeout.
			selected = await selection;
			if (suspended || epoch !== generation) return false;
			device = selected;
			device.addEventListener('gattserverdisconnected', disconnected);
			const connection = device.gatt.connected ? device.gatt : device.gatt.connect();
			// Een laat geslaagde GATT-connectie na timeout mag niet blijven hangen.
			Promise.resolve(connection).then(() => { if (expired || suspended || epoch !== generation) selected.gatt.disconnect(); }, () => {});
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
			// Beacio exposeert deze optionele GATT-limieten ook aan zijn eigen SDK.
			// Zonder gerapporteerde limiet blijft de veilige ATT-payload 20 bytes.
			try {
				const limits = await limit(server.getWriteLimits?.(), 'BLE-pakketgrootte');
				const size = write.properties.writeWithoutResponse && write.writeValueWithoutResponse ? limits?.withoutResponse : limits?.withResponse;
				// Sommige extensieversies melden alleen getMtu; die route werd onbedoeld 20 bytes.
				const mtu = limits?.mtu ?? (Number.isInteger(size) && size > 0 ? null : await limit(server.getMtu?.(), 'BLE-MTU'));
				const payload = Number.isInteger(size) && size > 0 ? size : (Number.isInteger(mtu) && mtu > 3 ? mtu - 3 : 20);
				if (Number.isInteger(payload) && payload >= 20) chunkSize = Math.min(128, payload);
			} catch { /* Optionele metadata; geen grotere pakketten gokken. */ }
			if (suspended || epoch !== generation || !device?.gatt.connected) throw new Error('Bluetooth-verbinding verbroken.');
			writer = write;
			remembered = selected;
			try { if (selected.id) memory.write(selected.id); } catch { /* Opslag is optioneel. */ }
			cb.onLog(`BLE verzenden: ${chunkSize} bytes per pakket, minimaal 200 ms tussen writes.`);
			cb.onConnection(true);
			status('BLE verbonden · printondersteuning nog te bevestigen');
			return true;
		} catch (e) {
			expired = true;
			clearConnection();
			if (!suspended) status(e.name === 'NotFoundError' ? 'Geen BLE-printer gekozen of geschikt profiel gevonden.' : e.message, 'err');
			return false;
		} finally { pending = false; }
	}
	async function restore() {
		if (suspended || restoring || pending || busy || isConnected()) return false;
		restoring = true;
		const epoch = generation;
		try {
			if (!remembered) {
				const id = memory.read(), bluetooth = getBluetooth();
				if (!id || !bluetooth?.getDevices) return false;
				const devices = await limit(bluetooth.getDevices(), 'Bekende printer ophalen');
				if (suspended || epoch !== generation || pending) return false;
				remembered = devices.find(d => d.id === id) || null;
			}
			return await connect(false);
		} catch (e) { cb.onLog(`Printer herstellen: ${e.message}`); return false; }
		finally { restoring = false; }
	}
	function release() { suspended = true; generation++; clearConnection(); }
	function resume() { suspended = false; return restore(); }
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
				let sent = 0, percent = -1;
				const send = async bytes => {
					for (let start = 0; start < bytes.length; start += chunkSize) {
						if (response.error) throw response.error;
						if (!isConnected()) throw new Error('Bluetooth-verbinding verbroken.');
						const chunk = bytes.slice(start, start + chunkSize);
						const method = writer.properties.writeWithoutResponse && writer.writeValueWithoutResponse ? 'writeValueWithoutResponse' : 'writeValueWithResponse';
						const started = now();
						await limit(writer[method](chunk), 'BLE schrijven');
						sent += chunk.length;
						const next = Math.floor(sent / job.length * 10) * 10;
						if (next !== percent) { percent = next; status(`BLE: label ${i + 1} / ${count} versturen · ${percent}%`); }
						// 20 ms veroorzaakte de gemelde extensielimiet. Geen automatische herhaling van printbytes.
						// De bridge-wachttijd telt mee: niet nog 200 ms bovenop een trage write wachten.
						await pause(Math.max(0, 200 - (now() - started)));
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
			const message = /rate limit|too many BLE requests/i.test(e.message)
				? 'Bluetooth-extensie begrenst het verzenden. Wacht een minuut en verbind opnieuw. Zet bij een onvolledig label de printer eerst uit en aan.' : e.message;
			status(`${message} ${printed}/${count} label(s) bevestigd. Controleer vóór opnieuw printen.`, 'err');
		} finally { reply = null; busy = false; }
		return printed;
	}
	return { initPrinter(callbacks = {}) { cb = { ...cb, ...callbacks }; },
		isConnected, isBusy: () => busy || pending || restoring, connect, printLabels, restore, release, resume };
}

const printer = createBlePrinter({ memory: { read: () => load('labelstudio.ble.device'), write: id => store('labelstudio.ble.device', id) } });
export const { initPrinter, isConnected, isBusy, connect, printLabels, restore, release, resume } = printer;

export async function selftest() {
	const details = [];
	const assert = (yes, text) => { if (!yes) throw new Error(text); details.push(text); };
	function mock(mode = 'ack', memory = { read: () => null, write() {} }) {
		const listeners = new Map(), writes = [];
		let clock = 0;
		const times = [], sizes = [];
		const emit = bytes => notification.listener?.({ target: { value: new DataView(Uint8Array.from(bytes).buffer) } });
		const notification = { uuid: NOTIFY, properties: { notify: true },
			addEventListener(_, fn) { this.listener = fn; }, removeEventListener() { this.listener = null; },
			async startNotifications() {} };
		const writable = { uuid: WRITE, properties: { writeWithoutResponse: true }, async writeValueWithoutResponse(data) {
			if (mode === 'rate-error') throw new Error('Rate limit exceeded — too many BLE requests');
			if (mode === 'limited' && times.filter(t => clock - t < 1000).length >= 5) throw new Error('Rate limit exceeded — too many BLE requests');
			times.push(clock); sizes.push(data.length);
			if (mode === 'slow-bridge') clock += 120;
			writes.push(...data);
			if (mode === 'write-error') throw new Error('schrijffout');
			if (mode === 'disconnect') { device.gatt.connected = false; listeners.get('gattserverdisconnected')?.(); }
			if (data.length === 8 && data[0] === 0x1f && data[1] === 0xf0) {
				if (['ack', 'limited', 'mtu', 'mtu-only', 'slow-bridge'].includes(mode)) { emit([0x99, 0x1a]); emit([0x0f]); emit([0x0c, 0x77]); }
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
		let connections = 0, discoveries = 0;
		const device = { id: 'test-printer', addEventListener(n, f) { listeners.set(n, f); }, removeEventListener(n) { listeners.delete(n); },
			gatt: { connected: false, async connect() { connections++; this.connected = true; return this; },
				async getPrimaryService(id) { discoveries++; if (id !== SERVICE) throw new Error('UUID'); return service; },
				disconnect() { this.connected = false; } } };
		let picks = 0;
		if (mode === 'mtu') device.gatt.getWriteLimits = async () => ({ withoutResponse: 182 });
		if (mode === 'mtu-only') device.gatt.getMtu = async () => 185;
		const bluetooth = { requestDevice() { picks++; return Promise.resolve(device); }, async getDevices() { return [device]; } };
		const p = createBlePrinter({ getBluetooth: () => bluetooth, pause: async ms => { clock += ms; }, now: () => clock, timeout: 20, memory });
		return { p, writes, bluetooth, times, sizes, device, listeners, setMode(value) { mode = value; },
			get picks() { return picks; }, get connections() { return connections; }, get discoveries() { return discoveries; } };
	}
	const print = { speed: 5, density: 10, media: 10, offset: 0 };
	const frame = { W: 8, H: 1, rgba: new Uint8Array(32) };
	try {
		let stored = null;
		const memory = { read: () => stored, write: id => { stored = id; } };
		const first = mock('ack', memory);
		assert(!await first.p.restore() && first.picks === 0, 'eerste bezoek opent nooit automatisch apparaatkeuze');
		await first.p.connect(true);
		assert(stored === 'test-printer', 'succesvol gekozen printer-id wordt onthouden');
		first.p.release();
		assert(!first.p.isConnected() && !first.device.gatt.connected && !first.listeners.size, 'pagina verlaten geeft verbinding en listeners vrij');
		const reload = mock('ack', memory);
		reload.device.gatt.connected = true;
		assert(await reload.p.restore() && reload.picks === 0 && reload.connections === 0 && reload.discoveries === 1,
			'refresh herstelt bekende actieve GATT zonder picker of dubbele connect');
		reload.device.gatt.connected = false; reload.listeners.get('gattserverdisconnected')();
		assert(await reload.p.connect(true) && reload.picks === 0 && reload.discoveries === 2, 'echte disconnect: dezelfde printer opnieuw verbinden met verse kenmerken');
		reload.p.release();
		assert(await reload.p.resume() && reload.picks === 0, 'terug naar pagina herstelt printer zonder kiezer');
		assert(await reload.p.connect(true, true) && reload.picks === 1, 'andere printer kiezen blijft expliciet beschikbaar');
		stored = 'ander-apparaat';
		const missing = mock('ack', memory);
		assert(!await missing.p.restore() && missing.picks === 0 && missing.connections === 0, 'geen toestemming voor opgeslagen id: geen willekeurige andere printer');
		stored = 'test-printer';
		const racing = mock('ack', memory);
		let found;
		racing.bluetooth.getDevices = () => new Promise(resolve => { found = resolve; });
		const restoring = racing.p.restore(); racing.p.release(); found([racing.device]);
		assert(!await restoring && !racing.p.isConnected() && racing.connections === 0, 'pagina verlaten tijdens lookup voorkomt late verbinding');
		const m = mock();
		m.p.initPrinter();
		assert(m.picks === 0 && !await m.p.connect(false), 'init/passief verbinden opent geen picker');
		assert(await m.p.printLabels(1, () => frame, print) === 0 && m.picks === 0, 'print zonder verbinding opent geen picker');
		const connecting = m.p.connect(true);
		assert(m.picks === 1, 'picker start synchroon vanuit knopgebaar');
		assert(await connecting, 'bekend GATT-profiel verbindt');
		assert(await m.p.printLabels(1, () => frame, print) === 1, 'gefragmenteerde ACK bevestigt label');
		assert(hex(m.writes) === hex(buildJob(encodeRaster(frame.rgba, 8, 1, 0, false), print)), 'BLE behoudt alle bevroren printbytes');
		const label = { W:320, H:240, rgba:new Uint8Array(320 * 240 * 4) };
		for (const mode of ['limited', 'mtu', 'mtu-only', 'slow-bridge']) {
			const test = mock(mode); await test.p.connect(true);
			assert(await test.p.printLabels(1, () => label, print) === 1
				&& hex(test.writes) === hex(buildJob(encodeRaster(label.rgba, label.W, label.H, 0, false), print))
				&& test.times.every((t, i) => !i || t - test.times[i - 1] >= 200)
				&& Math.max(...test.sizes) === (mode.startsWith('mtu') ? 128 : 20),
				`${mode}: volledig 40x30-label byte-identiek, begrensd tempo en veilige pakketgrootte`);
			if (mode === 'slow-bridge') assert(test.times[6] - test.times[5] === 200, 'bridge-latency telt mee: 120ms write + 80ms pauze, geen dubbele wachttijd');
			if (mode === 'mtu-only') assert(test.times.length === 81, 'MTU-only: 81 writes voor 40x30 in plaats van 486');
		}
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
		const throttled = mock('rate-error');
		let errorText = '';
		throttled.p.initPrinter({ onStatus: text => { errorText = text; } });
		await throttled.p.connect(true);
		assert(await throttled.p.printLabels(2, () => frame, print) === 0 && !throttled.p.isConnected()
			&& !throttled.writes.length && errorText.includes('Wacht een minuut'), 'rate-limit stopt batch zonder herprint en geeft hersteladvies');
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
