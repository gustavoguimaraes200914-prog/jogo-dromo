/* KODA GB — SERVIDOR: o ÍNDICE (uid -> e-mail) e o VIGIA (avisos pro dono)
   Indice: um por conta do Firebase (pelo uid). O link de convite e as peças de roupa usam o uid, a carteira usa o
   e-mail. Se alguém comprar a roupa de quem ainda não entrou no site novo, o valor fica guardado aqui até a pessoa
   entrar.
   Vigia: um só pro site inteiro. Guarda os últimos avisos de coisas estranhas (saldo cortado na primeira vez,
   movimento recusado grande, pontuação suspeita) pro dono ver no painel. */
import { DurableObject } from 'cloudflare:workers';
import { limpaEmail, emailOk, obj } from './util.js';
import * as Aprendiz from './aprendiz.js';

export class Indice extends DurableObject {
  async registrar(email) {
    email = limpaEmail(email);
    if (!emailOk(email)) return { ok: false };
    await this.ctx.storage.put('email', email);
    const pendentes = (await this.ctx.storage.get('pend')) || [];
    if (pendentes.length) await this.ctx.storage.delete('pend');
    return { ok: true, pendentes };
  }
  async email() { return (await this.ctx.storage.get('email')) || null; }
  async entregar(msg) {
    const email = await this.ctx.storage.get('email');
    if (email) return this.env.CONTA.get(this.env.CONTA.idFromName('e:' + email)).receber(msg);
    const pend = (await this.ctx.storage.get('pend')) || [];
    if (pend.length >= 300) return { ok: false };
    pend.push(msg);
    await this.ctx.storage.put('pend', pend);
    return { ok: true, guardado: true };
  }
  /* A PASSAGEM: guichê temporário da mudança de endereço (koda.gamersite.workers.dev -> kodagb.com).
     Cada endereço do navegador tem o seu cofre; pra levar o login e os dados de um pro outro, o aparelho deixa aqui um pacote
     JÁ CRIPTOGRAFADO (a chave só vai no endereço, depois do #, e nunca chega no servidor), pega do outro lado e o pacote some.
     Cada pacote usa um Indice só dele (nome "passagem:<id>"). Vale 10 minutos e só dá pra pegar uma vez. */
  async guardarPassagem(texto) {
    texto = String(texto || '');
    if (!texto || texto.length > 4200000) return { ok: false };
    const o = {};
    let n = 0;
    for (let i = 0; i < texto.length; i += 100000) o['p' + n++] = texto.slice(i, i + 100000);
    o.n = n; o.t = Date.now();
    await this.ctx.storage.deleteAll();
    await this.ctx.storage.put(o);
    await this.ctx.storage.setAlarm(Date.now() + 10 * 60 * 1000);
    return { ok: true };
  }
  async pegarPassagem() {
    const n = await this.ctx.storage.get('n'), t = await this.ctx.storage.get('t');
    if (!n || !t || Date.now() - t > 10 * 60 * 1000) { await this.ctx.storage.deleteAll(); return { ok: false }; }
    const ks = []; for (let i = 0; i < n; i++) ks.push('p' + i);
    const m = await this.ctx.storage.get(ks);
    let texto = ''; for (const k of ks) texto += m.get(k) || '';
    await this.ctx.storage.deleteAll();
    return { ok: true, texto };
  }
  async alarm() { await this.ctx.storage.deleteAll(); }
}

export class Vigia extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS alerta (s INTEGER PRIMARY KEY AUTOINCREMENT, t INTEGER, email TEXT, tipo TEXT, info TEXT)');
  }
  async alerta(o) {
    o = obj(o) || {};
    this.sql.exec('INSERT INTO alerta (t, email, tipo, info) VALUES (?, ?, ?, ?)', Number(o.t) || Date.now(),
      String(o.email || '').slice(0, 200), String(o.tipo || '').slice(0, 40), JSON.stringify(o.info || {}).slice(0, 1500));
    if (Math.random() < 0.05) this.sql.exec('DELETE FROM alerta WHERE s < (SELECT MAX(s) - 2000 FROM alerta)');
    return { ok: true };
  }
  /* a instância "agente": o Agente Koda GB aprendendo com os erros de todo mundo (ver aprendiz.js) */
  async agErros(conta, eventos) { return Aprendiz.receberErros(this.sql, conta, eventos); }
  async agRegras() { return Aprendiz.regras(this.sql); }
  async agLista(n) { return Aprendiz.lista(this.sql, n); }
  async agAdmin(acao, d) { return Aprendiz.admin(this.sql, acao, d); }
  async lista(n) {
    const rows = this.sql.exec('SELECT s, t, email, tipo, info FROM alerta ORDER BY s DESC LIMIT ?', Math.min(500, Math.max(1, Number(n) || 100))).toArray();
    return rows.map(r => { let info = {}; try { info = JSON.parse(r.info); } catch (e) {} return { s: r.s, t: r.t, email: r.email, tipo: r.tipo, info }; });
  }
}
