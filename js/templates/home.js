// Templates Keuken & voorraad, Huis & opslag, Tuin & planten: allemaal exact 40 x 30 mm (de rol van de speler).
// Plain data (geen imports). Alles wat je invult is een veld; keuzes kleuren of wisselen via rules. Elke regel krijgt
// alle opties expliciet mee. Een onbekende keuze (CSV) raakt geen regel: dan wordt niets zwart en wisselen toont niets.

const r3 = v => Math.round(v * 1000) / 1000;
const M = 1.5;   // marge: niets buiten [1,5, 38,5] x [1,5, 28,5]

// —— velden
const ftext = (key, label, value, placeholder = '') => ({ key, label, type: 'text', value, placeholder });
const fnum = (key, label, value, suffix = '') => ({ key, label, type: 'number', value: String(value), suffix });
const fdate = (key, label, offset = 0) => ({ key, label, type: 'date', value: '', offset });
const fchoice = (key, label, options, value = options[0]) => ({ key, label, type: 'choice', options, value });
const ftoggle = (key, label, value = false) => ({ key, label, type: 'toggle', value });

// —— regels: zwart als gekozen / alleen zichtbaar bij bepaalde opties (choice) of aan/uit (toggle)
const values = f => f.type === 'toggle' ? [true, false] : f.options;
const picked = (f, on) => ({ rules: values(f).map(v => ({ field: f.key, equals: v, set: { invert: on.includes(v) } })) });
const shown = (f, on) => ({ hidden: true, rules: values(f).map(v => ({ field: f.key, equals: v, set: { hidden: !on.includes(v) } })) });
const pick = (f, ...on) => picked(f, on), only = (f, ...on) => shown(f, on);

// —— bouwstenen (ontbrekende velden vult doc.normalizeTemplateDoc aan)
const txt = (text, x, y, w, h, o = {}) => ({ type: 'text', text, x: r3(x), y: r3(y), w: r3(w), h: r3(h), ...o });
const one = (text, x, y, w, h, o = {}) => txt(text, x, y, w, h, { align: 'center', valign: 'middle', wrap: false, fit: 'shrink', ...o });
const two = (text, x, y, w, h, o = {}) => one(text, x, y, w, h, { wrap: true, lineHeight: 1.05, ...o });   // naam: mag naar 2 regels
const bar = (text, x, y, w, h, o = {}) => one(text, x, y, w, h, { invert: true, ...B, ...o });   // dun wit op zwart verdrinkt bij 203 dpi
const brd = (style, stroke = 0.5) => ({ type: 'border', style, stroke, x: M, y: M, w: 40 - 2 * M, h: 30 - 2 * M });
const rule = (x, y, w, h = 0.3) => ({ type: 'shape', shape: 'rect', stroke: 0, fill: 'black', x: r3(x), y: r3(y), w: r3(w), h: r3(h) });
const shp = (shape, x, y, w, h, o = {}) => ({ type: 'shape', shape, stroke: 0.4, fill: 'none', x: r3(x), y: r3(y), w: r3(w), h: r3(h), ...o });
const ico = (icon, x, y, s, o = {}) => ({ type: 'icon', source: 'tabler', icon, set: 'outline', nodes: [], stroke: 1.8, x: r3(x), y: r3(y), w: s, h: s, ...o });
const emo = (char, x, y, s, o = {}) => ({ type: 'emoji', char, style: 'mono', weight: 600, x: r3(x), y: r3(y), w: s, h: s, ...o });
const B = { bold: true }, I = { italic: true };
const MONO = 'Roboto Mono', MONT = 'Montserrat', OSW = 'Oswald';
const lab = (text, x, y, w, h = 2.4, o = {}) => one(text, x, y, w, h, { size: 1.9, ...B, letterSpacing: 0.35, align: 'left', ...o });   // kopje
const date = (key, x, y, w, h, o = {}) => one(`{${key}}`, x, y, w, h, { font: MONO, size: 2.5, ...B, ...o });

// Segmentbalk: kader + per optie een vak dat zwart wordt als die optie gekozen is (choice of toggles per vak).
function seg(f, x, y, w, h, o = {}) {
	const opts = f.options, cw = w / opts.length, out = [shp('rect', x, y, w, h, { stroke: 0.3 })];
	opts.forEach((opt, i) => {
		if (i) out.push(rule(x + i * cw - 0.15, y, 0.3, h));
		out.push(one(o.labels?.[i] ?? opt, x + i * cw, y, cw, h, { size: 2.1, ...B, ...o.text, ...pick(f, opt) }));
	});
	return out;
}
// Losse pil (afgerond): rand altijd, zwarte vulling + witte tekst als `on` (pick-object van een keuze of toggle).
function pill(text, on, x, y, w, h, o = {}) {
	// tekstvak 0,8 r naar binnen: de hoek van het zwarte vak valt dan (< 0,05 mm) binnen de afgeronde rand
	const r = Math.min(h / 2, o.radius ?? h / 2), inset = Math.max(r * 0.8, 0.5);
	return [shp('rect', x, y, w, h, { stroke: 0.3, radius: r }), shp('rect', x, y, w, h, { stroke: 0, fill: 'black', radius: r, hidden: true, rules: on.rules.map(q => ({ ...q, set: { hidden: !q.set.invert } })) }),
		one(text, x + inset, y, w - 2 * inset, h, { size: 2, ...B, ...o.text, ...on })];
}
const T = (id, name, category, tags, fields, elements) => ({ id, name, category, tags, doc: { label: { w: 40, h: 30, shape: 'rect' }, fields, elements: elements.flat() } });

// ======================================================================= Keuken & voorraad

const potF = [ftext('naam', 'Naam', 'Basmatirijst', 'Wat zit erin?'), fnum('gewicht', 'Inhoud', '1000', 'g'), fdate('gevuld', 'Gevuld'), fdate('tht', 'THT', 180)];
const kruidF = [ftext('naam', 'Naam', 'Gerookte paprika', 'Kruid of specerij'), fchoice('smaak', 'Smaak', ['Mild', 'Pittig', 'Heet'], 'Pittig'), ftext('herkomst', 'Herkomst', 'Spanje')];
const thtF = [ftext('product', 'Product', 'Verse pesto'), fdate('open', 'Geopend'), fdate('tht', 'Op voor', 5)];
const vriesF = [ftext('product', 'Product', 'Kippensoep'), fnum('porties', 'Porties', '2'), fdate('in', 'Ingevroren'), fdate('op', 'Op voor', 90)];
const prepF = [ftext('gerecht', 'Gerecht', 'Kip teriyaki met rijst'), fchoice('dag', 'Dag', ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'], 'Wo'), fnum('kcal', 'Calorieën', '540', 'kcal'), fdate('gemaakt', 'Gemaakt'), fdate('op', 'Eet voor', 3)];
const ALLERGENEN = [['gluten', 'Gluten'], ['melk', 'Melk'], ['ei', 'Ei'], ['noten', 'Noten'], ['pinda', 'Pinda'], ['soja', 'Soja'], ['vis', 'Vis'], ['sesam', 'Sesam'], ['selderij', 'Selderij']];
const allerF = [ftext('gerecht', 'Gerecht', 'Saté met pindasaus'), ...ALLERGENEN.map(([k, l]) => ftoggle(k, l, ['pinda', 'soja', 'gluten'].includes(k)))];
const jamF = [ftext('naam', 'Naam', 'Aardbeienjam'), ftext('extra', 'Smaak', 'met een vleugje vanille'), ftext('maker', 'Gemaakt door', 'Oma Joke'), fdate('gemaakt', 'Datum')];
const wijnF = [ftext('naam', 'Naam', 'Bramenwijn'), fchoice('soort', 'Soort', ['Rood', 'Wit', 'Rosé']), fnum('jaar', 'Jaar', '2026'), fnum('alc', 'Alcohol', '12,5', '%')];
const restF = [ftext('wat', 'Wat', 'Lasagne bolognese'), fchoice('plek', 'Bewaren', ['Koelkast', 'Vriezer']), fdate('gemaakt', 'Gemaakt'), fdate('op', 'Op voor', 2)];
const bakF = [ftext('naam', 'Naam', 'Spaghetti'), fnum('kook', 'Kooktijd', '9', 'min'), fnum('gewicht', 'Inhoud', '500', 'g')];
const koffieF = [ftext('naam', 'Naam', 'Ethiopië Sidamo'), fchoice('branding', 'Branding', ['Licht', 'Medium', 'Donker'], 'Medium'), fchoice('maling', 'Maling', ['Bonen', 'Gemalen']), fdate('gebrand', 'Gebrand')];
const ovenF = [ftext('naam', 'Naam', 'Bananenbrood'), fnum('temp', 'Oven', '180', '°C'), fnum('baktijd', 'Baktijd', '55', 'min')];

const KITCHEN = [
	T('kitchen-voorraadpot', 'Voorraadpot', 'kitchen', ['voorraad', 'pot', 'bus', 'rijst', 'pasta', 'tht', 'pantry', 'jar', 'storage'], potF, [
		brd('rounded'),
		emo('🫙', 3.4, 3.4, 9.2),
		lab('VOORRAAD', 14, 3.6, 23),
		two('{naam}', 14, 6.2, 23, 7.6, { font: 'Bebas Neue', size: 7, align: 'left', letterSpacing: 0.2 }),
		rule(3.2, 14.4, 33.6),
		lab('GEVULD', 3.4, 15.6, 15.6), date('gevuld', 3.4, 18, 15.6, 3.6, { align: 'left' }),
		rule(19.85, 15.8, 0.3, 6),
		lab('THT', 21, 15.6, 15.6, 2.4, { align: 'right' }), date('tht', 21, 18, 15.6, 3.6, { align: 'right' }),
		one('netto {gewicht} g', 3.4, 23.2, 33.2, 3.2, { size: 2.2, ...I }),
	]),
	T('kitchen-kruiden', 'Kruidenpotje', 'kitchen', ['kruiden', 'specerijen', 'potje', 'paprika', 'pittig', 'spices', 'herbs', 'spice jar'], kruidF, [
		brd('ornate', 0.5),
		one('KRUIDEN & SPECERIJEN', 7, 4.4, 26, 2.4, { size: 1.8, ...B, letterSpacing: 0.2 }),
		two('{naam}', 5, 7.2, 30, 9, { font: 'Playfair Display', size: 5.2, ...B, ...I, lineHeight: 1 }),
		...seg(kruidF[1], 7.5, 17, 25, 3.8, { labels: ['MILD', 'PITTIG', 'HEET'], text: { size: 1.9, letterSpacing: 0.2 } }),
		one('uit {herkomst}', 7, 21.8, 26, 3, { size: 2.2, ...I }),
	]),
	T('kitchen-tht', 'THT na openen', 'kitchen', ['tht', 'houdbaar', 'geopend', 'koelkast', 'best before', 'opened', 'use by'], thtF, [
		shp('rect', M, M, 37, 27, { stroke: 0.5 }),
		one('THT', M, M, 9.4, 27, { font: 'Anton', size: 6.4, vertical: true, wrap: true, invert: true }),
		two('{product}', 12.8, 3.2, 24, 6.6, { font: MONT, size: 3.8, ...B, align: 'left' }),
		one('Geopend', 12.8, 10.6, 9, 2.8, { size: 2.1, align: 'left' }),
		date('open', 22.4, 10.6, 14.4, 2.8, { size: 2.2, align: 'right', bold: false }),
		rule(12.8, 14.4, 24),
		lab('OP VOOR', 12.8, 15.8, 24),
		one('{tht}', 12.8, 18.4, 24, 8.2, { font: OSW, size: 6, ...B, align: 'left' }),
	]),
	T('kitchen-ingevroren', 'Diepvries', 'kitchen', ['ingevroren', 'vriezer', 'diepvries', 'portie', 'frozen', 'freezer'], vriesF, [
		brd('line'),
		shp('rect', M, M, 37, 6.4, { stroke: 0, fill: 'black' }),
		bar('DIEPVRIES', 8.8, M, 22.4, 6.4, { font: 'Anton', bold: false, size: 4, letterSpacing: 0.8 }),
		ico('snowflake', 3.6, 2.4, 4.6, { invert: true, stroke: 2 }), ico('snowflake', 31.8, 2.4, 4.6, { invert: true, stroke: 2 }),
		two('{product}', 3.2, 8.6, 33.6, 7.2, { font: 'Fredoka', size: 5, ...B }),
		one('{porties} porties', 3.2, 15.8, 33.6, 3, { size: 2.2, ...I }),
		rule(3.2, 19.4, 33.6),
		lab('INGEVROREN', 3.2, 20.4, 16.2), date('in', 3.2, 23, 16.2, 3.6, { align: 'left' }),
		rule(19.85, 20.6, 0.3, 6),
		lab('OP VOOR', 20.6, 20.4, 16.2, 2.4, { align: 'right' }), date('op', 20.6, 23, 16.2, 3.6, { align: 'right' }),
	]),
	T('kitchen-mealprep', 'Meal prep per dag', 'kitchen', ['meal prep', 'maaltijd', 'lunch', 'weekdag', 'bakje', 'dag', 'weekday'], prepF, [
		brd('rounded'),
		emo('🍱', 3.4, 3.4, 7),
		two('{gerecht}', 11.6, 3.2, 25.2, 7.4, { font: 'Fredoka', size: 3.6, ...B, align: 'left' }),
		...seg(prepF[1], 3.2, 11.6, 33.6, 4.2, { text: { size: 2 } }),
		lab('GEMAAKT', 3.4, 16.8, 15), date('gemaakt', 3.4, 19.2, 15, 3, { size: 2.2, align: 'left', bold: false }),
		one('{kcal} kcal', 18.6, 16.8, 18, 5.4, { font: OSW, size: 3.4, ...B, align: 'right' }),
		shp('rect', 3.2, 22.6, 33.6, 4, { stroke: 0, fill: 'black' }),   // zwarte balk; tekstvakken erin met lucht tot de rand
		bar('EET VOOR', 3.9, 22.6, 10.4, 4, { size: 1.9, letterSpacing: 0.1 }),
		date('op', 14.6, 22.6, 21.6, 4, { font: OSW, size: 3.4, invert: true }),
	]),
	T('kitchen-allergenen', 'Allergenen', 'kitchen', ['allergenen', 'allergie', 'gluten', 'noten', 'pinda', 'lactose', 'allergens', 'allergy'], allerF, [
		brd('line'),
		ico('alert-triangle', 3.2, 3, 6),
		lab('BEVAT ALLERGENEN', 10.2, 3, 26.6, 2.4, { size: 1.8 }),
		one('{gerecht}', 10.2, 5.4, 26.6, 3.8, { font: MONT, size: 3, ...B, align: 'left' }),
		...ALLERGENEN.flatMap(([k, l], i) => pill(l, pick(allerF[i + 1], true), 3.2 + (i % 3) * 11.4, 10.4 + Math.floor(i / 3) * 5.6, 10.8, 4.6, { radius: 1, text: { size: 2 } })),
	]),
	T('kitchen-jam', 'Zelfgemaakte jam', 'kitchen', ['jam', 'zelfgemaakt', 'inmaken', 'weckpot', 'handgemaakt', 'homemade', 'preserve'], jamF, [
		brd('scallop', 0.45),
		shp('heart', 7.2, 5, 2.4, 2.1, { stroke: 0, fill: 'black' }), shp('heart', 30.4, 5, 2.4, 2.1, { stroke: 0, fill: 'black' }),
		one('ZELFGEMAAKT', 10.2, 4.6, 19.6, 2.8, { size: 1.9, ...B, letterSpacing: 0.45 }),
		two('{naam}', 5, 7.6, 30, 8.4, { font: 'Pacifico', size: 5.2, lineHeight: 1.4 }),   // Pacifico tekent ~1,75 em hoog
		one('{extra}', 5.4, 17, 29.2, 2.8, { size: 2.2, ...I }),
		rule(12, 20.3, 16, 0.25),
		one('door {maker}', 5.4, 21, 29.2, 2.8, { size: 2.2, ...B }),
		date('gemaakt', 9, 23.8, 22, 2.4, { size: 1.9, bold: false }),
	]),
	T('kitchen-wijn', 'Huiswijn / likeur', 'kitchen', ['wijn', 'likeur', 'zelfgemaakt', 'fles', 'jaargang', 'wine', 'bottle', 'homemade'], wijnF, [
		brd('deco', 0.5),
		one('HUISGEMAAKT', 8, 5, 24, 2.4, { size: 1.8, ...B, letterSpacing: 0.8 }),
		two('{naam}', 5, 7.4, 30, 6, { font: 'Cinzel', size: 4.6, ...B, lineHeight: 1 }),
		rule(7, 15.6, 7.4, 0.25), rule(25.6, 15.6, 7.4, 0.25),
		one('{jaar}', 14.4, 13.6, 11.2, 4.2, { font: 'Cinzel', size: 3.4, ...B }),
		...seg(wijnF[1], 8.4, 18.6, 23.2, 3.6, { labels: ['ROOD', 'WIT', 'ROSÉ'], text: { size: 1.9, letterSpacing: 0.2 } }),
		one('{alc}% vol', 8, 22.6, 24, 2.8, { size: 2.1, ...I }),
	]),
	T('kitchen-restjes', 'Restjes', 'kitchen', ['restjes', 'over', 'koelkast', 'vriezer', 'bakje', 'leftovers', 'fridge'], restF, [
		brd('dashed', 0.45),
		one('Restjes', 3.4, 3, 22, 5.8, { font: 'Permanent Marker', size: 4.6, align: 'left' }),
		ico('fridge', 30.6, 2.8, 6.2, only(restF[1], 'Koelkast')), ico('snowflake', 30.6, 2.8, 6.2, only(restF[1], 'Vriezer')),
		two('{wat}', 3.4, 9.2, 33.2, 6.6, { font: 'Kalam', size: 4.2, ...B, align: 'left', lineHeight: 1.3 }),
		...pill('Koelkast', pick(restF[1], 'Koelkast'), 3.4, 16.4, 16.2, 3.6), ...pill('Vriezer', pick(restF[1], 'Vriezer'), 20.4, 16.4, 16.2, 3.6),
		lab('GEMAAKT', 3.4, 21, 16.2), date('gemaakt', 3.4, 23.4, 16.2, 3, { size: 2.2, align: 'left', bold: false }),
		lab('OP VOOR', 20.4, 21, 16.2, 2.4, { align: 'right' }), date('op', 20.4, 23.4, 16.2, 3, { size: 2.4, align: 'right' }),
	]),
	T('kitchen-kooktijd', 'Voorraadbus + kooktijd', 'kitchen', ['pasta', 'rijst', 'kooktijd', 'voorraadbus', 'bus', 'cooking time', 'storage'], bakF, [
		brd('thick-thin', 0.4),
		two('{naam}', 4.2, 4.2, 31.6, 8.6, { font: OSW, size: 7.6, ...B, lineHeight: 1 }),
		rule(4.2, 13.8, 31.6),
		ico('clock', 4.6, 16.2, 7),
		lab('KOOKTIJD', 12.2, 15.4, 9.6, 2.4, { size: 1.7, letterSpacing: 0.2 }),
		one('{kook} min', 12.2, 17.8, 9.6, 5.2, { font: OSW, size: 3.8, ...B, align: 'left' }),
		rule(22.6, 15.6, 0.3, 8),
		lab('INHOUD', 23.8, 15.4, 12, 2.4, { size: 1.7, align: 'right' }),
		one('{gewicht} g', 23.8, 17.8, 12, 5.2, { font: OSW, size: 3.8, ...B, align: 'right' }),
	]),
	T('kitchen-koffie', 'Koffiebonen', 'kitchen', ['koffie', 'bonen', 'gemalen', 'branding', 'blik', 'coffee', 'beans', 'roast'], koffieF, [
		brd('rounded'),
		ico('coffee', 3.2, 3.2, 9.4, { invert: true, stroke: 1.6 }),
		lab('KOFFIE', 13.8, 3.4, 23),
		two('{naam}', 13.8, 5.8, 23, 6.8, { font: 'Playfair Display', size: 4, ...B, align: 'left' }),
		lab('BRANDING', 3.4, 13.6, 33.2, 2.2, { size: 1.7 }),
		...seg(koffieF[1], 3.2, 16, 33.6, 3.8, { labels: ['LICHT', 'MEDIUM', 'DONKER'], text: { size: 1.9, letterSpacing: 0.2 } }),
		...pill('Bonen', pick(koffieF[2], 'Bonen'), 3.2, 21.6, 9.6, 3.8, { text: { size: 1.9 } }), ...pill('Gemalen', pick(koffieF[2], 'Gemalen'), 13.4, 21.6, 10.4, 3.8, { text: { size: 1.9 } }),
		date('gebrand', 25, 21.6, 11.8, 3.8, { size: 2, align: 'right', bold: false }),
	]),
	T('kitchen-oven', 'Oven-instructie', 'kitchen', ['oven', 'bakken', 'recept', 'temperatuur', 'baktijd', 'baking', 'recipe'], ovenF, [
		brd('double', 0.4),
		ico('chef-hat', 4.4, 4.2, 6.2),
		two('{naam}', 11.6, 4.2, 24, 6.2, { font: 'Righteous', size: 3.8, align: 'left' }),
		shp('rect', 4.4, 12, 14.8, 12.4, { stroke: 0.4, radius: 1.2 }), shp('rect', 20.8, 12, 14.8, 12.4, { stroke: 0.4, radius: 1.2 }),
		one('{temp}', 5, 12.8, 13.6, 7.4, { font: OSW, size: 6.4, ...B }),
		one('OVEN °C', 5, 20.4, 13.6, 2.8, { size: 1.8, ...B, letterSpacing: 0.3 }),
		one('{baktijd}', 21.4, 12.8, 13.6, 7.4, { font: OSW, size: 6.4, ...B }),
		one('MINUTEN', 21.4, 20.4, 13.6, 2.8, { size: 1.8, ...B, letterSpacing: 0.3 }),
	]),
];

// ======================================================================= Huis & opslag

const doosF = [fnum('nr', 'Doosnummer', '07'), ftext('titel', 'Titel', 'Kerstversiering'), ftext('inhoud', 'Inhoud', 'Lampjes, ballen, piek en het kerstkleed'), fchoice('plek', 'Plek', ['Zolder', 'Kelder', 'Schuur', 'Garage'])];
const KAMERS = [['Woonkamer', 'sofa'], ['Keuken', 'tools-kitchen-2'], ['Slaapkamer', 'bed'], ['Badkamer', 'bath'], ['Kinderkamer', 'baby-carriage'], ['Zolder', 'stairs'], ['Kantoor', 'briefcase'], ['Schuur', 'tool']];
const verhuisF = [fchoice('kamer', 'Kamer', KAMERS.map(k => k[0]), 'Keuken'), ftext('inhoud', 'Inhoud', 'Pannen en servies'), fnum('nr', 'Doos', '3'), fnum('totaal', 'Van', '12'), ftoggle('breekbaar', 'Breekbaar', true)];
const sleutelF = [ftext('naam', 'Sleutel van', 'Achterdeur'), ftext('code', 'Code', 'A-12'), ftext('eigenaar', 'Eigenaar', 'Fam. de Vries'), ftoggle('reserve', 'Reserve', true)];
const reinF = [ftext('naam', 'Middel', 'Allesreiniger'), fnum('dosis', 'Dosering', '20', 'ml'), fchoice('voor', 'Voor', ['Keuken', 'Bad', 'Vloer', 'Glas']), ftoggle('kind', 'Kindwaarschuwing', true)];
const onderhoudF = [ftext('taak', 'Taak', 'Filter afzuigkap'), fdate('gedaan', 'Gedaan'), fdate('volgende', 'Volgende', 90)];
const SOORTEN = [['Kleding', 'shirt'], ['Gereedschap', 'tools'], ['Papieren', 'file-text'], ['Kabels', 'plug'], ['Speelgoed', 'device-gamepad'], ['Overig', 'box']];
const ladeF = [ftext('inhoud', 'Inhoud', 'Sokken & ondergoed'), fchoice('soort', 'Soort', SOORTEN.map(s => s[0])), ftext('plek', 'Plek', 'Kast 2 · bovenste lade')];
const wasF = [ftext('wat', 'Wat', 'Donkere was'), fchoice('temp', 'Temperatuur', ['30°', '40°', '60°', '90°'], '40°'), ftoggle('droger', 'Droger mag', true)];
const meterF = [fchoice('meter', 'Meter', ['Stroom', 'Gas', 'Water']), ftext('stand', 'Stand', '012345', '000000'), fdate('datum', 'Opgenomen')];
const groepF = [fnum('groep', 'Groep', '3'), ftext('wat', 'Wat', 'Keuken + vaatwasser'), fchoice('amp', 'Zekering', ['10 A', '16 A', '20 A', '25 A'], '16 A')];
const leenF = [ftext('eigenaar', 'Eigenaar', 'Sanne'), ftext('aan', 'Uitgeleend aan', 'Mark'), fdate('op', 'Op'), fdate('terug', 'Terug voor', 14)];
const AFVAL = [['Restafval', 'trash'], ['Plastic', 'bottle'], ['Papier', 'file-text'], ['GFT', 'leaf'], ['Glas', 'glass-full']];
const afvalF = [fchoice('soort', 'Soort', AFVAL.map(a => a[0]), 'Plastic'), fchoice('dag', 'Ophaaldag', ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'], 'Do'), fchoice('freq', 'Hoe vaak', ['Elke week', 'Om de week', 'Per maand'], 'Om de week')];

const HOME = [
	T('home-doos', 'Opbergdoos', 'home', ['doos', 'opslag', 'zolder', 'inhoud', 'kelder', 'box', 'storage', 'contents'], doosF, [
		brd('line'),
		shp('rect', M, M, 11.4, 11.8, { stroke: 0, fill: 'black' }),
		bar('DOOS', 2.3, M, 9.8, 3.4, { size: 2, letterSpacing: 0.6 }),
		bar('{nr}', 2.3, 4.9, 9.8, 8.4, { font: 'Anton', bold: false, size: 7.6 }),
		two('{titel}', 14.2, 3, 22.6, 9.6, { font: MONT, size: 4, ...B, align: 'left' }),
		txt('{inhoud}', 3.2, 14.6, 33.6, 7, { size: 2.6, lineHeight: 1.15, valign: 'middle', fit: 'shrink' }),
		...seg(doosF[3], 3.2, 22.6, 33.6, 3.8, { text: { size: 1.9 } }),
	]),
	T('home-verhuis', 'Verhuisdoos per kamer', 'home', ['verhuizen', 'verhuisdoos', 'kamer', 'breekbaar', 'moving', 'room', 'box'], verhuisF, [
		brd('thick', 0.5),
		...KAMERS.map(([k, icon]) => ico(icon, 3.8, 3.8, 8.4, only(verhuisF[0], k))),
		one('{kamer}', 13.4, 3.8, 22.8, 8.4, { font: 'Anton', size: 6.4, align: 'left', letterSpacing: 0.2 }),
		rule(3.8, 13.4, 32.4),
		two('{inhoud}', 3.8, 14.4, 32.4, 5.6, { size: 2.6, lineHeight: 1.1 }),
		one('DOOS {nr} / {totaal}', 3.8, 21, 13.6, 5.2, { font: OSW, size: 3.4, ...B, align: 'left' }),
		bar('BREEKBAAR', 18.6, 21.6, 11.8, 4, { size: 1.9, letterSpacing: 0.1, ...only(verhuisF[4], true) }),
		ico('arrow-big-up', 31.4, 21, 5, { stroke: 2 }),
	]),
	T('home-sleutel', 'Sleutellabel', 'home', ['sleutel', 'sleutelbos', 'reserve', 'deur', 'slot', 'key', 'spare key'], sleutelF, [
		brd('tag', 0.5),
		ico('key', 11, 3.6, 6.8, { stroke: 1.8 }),
		one('{code}', 18.6, 3.6, 17.8, 6.8, { font: MONO, size: 4.2, ...B, align: 'right' }),
		two('{naam}', 11, 11.4, 25.4, 9, { font: MONT, size: 4.8, ...B, align: 'left' }),
		one('{eigenaar}', 11, 21.8, 15, 3.8, { size: 2.2, ...I, align: 'left', ...only(sleutelF[3], true) }),
		one('{eigenaar}', 11, 21.8, 25.4, 3.8, { size: 2.2, ...I, align: 'left', ...only(sleutelF[3], false) }),
		bar('RESERVE', 26.8, 21.8, 9.6, 3.8, { size: 1.9, letterSpacing: 0.1, ...only(sleutelF[3], true) }),
	]),
	T('home-schoonmaak', 'Schoonmaakmiddel', 'home', ['schoonmaak', 'spray', 'fles', 'reiniger', 'dosering', 'cleaning', 'cleaner'], reinF, [
		brd('line'),
		ico('spray', 3.2, 3, 8),
		two('{naam}', 12.2, 3, 24.6, 8, { font: 'Poppins', size: 4, ...B, align: 'left', lineHeight: 1.15 }),
		one('{dosis} ml op 1 liter water', 3.2, 11.8, 33.6, 3, { size: 2.2, ...B }),
		...seg(reinF[2], 3.2, 15.8, 33.6, 3.8, { text: { size: 2 } }),
		bar('Buiten bereik van kinderen', M, 21.2, 37, 7.3, { size: 2.3, ...B, ...only(reinF[3], true) }),
		one('Na gebruik goed afsluiten', 3.2, 22.6, 33.6, 3.4, { size: 2.1, ...I, ...only(reinF[3], false) }),
	]),
	T('home-onderhoud', 'Onderhoud / vervangen', 'home', ['onderhoud', 'filter', 'vervangen', 'batterij', 'rookmelder', 'maintenance', 'replace'], onderhoudF, [
		brd('corners', 0.5),
		ico('circle-check', 3.4, 3.4, 8.2),
		lab('ONDERHOUD', 13, 3.4, 23.6),
		two('{taak}', 13, 5.8, 23.6, 6.2, { font: MONT, size: 3.6, ...B, align: 'left' }),
		one('Laatst gedaan', 3.4, 13.8, 14, 4, { size: 2.2, align: 'left' }),
		date('gedaan', 17.4, 13.8, 19.2, 4, { size: 2.4, align: 'right', bold: false }),
		rule(3.4, 18.8, 33.2, 0.25),
		shp('rect', 3.4, 20.2, 33.2, 5.8, { stroke: 0, fill: 'black' }),
		bar('VOLGENDE', 4.1, 20.2, 10.8, 5.8, { size: 1.9, letterSpacing: 0.1 }),
		date('volgende', 15.4, 20.2, 20.6, 5.8, { font: OSW, size: 4, invert: true }),
	]),
	T('home-lade', 'Kast- of lade-inhoud', 'home', ['kast', 'lade', 'opbergen', 'inhoud', 'kleding', 'drawer', 'cupboard', 'organize'], ladeF, [
		shp('rect', M, M, 37, 27, { stroke: 0.5 }),
		shp('rect', M, M, 12.6, 27, { stroke: 0, fill: 'black' }),
		...SOORTEN.map(([s, icon]) => ico(icon, 3.3, 5.4, 9, { invert: true, stroke: 1.6, ...only(ladeF[1], s) })),
		one('{soort}', 2.3, 20.4, 11, 3.4, { size: 2, ...B, invert: true }),
		two('{inhoud}', 16, 3.2, 20.8, 15.6, { font: 'Fredoka', size: 5.4, ...B, align: 'left', lineHeight: 1 }),
		rule(16, 20, 20.8),
		one('{plek}', 16, 21.4, 20.8, 4.2, { size: 2.3, ...I, align: 'left' }),
	]),
	T('home-was', 'Wasmand', 'home', ['was', 'wasmand', 'temperatuur', 'droger', 'kleding', 'laundry', 'washing'], wasF, [
		brd('rounded-double', 0.45),
		ico('wash', 4.2, 4.2, 8.4),
		two('{wat}', 14, 4.2, 21.8, 8.4, { font: 'Nunito', size: 4.2, ...B, align: 'left' }),
		lab('WASTEMPERATUUR', 4.4, 13.6, 31.2, 2.2, { size: 1.7, align: 'center' }),
		...seg(wasF[1], 4.4, 16.2, 31.2, 4.4, { text: { font: OSW, size: 2.6 } }),
		one('Mag in de droger', 4.4, 21.8, 31.2, 3.8, { size: 2.2, ...B, ...only(wasF[2], true) }),
		bar('NIET IN DE DROGER', 4.4, 21.8, 31.2, 3.8, { size: 2.1, letterSpacing: 0.2, ...only(wasF[2], false) }),
	]),
	T('home-meter', 'Meterstand', 'home', ['meterstand', 'stroom', 'gas', 'water', 'meter', 'energie', 'meter reading', 'energy'], meterF, [
		brd('line'),
		ico('bolt', 3.2, 3, 7.4, only(meterF[0], 'Stroom')), ico('flame', 3.2, 3, 7.4, only(meterF[0], 'Gas')), ico('droplet', 3.2, 3, 7.4, only(meterF[0], 'Water')),
		lab('METERSTAND', 11.8, 3, 25),
		one('{meter}', 11.8, 5.6, 25, 4.8, { font: MONT, size: 3.8, ...B, align: 'left' }),
		shp('rect', 3.2, 12, 33.6, 8.4, { stroke: 0.45, radius: 1 }),
		one('{stand}', 4.2, 12.6, 24.8, 7.2, { font: 'Space Mono', size: 5.4, ...B, letterSpacing: 0.4 }),
		one('kWh', 29, 12.6, 7, 7.2, { size: 2.4, ...B, ...only(meterF[0], 'Stroom') }), one('m³', 29, 12.6, 7, 7.2, { size: 2.6, ...B, ...only(meterF[0], 'Gas', 'Water') }),
		one('Opgenomen', 3.4, 22.2, 14, 3.8, { size: 2.2, align: 'left' }),
		date('datum', 17.4, 22.2, 19.2, 3.8, { size: 2.5, align: 'right' }),
	]),
	T('home-groep', 'Groepenkast', 'home', ['groepenkast', 'zekering', 'meterkast', 'stroom', 'groep', 'fuse box', 'breaker'], groepF, [
		brd('brackets', 0.5),
		shp('ellipse', 3.6, 3.6, 12.4, 12.4, { stroke: 0.9 }),
		one('{groep}', 5.8, 5.8, 8, 8, { font: 'Anton', size: 7 }),
		lab('GROEP', 3.6, 16.8, 12.4, 2.4, { align: 'center', size: 1.8 }),
		ico('bolt', 18.2, 3.6, 4.4, { stroke: 2 }),
		lab('METERKAST', 23.2, 4.6, 13.2, 2.4, { size: 1.8, align: 'right', letterSpacing: 0.3 }),
		two('{wat}', 18.2, 8.6, 18.2, 10.6, { font: MONT, size: 3.6, ...B, align: 'left' }),
		...seg(groepF[2], 3.6, 21.4, 32.8, 4.2, { text: { font: OSW, size: 2.4 } }),
	]),
	T('home-uitgeleend', 'Uitgeleend', 'home', ['uitlenen', 'lenen', 'terug', 'boek', 'gereedschap', 'lend', 'borrowed', 'return'], leenF, [
		brd('stamp', 0.4),
		one('UITGELEEND', 4.6, 4.4, 30.8, 4, { font: 'Archivo Black', size: 3.4, letterSpacing: 0.5 }),
		one('eigendom van {eigenaar}', 4.6, 8.6, 30.8, 2.8, { size: 2.1, ...I }),
		rule(4.6, 12.2, 30.8, 0.25),
		lab('AAN', 4.6, 13.6, 7, 4.6),
		one('{aan}', 11.6, 13, 23.8, 5.4, { font: 'Kalam', size: 3.8, ...B, align: 'left', lineHeight: 1.4 }),
		one('op', 4.6, 18.8, 7, 2.8, { size: 2, align: 'left' }),
		date('op', 11.6, 18.8, 23.8, 2.8, { size: 2.1, align: 'left', bold: false }),
		shp('rect', 4.6, 22.2, 30.8, 3.8, { stroke: 0, fill: 'black' }),
		bar('TERUG VOOR', 5.3, 22.2, 12.2, 3.8, { size: 1.8 }),
		date('terug', 18, 22.2, 16.7, 3.8, { size: 2.6, invert: true }),
	]),
	T('home-afval', 'Afvalbak', 'home', ['afval', 'kliko', 'container', 'plastic', 'papier', 'gft', 'recycling', 'waste', 'bin'], afvalF, [
		shp('rect', M, M, 37, 27, { stroke: 0.5 }),
		shp('rect', M, M, 37, 13, { stroke: 0, fill: 'black' }),
		...AFVAL.map(([s, icon]) => ico(icon, 3.4, 3.4, 9.2, { invert: true, stroke: 1.7, ...only(afvalF[0], s) })),
		one('{soort}', 14, 2.4, 22.6, 11.2, { font: 'Anton', size: 7.4, align: 'left', invert: true }),
		lab('OPHAALDAG', 3.4, 15.6, 33.2, 2.4, { align: 'center', letterSpacing: 0.6 }),
		...seg(afvalF[1], 3.4, 18.4, 33.2, 4.4, { text: { size: 2.2 } }),
		...seg(afvalF[2], 3.4, 23.4, 33.2, 3.4, { text: { size: 1.8 } }),
	]),
];

// ======================================================================= Tuin & planten

const zaaiF = [ftext('plant', 'Plant', 'Cherrytomaat'), ftext('ras', 'Ras', 'Sweet Million'), fdate('gezaaid', 'Gezaaid'), fnum('kiem', 'Kiemt in', '7', 'dagen'), fchoice('plek', 'Plek', ['Binnen', 'Kas', 'Buiten'])];
const oogstF = [ftext('gewas', 'Gewas', 'Courgette'), fnum('gewicht', 'Gewicht', '1,2', 'kg'), fdate('datum', 'Geoogst'), fchoice('bestemming', 'Bestemming', ['Vers', 'Inmaken', 'Invriezen'])];
const zorgF = [ftext('plant', 'Plant', 'Monstera'), fchoice('water', 'Water', ['Weinig', 'Matig', 'Veel'], 'Matig'), fchoice('licht', 'Licht', ['Schaduw', 'Halfschaduw', 'Zon'], 'Halfschaduw'), ftext('tip', 'Tip', 'Elke 2 weken plantenvoeding')];
const stekF = [ftext('plant', 'Plant', 'Pannenkoekplant'), ftext('van', 'Van', 'Lisa'), fdate('datum', 'Datum')];
const vakF = [fnum('vak', 'Vak', '3'), ftext('gewas', 'Gewas', 'Spinazie'), fdate('geplant', 'Geplant'), fdate('oogst', 'Oogst vanaf', 60)];
const MAANDEN = [['jan', 'Jan', 'J'], ['feb', 'Feb', 'F'], ['mrt', 'Mrt', 'M'], ['apr', 'Apr', 'A'], ['mei', 'Mei', 'M'], ['jun', 'Jun', 'J'], ['jul', 'Jul', 'J'], ['aug', 'Aug', 'A'], ['sep', 'Sep', 'S'], ['okt', 'Okt', 'O'], ['nov', 'Nov', 'N'], ['dec', 'Dec', 'D']];
const kalF = [ftext('plant', 'Plant', 'Wortel'), ...MAANDEN.map(([k, l], i) => ftoggle(k, 'Zaaien ' + l, i >= 2 && i <= 6)), fnum('diepte', 'Diepte', '1', 'cm'), fnum('afstand', 'Rijafstand', '20', 'cm')];
const kamerF = [ftext('naam', 'Naam', 'Gatenplant'), ftext('latijn', 'Latijnse naam', 'Monstera deliciosa'), ftoggle('giftig', 'Giftig voor dieren', true)];

// Niveau-iconen (1-3): vak k is gevuld als de keuze minstens niveau k is, anders een omtrek.
function levels(f, icon, x, y, s, gap) {
	return [0, 1, 2].flatMap(k => {
		const on = f.options.slice(k), off = f.options.slice(0, k), at = x + k * (s + gap);
		return k ? [ico(icon, at, y, s, { set: 'filled', ...only(f, ...on) }), ico(icon, at, y, s, { stroke: 1.6, ...only(f, ...off) })] : [ico(icon, at, y, s, { set: 'filled' })];
	});
}

const GARDEN = [
	T('garden-zaaien', 'Zaailabel', 'garden', ['zaaien', 'zaad', 'moestuin', 'kiemen', 'kas', 'sowing', 'seeds', 'seedling'], zaaiF, [
		brd('rounded'),
		ico('seeding', 3.2, 3, 8),
		one('{plant}', 12, 3, 24.8, 5.2, { font: 'Roboto Slab', size: 4, ...B, align: 'left' }),
		one('{ras}', 12, 8.2, 24.8, 3, { size: 2.3, ...I, align: 'left' }),
		rule(3.2, 12, 33.6),
		one('Gezaaid', 3.4, 13, 13, 3.4, { size: 2.2, align: 'left' }),
		date('gezaaid', 16.4, 13, 20.2, 3.4, { size: 2.4, align: 'right' }),
		one('kiemt in ± {kiem} dagen', 3.4, 16.8, 33.2, 3, { size: 2.1, ...I, align: 'left' }),
		...seg(zaaiF[4], 3.2, 21.4, 33.6, 4.2, { labels: ['BINNEN', 'KAS', 'BUITEN'], text: { size: 2, letterSpacing: 0.2 } }),
	]),
	T('garden-oogst', 'Oogst', 'garden', ['oogst', 'moestuin', 'groente', 'fruit', 'inmaken', 'harvest', 'vegetables'], oogstF, [
		brd('wave', 0.45),
		lab('OOGST', 4.2, 4.2, 11, 2.6, { size: 2 }),
		one('{gewicht} kg', 25, 4, 10.8, 3, { font: OSW, size: 2.6, ...B, align: 'right' }),
		emo('🧺', 16.4, 3.4, 7.2),
		one('{gewas}', 4.2, 11, 31.6, 7, { font: 'Bebas Neue', size: 6.6, letterSpacing: 0.3 }),
		date('datum', 4.2, 18.2, 31.6, 3, { size: 2.2, bold: false }),
		...seg(oogstF[3], 4.6, 22, 30.8, 3.6, { text: { size: 2 } }),
	]),
	T('garden-verzorging', 'Plantverzorging', 'garden', ['plant', 'verzorging', 'water', 'licht', 'kamerplant', 'plant care', 'watering', 'sunlight'], zorgF, [
		brd('line'),
		ico('plant-2', 3.2, 3, 7.4),
		two('{plant}', 11.6, 3, 25.2, 7.4, { font: 'Merriweather', size: 4, ...B, align: 'left' }),
		rule(3.2, 11.4, 33.6, 0.25),
		lab('WATER', 3.4, 12.8, 8.8, 4.2, { size: 1.8 }),
		...levels(zorgF[1], 'droplet', 12.6, 13, 3.8, 0.5),
		one('{water}', 25.8, 12.8, 11, 4.2, { size: 2, ...B, align: 'right' }),
		lab('LICHT', 3.4, 18, 8.8, 4.2, { size: 1.8 }),
		...levels(zorgF[2], 'sun', 12.6, 18.2, 3.8, 0.5),
		one('{licht}', 25.8, 18, 11, 4.2, { size: 2, ...B, align: 'right' }),
		one('{tip}', 3.2, 23.4, 33.6, 3.2, { size: 2.1, ...I }),
	]),
	T('garden-stek', 'Stekje cadeau', 'garden', ['stek', 'stekje', 'cadeau', 'plant', 'kamerplant', 'cutting', 'gift', 'plant swap'], stekF, [
		brd('dots', 0.4),
		emo('🌱', 16.2, 3.8, 7.6),
		one('een stekje van', 5, 11.6, 30, 3, { font: 'Dancing Script', size: 3, ...B }),
		one('{van}', 5, 14.8, 30, 6.2, { font: 'Pacifico', size: 4.2, lineHeight: 1.45 }),
		one('{plant}', 5, 21.6, 30, 2.8, { size: 2.2, ...B, letterSpacing: 0.2 }),
		date('datum', 9, 24.4, 22, 2.4, { size: 1.9, bold: false }),
	]),
	T('garden-moestuinvak', 'Moestuinvak', 'garden', ['moestuin', 'vak', 'bed', 'planten', 'oogst', 'garden bed', 'allotment'], vakF, [
		shp('rect', M, M, 37, 27, { stroke: 0.5 }),
		shp('rect', M, M, 12, 27, { stroke: 0, fill: 'black' }),
		one('VAK', M, 3.2, 12, 3.4, { size: 2.2, ...B, letterSpacing: 0.8, invert: true }),
		one('{vak}', 2.3, 6.6, 10.4, 12, { font: 'Anton', size: 10, invert: true }),
		ico('shovel', 3.8, 19.8, 7.4, { invert: true, stroke: 1.7 }),
		two('{gewas}', 15.4, 3, 21.4, 8.4, { font: 'Roboto Slab', size: 4.4, ...B, align: 'left' }),
		lab('GEPLANT', 15.4, 12.4, 21.4),
		date('geplant', 15.4, 14.8, 21.4, 3.4, { size: 2.4, align: 'left', bold: false }),
		lab('OOGST VANAF', 15.4, 19.2, 21.4),
		one('{oogst}', 15.4, 21.6, 21.4, 5, { font: OSW, size: 4.2, ...B, align: 'left' }),
	]),
	T('garden-zaaikalender', 'Zaaikalender', 'garden', ['zaaikalender', 'maanden', 'zaaien', 'moestuin', 'zaadzakje', 'sowing calendar', 'months'], kalF, [
		brd('line'),
		ico('calendar-event', 3.2, 3, 6.8),
		one('{plant}', 11.2, 3, 25.6, 6.8, { font: 'Bebas Neue', size: 6.4, align: 'left', letterSpacing: 0.3 }),
		lab('ZAAIEN', 3.4, 11, 33.2, 2.4, { letterSpacing: 0.6 }),
		shp('rect', 3.2, 13.6, 33.6, 5, { stroke: 0.3 }),
		...MAANDEN.flatMap(([k, , c], i) => [...i ? [rule(3.2 + i * 2.8 - 0.125, 13.6, 0.25, 5)] : [], one(c, 3.2 + i * 2.8, 13.6, 2.8, 5, { size: 2.2, ...B, ...pick(kalF[i + 1], true) })]),
		lab('DIEPTE', 3.4, 20.2, 16, 2.2, { size: 1.7 }),
		one('{diepte} cm', 3.4, 22.4, 16, 4, { font: OSW, size: 3.2, ...B, align: 'left' }),
		rule(19.85, 20.4, 0.3, 6),
		lab('RIJAFSTAND', 20.6, 20.2, 16, 2.2, { size: 1.7, align: 'right' }),
		one('{afstand} cm', 20.6, 22.4, 16, 4, { font: OSW, size: 3.2, ...B, align: 'right' }),
	]),
	T('garden-kamerplant', 'Kamerplant', 'garden', ['kamerplant', 'plant', 'giftig', 'huisdieren', 'latijn', 'houseplant', 'pet safe', 'toxic'], kamerF, [
		brd('shadow', 0.45),
		ico('plant', 15.4, 3.2, 8),
		one('{naam}', 3.4, 11.6, 31.2, 5.8, { font: 'Playfair Display', size: 4.8, ...B }),
		one('{latijn}', 3.4, 17.4, 31.2, 3, { font: 'Playfair Display', size: 2.4, ...I }),
		bar('GIFTIG VOOR HUISDIEREN', 4.4, 21.6, 29.2, 3.6, { size: 2, letterSpacing: 0.1, ...only(kamerF[2], true) }),
		one('Veilig voor huisdieren', 4.4, 21.6, 29.2, 3.6, { size: 2.1, ...I, ...only(kamerF[2], false) }),
	]),
];

export default [...KITCHEN, ...HOME, ...GARDEN];
