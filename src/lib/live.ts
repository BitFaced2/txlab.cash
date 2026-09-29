/**
 * Paste-a-txid: fetch a real mainnet transaction and its parent outputs from
 * an Electrum server, decode both with Libauth, run input 0 through the BCH
 * virtual machine, and hand the page the same shape the demo uses.
 * Loaded lazily; Libauth's WASM only ships to readers who use this.
 */
import {
  binToHex,
  createVirtualMachineBCH,
  decodeTransaction,
  disassembleBytecodeBCH,
  hexToBin,
  lockingBytecodeToCashAddress,
  type Transaction,
} from "@bitauth/libauth";
import { Electrum } from "./electrum";
import { layoutRanges, traceFromStates, type TxData, type TxInput, type TxOutput } from "./txshape";

const TXID_RE = /^[0-9a-fA-F]{64}$/;

export function normalizeTxid(s: string): string | null {
  const t = s.trim().toLowerCase().replace(/^0x/, "");
  return TXID_RE.test(t) ? t : null;
}

function addressOf(lockingBytecode: Uint8Array): string {
  const r = lockingBytecodeToCashAddress({ bytecode: lockingBytecode, prefix: "bitcoincash" });
  if (typeof r === "string") {
    const asm = disassembleBytecodeBCH(lockingBytecode);
    if (asm.startsWith("OP_RETURN")) return "OP_RETURN (data)";
    return `non-standard (${lockingBytecode.length} B)`;
  }
  return r.address;
}

export async function loadLiveTx(txidIn: string, onStatus: (s: string) => void): Promise<TxData> {
  const txid = normalizeTxid(txidIn);
  if (!txid) throw new Error("That is not a transaction id. Expect 64 hex characters.");

  const el = new Electrum();
  await el.connect(onStatus);
  try {
    onStatus("fetching the transaction…");
    const [v, tip] = await Promise.all([el.txVerbose(txid), el.tipHeight()]);
    const encoded = hexToBin(v.hex);
    const decoded = decodeTransaction(encoded);
    if (typeof decoded === "string") throw new Error(`could not decode: ${decoded}`);
    const tx: Transaction = decoded;

    onStatus(`fetching ${tx.inputs.length} parent transaction${tx.inputs.length === 1 ? "" : "s"}…`);
    const parentIds = [...new Set(tx.inputs.map((i) => binToHex(i.outpointTransactionHash)))];
    const isCoinbase = tx.inputs.length === 1 && tx.inputs[0].outpointIndex === 0xffffffff;
    const parents = new Map<string, Transaction>();
    if (!isCoinbase) {
      const hexes = await Promise.all(parentIds.map((id) => el.txHex(id)));
      hexes.forEach((h, k) => {
        const d = decodeTransaction(hexToBin(h));
        if (typeof d === "string") throw new Error(`could not decode parent ${parentIds[k]}`);
        parents.set(parentIds[k], d);
      });
    }

    const sourceOutputs = tx.inputs.map((i) => {
      if (isCoinbase) return { lockingBytecode: new Uint8Array(), valueSatoshis: 0n };
      const pid = binToHex(i.outpointTransactionHash);
      const p = parents.get(pid)!;
      const o = p.outputs[i.outpointIndex];
      if (!o) throw new Error(`parent ${pid} has no output ${i.outpointIndex}`);
      return { lockingBytecode: o.lockingBytecode, valueSatoshis: o.valueSatoshis, token: o.token };
    });

    const inputs: TxInput[] = tx.inputs.map((i, n) => ({
      txid: binToHex(i.outpointTransactionHash),
      vout: i.outpointIndex,
      sats: sourceOutputs[n].valueSatoshis.toString(),
      address: isCoinbase ? "coinbase (new coins)" : addressOf(sourceOutputs[n].lockingBytecode),
      unlockAsm: disassembleBytecodeBCH(i.unlockingBytecode),
      lockAsm: isCoinbase ? "" : disassembleBytecodeBCH(sourceOutputs[n].lockingBytecode),
    }));
    const inputAddrs = new Set(inputs.map((i) => i.address));
    const outputs: TxOutput[] = tx.outputs.map((o) => {
      const address = addressOf(o.lockingBytecode);
      const out: TxOutput = { address, sats: o.valueSatoshis.toString(), kind: inputAddrs.has(address) ? "change" : "output" };
      if (o.token) {
        out.token = {
          category: binToHex(o.token.category.slice().reverse()),
          amount: o.token.amount.toString(),
          nft: !!o.token.nft,
          capability: o.token.nft?.capability,
        };
      }
      return out;
    });
    // the first non-change output is "the payment" for narration purposes
    const firstOut = outputs.find((o) => o.kind === "output" && !o.address.startsWith("OP_RETURN") && !o.address.startsWith("non-standard")) ?? outputs.find((o) => o.kind === "output");
    if (firstOut) firstOut.kind = "payment";

    const inSum = sourceOutputs.reduce((a, s) => a + s.valueSatoshis, 0n);
    const outSum = tx.outputs.reduce((a, o) => a + o.valueSatoshis, 0n);
    const feeSats = isCoinbase ? 0n : inSum - outSum;

    // script evaluation for input 0
    onStatus("running the script VM…");
    let trace = traceFromStates([]);
    let valid = false;
    let vmNote = "";
    if (isCoinbase) {
      vmNote = "This is a coinbase transaction: it has no real input to unlock, so there is no script to run.";
    } else {
      try {
        const vm = createVirtualMachineBCH();
        const states = vm.debug({ inputIndex: 0, sourceOutputs, transaction: tx });
        trace = traceFromStates(states as Parameters<typeof traceFromStates>[0]);
        const verdict = vm.verify({ sourceOutputs, transaction: tx });
        valid = verdict === true;
        if (!valid) vmNote = `Libauth's VM did not accept this transaction under the rules it implements (${typeof verdict === "string" ? verdict : "unknown"}). It is in the chain, so the network accepted it; newer upgrade features may not be modelled here.`;
      } catch (e) {
        vmNote = `The VM could not evaluate this input: ${(e as Error).message}`;
      }
    }

    const u0 = tx.inputs[0]?.unlockingBytecode ?? new Uint8Array();
    const sigLen = u0[0] ?? 0;
    const p2pkh = u0.length > 2 && sigLen >= 64 && sigLen <= 73 && u0[1 + sigLen] === 33 && u0.length === 2 + sigLen + 33;
    const signature = p2pkh ? binToHex(u0.slice(1, 1 + sigLen)) : "";
    const pubkey = p2pkh ? binToHex(u0.slice(2 + sigLen)) : "";
    const lock0 = sourceOutputs[0]?.lockingBytecode ?? new Uint8Array();
    const pkh = lock0.length === 25 && lock0[0] === 0x76 ? binToHex(lock0.slice(3, 23)) : "";

    const confirmations = v.confirmations && v.confirmations > 0 ? v.confirmations : v.blockhash ? 1 : null;
    const height = confirmations ? tip - confirmations + 1 : null;

    return {
      mode: "live",
      txid,
      hex: v.hex,
      bytes: encoded.length,
      version: tx.version,
      locktime: tx.locktime,
      inputs,
      outputs,
      inSum: inSum.toString(),
      outSum: outSum.toString(),
      feeSats: feeSats.toString(),
      feeRate: Number(feeSats) / encoded.length,
      signature,
      pubkey,
      pkh,
      sighash: signature ? signature.slice(-2) : "",
      trace,
      valid,
      vmNote,
      ranges: layoutRanges(tx),
      confirmations,
      height,
      blockhash: v.blockhash ?? null,
      blocktime: v.blocktime ?? v.time ?? null,
      tip,
    };
  } finally {
    el.close();
  }
}
