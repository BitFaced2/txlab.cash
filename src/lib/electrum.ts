/**
 * Minimal Electrum-protocol client over secure WebSocket. Public Fulcrum
 * servers speak this to wallets, so no API key and no CORS trouble. We try
 * several servers and keep the first that answers.
 */
const SERVERS = [
  "wss://bch.imaginary.cash:50004",
  "wss://fulcrum.jettscythe.xyz:50004",
  "wss://bch.soul-dev.com:50004",
  "wss://blackie.c3-soft.com:50004",
  "wss://electrum.imaginary.cash:50004",
  "wss://electroncash.dk:50004",
  "wss://bch.loping.net:50004",
];

export interface VerboseTx {
  hex: string;
  txid: string;
  confirmations?: number;
  blockhash?: string;
  blocktime?: number;
  time?: number;
}

export class Electrum {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<number, { res: (v: unknown) => void; rej: (e: Error) => void; timer: number }>();
  url = "";

  async connect(onStatus?: (s: string) => void): Promise<void> {
    let lastErr: Error | null = null;
    for (const url of SERVERS) {
      onStatus?.(`connecting to ${url.replace("wss://", "").replace(":50004", "")}…`);
      try {
        await this.open(url);
        await this.call("server.version", ["txlab.cash", "1.4"]);
        this.url = url;
        return;
      } catch (e) {
        lastErr = e as Error;
        this.ws?.close();
        this.ws = null;
      }
    }
    throw lastErr ?? new Error("no Electrum server reachable");
  }

  private open(url: string): Promise<void> {
    return new Promise((res, rej) => {
      const ws = new WebSocket(url);
      const timer = setTimeout(() => { ws.close(); rej(new Error("connect timeout")); }, 8000);
      ws.onopen = () => { clearTimeout(timer); res(); };
      ws.onerror = () => { clearTimeout(timer); rej(new Error("connect failed")); };
      ws.onmessage = (ev) => this.onMessage(ev);
      ws.onclose = () => {
        for (const p of this.pending.values()) { clearTimeout(p.timer); p.rej(new Error("connection closed")); }
        this.pending.clear();
      };
      this.ws = ws;
    });
  }

  private onMessage(ev: MessageEvent) {
    let m: { id?: number; result?: unknown; error?: { message?: string } | string };
    try { m = JSON.parse(String(ev.data)); } catch { return; }
    if (m.id === undefined) return;
    const p = this.pending.get(m.id);
    if (!p) return;
    this.pending.delete(m.id);
    clearTimeout(p.timer);
    if (m.error) p.rej(new Error(typeof m.error === "string" ? m.error : m.error.message ?? "server error"));
    else p.res(m.result);
  }

  call<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
    return new Promise((res, rej) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return rej(new Error("not connected"));
      const id = this.nextId++;
      const timer = setTimeout(() => { this.pending.delete(id); rej(new Error(`timeout: ${method}`)); }, 15000);
      this.pending.set(id, { res: res as (v: unknown) => void, rej, timer });
      this.ws.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
    });
  }

  tipHeight() {
    return this.call<{ height: number }>("blockchain.headers.subscribe").then((h) => h.height);
  }
  txVerbose(txid: string) {
    return this.call<VerboseTx>("blockchain.transaction.get", [txid, true]);
  }
  txHex(txid: string) {
    return this.call<string>("blockchain.transaction.get", [txid, false]);
  }
  close() {
    this.ws?.close();
    this.ws = null;
  }
}
