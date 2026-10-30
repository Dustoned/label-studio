// GitHub bewaart openbare templates als issues; aanmelden en publiceren gebeurt op github.com.
import { migrate } from './doc.js';
const REPO = 'Dustoned/label-studio', MARK = 'LABELSTUDIO_TEMPLATE_V1\n';
export function publication(name, doc) {
	name = String(name).trim().slice(0, 60);
	if (!name) throw new Error('Geef je template een naam.');
	const clean = migrate(doc); clean.name = name; clean.batch.csv = '';
	const body = MARK + JSON.stringify({ name, doc:clean });
	if (body.length > 60000) throw new Error('Template te groot voor GitHub-opslag. Exporteer hem als bestand.');
	const base = `https://github.com/${REPO}/issues/new?title=` + encodeURIComponent('[Template] ' + name);
	const full = base + '&body=' + encodeURIComponent(body);
	return { body, url:full.length <= 7000 ? full : base, paste:full.length > 7000 };
}
export function parseIssue(issue) {
	if (issue.pull_request || issue.state !== 'open' || issue.user?.login?.toLowerCase() !== 'dustoned'
		|| !issue.body?.startsWith(MARK) || issue.body.length > 60000) return null;
	try {
		const data = JSON.parse(issue.body.slice(MARK.length));
		if (typeof data.name !== 'string' || !data.name.trim() || data.name.length > 60 || !Array.isArray(data.doc?.elements) || data.doc.elements.length > 1000) return null;
		return { name:data.name, doc:migrate(data.doc), updated:Date.parse(issue.updated_at) || 0,
			cloudUrl:`https://github.com/${REPO}/issues/${Number(issue.number)}` };
	} catch { return null; }
}
export async function fetchTemplates(request = fetch) {
	const templates = new Map();
	for (let page = 1; page <= 10; page++) {
		const response = await request(`https://api.github.com/repos/${REPO}/issues?state=open&creator=Dustoned&per_page=100&page=${page}&refresh=${Math.floor(Date.now() / 60000)}`, { headers:{ Accept:'application/vnd.github+json' }, cache:'no-store', signal:AbortSignal.timeout(15000) });
		if (!response.ok) throw new Error(response.status === 403 || response.status === 429 ? 'GitHub-limiet bereikt. Probeer later opnieuw.' : 'Online templates laden mislukt.');
		const issues = await response.json();
		if (!Array.isArray(issues)) throw new Error('Ongeldig antwoord van GitHub.');
		for (const issue of issues) { const t = parseIssue(issue); if (t && (!templates.has(t.name) || templates.get(t.name).updated < t.updated)) templates.set(t.name, t); }
		if (issues.length < 100) break;
	}
	return [...templates.values()];
}
export async function selftest() {
	const p = publication('Test', { elements:[], batch:{csv:'privé'} });
	const issue = { number:12, state:'open', user:{login:'Dustoned'}, body:p.body, updated_at:'2026-10-30T10:00:00Z' };
	const t = parseIssue(issue);
	let calls = 0;
	const list = await fetchTemplates(async () => { calls++; return {ok:true,json:async()=>[issue, {...issue,user:{login:'ander'}}, {...issue,body:'kapot'}]}; });
	const big = publication('Foto', {elements:[{type:'text',text:'a'.repeat(9000)}]});
	return {ok:!!t && t.doc.batch.csv === '' && t.cloudUrl.endsWith('/12') && list.length === 1 && calls === 1
		&& !parseIssue({...issue,state:'closed'}) && !parseIssue({...issue,pull_request:{}}) && big.paste && !big.url.includes('body='), details:[]};
}
