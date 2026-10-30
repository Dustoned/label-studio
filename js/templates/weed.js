// Wiet & coffeeshop: allemaal exact 40 × 30 mm rechthoekig (de rol van de speler). Plain data, geen imports: doc vult ids
// en defaults aan, de ui hydrateert icoon-nodes (Tabler) en svg's (Iconify). Elk variabel stukje is een veld in `fields`;
// keuzes (Indica/Hybride/Sativa ...) lichten op via rules. Inhoud blijft >= 1,5 mm van de labelrand (randen zelf op 1 mm).

const T = (id, name, tags, fields, elements) =>
	({ id: 'weed-' + id, name, category: 'weed', tags, doc: { label: { w: 40, h: 30, shape: 'rect' }, fields, elements } });

// —— velden (korte NL-labels, volgorde = invulvolgorde)
const ftext = (key, label, value, placeholder = '') => ({ key, label, type: 'text', value, placeholder });
const fnum = (key, label, value, suffix = '') => ({ key, label, type: 'number', value, suffix });
const fchoice = (key, label, options, value = options[0]) => ({ key, label, type: 'choice', options, value });
const fdate = (key, label, offset = 0) => ({ key, label, type: 'date', value: '', offset });
const ftoggle = (key, label, value = false) => ({ key, label, type: 'toggle', value });
// gekozen optie licht op (wit op zwart); `only` = alleen zichtbaar bij die waarde
const on = (field, equals) => ({ rules: [{ field, equals, set: { invert: true } }] });
const only = (field, equals) => ({ hidden: true, rules: [{ field, equals, set: { hidden: false } }] });
// optioneel veld leeg = kopje, waarde en scheidingslijn weg (geen losse '%' op het label)
const ifSet = field => ({ rules: [{ field, equals: '', set: { hidden: true } }] });

// —— bouwstenen
const txt = (text, x, y, w, h, o = {}) => ({ type: 'text', text, x, y, w, h, ...o });
const one = (text, x, y, w, h, o = {}) => txt(text, x, y, w, h, { align: 'center', valign: 'middle', wrap: false, fit: 'shrink', ...o });   // één regel, krimpt
const box = (text, x, y, w, h, o = {}) => txt(text, x, y, w, h, { valign: 'middle', fit: 'shrink', lineHeight: 1, ...o });   // mag 2 regels, krimpt
const shp = (shape, x, y, w, h, o = {}) => ({ type: 'shape', shape, stroke: 0.4, fill: 'none', x, y, w, h, ...o });
// witte tekst op een zwarte balk; de tekst zit 1,2 mm binnen de balk, zodat een lange invulling niet tegen de rand krimpt
const bar = (text, x, y, w, h, o = {}) => [shp('rect', x, y, w, h, { stroke: 0, fill: 'black' }), one(text, x + 1.2, y, w - 2.4, h, { invert: true, ...o })];
// klein kopje; 2 mm: op 1,8 mm lopen de openingen van G/S/R op 8 dots/mm dicht (gemeten: 2 mm = 0 printTruth-correcties)
const cap = (text, x, y, w, o = {}) => one(text, x, y, w, 2.4, { size: 2, bold: true, letterSpacing: 0.35, ...o });
const brd = (style, stroke = 0.5) => ({ type: 'border', style, stroke, x: 1, y: 1, w: 38, h: 28 });
const rule = (x, y, w, h = 0.3) => ({ type: 'shape', shape: 'rect', stroke: 0, fill: 'black', x, y, w, h });
const tab = (icon, x, y, s, o = {}) => ({ type: 'icon', source: 'tabler', icon, set: 'outline', nodes: [], stroke: 1.7, x, y, w: s, h: s, ...o });
const ify = (icon, x, y, s, o = {}) => ({ type: 'icon', source: 'iconify', icon, svg: '', x, y, w: s, h: s, ...o });
// gewicht 600: dunne emoji-lijnen vallen op 203 dpi weg
const emo = (char, x, y, s, o = {}) => ({ type: 'emoji', char, style: 'mono', weight: 600, x, y, w: s, h: s, ...o });
const B = { bold: true }, I = { italic: true };
const SOORT = ['Indica', 'Hybride', 'Sativa'];
const OSW = 'Oswald', MONO = 'Roboto Mono', MONT = 'Montserrat';

export default [
	// De speler: naam, Indica/Hybride/Sativa als keuze die oplicht, THC/CBD/gram en de verpakdatum in één formulier.
	T('strain-pot', 'Strain-potlabel', ['strain', 'pot', 'potje', 'indica', 'sativa', 'hybride', 'thc', 'cbd', 'gram', 'jar', 'label'], [
		ftext('strain', 'Naam', 'Amnesia Haze', 'Strain-naam'),
		fchoice('type', 'Soort', SOORT, 'Hybride'),
		fnum('thc', 'THC', '22', '%'),
		fnum('cbd', 'CBD', '0,5', '%'),
		fnum('gram', 'Gewicht', '3,5', 'g'),
		fdate('verpakt', 'Verpakt'),
	], [
		brd('rounded'),
		tab('cannabis', 3, 2.9, 7, { stroke: 1.5 }),
		box('{strain}', 11.2, 2.6, 25.9, 7.6, { font: 'Bebas Neue', size: 6, letterSpacing: 0.2 }),
		shp('rect', 2.9, 11, 34.2, 4.4, { stroke: 0.35 }),
		rule(14.2, 11, 0.35, 4.4), rule(25.45, 11, 0.35, 4.4),
		...SOORT.map((s, i) => one(s.toUpperCase(), 2.9 + i * 11.4, 11, 11.4, 4.4, { size: 2, ...B, letterSpacing: 0.15, ...on('type', s) })),
		cap('THC', 3.3, 16.4, 10), one('{thc}%', 3.3, 18.8, 10, 5.2, { font: OSW, size: 3.9, ...B }),
		rule(14.15, 16.8, 0.3, 6.6),
		cap('CBD', 15, 16.4, 10, ifSet('cbd')), one('{cbd}%', 15, 18.8, 10, 5.2, { font: OSW, size: 3.9, ...B, ...ifSet('cbd') }),
		{ ...rule(25.85, 16.8, 0.3, 6.6), ...ifSet('cbd') },
		cap('GRAM', 26.7, 16.4, 10), one('{gram} g', 26.7, 18.8, 10, 5.2, { font: OSW, size: 3.9, ...B }),
		one('Verpakt op {verpakt}', 2.9, 24.6, 34.2, 2.8, { size: 2 }),
	]),
	T('jar-badge', 'Jar-badge', ['jar', 'pot', 'badge', 'strain', 'indica', 'sativa', 'hybride', 'thc', 'voorraad'], [
		ftext('strain', 'Naam', 'Wedding Cake', 'Strain-naam'),
		fchoice('type', 'Soort', SOORT, 'Indica'),
		fnum('thc', 'THC', '25', '%'),
		fnum('gram', 'Inhoud', '7', 'g'),
		fdate('verpakt', 'Verpakt'),
	], [
		shp('hexagon', 2.4, 2.4, 15.6, 15.6, { stroke: 0.6 }),
		...SOORT.map(s => one(s[0], 4.6, 5.6, 11.2, 9.2, { font: 'Anton', size: 8.4, ...only('type', s) })),
		one('{type}', 2.4, 18.6, 15.6, 3, { size: 2.1, ...B, letterSpacing: 0.3 }),
		cap('STRAIN', 20.2, 2.6, 17.4, { align: 'left' }),
		box('{strain}', 20.2, 5, 17.4, 8.6, { font: 'Playfair Display', size: 3.8, ...B }),
		rule(20.2, 14.4, 17.4),
		cap('THC', 20.2, 15.4, 8, { align: 'left' }),
		one('{thc}%', 20.2, 17.6, 17.4, 4.6, { font: OSW, size: 4.4, ...B, align: 'left' }),
		...bar('{gram} GRAM  ·  {verpakt}', 1.5, 23.2, 37, 5.3, { size: 2.4, ...B, letterSpacing: 0.2 }),
	]),
	T('preroll', 'Pre-roll', ['pre-roll', 'preroll', 'joint', 'jonko', 'blunt', 'gram', 'strain'], [
		ftext('strain', 'Naam', 'Lemon Haze', 'Strain-naam'),
		fnum('aantal', 'Aantal', '3', 'stuks'),
		fnum('gram', 'Per stuk', '0,7', 'g'),
		fdate('gerold', 'Gerold'),
	], [
		brd('line'),
		shp('rect', 1.5, 1.5, 11, 27, { stroke: 0, fill: 'black' }),
		ify('fa7-solid:joint', 2.6, 3, 8.8, { invert: true }),
		one('PRE-ROLL', -0.5, 17.75, 15, 4.5, { rot: -90, font: 'Bebas Neue', size: 3.8, letterSpacing: 0.8, invert: true }),
		box('{strain}', 14.6, 2.8, 22.6, 10.6, { font: 'Permanent Marker', size: 4.4 }),
		rule(14.6, 14.4, 22.6),
		cap('STUKS', 14.6, 15.6, 10.6, { align: 'left' }), one('{aantal}', 14.6, 18, 10.6, 5.2, { font: OSW, size: 4, ...B, align: 'left' }),
		cap('GRAM', 26.6, 15.6, 10.6, { align: 'left' }), one('{gram} g', 26.6, 18, 10.6, 5.2, { font: OSW, size: 4, ...B, align: 'left' }),
		one('Gerold {gerold}', 14.6, 23.9, 22.6, 3, { size: 2, ...I, align: 'left' }),
	]),
	T('edible', 'Edible-waarschuwing', ['edible', 'edibles', 'waarschuwing', 'warning', 'thc', 'kinderen', 'brownie', 'koekje'], [
		ftext('product', 'Product', 'Brownie', 'Wat zit erin?'),
		fnum('mg', 'THC per stuk', '10', 'mg'),
	], [
		brd('line', 0.6),
		tab('alert-triangle', 3, 3.1, 11, { set: 'filled' }),
		box('BEVAT\nTHC', 15.6, 2.8, 21.4, 11.6, { font: 'Anton', size: 5.4, lineHeight: 0.98, letterSpacing: 0.4 }),
		one('{product}', 3, 15.2, 34, 3.8, { size: 2.8, ...B }),
		...bar('{mg} MG THC PER STUK', 1.6, 19.6, 36.8, 4.6, { size: 2.6, ...B, letterSpacing: 0.2 }),
		one('Buiten bereik van kinderen  ·  niet rijden', 3, 24.8, 34, 2.6, { size: 1.9 }),
	]),
	T('spacecake', 'Spacecake', ['spacecake', 'cake', 'cupcake', 'edible', 'gebak', 'sterkte'], [
		ftext('naam', 'Naam', 'Spacecake', 'Wat heb je gebakken?'),
		fchoice('sterkte', 'Sterkte', ['Mild', 'Medium', 'Sterk'], 'Medium'),
		fdate('gebakken', 'Gebakken'),
	], [
		brd('scallop'),
		emo('🧁', 4.6, 4.6, 8.4),
		one('{naam}', 14.2, 4.2, 21.4, 9, { font: 'Pacifico', size: 5, align: 'left' }),
		cap('STERKTE', 4.6, 14.2, 30.8),
		...['Mild', 'Medium', 'Sterk'].flatMap((s, i) => [
			shp('rect', 4.6 + i * 10.6, 16.8, 9.6, 4.2, { stroke: 0.35, radius: 2.1 }),
			shp('rect', 4.6 + i * 10.6, 16.8, 9.6, 4.2, { stroke: 0, fill: 'black', radius: 2.1, ...only('sterkte', s) }),
			one(s, 5.8 + i * 10.6, 17.3, 7.2, 3.2, { size: 2.2, ...B, ...on('sterkte', s) }),
		]),
		one('Gebakken {gebakken}  ·  start laag', 4.6, 22.4, 30.8, 2.8, { size: 1.9, ...I }),
	]),
	T('kweek', 'Kweeklabel', ['kweek', 'grow', 'plant', 'kiem', 'groei', 'bloei', 'week', 'strain', 'thuisteelt'], [
		ftext('strain', 'Naam', 'Northern Lights', 'Strain-naam'),
		fnum('plant', 'Plant nr.', '1'),
		fchoice('fase', 'Fase', ['Kiem', 'Groei', 'Bloei'], 'Groei'),
		fdate('gekiemd', 'Gekiemd'),
		fnum('week', 'Week', '3'),
	], [
		brd('corners'),
		tab('plant-2', 3, 3, 8.6, { stroke: 1.5 }),
		cap('PLANT #{plant}', 12.8, 3, 24.2, { align: 'left' }),
		box('{strain}', 12.8, 5.4, 24.2, 6.6, { font: 'Roboto Slab', size: 3.6, ...B, lineHeight: 1.08 }),
		...['Kiem', 'Groei', 'Bloei'].flatMap((s, i) => [
			shp('rect', 3 + i * 11.4, 13.4, 3.2, 3.2, { stroke: 0.35, radius: 0.5 }),
			shp('rect', 3.7 + i * 11.4, 14.1, 1.8, 1.8, { stroke: 0, fill: 'black', radius: 0.3, ...only('fase', s) }),
			one(s, 7 + i * 11.4, 13.2, 7, 3.6, { size: 2.3, ...B, align: 'left' }),
		]),
		rule(3, 18.2, 34),
		cap('GEKIEMD', 3, 19.2, 16, { align: 'left' }),
		one('{gekiemd}', 3, 21.6, 19, 4.6, { font: MONO, size: 2.8, ...B, align: 'left' }),
		cap('WEEK', 23, 19.2, 14, { align: 'right' }),
		one('{week}', 23, 21.2, 14, 5.6, { font: OSW, size: 5, ...B, align: 'right' }),
	]),
	T('zaad', 'Zaadjes', ['zaad', 'zaadjes', 'seeds', 'feminized', 'autoflower', 'regulier', 'kweek', 'strain'], [
		ftext('strain', 'Naam', 'Gelato #41', 'Strain-naam'),
		fchoice('type', 'Type', ['Feminized', 'Autoflower', 'Regulier'], 'Feminized'),
		fnum('aantal', 'Aantal', '5', 'stuks'),
		ftext('bloei', 'Bloeitijd', '8-9 weken'),
		fnum('thc', 'THC', '25', '%'),
	], [
		brd('double', 0.4),
		ify('mdi:sprout', 3.2, 3.2, 7.6),
		cap('ZADEN  ·  {aantal} STUKS', 11.6, 3.2, 25, { align: 'left' }),
		box('{strain}', 11.6, 5.6, 25, 5.4, { font: 'Bebas Neue', size: 5.2, letterSpacing: 0.2 }),
		...['Feminized', 'Autoflower', 'Regulier'].flatMap((s, i) => [
			shp('rect', 3.4 + i * 11.2, 12.2, 10.6, 4.2, { stroke: 0.3 }),
			shp('rect', 3.4 + i * 11.2, 12.2, 10.6, 4.2, { stroke: 0, fill: 'black', ...only('type', s) }),
			one(s, 4.2 + i * 11.2, 12.6, 9, 3.4, { font: OSW, size: 2.3, ...B, ...on('type', s) }),
		]),
		cap('BLOEI', 3.4, 17.6, 16, { align: 'left' }), one('{bloei}', 3.4, 20, 16, 4, { font: OSW, size: 3, ...B, align: 'left' }),
		cap('THC', 20.6, 17.6, 16, { align: 'right' }), one('{thc}%', 20.6, 20, 16, 4, { font: OSW, size: 3, ...B, align: 'right' }),
		one('Koel, donker en droog bewaren', 3.4, 24.4, 33.2, 2.4, { size: 1.7, ...I }),
	]),
	T('prijs-gram', 'Prijs per gram', ['prijs', 'gram', 'prijskaartje', 'price', 'per gram', 'coffeeshop', 'bio'], [
		ftext('strain', 'Naam', 'White Widow', 'Strain-naam'),
		fnum('prijs', 'Prijs', '12,50', '€'),
		fchoice('type', 'Soort', SOORT, 'Sativa'),
		fnum('thc', 'THC', '21', '%'),
		ftoggle('bio', 'Biologisch', true),
	], [
		brd('tag'),
		box('{strain}', 10.6, 3.2, 26.4, 6, { font: MONT, size: 3.4, ...B }),
		one('€ {prijs}', 10.6, 9.4, 26.4, 10.4, { font: OSW, size: 8.6, ...B, align: 'right' }),
		one('PER GRAM', 10.6, 19.6, 26.4, 2.6, { size: 1.9, ...B, letterSpacing: 0.5, align: 'right' }),
		rule(10.6, 22.8, 26.4, 0.25),
		one('{type}  ·  THC {thc}%', 10.6, 23.6, 19, 3.2, { size: 2.1, ...B, align: 'left' }),
		shp('rect', 30.6, 23.4, 6.4, 3.6, { stroke: 0.35, radius: 1.8, ...only('bio', true) }),
		one('BIO', 31.2, 23.8, 5.2, 2.8, { size: 1.8, ...B, letterSpacing: 0.2, ...only('bio', true) }),
	]),
	T('420', '420-sticker', ['420', 'sticker', 'blaze', 'chill', 'vier twintig', 'fun'], [
		ftext('boven', 'Bovenregel', 'HAPPY'),
		ftext('tekst', 'Onderregel', 'blaze it'),
	], [
		brd('stars'),
		one('{boven}', 6, 5, 28, 3.4, { font: 'Archivo Black', size: 2.4, letterSpacing: 0.6 }),
		tab('cannabis', 5.4, 10, 7, { set: 'filled' }),
		one('420', 12.8, 8.6, 14.4, 10.4, { font: 'Bangers', size: 9.4, letterSpacing: 0.4 }),
		tab('cannabis', 27.6, 10, 7, { set: 'filled' }),
		one('{tekst}', 6, 19.6, 28, 5.6, { font: 'Permanent Marker', size: 3.8 }),
	]),
	T('menu', 'Menukaartje', ['menu', 'menukaart', 'prijslijst', 'coffeeshop', 'strains', 'prijzen'], [
		ftext('titel', 'Titel', 'MENU'),
		ftext('s1', 'Strain 1', 'Amnesia Haze'), fnum('p1', 'Prijs 1', '10', '€'),
		ftext('s2', 'Strain 2', 'Gorilla Glue'), fnum('p2', 'Prijs 2', '12', '€'),
		ftext('s3', 'Strain 3', 'Marokkaanse hasj'), fnum('p3', 'Prijs 3', '9', '€'),
	], [
		brd('thick-thin', 0.4),
		...bar('{titel}', 2.6, 2.6, 34.8, 5, { font: 'Bebas Neue', size: 4.2, letterSpacing: 1.4 }),
		...[1, 2, 3].flatMap(n => [
			one(`{s${n}}`, 3.4, 3 + n * 5.8, 23.4, 4.6, { size: 2.6, ...B, align: 'left' }),
			one(`€ {p${n}}`, 27.4, 3 + n * 5.8, 9.2, 4.6, { font: OSW, size: 2.9, ...B, align: 'right' }),
		]),
		shp('line', 3.4, 13.4, 33.2, 0.4, { stroke: 0.25, dash: 'dotted' }),
		shp('line', 3.4, 19.2, 33.2, 0.4, { stroke: 0.25, dash: 'dotted' }),
		one('prijzen per gram', 3.4, 24.9, 33.2, 2.3, { size: 1.7, ...I }),
	]),
	T('stash', 'Stash', ['stash', 'voorraad', 'prive', 'niet aankomen', 'secret', 'box'], [
		ftext('naam', 'Van', 'Sam'),
		ftext('regel', 'Regel', 'Geteld en gewogen.'),
	], [
		brd('stamp'),
		tab('lock', 4, 4.4, 9, { stroke: 1.8 }),
		one('STASH', 14.4, 4, 21.6, 7.4, { font: 'Black Ops One', size: 6.4, align: 'left' }),
		one('van {naam}', 14.4, 11.4, 21.6, 4.2, { font: 'Permanent Marker', size: 3.2, align: 'left' }),
		...bar('NIET AANKOMEN', 4, 17, 32, 4.6, { font: 'Stardos Stencil', size: 3.2, letterSpacing: 0.5 }),
		one('{regel}', 4, 22.4, 32, 3.4, { size: 2.2, ...I }),
	]),
	T('munchies', 'Munchies', ['munchies', 'snacks', 'eten', 'noodvoorraad', 'pizza', 'koekjes', 'niet delen'], [
		ftext('kop', 'Kopje', 'Noodvoorraad van'),
		ftext('naam', 'Naam', 'Jesse'),
	], [
		brd('dashed'),
		one('MUNCHIES', 3, 3, 34, 8.6, { font: 'Bangers', size: 7.6, letterSpacing: 0.5 }),
		...['pizza', 'cookie', 'ice-cream', 'candy'].map((n, i) => tab(n, 5.2 + i * 8, 12.2, 5.6, { stroke: 1.6 })),
		cap('{kop}', 3, 19, 34, { size: 1.9 }),
		one('{naam}', 3, 21.4, 34, 5, { font: 'Permanent Marker', size: 3.8 }),
	]),
	T('niet-storen', 'Niet storen', ['niet storen', 'deurhanger', 'high', 'chillen', 'do not disturb', 'kamer'], [
		fchoice('status', 'Ik ben', ['high', 'aan het chillen', 'aan het gamen', 'in slaap gevallen'], 'high'),
		ftext('terug', 'Terug om', '16:20'),
	], [
		brd('rounded-double', 0.4),
		emo('💤', 3.6, 3.8, 8.6),
		box('NIET\nSTOREN', 13.8, 3, 23, 10.6, { font: 'Anton', size: 5, lineHeight: 0.98, letterSpacing: 0.5 }),
		rule(3.6, 14.4, 32.8),
		one('ik ben {status}', 3.6, 15.4, 32.8, 6, { font: 'Permanent Marker', size: 4 }),
		one('terug om {terug}', 3.6, 22.2, 32.8, 3.6, { size: 2.3, ...B }),
	]),
	T('grinder', 'Grinder van mij', ['grinder', 'van mij', 'eigendom', 'niet lenen', 'naam', 'sticker', 'mine'], [
		ftext('naam', 'Naam', 'Noor'),
		ftext('regel', 'Regel', 'NIET LENEN  ·  NIET JATTEN'),
	], [
		brd('brackets'),
		shp('ellipse', 3.4, 3.6, 14.4, 14.4, { stroke: 0.6 }),
		shp('ellipse', 5.1, 5.3, 11, 11, { stroke: 0.3, dash: 'dotted' }),
		tab('cannabis', 7.6, 7.8, 6, { set: 'filled' }),
		one('VAN MIJ', 19.6, 3.6, 17, 7, { font: 'Anton', size: 5.4, letterSpacing: 0.3, align: 'left' }),
		one('{naam}', 19.6, 10.8, 17, 7.2, { font: 'Permanent Marker', size: 4.6, align: 'left' }),
		...bar('{regel}', 3.4, 20.4, 33.2, 5, { size: 2.3, ...B, letterSpacing: 0.2 }),
	]),
	T('aansteker', 'Aansteker-dief', ['aansteker', 'lighter', 'gestolen', 'van mij', 'terug', 'naam'], [
		ftext('naam', 'Naam', 'Kim'),
		ftext('tel', 'Telefoon', '06-12345678'),
	], [
		brd('line', 0.4),
		ify('game-icons:lighter', 2.8, 3.4, 13),
		...bar('GESTOLEN VAN', 17.2, 3.6, 19.8, 4, { size: 2.2, ...B, letterSpacing: 0.3 }),
		one('{naam}', 17.2, 8.2, 19.8, 9.4, { font: 'Pacifico', size: 5, align: 'left' }),
		one('Breng me terug!', 17.2, 17.8, 19.8, 3, { size: 2.2, ...I, align: 'left' }),
		rule(2.8, 21.8, 34.4, 0.25),
		one('{tel}', 2.8, 22.8, 34.4, 4, { font: MONO, size: 2.8, ...B }),
	]),
	T('bonnetje', 'Coffeeshop-bonnetje', ['bonnetje', 'bon', 'kassabon', 'receipt', 'coffeeshop', 'totaal'], [
		ftext('shop', 'Shop', 'The Green Room'),
		fdate('datum', 'Datum'),
		ftext('strain', 'Product', 'Amnesia Haze'),
		fnum('gram', 'Gram', '2', 'g'),
		fnum('prijs', 'Totaal', '20,00', '€'),
	], [
		brd('zigzag', 0.3),
		one('{shop}', 3, 2.8, 34, 3.8, { font: 'Space Mono', size: 3, ...B }),
		one('{datum}  {tijd}', 3, 6.6, 34, 2.4, { font: 'Space Mono', size: 1.9 }),
		shp('line', 3, 9.1, 34, 0.4, { stroke: 0.25, dash: 'dashed' }),
		box('{gram}g {strain}', 3, 9.8, 24.2, 5.6, { font: 'Space Mono', size: 2.2, lineHeight: 1.1 }),
		one('{prijs}', 27.4, 9.8, 9.6, 5.6, { font: 'Space Mono', size: 2.2, align: 'right' }),
		shp('line', 3, 15.6, 34, 0.4, { stroke: 0.25, dash: 'dashed' }),
		one('TOTAAL', 3, 16.3, 13, 3.8, { font: 'Space Mono', size: 2.6, ...B, align: 'left' }),
		one('EUR {prijs}', 16, 16.3, 21, 3.8, { font: 'Space Mono', size: 3, ...B, align: 'right' }),
		{ type: 'barcode', data: 'BON{teller}', symbology: 'code128', showText: false, textSize: 2, x: 5, y: 20.6, w: 30, h: 4 },
		one('BON {teller}  ·  BEDANKT!', 3, 24.9, 34, 2.3, { font: 'Space Mono', size: 1.7 }),
	]),
	T('hasj', 'Hasj', ['hasj', 'hash', 'hasjiesj', 'marokkaans', 'herkomst', 'thc', 'prijs'], [
		ftext('naam', 'Naam', 'Marokkaanse Ketama'),
		ftext('herkomst', 'Herkomst', 'Rif-gebergte, Marokko'),
		fnum('thc', 'THC', '30', '%'),
		fnum('prijs', 'Prijs per gram', '9,00', '€'),
	], [
		brd('ornate', 0.4),
		one('H A S J', 8, 3.6, 24, 3, { font: 'Cinzel', size: 2.4, ...B }),
		box('{naam}', 5.4, 6.8, 29.2, 10, { font: 'Playfair Display', size: 4.6, ...B, ...I, align: 'center' }),
		rule(16, 17.5, 8, 0.35),
		one('{herkomst}', 5.4, 18.4, 29.2, 3, { font: 'Lato', size: 2.2, ...I }),
		one('THC {thc}%  ·  € {prijs} per gram', 6.4, 22.2, 27.2, 3.2, { size: 2.3, ...B }),
	]),
	T('cbd-olie', 'CBD-olie', ['cbd', 'olie', 'oil', 'druppels', 'flesje', 'dosering', 'geopend'], [
		fnum('cbd', 'CBD', '10', '%'),
		fnum('ml', 'Inhoud', '10', 'ml'),
		fnum('druppels', 'Druppels', '3'),
		fdate('geopend', 'Geopend'),
	], [
		brd('rounded'),
		ify('ri:dropper-fill', 3.6, 4, 10),
		cap('CBD-OLIE', 15.4, 3, 21.6, { align: 'left', letterSpacing: 0.5 }),
		one('{cbd}%', 15.4, 5.4, 21.6, 9.6, { font: OSW, size: 8, ...B, align: 'left' }),
		one('{ml} ml  ·  full spectrum', 15.4, 15, 21.6, 3, { size: 2, align: 'left' }),
		...bar('DOSIS: {druppels} DRUPPELS', 3, 19.2, 34, 4.4, { size: 2.3, ...B, letterSpacing: 0.2 }),
		one('Geopend {geopend}', 3, 24, 34, 2.8, { size: 2 }),
	]),
	T('gummies', 'Gummies', ['gummies', 'snoep', 'candy', 'edible', 'mg', 'smaak', 'tht'], [
		ftext('smaak', 'Smaak', 'Mango'),
		fnum('mg', 'THC per stuk', '5', 'mg'),
		fnum('stuks', 'Inhoud', '20', 'stuks'),
		fdate('tht', 'THT', 90),
	], [
		brd('dots', 0.4),
		tab('candy', 3.4, 3.6, 6.4, { stroke: 1.6 }),
		one('GUMMIES', 10.8, 3.4, 26, 6.8, { font: 'Righteous', size: 4.6, letterSpacing: 0.3, align: 'left' }),
		shp('ellipse', 3.4, 11.4, 13.2, 13.2, { stroke: 0.5 }),
		one('{mg}', 5, 13.6, 10, 6, { font: OSW, size: 5.2, ...B }),
		one('MG THC', 5, 19.4, 10, 2.4, { size: 1.6, ...B, letterSpacing: 0.2 }),
		cap('SMAAK', 18.8, 11.4, 18, { align: 'left' }),
		one('{smaak}', 18.8, 13.8, 18, 4.2, { font: MONT, size: 3, ...B, align: 'left' }),
		one('{stuks} stuks', 18.8, 18.4, 18, 3, { size: 2.2, align: 'left' }),
		one('THT {tht}', 18.8, 21.6, 18, 3, { size: 2.1, ...B, align: 'left' }),
		one('Bevat THC  ·  alleen 18+', 3.4, 25, 33.2, 2.2, { size: 1.6, ...I }),
	]),
	T('curing', 'Curing-pot', ['curing', 'drogen', 'burpen', 'oogst', 'pot', 'rh', 'luchtvochtigheid', 'cure jar'], [
		ftext('strain', 'Naam', 'Purple Haze', 'Strain-naam'),
		fdate('oogst', 'Geoogst'),
		fnum('rh', 'Vochtigheid', '62', '%'),
	], [
		brd('line'),
		...bar('CURING', 1.5, 1.5, 37, 5.2, { font: 'Bebas Neue', size: 4.4, letterSpacing: 1.6 }),
		one('{strain}', 3, 7.4, 34, 5, { font: 'Roboto Slab', size: 3.6, ...B }),
		one('Geoogst {oogst}', 3, 12.6, 22, 3, { size: 2.1, align: 'left' }),
		one('RH {rh}%', 25, 12.6, 12, 3, { size: 2.1, ...B, align: 'right' }),
		rule(3, 16.2, 34),
		cap('BURPEN  ·  ELKE DAG 10 MIN', 3, 17, 34, { align: 'left', size: 1.7 }),
		...['M', 'D', 'W', 'D', 'V', 'Z', 'Z'].flatMap((d, i) => [
			shp('rect', 3 + i * 5.07, 19.8, 3.6, 3.6, { stroke: 0.35, radius: 0.5 }),
			one(d, 3 + i * 5.07, 23.7, 3.6, 2.4, { size: 1.7, ...B }),
		]),
	]),
	T('oogst', 'Oogstlabel', ['oogst', 'harvest', 'gewicht', 'nat', 'droog', 'plant', 'kweek'], [
		ftext('strain', 'Naam', 'Super Lemon Haze', 'Strain-naam'),
		fnum('plant', 'Plant nr.', '2'),
		fnum('nat', 'Nat', '420', 'g'),
		fnum('droog', 'Droog', '96', 'g'),
		fdate('oogst', 'Geoogst'),
	], [
		brd('thick-thin', 0.4),
		tab('scale', 3.4, 3.4, 7.2, { stroke: 1.6 }),
		cap('OOGST  ·  PLANT {plant}', 11.8, 3.2, 24.8, { align: 'left' }),
		box('{strain}', 11.8, 5.6, 24.8, 5.4, { font: MONT, size: 3, ...B }),
		shp('rect', 3.4, 12, 16, 10.4, { stroke: 0.35, radius: 0.8 }),
		cap('NAT', 3.4, 12.8, 16),
		one('{nat} g', 4.2, 15, 14.4, 6.6, { font: OSW, size: 4.4, ...B }),
		shp('rect', 20.6, 12, 16, 10.4, { stroke: 0, fill: 'black', radius: 0.8 }),
		cap('DROOG', 21.4, 12.8, 14.4, { invert: true }),
		one('{droog} g', 21.4, 15, 14.4, 6.6, { font: OSW, size: 4.4, ...B, invert: true }),
		one('Geoogst {oogst}', 3.4, 23.4, 33.2, 3, { size: 2.1 }),
	]),
	T('effect', 'Strain-effect', ['effect', 'relax', 'balans', 'energie', 'strain', 'smaak', 'terpenen'], [
		ftext('strain', 'Naam', 'Blue Dream', 'Strain-naam'),
		fchoice('effect', 'Effect', ['Relax', 'Balans', 'Energie'], 'Balans'),
		ftext('smaak', 'Smaak', 'bes, zoet, aards'),
	], [
		brd('shadow', 0.4),
		cap('STRAIN', 3, 3, 17, { align: 'left', letterSpacing: 0.5 }),
		box('{strain}', 3, 5.4, 17, 9.2, { font: 'Abril Fatface', size: 4.4 }),
		rule(3, 15.4, 17),
		cap('SMAAK', 3, 16.4, 17, { align: 'left', letterSpacing: 0.5 }),
		box('{smaak}', 3, 18.8, 17, 6.6, { size: 2.4, ...I, valign: 'top' }),
		...[['Relax', 'moon'], ['Balans', 'yin-yang'], ['Energie', 'bolt']].flatMap(([s, icon], i) => [
			shp('rect', 21.6, 3.4 + i * 7.4, 14.6, 6.4, { stroke: 0.3 }),
			shp('rect', 21.6, 3.4 + i * 7.4, 14.6, 6.4, { stroke: 0, fill: 'black', ...only('effect', s) }),
			tab(icon, 22.4, 4.3 + i * 7.4, 4.6, { stroke: 1.8, ...on('effect', s) }),
			one(s, 27.4, 4.2 + i * 7.4, 8.2, 4.8, { size: 2.4, ...B, align: 'left', ...on('effect', s) }),
		]),
	]),
	T('vape', 'Vape-cartridge', ['vape', 'cartridge', 'cart', 'distillaat', 'live resin', 'rosin', 'thc', 'ml'], [
		ftext('strain', 'Naam', 'Pineapple Express', 'Strain-naam'),
		fnum('thc', 'THC', '85', '%'),
		fnum('ml', 'Inhoud', '1,0', 'ml'),
		fchoice('soort', 'Extract', ['Distillaat', 'Live resin', 'Rosin'], 'Live resin'),
	], [
		shp('rect', 1.5, 1.5, 37, 6.4, { stroke: 0, fill: 'black' }),
		ify('akar-icons:vape-kit', 2.8, 2.1, 5.2, { invert: true }),
		one('CARTRIDGE', 9.4, 1.5, 27.6, 6.4, { font: 'Bebas Neue', size: 4.6, letterSpacing: 0.8, align: 'left', invert: true }),
		box('{strain}', 2.4, 9.2, 19.4, 8.4, { font: MONT, size: 3.3, ...B }),
		one('THC {thc}%', 2.4, 18.2, 19.4, 4.2, { font: OSW, size: 3.4, ...B, align: 'left' }),
		one('{ml} ml', 2.4, 22.6, 19.4, 4, { font: OSW, size: 3, ...B, align: 'left' }),
		rule(22.75, 9.6, 0.3, 16.6),
		...['Distillaat', 'Live resin', 'Rosin'].flatMap((s, i) => [
			shp('ellipse', 24, 10.6 + i * 5.6, 2.8, 2.8, { stroke: 0.35 }),
			shp('ellipse', 24.7, 11.3 + i * 5.6, 1.4, 1.4, { stroke: 0, fill: 'black', ...only('soort', s) }),
			one(s, 27.4, 10 + i * 5.6, 10.2, 4, { font: OSW, size: 2.4, ...B, align: 'left' }),
		]),
	]),
	T('qr-strain', 'Strain met QR', ['qr', 'strain', 'info', 'link', 'labtest', 'thc', 'cbd', 'getest'], [
		ftext('strain', 'Naam', 'Girl Scout Cookies', 'Strain-naam'),
		ftext('link', 'Link', 'https://example.com/gsc', 'https://'),
		fnum('thc', 'THC', '24', '%'),
		fnum('cbd', 'CBD', '0,2', '%'),
		fdate('getest', 'Getest'),
	], [
		// 125 dots: een link van 27-42 tekens geeft 29 modules x 4 dots met maar 4 dots wit in de box; het onderschrift staat
		// daarom zo ver omlaag dat er bij elke linklengte >= 4 modules wit blijft (gemeten slechtst 4,0)
		{ type: 'qr', data: '{link}', symbology: 'qrcode', ecc: 'M', x: 2, y: 2, w: 15.6, h: 15.6 },
		cap('SCAN VOOR INFO', 2, 18.8, 15.6, { size: 1.9, letterSpacing: 0.1 }),
		box('{strain}', 19.6, 2.4, 18, 9.4, { font: MONT, size: 3.4, ...B }),
		rule(19.6, 12.4, 18),
		one('THC', 19.6, 13.2, 8, 4.2, { size: 2, ...B, align: 'left', letterSpacing: 0.3 }),
		one('{thc}%', 27, 13.2, 10.6, 4.2, { font: OSW, size: 3.4, ...B, align: 'right' }),
		one('CBD', 19.6, 17.6, 8, 4.2, { size: 2, ...B, align: 'left', letterSpacing: 0.3, ...ifSet('cbd') }),
		one('{cbd}%', 27, 17.6, 10.6, 4.2, { font: OSW, size: 3.4, ...B, align: 'right', ...ifSet('cbd') }),
		...bar('LAB GETEST  ·  {getest}', 1.5, 23.2, 37, 5.3, { size: 2.3, ...B, letterSpacing: 0.2 }),
	]),
	T('coffeeshop', 'Coffeeshop-zakje', ['coffeeshop', 'zakje', 'logo', 'shop', 'strain', 'gram', '18+'], [
		ftext('shop', 'Shop', 'De Groene Uil'),
		fnum('sinds', 'Sinds', '1985'),
		ftext('strain', 'Product', 'Amnesia Haze'),
		fnum('gram', 'Gram', '1', 'g'),
		fdate('datum', 'Datum'),
	], [
		brd('double', 0.35),
		shp('ellipse', 3.2, 3.6, 14.4, 14.4, { stroke: 0, fill: 'black' }),
		tab('cannabis', 5.9, 6.3, 9, { set: 'filled', invert: true }),
		one('EST. {sinds}', 3.2, 18.8, 14.4, 2.6, { size: 1.8, ...B, letterSpacing: 0.3 }),
		cap('COFFEESHOP', 19.4, 3.4, 17.4, { align: 'left', size: 1.7, letterSpacing: 0.6 }),
		box('{shop}', 19.4, 5.8, 17.4, 8.4, { font: 'Cinzel', size: 3.4, ...B, lineHeight: 1.05 }),
		rule(19.4, 14.6, 17.4),
		box('{strain}', 19.4, 15.2, 17.4, 4.6, { size: 2.3, ...B, lineHeight: 1.05 }),
		one('{gram} g  ·  {datum}', 19.4, 19.9, 17.4, 2.6, { font: MONO, size: 1.9, align: 'left' }),
		...bar('ALLEEN VOOR 18+', 3.2, 22.8, 33.6, 3.8, { size: 2, ...B, letterSpacing: 0.6 }),
	]),
	T('18plus', '18+ alleen volwassenen', ['18+', 'leeftijd', 'id', 'legitimatie', 'volwassenen', 'coffeeshop', 'deur', 'adults only'], [
		ftext('regel1', 'Kop', 'Alleen voor volwassenen'),
		ftext('regel2', 'Regel', 'Legitimatie verplicht'),
		ftext('regel3', 'Balk', 'ZONDER ID GEEN VERKOOP'),
	], [
		brd('thick'),
		shp('ellipse', 3.6, 3.6, 15.6, 15.6, { stroke: 1 }),
		one('18+', 5, 8.2, 12.8, 6.4, { font: 'Archivo Black', size: 4.8 }),
		box('{regel1}', 20.8, 3.4, 16, 10.2, { font: 'Archivo Black', size: 2.8, lineHeight: 1.05 }),
		rule(20.8, 14.2, 16),
		box('{regel2}', 20.8, 14.8, 16, 5, { size: 2.2 }),
		...bar('{regel3}', 2.25, 21.6, 35.5, 6.15, { size: 2.6, ...B, letterSpacing: 0.3 }),
	]),
	T('bong', 'Bong-naamkaartje', ['bong', 'naam', 'schoongemaakt', 'water', 'van mij', 'fun', 'name tag'], [
		ftext('naam', 'Naam bong', 'Bubbles'),
		fdate('schoon', 'Schoongemaakt'),
	], [
		brd('rounded'),
		cap('HALLO, MIJN NAAM IS', 3.2, 3.2, 33.6, { size: 1.9, letterSpacing: 0.4 }),
		ify('fa7-solid:bong', 3.2, 6.4, 10.4),
		one('{naam}', 15.6, 6.2, 21.4, 10.6, { font: 'Lobster', size: 6, align: 'left' }),
		rule(3.2, 17.4, 33.6),
		one('Laatst schoongemaakt', 3.2, 18.6, 33.6, 2.6, { size: 1.9 }),
		one('{schoon}', 3.2, 21.4, 33.6, 4.6, { font: MONO, size: 3.2, ...B }),
	]),
];
