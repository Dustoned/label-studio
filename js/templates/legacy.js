// Templates uit golf 1-2 (verschillende labelmaten), ongewijzigd verhuisd uit presets.js. Plain data + bouwstenen, geen imports.
// presets.js koppelt de oude categorie-ids aan de nieuwe en vult tags aan.

// Compacte bouwstenen; ontbrekende velden vult doc.normalizeTemplateDoc met de defaults.
const txt = (text, x, y, w, h, o = {}) => ({ type: 'text', text, x, y, w, h, ...o });
const mid = (text, x, y, w, h, o = {}) => txt(text, x, y, w, h, { align: 'center', valign: 'middle', ...o });
const one = (text, x, y, w, h, o = {}) => mid(text, x, y, w, h, { wrap: false, fit: 'shrink', ...o });   // één regel, krimpt mee
const bar = (text, x, y, w, h, o = {}) => one(text, x, y, w, h, { invert: true, ...o });                // witte tekst op zwarte balk
const brd = (style, w, h, stroke = 0.6) => ({ type: 'border', style, stroke, x: 1, y: 1, w: w - 2, h: h - 2 });
const rule = (x, y, w, h = 0.3) => ({ type: 'shape', shape: 'rect', stroke: 0, fill: 'black', x, y, w, h });
const shp = (shape, x, y, w, h, o = {}) => ({ type: 'shape', shape, stroke: 0.5, fill: 'none', x, y, w, h, ...o });
const ico = (icon, x, y, s, o = {}) => ({ type: 'icon', icon, set: 'outline', nodes: [], stroke: 2, x, y, w: s, h: s, ...o });
const code = (data, symbology, x, y, w, h, o = {}) => ({ type: 'barcode', data, symbology, showText: true, textSize: 2.2, x, y, w, h, ...o });
const qr = (data, x, y, s, o = {}) => ({ type: 'qr', data, symbology: 'qrcode', ecc: 'M', x, y, w: s, h: s, ...o });
// gewicht 600: dunne emoji-lijnen vallen op 203 dpi weg
const emo = (char, x, y, s, o = {}) => ({ type: 'emoji', char, style: 'mono', weight: 600, x, y, w: s, h: s, ...o });

// De M110S print 48 mm vanaf de linkerrand; op een 50 mm-label valt alles voorbij 48 mm weg. Ontwerpen voor brede
// labels staan hieronder in hele-labelmaten en worden horizontaal in [1, 47,5] mm geperst: tekst/codes/lijnen/randen
// smaller, vaste-verhouding-elementen (iconen, QR, emoji, cirkels) behouden hun maat en schuiven alleen mee.
const PRINT_RIGHT = 47.5;
const r3 = v => Math.round(v * 1000) / 1000;
const fixedRatio = el => ['icon', 'qr', 'emoji'].includes(el.type) || el.type === 'shape' && el.w === el.h;
export function intoPrintable(label, elements) {
	if (label.w <= 48) return elements;
	const inner = label.w - 2, k = (PRINT_RIGHT - 1) / inner;
	// vaste maat: lege ruimte links/rechts naar verhouding verkleinen, zodat iets dat tegen een rand lag daar blijft liggen
	return elements.map(el => fixedRatio(el) ? { ...el, x: r3(1 + (el.x - 1) * (PRINT_RIGHT - 1 - el.w) / Math.max(0.001, inner - el.w)) }
		: { ...el, x: r3(1 + (el.x - 1) * k), w: r3(el.w * k) });
}
const T = (id, name, category, [w, h, shape = 'rect'], elements, fields) =>
	({ id, name, category, doc: { label: { w, h, shape }, ...(fields && { fields }), elements: intoPrintable({ w, h }, elements) } });
const B = { bold: true }, I = { italic: true };
const MONT = 'Montserrat', OSW = 'Oswald', ARB = 'Arial Black', MONO = 'Roboto Mono', PLAY = 'Playfair Display';

export default [
	// —— Wiet & coffeeshop
	T('wiet-strain', 'Strain-potlabel', 'weed', [40, 30], [
		brd('rounded', 40, 30, 0.5),
		ico('cannabis', 3, 2.6, 7, { stroke: 1.6 }),
		txt('Amnesia Haze', 11.4, 2.6, 25.6, 7, { font: 'Bebas Neue', size: 5, letterSpacing: 0.3, valign: 'middle', wrap: false, fit: 'shrink' }),
		shp('rect', 3, 10.6, 34, 4, { stroke: 0.35 }),
		one('INDICA', 3, 10.6, 11.3, 4, { size: 2, ...B, letterSpacing: 0.15 }),
		bar('HYBRIDE', 14.35, 10.6, 11.3, 4, { size: 2, ...B, letterSpacing: 0.15 }),
		one('SATIVA', 25.7, 10.6, 11.3, 4, { size: 2, ...B, letterSpacing: 0.15 }),
		one('THC', 3, 15.8, 16, 2.6, { size: 2, ...B, letterSpacing: 0.4 }),
		one('22%', 3, 18.4, 16, 5.4, { font: OSW, size: 4.8, ...B }),
		rule(19.85, 16.2, 0.3, 7),
		one('CBD', 21, 15.8, 16, 2.6, { size: 2, ...B, letterSpacing: 0.4 }),
		one('<1%', 21, 18.4, 16, 5.4, { font: OSW, size: 4.8, ...B }),
		one('1 gram · verpakt {datum}', 3, 24.6, 34, 3, { size: 2.2 }),
	]),
	T('wiet-preroll', 'Pre-roll / joint', 'weed', [40, 20], [
		brd('line', 40, 20, 0.5),
		shp('rect', 1, 1, 11, 18, { stroke: 0, fill: 'black' }),
		ico('smoking', 2, 5.5, 9, { invert: true, stroke: 1.8 }),
		txt('PRE-ROLL', 14, 2.6, 23.5, 3, { size: 2.2, ...B, letterSpacing: 0.5, wrap: false, fit: 'shrink' }),
		txt('Lemon Haze', 14, 6, 23.5, 6.2, { font: 'Permanent Marker', size: 3.8, valign: 'middle', wrap: false, fit: 'shrink' }),
		txt('0,5 g · {datum}', 14, 13.4, 18.5, 3.4, { size: 2.3, valign: 'middle', wrap: false, fit: 'shrink' }),
		emo('💨', 33.2, 13, 4.2),
	]),
	T('wiet-edible', 'Edible-waarschuwing', 'weed', [40, 30], [
		brd('line', 40, 30, 0.6),
		bar('BEVAT THC', 1, 1, 38, 7.4, { font: 'Anton', size: 5, letterSpacing: 0.8 }),
		emo('🍪', 3, 9.6, 9.4),
		mid('Buiten bereik van kinderen en dieren', 14.2, 9.4, 22.8, 9.8, { size: 2.8, ...B, align: 'left', fit: 'shrink' }),
		rule(3, 20.4, 34, 0.3),
		one('1 stuk = 10 mg THC', 3, 21.2, 34, 3.4, { size: 2.5, ...B }),
		one('Werkt na 1-2 uur · niet rijden', 3, 24.6, 34, 3, { size: 2.1, ...I }),
	]),
	T('wiet-spacecake', 'Spacecake / brownie', 'weed', [40, 40, 'round'], [
		shp('ellipse', 2, 2, 36, 36, { stroke: 0.6 }),
		shp('ellipse', 3.6, 3.6, 32.8, 32.8, { stroke: 0.3, dash: 'dashed' }),
		emo('🧁', 14.5, 5.6, 11),
		one('Spacecake', 6, 16.4, 28, 9.2, { font: 'Pacifico', size: 5.4 }),
		one('start laag, ga langzaam', 8, 25.6, 24, 3.4, { size: 2.3, ...I }),
		one('{datum}', 12, 29.2, 16, 3, { font: MONO, size: 2.1 }),
	]),
	T('wiet-kweek', 'Kweeklabel', 'weed', [40, 30], [
		brd('rounded', 40, 30, 0.5),
		ico('plant', 3, 2.8, 10, { stroke: 1.5 }),
		txt('PLANT #{teller}', 14.5, 2.8, 22.5, 3.2, { size: 2.3, ...B, letterSpacing: 0.4, wrap: false, fit: 'shrink' }),
		mid('Northern Lights', 14.5, 6.2, 22.5, 7, { font: 'Roboto Slab', size: 3.3, ...B, align: 'left', lineHeight: 1.05, fit: 'shrink' }),
		rule(3, 14.4, 34, 0.3),
		txt('Gekiemd', 3, 15.6, 14, 3.2, { size: 2.2, valign: 'middle' }),
		txt('{datum}', 17, 15.6, 20, 3.2, { font: MONO, size: 2.3, ...B, align: 'right', valign: 'middle', wrap: false, fit: 'shrink' }),
		txt('Week', 3, 19.4, 8.6, 3.2, { size: 2.2, valign: 'middle' }),
		...[0, 1, 2, 3, 4, 5, 6, 7].map(i => shp('rect', 12.4 + i * 3.2, 19.7, 2.6, 2.6, { stroke: 0.3, radius: 0.4 })),
		txt('Bloei: ________   Oogst: ________', 3, 23.6, 34, 3.2, { size: 2.1, valign: 'middle', wrap: false, fit: 'shrink' }),
	]),
	T('wiet-zaadjes', 'Zaadjes-zakje', 'weed', [40, 60], [
		brd('double', 40, 60, 0.5),
		one('ZADEN', 4, 4, 32, 4, { font: MONT, size: 2.8, ...B, letterSpacing: 1.2 }),
		emo('🌱', 11, 9, 18),
		one('Gelato #41', 4, 28.4, 32, 8.4, { font: 'Bebas Neue', size: 7.6, letterSpacing: 0.3 }),
		bar('FEMINIZED · 5 STUKS', 4, 37.4, 32, 4.4, { size: 2.3, ...B, letterSpacing: 0.3 }),
		txt('Bloeitijd\nOpbrengst\nTHC', 5, 43.4, 14, 10.6, { size: 2.4, lineHeight: 1.45 }),
		txt('8-9 weken\nhoog\n± 25%', 19, 43.4, 16, 10.6, { size: 2.4, ...B, lineHeight: 1.45, align: 'right' }),
		one('Verpakt {datum}', 4, 54.4, 32, 3, { size: 2.1, ...I }),
	]),
	T('wiet-van-mij', 'Van mij (grinder/aansteker)', 'weed', [30, 15], [
		brd('rounded', 30, 15, 0.4),
		ico('lighter', 2.4, 2.5, 10, { stroke: 1.7 }),
		txt('VAN MIJ', 13.4, 2.4, 14.2, 5.4, { font: 'Anton', size: 3.8, letterSpacing: 0.3, valign: 'middle', wrap: false, fit: 'shrink' }),
		txt('afblijven!', 13.4, 8, 14.2, 4.4, { font: 'Permanent Marker', size: 3.2, valign: 'middle', wrap: false, fit: 'shrink' }),
	]),
	T('wiet-prijs', 'Prijs per gram', 'weed', [40, 30], [
		brd('double', 40, 30, 0.5),
		emo('🌿', 3.4, 3.2, 6.4),
		txt('White Widow', 10.6, 3.2, 26, 6.4, { font: MONT, size: 3.4, ...B, valign: 'middle', wrap: false, fit: 'shrink' }),
		txt('€ 12,50', 3.4, 10.4, 24.4, 11, { font: OSW, size: 8.6, ...B, align: 'right', valign: 'middle', wrap: false, fit: 'shrink' }),
		txt('per\ngram', 28.6, 12.8, 8.2, 6.6, { size: 2.6, ...B, lineHeight: 1.1, valign: 'middle' }),
		rule(3.4, 22.2, 33.2, 0.3),
		txt('THC 21%', 3.4, 23.2, 16, 3.6, { size: 2.6, ...B, valign: 'middle', wrap: false, fit: 'shrink' }),
		txt('Sativa', 20.6, 23.2, 16, 3.6, { size: 2.6, ...I, align: 'right', valign: 'middle', wrap: false, fit: 'shrink' }),
	]),
	T('wiet-420', '420-sticker', 'weed', [40, 40, 'round'], [
		shp('burst', 2, 2, 36, 36, { stroke: 0.7 }),
		ico('cannabis', 15.5, 6.6, 9, { set: 'filled' }),
		one('420', 8, 15.4, 24, 10.6, { font: 'Bangers', size: 9.6, letterSpacing: 0.6 }),
		one('CHILL TIME', 11.5, 25.8, 17, 3, { font: ARB, size: 2.1, letterSpacing: 0.25 }),
	]),
	T('wiet-niet-storen', 'Niet storen — high', 'weed', [40, 30], [
		brd('line', 40, 30, 0.6),
		bar('NIET STOREN', 1, 1, 38, 8, { font: 'Anton', size: 5.2, letterSpacing: 0.8 }),
		emo('😵‍💫', 3, 10.4, 12.4),
		mid('ik ben\nhigh', 16.6, 9.8, 20.4, 13.4, { font: 'Permanent Marker', size: 5, lineHeight: 1.05, fit: 'shrink' }),
		one('kom later terug', 3, 24, 34, 3.4, { size: 2.4, ...I }),
	]),
	T('wiet-coffeeshop', 'Coffeeshop-zakje', 'weed', [40, 40], [
		brd('deco', 40, 40, 0.5),
		one('COFFEESHOP', 5, 5, 30, 3, { font: MONT, size: 2.2, ...B, letterSpacing: 0.8 }),
		ico('cannabis', 15, 8.6, 10, { stroke: 1.4 }),
		one('Groene Uil', 5, 19.4, 30, 7.2, { font: 'Cinzel', size: 4.2, ...B }),
		rule(15, 27.2, 10, 0.35),
		one('Wiet · 1 gram', 5, 28.6, 30, 3.2, { size: 2.4, ...B }),
		one('{datum}', 5, 31.8, 30, 3, { font: MONO, size: 2.1 }),
	]),
	T('wiet-potdeksel', 'Potdeksel rond', 'weed', [30, 30, 'round'], [
		shp('ellipse', 1.5, 1.5, 27, 27, { stroke: 0.5 }),
		emo('🍃', 9.5, 3.6, 11),
		one('OG KUSH', 4, 14.8, 22, 6.4, { font: 'Bebas Neue', size: 5.6, letterSpacing: 0.4 }),
		one('3,5 g · {datum}', 6, 21.4, 18, 3, { size: 2 }),
	]),

	// —— Basis
	T('basis-titel', 'Titel + subregel', 'basis', [50, 30], [
		brd('rounded', 50, 30),
		mid('Jouw tekst', 4, 4, 42, 14, { font: MONT, size: 7, ...B, fit: 'shrink' }),
		rule(19, 19.2, 12, 0.4),
		one('Tweede regel', 4, 21, 42, 5, { size: 3.2 }),
	]),
	T('basis-qr', 'QR + tekst', 'basis', [40, 30], [
		// 20,9 mm = 167 dots: geen linklengte waarbij de code zijn box krap vult met grote modules (22 mm gaf bij een korte
		// link 8 dots/module en 2,5 modules wit tot de rand); >= 4 modules wit bij elke lengte
		qr('https://example.com', 2.5, 4.55, 20.9),
		mid('Scan\nmij', 25.5, 5, 13, 12, { font: MONT, size: 4.4, ...B, fit: 'shrink' }),
		ico('arrow-big-left', 28.5, 18.5, 7, { stroke: 1.8 }),
	]),

	// —— Winkel & prijzen
	T('prijskaartje', 'Prijskaartje', 'winkel', [40, 30], [
		brd('rounded', 40, 30),
		one('Productnaam', 3, 3.2, 34, 4.6, { font: MONT, size: 3.6, ...B }),
		rule(10, 8.4, 20),
		one('€ 4,99', 3, 9.2, 34, 14, { font: OSW, size: 12, ...B }),
		one('per stuk', 3, 23.4, 34, 3.4, { size: 2.6 }),
	]),
	T('aanbieding', 'Aanbieding', 'winkel', [40, 30], [
		brd('line', 40, 30, 0.6),
		bar('AANBIEDING', 1, 1, 38, 7.5, { font: 'Anton', size: 4.8, letterSpacing: 0.4 }),
		one('2 halen, 1 betalen', 3, 9.4, 34, 4.4, { size: 3.2, ...B }),
		one('€ 5,-', 3, 13.8, 34, 11, { font: OSW, size: 9.5, ...B }),
		one('zolang de voorraad strekt', 3, 24.8, 34, 3, { size: 2.2, ...I }),
	]),
	T('korting-rond', 'Kortingssticker', 'winkel', [40, 40, 'round'], [
		shp('burst', 2, 2, 36, 36, { stroke: 0.7 }),
		one('KORTING', 9, 11.2, 22, 4.2, { font: ARB, size: 3, letterSpacing: 0.2 }),
		one('-25%', 8, 15.2, 24, 12, { font: 'Anton', size: 10.5 }),
		one('op alles', 10, 27, 20, 3.6, { size: 2.8, ...B }),
	]),
	T('productlabel-ean', 'Productlabel met EAN', 'winkel', [50, 30], [
		txt('Huisgemaakte granola', 3, 2.6, 44, 4.6, { font: MONT, size: 3.8, ...B, wrap: false, fit: 'shrink' }),
		txt('Noten & honing · 500 g', 3, 7.2, 44, 3.2, { size: 2.4, wrap: false, fit: 'shrink' }),
		rule(3, 11, 44),
		code('8712345678906', 'ean13', 3, 12.6, 28, 15),
		one('€ 6,95', 32, 14.5, 15, 10, { font: OSW, size: 6.5, ...B, align: 'right' }),
	]),
	T('te-koop', 'Te koop', 'winkel', [50, 30], [
		brd('double', 50, 30, 0.5),
		one('TE KOOP', 4, 3.4, 42, 12, { font: 'Anton', size: 10, letterSpacing: 0.5 }),
		one('Vraagprijs', 4, 15.6, 42, 3.4, { size: 2.6 }),
		one('€ 25,-', 4, 18.8, 42, 8.8, { font: OSW, size: 7.5, ...B }),
	]),
	T('handgemaakt', 'Handgemaakt met liefde', 'winkel', [40, 40, 'round'], [
		shp('ellipse', 2, 2, 36, 36, { stroke: 0.6 }),
		shp('ellipse', 3.6, 3.6, 32.8, 32.8, { stroke: 0.3, dash: 'dotted' }),
		one('Handgemaakt', 6, 10.5, 28, 7.5, { font: 'Pacifico', size: 4.2 }),
		ico('heart', 17, 18.6, 6, { set: 'filled' }),
		one('met liefde', 8, 25, 24, 5.6, { font: 'Dancing Script', size: 4.2, ...B }),
	]),

	// —— Keuken & voorraad
	T('voorraadpot', 'Voorraadpot', 'keuken', [40, 30], [
		brd('rounded-double', 40, 30, 0.4),
		one('VOORRAAD', 4, 4.2, 32, 3, { font: MONT, size: 2.2, ...B, letterSpacing: 0.6 }),
		one('Basmatirijst', 4, 7.6, 32, 7.6, { font: PLAY, size: 5.6, ...B }),
		rule(15, 16.1, 10),
		one('Gevuld op {datum}', 4, 18, 32, 3.4, { size: 2.6 }),
		one('Houdbaar tot {datum+180}', 4, 21.6, 32, 3.4, { size: 2.6, ...B }),
	]),
	T('ingevroren', 'Ingevroren op', 'keuken', [40, 30], [
		brd('line', 40, 30, 0.5),
		ico('snowflake', 1, 1, 8, { invert: true, stroke: 1.8 }),
		bar('INGEVROREN', 9, 1, 30, 8, { font: OSW, size: 4.4, ...B, letterSpacing: 0.4 }),
		txt('Kippensoep', 3, 10.6, 34, 6.4, { font: 'Patrick Hand', size: 5.2, wrap: false, fit: 'shrink', valign: 'middle' }),
		txt('op {datum}', 3, 17.4, 34, 4.2, { size: 3.4, ...B, wrap: false, fit: 'shrink' }),
		txt('Uiterlijk gebruiken: {datum+90}', 3, 22.4, 34, 3.2, { size: 2.4, wrap: false, fit: 'shrink' }),
	]),
	T('tht-3', 'THT over 3 dagen', 'keuken', [40, 20], [
		brd('line', 40, 20, 0.5),
		bar('THT', 1, 1, 12, 18, { font: 'Anton', size: 6 }),
		txt('Ten minste houdbaar tot', 15, 3.4, 22.5, 3.2, { size: 2.2, wrap: false, fit: 'shrink' }),
		txt('{datum+3}', 15, 7.2, 22.5, 5, { font: MONO, size: 3.6, ...B, wrap: false, fit: 'shrink' }),
		txt('Gekoeld bewaren', 15, 13.2, 22.5, 3, { size: 2, ...I, wrap: false, fit: 'shrink' }),
	]),
	T('geopend', 'Geopend op', 'keuken', [30, 15], [
		brd('line', 30, 15, 0.4),
		bar('OPEN', 1, 1, 10, 13, { font: ARB, size: 2.4 }),
		txt('Geopend', 12.5, 2.2, 16, 2.6, { size: 1.9, wrap: false, fit: 'shrink' }),
		txt('{datum}', 12.5, 4.9, 16, 3.6, { font: MONO, size: 2.6, ...B, wrap: false, fit: 'shrink' }),
		txt('op: {datum+3}', 12.5, 9.2, 16, 2.8, { size: 2, wrap: false, fit: 'shrink' }),
	]),
	T('meal-prep', 'Meal-prep', 'keuken', [50, 30], [
		brd('corners', 50, 30, 0.5),
		txt('MEAL PREP', 3.5, 3, 32, 6.8, { font: 'Bebas Neue', size: 5.8, letterSpacing: 0.4, valign: 'middle' }),
		ico('tools-kitchen-2', 39.5, 2.8, 7, { stroke: 1.8 }),
		rule(3.5, 10.4, 43, 0.35),
		txt('Pasta pesto met kip', 3.5, 11.8, 43, 4.4, { size: 3.2, ...B, wrap: false, fit: 'shrink' }),
		txt('Gemaakt {datum}', 3.5, 17, 19, 3.2, { size: 2.1, wrap: false, fit: 'shrink' }),
		txt('Eet voor {datum+4}', 27.5, 17, 19, 3.2, { size: 2.1, ...B, wrap: false, fit: 'shrink', align: 'right' }),
		txt('Porties', 3.5, 22.4, 11, 3.4, { size: 2.4, valign: 'middle' }),
		...[0, 1, 2, 3].map(i => shp('ellipse', 14.5 + i * 4.4, 22.5, 3.2, 3.2, { stroke: 0.35 })),
		txt('kcal ______', 33, 22.4, 13.5, 3.4, { size: 2.4, align: 'right', valign: 'middle', wrap: false, fit: 'shrink' }),
	]),
	T('kruidenpot', 'Kruidenpotje', 'keuken', [30, 30, 'round'], [
		shp('ellipse', 1.5, 1.5, 27, 27, { stroke: 0.5 }),
		ico('leaf', 12, 4.6, 6, { stroke: 1.6 }),
		one('Oregano', 4, 11.4, 22, 5.2, { font: 'Cinzel', size: 3.8, ...B }),
		rule(11, 17.3, 8),
		one('Gevuld {datum}', 6, 19, 18, 2.8, { size: 1.9 }),
	]),
	T('koffie', 'Koffiebonen', 'keuken', [40, 40], [
		brd('deco', 40, 40, 0.5),
		ico('coffee', 15, 5.2, 10, { stroke: 1.5 }),
		one('HUISBRANDING', 5, 16.1, 30, 3, { font: MONT, size: 2.2, ...B, letterSpacing: 0.5 }),
		one('Espresso', 5, 19.3, 30, 8, { font: PLAY, size: 6.4, ...B, ...I }),
		one('Gebrand op {datum}', 5, 28.1, 30, 3.2, { size: 2.4 }),
		one('250 g · bonen', 5, 31.5, 30, 3.2, { size: 2.4, ...B }),
	]),
	T('thee', 'Theeblik', 'keuken', [40, 30], [
		brd('scallop', 40, 30, 0.5),
		one('Earl Grey', 5, 4, 30, 8.6, { font: 'Great Vibes', size: 7 }),
		ico('teapot', 17.25, 12.8, 5.5, { stroke: 1.6 }),
		one('zwarte thee · bergamot', 5, 18.8, 30, 3.2, { font: 'Lato', size: 2.4 }),
		one('Gevuld {datum}', 5, 22.2, 30, 2.8, { font: 'Lato', size: 2, ...I }),
	]),

	// —— Verzending & post
	T('adreslabel', 'Adreslabel', 'verzending', [50, 30], [
		brd('line', 50, 30, 0.4),
		bar('AAN', 3, 2.6, 8.5, 3.8, { font: ARB, size: 2.2 }),
		txt('Fam. de Vries\nLindelaan 12\n1234 AB Utrecht', 3, 7.4, 44, 13, { size: 3.3, lineHeight: 1.2, fit: 'shrink', valign: 'middle' }),
		rule(3, 21.8, 44, 0.25),
		txt('Afzender: A. Jansen, Kerkstraat 1, 5678 CD Gouda', 3, 23.2, 44, 2.8, { size: 1.9, wrap: false, fit: 'shrink' }),
	]),
	T('afzender', 'Afzender', 'verzending', [40, 20], [
		brd('rounded', 40, 20, 0.4),
		ico('mail', 3.5, 6.5, 7, { stroke: 1.6 }),
		txt('AFZENDER', 12.5, 2.8, 25, 2.6, { size: 1.8, ...B, letterSpacing: 0.4 }),
		txt('A. Jansen\nKerkstraat 1\n5678 CD Gouda', 12.5, 5.6, 25, 10.2, { size: 2.8, fit: 'shrink' }),
	]),
	T('verzendlabel', 'Verzendlabel met barcode', 'verzending', [50, 80], [
		brd('line', 50, 80, 0.5),
		ico('package', 1, 1, 10, { invert: true, stroke: 1.6 }),
		bar('PAKKET', 11, 1, 38, 10, { font: 'Anton', size: 6.5, letterSpacing: 0.8 }),
		txt('AAN', 3, 12.8, 20, 3, { size: 2.2, ...B, letterSpacing: 0.4 }),
		txt('Fam. de Vries\nLindelaan 12\n1234 AB Utrecht\nNederland', 3, 15.8, 44, 17.2, { size: 3.5, ...B, lineHeight: 1.2, fit: 'shrink' }),
		rule(3, 34.4, 44, 0.35),
		txt('VAN', 3, 35.8, 20, 3, { size: 2.2, ...B, letterSpacing: 0.4 }),
		txt('A. Jansen, Kerkstraat 1\n5678 CD Gouda', 3, 38.8, 44, 6.4, { size: 2.6, fit: 'shrink' }),
		rule(3, 46.4, 44, 0.35),
		code('NL-PKT-{teller}', 'code128', 4, 48.4, 42, 17, { textSize: 2.6 }),
		txt('Gewicht: ____ kg', 3, 66.8, 22, 3.4, { size: 2.4, wrap: false, fit: 'shrink' }),
		txt('Pakket {teller} van __', 25, 66.8, 22, 3.4, { size: 2.4, align: 'right', wrap: false, fit: 'shrink' }),
		ico('arrow-big-up-lines', 3, 71.6, 5.5, { stroke: 1.6 }),
		ico('umbrella', 9.8, 71.6, 5.5, { stroke: 1.6 }),
		ico('glass', 16.6, 71.6, 5.5, { stroke: 1.6 }),
		txt('Voorzichtig behandelen', 23.5, 72.2, 23.5, 4.2, { size: 2.1, ...B, valign: 'middle', wrap: false, fit: 'shrink' }),
	]),
	T('retourlabel', 'Retourlabel', 'verzending', [50, 30], [
		brd('line', 50, 30, 0.5),
		shp('rect', 1, 1, 11, 28, { stroke: 0, fill: 'black' }),
		ico('arrow-back-up', 2, 10.5, 9, { invert: true, stroke: 2.2 }),
		txt('RETOUR', 14.5, 2.8, 32.5, 6.6, { font: 'Anton', size: 5.6, letterSpacing: 0.6, valign: 'middle' }),
		txt('A. Jansen · Kerkstraat 1\n5678 CD Gouda', 14.5, 9.6, 32.5, 6, { size: 2.3, fit: 'shrink' }),
		code('RET{teller}', 'code128', 14.5, 16.4, 32.5, 11, { textSize: 2 }),
	]),

	// —— Kantoor & archief
	T('ordner-rug', 'Ordnerrug', 'kantoor', [40, 80], [
		brd('line', 40, 80, 0.5),
		bar('2026', 1, 1, 38, 13, { font: 'Anton', size: 9, letterSpacing: 1 }),
		one('Facturen', 3, 17, 34, 7, { font: MONT, size: 5.4, ...B }),
		rule(13, 25, 14, 0.4),
		one('januari – juni', 3, 27, 34, 4, { size: 3.2 }),
		ico('folder', 13, 39, 14, { stroke: 1.4 }),
		one('Kast 2 · plank 3', 3, 59, 34, 3.6, { size: 2.8 }),
		shp('ellipse', 14, 67.5, 12, 7, { stroke: 0.4, dash: 'dashed' }),
	]),
	T('archiefdoos', 'Archiefdoos', 'kantoor', [50, 50], [
		brd('thick-thin', 50, 50, 0.5),
		one('ARCHIEF', 5, 4.6, 40, 4.2, { font: ARB, size: 3, letterSpacing: 0.8 }),
		mid('Belasting & bank', 5, 9.4, 40, 12, { font: MONT, size: 4.8, ...B, fit: 'shrink' }),
		rule(18, 22.6, 14, 0.4),
		txt('Periode\nDoos nr.\nBewaren tot', 5.5, 25, 18, 13.2, { size: 2.6, lineHeight: 1.6 }),
		txt('2020 – 2025\n{teller}\n31-12-2032', 22, 25, 22.5, 13.2, { size: 2.6, ...B, lineHeight: 1.6, align: 'right' }),
		ico('archive', 21.5, 39.4, 7, { stroke: 1.6 }),
	]),
	T('inventaris', 'Inventaris met teller', 'kantoor', [50, 25], [
		brd('line', 50, 25, 0.4),
		// 18 mm rond hetzelfde midden: op 40x30 aangepast 4 dots/module, >= 4 modules wit tot de rand (gemeten 8; 50x25: 4,2)
		qr('INV-{teller}', 3.5, 3.5, 18),
		txt('INVENTARIS', 25, 3, 22, 3, { size: 2.2, ...B, letterSpacing: 0.4 }),
		txt('Nr. {teller}', 25, 6.4, 22, 6.4, { font: MONO, size: 4.6, ...B, wrap: false, fit: 'shrink', valign: 'middle' }),
		rule(25, 13.6, 22),
		txt('Eigendom van\nDe Werkplaats', 25, 15, 22, 6.4, { size: 2.3, fit: 'shrink' }),
	]),
	T('bureaunaambord', 'Bureaunaambord', 'kantoor', [50, 25], [
		brd('double', 50, 25, 0.4),
		one('Sanne de Vries', 4, 4.6, 42, 7.4, { font: MONT, size: 5.2, ...B }),
		rule(19, 12.9, 12, 0.35),
		one('Projectmanager', 4, 14.6, 42, 4, { font: 'Lato', size: 3, ...I }),
	]),

	// —— Huis, tuin & tech
	T('kabellabel', 'Kabellabel', 'huis', [14, 40], [
		bar('TV', 1, 1.5, 12, 7, { font: 'Anton', size: 5 }),
		one('HDMI 1', 1, 9, 12, 3.4, { size: 2.4, ...B }),
		ico('plug', 4.5, 17.5, 5, { stroke: 1.8 }),
		bar('TV', 1, 27, 12, 7, { font: 'Anton', size: 5 }),
		one('HDMI 1', 1, 34.6, 12, 3.4, { size: 2.4, ...B }),
	]),
	T('wifi-qr', 'Wifi-QR', 'huis', [50, 30], [
		// 21,6 mm (op 40x30 17,8): bij elke netwerknaam/wachtwoord-lengte >= 4 modules wit tot icoon en tekst, ook op 50x30
		// (25 mm vulde bij een korte naam de box met 8 dots/module zonder wit)
		// geen wachtwoord = open netwerk: T:WPA met een leeg P: verbindt niet, dan de T:nopass-code op dezelfde plek
		qr('WIFI:T:WPA;S:{ssid|wifi};P:{wachtwoord|wifi};;', 2.5, 4.2, 21.6, { rules: [{ field: 'wachtwoord', equals: '', set: { hidden: true } }] }),
		qr('WIFI:T:nopass;S:{ssid|wifi};;', 2.5, 4.2, 21.6, { hidden: true, rules: [{ field: 'wachtwoord', equals: '', set: { hidden: false } }] }),
		ico('wifi', 30, 2.6, 6.4, { stroke: 2 }),
		txt('WIFI', 37.2, 2.8, 10.8, 6, { font: ARB, size: 3.6, valign: 'middle', wrap: false, fit: 'shrink' }),
		txt('Scan om te verbinden', 30, 9.6, 18, 2.6, { size: 1.9, ...I, wrap: false, fit: 'shrink' }),
		txt('NETWERK', 30, 13.4, 18, 2.4, { size: 1.7, ...B, letterSpacing: 0.3 }),
		txt('{ssid}', 30, 15.8, 18, 3.2, { size: 2.6, wrap: false, fit: 'shrink' }),
		txt('WACHTWOORD', 30, 19.8, 18, 2.4, { size: 1.7, ...B, letterSpacing: 0.3, rules: [{ field: 'wachtwoord', equals: '', set: { hidden: true } }] }),
		txt('{wachtwoord}', 30, 22.2, 18, 3.2, { font: MONO, size: 2.6, ...B, wrap: false, fit: 'shrink' }),
	], [{ key: 'ssid', label: 'Netwerk', type: 'text', value: 'Thuisnetwerk', placeholder: '' },
		{ key: 'wachtwoord', label: 'Wachtwoord', type: 'text', value: 'welkom123', placeholder: '' }]),
	T('plantlabel', 'Plantlabel', 'huis', [50, 25], [
		brd('rounded', 50, 25, 0.4),
		ico('plant', 3, 6, 12, { stroke: 1.5 }),
		txt('Tomaat', 16.5, 2.8, 30.5, 6.6, { font: 'Roboto Slab', size: 5.2, ...B, wrap: false, fit: 'shrink', valign: 'middle' }),
		txt('Solanum lycopersicum', 16.5, 9.2, 30.5, 3, { font: 'Lato', size: 2.3, ...I, wrap: false, fit: 'shrink' }),
		rule(16.5, 12.9, 30.5),
		txt('Gezaaid {datum}', 16.5, 14.2, 30.5, 3, { size: 2.2, wrap: false, fit: 'shrink' }),
		ico('sun', 16.5, 18, 4.4, { stroke: 1.8 }),
		txt('Volle zon', 21.4, 18.3, 10.6, 3.8, { size: 2, valign: 'middle', wrap: false, fit: 'shrink' }),
		ico('droplet', 32.4, 18, 4.4, { stroke: 1.8 }),
		txt('Veel water', 37, 18.3, 10.5, 3.8, { size: 2, valign: 'middle', wrap: false, fit: 'shrink' }),
	]),
	T('opbergbak', 'Opbergbak', 'huis', [50, 30], [
		brd('brackets', 50, 30, 0.6),
		ico('box', 4, 6.5, 17, { stroke: 1.5 }),
		txt('Kerstspullen', 23, 4.6, 24, 8, { font: OSW, size: 5, ...B, wrap: false, fit: 'shrink', valign: 'middle' }),
		txt('Zolder · plank 2', 23, 13, 24, 3.4, { size: 2.4, wrap: false, fit: 'shrink' }),
		bar('BAK {teller}', 23, 18.6, 14, 4.6, { size: 2.4, ...B }),
	]),

	// —— Namen & school
	T('naambadge', 'Hallo, ik ben', 'namen', [50, 30], [
		brd('line', 50, 30, 0.5),
		bar('HALLO', 1, 1, 48, 8.6, { font: 'Anton', size: 6.4, letterSpacing: 1, valign: 'bottom' }),
		bar('ik ben', 1, 9.6, 48, 4, { size: 2.6, ...B, valign: 'top' }),
		one('Sanne', 3, 14.8, 44, 11, { font: 'Permanent Marker', size: 7.5 }),
		rule(1, 26.6, 48, 2.4),
	]),
	T('schoolspullen', 'Schoolspullen', 'namen', [40, 20], [
		brd('rounded', 40, 20, 0.5),
		ico('backpack', 3, 4.5, 11, { stroke: 1.6 }),
		txt('Dit is van', 15.5, 3, 22, 3, { size: 2.2 }),
		txt('Daan', 15.5, 5.8, 22, 7.4, { font: 'Fredoka', size: 6, ...B, wrap: false, fit: 'shrink', valign: 'middle' }),
		txt('Groep 5', 15.5, 13.6, 22, 3, { size: 2.4 }),
	]),
	T('ex-libris', 'Dit boek is van', 'namen', [40, 40], [
		brd('ornate', 40, 40, 0.5),
		one('EX LIBRIS', 6, 4.6, 28, 4, { font: 'Cinzel', size: 3, ...B, letterSpacing: 0.6 }),
		ico('books', 15, 9.4, 10, { stroke: 1.5 }),
		one('Dit boek is van', 5, 20.4, 30, 3.6, { font: PLAY, size: 2.6, ...I }),
		one('Emma Jansen', 5, 24.2, 30, 7.6, { font: 'Great Vibes', size: 6 }),
		one('Graag teruggeven', 6, 32.2, 28, 3, { size: 2.1, ...I }),
	]),

	// —— Feest & cadeau
	T('cadeau', 'Cadeau voor/van', 'feest', [40, 30], [
		brd('tag', 40, 30, 0.5),
		ico('gift', 8, 3.8, 7, { stroke: 1.6 }),
		txt('Cadeautje!', 16.5, 3.8, 19.5, 7, { font: 'Pacifico', size: 3.2, wrap: false, fit: 'shrink', valign: 'middle' }),
		txt('VOOR', 10, 13.4, 6.4, 3, { size: 2, ...B, letterSpacing: 0.15, wrap: false, fit: 'shrink' }),
		txt('Lisa', 16.5, 11.6, 19.5, 6, { font: 'Dancing Script', size: 4.6, ...B, wrap: false, fit: 'shrink', valign: 'bottom' }),
		rule(16.5, 17.8, 19.5, 0.25),
		txt('VAN', 10, 21, 6.4, 3, { size: 2, ...B, letterSpacing: 0.15, wrap: false, fit: 'shrink' }),
		txt('Tom', 16.5, 19.2, 19.5, 6, { font: 'Dancing Script', size: 4.6, ...B, wrap: false, fit: 'shrink', valign: 'bottom' }),
		rule(16.5, 25.4, 19.5, 0.25),
	]),
	T('verjaardag', 'Verjaardag', 'feest', [40, 40, 'round'], [
		shp('ellipse', 2, 2, 36, 36, { stroke: 0.6, dash: 'dotted' }),
		ico('cake', 15, 5.6, 10, { stroke: 1.5 }),
		one('Hoera!', 6, 16.2, 28, 7.6, { font: 'Bangers', size: 6.4, letterSpacing: 0.3 }),
		one('8 jaar', 9, 23.6, 22, 6, { font: 'Fredoka', size: 4.8, ...B }),
		one('{datum}', 11, 29.8, 18, 2.8, { size: 2 }),
	]),
	T('bedankje', 'Bruiloft-bedankje', 'feest', [40, 40, 'round'], [
		shp('ellipse', 2, 2, 36, 36, { stroke: 0.4 }),
		shp('ellipse', 3.4, 3.4, 33.2, 33.2, { stroke: 0.25 }),
		ico('hearts', 16, 6.8, 8, { stroke: 1.5 }),
		one('Bedankt', 5, 15, 30, 9, { font: 'Great Vibes', size: 7.4 }),
		one('Lotte & Daan', 7, 24.4, 26, 3.8, { font: 'Cinzel', size: 2.8, ...B }),
		one('12 · 06 · 2026', 10, 28.4, 20, 3, { font: 'Cinzel', size: 2.2 }),
	]),
	T('tafelkaart', 'Tafelkaart (naam uit lijst)', 'feest', [50, 30], [
		brd('deco', 50, 30, 0.5),
		one('{naam}', 5, 6.6, 40, 10, { font: 'Dancing Script', size: 7, ...B }),
		rule(17, 17.6, 16),
		one('Welkom op ons feest', 5, 19.4, 40, 3.6, { font: 'Cinzel', size: 2.6 }),
	], [{ key: 'naam', label: 'Naam', type: 'text', value: 'Sanne', placeholder: 'of kolom naam uit een lijst' }]),
	T('ticket', 'Evenement-ticket', 'feest', [50, 30], [
		brd('ticket', 50, 30, 0.5),
		txt('ZOMERFEEST', 4, 3.6, 30.5, 7.6, { font: 'Bebas Neue', size: 6.4, letterSpacing: 0.3, wrap: false, fit: 'shrink', valign: 'middle' }),
		txt('Za 21 juni 2026 · 20:00', 7.5, 11.4, 27.5, 3.2, { size: 2.4, ...B, wrap: false, fit: 'shrink' }),
		txt('Het Dorpshuis, Utrecht', 7.5, 14.6, 27.5, 3, { size: 2.2, wrap: false, fit: 'shrink' }),
		bar('ENTREE · 1 PERSOON', 4, 20.4, 24, 4.2, { size: 1.9, ...B, letterSpacing: 0.15 }),
		shp('rect', 35.8, 3, 0.3, 24, { stroke: 0, fill: 'gray' }),
		one('NR.', 36.7, 3.6, 8.6, 2.6, { size: 1.8, ...B }),
		one('{teller}', 36.7, 6.4, 8.6, 4.6, { font: MONO, size: 3.6, ...B }),
		// >= 4 modules wit tot de ticketrand, op 50x30 én aangepast op 40x30 (gemeten 5)
		qr('TICKET-{teller}', 37.54, 19.2, 7),
	]),

	// —— Waarschuwing
	T('breekbaar', 'Breekbaar', 'waarschuwing', [50, 30], [
		brd('thick', 50, 30, 1),
		ico('glass', 3.5, 6.5, 17, { stroke: 1.7 }),
		txt('BREEKBAAR', 22, 6.4, 25, 7.6, { font: 'Anton', size: 4.6, letterSpacing: 0.2, wrap: false, fit: 'shrink', valign: 'middle' }),
		txt('Voorzichtig\nbehandelen', 22, 15, 25, 7, { size: 2.8, lineHeight: 1.2 }),
	]),
	T('niet-aanraken', 'Niet aanraken', 'waarschuwing', [40, 30], [
		brd('double', 40, 30, 0.5),
		ico('hand-stop', 14, 3.6, 12, { stroke: 1.6 }),
		one('NIET AANRAKEN', 3.5, 16.4, 33, 4.6, { font: ARB, size: 3.2 }),
		one('Graag van afblijven', 3.5, 21.6, 33, 3.4, { size: 2.4, ...I }),
	]),
	T('waarschuwing', 'Waarschuwing', 'waarschuwing', [50, 30], [
		brd('line', 50, 30, 0.6),
		bar('WAARSCHUWING', 1, 1, 48, 8, { font: OSW, size: 4.6, ...B, letterSpacing: 0.8 }),
		ico('alert-triangle', 3.5, 11, 15.5, { set: 'filled' }),
		mid('Hete inhoud.\nVoorzichtig openen.', 21, 11, 26, 15.5, { size: 3, ...B, align: 'left', lineHeight: 1.2, fit: 'shrink' }),
	]),

	// —— Stickers & fun
	T('tekstballon', 'Tekstballon', 'stickers', [40, 30], [
		shp('speech', 2, 2, 36, 25, { stroke: 0.8 }),
		one('Wauw!', 6, 4.6, 28, 9, { font: 'Bangers', size: 7.4, letterSpacing: 0.4 }),
		one('zo trots op je', 7, 13.8, 26, 3.6, { font: 'Patrick Hand', size: 3 }),
		ico('sparkles', 31, 22, 7, { stroke: 1.6 }),
	]),
	T('beloning', 'Beloningssticker', 'stickers', [30, 30, 'round'], [
		shp('ellipse', 1.5, 1.5, 27, 27, { stroke: 0.6 }),
		ico('star', 9, 3.8, 12, { set: 'filled' }),
		one('SUPER!', 5, 16, 20, 5.8, { font: 'Bangers', size: 4.6, letterSpacing: 0.3 }),
		one('goed gedaan', 7, 21.6, 16, 3.2, { font: 'Patrick Hand', size: 2.6 }),
	]),
];
