/**
 * The one shape the story page understands, whether the transaction is the
 * built-in demo (computed at build time) or one the reader pasted (fetched
 * and evaluated in the browser). Satoshi amounts travel as strings so the
 * object survives JSON.
 */
import { binToHex, disassembleBytecodeBCH, type Transaction } from "@bitauth/libauth";

export interface TraceStep {
  /** which script is running: the input's unlocking script, the coin's locking script, or a P2SH redeem script */
  phase: "unlock" | "lock" | "redeem";
  /** opcode about to run, or "done" for the terminal state */
  op: string;
  /** stack after this op ran (top of stack last), hex */
  stack: string[];
  ok: boolean;
  error?: string;
}

export interface ByteRange {
  name: string;
  start: number;
  end: number;
}

export interface TxInput {
  txid: string;
  vout: number;
  sats: string;
  address: string;
  unlockAsm: string;
  lockAsm: string;
}

export interface TxOutput {
  address: string;
  sats: string;
  /** payment / change (demo, or an output back to an input address) / output */
  kind: "payment" | "change" | "output";
  token?: { category: string; amount: string; nft: boolean; capability?: string };
}

export interface TxData {
  mode: "demo" | "live";
  txid: string;
  hex: string;
  bytes: number;
  version: number;
  locktime: number;
  inputs: TxInput[];
  outputs: TxOutput[];
  inSum: string;
  outSum: string;
  feeSats: string;
  feeRate: number;
  /** input 0's signature / pubkey / pubkey-hash when it is a plain P2PKH spend, else "" */
  signature: string;
  pubkey: string;
  pkh: string;
  sighash: string;
  trace: TraceStep[];
  valid: boolean;
  vmNote: string;
  ranges: ByteRange[];
  /** null when unconfirmed or unknown */
  confirmations: number | null;
  height: number | null;
  blockhash: string | null;
  blocktime: number | null;
  tip: number | null;
}

/** Byte offsets of every field in the serialized transaction (for the raw lens). */
export function layoutRanges(tx: Transaction): ByteRange[] {
  const r: ByteRange[] = [];
  let p = 0;
  const push = (name: string, len: number) => {
    r.push({ name, start: p, end: p + len });
    p += len;
  };
  const varintLen = (n: number) => (n < 0xfd ? 1 : n <= 0xffff ? 3 : n <= 0xffffffff ? 5 : 9);
  push("version", 4);
  push("input count", varintLen(tx.inputs.length));
  tx.inputs.forEach((i, n) => {
    push(`in${n}.outpoint txid`, 32);
    push(`in${n}.outpoint index`, 4);
    push(`in${n}.script length`, varintLen(i.unlockingBytecode.length));
    const u = i.unlockingBytecode;
    // a plain P2PKH unlock is <push sig><push pubkey>; split it so the raw lens can point at each
    const sigLen = u[0];
    if (u.length > 2 && sigLen >= 64 && sigLen <= 73 && u[1 + sigLen] === 33 && u.length === 2 + sigLen + 33) {
      push(`in${n}.signature`, 1 + sigLen);
      push(`in${n}.pubkey`, 34);
    } else {
      push(`in${n}.unlocking script`, u.length);
    }
    push(`in${n}.sequence`, 4);
  });
  push("output count", varintLen(tx.outputs.length));
  tx.outputs.forEach((o, n) => {
    const len = o.lockingBytecode.length + (o.token ? tokenPrefixLength(o) : 0);
    push(`out${n}.value`, 8);
    push(`out${n}.script length`, varintLen(len));
    push(`out${n}.locking script`, len);
  });
  push("locktime", 4);
  return r;
}

/** Length of the CashTokens prefix that precedes a token-carrying locking script on the wire. */
function tokenPrefixLength(o: Transaction["outputs"][number]): number {
  const t = o.token;
  if (!t) return 0;
  let n = 1 + 32 + 1; // PREFIX_TOKEN, category, bitfield
  if (t.nft) {
    const c = t.nft.commitment.length;
    if (c > 0) n += (c < 0xfd ? 1 : 3) + c;
  }
  if (t.amount > 0n) {
    const a = t.amount;
    n += a < 0xfdn ? 1 : a <= 0xffffn ? 3 : a <= 0xffffffffn ? 5 : 9;
  }
  return n;
}

/**
 * Collapse Libauth's debug states into one entry per instruction. A new
 * phase begins whenever the instruction pointer resets to the start of a
 * different program (unlocking script → locking script → P2SH redeem script).
 */
export function traceFromStates(states: { ip: number; instructions: { opcode: number }[]; stack: Uint8Array[]; error?: string }[]): TraceStep[] {
  const phases: TraceStep["phase"][] = ["unlock", "lock", "redeem"];
  const trace: TraceStep[] = [];
  let phaseIx = 0;
  let prevIp = -1;
  let lastKey = "";
  for (const s of states) {
    // the instruction pointer only ever moves backwards when a new program starts
    if (prevIp >= 0 && s.ip < prevIp) phaseIx = Math.min(phaseIx + 1, phases.length - 1);
    prevIp = s.ip;
    const ins = s.instructions[s.ip];
    const op = ins ? disassembleBytecodeBCH(new Uint8Array([ins.opcode])).split(" ")[0] : "done";
    const key = `${phaseIx}:${s.ip}:${op}`;
    if (key === lastKey) continue;
    lastKey = key;
    trace.push({ phase: phases[phaseIx], op, stack: s.stack.map(binToHex), ok: !s.error, error: s.error });
  }
  // each program ends in a "done" state; only the final one is the verdict
  return trace.filter((t, i) => t.op !== "done" || i === trace.length - 1);
}

export const fmtSats = (n: bigint | number | string) => Number(n).toLocaleString("en-US");
export const short = (hex: string, n = 8) => (hex.length > n * 2 + 1 ? `${hex.slice(0, n)}…${hex.slice(-n)}` : hex);
export const shortAddr = (a: string) => {
  const body = a.replace(/^(bitcoincash|bchtest|bchreg):/, "");
  return body.length > 16 ? `${body.slice(0, 8)}…${body.slice(-6)}` : body;
};
