// Feest, stickers, namen, veiligheid en evenementen: allemaal exact 40 x 30 mm rechthoekig (de rol van de speler).
// Plain data voor presets.js (geen imports); ontbrekende element-velden vult doc.normalizeTemplateDoc met de defaults.
// Inhoud blijft binnen 1,5 mm van de labelrand; randen liggen op die marge zodat ook de lijn zelf niet wegvalt.
const LABEL = { w: 40, h: 30, shape: 'rect' };

// ---- bouwstenen
const t = (text, x, y, w, h, o = {}) => ({ type: 'text', text, x, y, w, h, align: 'center', valign: 'middle', wrap: false, fit: 'shrink', ...o });
const bar = (text, x, y, w, h, o = {}) => t(text, x, y, w, h, { invert: true, ...o });   // witte tekst op zwarte balk
const brd = (style, stroke = 0.5) => ({ type: 'border', style, stroke, x: 1.5, y: 1.5, w: 37, h: 27 });
const shp = (shape, x, y, w, h, o = {}) => ({ type: 'shape', shape, stroke: 0.4, fill: 'none', x, y, w, h, ...o });
const blk = (x, y, w, h, o = {}) => shp('rect', x, y, w, h, { stroke: 0, fill: 'black', ...o });   // lijn of vlak
// Balk met variabele tekst: zwart vlak + ingesprongen witte tekst, anders krimpt een lange invulling tot tegen de rand.
const band = (text, x, y, w, h, o = {}, pad = 1.2) => [blk(x, y, w, h), bar(text, x + pad, y, w - 2 * pad, h, o)];
const ico = (icon, x, y, s, o = {}) => ({ type: 'icon', source: 'tabler', icon, set: 'outline', nodes: [], stroke: 1.8, x, y, w: s, h: s, ...o });
const emo = (char, x, y, s, o = {}) => ({ type: 'emoji', char, style: 'mono', weight: 600, x, y, w: s, h: s, ...o });
const qr = (data, x, y, s, o = {}) => ({ type: 'qr', data, symbology: 'qrcode', ecc: 'M', x, y, w: s, h: s, ...o });
const B = { bold: true }, I = { italic: true }, L = { align: 'left' };

// ---- invulvelden
const fText = (key, label, value, placeholder = '') => ({ key, label, type: 'text', value, placeholder });
const fNum = (key, label, value, suffix = '') => ({ key, label, type: 'number', value, suffix });
const fChoice = (key, label, options, value = options[0]) => ({ key, label, type: 'choice', options, value });
const fDate = (key, label, value = '', offset = 0) => ({ key, label, type: 'date', value, offset });

// ---- regels. Elke optie krijgt een eigen regel. Een onbekende of lege keuze (CSV) raakt geen regel: dan licht niets op en
// toont only niets, anders print een typfout het icoon of de tekst van een andere optie als gekozen.
const lit = (f, me) => ({ rules: f.options.map(o => ({ field: f.key, equals: o, set: { invert: o === me } })) });
const only = (f, me) => ({ hidden: true, rules: f.options.map(o => ({ field: f.key, equals: o, set: { hidden: o !== me } })) });
// Zichtbaar zolang de gekozen optie (een getal) minstens n is: sterren, levens.
const atLeast = (f, n) => ({ hidden: true, rules: f.options.map(o => ({ field: f.key, equals: o, set: { hidden: !(+o >= n) } })) });
const below = (f, n) => ({ hidden: true, rules: f.options.map(o => ({ field: f.key, equals: o, set: { hidden: +o >= n } })) });

const T = (id, name, category, tags, fields, elements) => ({ id: 'fun-' + id, name, category, tags, doc: { label: { ...LABEL }, fields, elements } });

// Keuzevelden die door meerdere elementen gedeeld worden, apart zodat lit/only dezelfde opties zien.
const NIVEAU = fChoice('niveau', 'Niveau', ['Let op', 'Gevaar', 'Verboden']);
const STEMMING = fChoice('stemming', 'Smiley', ['Blij', 'Cool', 'Verliefd', 'Lachen', 'Boos']);
const STERREN = fChoice('sterren', 'Sterren', ['1', '2', '3', '4', '5'], '5');
const HUMEUR = fChoice('humeur', 'Humeur', ['Top', 'Oké', 'Moe', 'Boos'], 'Top');
const PLAATS = fChoice('plaats', 'Plaats', ['Goud', 'Zilver', 'Brons']);
const LEVENS = fChoice('levens', 'Levens', ['0', '1', '2', '3'], '3');
const STATUS = fChoice('status', 'Status', ['Kom binnen', 'Niet storen', 'Ik slaap']);
const VERBOD = fChoice('verbod', 'Verboden', ['Roken', 'Bellen', 'Honden', "Foto's"]);
const NOOD = fChoice('wat', 'Wat', ['EHBO', 'Brandblusser', 'Nooduitgang']);
const RICHTING = fChoice('richting', 'Richting', ['Links', 'Hier', 'Rechts'], 'Rechts');
const MENU = fChoice('menu', 'Menu', ['Vlees', 'Vis', 'Vega']);

const TEMPLATES = [
	// ———— Feest & cadeau
	T('verjaardag', 'Verjaardag', 'party', ['verjaardag', 'jarig', 'feest', 'leeftijd', 'birthday', 'party', 'age'], [
		fText('naam', 'Naam', 'Noor', 'Wie is er jarig?'), fNum('leeftijd', 'Leeftijd', '8', 'jaar'), fDate('datum', 'Datum'),
	], [
		blk(2.5, 2.5, 14, 25, { radius: 2.4 }),
		t('{leeftijd}', 3.6, 4.4, 11.8, 13.6, { font: 'Bebas Neue', size: 11.8, invert: true }),
		bar('JAAR', 3.6, 18.4, 11.8, 3.6, { font: 'Montserrat', size: 2.4, ...B, letterSpacing: 0.6 }),
		emo('🎈', 7.5, 22.6, 4, { invert: true }),
		t('Hoera!', 18.8, 2.8, 18.4, 8.4, { font: 'Bangers', size: 6.9, letterSpacing: 0.3 }),
		t('{naam}', 18.5, 11.2, 19.5, 7.2, { font: 'Fredoka', size: 5.4, ...B, wrap: true, lineHeight: 1 }),
		emo('🎉', 21.6, 18.8, 4), emo('🎂', 26.25, 18.8, 4), emo('🎁', 30.9, 18.8, 4),
		t('{datum}', 18.5, 23.8, 19.5, 3.4, { font: 'Roboto Mono', size: 2.4 }),
	]),
	T('cadeau', 'Cadeau voor & van', 'party', ['cadeau', 'kado', 'voor', 'van', 'gift', 'present', 'tag'], [
		fText('voor', 'Voor', 'Lisa'), fText('van', 'Van', 'Tom'), fText('wens', 'Wens', 'Veel plezier!'),
	], [
		brd('rounded-double', 0.4),
		ico('gift', 4.2, 4.4, 8.4, { stroke: 1.6 }),
		t('{wens}', 14, 4.2, 21.6, 8.8, { font: 'Pacifico', size: 3.4, wrap: true, lineHeight: 1.15 }),
		t('voor', 4.2, 14, 7, 3.6, { font: 'Playfair Display', size: 2.7, ...I, ...L }),
		t('{voor}', 11.4, 12.8, 24.2, 5.4, { font: 'Dancing Script', size: 4.6, ...B, ...L }),
		blk(11.4, 18.3, 24.2, 0.25),
		t('van', 4.2, 20.4, 7, 3.6, { font: 'Playfair Display', size: 2.7, ...I, ...L }),
		t('{van}', 11.4, 19.2, 24.2, 5.4, { font: 'Dancing Script', size: 4.6, ...B, ...L }),
		blk(11.4, 24.7, 24.2, 0.25),
	]),
	T('bedankt', 'Bedankje', 'party', ['bedankt', 'dankjewel', 'bedankje', 'thanks', 'thank you', 'favor'], [
		fText('titel', 'Titel', 'Bedankt!'), fText('tekst', 'Tekst', 'voor het mooie feest'), fText('van', 'Van', 'Sanne & Mark'),
	], [
		brd('deco', 0.4),
		ico('heart', 17.3, 4, 5.4, { set: 'filled' }),
		t('{titel}', 5, 9.4, 30, 9, { font: 'Great Vibes', size: 7.6 }),
		t('{tekst}', 5, 18.6, 30, 3.6, { font: 'Playfair Display', size: 2.6, ...I }),
		t('{van}', 6, 22.4, 28, 3.4, { font: 'Cinzel', size: 2.3, ...B, letterSpacing: 0.2 }),
	]),
	T('bruiloft', 'Bruiloft', 'party', ['bruiloft', 'trouwen', 'huwelijk', 'namen', 'wedding', 'marriage', 'names'], [
		fText('naam1', 'Naam 1', 'Lotte'), fText('naam2', 'Naam 2', 'Daan'), fDate('datum', 'Trouwdag', '2026-06-12'),
	], [
		brd('double', 0.35),
		t('{naam1}', 4, 3.6, 32, 7.4, { font: 'Great Vibes', size: 6.4 }),
		blk(8, 12.6, 9, 0.2), t('&', 17.5, 10.7, 5, 4, { font: 'Playfair Display', size: 3.4, ...I }), blk(23, 12.6, 9, 0.2),
		t('{naam2}', 4, 14.4, 32, 7.4, { font: 'Great Vibes', size: 6.4 }),
		t('{datum}', 7, 22.6, 26, 3.4, { font: 'Cinzel', size: 2.5, ...B, letterSpacing: 0.4 }),
	]),
	T('geboorte', 'Geboorte', 'party', ['geboorte', 'baby', 'kraam', 'welkom', 'birth', 'newborn', 'baby shower'], [
		fChoice('soort', 'Het is een', ['meisje', 'jongen', 'tweeling']), fText('naam', 'Naam', 'Mila'), fDate('datum', 'Geboren'),
		fNum('gewicht', 'Gewicht', '3250', 'g'), fNum('lengte', 'Lengte', '50', 'cm'),
	], [
		...band('Het is een {soort}!', 1.5, 1.5, 37, 6.2, { font: 'Fredoka', size: 3.6, ...B }),
		ico('baby-carriage', 2.6, 9.6, 10.8, { stroke: 1.6 }),
		t('{naam}', 14.6, 8.6, 23.4, 8.6, { font: 'Pacifico', size: 5.6 }),
		t('{datum}', 14.6, 17.6, 23.4, 3.4, { font: 'Montserrat', size: 2.4, ...B }),
		blk(2.6, 22.2, 34.8, 0.25),
		t('{gewicht} g', 2.6, 23.2, 16.2, 4.6, { font: 'Oswald', size: 3.4, ...B }),
		blk(19.85, 23.6, 0.3, 3.8),
		t('{lengte} cm', 21.2, 23.2, 16.2, 4.6, { font: 'Oswald', size: 3.4, ...B }),
	]),
	T('kerst', 'Kerstcadeau', 'party', ['kerst', 'cadeau', 'feestdagen', 'nieuwjaar', 'christmas', 'xmas', 'gift'], [
		fChoice('groet', 'Groet', ['Vrolijk kerstfeest', 'Fijne feestdagen', 'Gelukkig nieuwjaar']), fText('voor', 'Voor', 'Oma'), fText('van', 'Van', 'Daan'),
	], [
		brd('stars', 0.5),
		ico('christmas-tree', 4.4, 5.4, 12.6, { stroke: 1.5 }),
		t('{groet}', 17.8, 4.6, 16.8, 13.2, { font: 'Lobster', size: 4.6, wrap: true, lineHeight: 1.05 }),
		blk(6, 19.8, 28, 0.25),
		t('voor {voor} · van {van}', 5.4, 20.8, 29.2, 4.4, { font: 'Patrick Hand', size: 3.2 }),
	]),
	T('proost', 'Proost (fles)', 'party', ['proost', 'fles', 'wijn', 'jubileum', 'cheers', 'bottle', 'wine', 'anniversary'], [
		fText('naam', 'Naam', 'Ruud'), fText('reden', 'Reden', 'OP 50 JAAR'),
	], [
		ico('glass-champagne', 2.6, 2.8, 7.6, { stroke: 1.6 }),
		t('PROOST', 10.6, 2.6, 18.8, 8, { font: 'Abril Fatface', size: 4.2, letterSpacing: 0.4 }),
		ico('glass-champagne', 29.8, 2.8, 7.6, { stroke: 1.6 }),
		t('{naam}', 2.6, 11.2, 34.8, 10, { font: 'Dancing Script', size: 7.6, ...B }),
		...band('{reden}', 1.5, 22.4, 37, 6.1, { font: 'Montserrat', size: 3, ...B, letterSpacing: 0.5 }),
	]),

	// ———— Stickers & fun
	T('quote', 'Quote-sticker', 'fun', ['quote', 'citaat', 'spreuk', 'tekst', 'saying', 'motivation', 'sticker'], [
		fText('quote', 'Quote', 'Doe vandaag iets waar je morgen blij om bent.'), fText('auteur', 'Wie', 'Onbekend'),
	], [
		brd('brackets', 0.5),
		t('“', 3.4, 3.2, 7, 8, { font: 'Playfair Display', size: 10, ...B, lineHeight: 0.8, valign: 'top' }),
		t('{quote}', 10.8, 3.4, 25.8, 18.8, { font: 'Playfair Display', size: 3.8, ...I, ...L, wrap: true, lineHeight: 1.18 }),
		blk(10.8, 23.3, 5, 0.35),
		t('{auteur}', 16.6, 22.2, 20, 3.4, { font: 'Montserrat', size: 2.3, ...B, letterSpacing: 0.4, ...L }),
	]),
	T('smiley', 'Smiley-sticker', 'fun', ['smiley', 'emoji', 'sterren', 'beoordeling', 'sticker', 'rating', 'stars', 'reward'], [
		STEMMING, fText('tekst', 'Tekst', 'Goed gedaan!'), STERREN,
	], [
		...[['Blij', '😀'], ['Cool', '😎'], ['Verliefd', '😍'], ['Lachen', '😂'], ['Boos', '😡']].map(([o, ch]) => emo(ch, 2.5, 2.4, 17.4, only(STEMMING, o))),
		t('{tekst}', 21.6, 2.5, 16, 17.6, { font: 'Bangers', size: 5.4, wrap: true, lineHeight: 1, letterSpacing: 0.2 }),
		// minimaal 1 ster: de eerste is altijd gevuld en heeft geen lege variant
		ico('star', 2.5, 22.4, 5, { set: 'filled' }),
		...[1, 2, 3, 4].flatMap(i => [
			ico('star', 2.5 + i * 7.5, 22.4, 5, { set: 'filled', ...atLeast(STERREN, i + 1) }),
			ico('star', 2.5 + i * 7.5, 22.4, 5, { stroke: 1.6, ...below(STERREN, i + 1) }),
		]),
	]),
	T('humeur', 'Humeur-meter', 'fun', ['humeur', 'stemming', 'gevoel', 'smiley', 'mood', 'feelings', 'planner'], [
		fText('vraag', 'Vraag', 'Zo voel ik me vandaag'), HUMEUR, fDate('datum', 'Datum'),
	], [
		t('{vraag}', 2, 2.4, 36, 5, { font: 'Fredoka', size: 3.8, ...B }),
		...[['Top', '😄'], ['Oké', '🙂'], ['Moe', '😴'], ['Boos', '😠']].flatMap(([o, ch], i) => {
			const x = 2 + i * 9.33;
			return [
				shp('rect', x, 8.4, 8, 8, { stroke: 0.35, radius: 1.2 }),
				shp('rect', x, 8.4, 8, 8, { stroke: 0, fill: 'black', radius: 1.2, ...only(HUMEUR, o) }),
				emo(ch, x + 1.2, 9.6, 5.6, lit(HUMEUR, o)),
				t(o.toUpperCase(), x - 0.5, 17, 9, 2.8, { font: 'Montserrat', size: 1.9, ...B, letterSpacing: 0.2 }),
			];
		}),
		blk(2, 21.6, 36, 0.25),
		t('{datum}', 2, 22.6, 36, 4.4, { font: 'Patrick Hand', size: 3.4 }),
	]),
	T('knal', 'Comic-knal', 'fun', ['comic', 'knal', 'wauw', 'sticker', 'pop art', 'bang', 'wow'], [
		fText('tekst', 'Tekst', 'BAM!'), fText('sub', 'Onderschrift', 'zo goed!'),
	], [
		shp('burst', 2, 1.6, 36, 26.8, { stroke: 0.6 }),
		t('{tekst}', 9.6, 7.4, 20.8, 10.4, { font: 'Bangers', size: 8.4, letterSpacing: 0.4, wrap: true, lineHeight: 0.95 }),
		t('{sub}', 12, 17.8, 16, 3.6, { font: 'Patrick Hand', size: 3 }),
	]),
	T('prijs', 'Prijs & medaille', 'fun', ['prijs', 'winnaar', 'beker', 'medaille', 'goud', 'award', 'winner', 'trophy'], [
		fText('wat', 'Wedstrijd', 'Pubquiz 2026'), fText('wie', 'Winnaar', 'Team Oranje'), PLAATS,
	], [
		brd('thick-thin', 0.5),
		ico('trophy', 4, 4, 11.4, { stroke: 1.6 }),
		t('{wat}', 16.8, 4, 19.4, 3.6, { font: 'Montserrat', size: 2.4, ...B, letterSpacing: 0.3, ...L }),
		t('{wie}', 16.8, 8, 19.4, 9.4, { font: 'Righteous', size: 4.6, ...L, wrap: true, lineHeight: 1 }),
		shp('rect', 4, 19.6, 32, 5, { stroke: 0.35 }),
		...['Goud', 'Zilver', 'Brons'].map((o, i) => t(o.toUpperCase(), 4 + i * 10.667, 19.6, 10.667, 5, { font: 'Oswald', size: 2.6, ...B, letterSpacing: 0.2, ...lit(PLAATS, o) })),
	]),
	T('ikhou', 'Ik hou van...', 'fun', ['ik hou van', 'hart', 'liefde', 'stad', 'sticker', 'i love', 'heart'], [
		fText('wat', 'Van wat?', 'AMSTERDAM'),
	], [
		t('IK', 3, 2.4, 17, 13.2, { font: 'Archivo Black', size: 10.4, align: 'right' }),
		ico('heart', 21.4, 3, 12.2, { set: 'filled' }),
		t('{wat}', 2, 16.4, 36, 10.4, { font: 'Archivo Black', size: 5, fit: 'fill' }),
		blk(2, 27.4, 36, 0.5),
	]),
	T('retro', 'Retro game-sticker', 'fun', ['retro', 'game', 'pixel', 'level up', 'arcade', 'gamer', 'score'], [
		fChoice('kop', 'Kop', ['LEVEL UP!', 'GAME OVER', 'HIGH SCORE', 'PLAYER 1']), fText('naam', 'Speler', 'DAAN'), fNum('score', 'Score', '99999'), LEVENS,
	], [
		brd('dots', 0.5),
		t('{kop}', 4, 4, 32, 6, { font: 'Press Start 2P', size: 3.4 }),
		ico('device-gamepad', 4, 11.4, 9.2, { stroke: 1.6 }),
		t('{naam}', 14.8, 11, 21.2, 5, { font: 'VT323', size: 5, ...L }),
		t('SCORE {score}', 14.8, 16, 21.2, 4.4, { font: 'VT323', size: 4.2, ...L }),
		...[0, 1, 2].flatMap(i => [
			ico('heart', 4 + i * 5.2, 21.8, 4.4, { set: 'filled', ...atLeast(LEVENS, i + 1) }),
			ico('heart', 4 + i * 5.2, 21.8, 4.4, { stroke: 1.6, ...below(LEVENS, i + 1) }),
		]),
		t('PRESS START', 20, 21.8, 16, 4.4, { font: 'VT323', size: 3.6, align: 'right' }),
	]),

	// ———— Naam & school
	T('hallo', 'Hallo, ik ben', 'name', ['naambadge', 'hallo', 'naam', 'sticker', 'hello my name is', 'name tag', 'badge'], [
		fText('naam', 'Naam', 'Sanne'), fText('rol', 'Onderschrift', 'GAST'),
	], [
		bar('HALLO', 1.5, 1.5, 37, 6.8, { font: 'Anton', size: 5.2, letterSpacing: 1.2 }),
		bar('ik ben', 1.5, 8.3, 37, 3.2, { font: 'Montserrat', size: 2.3, ...B }),
		t('{naam}', 3, 12.4, 34, 10.4, { font: 'Permanent Marker', size: 7.6, wrap: true, lineHeight: 1 }),
		...band('{rol}', 1.5, 23.8, 37, 4.7, { font: 'Montserrat', size: 2.6, ...B, letterSpacing: 0.5 }),
	]),
	T('badge', 'Naambadge (werk & congres)', 'name', ['naambadge', 'congres', 'werk', 'bedrijf', 'qr', 'name badge', 'conference', 'work'], [
		fText('naam', 'Naam', 'Eva de Vries'), fText('functie', 'Functie', 'Projectleider'), fText('bedrijf', 'Bedrijf', 'STUDIO NOORD'),
		fText('email', 'E-mail', 'eva@studionoord.nl'),
	], [
		...band('{bedrijf}', 1.5, 1.5, 37, 5.4, { font: 'Montserrat', size: 2.8, ...B, letterSpacing: 0.8 }),
		t('{naam}', 2.6, 8.4, 22.6, 11, { font: 'Poppins', size: 4.8, ...B, ...L, wrap: true, lineHeight: 1.05 }),
		t('{functie}', 2.6, 20, 22.6, 3.6, { font: 'Poppins', size: 2.5, ...L }),
		blk(2.6, 25, 6, 0.7),
		// 10 mm = 2 dots/module bij elke versie; leeg e-mailveld = geen nep-QR
		qr('mailto:{email}', 27.1, 8.6, 10, { rules: [{ field: 'email', equals: '', set: { hidden: true } }] }),
		t('scan mij', 26.2, 20.2, 11.8, 2.8, { font: 'Montserrat', size: 1.9, ...B, rules: [{ field: 'email', equals: '', set: { hidden: true } }] }),
	]),
	T('schrift', 'Schoolspullen (schrift)', 'name', ['school', 'schrift', 'naam', 'vak', 'klas', 'notebook', 'school supplies'], [
		fText('vak', 'Vak', 'Rekenen'), fText('naam', 'Naam', 'Daan'), fText('klas', 'Klas', 'Groep 5'),
	], [
		brd('rounded', 0.4),
		blk(8.6, 2.2, 0.3, 25.6),
		ico('pencil', 3, 4, 4.4, { stroke: 1.8 }), ico('backpack', 3, 21.6, 4.4, { stroke: 1.8 }),
		t('{vak}', 10, 3.2, 26.4, 4.8, { font: 'Kalam', size: 3.4, ...B, ...L }),
		blk(9.6, 8.4, 27.2, 0.15),
		t('{naam}', 10, 9.4, 26.4, 9.2, { font: 'Kalam', size: 7, ...B, ...L }),
		blk(9.6, 18.8, 27.2, 0.15),
		t('{klas}', 10, 20.2, 26.4, 4.8, { font: 'Kalam', size: 3.4, ...L }),
		blk(9.6, 25.2, 27.2, 0.15),
	]),
	T('exlibris', 'Ex libris (boek)', 'name', ['ex libris', 'boek', 'van mij', 'bibliotheek', 'book', 'bookplate', 'library'], [
		fText('naam', 'Naam', 'Emma Jansen'),
	], [
		brd('ornate', 0.4),
		ico('book', 4.6, 7.6, 11, { stroke: 1.4 }),
		t('EX LIBRIS', 16.6, 4.6, 17, 3.8, { font: 'Cinzel', size: 2.6, ...B, letterSpacing: 0.5 }),
		t('{naam}', 16.6, 9.2, 18.4, 10.6, { font: 'Great Vibes', size: 5.6, wrap: true, lineHeight: 0.95 }),
		t('nr. {teller}', 16.6, 21, 18.4, 3.2, { font: 'Cinzel', size: 2.2 }),
	]),
	T('bagage', 'Kofferlabel', 'name', ['koffer', 'bagage', 'reizen', 'telefoon', 'luggage', 'travel', 'suitcase'], [
		fText('naam', 'Naam', 'J. de Boer'), fText('telefoon', 'Telefoon', '06 12345678'), fText('stad', 'Woonplaats', 'Utrecht'),
	], [
		brd('tag', 0.45),
		bar('BAGAGE', 13.2, 3.8, 22.8, 5, { font: 'Oswald', size: 3.4, ...B, letterSpacing: 1.2 }),
		t('{naam}', 13.2, 9.8, 22.8, 5.6, { font: 'Montserrat', size: 3.8, ...B, ...L }),
		ico('phone', 13.2, 16.2, 4, { stroke: 1.8 }), t('{telefoon}', 18, 16, 18, 4.4, { font: 'Roboto Mono', size: 2.8, ...L }),
		ico('map-pin', 13.2, 21.2, 4, { stroke: 1.8 }), t('{stad}', 18, 21, 18, 4.4, { font: 'Montserrat', size: 2.8, ...L }),
	]),
	T('deur', 'Deurbordje', 'name', ['deur', 'kamer', 'niet storen', 'slaapkamer', 'door sign', 'do not disturb', 'room'], [
		fText('naam', 'Naam', 'Noor'), STATUS,
	], [
		brd('rounded', 0.5),
		t('KAMER VAN', 3.5, 3.6, 33, 3.4, { font: 'Montserrat', size: 2.4, ...B, letterSpacing: 0.8 }),
		t('{naam}', 3.5, 7.2, 33, 9, { font: 'Fredoka', size: 6.6, ...B }),
		...[['Kom binnen', 'door'], ['Niet storen', 'hand-stop'], ['Ik slaap', 'moon']].map(([o, n]) => ico(n, 3.5, 18.4, 7, { invert: true, stroke: 1.8, ...only(STATUS, o) })),
		bar('{status}', 10.5, 18.4, 26, 7, { font: 'Fredoka', size: 3.8, ...B }),
	]),

	// ———— Waarschuwing & veiligheid
	T('waarschuwing', 'Waarschuwing (Let op/Gevaar/Verboden)', 'safety', ['waarschuwing', 'let op', 'gevaar', 'verboden', 'warning', 'danger', 'caution'], [
		NIVEAU, fText('tekst', 'Waarschuwing', 'HETE INHOUD'), fText('detail', 'Uitleg', 'Voorzichtig openen'),
	], [
		brd('thick', 0.45),
		shp('rect', 4, 4, 32, 4.8, { stroke: 0.35 }),
		...[['Let op', 4, 9.4], ['Gevaar', 13.4, 10.6], ['Verboden', 24, 12]].map(([o, x, w]) => t(o.toUpperCase(), x, 4, w, 4.8, { font: 'Oswald', size: 2.3, ...B, letterSpacing: 0.1, ...lit(NIVEAU, o) })),
		...[['Let op', 'alert-triangle'], ['Gevaar', 'skull'], ['Verboden', 'ban']].map(([o, n]) => ico(n, 4, 10.2, 11, { stroke: 1.8, ...only(NIVEAU, o) })),
		t('{tekst}', 16.4, 10.2, 19.6, 11, { font: 'Oswald', size: 4.8, ...B, ...L, wrap: true, lineHeight: 1.05 }),
		t('{detail}', 4, 22, 32, 4, { font: 'Montserrat', size: 2.6, ...I }),
	]),
	T('niet-aanraken', 'Niet aanraken', 'safety', ['niet aanraken', 'afblijven', 'nat', 'lijm', 'do not touch', 'hands off', 'wet paint'], [
		fText('titel', 'Titel', 'NIET AANRAKEN'), fText('reden', 'Reden', 'Lijm droogt nog'), fDate('klaar', 'Klaar op', '', 1),
	], [
		blk(1.5, 1.5, 14, 27),
		ico('hand-stop', 3.25, 9.5, 10.5, { invert: true, stroke: 1.7 }),
		t('{titel}', 17.2, 2.6, 21, 13.6, { font: 'Anton', size: 5.6, ...L, wrap: true, lineHeight: 1.02 }),
		blk(17.2, 17, 21, 0.3),
		t('{reden}', 17.2, 18, 21, 6, { font: 'Montserrat', size: 2.8, ...B, ...L, wrap: true, lineHeight: 1.1 }),
		t('tot {klaar}', 17.2, 24.6, 21, 3.4, { font: 'Roboto Mono', size: 2.3, ...L }),
	]),
	T('verbod', 'Verbodsbord', 'safety', ['verboden', 'niet roken', 'geen honden', 'bord', 'no smoking', 'prohibited', 'sign'], [
		VERBOD, fText('tekst', 'Onderschrift', 'Bedankt voor je begrip'),
	], [
		...[['Roken', 'smoking'], ['Bellen', 'device-mobile'], ['Honden', 'dog'], ["Foto's", 'camera']].map(([o, n]) => ico(n, 6.1, 6.1, 10.8, { stroke: 1.7, ...only(VERBOD, o) })),
		ico('ban', 2, 2, 19, { stroke: 2.3 }),
		...[['Roken', 'NIET\nROKEN'], ['Bellen', 'NIET\nBELLEN'], ['Honden', 'GEEN\nHONDEN'], ["Foto's", "GEEN\nFOTO'S"]].map(([o, s]) => t(s, 22.4, 2.4, 15.6, 18.2, { font: 'Anton', size: 5.4, lineHeight: 1.02, ...only(VERBOD, o) })),
		...band('{tekst}', 1.5, 22.6, 37, 5.9, { font: 'Montserrat', size: 2.6, ...B }),
	]),
	T('prive', 'Privé - geen toegang', 'safety', ['prive', 'geen toegang', 'verboden toegang', 'deur', 'private', 'no entry', 'staff only'], [
		fText('titel', 'Titel', 'PRIVÉ'), fText('tekst', 'Tekst', 'Geen toegang voor onbevoegden'),
	], [
		brd('double', 0.5),
		ico('lock', 4.4, 4.4, 10.2, { stroke: 1.8 }),
		t('{titel}', 15.6, 4, 20.4, 11, { font: 'Black Ops One', size: 6.2, wrap: true, lineHeight: 1 }),
		blk(4.4, 16.4, 31.2, 0.3),
		t('{tekst}', 4.4, 17.4, 31.2, 8, { font: 'Montserrat', size: 2.8, ...B, wrap: true, lineHeight: 1.15 }),
	]),
	T('nood', 'Hier is... (EHBO, blusser)', 'safety', ['ehbo', 'brandblusser', 'nooduitgang', 'pijl', 'first aid', 'fire extinguisher', 'exit'], [
		NOOD, fText('info', 'Info', 'In de kast bij de deur'), RICHTING, fText('afstand', 'Afstand', '5 meter'),
	], [
		shp('rect', 2, 2, 15.4, 15.4, { stroke: 0.6, radius: 2 }),
		...[['EHBO', 'first-aid-kit'], ['Brandblusser', 'fire-extinguisher'], ['Nooduitgang', 'door']].map(([o, n]) => ico(n, 4.2, 4.2, 11, { stroke: 1.7, ...only(NOOD, o) })),
		t('{wat}', 18.8, 2.2, 19.2, 7.6, { font: 'Oswald', size: 5.2, ...B, ...L }),
		t('{info}', 18.8, 10.2, 19.2, 7, { font: 'Montserrat', size: 2.5, ...L, wrap: true, lineHeight: 1.15 }),
		blk(2, 19.6, 36, 8),
		...[['Links', 'arrow-big-left'], ['Hier', 'arrow-big-down'], ['Rechts', 'arrow-big-right']].map(([o, n]) => ico(n, 3.4, 20.4, 6.4, { set: 'filled', invert: true, ...only(RICHTING, o) })),
		bar('{afstand}', 11, 20.4, 25.6, 6.4, { font: 'Oswald', size: 4.2, ...B, ...L }),
	]),

	// ———— Evenement
	T('toegang', 'Toegangskaart (pass)', 'event', ['toegang', 'pass', 'backstage', 'vip', 'crew', 'festival', 'access', 'lanyard'], [
		fChoice('rol', 'Toegang', ['VIP', 'CREW', 'ARTIEST', 'PERS']), fText('event', 'Evenement', 'Festival Zuid'), fText('naam', 'Naam', 'Sam Jansen'),
		fDate('datum', 'Geldig op'),
	], [
		...band('{rol}', 1.5, 1.5, 37, 9.6, { font: 'Anton', size: 7.4, letterSpacing: 1.5 }, 2.4),
		// kolom 21,6 breed: een lange naam die de box vult, blijft >= 4 QR-modules van de code af
		t('{event}', 2.6, 12.4, 21.6, 4.2, { font: 'Montserrat', size: 2.8, ...B, letterSpacing: 0.3, ...L }),
		t('{naam}', 2.6, 16.8, 21.6, 7, { font: 'Oswald', size: 4.4, ...B, ...L, wrap: true, lineHeight: 1.05 }),
		t('NR. {teller}', 2.6, 24.6, 21.6, 3.4, { font: 'Roboto Mono', size: 2.3, ...L }),
		// 10,5 mm = precies 21 modules x 4 dots; >= 4 modules wit tot band, tekst en datum (gemeten 4,25)
		qr('PASS-{teller}', 27, 13.3, 10.5),
		t('{datum}', 25.8, 25.2, 12.6, 3.2, { font: 'Roboto Mono', size: 1.9 }),
	]),
	T('ticket', 'Ticket met teller', 'event', ['ticket', 'kaartje', 'entree', 'teller', 'nummer', 'admission', 'event'], [
		fText('event', 'Evenement', 'ZOMERFEEST'), fDate('datum', 'Datum'), fText('aanvang', 'Tijd', '20:00'), fText('plek', 'Plek', 'Het Dorpshuis'),
		fChoice('soort', 'Soort', ['ENTREE', 'VIP', 'GRATIS']),
	], [
		brd('ticket', 0.45),
		t('{event}', 5, 3.6, 21.6, 7, { font: 'Bebas Neue', size: 5, letterSpacing: 0.3, ...L }),
		t('{datum} · {aanvang}', 6.8, 10.8, 20.2, 3.6, { font: 'Montserrat', size: 2.4, ...B, ...L }),
		t('{plek}', 6.8, 14.4, 20.2, 3.4, { font: 'Montserrat', size: 2.3, ...L }),
		...band('{soort}', 5, 19.6, 13, 4.6, { font: 'Montserrat', size: 2.3, ...B, letterSpacing: 0.4 }, 0.8),
		shp('rect', 27.8, 3, 0.3, 24, { stroke: 0, fill: 'gray' }),
		t('NR.', 28.5, 3.8, 6.4, 2.6, { font: 'Montserrat', size: 1.8, ...B }),
		t('{teller}', 28.5, 6.4, 6.4, 4.6, { font: 'Roboto Mono', size: 3.4, ...B }),
		// QR 48 dots tussen scheidslijn, inkeping en hoekboog: 21 modules x 2 dots met >= 4 modules wit (gemeten 5). Een box
		// van 51 dots liet langere data als 25 x 2 = 50 dots erin, met maar 2,5 modules wit; nu is die 'Code te breed'.
		qr('TICKET-{teller}', 28.625, 18, 6),
	]),
	T('garderobe', 'Garderobe-nummer', 'event', ['garderobe', 'jas', 'nummer', 'teller', 'cloakroom', 'coat check', 'number'], [
		fText('titel', 'Titel', 'GARDEROBE'), fText('tekst', 'Onderschrift', 'Bewaar dit nummer goed'),
	], [
		blk(1.5, 1.5, 37, 6.4),
		ico('hanger', 2.2, 1.9, 5.6, { invert: true, stroke: 1.8 }),
		bar('{titel}', 9, 1.5, 28.3, 6.4, { font: 'Oswald', size: 3.6, ...B, letterSpacing: 1.2 }),
		t('{teller}', 2.5, 8.6, 35, 15.4, { font: 'Anton', size: 13 }),
		t('{tekst}', 2.5, 24.4, 35, 3.6, { font: 'Montserrat', size: 2.3, ...I }),
	]),
	T('tafel', 'Tafelkaart met menu', 'event', ['tafelkaart', 'diner', 'bruiloft', 'menu', 'naam', 'place card', 'dinner', 'wedding'], [
		fText('naam', 'Naam', 'Marloes'), fNum('tafel', 'Tafel', '7'), MENU,
	], [
		brd('rounded-double', 0.4),
		t('TAFEL {tafel}', 4.4, 3.8, 31.2, 4, { font: 'Cinzel', size: 2.8, ...B, letterSpacing: 0.6 }),
		t('{naam}', 4.4, 8, 31.2, 9.6, { font: 'Dancing Script', size: 7, ...B }),
		shp('rect', 6, 19.2, 28, 4.8, { stroke: 0.3 }),
		...['Vlees', 'Vis', 'Vega'].map((o, i) => t(o.toUpperCase(), 6 + i * 9.333, 19.2, 9.333, 4.8, { font: 'Oswald', size: 2.6, ...B, letterSpacing: 0.3, ...lit(MENU, o) })),
	]),
	T('loterij', 'Loterijlot', 'event', ['loterij', 'lot', 'verloting', 'tombola', 'teller', 'raffle', 'lottery'], [
		fText('actie', 'Actie', 'Grote verloting'), fDate('datum', 'Trekking'), fNum('prijs', 'Prijs', '2,50', '€'),
	], [
		brd('stamp', 0.4),
		t('{actie}', 4.6, 4.2, 21.4, 7.6, { font: 'Righteous', size: 4, ...L, wrap: true, lineHeight: 1 }),
		t('Trekking {datum}', 4.6, 12.2, 21.4, 3.2, { font: 'Montserrat', size: 2.2, ...L }),
		...band('€ {prijs}', 4.6, 16.8, 12, 5, { font: 'Oswald', size: 3.4, ...B }, 0.8),
		emo('🍀', 18.4, 16.2, 6),
		t('Nr. {teller}', 4.6, 23, 21.4, 3.2, { font: 'Roboto Mono', size: 2.4, ...L }),
		shp('rect', 27.4, 4.2, 0.3, 21.6, { stroke: 0, fill: 'gray' }),
		t('LOT', 28.6, 4.6, 7.2, 3, { font: 'Montserrat', size: 2.1, ...B, letterSpacing: 0.4 }),
		t('{teller}', 28.6, 8.4, 7.2, 5.4, { font: 'Roboto Mono', size: 3.4, ...B }),
		ico('ticket', 29.2, 16, 6, { stroke: 1.6 }),
	]),
	T('savethedate', 'Save the date', 'event', ['save the date', 'datum', 'bruiloft', 'uitnodiging', 'wedding', 'invitation'], [
		fText('wie', 'Wie', 'Lotte & Daan'), fDate('datum', 'Datum', '2026-06-12'), fText('plaats', 'Plaats', 'Utrecht'),
	], [
		brd('corners', 0.5),
		t('SAVE THE', 4, 3.6, 32, 3.8, { font: 'Montserrat', size: 2.6, ...B, letterSpacing: 1.6 }),
		t('Date', 4, 7, 32, 9.4, { font: 'Great Vibes', size: 8 }),
		bar('{datum}', 8, 16.8, 24, 4.8, { font: 'Cinzel', size: 3, ...B, letterSpacing: 0.6 }),
		t('{wie} · {plaats}', 4, 22.4, 32, 4, { font: 'Playfair Display', size: 2.8, ...I }),
	]),
];
export default TEMPLATES;
