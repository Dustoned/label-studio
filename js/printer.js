// Printer-protocol en Web Serial-verbinding, letterlijk uit v1 (commit a8f7a0b). Printbytes NIET wijzigen.
// Protocol volgens phomemo-tools (cups/filter/rastertopm110.py).
import { DPM, MAX_W, sleep, hex } from './util.js';

// px = RGBA, zwart = R<128. Geeft het GS v 0-rasterblok terug (1 = zwarte dot, MSB links).
export function encodeRaster(px, W, H, off, rot) {
	const bpl = Math.min(MAX_W / 8, Math.ceil((W + off) / 8));
	const out = new Uint8Array(8 + bpl * H);
	out.set([0x1d, 0x76, 0x30, 0x00, bpl & 255, bpl >> 8, H & 255, H >> 8]);
	for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
		const sx = rot ? W - 1 - x : x, sy = rot ? H - 1 - y : y;
		if (px[(sy * W + sx) * 4] >= 128) continue;
		const ox = x + off;
		if (ox < bpl * 8) out[8 + y * bpl + (ox >> 3)] |= 0x80 >> (ox & 7);
	}
	return out;
}

export function buildJob(raster, { speed, density, media }) {
	// 1f 11 35 00 + 1f 11 23 <speed> komen uit de officiele QuYin-driver (M1xx.GPD-output); zonder die twee
	// weigert firmware 2.4.4 elke rasteropdracht met 1a 0b b8. Geslaagd = 1a 0f 0c.
	const head = [0x1f,0x11,0x35,0x00, 0x1f,0x11,0x23,speed, 0x1b,0x4e,0x04,density, 0x1f,0x11,media];
	const foot = [0x1f,0xf0,0x05,0x00, 0x1f,0xf0,0x03,0x00];
	const out = new Uint8Array(head.length + raster.length + foot.length);
	out.set(head); out.set(raster, head.length); out.set(foot, head.length + raster.length);
	return out;
}

// Printer via Bluetooth Classic (SPP) met Web Serial. BLE vanaf Windows weigert de M110S;
// SPP werkt zodra de printer in Windows gekoppeld is (dan bestaat er een Bluetooth-COM-poort).
const SPP = '00001101-0000-1000-8000-00805f9b34fb';
let port = null, reader = null, writer = null, busy = false, pending = null, inited = false;
let cb = { onStatus() {}, onLog() {}, onConnection() {} };

const setStatus = (t, cls = '') => cb.onStatus(t, cls);
const log = t => cb.onLog(t);
const updBtns = () => cb.onConnection(!!writer);

export function initPrinter(callbacks = {}) {
	cb = { ...cb, ...callbacks };
	if (inited) return;
	inited = true;
	// v1: bij laden en bij het aanzetten van een gekoppelde printer verbinden zonder klik.
	navigator.serial?.addEventListener('connect', () => connect(false));
	connect(false);
}

export const isConnected = () => !!writer;
export const isBusy = () => busy;

// Een eerder gekozen printer opent zonder klik. Alleen de allereerste keer (pick, vanuit een klik) volgt een keuzelijst.
// pending: boot, 'connect'-event en een klik mogen elkaar niet kruisen (dubbele port.open faalt).
// Klikt iemand tijdens een stille poging, dan daarna alsnog met keuzelijst.
export function connect(pick) {
	if (pending) return pick ? pending.then(ok => ok || connect(true)) : pending;
	return pending = openPort(pick).finally(() => pending = null);
}

async function openPort(pick) {
	if (writer) return true;
	if (!navigator.serial) { setStatus('Open deze pagina in Chrome of Edge', 'err'); return false; }
	try {
		port ||= (await navigator.serial.getPorts()).find(p => p.getInfo().bluetoothServiceClassId === SPP) || null;
		if (!port && pick) port = await navigator.serial.requestPort({filters:[{bluetoothServiceClassId:SPP}], allowedBluetoothServiceClassIds:[SPP]});
		if (!port) { setStatus('Klik op Printer koppelen en kies je printer'); return false; }
		setStatus('Verbinden...');
		await port.open({baudRate:115200});
		writer = port.writable.getWriter();
		readLoop();
		setStatus('Printer verbonden', 'ok');
		return true;
	} catch (e) {
		log(`verbinden: ${e.name}: ${e.message}`);
		setStatus(e.name === 'NotFoundError' ? 'Geen printer gekozen' : 'Printer niet bereikbaar. Staat hij aan?', 'err');
		return false;
	} finally { updBtns(); }
}

// Leest printer-antwoorden; eindigt de stroom (printer uit, of reader.cancel() na een fout) dan ruimt dit alles op.
async function readLoop() {
	reader = port.readable.getReader();
	try {
		for (let r; !(r = await reader.read()).done;) {
			const h = hex(r.value);
			log('printer: ' + h);
			if (h.includes('1a 0b b8')) setStatus('Printer weigerde het label', 'err');
		}
	} catch {}
	reader.releaseLock(); reader = null;
	writer?.releaseLock(); writer = null;
	await port.close().catch(() => {});
	setStatus('Verbinding met printer verloren. Klik Print om opnieuw te verbinden.', 'err');
	updBtns();
}

// renderNth(i) => { rgba, W, H } (mag ook een Promise zijn). Resolvet met het aantal verstuurde labels.
export async function printLabels(count, renderNth, print, onProgress) {
	if (busy || !await connect(true)) return 0;
	busy = true; updBtns();
	let n = 0;
	try {
		for (let i = 0; i < count; i++) {
			setStatus(`Printen ${i + 1}/${count}...`, 'ok');
			const { rgba, W, H } = await renderNth(i);
			// Negatieve offset schreef in v1 in de rasterkop; 0 is de veilige ondergrens.
			const bytes = buildJob(encodeRaster(rgba, W, H, Math.max(0, Math.round(print.offset * DPM) || 0), !!print.rotate180), print);
			await writer.write(bytes);
			log(`label ${++n}: ${bytes.length} bytes verstuurd`);
			onProgress?.(n, count);
			await sleep(300);
		}
		setStatus(`Klaar: ${count} label(s)`, 'ok');
	} catch (e) {
		log(`printfout: ${e.name}: ${e.message}`);
		setStatus('Printfout: ' + e.message, 'err');
		reader?.cancel();
	}
	busy = false; updBtns();
	return n;
}

export function selftest() {
	const details = [];
	const px = new Uint8ClampedArray(16 * 2 * 4).fill(255);
	const black = (x, y) => { const i = (y * 16 + x) * 4; px[i] = px[i+1] = px[i+2] = 0; };
	for (let x = 0; x < 8; x++) black(x, 0);
	for (let x = 0; x < 16; x += 2) black(x, 1);
	const raster = encodeRaster(px, 16, 2, 0, false);
	const cases = [
		['raster', raster, '1d 76 30 00 02 00 02 00 ff 00 aa aa'],
		['raster 180', encodeRaster(px, 16, 2, 0, true), '1d 76 30 00 02 00 02 00 55 55 00 ff'],
		['raster offset 4', encodeRaster(px, 16, 2, 4, false), '1d 76 30 00 03 00 02 00 0f f0 00 0a aa a0'],
		// v1 job() met state.speed 5, density 10, media 10.
		['job 5/10/10', buildJob(raster, {speed:5, density:10, media:10}),
			'1f 11 35 00 1f 11 23 05 1b 4e 04 0a 1f 11 0a 1d 76 30 00 02 00 02 00 ff 00 aa aa 1f f0 05 00 1f f0 03 00'],
	];
	let ok = true;
	for (const [name, got, exp] of cases) {
		const pass = hex(got) === exp;
		ok &&= pass;
		details.push(`${pass ? 'ok' : 'FAIL'} ${name}${pass ? '' : `: ${hex(got)} != ${exp}`}`);
	}
	return { ok, details };
}
