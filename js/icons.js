// Tabler-iconen (MIT): lazy uit de CDN, alleen namen + Nederlandse zoekwoorden staan hier.
import { words } from './util.js';

const URLS = {
	outline: 'https://cdn.jsdelivr.net/npm/@tabler/icons@3.19.0/tabler-nodes-outline.json',
	filled: 'https://cdn.jsdelivr.net/npm/@tabler/icons@3.19.0/tabler-nodes-filled.json',
};

// Tabler-namen geverifieerd tegen tabler-nodes-outline.json 3.19.0. Iconify-ids met de zoek-API gevonden, alleen uit
// collecties met palette:false (monochroom, kleurt mee) en elk met een 200 op de svg-URL (29-10-2026). Iconify-aliassen
// die hetzelfde icoon tonen (mdi:weed = mdi:cannabis, mdi:capsule = mdi:pill, ...) staan er bewust niet dubbel in.
// Elk iconify-id zit ook in assets/weed-icons.json (invoegen zonder netwerk; selftest bewaakt dat). glyphs:cannabis-bold
// (94 % gelijk aan mynaui:cannabis-solid) en mdi:syringe (geen wiet) zijn eruit.
export const WEED_ICONS = {
	tabler: ['cannabis', 'bong', 'smoking', 'smoking-no', 'lighter', 'flame', 'campfire', 'leaf', 'leaf-2', 'plant', 'plant-2', 'seeding',
		'mushroom', 'pill', 'pills', 'test-pipe', 'test-pipe-2', 'flask', 'flask-2', 'vaccine', 'vaccine-bottle', 'scale', 'cookie', 'candy',
		'cake', 'bottle', 'glass', 'cup', 'beer', 'glass-cocktail', 'pizza', 'ice-cream', 'cloud-fog', 'wind', 'brain', 'mood-crazy-happy',
		'mood-smile-dizzy', 'alien', 'ufo', 'moon', 'stars', 'sparkles', 'peace', 'clover', 'droplet', 'tip-jar', 'cash'],
	iconify: ['mdi:cannabis', 'material-symbols:cannabis', 'boxicons:cannabis-filled', 'fa7-solid:cannabis', 'healthicons:cannabis',
		'lucide:cannabis', 'mynaui:cannabis-solid', 'game-icons:hemp', 'game-icons:high-grass',
		'fa7-solid:joint', 'fa-solid:joint', 'la:joint', 'fa7-solid:bong', 'boxicons:bong-filled', 'mdi:smoking-pipe', 'game-icons:smoking-pipe',
		'iconoven:hookah-pipe', 'mdi:smoke', 'f7:smoke-fill', 'wi:smoke', 'mdi:smoking', 'fa7-solid:smoking', 'healthicons:smoking',
		'ph:cigarette-fill', 'game-icons:cigarette', 'game-icons:lighter', 'picon:lighter', 'mdi:fire', 'akar-icons:vape-kit', 'mdi:mushroom',
		'mingcute:mushroom-fill', 'mdi:pill', 'ri:capsule-fill', 'mdi:scale', 'fa7-solid:jar', 'ph:jar-fill', 'mdi:leaf',
		'mdi:sprout', 'ri:seedling-fill', 'ph:plant-fill', 'medical-icon:coffee-shop', 'mdi:cookie', 'iconoven:brownie', 'fa7-solid:dizzy',
		'emojione-monotone:dizzy', 'game-icons:stoned-skull', 'mdi:ufo', 'mdi:alien'],
};

// De filled-set (785 iconen) dekt maar een deel, dus de ui valt terug op outline als een naam daar ontbreekt.
export const ICON_CATEGORIES = [
	{ id: 'weed', name: 'Wiet & smoke', icons: WEED_ICONS.tabler },
	{ id: 'keuken', name: 'Keuken & voeding', icons: ['coffee', 'mug', 'cup', 'teapot', 'glass-full', 'bottle', 'milk', 'beer', 'glass-cocktail', 'egg', 'bread', 'cheese', 'pizza', 'burger', 'meat', 'fish', 'apple', 'carrot', 'lemon-2', 'cherry', 'melon', 'salad', 'soup', 'bowl-spoon', 'cookie', 'cake', 'ice-cream', 'chef-hat', 'tools-kitchen-2', 'microwave', 'fridge', 'blender', 'salt', 'pepper', 'baby-bottle'] },
	{ id: 'kantoor', name: 'Kantoor & school', icons: ['pencil', 'ballpen', 'book', 'books', 'notebook', 'clipboard-list', 'clipboard-check', 'calendar', 'calendar-event', 'clock', 'paperclip', 'folder', 'folders', 'file', 'file-text', 'archive', 'briefcase', 'calculator', 'ruler-2', 'scissors', 'school', 'backpack', 'mail', 'printer', 'id-badge', 'presentation', 'notes', 'bookmark', 'eraser', 'palette', 'writing', 'pin'] },
	{ id: 'verzending', name: 'Verzending & opslag', icons: ['package', 'packages', 'box', 'truck', 'truck-delivery', 'truck-return', 'plane', 'ship', 'forklift', 'building-warehouse', 'map-pin', 'location', 'barcode', 'qrcode', 'scan', 'tag', 'tags', 'label', 'receipt', 'shopping-cart', 'shopping-bag', 'basket', 'weight', 'scale', 'mailbox', 'send', 'world', 'route', 'container', 'package-export', 'package-import', 'stack-2'] },
	{ id: 'veiligheid', name: 'Waarschuwing & veiligheid', icons: ['alert-triangle', 'alert-circle', 'alert-octagon', 'exclamation-mark', 'hand-stop', 'ban', 'forbid', 'flame', 'skull', 'radioactive', 'biohazard', 'bolt', 'bomb', 'droplet', 'snowflake', 'temperature', 'thermometer', 'shield', 'shield-check', 'lock', 'lock-open', 'key', 'eye', 'eye-off', 'fire-extinguisher', 'first-aid-kit', 'umbrella', 'glass', 'glass-off', 'barrier-block', 'traffic-cone', 'sos', 'mask', 'virus', 'bell', 'alarm', 'flask', 'pill'] },
	{ id: 'tech', name: 'Tech & kabels', icons: ['plug', 'plug-connected', 'usb', 'wifi', 'bluetooth', 'battery', 'battery-charging', 'battery-4', 'cpu', 'device-laptop', 'device-desktop', 'device-mobile', 'device-tv', 'device-gamepad', 'headphones', 'keyboard', 'mouse', 'router', 'server', 'camera', 'microphone', 'power', 'antenna', 'device-floppy', 'device-sd-card', 'database', 'cloud', 'code', 'terminal', 'settings', 'device-speaker', 'device-watch', 'charging-pile', 'network', 'device-remote'] },
	{ id: 'natuur', name: 'Natuur & tuin', icons: ['leaf', 'plant', 'plant-2', 'seeding', 'flower', 'trees', 'tree', 'cactus', 'mushroom', 'sun', 'moon', 'cloud-rain', 'cloud-snow', 'rainbow', 'mountain', 'wind', 'butterfly', 'bug', 'feather', 'paw', 'dog', 'cat', 'pig', 'horse', 'bone', 'shovel', 'bucket', 'clover', 'windmill', 'campfire'] },
	{ id: 'feest', name: 'Feest & cadeau', icons: ['gift', 'gift-card', 'balloon', 'air-balloon', 'confetti', 'sparkles', 'star', 'stars', 'heart', 'hearts', 'crown', 'trophy', 'award', 'medal', 'music', 'glass-champagne', 'candle', 'mood-smile', 'mood-happy', 'mood-heart', 'ghost', 'pumpkin-scary', 'christmas-tree', 'snowman', 'egg-cracked', 'rosette', 'baby-carriage', 'diamond', 'heart-handshake', 'ticket', 'bow'] },
	{ id: 'pijlen', name: 'Pijlen & vormen', icons: ['arrow-up', 'arrow-down', 'arrow-left', 'arrow-right', 'arrow-big-up', 'arrow-big-down', 'arrow-big-left', 'arrow-big-right', 'arrow-big-up-lines', 'arrow-back-up', 'arrow-up-right', 'corner-down-right', 'arrows-up-down', 'arrows-move', 'refresh', 'rotate-clockwise', 'chevron-right', 'chevrons-right', 'arrow-badge-right', 'arrow-up-circle', 'arrow-down-circle', 'circle', 'square', 'square-rounded', 'triangle', 'hexagon', 'octagon', 'pentagon', 'oval', 'rectangle', 'circle-dot', 'point'] },
	{ id: 'symbolen', name: 'Symbolen', icons: ['check', 'x', 'plus', 'minus', 'circle-check', 'circle-x', 'info-circle', 'help', 'question-mark', 'exclamation-circle', 'percentage', 'currency-euro', 'coin-euro', 'cash-banknote', 'hash', 'at', 'copyright', 'registered', 'trademark', 'recycle', 'infinity', 'peace', 'yin-yang', 'thumb-up', 'thumb-down', 'flag', 'phone', 'user', 'users', 'man', 'woman', 'accessible', 'wheelchair', 'parking', 'discount'] },
	{ id: 'huis', name: 'Huis & klussen', icons: ['home', 'door', 'sofa', 'bed', 'bath', 'armchair', 'lamp', 'bulb', 'tool', 'tools', 'hammer', 'ruler-measure', 'paint', 'brush', 'wash', 'shirt', 'ironing', 'hanger', 'needle-thread', 'wall', 'stairs', 'window', 'fence', 'building', 'car-garage', 'car', 'bike', 'trash', 'air-conditioning', 'spray', 'toilet-paper'] },
];

// Nederlands zoekwoord -> Tabler-termen (substring-match op de iconnaam).
const ALIASES = {
	ster: 'star', sterren: 'stars star', hart: 'heart', harten: 'hearts', liefde: 'heart hearts', pijl: 'arrow', pijlen: 'arrow arrows',
	omhoog: 'arrow-up arrow-big-up', omlaag: 'arrow-down arrow-big-down', links: 'arrow-left', rechts: 'arrow-right',
	terug: 'arrow-back', retour: 'arrow-back-up truck-return', draaien: 'rotate', vernieuwen: 'refresh',
	telefoon: 'phone', mobiel: 'device-mobile', huis: 'home', thuis: 'home', woning: 'home building', gebouw: 'building',
	waarschuwing: 'alert-triangle alert', letop: 'alert exclamation', gevaar: 'alert-triangle skull biohazard', giftig: 'skull biohazard',
	vuur: 'flame', brand: 'flame fire', heet: 'flame temperature', koud: 'snowflake temperature', radioactief: 'radioactive',
	stop: 'hand-stop ban', verboden: 'ban forbid', breekbaar: 'glass', ehbo: 'first-aid-kit', brandblusser: 'fire-extinguisher',
	paraplu: 'umbrella', droog: 'umbrella', temperatuur: 'temperature thermometer', bel: 'bell', wekker: 'alarm',
	koffie: 'coffee', thee: 'teapot mug', kop: 'cup mug', beker: 'mug cup trophy', pakket: 'package', pakje: 'package',
	doos: 'box', verzending: 'truck package', vrachtwagen: 'truck', bezorging: 'truck-delivery', vliegtuig: 'plane',
	boot: 'ship', schip: 'ship', post: 'mail mailbox', brief: 'mail', envelop: 'mail', email: 'mail at', kalender: 'calendar',
	datum: 'calendar', agenda: 'calendar', klok: 'clock', tijd: 'clock', boek: 'book', boeken: 'books', potlood: 'pencil',
	pen: 'ballpen pencil', schaar: 'scissors', rugzak: 'backpack', map: 'folder', ordner: 'folder', archief: 'archive',
	rekenmachine: 'calculator', liniaal: 'ruler', notitie: 'notes note', klembord: 'clipboard', gum: 'eraser', palet: 'palette',
	schrijven: 'writing pencil', punaise: 'pin', kantoor: 'briefcase', werk: 'briefcase tool', naam: 'id-badge user',
	cadeau: 'gift', kado: 'gift', verjaardag: 'cake balloon', taart: 'cake', ballon: 'balloon', feest: 'confetti balloon sparkles',
	kroon: 'crown', medaille: 'medal', muziek: 'music', kaars: 'candle', kerst: 'christmas-tree', sneeuwpop: 'snowman',
	halloween: 'pumpkin-scary ghost', spook: 'ghost', pompoen: 'pumpkin-scary', trouwen: 'hearts heart-handshake', bruiloft: 'hearts heart',
	glimlach: 'mood-smile', blij: 'mood-happy', smiley: 'mood', bedankt: 'heart-handshake', strik: 'bow',
	kinderwagen: 'baby-carriage', baby: 'baby', prijs: 'tag currency', korting: 'discount percentage', procent: 'percentage',
	geld: 'cash coin currency', euro: 'currency-euro coin-euro', winkelwagen: 'shopping-cart', tas: 'shopping-bag', mand: 'basket',
	weegschaal: 'scale', gewicht: 'weight', etiket: 'tag label', sleutel: 'key', slot: 'lock', oog: 'eye', schild: 'shield',
	veilig: 'shield lock', bliksem: 'bolt', stroom: 'bolt plug', stekker: 'plug', kabel: 'plug usb', batterij: 'battery',
	lamp: 'bulb lamp', licht: 'bulb', computer: 'device-desktop', laptop: 'device-laptop', toetsenbord: 'keyboard', muis: 'mouse',
	koptelefoon: 'headphones', foto: 'camera photo', microfoon: 'microphone', instellingen: 'settings', diskette: 'device-floppy',
	geheugenkaart: 'device-sd-card', netwerk: 'network wifi router', internet: 'world wifi', wereld: 'world', oplader: 'charging-pile',
	afstandsbediening: 'device-remote', spel: 'device-gamepad', blad: 'leaf', plant: 'plant seeding', bloem: 'flower', boom: 'tree',
	bomen: 'trees', zon: 'sun', maan: 'moon', wolk: 'cloud', regen: 'cloud-rain', sneeuw: 'snowflake cloud-snow', ijs: 'ice-cream snowflake',
	vriezer: 'snowflake fridge', ingevroren: 'snowflake', koelkast: 'fridge', druppel: 'droplet', water: 'droplet', hond: 'dog',
	kat: 'cat', poes: 'cat', vis: 'fish', vlinder: 'butterfly', insect: 'bug', veer: 'feather', dier: 'paw', schep: 'shovel',
	emmer: 'bucket', regenboog: 'rainbow', berg: 'mountain', varken: 'pig', paard: 'horse', molen: 'windmill', kampvuur: 'campfire',
	ei: 'egg', brood: 'bread', kaas: 'cheese', vlees: 'meat', appel: 'apple', wortel: 'carrot', citroen: 'lemon', kers: 'cherry',
	meloen: 'melon', soep: 'soup', kom: 'bowl', koekje: 'cookie', snoep: 'candy', kok: 'chef-hat', bestek: 'tools-kitchen',
	keuken: 'tools-kitchen chef-hat', magnetron: 'microwave', zout: 'salt', peper: 'pepper', kruiden: 'leaf plant pepper',
	melk: 'milk', fles: 'bottle', glas: 'glass', bier: 'beer', wijn: 'glass bottle', cocktail: 'glass-cocktail', champagne: 'glass-champagne',
	vinkje: 'check', kruis: 'x', info: 'info', vraag: 'help question', recyclen: 'recycle', afval: 'trash recycle', prullenbak: 'trash',
	vlag: 'flag', duim: 'thumb', gebruiker: 'user', persoon: 'user', mensen: 'users', vrouw: 'woman', rolstoel: 'wheelchair',
	parkeren: 'parking', deur: 'door', bank: 'sofa', bed: 'bed', bad: 'bath', stoel: 'armchair', gereedschap: 'tool tools',
	hamer: 'hammer', verf: 'paint', kwast: 'brush', kleding: 'shirt hanger', strijken: 'ironing', wassen: 'wash', trap: 'stairs',
	raam: 'window', hek: 'fence', auto: 'car', fiets: 'bike', naald: 'needle', airco: 'air-conditioning', cirkel: 'circle',
	rond: 'circle oval', vierkant: 'square', driehoek: 'triangle', zeshoek: 'hexagon', ruit: 'diamond', diamant: 'diamond',
	locatie: 'map-pin location', kaart: 'map', scannen: 'scan', streepjescode: 'barcode', bon: 'receipt', kassabon: 'receipt',
	kaartje: 'ticket', magazijn: 'building-warehouse', heftruck: 'forklift', voorraad: 'package box archive', opslag: 'archive box',
	pil: 'pill', medicijn: 'pill first-aid',
	wiet: 'cannabis leaf', weed: 'cannabis', hasj: 'cannabis', coffeeshop: 'cannabis coffee', blowen: 'cannabis smoking bong',
	joint: 'smoking cannabis', roken: 'smoking', sigaret: 'smoking', aansteker: 'lighter', waterpijp: 'bong', pijp: 'bong',
	paddo: 'mushroom', paddenstoel: 'mushroom', zaad: 'seeding', zaadje: 'seeding', kweek: 'plant seeding', kweken: 'plant seeding',
	spacecake: 'cake cookie', edible: 'cookie candy cake', high: 'mood-crazy-happy mood-smile-dizzy ufo', stoned: 'mood-smile-dizzy',
	rook: 'cloud-fog wind smoking', vlam: 'flame', buitenaards: 'alien ufo', vrede: 'peace', fooi: 'tip-jar',
};

const ALLOWED_TAGS = new Set(['path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse']);
const ALLOWED_ATTRS = new Set(['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'points',
	'fill', 'stroke', 'stroke-width', 'opacity', 'fill-rule', 'clip-rule', 'transform']);
const esc = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const cache = {};
export async function loadIconSet(set = 'outline') {
	const s = set === 'filled' ? 'filled' : 'outline';
	// promise cachen: gelijktijdige aanvragen delen één fetch; bij falen opnieuw proberen mogelijk
	cache[s] ||= fetch(URLS[s]).then(r => {
		if (!r.ok) throw new Error('Iconen laden mislukt (HTTP ' + r.status + ')');
		return r.json();
	}).catch(e => { delete cache[s]; throw e; });
	return cache[s];
}

// [term, straf]-paren. Prefix-aliassen alleen voor een half woord ('water' mag niet via 'waterpijp' een bong opleveren),
// en met straf: anders verdringt 'smile' -> smiley -> mood het icoon mood-smile zelf.
function termsFor(tok) {
	const terms = new Map([[tok, 0]]), exact = Object.hasOwn(ALIASES, tok);
	for (const [k, v] of Object.entries(ALIASES)) if (k === tok || (!exact && tok.length >= 3 && k.startsWith(tok)))
		for (const t of v.split(' ')) if (!terms.has(t)) terms.set(t, k === tok ? 0 : 3);
	return Object.assign([...terms], { exact });
}
const termScore = (name, t) => name === t ? 0 : name.startsWith(t + '-') ? 1 : name.startsWith(t) ? 2
	: ('-' + name + '-').includes('-' + t + '-') ? 3 : name.includes(t) ? 4 : 9;

function rankIcons(names, query, limit) {
	const tokens = words(query).map(termsFor);
	if (!tokens.length) {
		const has = new Set(names);
		return [...new Set(ICON_CATEGORIES.flatMap(c => c.icons))].filter(n => has.has(n)).slice(0, limit);
	}
	const hits = [];
	for (const name of names) {
		let score = 0;
		for (const terms of tokens) {
			let best = 9;
			// getypt woord en eerste alias tellen gelijk; latere aliassen iets lager ('wiet' -> cannabis vóór leaf).
			// Een NL-aliaswoord niet midden in een Engelse naam ('zon' in horizontal, 'hart' in chart).
			terms.forEach(([t, p], j) => { const s = termScore(name, t); if (s < 9 && !(terms.exact && j === 0 && s === 4)) best = Math.min(best, s + p + Math.max(0, j - 1) / 100); });
			if (best === 9) { score = -1; break; }
			score += best;
		}
		// merklogo's en "-off"-varianten zijn zelden wat iemand bedoelt
		if (score >= 0) hits.push([score + (/^brand-|-off$/.test(name) ? 3 : 0), name]);
	}
	hits.sort((a, b) => a[0] - b[0] || a[1].length - b[1].length || (a[1] < b[1] ? -1 : 1));
	return hits.slice(0, limit).map(h => h[1]);
}

export async function searchIcons(query, set = 'outline', limit = 120) {
	return rankIcons(Object.keys(await loadIconSet(set)), query, limit);
}

// ———— Iconify (online, CORS *): zoeken + svg ophalen. De svg-tekst gaat in het element mee, zodat het daarna offline werkt.
export const ICONIFY = 'https://api.iconify.design';
// zelfde regel als @iconify/utils matchIconName; houdt de id ook veilig als URL-pad (ook voor weedpack, iconbrowser)
export const PART_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/;

function splitId(id) {
	if (!ID_RE.test(String(id))) throw new Error('Ongeldig icoon-id: ' + id);
	const i = id.indexOf(':');
	return [id.slice(0, i), id.slice(i + 1)];
}

// Altijd zwart: de printer is 1-bit.
export function iconifyUrl(id) {
	const [prefix, name] = splitId(id);
	return `${ICONIFY}/${prefix}/${name}.svg?color=%23000000`;
}

// Puur deel van searchIconify (selftest): kleurcollecties (palette:true, bv. emoji-sets) dither je niet netjes naar zwart.
function parseIconifySearch(json, limit) {
	const cols = json && typeof json.collections === 'object' && json.collections || {};
	const out = [];
	for (const id of Array.isArray(json?.icons) ? json.icons : []) {
		if (!ID_RE.test(String(id))) continue;
		const [prefix, name] = splitId(id), c = cols[prefix];
		if (c?.palette !== false) continue;
		out.push({ id, name, collection: c?.name || prefix });
		if (out.length >= limit) break;
	}
	return out;
}

export async function searchIconify(query, { limit = 96 } = {}) {
	const q = String(query || '').trim();
	if (!q) return [];
	// meer vragen dan nodig: het mono-filter gooit er een deel uit (API: limit 32..999)
	const n = Math.min(999, Math.max(32, limit * 2));
	const r = await fetch(`${ICONIFY}/search?query=${encodeURIComponent(q)}&limit=${n}`);
	if (!r.ok) throw new Error('Online iconen zoeken mislukt (HTTP ' + r.status + ')');
	return parseIconifySearch(await r.json(), limit);
}

// Iconify-JSON -> dezelfde svg als /prefix/naam.svg?color=%23000000. null = gedraaid/gespiegeld of onbekend: dan de losse svg-URL.
function toSvg(data, name) {
	const icons = data?.icons && typeof data.icons === 'object' ? data.icons : {}, a = data?.aliases?.[name];
	const i = Object.hasOwn(icons, name) ? icons[name] : a && Object.keys(a).length === 1 && Object.hasOwn(icons, a.parent) ? icons[a.parent] : null;
	if (!i || typeof i.body !== 'string' || i.rotate || i.hFlip || i.vFlip) return null;
	const n = (k, d) => Number.isFinite(+(i[k] ?? data[k])) ? +(i[k] ?? data[k]) : d;
	return `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="${n('left', 0)} ${n('top', 0)} ${n('width', 16)} ${n('height', 16)}">${i.body.replace(/currentColor/g, '#000000')}</svg>`;
}
const iconsUrl = (prefix, names) => `${ICONIFY}/${prefix}.json?icons=${names.join(',')}`;
// Eén /prefix.json?icons=... per 100 namen i.p.v. één .svg-verzoek per icoon: losse .svg's gaven na wat bladeren 429
// (gemeten, Retry-After 192 s); de .json-route is wat Iconify's eigen loaders gebruiken. Eén cache voor Online en Collecties.
// Promise<svg|null>; mislukt = weer uit de cache, zodat 'Opnieuw' echt opnieuw vraagt.
const svgs = new Map(), queue = new Map();
let flushT = 0;
export function svgFor(prefix, name) {
	// Bij de ingang weigeren: houdt de URL veilig, en een ongeldige naam liet anders de rest van zijn batch hangen.
	if (!PART_RE.test(String(prefix)) || !PART_RE.test(String(name))) return Promise.reject(new Error(`Ongeldige Iconify-naam: ${prefix}:${name}`));
	const id = prefix + ':' + name;
	if (!svgs.has(id)) svgs.set(id, new Promise((res, rej) => {
		if (!queue.has(prefix)) queue.set(prefix, []);
		queue.get(prefix).push([name, res, rej]);
		flushT ||= setTimeout(flush);
	}).catch(e => { svgs.delete(id); throw e; }));
	return svgs.get(id);
}
function flush() {
	flushT = 0;
	for (const [prefix, items] of queue) for (let i = 0; i < items.length; i += 100) {
		const chunk = items.slice(i, i + 100);
		fetch(iconsUrl(prefix, chunk.map(x => x[0]))).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
			.then(j => { for (const [n, res] of chunk) res(toSvg(j, n)); }, e => { for (const [, , rej] of chunk) rej(e); });
	}
	queue.clear();
}

const svgCache = new Map();
export async function fetchIconifySvg(id) {
	if (!svgCache.has(id)) svgCache.set(id, fetch(iconifyUrl(id)).then(async r => {
		if (!r.ok) throw new Error('Icoon ophalen mislukt (HTTP ' + r.status + ')');
		const t = (await r.text()).trim();
		if (!/^<svg\b[\s\S]*<\/svg>$/.test(t)) throw new Error('Geen geldige svg voor ' + id);
		return t;
	}).catch(e => { svgCache.delete(id); throw e; }));
	return svgCache.get(id);
}

// svg-tekst als <img>-bron (thumbs, browser, render).
export const svgUrl = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);

export function iconToSvg(nodes, { set = 'outline', stroke = 2 } = {}) {
	const c = '#000', sw = Number.isFinite(+stroke) ? +stroke : 2;
	const root = set === 'filled' ? `fill="${c}" stroke="none"`
		: `fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"`;
	let body = '';
	for (const n of Array.isArray(nodes) ? nodes : []) {
		if (!Array.isArray(n) || !ALLOWED_TAGS.has(n[0])) continue;
		const attrs = n[1] || {};
		if (attrs.d === 'M0 0h24v24H0z') continue;   // Tabler-hulpvlak, zou in filled een zwart blok worden
		let a = '';
		for (const [k, v] of Object.entries(attrs)) if (ALLOWED_ATTRS.has(k)) a += ` ${k}="${v === 'currentColor' ? c : esc(v)}"`;
		body += `<${n[0]}${a}/>`;
	}
	return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" ${root}>${body}</svg>`;
}

export async function selftest() {
	const details = [];
	let ok = true;
	const check = (cond, msg) => { if (!cond) { ok = false; details.push('FOUT: ' + msg); } };
	// Pakket pas hier laden (niet bij import), via dezelfde loader als de app: node leest van schijf, de browser fetcht.
	try {
		const pack = await (await import('./weedpack.js')).loadWeedPack();
		const have = new Set(pack.categories.flatMap(c => c.icons.map(i => i.id))), miss = WEED_ICONS.iconify.filter(id => !have.has(id));
		check(!miss.length, 'WEED_ICONS.iconify niet in assets/weed-icons.json (zou netwerk nodig hebben): ' + miss.join(', '));
	} catch (e) { check(false, 'assets/weed-icons.json niet te laden: ' + e.message); }
	const nodes = [
		['path', { d: 'M0 0h24v24H0z', stroke: 'none' }],
		['path', { d: 'M12 17.75l-6.172 3.245z' }],
		['circle', { cx: '12', cy: '12', r: '.5', fill: 'currentColor' }],
		['rect', { x: '3', y: '4', width: '18', height: '16', rx: '2' }],
		['line', { x1: '1', y1: '2', x2: '3', y2: '4' }],
		['polyline', { points: '4 4 8 8 4 12' }],
		['polygon', { points: '1 1 5 1 3 4' }],
		['ellipse', { cx: '12', cy: '12', rx: '4', ry: '2' }],
		['g', { 'stroke-width': '1.8' }],
		['script', { d: 'alert(1)' }],
		['path', { d: 'M1 1"/><script>', onload: 'x()', href: 'javascript:x' }],
	];
	const o = iconToSvg(nodes, { stroke: 1.5 });
	check(o.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" ') && o.endsWith('</svg>'), 'svg-omhulsel');
	check(o.includes('fill="none" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"'), 'outline-attributen');
	for (const t of ['path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse']) check(new RegExp(`<${t} [^<>]*/>`).test(o), 'tag ' + t);
	check(!o.includes('M0 0h24v24H0z'), 'hulpvlak overgeslagen');
	check(!/<g|<script|onload|href/.test(o), 'onveilige nodes/attrs gefilterd');
	check(o.includes('d="M1 1&quot;/&gt;&lt;script&gt;"'), 'attribuutwaarde ge-escaped');
	check(o.includes('<circle cx="12" cy="12" r=".5" fill="#000"/>'), 'currentColor vervangen');
	check((o.match(/</g) || []).length === (o.match(/>/g) || []).length, 'gebalanceerde tags');
	const f = iconToSvg([['path', { d: 'M1 1h2z' }]], { set: 'filled' });
	check(f.includes('fill="#000" stroke="none"') && !f.includes('stroke-width'), 'filled-attributen');
	check(iconToSvg(null).endsWith('></svg>'), 'lege nodes');
	const all = ICON_CATEGORIES.flatMap(c => c.icons);
	check(ICON_CATEGORIES.length >= 10 && new Set(ICON_CATEGORIES.map(c => c.id)).size === ICON_CATEGORIES.length, 'categorie-ids');
	check(all.every(n => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(n)), 'icoonnamen-formaat');
	check(ICON_CATEGORIES.every(c => new Set(c.icons).size === c.icons.length), 'geen dubbelen binnen categorie');
	check(Object.keys(ALIASES).length >= 60, 'aliassen >= 60');
	// tikfout in een naam = icoon stil weg; alleen in de browser (node heeft de set niet, offline = overslaan; set is gecachet)
	if (typeof document !== 'undefined') {
		const lib = await loadIconSet('outline').catch(() => null);
		if (lib) check(all.every(n => Object.hasOwn(lib, n)), 'Tabler-namen bestaan niet: ' + all.filter(n => !Object.hasOwn(lib, n)).join());
	}
	const names = ['star', 'stars', 'star-off', 'heart', 'brand-hipchat', 'master', 'arrow-up', 'phone', 'home', 'alert-triangle', 'coffee'];
	check(rankIcons(names, 'ster', 5)[0] === 'star', 'zoek ster');
	check(rankIcons(names, 'Hart', 5)[0] === 'heart', 'zoek hart');
	check(rankIcons(names, 'telef', 5)[0] === 'phone', 'zoek prefix-alias');
	check(rankIcons(['bong', 'droplet'], 'water', 2)[0] === 'droplet', 'echte alias gaat voor prefix-alias');
	check(rankIcons(['mood-x', 'mood-smile'], 'smile', 2)[0] === 'mood-smile', 'getypt woord gaat voor prefix-alias');
	check(rankIcons(['sun', 'flip-horizontal'], 'zon', 2).join() === 'sun', 'NL-woord niet midden in Engelse naam');
	check(rankIcons(['flip-horizontal'], 'hor', 2).join() === 'flip-horizontal', 'geen alias: wel midden in de naam');
	check(rankIcons(names, 'waarschuwing', 5)[0] === 'alert-triangle', 'zoek waarschuwing');
	check(rankIcons(names, 'star', 5).indexOf('star-off') > rankIcons(names, 'star', 5).indexOf('stars'), '-off lager');
	check(rankIcons(names, 'xyzzy', 5).length === 0, 'geen treffers');
	check(rankIcons(names, '', 3).length === 3, 'lege zoekopdracht = categorie-iconen');
	// wiet + Iconify
	check(ICON_CATEGORIES[0].id === 'weed' && ICON_CATEGORIES[0].icons === WEED_ICONS.tabler, 'wiet-categorie bovenaan');
	check(WEED_ICONS.tabler.length >= 20 && new Set(WEED_ICONS.tabler).size === WEED_ICONS.tabler.length, 'WEED_ICONS.tabler >= 20 uniek');
	check(WEED_ICONS.iconify.length >= 30 && new Set(WEED_ICONS.iconify).size === WEED_ICONS.iconify.length, 'WEED_ICONS.iconify >= 30 uniek');
	check(WEED_ICONS.iconify.every(id => ID_RE.test(id)), 'iconify-id-formaat');
	check(rankIcons(['cannabis', 'can', 'star'], 'wiet', 3).join() === 'cannabis', 'zoek wiet');
	check(rankIcons(['leaf', 'cannabis'], 'wiet', 2).join() === 'cannabis,leaf', 'alias-volgorde telt');
	check(iconifyUrl('mdi:cannabis') === 'https://api.iconify.design/mdi/cannabis.svg?color=%23000000', 'iconifyUrl');
	for (const bad of ['mdi', 'mdi:', ':x', '../x:y', 'mdi:a/b', 'mdi:A', 'a:b?c=1']) {
		let threw = false;
		try { iconifyUrl(bad); } catch { threw = true; }
		check(threw, 'ongeldig id geweigerd: ' + bad);
	}
	const res = { icons: ['mdi:cannabis', 'twemoji:herb', 'game-icons:joint', 'bad id', 'onbekend:x', 'tabler:bong'],
		collections: { mdi: { name: 'Material Design Icons', palette: false }, twemoji: { name: 'Twemoji', palette: true },
			'game-icons': { name: 'Game Icons', palette: false }, tabler: { name: 'Tabler', palette: false } } };
	const mono = parseIconifySearch(res, 96);
	check(mono.map(x => x.id).join() === 'mdi:cannabis,game-icons:joint,tabler:bong', 'mono-filter (palette:false, onbekend weg)');
	check(mono[1].name === 'joint' && mono[1].collection === 'Game Icons', 'resultaatvelden');
	check(parseIconifySearch(res, 2).map(x => x.id).join() === 'mdi:cannabis,game-icons:joint', 'limit op het mono-pad');
	check(parseIconifySearch(null, 9).length === 0 && parseIconifySearch({ icons: 'x' }, 9).length === 0, 'kapotte respons');
	check(iconsUrl('mdi', ['leaf', 'leaf-off']) === 'https://api.iconify.design/mdi.json?icons=leaf,leaf-off', 'batch-URL');
	check(await svgFor('mdi', 'a,b').then(() => false, () => true) && await svgFor('../x', 'leaf').then(() => false, () => true) && !queue.size, 'svgFor: ongeldige naam geweigerd vóór de wachtrij');
	// bundelen per 100 + opnieuw na falen; alleen in node met nep-fetch, in de browser de echte API niet raken
	if (typeof document === 'undefined') {
		const real = globalThis.fetch, calls = [];
		let status = 200;
		globalThis.fetch = async url => {
			calls.push(url);
			const names = new URL(url).searchParams.get('icons').split(',');
			return { ok: status === 200, status, json: async () => ({ icons: Object.fromEntries(names.map(n => [n, { body: '<g/>' }])) }) };
		};
		try {
			const names = Array.from({ length: 150 }, (_, i) => 'n' + i);
			const got = await Promise.all(names.map(n => svgFor('zz', n)));
			await svgFor('zz', 'n0');   // uit de cache, geen derde verzoek
			check(calls.join() === [iconsUrl('zz', names.slice(0, 100)), iconsUrl('zz', names.slice(100))].join() && got.every(s => s?.startsWith('<svg')), 'svgFor: 150 namen = 2 verzoeken');
			calls.length = 0; status = 429;
			const failed = await svgFor('zz', 'x').then(() => false, () => true);
			status = 200;
			check(failed && (await svgFor('zz', 'x').catch(() => ''))?.startsWith('<svg') && calls.length === 2, 'svgFor: na 429 opnieuw vragen');
			// offline begonnen: de fout mag niet in de cache blijven, anders komen de iconen nooit meer (ui: OFFLINE_ICONS)
			calls.length = 0; delete cache.filled;
			globalThis.fetch = async url => { calls.push(url); return { ok: calls.length > 1, status: calls.length > 1 ? 200 : 503, json: async () => ({}) }; };
			const ok1 = await loadIconSet('filled').then(() => true, () => false), ok2 = await loadIconSet('filled').then(() => true, () => false);
			check(!ok1 && ok2 && calls.length === 2, 'loadIconSet: na mislukte download opnieuw');
		} finally { globalThis.fetch = real; delete cache.filled; }
	}
	const J = { width: 24, height: 24, icons: { leaf: { body: '<path fill="currentColor" d="M1 1"/>' }, wide: { body: '<g/>', width: 640, left: -2 },
		rot: { body: '<g/>', rotate: 1 }, raar: { body: 5 } }, aliases: { weed: { parent: 'leaf' }, flip: { parent: 'leaf', hFlip: true } } };
	check(toSvg(J, 'leaf') === '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="#000000" d="M1 1"/></svg>', 'svg uit Iconify-JSON (zwart)');
	check(toSvg(J, 'wide').includes('viewBox="-2 0 640 24"') && toSvg({ icons: { x: { body: '' } } }, 'x').includes('viewBox="0 0 16 16"'), 'maat/standaardmaat');
	check(toSvg(J, 'weed') === toSvg(J, 'leaf') && toSvg(J, 'flip') === null, 'simpele alias wel, gespiegelde niet');
	check(toSvg(J, 'rot') === null && toSvg(J, 'raar') === null && toSvg(J, 'nope') === null && toSvg(null, 'leaf') === null && toSvg(J, '__proto__') === null, 'transformaties/kapot/onbekend = null');
	details.push(`${ICON_CATEGORIES.length} categorieën, ${all.length} iconen (${new Set(all).size} uniek), ${Object.keys(ALIASES).length} aliassen, ${WEED_ICONS.iconify.length} Iconify-wieticonen`);
	return { ok, details };
}
