/* KODA ONLINE: salas de jogo em tempo real (WebSocket + Durable Objects, plano grátis).
   - Cada jogo tem um "Diretorio" que sabe quantas pessoas tem em cada sala.
   - Cada sala é uma "Sala" (máx. 20). Quando uma enche, o Diretorio abre a próxima (Sala 2, 3...).
   - A Sala só repassa as mensagens do jogo a todos (ou a um jogador). Não guarda nada nem lê o conteúdo. */

const MAX_SALA = 20;          // limite duro de pessoas numa sala
const PADRAO_SALA = 16;       // tamanho padrão quando o jogo não pede outro
const MIN_SALA = 2;
const MAX_SALAS_POR_JOGO = 200;
const MAX_MSG = 2000;         // bytes por mensagem
const MSG_POR_SEG = 20;       // por jogador (o site já limita a 10; aqui é a rede de segurança)
const RESERVA_MS = 20000;     // vaga reservada que ninguém ocupou volta sozinha

const limpa = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
/* o personagem de quem entra: só um texto curto "kp1:..." (o site confere e desenha; aqui só repassa) */
const personagem = s => { s = String(s || ''); return /^kp1:[a-z0-9.]{1,400}$/.test(s) ? s : ''; };
const idJogo = s => { s = String(s || ''); return /^[A-Za-z0-9_-]{1,100}$/.test(s) ? s : null; };

function origemOk(req, env) {
  const o = req.headers.get('Origin') || '';
  const lista = String(env.ORIGENS || '').split(',').map(x => x.trim()).filter(Boolean);
  if (lista.includes('*')) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)) return true;
  return lista.includes(o);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/' || url.pathname === '/saude') {
      return new Response(JSON.stringify({ koda_online: true, tudo_certo: true }), { headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
    }
    if (url.pathname !== '/jogar') return new Response('Não achei.', { status: 404 });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Precisa ser WebSocket.', { status: 426 });
    if (!origemOk(req, env)) return new Response('Origem não permitida.', { status: 403 });

    const jogo = idJogo(url.searchParams.get('jogo'));
    if (!jogo) return new Response('Jogo inválido.', { status: 400 });
    const cap = Math.max(MIN_SALA, Math.min(MAX_SALA, parseInt(url.searchParams.get('cap'), 10) || PADRAO_SALA));
    const nome = limpa(url.searchParams.get('nome'), 24) || 'Jogador';
    const quer = parseInt(url.searchParams.get('sala'), 10) || 0;   // voltar pra mesma sala depois de cair

    const dir = env.DIRETORIO.get(env.DIRETORIO.idFromName(jogo));
    const r = await dir.fetch('https://dir/reservar?cap=' + cap + '&quer=' + quer);
    if (!r.ok) return new Response('Sem vaga agora.', { status: 503 });
    const { sala } = await r.json();

    const stub = env.SALA.get(env.SALA.idFromName(jogo + ':' + sala));
    const av = personagem(url.searchParams.get('av'));
    const h = new Request('https://sala/entrar?jogo=' + encodeURIComponent(jogo) + '&sala=' + sala + '&cap=' + cap + '&nome=' + encodeURIComponent(nome) + (av ? '&av=' + encodeURIComponent(av) : ''), req);
    return stub.fetch(h);
  }
};

/* ---------- Diretorio: uma por jogo ---------- */
export class Diretorio {
  constructor(state) {
    this.state = state;
    this.salas = null;   // { "1": {n: 3, pend: [timestamps]} }
  }
  async carregar() {
    if (!this.salas) this.salas = (await this.state.storage.get('salas')) || {};
  }
  efetivo(s) {
    const agora = Date.now();
    s.pend = (s.pend || []).filter(t => agora - t < RESERVA_MS);
    return (s.n || 0) + s.pend.length;
  }
  async fetch(req) {
    await this.carregar();
    const url = new URL(req.url);
    const cap = Math.max(MIN_SALA, Math.min(MAX_SALA, parseInt(url.searchParams.get('cap'), 10) || PADRAO_SALA));

    if (url.pathname === '/reservar') {
      const quer = parseInt(url.searchParams.get('quer'), 10) || 0;
      let escolhida = 0;
      if (quer > 0 && this.salas[quer] && this.efetivo(this.salas[quer]) < cap) escolhida = quer;
      if (!escolhida) {
        const nums = Object.keys(this.salas).map(Number).sort((a, b) => a - b);
        for (const k of nums) { if (this.efetivo(this.salas[k]) < cap) { escolhida = k; break; } }
      }
      if (!escolhida) {
        for (let k = 1; k <= MAX_SALAS_POR_JOGO; k++) { if (!this.salas[k]) { escolhida = k; break; } }
      }
      if (!escolhida) return new Response('cheio', { status: 503 });
      const s = this.salas[escolhida] || (this.salas[escolhida] = { n: 0, pend: [] });
      this.efetivo(s);
      s.pend.push(Date.now());
      await this.state.storage.put('salas', this.salas);
      return Response.json({ sala: escolhida });
    }

    if (url.pathname === '/contagem') {   // a Sala avisa quantas pessoas tem de verdade
      const k = parseInt(url.searchParams.get('sala'), 10);
      const n = Math.max(0, parseInt(url.searchParams.get('n'), 10) || 0);
      const entrou = url.searchParams.get('entrou') === '1';
      if (!k) return new Response('ok');
      const s = this.salas[k] || (this.salas[k] = { n: 0, pend: [] });
      s.n = n;
      if (entrou) s.pend.shift();
      this.efetivo(s);
      if (s.n === 0 && !s.pend.length) delete this.salas[k];   // sala vazia some da lista (e o número volta a ficar livre)
      await this.state.storage.put('salas', this.salas);
      return new Response('ok');
    }
    return new Response('?', { status: 404 });
  }
}

/* ---------- Sala: uma por (jogo, número) ---------- */
export class Sala {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }
  jogadores() {
    return this.state.getWebSockets().map(ws => ws.deserializeAttachment()).filter(Boolean).map(a => ({ id: a.id, nome: a.nome, av: a.av || '' }));
  }
  avisarDiretorio(jogo, sala, entrou) {
    const n = this.state.getWebSockets().length;
    const dir = this.env.DIRETORIO.get(this.env.DIRETORIO.idFromName(jogo));
    return dir.fetch('https://dir/contagem?sala=' + sala + '&n=' + n + '&entrou=' + (entrou ? 1 : 0)).catch(() => {});
  }
  transmitir(obj, menos) {
    const txt = JSON.stringify(obj);
    for (const ws of this.state.getWebSockets()) {
      if (menos && ws === menos) continue;
      try { ws.send(txt); } catch (e) {}
    }
  }
  async fetch(req) {
    const url = new URL(req.url);
    const jogo = url.searchParams.get('jogo');
    const sala = parseInt(url.searchParams.get('sala'), 10);
    const cap = Math.max(MIN_SALA, Math.min(MAX_SALA, parseInt(url.searchParams.get('cap'), 10) || PADRAO_SALA));
    const nome = limpa(url.searchParams.get('nome'), 24) || 'Jogador';
    const av = personagem(url.searchParams.get('av'));

    const par = new WebSocketPair();
    const [cliente, servidor] = Object.values(par);
    if (this.state.getWebSockets().length >= Math.min(cap, MAX_SALA)) {
      this.state.acceptWebSocket(servidor);
      servidor.send(JSON.stringify({ t: 'cheia' }));
      servidor.close(1013, 'sala cheia');
      return new Response(null, { status: 101, webSocket: cliente });
    }
    const id = crypto.randomUUID().slice(0, 8);
    this.state.acceptWebSocket(servidor);
    servidor.serializeAttachment({ id, nome, av, jogo, sala, t: Date.now(), c: 0 });
    servidor.send(JSON.stringify({ t: 'oi', eu: id, sala, cap, jogadores: this.jogadores() }));
    this.transmitir({ t: 'entrou', id, nome, av }, servidor);
    await this.avisarDiretorio(jogo, sala, true);
    return new Response(null, { status: 101, webSocket: cliente });
  }
  async webSocketMessage(ws, msg) {
    const a = ws.deserializeAttachment();
    if (!a || typeof msg !== 'string' || msg.length > MAX_MSG) return;
    /* limite por segundo (balde simples guardado junto da conexão) */
    const seg = Math.floor(Date.now() / 1000);
    if (a.s !== seg) { a.s = seg; a.c = 0; }
    if (++a.c > MSG_POR_SEG) { ws.serializeAttachment(a); return; }
    ws.serializeAttachment(a);
    let m; try { m = JSON.parse(msg); } catch (e) { return; }
    if (!m || m.t !== 'msg') return;
    const saida = JSON.stringify({ t: 'msg', de: a.id, d: m.d });
    if (saida.length > MAX_MSG + 40) return;
    if (m.para) {
      for (const outro of this.state.getWebSockets()) {
        const b = outro.deserializeAttachment();
        if (b && b.id === m.para) { try { outro.send(saida); } catch (e) {} }
      }
      return;
    }
    for (const outro of this.state.getWebSockets()) { if (outro !== ws) { try { outro.send(saida); } catch (e) {} } }
  }
  async sair(ws) {
    const a = ws.deserializeAttachment();
    if (!a) return;
    ws.serializeAttachment(null);   // já saiu: não conta de novo
    const restantes = this.state.getWebSockets().filter(w => w !== ws && w.deserializeAttachment());
    const txt = JSON.stringify({ t: 'saiu', id: a.id });
    for (const w of restantes) { try { w.send(txt); } catch (e) {} }
    const dir = this.env.DIRETORIO.get(this.env.DIRETORIO.idFromName(a.jogo));
    await dir.fetch('https://dir/contagem?sala=' + a.sala + '&n=' + restantes.length).catch(() => {});
  }
  async webSocketClose(ws) { await this.sair(ws); }
  async webSocketError(ws) { await this.sair(ws); }
}
