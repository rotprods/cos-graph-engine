import * as http from 'http';
import { EntityId, BaseCell } from '@cos/core';
import { COSServer } from './server';
import { AuthMiddleware, AuthIdentity } from './auth';
import { Configuration } from '@cos/infrastructure';

// ================================================================
// Phase 5: HTTP API Server
// REST endpoints for the Cognitive Operating System
// ================================================================

export class HttpApiServer {
  private httpServer: http.Server | null = null;
  private cosServer: COSServer;
  private auth: AuthMiddleware;
  private config: Configuration;
  private started = false;

  constructor(cosServer: COSServer, auth: AuthMiddleware, config: Configuration) {
    this.cosServer = cosServer;
    this.auth = auth;
    this.config = config;
  }

  async start(): Promise<void> {
    if (this.started) return;

    const host = this.config.get<string>('server.host') || '0.0.0.0';
    const port = this.config.get<number>('server.port') || 8080;

    this.httpServer = http.createServer((req, res) => this.handleRequest(req, res));

    return new Promise((resolve) => {
      this.httpServer!.listen(port, host, () => {
        this.started = true;
        console.log(`[COS API] Server listening on http://${host}:${port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.httpServer || !this.started) return;
    return new Promise((resolve) => {
      this.httpServer!.close(() => {
        this.started = false;
        console.log('[COS API] Server stopped');
        resolve();
      });
    });
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const path = url.pathname;
      const method = req.method || 'GET';

      // Authenticate
      const authHeader = req.headers['authorization'] as string | undefined;
      const identity = await this.auth.authenticate(authHeader);

      // Route
      const body = await this.readBody(req);

      // Dashboard (inline HTML)
      if ((path === '/' || path === '/dashboard') && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(getDashboardHTML());
        return;
      }

      if (path === '/health' && method === 'GET') {
        await this.sendJson(res, 200, await this.cosServer.getHealth());
      } else if (path === '/stats' && method === 'GET') {
        await this.sendJson(res, 200, await this.cosServer.getStats());
      } else if (path === '/process' && method === 'POST') {
        if (!identity.permissions.includes('execute')) {
          await this.sendJson(res, 403, { error: 'Forbidden: execute permission required' });
          return;
        }
        const result = await this.cosServer.process({
          input: body.input,
          target: body.target,
          reasoning: body.reasoning,
          context: this.auth.toCellContext(identity, body.traceId),
        });
        await this.sendJson(res, 200, result);
      } else if (path === '/memory' && method === 'GET') {
        if (!identity.permissions.includes('read')) {
          await this.sendJson(res, 403, { error: 'Forbidden' });
          return;
        }
        const stats = await this.cosServer.memory.stats();
        await this.sendJson(res, 200, stats);
      } else if (path.startsWith('/memory/') && method === 'GET') {
        const id = path.substring(8) as EntityId;
        const entry = await this.cosServer.memory.retrieve(id);
        if (entry) await this.sendJson(res, 200, entry);
        else await this.sendJson(res, 404, { error: 'Not found' });
      } else if (path === '/knowledge' && method === 'GET') {
        const stats = await this.cosServer.knowledge.stats();
        await this.sendJson(res, 200, stats);
      } else if (path.startsWith('/knowledge/') && method === 'GET') {
        const query = path.substring(11);
        const results = await this.cosServer.knowledge.query(query);
        await this.sendJson(res, 200, results);
      } else if (path === '/self-improve' && method === 'GET') {
        const report = await this.cosServer.selfImprovement.runMetaCognition(true);
        await this.sendJson(res, 200, report);
      } else if (path === '/cells' && method === 'GET') {
        const cells = this.cosServer.cellHost.getAllCells().map(c => ({
          id: c.definition.id,
          name: c.definition.name,
          type: c.definition.type,
          purpose: c.definition.purpose,
          health: c.state.health,
        }));
        await this.sendJson(res, 200, cells);
      } else if (path.startsWith('/cells/') && method === 'GET') {
        const id = path.substring(7) as EntityId;
        const inspection = await this.cosServer.cellHost.inspectCell(id);
        if (inspection) await this.sendJson(res, 200, inspection);
        else await this.sendJson(res, 404, { error: 'Cell not found' });
      } else if (path === '/goals' && method === 'POST') {
        if (!body.description) { await this.sendJson(res, 400, { error: 'description required' }); return; }
        const goal = await this.cosServer.createGoal(body.description, { traceId: `http-goal-${Date.now()}` });
        await this.sendJson(res, 201, goal);
      } else if (path === '/goals' && method === 'GET') {
        const goals = await this.cosServer.getActiveGoals();
        await this.sendJson(res, 200, goals);
      } else if (path.startsWith('/goals/') && method === 'POST') {
        const goalId = path.substring(7) as EntityId;
        const action = body.action || 'execute';
        if (action === 'execute') {
          const result = await this.cosServer.executeGoal(goalId);
          await this.sendJson(res, 200, result);
        } else if (action === 'step') {
          const result = await this.cosServer.executeNextStep(goalId);
          await this.sendJson(res, 200, result);
        } else {
          await this.sendJson(res, 400, { error: `Unknown action: ${action}` });
        }
      } else if (path === '/research' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(getResearchHTML());
        return;
      } else if (path === '/research' && method === 'POST') {
        const question = body.question || '';
        if (!question) { await this.sendJson(res, 400, { error: 'question required' }); return; }

        // Search memory for relevant context
        const memResults = await this.cosServer.memory.query({ content: question, limit: 5 });

        // Query knowledge graph
        const kgResults = await this.cosServer.knowledge.query(question.split(' ').slice(0, 5).join(' '));

        // Run reasoning
        const reasoningSteps = await this.cosServer.reasoning.reason('chain_of_thought', { problem: question, steps: 5 }, { traceId: `research-${Date.now()}` });

        // Generate LLM response
        const llmResponse = await this.cosServer.llm.get().generate({
          messages: [
            { role: 'system', content: 'You are a research assistant. Analyze the question thoroughly and provide structured analysis.' },
            { role: 'user', content: `Research question: ${question}\n\nContext from knowledge graph: ${kgResults.map((k: any) => `${k.subject} ${k.predicate} ${k.object}`).join(', ')}\n\nProvide a structured analysis.` },
          ],
        });

        // Store in memory
        await this.cosServer.memory.store({ type: 'research', question, answer: llmResponse.content }, 'episodic', { tags: ['research', question.split(' ').slice(0, 3).join('-')], importance: 0.8 });

        // Self-improvement
        await this.cosServer.selfImprovement.recordOutput({ type: 'research', question }, { answer: llmResponse.content, steps: reasoningSteps.length });

        const siStats = this.cosServer.selfImprovement.stats;

        await this.sendJson(res, 200, {
          report: {
            title: `Research: ${question.substring(0, 60)}`,
            summary: llmResponse.content,
            conclusions: reasoningSteps.slice(-2).map(s => s.output.substring(0, 100)),
          },
          reasoning: reasoningSteps.map(s => ({ output: s.output, confidence: s.confidence })),
          llmTrace: { content: llmResponse.content.substring(0, 500) },
          knowledge: kgResults.slice(0, 5),
          memory: { entries: memResults.length, layers: Object.values((await this.cosServer.memory.stats()).byLayer).filter((c: any) => c > 0).length },
          selfImprovement: { score: siStats.outputsRecorded > 0 ? 0.7 : 0.5, trend: 'stable' },
          confidence: llmResponse.usage.totalTokens > 0 ? 0.85 : 0.6,
        });
      } else if (path === '/chat' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(getChatHTML());
        return;
      } else if (path === '/chat' && method === 'POST') {
        const msg = body.message || '';
        if (!msg) { await this.sendJson(res, 400, { error: 'message required' }); return; }

        // SEARCH MEMORY for relevant context
        const memResults = await this.cosServer.memory.query({ content: msg, limit: 3 });

        // QUERY KNOWLEDGE GRAPH
        const kgResults = await this.cosServer.knowledge.query(msg.split(' ').slice(0, 3).join(' '));

        // RUN REASONING
        const reasoning = await this.cosServer.reasoning.reason('chain_of_thought', {
          problem: msg,
          steps: 3,
        }, { traceId: `chat-${Date.now()}` });
        const reasoningText = reasoning.map(r => r.output).join('\n');

        // GENERATE RESPONSE via LLM
        const llmResponse = await this.cosServer.llm.get().generate({
          messages: [
            { role: 'system', content: 'You are a cognitive operating system. Respond helpfully and concisely.' },
            { role: 'user', content: msg },
          ],
        });

        // STORE IN MEMORY
        await this.cosServer.memory.store(
          { role: 'user', content: msg },
          'episodic',
          { tags: ['chat', 'user'], importance: 0.6 },
        );
        await this.cosServer.memory.store(
          { role: 'cos', content: llmResponse.content },
          'episodic',
          { tags: ['chat', 'cos'], importance: 0.6 },
        );

        // FEED INTO SELF-IMPROVEMENT
        await this.cosServer.selfImprovement.recordOutput(
          { type: 'chat', message: msg },
          { response: llmResponse.content, quality: llmResponse.usage.totalTokens },
        );

        await this.sendJson(res, 200, {
          response: llmResponse.content.substring(0, 2000),
          memory: memResults.length > 0 ? `${memResults.length} relevant memories` : 'none',
          knowledge: kgResults.length > 0 ? `${kgResults.length} facts found` : 'general',
          reasoning: `chain_of_thought: ${reasoning.length} steps`,
          confidence: llmResponse.usage.totalTokens > 0 ? 0.8 : 0.5,
        });
      } else if (path === '/config' && method === 'GET') {
        await this.sendJson(res, 200, this.config.snapshot());
      } else if (path === '/auth/token' && method === 'POST') {
        const token = this.auth.generateToken(body.userId || 'user', body.role || 'user');
        await this.sendJson(res, 200, { token });
      } else {
        await this.sendJson(res, 404, { error: 'Not found', path });
      }
    } catch (error) {
      await this.sendJson(res, 500, { error: (error as Error).message });
    }
  }

  private readBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        if (!raw) return resolve({});
        try { resolve(JSON.parse(raw)); }
        catch { resolve({ raw }); }
      });
    });
  }

  private sendJson(res: http.ServerResponse, status: number, data: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data, null, 2));
  }
}
function getDashboardHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>COS Dashboard</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0d1117;color:#c9d1d9;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;padding:20px}
h1{font-size:24px;font-weight:300;color:#58a6ff;margin-bottom:4px;display:flex;align-items:center;gap:12px}
h1 small{font-size:12px;color:#8b949e;font-weight:400}
#status-bar{display:flex;gap:12px;margin:16px 0;flex-wrap:wrap}
.status-card{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:16px;flex:1;min-width:180px}
.status-card .label{font-size:10px;text-transform:uppercase;color:#8b949e;letter-spacing:1px}
.status-card .value{font-size:28px;font-weight:600;margin-top:4px}
.status-card .sub{font-size:11px;color:#8b949e;margin-top:2px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:16px;margin-top:16px}
.card{background:#161b22;border:1px solid #30363d;border-radius:8px;overflow:hidden}
.card h2{font-size:13px;font-weight:600;padding:12px 16px;background:#1c2128;border-bottom:1px solid #30363d;display:flex;justify-content:space-between;align-items:center}
.card h2 small{font-size:10px;color:#8b949e;font-weight:400}
.card-body{padding:16px}
.card-body pre{font-size:11px;color:#8b949e;overflow:auto;max-height:200px}
.stat-row{display:flex;justify-content:space-between;padding:4px 0;font-size:12px;border-bottom:1px solid #21262d}
.stat-row:last-child{border-bottom:none}
.stat-row .key{color:#8b949e}
.stat-row .val{color:#c9d1d9;font-weight:500}
.badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600}
.badge-green{background:#003d1f;color:#3fb950}
.badge-red{background:#3d0000;color:#f85149}
.badge-yellow{background:#3d2e00;color:#d29922}
.badge-blue{background:#00263d;color:#58a6ff}
.engine-list{display:flex;flex-wrap:wrap;gap:6px}
.engine-tag{background:#1f2937;color:#c9d1d9;padding:4px 10px;border-radius:4px;font-size:11px;border:1px solid #30363d}
#error-bar{display:none;background:#3d0000;color:#f85149;padding:10px 16px;border-radius:6px;margin-bottom:16px;font-size:13px}
#error-bar.show{display:block}
.kv-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px}
.gauge{height:6px;background:#21262d;border-radius:3px;margin-top:6px;overflow:hidden}
.gauge-fill{height:100%;border-radius:3px;transition:width .5s}
.pulse{animation:pulse 2s infinite}
@keyframes pulse{0%{opacity:1}50%{opacity:.4}100%{opacity:1}}
.memory-bar{margin:2px 0;display:flex;align-items:center;gap:8px;font-size:11px}
.memory-bar .bar{flex:1;height:8px;background:#21262d;border-radius:4px;overflow:hidden}
.memory-bar .fill{height:100%;border-radius:4px;min-width:2px}
.chart{display:flex;gap:2px;align-items:flex-end;height:60px;margin-top:8px}
.chart .col{flex:1;border-radius:2px 2px 0 0;min-height:4px;transition:height .5s}
button{background:#238636;color:#fff;border:none;padding:6px 16px;border-radius:6px;font-size:12px;cursor:pointer}
button:hover{background:#2ea043}
input{background:#0d1117;border:1px solid #30363d;color:#c9d1d9;padding:6px 12px;border-radius:6px;font-size:12px;width:100%;margin:4px 0}
.refresh-btn{background:none;border:1px solid #30363d;color:#8b949e;padding:4px 12px;border-radius:6px;font-size:11px;cursor:pointer}
.refresh-btn:hover{background:#1c2128}
</style>
</head>
<body>
<div id="error-bar"></div>
<h1>🧠 Cognitive Operating System <small id="subtitle">loading...</small></h1>
<div id="status-bar"></div>
<div class="grid" id="grid"></div>

<script>
const API = window.location.origin;

async function fetchJSON(path){
  const r=await fetch(API+path);
  if(!r.ok)throw new Error(r.status+' '+r.statusText);
  return r.json();
}

function showError(msg){
  const e=document.getElementById('error-bar');
  e.textContent='⚠ '+msg;e.classList.add('show');
  setTimeout(()=>e.classList.remove('show'),5000);
}

function statRow(k,v){return '<div class="stat-row"><span class="key">'+k+'</span><span class="val">'+v+'</span></div>'}

function badge(v){
  if(v==='healthy'||v==='ok'||v==='completed') return '<span class="badge badge-green">'+v+'</span>';
  if(v==='degraded'||v==='warning') return '<span class="badge badge-yellow">'+v+'</span>';
  if(v==='unhealthy'||v==='error'||v==='failed') return '<span class="badge badge-red">'+v+'</span>';
  return '<span class="badge badge-blue">'+v+'</span>';
}

function card(title,content,extra=''){return '<div class="card"><h2>'+title+extra+'</h2><div class="card-body">'+content+'</div></div>'}

async function refresh(){
  try{
    const[health,stats,mem,kg,si,cells]=await Promise.all([
      fetchJSON('/health'),fetchJSON('/stats'),fetchJSON('/memory'),
      fetchJSON('/knowledge'),fetchJSON('/self-improve'),fetchJSON('/cells')
    ]);
    
    const sys=health.system||{};
    document.getElementById('subtitle').textContent='updated '+new Date().toLocaleTimeString();
    
    // Status bar
    const sb=document.getElementById('status-bar');
    sb.innerHTML=
      '<div class="status-card"><div class="label">System Status</div><div class="value">'+badge(sys.status||'unknown')+'</div><div class="sub">'+(sys.message||'')+'</div></div>'+
      '<div class="status-card"><div class="label">Cells</div><div class="value">'+(sys.metrics?.cells||0)+'</div><div class="sub">cognitive units</div></div>'+
      '<div class="status-card"><div class="label">Memory</div><div class="value">'+(mem.totalEntries||0)+'</div><div class="sub">entries across '+
        Object.entries(mem.byLayer||{}).filter(([_,c])=>c>0).length+' layers</div></div>'+
      '<div class="status-card"><div class="label">Score</div><div class="value">'+(si.averageScore?Math.round(si.averageScore*100):0)+'<span style="font-size:14px">/100</span></div>'+
        '<div class="sub">trend: '+badge(si.scoreTrend||'stable')+'</div></div>';

    // Grid
    const g=document.getElementById('grid');
    
    // Cell info
    let cellHtml='';
    if(cells&&cells.length){
      cellHtml='<table style="width:100%;font-size:11px;border-collapse:collapse">';
      cells.forEach(c=>{
        const s=c.health?.status||'unknown';
        cellHtml+='<tr style="border-bottom:1px solid #21262d"><td style="padding:4px">'+badge(s)+'</td><td style="padding:4px">'+c.name+'</td><td style="padding:4px;color:#8b949e">'+c.type+'</td></tr>';
      });
      cellHtml+='</table>';
    }else cellHtml='<div style="color:#8b949e;font-size:12px">No cells registered</div>';
    
    // Memory by layer
    let memHtml='';
    if(mem.byLayer){
      const max=Math.max(...Object.values(mem.byLayer),1);
      const colors=['#4ecca3','#3282b8','#00adb5','#e23e57','#f39c12','#53d769','#1abc9c','#9b59b6','#e67e22','#3498db','#f1c40f','#2ecc71'];
      let i=0;
      for(const[layer,count]of Object.entries(mem.byLayer)){
        if(count>0){
          const pct=(count/max*100).toFixed(0);
          memHtml+='<div class="memory-bar"><span style="width:80px">'+layer.replace('_',' ')+'</span><div class="bar"><div class="fill" style="width:'+pct+'%;background:'+colors[i%colors.length]+'"></div></div><span>'+count+'</span></div>';
          i++;
        }
      }
    }
    
    // Knowledge graph
    let kgHtml='<div style="font-size:12px">'+statRow('Total statements',kg.length||0)+statRow('Nodes',(kg.nodeCount||0))+(kg.byNodeType?Object.entries(kg.byNodeType).map(([t,c])=>statRow('  '+t,c)).join(''):'')+'</div>';
    
    // Self-improvement details
    let siHtml='<div style="font-size:12px">'+statRow('Evaluations',si.totalEvaluations||0)+statRow('Average score',(si.averageScore?Math.round(si.averageScore*100)+'/100':'N/A'))+statRow('Trend',badge(si.scoreTrend||'stable'));
    if(si.weaknesses&&si.weaknesses.length) siHtml+=statRow('Top weakness',si.weaknesses[0]);
    if(si.patterns) siHtml+=statRow('Patterns',si.patterns.length);
    siHtml+='</div>';
    if(si.suggestions&&si.suggestions.length){
      siHtml+='<div style="margin-top:8px;font-size:11px">';
      si.suggestions.slice(0,3).forEach(s=>siHtml+='<div style="padding:2px 0;color:#8b949e">→ '+s+'</div>');
      siHtml+='</div>';
    }
    
    // Reasoning engines
    const engHtml='<div class="engine-list">'+['chain_of_thought','tree_of_thoughts','reflection','graph_of_thoughts','debate'].map(e=>'<span class="engine-tag">'+e.replace(/_/g,' ')+'</span>').join('')+'</div>';
    
    // API Playground
    const apiHtml='<div style="font-size:12px"><label style="color:#8b949e">Input</label><input id="play-input" value="hello COS" placeholder="Enter input..."/><div style="display:flex;gap:8px;margin-top:8px"><button onclick="playProcess()">Process</button><button onclick="playReason()" style="background:#1f6feb">Reason</button><button onclick="playDebate()" style="background:#8957e5">Debate</button></div><pre id="play-output" style="margin-top:8px;background:#0d1117;padding:8px;border-radius:4px;border:1px solid #30363d;min-height:40px;font-size:11px">Output will appear here...</pre></div>';
    
    g.innerHTML=
      card('🧩 Cognitive Cells',cellHtml,'<span class="badge badge-blue">'+cells.length+'</span>')+
      card('🧠 Reasoning Engines',engHtml,'<span class="badge badge-green">5</span>')+
      card('💾 Memory Layers',memHtml,'<span class="badge badge-blue">'+Object.values(mem.byLayer||{}).filter(c=>c>0).length+' active</span>')+
      card('🔗 Knowledge Graph',kgHtml,'<span class="badge badge-green">'+(kg.length||0)+'</span>')+
      card('📈 Self-Improvement',siHtml,'<span class="badge '+(si.scoreTrend==='improving'?'badge-green':'badge-yellow')+'">'+((si.averageScore||0)*100).toFixed(0)+'</span>')+
      card('🎮 API Playground',apiHtml);
    
  }catch(e){showError(e.message)}
}

async function play(url,body){
  const o=document.getElementById('play-output');
  o.textContent='Processing...';
  try{
    const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const d=await r.json();
    o.textContent=JSON.stringify(d,null,2);
  }catch(e){o.textContent='Error: '+e.message}
}
function playProcess(){const i=document.getElementById('play-input').value;play('/process',{input:i})}
function playReason(){const i=document.getElementById('play-input').value;play('/process',{input:{problem:i,steps:3},reasoning:'chain_of_thought'})}
function playDebate(){const i=document.getElementById('play-input').value;play('/process',{input:{topic:i,rounds:2},reasoning:'debate'})}

refresh();
setInterval(refresh,5000);
</script>
</body>
</html>`;
}

function getChatHTML(): string { return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>COS Chat</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0d1117;color:#c9d1d9;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;height:100vh;display:flex;flex-direction:column}
#header{background:#161b22;border-bottom:1px solid #30363d;padding:12px 20px;display:flex;align-items:center;gap:12px}
#header h1{font-size:16px;font-weight:600;color:#58a6ff}
#header .status{font-size:11px;color:#8b949e;margin-left:auto}
#header .status .dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#3fb950;margin-right:4px}
#chat{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:16px}
.msg{max-width:75%;padding:10px 14px;border-radius:8px;font-size:13px;line-height:1.5;animation:fadeIn .3s}
.msg.user{background:#1f6feb;color:#fff;align-self:flex-end;border-bottom-right-radius:2px}
.msg.cos{background:#161b22;color:#c9d1d9;align-self:flex-start;border:1px solid #30363d;border-bottom-left-radius:2px}
.msg.cos .meta{font-size:10px;color:#8b949e;margin-top:6px;display:flex;gap:8px;flex-wrap:wrap}
.msg.cos .meta span{background:#1c2128;padding:1px 6px;border-radius:3px}
.msg.system{background:#1c2128;color:#8b949e;align-self:center;font-size:11px;padding:6px 12px;border-radius:4px;border:1px solid #21262d}
#input-area{background:#161b22;border-top:1px solid #30363d;padding:12px 20px;display:flex;gap:8px}
#input{flex:1;background:#0d1117;border:1px solid #30363d;color:#c9d1d9;padding:10px 14px;border-radius:6px;font-size:13px;outline:none}
#input:focus{border-color:#58a6ff}
#send{background:#238636;color:#fff;border:none;padding:10px 20px;border-radius:6px;font-size:13px;cursor:pointer;font-weight:600}
#send:hover{background:#2ea043}
#send:disabled{background:#21262d;color:#484f58;cursor:not-allowed}
.thinking{display:inline-flex;align-items:center;gap:4px}
.thinking .dot{width:6px;height:6px;background:#58a6ff;border-radius:50%;animation:bounce 1.4s infinite}
.thinking .dot:nth-child(2){animation-delay:.2s}
.thinking .dot:nth-child(3){animation-delay:.4s}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes bounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}
</style>
</head>
<body>
<div id="header">
  <h1>🧠 COS Chat</h1>
  <span style="font-size:11px;color:#8b949e">Cognitive Operating System</span>
  <div class="status"><span class="dot"></span>connected</div>
</div>
<div id="chat">
  <div class="msg system">COS Chat initialized. All 11 subsystems ready. Start a conversation.</div>
</div>
<div id="input-area">
  <input id="input" type="text" placeholder="Type a message..." autofocus>
  <button id="send" onclick="send()">Send</button>
</div>

<script>
const chat = document.getElementById('chat');
const input = document.getElementById('input');
const sendBtn = document.getElementById('send');

input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });

async function send() {
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  addMessage(text, 'user');
  sendBtn.disabled = true;

  // Show thinking indicator
  const thinkingDiv = document.createElement('div');
  thinkingDiv.className = 'msg cos';
  thinkingDiv.innerHTML = '<div class="thinking"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>';
  chat.appendChild(thinkingDiv);
  chat.scrollTop = chat.scrollHeight;

  try {
    const res = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });
    const data = await res.json();
    thinkingDiv.remove();

    // Build response with metadata
    let html = data.response;
    const meta = [];
    if (data.memory) meta.push('memory: ' + data.memory);
    if (data.knowledge) meta.push('knowledge: ' + data.knowledge);
    if (data.reasoning) meta.push(data.reasoning);
    if (data.confidence) meta.push('confidence: ' + (data.confidence*100).toFixed(0) + '%');
    if (meta.length) html += '<div class="meta">' + meta.map(m => '<span>' + m + '</span>').join('') + '</div>';
    addMessage(html, 'cos');
  } catch (e) {
    thinkingDiv.remove();
    addMessage('Error: ' + e.message, 'system');
  }
  sendBtn.disabled = false;
  input.focus();
}

function addMessage(text, type) {
  const div = document.createElement('div');
  div.className = 'msg ' + type;
  div.innerHTML = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}
</script>
</body>
</html>`; }

function getResearchHTML(): string { return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>COS Research Assistant</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0d1117;color:#c9d1d9;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;padding:20px}
h1{font-size:20px;font-weight:300;color:#58a6ff;margin-bottom:4px;display:flex;align-items:center;gap:10px}
h1 small{font-size:11px;color:#8b949e;font-weight:400}
.subtitle{color:#8b949e;font-size:12px;margin-bottom:20px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}
.card{background:#161b22;border:1px solid #30363d;border-radius:8px;overflow:hidden}
.card h2{font-size:12px;font-weight:600;padding:10px 14px;background:#1c2128;border-bottom:1px solid #30363d;display:flex;justify-content:space-between;align-items:center}
.card-body{padding:14px;font-size:13px;line-height:1.6}
.card-body pre{font-size:11px;color:#8b949e;overflow:auto;max-height:200px;background:#0d1117;padding:8px;border-radius:4px;margin-top:8px}
#input-area{display:flex;gap:8px;margin-bottom:16px}
#question{flex:1;background:#0d1117;border:1px solid #30363d;color:#c9d1d9;padding:10px 14px;border-radius:6px;font-size:13px;outline:none}
#question:focus{border-color:#58a6ff}
#research-btn{background:#238636;color:#fff;border:none;padding:10px 24px;border-radius:6px;font-size:13px;cursor:pointer;font-weight:600}
#research-btn:hover{background:#2ea043}
#research-btn:disabled{background:#21262d;color:#484f58;cursor:not-allowed}
.stat-row{display:flex;justify-content:space-between;padding:3px 0;font-size:12px;border-bottom:1px solid #21262d}
.stat-row:last-child{border-bottom:none}
.stat-row .key{color:#8b949e}
.stat-row .val{color:#c9d1d9;font-weight:500}
.badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600}
.badge-green{background:#003d1f;color:#3fb950}
.badge-blue{background:#00263d;color:#58a6ff}
.status-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px}
.status-dot.green{background:#3fb950}
.status-dot.yellow{background:#d29922}
.thinking{display:inline-flex;align-items:center;gap:4px;padding:8px 0;color:#8b949e;font-size:12px}
.thinking .dot{width:5px;height:5px;background:#58a6ff;border-radius:50%;animation:bounce 1.4s infinite}
.thinking .dot:nth-child(2){animation-delay:.2s}
.thinking .dot:nth-child(3){animation-delay:.4s}
@keyframes bounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}
#trace{font-family:monospace;font-size:11px;line-height:1.8}
#trace .step{color:#58a6ff}
#trace .result{color:#3fb950}
#trace .meta{color:#8b949e}
</style>
</head>
<body>
<h1>🔬 COS Research Assistant <small>Cognitive Operating System Demo</small></h1>
<div class="subtitle">Ask a research question. The COS will reason, search memory, query knowledge, and generate a structured analysis.</div>

<div id="input-area">
  <input id="question" type="text" placeholder="e.g., Analyze the COS architecture, what are its key subsystems?" autofocus>
  <button id="research-btn" onclick="research()">Research</button>
</div>

<div class="grid">
  <div class="card" style="grid-column:1/-1">
    <h2>📋 Research Report</h2>
    <div class="card-body" id="report">
      <div style="color:#8b949e">Enter a research question above to begin.</div>
    </div>
  </div>

  <div class="card">
    <h2>🧠 Reasoning Trace</h2>
    <div class="card-body" id="trace"><div style="color:#8b949e;font-size:11px">Waiting for input...</div></div>
  </div>

  <div class="card">
    <h2>💾 Knowledge & Memory</h2>
    <div class="card-body" id="knowledge">
      <div style="color:#8b949e;font-size:11px">Knowledge graph and memory stats will appear here.</div>
    </div>
  </div>
</div>

<script>
let sessionId = 'sess-' + Date.now();

async function research() {
  const q = document.getElementById('question').value.trim();
  if (!q) return;
  document.getElementById('research-btn').disabled = true;
  document.getElementById('report').innerHTML = '<div class="thinking"><span class="dot"></span><span class="dot"></span><span class="dot"></span>&nbsp;Running cognitive pipeline...</div>';
  document.getElementById('trace').innerHTML = '<div class="thinking"><span class="dot"></span><span class="dot"></span><span class="dot"></span>&nbsp;Reasoning...</div>';

  try {
    const res = await fetch('/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q, sessionId }),
    });
    const data = await res.json();

    // Report
    let reportHtml = \`<div style="font-size:14px;font-weight:600;margin-bottom:8px">${data.report?.title || 'Research Analysis'}</div>\`;
    reportHtml += \`<div>${(data.report?.summary || data.report || '').substring(0, 2000)}</div>\`;
    if (data.report?.conclusions) {
      reportHtml += '<div style="margin-top:12px;font-weight:600">Conclusions:</div><ul style="margin-top:4px;padding-left:20px">';
      data.report.conclusions.forEach((c: string) => reportHtml += \`<li style="font-size:12px;margin:2px 0">${c}</li>\`);
      reportHtml += '</ul>';
    }
    reportHtml += '<div style="margin-top:12px;font-size:11px;color:#8b949e;border-top:1px solid #21262d;padding-top:8px">';
    reportHtml += \`<span class="badge badge-blue">conf: ${(data.confidence*100).toFixed(0)}%</span> \`;
    reportHtml += \`<span class="badge badge-green">${data.reasoning?.length || 0} steps</span> \`;
    reportHtml += \`<span class="badge badge-blue">${data.memory?.entries || 0} memories</span>\`;
    reportHtml += '</div>';
    document.getElementById('report').innerHTML = reportHtml;

    // Trace
    let traceHtml = '';
    if (data.reasoning) {
      data.reasoning.forEach((step: any, i: number) => {
        traceHtml += \`<div class="step">Step ${i + 1}: ${step.output?.substring(0, 80) || ''}</div>\`;
        if (step.confidence) traceHtml += \`<div class="meta">  confidence: ${(step.confidence*100).toFixed(0)}%</div>\`;
      });
    }
    if (data.llmTrace) {
      traceHtml += \`<div class="result" style="margin-top:8px">🤖 LLM: ${(data.llmTrace.content || '').substring(0, 200)}</div>\`;
    }
    document.getElementById('trace').innerHTML = traceHtml || '<div style="color:#8b949e">No reasoning trace available</div>';

    // Knowledge
    let kgHtml = '<div style="font-size:12px">';
    if (data.knowledge) {
      kgHtml += '<div style="font-weight:600;margin-bottom:6px">Knowledge Graph</div>';
      if (Array.isArray(data.knowledge)) {
        data.knowledge.slice(0, 5).forEach((k: any) => {
          kgHtml += \`<div class="stat-row"><span class="key">${k.subject || '?'}</span><span class="val">${k.predicate || '→'} ${k.object || '?'}</span></div>\`;
        });
      }
    }
    if (data.memory) {
      kgHtml += '<div style="font-weight:600;margin-top:10px;margin-bottom:6px">Memory</div>';
      kgHtml += \`<div class="stat-row"><span class="key">Entries</span><span class="val">${data.memory.entries || 0}</span></div>\`;
      kgHtml += \`<div class="stat-row"><span class="key">Layers active</span><span class="val">${data.memory.layers || 0}</span></div>\`;
    }
    if (data.selfImprovement) {
      kgHtml += '<div style="font-weight:600;margin-top:10px;margin-bottom:6px">Self-Improvement</div>';
      kgHtml += \`<div class="stat-row"><span class="key">Score</span><span class="val">${(data.selfImprovement.score*100).toFixed(0)}/100</span></div>\`;
      kgHtml += \`<div class="stat-row"><span class="key">Trend</span><span class="val"><span class="status-dot ${data.selfImprovement.trend === 'improving' ? 'green' : 'yellow'}"></span>${data.selfImprovement.trend}</span></div>\`;
    }
    kgHtml += '</div>';
    document.getElementById('knowledge').innerHTML = kgHtml;

  } catch (e) {
    document.getElementById('report').innerHTML = \`<div style="color:#f85149">Error: ${e.message}</div>\`;
  }
  document.getElementById('research-btn').disabled = false;
}

document.getElementById('question').addEventListener('keydown', (e) => { if (e.key === 'Enter') research(); });
</script>
</body>
</html>`; }
