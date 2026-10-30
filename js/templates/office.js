// Templates kantoor & archief, verzending & retour, winkel & prijzen, inventaris & tech/kabels.
// Alles exact 40 × 30 mm rechthoekig (de rol van de speler); plain data, geen imports.
// Elk variabel stukje is een veld in doc.fields; keuzes sturen invert/hidden via el.rules.
const LABEL = { w: 40, h: 30, shape: 'rect' };
const B = { bold: true }, I = { italic: true };
const MONT = 'Montserrat', OSW = 'Oswald', MONO = 'Roboto Mono';
const r2 = v => Math.round(v * 100) / 100;

// Bouwstenen; ontbrekende velden vult doc.normalizeTemplateDoc met de defaults. Tekst krimpt altijd mee (fit 'shrink').
const txt = (text, x, y, w, h, o = {}) => ({ type: 'text', text, x, y, w, h, fit: 'shrink', ...o });
const one = (text, x, y, w, h, o = {}) => txt(text, x, y, w, h, { align: 'center', valign: 'middle', wrap: false, ...o });   // één regel
const lt = (text, x, y, w, h, o = {}) => one(text, x, y, w, h, { align: 'left', ...o });
const cap = (text, x, y, w, h, o = {}) => lt(text, x, y, w, h, { size: 1.9, ...B, letterSpacing: 0.3, ...o });           // kopje
const brd = (style, stroke = 0.5) => ({ type: 'border', style, stroke, x: 1, y: 1, w: 38, h: 28 });
const box = (x, y, w, h, o = {}) => ({ type: 'shape', shape: 'rect', stroke: 0.35, fill: 'none', x, y, w, h, ...o });
const blk = (x, y, w, h, o = {}) => box(x, y, w, h, { stroke: 0, fill: 'black', ...o });
const hr = (x, y, w, t = 0.3) => blk(x, y, w, t);
const vr = (x, y, h, t = 0.3) => blk(x, y, t, h);
const ico = (icon, x, y, s, o = {}) => ({ type: 'icon', source: 'tabler', icon, set: 'outline', nodes: [], stroke: 2, x, y, w: s, h: s, ...o });
// gewicht 600: dunne emoji-lijnen vallen op 203 dpi weg
const emo = (char, x, y, s, o = {}) => ({ type: 'emoji', char, style: 'mono', weight: 600, x, y, w: s, h: s, ...o });
const bc = (data, x, y, w, h, o = {}) => ({ type: 'barcode', data, symbology: 'code128', showText: false, textSize: 2.2, x, y, w, h, ...o });
const qr = (data, x, y, s, o = {}) => ({ type: 'qr', data, symbology: 'qrcode', ecc: 'M', x, y, w: s, h: s, ...o });

// Keuzes: gekozen optie zwart (invert; een leeg vak dat inverteert wordt een zwart vlak). Varianten op dezelfde plek zijn
// alleen zichtbaar bij hun eigen optie; zonder regel-match (lege of onbekende CSV-waarde) staat er geen, anders print een
// typfout de variant van een andere optie.
const pick = (field, opt) => [{ field, equals: opt, set: { invert: true } }];
const showIf = (field, opt, all) => ({ hidden: true, rules: all.map(o => ({ field, equals: o, set: { hidden: o !== opt } })) });
const hideIf = (field, ...opts) => opts.map(o => ({ field, equals: o, set: { hidden: true } }));
// Rij segmentknoppen: omlijnde balk met scheidingen, het gekozen segment wordt zwart.
function segs(field, opts, x, y, w, h, o = {}) {
	const sw = w / opts.length, out = [box(x, y, w, h)];
	opts.forEach((opt, i) => {
		if (i) out.push(vr(r2(x + i * sw - 0.15), y, h));
		// leeg vak dat bij zijn optie inverteert = zwart segment; de tekst houdt 0,5 mm lucht tot de scheidingslijnen
		out.push(box(r2(x + i * sw), y, r2(sw), h, { stroke: 0, rules: pick(field, opt) }));
		out.push(one(opt, r2(x + i * sw + 0.5), y, r2(sw - 1), h, { size: 2, ...B, ...o, rules: pick(field, opt) }));
	});
	return out;
}
// Vinkvakjes in kolommen: het vakje van de gekozen optie is gevuld.
function checks(field, opts, x, y, colW, rowH, cols) {
	const s = 2.6;
	return opts.flatMap((opt, i) => {
		const cx = r2(x + (i % cols) * colW), cy = r2(y + Math.floor(i / cols) * rowH), by = r2(cy + (rowH - s) / 2);
		return [box(cx, by, s, s, { stroke: 0.3, radius: 0.4 }), box(r2(cx + 0.6), r2(by + 0.6), s - 1.2, s - 1.2, { stroke: 0, rules: pick(field, opt) }),
			lt(opt, r2(cx + s + 0.8), cy, r2(colW - s - 1.2), rowH, { size: 2.2 })];
	});
}

// Velden: korte NL-labels, volgorde = leesvolgorde op het label.
const F = (key, label, value) => ({ key, label, type: 'text', value });
const N = (key, label, value, suffix = '') => ({ key, label, type: 'number', value, suffix });
const C = (key, label, options, value = options[0]) => ({ key, label, type: 'choice', options, value });
const D = (key, label, offset = 0) => ({ key, label, type: 'date', value: '', offset });

const T = (id, name, category, tags, fields, elements) =>
	({ id: 'office-' + id, name, category, tags, doc: { label: { ...LABEL }, fields, elements } });

// Kabelvlag: twee gelijke helften; om de kabel gevouwen staat op elke kant dezelfde tekst.
const flagHalf = x0 => [
	ico('plug-connected', x0 + 6.5, 1.8, 5, { stroke: 1.7 }),
	one('{kabel}', x0 + 0.6, 7.1, 16.8, 5, { font: OSW, size: 4.4, ...B }),
	hr(x0 + 5, 12.8, 8, 0.35),
	txt('{van}', x0 + 0.6, 13.6, 16.8, 4.4, { size: 2.9, ...B, align: 'center', valign: 'middle', lineHeight: 1 }),
	ico('arrow-down', x0 + 7.4, 18.1, 3.2, { stroke: 2.2 }),
	txt('{naar}', x0 + 0.6, 21.4, 16.8, 4.6, { size: 2.9, ...B, align: 'center', valign: 'middle', lineHeight: 1 }),
];

const LEVELS = ['INTERN', 'VERTROUWELIJK', 'STRIKT GEHEIM'];
const PRIO = ['Laag', 'Normaal', 'Hoog', 'Spoed'];
const REDEN = ['Te klein', 'Te groot', 'Defect', 'Anders'];
const HANDLE = ['Breekbaar', 'Deze kant boven', 'Droog houden'];
const SPEED = ['Standaard', 'Express', 'Spoed'];
const SOORT = ['Cadeau', 'Document', 'Monster', 'Verkoop'];
const ACTIE = ['Normaal', 'Actie', 'Op = op'];
const MATEN = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const KEUR = ['Goedgekeurd', 'Afgekeurd'];
const PIJL = ['Omhoog', 'Omlaag'];
const DEVICE = ['Server', 'Router', 'Laptop', 'Printer'];
const DEVICE_ICON = { Server: 'server', Router: 'router', Laptop: 'device-laptop', Printer: 'printer' };

const TEMPLATES = [
	// —— Kantoor & archief
	T('archief', 'Archiefdoos', 'office', ['archief', 'doos', 'bewaren', 'administratie', 'archive', 'box', 'storage', 'office'], [
		F('onderwerp', 'Onderwerp', 'Facturen inkoop'), N('doos', 'Doos', '03'), N('jaar', 'Jaar', '2026'), D('bewaar', 'Bewaren tot', 2557),
	], [
		brd('line', 0.5),
		blk(1.5, 1.5, 37, 7),
		ico('archive', 2.6, 2.4, 5.2, { stroke: 1.8, invert: true }),
		lt('ARCHIEF', 8.8, 1.5, 15, 7, { font: OSW, size: 4.2, ...B, letterSpacing: 0.6, invert: true }),
		blk(26, 2.6, 11.4, 4.8, { radius: 0.8, invert: true }),
		one('DOOS {doos}', 26.4, 2.6, 10.6, 4.8, { font: OSW, size: 3, ...B }),
		txt('{onderwerp}', 2.6, 10, 34.8, 9, { font: MONT, size: 4, ...B, valign: 'middle', lineHeight: 1.05 }),
		hr(2.6, 20, 34.8),
		cap('JAAR', 2.6, 21, 12, 2.4),
		lt('{jaar}', 2.6, 23.3, 12, 4.4, { font: OSW, size: 4.2, ...B }),
		vr(15.5, 21, 6.6),
		cap('BEWAREN TOT', 17, 21, 20.4, 2.4),
		lt('{bewaar}', 17, 23.3, 20.4, 4.4, { font: MONO, size: 3.2, ...B }),
	]),
	T('ordnerrug', 'Ordnerrug', 'office', ['ordner', 'map', 'rug', 'archief', 'binder', 'spine', 'folder', 'office'], [
		N('nr', 'Nummer', '07'), F('titel', 'Titel', 'Belasting & toeslagen'), F('sub', 'Inhoud', 'Aangiftes, aanslagen en brieven'),
		F('periode', 'Periode', '2024 - 2026'),
	], [
		brd('line', 0.4),
		blk(1.5, 1.5, 11, 27),
		one('MAP', 1.5, 3.2, 11, 3, { size: 2, ...B, letterSpacing: 0.6, invert: true }),
		one('{nr}', 2, 6.5, 10, 12, { font: 'Anton', size: 10, invert: true }),
		blk(4.5, 19.5, 5, 0.4, { invert: true }),
		ico('folder', 4, 21.5, 6, { stroke: 1.6, invert: true }),
		txt('{titel}', 14.5, 3, 23, 9.4, { font: MONT, size: 3.8, ...B, valign: 'middle', lineHeight: 1.05 }),
		hr(14.5, 13.2, 6, 0.5),
		txt('{sub}', 14.5, 14.4, 23, 6.4, { size: 2.4, ...I, lineHeight: 1.1 }),
		lt('{periode}', 14.5, 21.8, 15.5, 4.6, { font: OSW, size: 3.4, ...B }),
		{ type: 'shape', shape: 'ellipse', stroke: 0.3, fill: 'none', dash: 'dashed', x: 31, y: 20.8, w: 6.5, h: 6.5 },
	]),
	T('naambord', 'Bureau-naambord', 'office', ['naambord', 'bureau', 'naam', 'deur', 'kamer', 'name plate', 'desk', 'door', 'office'], [
		F('naam', 'Naam', 'Sanne de Vries'), F('functie', 'Functie', 'Office manager'), F('kamer', 'Kamer', '2.14'), F('toestel', 'Toestel', '214'),
	], [
		brd('corners', 0.6),
		txt('{naam}', 3, 3.6, 34, 10.4, { font: 'Playfair Display', size: 5.2, ...B, align: 'center', valign: 'middle', lineHeight: 1.05 }),
		hr(16, 15.2, 8, 0.4),
		one('{functie}', 3, 16.4, 34, 4, { font: MONT, size: 2.6, letterSpacing: 0.3 }),
		ico('door', 4.5, 22.8, 3.8, { stroke: 1.8 }),
		lt('Kamer {kamer}', 8.8, 22.8, 11.4, 3.8, { size: 2.4, ...B }),
		ico('phone', 21, 22.8, 3.8, { stroke: 1.8 }),
		lt('tst. {toestel}', 25.3, 22.8, 11.6, 3.8, { size: 2.4, ...B }),
	]),
	T('sleutel', 'Sleutelhanger', 'office', ['sleutel', 'sleutelhanger', 'ruimte', 'reserve', 'key', 'key tag', 'spare', 'office'], [
		F('ruimte', 'Ruimte', 'Archiefkast'), N('nr', 'Nummer', '12'), C('soort', 'Soort', ['Origineel', 'Reserve']),
	], [
		brd('tag', 0.5),
		ico('key', 11, 3.4, 5.6, { stroke: 1.7 }),
		cap('SLEUTEL', 17.6, 3, 19.4, 2.6, { letterSpacing: 0.5 }),
		txt('{ruimte}', 17.6, 5.6, 19.4, 5.2, { font: MONT, size: 3.2, ...B, valign: 'middle', lineHeight: 1 }),
		hr(11, 11.4, 26),
		one('{nr}', 11, 12.4, 26, 9.4, { font: OSW, size: 8.4, ...B }),
		...segs('soort', ['Origineel', 'Reserve'], 11, 22.6, 26, 4),
	]),
	T('vertrouwelijk', 'Vertrouwelijk-stempel', 'office', ['vertrouwelijk', 'geheim', 'intern', 'stempel', 'confidential', 'secret', 'stamp', 'office'], [
		C('niveau', 'Niveau', LEVELS, 'VERTROUWELIJK'), F('afd', 'Afdeling', 'Personeelszaken'), D('datum', 'Datum'),
	], [
		box(3, 3.3, 34, 13, { stroke: 0.8, radius: 1.2, rot: -6 }),
		box(4.1, 4.4, 31.8, 10.8, { stroke: 0.3, radius: 0.6, rot: -6 }),
		one('{niveau}', 5.2, 5.6, 29.6, 8.4, { font: 'Black Ops One', size: 6, rot: -6 }),
		cap('AFDELING', 1.5, 20, 21, 2.6),
		lt('{afd}', 1.5, 22.6, 21.6, 4.2, { size: 2.8, ...B }),
		vr(24.2, 20.2, 6.6),
		cap('DATUM', 25.4, 20, 13.1, 2.6, { align: 'right' }),
		one('{datum}', 25.4, 22.6, 13.1, 4.2, { font: MONO, size: 2.6, ...B, align: 'right' }),
	]),
	T('dossier', 'Dossiermap met status', 'office', ['dossier', 'map', 'klant', 'status', 'barcode', 'file', 'client', 'office'], [
		F('dossier', 'Dossiernr', 'D-2026-0142'), F('klant', 'Klant', 'Bakkerij Jansen'), C('status', 'Status', ['Open', 'Lopend', 'Gesloten'], 'Lopend'),
	], [
		ico('folders', 1.5, 1.5, 6.2, { stroke: 1.6 }),
		cap('DOSSIER', 8.8, 1.7, 14, 2.6, { letterSpacing: 0.6 }),
		lt('{dossier}', 8.8, 4.3, 29.7, 3.6, { font: MONO, size: 3, ...B }),
		txt('{klant}', 1.5, 8.9, 37, 6.4, { font: MONT, size: 3.4, ...B, valign: 'middle', lineHeight: 1.05 }),
		bc('{dossier}', 1.5, 15.9, 37, 6.6),
		...segs('status', ['Open', 'Lopend', 'Gesloten'], 1.5, 24, 37, 4.5),
	]),
	T('todo', 'Te doen met prioriteit', 'office', ['te doen', 'taak', 'deadline', 'prioriteit', 'todo', 'task', 'priority', 'office'], [
		F('voor', 'Voor', 'Mark'), F('taak', 'Taak', 'Offerte nasturen'), D('deadline', 'Deadline', 3), C('prio', 'Prioriteit', PRIO, 'Hoog'),
	], [
		brd('dashed', 0.4),
		box(2.6, 2.8, 4.4, 4.4, { stroke: 0.45, radius: 0.6 }),
		lt('TE DOEN', 8, 2.8, 12, 4.4, { font: OSW, size: 3.2, ...B, letterSpacing: 0.3 }),
		ico('calendar-event', 21.4, 3.1, 3.8, { stroke: 1.8 }),
		one('{deadline}', 25.4, 2.8, 12, 4.4, { font: OSW, size: 3, ...B, align: 'right' }),
		txt('{taak}', 2.6, 8.2, 34.8, 9.2, { font: 'Patrick Hand', size: 4.8, valign: 'middle', lineHeight: 1 }),
		ico('user', 2.6, 18.2, 3.8, { stroke: 1.8 }),
		lt('voor {voor}', 7, 18.2, 30.4, 3.8, { size: 2.6, ...I }),
		...segs('prio', PRIO, 2.6, 23, 34.8, 4.2, { size: 1.9 }),
	]),

	// —— Verzending & retour
	T('ontvanger', 'Adreslabel ontvanger', 'shipping', ['ontvanger', 'adres', 'verzenden', 'pakket', 'post', 'recipient', 'address', 'shipping'], [
		F('naam', 'Naam', 'Fam. de Boer'), F('straat', 'Straat + nr', 'Kerkstraat 12'), F('postcode', 'Postcode', '1234 AB'),
		F('plaats', 'Plaats', 'Utrecht'), F('land', 'Land', 'Nederland'), F('telefoon', 'Telefoon', '06 12345678'),
	], [
		blk(1.5, 1.5, 6.6, 27),
		one('ONTVANGER', -8.7, 12, 27, 6, { rot: 270, font: OSW, size: 3.4, ...B, letterSpacing: 0.9, invert: true }),
		lt('{naam}', 10, 2.2, 28.5, 5.6, { font: MONT, size: 3.8, ...B }),
		lt('{straat}', 10, 8.6, 28.5, 4.4, { size: 3.1 }),
		lt('{postcode}  {plaats}', 10, 13.2, 28.5, 5, { size: 3.4, ...B }),
		lt('{land}', 10, 18.4, 28.5, 3.6, { font: MONT, size: 2.4, letterSpacing: 0.5 }),
		hr(10, 23, 28.5),
		ico('phone', 10, 24.2, 3.6, { stroke: 1.8 }),
		lt('{telefoon}', 14.4, 24.2, 24.1, 3.6, { font: MONO, size: 2.5 }),
	]),
	T('afzender', 'Afzender-sticker', 'shipping', ['afzender', 'retouradres', 'adres', 'post', 'postzegel', 'sender', 'return address', 'shipping'], [
		F('naam', 'Naam', 'Jan Jansen'), F('straat', 'Straat + nr', 'Dorpsweg 5'), F('postcode', 'Postcode', '9876 ZX'), F('plaats', 'Plaats', 'Groningen'),
	], [
		brd('stamp', 0.5),
		cap('AFZENDER', 4.4, 4, 18, 2.6, { letterSpacing: 0.7 }),
		lt('{naam}', 4.4, 7.2, 22.4, 4.6, { font: MONT, size: 3.3, ...B }),
		lt('{straat}', 4.4, 12.4, 31.6, 3.8, { size: 2.9 }),
		lt('{postcode} {plaats}', 4.4, 16.4, 31.6, 3.8, { size: 2.9 }),
		{ type: 'shape', shape: 'ellipse', stroke: 0.4, fill: 'none', dash: 'dashed', x: 27.6, y: 3.6, w: 8.6, h: 8.6 },
		emo('✉️', 29.5, 5.5, 4.8),
		one('bij onbestelbaarheid retour', 4.4, 21, 31.6, 3, { size: 2, ...I }),
	]),
	T('retour', 'Retourlabel met reden', 'shipping', ['retour', 'terugsturen', 'order', 'reden', 'return', 'refund', 'barcode', 'shipping'], [
		D('datum', 'Retour op'), F('order', 'Ordernr', 'NL-48213'), C('reden', 'Reden', REDEN),
	], [
		blk(1.5, 1.5, 37, 7.4),
		ico('truck-return', 2.4, 2.1, 6.2, { stroke: 1.7, invert: true }),
		lt('RETOUR', 9.2, 1.5, 12.8, 7.4, { font: 'Anton', size: 4.8, letterSpacing: 0.7, invert: true }),
		one('{datum}', 23.6, 2.8, 14.2, 4.8, { font: MONO, size: 2.4, ...B, align: 'right', invert: true }),
		cap('ORDER', 1.5, 10, 10, 3.4),
		lt('{order}', 10.6, 10, 27.9, 3.4, { font: MONO, size: 3, ...B }),
		bc('{order}', 1.5, 14, 37, 6.4),
		...checks('reden', REDEN, 1.5, 21.4, 18.5, 3.5, 2),
	]),
	T('hantering', 'Breekbaar / deze kant boven', 'shipping', ['breekbaar', 'voorzichtig', 'deze kant boven', 'droog', 'fragile', 'this side up', 'keep dry', 'shipping'], [
		C('soort', 'Soort', HANDLE),
	], [
		brd('thick', 0.5),
		ico('glass', 3.4, 3.6, 13.6, { stroke: 1.5, ...showIf('soort', 'Breekbaar', HANDLE) }),
		ico('arrow-big-up-lines', 3.4, 3.6, 13.6, { stroke: 1.5, ...showIf('soort', 'Deze kant boven', HANDLE) }),
		ico('umbrella', 3.4, 3.6, 13.6, { stroke: 1.5, ...showIf('soort', 'Droog houden', HANDLE) }),
		txt('{soort}', 18.4, 3.6, 18.4, 13.6, { font: 'Bebas Neue', size: 7, valign: 'middle', lineHeight: 0.95 }),
		blk(2.25, 18.8, 35.5, 8.95),
		one('VOORZICHTIG BEHANDELEN', 2.8, 18.8, 34.4, 8.9, { font: OSW, size: 3.2, ...B, letterSpacing: 0.4, invert: true }),
	]),
	T('colli', 'Doos x van y', 'shipping', ['doos', 'colli', 'pakket', 'zending', 'gewicht', 'box', 'parcel', 'shipping'], [
		N('nr', 'Doos', '1'), N('totaal', 'Van', '3'), F('order', 'Order', '#10482'), N('gewicht', 'Gewicht', '2,4', 'kg'),
	], [
		brd('rounded', 0.5),
		one('{nr}', 3, 3, 11, 12, { font: OSW, size: 10, ...B }),
		{ type: 'shape', shape: 'line', stroke: 0.6, fill: 'none', x: 5.5, y: 14.3, w: 15, h: 1, rot: -58 },
		one('{totaal}', 12.5, 15, 11, 12, { font: OSW, size: 10, ...B }),
		vr(25, 3.5, 23),
		ico('package', 28.4, 3, 7, { stroke: 1.5 }),
		one('DOOS', 26.4, 10.6, 11, 2.6, { size: 2, ...B, letterSpacing: 0.5 }),
		hr(27.4, 14, 9),
		one('{order}', 26.4, 14.8, 11, 3.4, { font: MONO, size: 2.4, ...B }),
		ico('scale', 29.9, 19.4, 4, { stroke: 1.7 }),
		one('{gewicht} kg', 26.4, 23.6, 11, 3.8, { font: OSW, size: 3.2, ...B }),
	]),
	T('express', 'Express / prioriteit', 'shipping', ['express', 'spoed', 'prioriteit', 'track en trace', 'priority', 'urgent', 'tracking', 'shipping'], [
		C('prio', 'Prioriteit', SPEED, 'Express'), F('track', 'Track & trace', '3SABCD1234567'), D('verzonden', 'Verzonden'),
	], [
		box(1.5, 1.5, 37, 9.6, { stroke: 0.5 }),
		blk(1.5, 1.5, 37, 9.6, { rules: hideIf('prio', 'Standaard') }),
		ico('truck-delivery', 2.6, 2.3, 8, { stroke: 1.6, invert: true, rules: [{ field: 'prio', equals: 'Standaard', set: { invert: false } }] }),
		one('{prio}', 11.4, 1.5, 26.4, 9.6, { font: 'Bebas Neue', size: 7.6, letterSpacing: 0.6, invert: true, rules: [{ field: 'prio', equals: 'Standaard', set: { invert: false } }] }),
		cap('TRACK & TRACE', 1.5, 12.6, 22, 2.6),
		bc('{track}', 1.5, 15.2, 37, 6.6),
		one('{track}', 1.5, 21.9, 37, 2.6, { font: MONO, size: 2.1, letterSpacing: 0.3 }),
		ico('calendar', 1.5, 24.9, 3.6, { stroke: 1.8 }),
		lt('Verzonden {verzonden}', 5.6, 24.9, 32.9, 3.6, { size: 2.4 }),
	]),
	T('inhoud', 'Inhoud & waarde', 'shipping', ['inhoud', 'waarde', 'zending', 'cadeau', 'douane', 'contents', 'value', 'customs', 'shipping'], [
		F('inhoud', 'Inhoud', 'Boeken en speelgoed'), N('waarde', 'Waarde', '25', '€'), N('gewicht', 'Gewicht', '1,2', 'kg'), C('soort', 'Soort', SOORT),
	], [
		brd('line', 0.4),
		emo('📦', 2.4, 2.3, 5.2),
		lt('INHOUD', 8.4, 2.3, 13, 5.2, { font: OSW, size: 3.3, ...B, letterSpacing: 0.5 }),
		txt('{inhoud}', 2.4, 8.4, 18.6, 8.4, { size: 3, ...B, valign: 'middle', lineHeight: 1.05 }),
		hr(2.4, 17.6, 18.6),
		cap('WAARDE', 2.4, 18.6, 8.4, 2.4, { letterSpacing: 0.15 }),
		lt('€ {waarde}', 2.4, 21, 8.4, 4.6, { font: OSW, size: 3.4, ...B }),
		vr(11.55, 18.8, 6.6),
		cap('GEWICHT', 12.6, 18.6, 8.4, 2.4, { letterSpacing: 0.15 }),
		lt('{gewicht} kg', 12.6, 21, 8.4, 4.6, { font: OSW, size: 3.4, ...B }),
		vr(22.8, 2.6, 24.8),
		cap('SOORT', 24.2, 2.3, 13.4, 3),
		...checks('soort', SOORT, 24.2, 6.4, 13.4, 5, 1),
	]),

	// —— Winkel & prijzen
	// Lege foto-plek (geen src): Toevoegen > Afbeelding vult hem, dan alleen nog de prijs typen. Bijsnijden: elke foto vult
	// de plek, ook een liggende (passend gaf een smalle strook met wit erboven en eronder).
	T('fotoprijs', 'Product met foto', 'shop', ['foto', 'product', 'prijs', 'afbeelding', 'plaatje', 'photo', 'picture', 'price', 'shop'], [
		F('product', 'Product', 'Honing'), N('prijs', 'Prijs', '4,95', '€'),
	], [
		{ type: 'image', name: 'Foto', src: '', fit: 'cover', x: 1.5, y: 1.5, w: 17.5, h: 27 },
		txt('{product}', 20.5, 2.5, 18, 9, { font: MONT, size: 3.2, ...B, align: 'center', valign: 'middle', lineHeight: 1.05 }),
		one('€ {prijs}', 20.5, 12, 18, 15, { font: OSW, size: 7.4, ...B }),
	]),
	T('actieprijs', 'Prijskaartje met actie', 'shop', ['prijs', 'prijskaartje', 'actie', 'aanbieding', 'op is op', 'price tag', 'sale', 'offer', 'shop'], [
		F('product', 'Product', 'Biologische honing'), C('soort', 'Soort', ACTIE, 'Actie'), N('prijs', 'Prijs', '4,99', '€'),
		F('eenheid', 'Eenheid', 'per pot'), N('oud', 'Was', '6,49', '€'),
	], [
		brd('rounded', 0.5),
		txt('{product}', 3, 2.8, 22.4, 9.6, { font: MONT, size: 3.4, ...B, valign: 'middle', lineHeight: 1.05 }),
		{ type: 'shape', shape: 'burst', stroke: 0, fill: 'black', x: 26.4, y: 2.4, w: 11.2, h: 11.2, rules: hideIf('soort', 'Normaal') },
		one('{soort}', 28.5, 6.4, 7, 3.2, { font: 'Bebas Neue', size: 3.2, invert: true, rules: hideIf('soort', 'Normaal') }),
		ico('tag', 28, 3.6, 8.4, { stroke: 1.6, ...showIf('soort', 'Normaal', ACTIE) }),
		one('€ {prijs}', 3, 13.4, 34, 10.4, { font: OSW, size: 9.6, ...B }),
		lt('{eenheid}', 3, 24.2, 16, 3.4, { size: 2.4, ...I }),
		one('van', 19, 24.2, 7.2, 3.4, { size: 2.4, align: 'right', rules: hideIf('soort', 'Normaal') }),
		lt('€ {oud}', 26.6, 24.2, 10.6, 3.4, { size: 2.4, ...B, strike: true, rules: hideIf('soort', 'Normaal') }),
	]),
	T('korting', 'Korting %', 'shop', ['korting', 'procent', 'uitverkoop', 'sale', 'discount', 'percent', 'shop'], [
		N('pct', 'Korting', '30', '%'), F('wat', 'Op', 'alle truien'), D('tot', 'Geldig t/m', 7),
	], [
		brd('scallop', 0.5),
		{ type: 'shape', shape: 'ellipse', stroke: 0, fill: 'black', x: 3.4, y: 3.6, w: 19, h: 19 },
		one('-{pct}%', 5.2, 8.6, 15.4, 9, { font: 'Anton', size: 7.4, invert: true }),
		one('KORTING', 23.8, 4, 12.8, 5, { font: 'Anton', size: 3.6, letterSpacing: 0.3 }),
		txt('op {wat}', 23.8, 9.6, 12.8, 12.4, { font: MONT, size: 2.8, ...B, align: 'center', valign: 'middle', lineHeight: 1.05 }),
		one('geldig t/m {tot}', 3.4, 23.6, 33.2, 3.2, { size: 2.3, ...I }),
	]),
	T('ean', 'Productlabel met EAN', 'shop', ['product', 'ean', 'barcode', 'streepjescode', 'artikel', 'prijs', 'product label', 'shop'], [
		F('product', 'Product', 'Lavendelzeep 100 g'), N('prijs', 'Prijs', '3,95', '€'), F('art', 'Artikelnr', '10482'), F('ean', 'EAN-code', '8712345678906'),
	], [
		txt('{product}', 1.5, 1.5, 24.6, 7.6, { font: 'Inter', size: 3.2, ...B, valign: 'middle', lineHeight: 1.05 }),
		blk(26.8, 1.5, 11.7, 7.6, { radius: 1 }),
		one('€ {prijs}', 27.3, 2.1, 10.7, 6.4, { font: OSW, size: 4.4, ...B, invert: true }),
		lt('Art. {art}', 1.5, 9.8, 24.6, 2.8, { font: MONO, size: 2.1 }),
		bc('{ean}', 1.5, 13.4, 37, 15.1, { symbology: 'ean13', showText: true, textSize: 2.4 }),
	]),
	T('maat', 'Kledinglabel met maat', 'shop', ['kleding', 'maat', 'prijs', 'wasvoorschrift', 'clothing', 'size', 'garment', 'shop'], [
		F('product', 'Product', 'Hoodie oversized'), N('prijs', 'Prijs', '39,95', '€'), C('maat', 'Maat', MATEN, 'M'),
		F('was', 'Wassen', '30 °C'), F('kleur', 'Kleur', 'Zwart'),
	], [
		box(1.5, 1.5, 13, 13, { stroke: 0.7, radius: 1.6 }),
		one('{maat}', 3.2, 3.2, 9.6, 9.6, { font: 'Archivo Black', size: 7.4 }),
		txt('{product}', 16.4, 1.5, 22.1, 7.8, { font: MONT, size: 3.2, ...B, valign: 'middle', lineHeight: 1.05 }),
		lt('€ {prijs}', 16.4, 9.4, 22.1, 5.2, { font: OSW, size: 4.6, ...B }),
		...MATEN.flatMap((m, i) => [box(r2(1.5 + i * 6.28), 16.6, 5.6, 5, { radius: 0.8 }),
			box(r2(1.85 + i * 6.28), 16.95, 4.9, 4.3, { stroke: 0, rules: pick('maat', m) }),
			one(m, r2(2.3 + i * 6.28), 16.95, 4, 4.3, { size: 2.2, ...B, rules: pick('maat', m) })]),
		ico('wash', 1.5, 23.6, 4.6, { stroke: 1.6 }),
		lt('{was} · {kleur}', 6.6, 23.6, 31.9, 4.6, { size: 2.6, ...B }),
	]),
	T('hanglabel', 'Hanglabel boutique', 'shop', ['hanglabel', 'prijs', 'merk', 'boutique', 'cadeau', 'hang tag', 'price', 'brand', 'shop'], [
		F('merk', 'Merk', 'Atelier Noor'), F('product', 'Product', 'Linnen sjaal'), N('prijs', 'Prijs', '24,50', '€'), F('regel', 'Onderregel', 'handgemaakt in NL'),
	], [
		brd('tag', 0.5),
		one('{merk}', 10.5, 3.4, 26.4, 4.4, { font: 'Cinzel', size: 3, ...B, letterSpacing: 0.4 }),
		hr(18.7, 8.6, 10),
		txt('{product}', 10.5, 9.4, 26.4, 5.4, { font: 'Playfair Display', size: 3.4, ...I, align: 'center', valign: 'middle', lineHeight: 1 }),
		one('€ {prijs}', 10.5, 15, 26.4, 9, { font: 'Playfair Display', size: 7.4, ...B }),
		one('{regel}', 10.5, 24.4, 26.4, 2.8, { size: 1.9, letterSpacing: 0.3 }),
	]),
	T('gewogen', 'Gewogen artikel', 'shop', ['gewicht', 'prijs per kilo', 'weegschaal', 'kaas', 'deli', 'weighed', 'price per kg', 'scale', 'shop'], [
		F('product', 'Product', 'Oude kaas'), N('gewicht', 'Gewicht', '250', 'g'), N('perkg', 'Prijs/kg', '18,90', '€'), D('tht', 'THT', 14),
		N('totaal', 'Te betalen', '4,73', '€'),
	], [
		lt('{product}', 1.5, 1.5, 37, 5.6, { font: MONT, size: 3.8, ...B }),
		box(1.5, 7.8, 37, 8.6),
		vr(13.7, 7.8, 8.6), vr(26.03, 7.8, 8.6),
		one('GEWICHT', 1.5, 8.4, 12.33, 2.4, { size: 1.8, ...B, letterSpacing: 0.2 }),
		one('{gewicht} g', 2.3, 11, 10.7, 4.6, { font: OSW, size: 3.4, ...B }),
		one('PRIJS/KG', 13.83, 8.4, 12.33, 2.4, { size: 1.8, ...B, letterSpacing: 0.2 }),
		one('€ {perkg}', 14.63, 11, 10.7, 4.6, { font: OSW, size: 3.4, ...B }),
		one('THT', 26.17, 8.4, 12.33, 2.4, { size: 1.8, ...B, letterSpacing: 0.2 }),
		one('{tht}', 26.97, 11, 10.7, 4.6, { font: OSW, size: 3, ...B }),
		blk(1.5, 17.4, 37, 11.1),
		txt('TE\nBETALEN', 2.6, 18.4, 11, 9.1, { size: 2.6, ...B, valign: 'middle', lineHeight: 1.1, wrap: false, invert: true }),
		// start 1 mm na het TE BETALEN-vak: een gekrompen 4-cijferig bedrag plakt anders tegen BETALEN
		one('€ {totaal}', 14.6, 17.9, 23.3, 10.1, { font: OSW, size: 8.4, ...B, align: 'right', invert: true }),
	]),
	T('cadeaubon', 'Cadeaubon', 'shop', ['cadeaubon', 'waardebon', 'tegoed', 'cadeau', 'gift card', 'voucher', 'gift', 'shop'], [
		N('waarde', 'Waarde', '25', '€'), F('code', 'Code', 'KDO-7F3K-29QX'), D('geldig', 'Geldig t/m', 365),
	], [
		brd('ticket', 0.5),
		emo('🎁', 5, 3.4, 6),
		lt('CADEAUBON', 12, 3.4, 23, 6, { font: MONT, size: 3.6, ...B, letterSpacing: 0.6 }),
		one('€ {waarde}', 6.4, 9, 27.2, 8.8, { font: 'Abril Fatface', size: 8 }),
		{ type: 'shape', shape: 'line', stroke: 0.3, fill: 'none', dash: 'dotted', x: 6.2, y: 17.2, w: 19.6, h: 1 },
		cap('CODE', 6.2, 18.4, 19.6, 2.2),
		lt('{code}', 6.2, 20.5, 19.6, 3, { font: MONO, size: 2.3, ...B }),
		lt('geldig t/m {geldig}', 6.2, 23.3, 19.6, 2.6, { size: 2, ...I }),
		// QR (2 dots/module): >= 4 modules wit tot ticketrand en tekst, ook bij een langere code (gemeten 8 / slechtst 4)
		qr('{code}', 26.5, 18, 8),
	]),

	// —— Inventaris & tech/kabels
	T('inventaris', 'Inventarisnummer + QR', 'inventory', ['inventaris', 'teller', 'nummer', 'qr', 'locatie', 'inventory', 'asset', 'counter', 'tech'], [
		F('prefix', 'Voorvoegsel', 'INV'), D('sinds', 'In gebruik'), F('item', 'Item', 'Beamer Epson EB-W49'), F('locatie', 'Locatie', 'Vergaderzaal 1'),
	], [
		// 15,5 i.p.v. 16,5 mm: 4 dots/module i.p.v. 6, zo blijft >= 4 modules wit tot de tekst (gemeten 10 / slechtst 6)
		qr('{prefix}-{teller}', 1.5, 1.5, 15.5),
		cap('INVENTARIS', 19.6, 2, 18.9, 2.6, { letterSpacing: 0.6 }),
		lt('{prefix}-{teller}', 19.6, 4.8, 18.9, 6.2, { font: MONO, size: 4.4, ...B }),
		hr(19.6, 11.8, 18.9),
		ico('calendar', 19.6, 13, 3.4, { stroke: 1.8 }),
		lt('{sinds}', 23.6, 13, 14.9, 3.4, { font: MONO, size: 2.3 }),
		lt('{item}', 1.5, 19.2, 37, 4.8, { font: 'Inter', size: 3.2, ...B }),
		ico('map-pin', 1.5, 24.6, 3.8, { stroke: 1.8 }),
		lt('{locatie}', 5.8, 24.6, 32.7, 3.8, { size: 2.6 }),
	]),
	T('kabelvlag', 'Kabelvlag (om te vouwen)', 'inventory', ['kabel', 'kabellabel', 'vlag', 'snoer', 'stekker', 'cable', 'cable flag', 'wire', 'tech'], [
		F('kabel', 'Kabel', 'HDMI'), F('van', 'Van', 'PC'), F('naar', 'Naar', 'Monitor 2'),
	], [
		...flagHalf(1.5),
		{ type: 'shape', shape: 'line', stroke: 0.25, fill: 'none', dash: 'dashed', x: 6.5, y: 14.5, w: 27, h: 1, rot: 90 },
		...flagHalf(20.5),
	]),
	T('asset', 'Assetlabel eigendom', 'inventory', ['asset', 'eigendom', 'inventaris', 'barcode', 'bedrijf', 'property', 'asset tag', 'company', 'tech'], [
		F('bedrijf', 'Eigenaar', 'Studio Noord'), F('code', 'Code', 'IT'), F('tel', 'Telefoon', '020 123 4567'),
	], [
		blk(1.5, 1.5, 37, 8),
		ico('shield-check', 2.3, 2.3, 6.4, { stroke: 1.7, invert: true }),
		cap('EIGENDOM VAN', 9.6, 2.1, 28.2, 2.4, { letterSpacing: 0.6, invert: true }),
		lt('{bedrijf}', 9.6, 4.6, 28.2, 4.2, { font: MONT, size: 3.4, ...B, invert: true }),
		bc('{code}-{teller}', 1.5, 10.4, 37, 9.4),
		one('{code}-{teller}', 1.5, 20.2, 37, 3.2, { font: MONO, size: 2.6, ...B, letterSpacing: 0.4 }),
		hr(1.5, 24, 37),
		lt('NIET VERWIJDEREN', 1.5, 24.8, 19.6, 3.4, { size: 1.9, ...B, letterSpacing: 0.1 }),
		ico('phone', 21.6, 24.8, 3.4, { stroke: 1.8 }),
		lt('{tel}', 25.4, 24.8, 13.1, 3.4, { font: MONO, size: 2.3 }),
	]),
	T('wifi', 'Wifi-QR', 'inventory', ['wifi', 'wachtwoord', 'netwerk', 'qr', 'gasten', 'password', 'network', 'guest', 'tech'], [
		F('titel', 'Titel', 'Gasten-wifi'), F('ssid', 'Netwerk', 'Huis-WiFi'), F('wachtwoord', 'Wachtwoord', 'zonnebloem42'),
	], [
		ico('wifi', 1.5, 1.5, 6.4, { stroke: 2 }),
		// linkerkolom tot 21,2 mm en de lijn op 18,6: >= 4 modules wit rond de QR, ook als een lange naam de box vult (gemeten 4,25)
		txt('{titel}', 8.6, 1.5, 12.6, 6.4, { font: MONT, size: 3.4, ...B, valign: 'middle', lineHeight: 1 }),
		cap('NETWERK', 1.5, 9.4, 19.6, 2.4),
		lt('{ssid}', 1.5, 11.8, 19.6, 4.4, { size: 3.2, ...B }),
		// |wifi: een ; , : " of \ in naam/wachtwoord breekt anders de WIFI:-code. Geen wachtwoord = open netwerk: T:WPA met
		// een leeg P: verbindt niet, dan de T:nopass-code op dezelfde plek.
		qr('WIFI:T:WPA;S:{ssid|wifi};P:{wachtwoord|wifi};;', 23, 1.5, 15.5, { rules: [{ field: 'wachtwoord', equals: '', set: { hidden: true } }] }),
		qr('WIFI:T:nopass;S:{ssid|wifi};;', 23, 1.5, 15.5, { hidden: true, rules: [{ field: 'wachtwoord', equals: '', set: { hidden: false } }] }),
		hr(1.5, 18.6, 37),
		cap('WACHTWOORD', 1.5, 19.6, 20, 2.4, { rules: [{ field: 'wachtwoord', equals: '', set: { hidden: true } }] }),
		one('scan & verbind', 21, 19.6, 17.5, 2.4, { size: 1.8, ...I, align: 'right' }),
		lt('{wachtwoord}', 1.5, 22.3, 37, 5.6, { font: MONO, size: 3.6, ...B }),
	]),
	T('service', 'Servicesticker / keuring', 'inventory', ['service', 'keuring', 'onderhoud', 'datum', 'goedgekeurd', 'inspection', 'maintenance', 'tested', 'tech'], [
		C('status', 'Status', KEUR), F('apparaat', 'Apparaat', 'Boormachine Bosch'), D('laatst', 'Laatste beurt'), D('volgende', 'Volgende beurt', 365),
		F('door', 'Door', 'J. Bakker'),
	], [
		{ type: 'shape', shape: 'ellipse', stroke: 0, fill: 'black', x: 1.5, y: 1.5, w: 13, h: 13 },
		ico('check', 4.2, 4.2, 7.6, { stroke: 2.6, invert: true, ...showIf('status', 'Goedgekeurd', KEUR) }),
		ico('x', 4.2, 4.2, 7.6, { stroke: 2.6, invert: true, ...showIf('status', 'Afgekeurd', KEUR) }),
		one('{status}', 1.5, 15.2, 13, 3, { size: 2, ...B }),
		cap('SERVICE', 16.4, 1.8, 17, 2.6, { letterSpacing: 0.6 }),
		ico('tool', 34.6, 1.5, 3.9, { stroke: 1.8 }),
		lt('{apparaat}', 16.4, 4.6, 22.1, 4.8, { font: MONT, size: 3.2, ...B }),
		lt('Laatst {laatst}', 16.4, 10.4, 22.1, 3.2, { size: 2.3 }),
		lt('Volgende {volgende}', 16.4, 14.2, 22.1, 3.8, { size: 2.6, ...B }),
		hr(1.5, 19.6, 37),
		cap('DOOR', 1.5, 20.6, 18, 2.4),
		lt('{door}', 1.5, 23, 21, 4.4, { size: 3, ...B }),
		cap('PARAAF', 24, 20.6, 14.5, 2.4),
		box(24, 23, 14.5, 5.5, { stroke: 0.3, dash: 'dotted' }),
	]),
	T('locatie', 'Magazijnlocatie', 'inventory', ['magazijn', 'locatie', 'schap', 'bak', 'rek', 'warehouse', 'bin', 'shelf', 'location'], [
		C('pijl', 'Pijl', PIJL, 'Omlaag'), F('gang', 'Gang', 'A'), N('rek', 'Rek', '03'), N('plank', 'Plank', '2'), F('inhoud', 'Inhoud', 'M6 boutjes 20 mm'),
	], [
		blk(1.5, 1.5, 10.5, 17),
		ico('arrow-big-up', 2.4, 5.7, 8.6, { stroke: 1.8, invert: true, ...showIf('pijl', 'Omhoog', PIJL) }),
		ico('arrow-big-down', 2.4, 5.7, 8.6, { stroke: 1.8, invert: true, ...showIf('pijl', 'Omlaag', PIJL) }),
		one('{gang}-{rek}-{plank}', 13.2, 1.5, 25.3, 9.4, { font: MONO, size: 6.4, ...B }),
		one('GANG · REK · PLANK', 13.2, 10.9, 25.3, 2.4, { size: 1.8, ...B, letterSpacing: 0.3 }),
		txt('{inhoud}', 13.2, 13.4, 25.3, 5.1, { size: 2.8, ...B, align: 'center', valign: 'middle', lineHeight: 1.05 }),
		bc('{gang}-{rek}-{plank}', 1.5, 20, 37, 8.5),
	]),
	T('apparaat', 'Apparaat-ID (IP / serie)', 'inventory', ['apparaat', 'ip-adres', 'serienummer', 'server', 'router', 'device', 'ip address', 'serial', 'tech'], [
		F('naam', 'Naam', 'NAS-KANTOOR'), C('soort', 'Soort', DEVICE), F('ip', 'IP-adres', '192.168.1.20'), F('serie', 'Serienummer', '4F2A-99C1-7B'),
	], [
		blk(1.5, 1.5, 37, 8),
		...DEVICE.map(d => ico(DEVICE_ICON[d], 2.4, 2.3, 6.4, { stroke: 1.7, invert: true, ...showIf('soort', d, DEVICE) })),
		lt('{naam}', 9.8, 1.5, 28, 8, { font: 'Space Mono', size: 3.8, ...B, invert: true }),
		cap('IP-ADRES', 1.5, 11.4, 22, 2.4),
		lt('{ip}', 1.5, 13.8, 23.4, 4.6, { font: MONO, size: 3.3, ...B }),
		cap('SERIENUMMER', 1.5, 19.8, 22, 2.4),
		lt('{serie}', 1.5, 22.2, 23.4, 4.4, { font: MONO, size: 3 }),
		{ type: 'qr', data: '{serie}', symbology: 'datamatrix', ecc: 'M', x: 26.5, y: 11.2, w: 12, h: 12 },
		one('{soort}', 26.5, 24.4, 12, 3, { size: 2.1, ...B, letterSpacing: 0.3 }),
	]),
	T('adapter', 'Lader / adapter', 'inventory', ['lader', 'adapter', 'voeding', 'stekker', 'volt', 'charger', 'power supply', 'plug', 'tech'], [
		F('apparaat', 'Hoort bij', 'Laptop Lisa'), N('volt', 'Spanning', '19', 'V'), N('amp', 'Stroom', '3,42', 'A'), N('watt', 'Vermogen', '65', 'W'),
	], [
		brd('rounded-double', 0.4),
		emo('🔌', 3.2, 3.2, 8),
		cap('HOORT BIJ', 12.6, 3.4, 24, 2.6, { letterSpacing: 0.6 }),
		txt('{apparaat}', 12.6, 6, 24.6, 6.2, { font: MONT, size: 3.4, ...B, valign: 'middle', lineHeight: 1 }),
		...[['{volt}', 'VOLT'], ['{amp}', 'AMPÈRE'], ['{watt}', 'WATT']].flatMap(([v, u], i) => {
			const x = r2(3.2 + i * 11.53);
			return [box(x, 14.2, 10.53, 11.6, { radius: 0.8 }), one(v, r2(x + 1), 15.4, 8.53, 6.2, { font: OSW, size: 5, ...B }),
				one(u, r2(x + 0.6), 21.6, 9.33, 2.8, { size: 1.8, ...B, letterSpacing: 0.2 })];
		}),
	]),
];

export default TEMPLATES;
