/**
 * Page controller. Takes a TxData (the demo at first, a pasted transaction
 * later) and renders everything that depends on it: the prose fragments
 * marked data-v, the fact boxes marked data-fact, the stage labels, the
 * opcode cards, the stack-machine panel, the hex drawer, and the scroll
 * engine itself.
 */
import { expandSteps, setStepHx, startEngine, type Resolved } from "./story";
import type { TraceStep, TxData } from "./txshape";
import { fmtSats, short, shortAddr, words } from "./fmt";

const SVG = "http://www.w3.org/2000/svg";
const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string) => Array.from(document.querySelectorAll<T>(sel));
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const asm = (s: string) => s.replace(/0x[0-9a-f]{20,}/g, (m) => short(m, 6));

let data: TxData;
let engine: ReturnType<typeof startEngine> | null = null;

/* ═══════════════════════ narration for opcodes ═══════════════════════ */

interface OpStory { title: string; voice: string; tech: string }

const P2PKH: Record<string, OpStory> = {
  "unlock:sig": {
    title: "My unlocking script speaks first",
    voice: "The first thing I do is put my signature on the table. A signature plus one byte saying which parts of me it covers.",
    tech: "Input 0's unlocking script (scriptSig) runs first, with an empty stack. Its only job is to push data. The final byte of the signature is the sighash type; 0x41 means SIGHASH_ALL (0x01) | SIGHASH_FORKID (0x40).",
  },
  "unlock:pub": {
    title: "…and then my public key",
    voice: "Next, my public key. Anyone can see it now. That is fine: a public key on its own spends nothing.",
    tech: "A 33-byte compressed secp256k1 public key. After this push the unlocking script is finished. The stack it leaves behind is handed to the coin's locking script.",
  },
  "lock:OP_DUP": {
    title: "The coin's locking script takes over",
    voice: "Now the coin I am spending gets its turn. It was locked by the wallet that received it, with a tiny program. The first instruction copies my public key.",
    tech: "Locking script (scriptPubKey) of the UTXO being spent: OP_DUP OP_HASH160 <pubkeyhash> OP_EQUALVERIFY OP_CHECKSIG. OP_DUP duplicates the top stack item, the public key, so one copy can be hashed and one kept for the signature check.",
  },
  "lock:OP_HASH160": {
    title: "Hash the copy",
    voice: "The copy goes through two hash functions and comes out as twenty bytes. This is what a Bitcoin Cash address really is underneath: a hash of a public key.",
    tech: "OP_HASH160 = RIPEMD-160(SHA-256(x)). The result is the public key hash (PKH) that the cashaddr encodes.",
  },
  "lock:OP_PUSHBYTES_20": {
    title: "The coin says who it belongs to",
    voice: "The coin pushes the hash it was locked to when it was created. If I am really the owner, this should look exactly like the hash we just computed.",
    tech: "The 20-byte PKH baked into the locking script at the time the coin was created. This is the only identity the coin knows.",
  },
  "lock:OP_EQUALVERIFY": {
    title: "Do they match?",
    voice: "Two hashes, side by side. If they differ, the node stops right here and I am rejected. They match. Both are consumed, and the stack is back to my signature and my key.",
    tech: "OP_EQUALVERIFY pops two items, fails the script if they are not byte-equal, and otherwise continues without pushing anything. This proves the pushed public key is the one the coin was locked to.",
  },
  "lock:OP_CHECKSIG": {
    title: "The moment",
    voice: "Now the real question: was my signature made by the private key behind that public key, over me, exactly as I am? The node checks the math itself. It trusts no one.",
    tech: "OP_CHECKSIG pops the public key and signature, rebuilds the signing serialization (BIP143-style, with the fork id), hashes it, and verifies the signature. Any altered byte in the transaction makes this fail.",
  },
  done: {
    title: "One item left: true",
    voice: "The script ends with a single truthy value on the stack. That is the whole test. The node runs the same check for every other input, and then I have passed check three.",
    tech: "A script succeeds when execution finishes without error and the top stack item is truthy. Libauth's VM verified this transaction end to end; the same rules run in BCHN.",
  },
};

/** Plain-language one-liners for opcodes outside the P2PKH path. */
const GENERIC: Record<string, string> = {
  OP_0: "pushes an empty item (false).", OP_1NEGATE: "pushes the number −1.",
  OP_PUSHDATA1: "pushes a longer chunk of data.", OP_PUSHDATA2: "pushes a longer chunk of data.", OP_PUSHDATA4: "pushes a longer chunk of data.",
  OP_NOP: "does nothing.", OP_IF: "starts a branch: runs the next section only if the top item is true.", OP_NOTIF: "starts a branch: runs the next section only if the top item is false.",
  OP_ELSE: "switches to the other branch.", OP_ENDIF: "ends the branch.", OP_VERIFY: "fails the script unless the top item is true.", OP_RETURN: "marks this output as unspendable data.",
  OP_TOALTSTACK: "moves the top item to the side stack.", OP_FROMALTSTACK: "brings an item back from the side stack.",
  OP_DROP: "throws the top item away.", OP_2DROP: "throws the top two items away.", OP_DUP: "duplicates the top item.", OP_2DUP: "duplicates the top two items.", OP_3DUP: "duplicates the top three items.",
  OP_IFDUP: "duplicates the top item if it is true.", OP_DEPTH: "pushes how many items are on the stack.", OP_NIP: "removes the second item.", OP_OVER: "copies the second item to the top.",
  OP_PICK: "copies the n-th item to the top.", OP_ROLL: "moves the n-th item to the top.", OP_ROT: "rotates the top three items.", OP_SWAP: "swaps the top two items.", OP_TUCK: "copies the top item below the second.",
  OP_2OVER: "copies the third and fourth items to the top.", OP_2ROT: "moves the fifth and sixth items to the top.", OP_2SWAP: "swaps the top two pairs.",
  OP_CAT: "joins the top two items into one.", OP_SPLIT: "splits an item at a position.", OP_NUM2BIN: "resizes a number to a fixed byte length.", OP_BIN2NUM: "converts bytes to a minimal number.",
  OP_SIZE: "pushes the length of the top item.", OP_REVERSEBYTES: "reverses the bytes of the top item.",
  OP_AND: "bitwise AND of the top two items.", OP_OR: "bitwise OR of the top two items.", OP_XOR: "bitwise XOR of the top two items.",
  OP_EQUAL: "compares the top two items and pushes true or false.", OP_EQUALVERIFY: "compares the top two items and fails unless they match.",
  OP_1ADD: "adds one.", OP_1SUB: "subtracts one.", OP_NEGATE: "negates the number.", OP_ABS: "takes the absolute value.", OP_NOT: "flips true to false and back.", OP_0NOTEQUAL: "pushes true if the number is not zero.",
  OP_ADD: "adds the top two numbers.", OP_SUB: "subtracts the top two numbers.", OP_MUL: "multiplies the top two numbers.", OP_DIV: "divides the top two numbers.", OP_MOD: "takes the remainder.",
  OP_BOOLAND: "logical AND.", OP_BOOLOR: "logical OR.", OP_NUMEQUAL: "pushes true if the two numbers are equal.", OP_NUMEQUALVERIFY: "fails unless the two numbers are equal.", OP_NUMNOTEQUAL: "pushes true if the two numbers differ.",
  OP_LESSTHAN: "compares two numbers (<).", OP_GREATERTHAN: "compares two numbers (>).", OP_LESSTHANOREQUAL: "compares two numbers (≤).", OP_GREATERTHANOREQUAL: "compares two numbers (≥).",
  OP_MIN: "keeps the smaller number.", OP_MAX: "keeps the larger number.", OP_WITHIN: "checks a number is inside a range.",
  OP_RIPEMD160: "hashes the top item with RIPEMD-160.", OP_SHA1: "hashes the top item with SHA-1.", OP_SHA256: "hashes the top item with SHA-256.", OP_HASH160: "hashes the top item with SHA-256 then RIPEMD-160.", OP_HASH256: "hashes the top item with SHA-256 twice.",
  OP_CODESEPARATOR: "marks where signature coverage of the script starts.",
  OP_CHECKSIG: "verifies a signature against a public key and this transaction.", OP_CHECKSIGVERIFY: "verifies a signature and fails if it is bad.",
  OP_CHECKMULTISIG: "verifies several signatures against several public keys (m-of-n).", OP_CHECKMULTISIGVERIFY: "verifies m-of-n signatures and fails if they are bad.",
  OP_CHECKDATASIG: "verifies a signature over an arbitrary message (an oracle check).", OP_CHECKDATASIGVERIFY: "verifies a signature over a message and fails if it is bad.",
  OP_CHECKLOCKTIMEVERIFY: "fails unless the transaction's locktime is at least this value: a time lock.", OP_CHECKSEQUENCEVERIFY: "fails unless the input's sequence encodes at least this relative age.",
  OP_INPUTINDEX: "pushes which input is being evaluated (native introspection).", OP_ACTIVEBYTECODE: "pushes the script being evaluated.", OP_TXVERSION: "pushes the transaction version.",
  OP_TXINPUTCOUNT: "pushes the number of inputs.", OP_TXOUTPUTCOUNT: "pushes the number of outputs.", OP_TXLOCKTIME: "pushes the transaction locktime.",
  OP_UTXOVALUE: "pushes the value of a coin being spent.", OP_UTXOBYTECODE: "pushes the locking script of a coin being spent.", OP_OUTPOINTTXHASH: "pushes the txid an input spends from.", OP_OUTPOINTINDEX: "pushes the output index an input spends from.",
  OP_INPUTBYTECODE: "pushes an input's unlocking script.", OP_INPUTSEQUENCENUMBER: "pushes an input's sequence number.", OP_OUTPUTVALUE: "pushes an output's value.", OP_OUTPUTBYTECODE: "pushes an output's locking script.",
  OP_UTXOTOKENCATEGORY: "pushes the token category of a coin being spent.", OP_UTXOTOKENCOMMITMENT: "pushes the NFT commitment of a coin being spent.", OP_UTXOTOKENAMOUNT: "pushes the token amount of a coin being spent.",
  OP_OUTPUTTOKENCATEGORY: "pushes an output's token category.", OP_OUTPUTTOKENCOMMITMENT: "pushes an output's NFT commitment.", OP_OUTPUTTOKENAMOUNT: "pushes an output's token amount.",
};

function narrate(step: TraceStep, i: number, trace: TraceStep[], d: TxData): OpStory {
  const isP2pkh = d.pkh !== "" && d.signature !== "";
  if (step.op === "done") {
    if (!step.ok) return { title: "The script failed", voice: "The VM stopped with an error here. The network did not stop, so this is a limit of the model on this page, not of the transaction.", tech: step.error ?? "unknown error" };
    return P2PKH.done;
  }
  const idxInPhase = trace.slice(0, i).filter((s) => s.phase === step.phase).length;
  if (step.phase === "unlock" && step.op.startsWith("OP_PUSH")) {
    if (isP2pkh && idxInPhase === 0) return P2PKH["unlock:sig"];
    if (isP2pkh && idxInPhase === 1) return P2PKH["unlock:pub"];
    return { title: idxInPhase === 0 ? "My unlocking script speaks first" : "Another push", voice: `My unlocking script pushes ${step.stack.length ? `${step.stack[step.stack.length - 1].length / 2} bytes` : "data"} onto the stack. Unlocking scripts only push; the coin's script decides what it all means.`, tech: `Push ${idxInPhase + 1} of the unlocking script. For a P2SH spend the final push is the redeem script itself, which the node then runs as a third phase.` };
  }
  if (step.phase === "lock" && isP2pkh && P2PKH[`lock:${step.op}`]) {
    // only tell the P2PKH story when the lock really is the standard 5-op template
    const lockOps = trace.filter((s) => s.phase === "lock" && s.op !== "done").map((s) => s.op).join(" ");
    if (lockOps === "OP_DUP OP_HASH160 OP_PUSHBYTES_20 OP_EQUALVERIFY OP_CHECKSIG") return P2PKH[`lock:${step.op}`];
  }
  const phaseName = step.phase === "lock" ? "the coin's locking script" : step.phase === "redeem" ? "the redeem script" : "my unlocking script";
  const first = idxInPhase === 0;
  const desc = GENERIC[step.op] ?? (step.op.startsWith("OP_PUSHBYTES_") ? `pushes ${step.op.slice(13)} bytes of data.` : /^OP_(\d+)$/.test(step.op) ? `pushes the number ${step.op.slice(3)}.` : "runs.");
  return {
    title: first ? `${phaseName[0].toUpperCase()}${phaseName.slice(1)} begins` : `${step.op}`,
    voice: `${first ? `Now ${phaseName} runs. ` : ""}${step.op} ${desc}`,
    tech: `${step.op} ${desc} Stack depth after: ${step.stack.length}.`,
  };
}

/* ═══════════════════════ values for the prose ═══════════════════════ */

function pick(d: TxData) {
  const pay = d.outputs.find((o) => o.kind === "payment") ?? d.outputs[0];
  const chg = d.outputs.find((o) => o.kind === "change");
  const second = chg ?? d.outputs.find((o) => o !== pay);
  const isCoinbase = d.inputs.length === 1 && d.inputs[0].vout === 0xffffffff;
  return { pay, chg, second, isCoinbase, live: d.mode === "live" };
}

function who(o: TxData["outputs"][number], live: boolean) {
  if (o.address.startsWith("OP_RETURN")) return "the chain itself, as a note";
  return live ? shortAddr(o.address) : "the coffee shop";
}

function values(d: TxData): Record<string, string> {
  const { pay, chg, isCoinbase, live } = pick(d);
  const n = d.inputs.length;
  const m = d.outputs.length;
  const rate = d.feeRate;
  const conf = d.confirmations;
  const rateWords = !live ? "a hair over one satoshi per byte, which is the going rate on Bitcoin Cash, and has been for years"
    : rate < 0.99 ? "below the classic one satoshi per byte floor, which a growing share of nodes now accept"
    : rate < 1.6 ? "about one satoshi per byte, the going rate on Bitcoin Cash for years"
    : rate < 5 ? "comfortably above the one satoshi per byte floor" : "far above the floor; the wallet was generous, or in a hurry it did not need to be in";
  const inputsProse = isCoinbase
    ? "no coins at all. I am a coinbase transaction, the miner's own reward, and I am allowed to appear from nothing"
    : n === 1 ? `one coin from the shelf, worth ${fmtSats(d.inputs[0].sats)} sats, and pours it into me entirely`
    : n === 2 ? `two coins from the shelf, one worth ${fmtSats(d.inputs[0].sats)} sats and one worth ${fmtSats(d.inputs[1].sats)}, and pours both into me entirely`
    : `${words(n)} coins from the shelf, ${fmtSats(d.inputs[0].sats)} and ${fmtSats(d.inputs[1].sats)} sats among them (${fmtSats(d.inSum)} sats in all), and pours every one into me entirely`;
  const outParts = d.outputs.slice(0, 4).map((o) => o === pay && !isCoinbase ? `${fmtSats(o.sats)} sats for ${who(o, live)}`
    : o.kind === "change" ? `${fmtSats(o.sats)} sats of change back to my owner`
    : o.address.startsWith("OP_RETURN") ? "a small data note that no one can spend"
    : `${fmtSats(o.sats)} sats to ${shortAddr(o.address)}`);
  const outputsProse = (m > 4 ? [...outParts, `and ${m - 4} more`] : outParts).join(m > 2 ? "; " : ", and ");
  const utxoProse = n === 1 ? "the one I claim to be spending. It is there, unspent" : n === 2 ? "the two I claim to be spending. Both are there, both unspent" : `the ${words(n)} I claim to be spending. All there, all unspent`;
  const feeProse = isCoinbase ? "I am the coinbase, so I pay no fee at all; I collect everyone else's" : `I am ${fmtSats(d.bytes)} bytes and I left ${fmtSats(d.feeSats)} sats unclaimed. That is ${rateWords}`;
  const slot = sortedSlot(d.txid);
  const ctorProse = `My name starts with ${d.txid.slice(0, 2)}, so I am ${slot.index === 0 ? "right behind the coinbase, at the front" : slot.index === 5 ? "at the very back of the line" : "somewhere in the middle"}`;
  const heightStr = d.height ? `#${d.height.toLocaleString("en-US")}` : "a block that has not been found yet";
  const bornProse = isCoinbase ? "The miner's reward is a coin now, waiting out its 100-block maturity."
    : [pay ? `${fmtSats(pay.sats)} sats sit on ${live ? `the shelf at ${shortAddr(pay.address)}` : "the merchant's shelf"}.` : "",
       chg ? `${fmtSats(chg.sats)} sats of change went back to my owner's shelf.` : m > 1 ? `${m - 1} more output${m > 2 ? "s" : ""} landed on other shelves.` : ""].filter(Boolean).join(" ");
  const confNow = !live ? "" : conf === null ? "As of this moment this transaction has not been mined, so everything from here on is what will happen, not what has."
    : `As of this moment it has ${conf.toLocaleString("en-US")} confirmation${conf === 1 ? "" : "s"}.`;
  return {
    intent: isCoinbase ? "collect the block reward" : pay ? `send ${fmtSats(pay.sats)} satoshis to ${who(pay, live)}` : "move some coins",
    inputsProse, outputsProse, utxoProse, feeProse, ctorProse, bornProse, confNow,
    txidShort: short(d.txid, 6), txid8: d.txid.slice(0, 8), bytes: fmtSats(d.bytes), feeSats: fmtSats(d.feeSats), feeRate: rate.toFixed(2),
    height: heightStr, heightNum: d.height ? d.height.toLocaleString("en-US") : "pending",
    kicker: live ? `// The Transaction Lab · your transaction · mainnet · ${conf === null ? "unconfirmed" : `${conf.toLocaleString("en-US")} conf`}` : "// The Transaction Lab · six stages · one real transaction",
    pageTitle: live ? "Your transaction." : "I am born empty.",
    pageSub: live ? "This is a real mainnet transaction. Its numbers, keys and script are its own." : "Every transaction starts in a wallet, outside the network. Nobody has heard of me yet.",
    peers: "fourteen",
  };
}

/* canonical-order slot: where this txid sorts among five fixed neighbours */
const NEIGHBOURS = ["1f3c…09a2", "5b90…e7c4", "7d2a…f1e6", "c07e…5d18", "e921…33b0"];
function sortedSlot(txid: string) {
  const all = [...NEIGHBOURS.map((n) => ({ id: n, key: n.slice(0, 4), hero: false })), { id: `${txid.slice(0, 4)}…${txid.slice(-4)}`, key: txid.slice(0, 4), hero: true }];
  all.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.hero ? 1 : -1));
  const index = all.findIndex((a) => a.hero);
  return { index, order: all, before: all[index - 1]?.id ?? "the coinbase", after: all[index + 1]?.id ?? "nothing" };
}

/* ═══════════════════════ fact boxes ═══════════════════════ */

function facts(d: TxData): Record<string, string> {
  const { pay, chg, isCoinbase, live } = pick(d);
  const k = (s: string) => `<span class="k">${s}</span>`;
  const rows = (arr: string[], cap: number) => (arr.length > cap ? [...arr.slice(0, cap), `${k(`… and ${arr.length - cap} more`)}`] : arr).join("<br/>");
  const col = (i: number) => (i % 2 ? "v" : "g");
  const slot = sortedSlot(d.txid);
  const feeOk = d.feeRate >= 1;
  return {
    born: `${k("version")} <b>${d.version}</b> · ${k("inputs")} <b>0</b> · ${k("outputs")} <b>0</b> · ${k("locktime")} <b>${d.locktime}</b>`,
    inputs: isCoinbase ? `${k("in0")} null outpoint · <b>coinbase</b>` : rows(d.inputs.map((i, n) => `${k(`in${n}`)} <b>${short(i.txid)}</b>:${i.vout} → <span class="${col(n)}">${fmtSats(i.sats)} sats</span>`), 6) + `<br/>${k("total in")} <b>${fmtSats(d.inSum)} sats</b>`,
    rawInputs: rows(d.inputs.map((i, n) => `${k(`in${n}`)} ${i.txid}`), 4),
    outputs: rows(d.outputs.map((o, n) => `${k(`out${n}`)} <span class="${o.kind === "change" ? "v" : "g"}">${fmtSats(o.sats)}</span> → ${esc(shortAddr(o.address))} ${k(o.kind)}${o.token ? ` ${k(`· token ${o.token.nft ? "NFT" : ""} ${o.token.amount !== "0" ? o.token.amount : ""} ${short(o.token.category, 4)}`)}` : ""}`), 6)
      + (isCoinbase ? "" : `<br/>${k("in − out")} <b>${fmtSats(d.inSum)} − ${fmtSats(d.outSum)} = <span class="w">${fmtSats(d.feeSats)} sats fee</span></b>`),
    rawOutputs: rows(d.outputs.map((o, n) => `${k(`out${n}`)} 8-byte LE value ${fmtSats(o.sats)} · script for ${esc(shortAddr(o.address))}`), 4),
    sign: d.signature ? `${k("sighash")} <b>0x${d.sighash}</b>${d.sighash === "41" ? " = ALL | FORKID" : ""}<br/>${k("pubkey")} ${d.pubkey}<br/>${k("sig (in0)")} ${short(d.signature, 12)} ${k(`${d.signature.length / 2} B`)}`
      : `${k("in0 unlocking script")} ${esc(asm(d.inputs[0]?.unlockAsm ?? ""))}<br/>${k("note")} not a plain single-signature spend; the stage still shows the real script`,
    rawSign: d.signature ? `${k("in0 unlock")} ${(d.signature.length / 2).toString(16)}<span class="g">${d.signature}</span> 21<span class="v">${d.pubkey}</span>` : `${k("in0 unlock")} ${esc(asm(d.inputs[0]?.unlockAsm ?? ""))}`,
    sealed: `${k("txid")} <b class="g">${d.txid}</b><br/>${k("size")} <b>${d.bytes} bytes</b> · ${k("fee")} <b>${fmtSats(d.feeSats)} sats</b> · ${k("rate")} <b>${d.feeRate.toFixed(2)} sat/B</b>`,
    rawHex: d.hex,
    inv: `${k("→")} inv [MSG_TX ${short(d.txid, 6)}]<br/>${k("←")} getdata [MSG_TX ${short(d.txid, 6)}]<br/>${k("→")} tx (${d.bytes} bytes)`,
    rawInv: `${k("inv")} 01 ${k("count")} · 01000000 ${k("MSG_TX")} · <span class="g">${d.txid}</span>`,
    form: `${k("size")} <b>${d.bytes} B</b> (min 65, max 1 MB) · ${k("inputs")} <b>${d.inputs.length}</b> · ${k("outputs")} <b>${d.outputs.length}</b> · ${k("duplicate outpoints")} <b>none</b>`,
    utxo: rows(d.inputs.map((i, n) => `${k(`in${n}`)} found · <span class="${col(n)}">${fmtSats(i.sats)}</span> · locked to ${esc(shortAddr(i.address))}`), 6),
    script: `${k("unlock")} ${esc(asm(d.inputs[0]?.unlockAsm ?? ""))}<br/>${k("lock")} ${esc(asm(d.inputs[0]?.lockAsm ?? ""))}${d.vmNote ? `<br/>${k("note")} <span class="w">${esc(d.vmNote)}</span>` : ""}`,
    fee: `${k("fee")} <b>${fmtSats(d.inSum)} − ${fmtSats(d.outSum)} = <span class="w">${fmtSats(d.feeSats)} sats</span></b><br/>${k("rate")} <b>${d.feeRate.toFixed(2)} sat/B</b> ${feeOk ? "≥ 1.0 min relay ✓" : `<span class="w">below the 1.0 default; relayed by nodes with a lower floor</span>`}`,
    ctor: `${k("order")} coinbase, then txids ascending<br/>${k("this tx")} <b>${d.txid.slice(0, 8)}…</b> sorts after <b>${esc(slot.before)}</b> and before <b>${esc(slot.after)}</b>`,
    coinbase: `${k("subsidy")} <b>3.125 BCH</b> · ${k("+ fees")} including <span class="w">${fmtSats(d.feeSats)} sats</span> from this tx · ${k("maturity")} <b>100 blocks</b>`,
    archive: `${k("block")} <b>${d.height ? `#${d.height.toLocaleString("en-US")}` : "pending"}</b>${live ? (d.blockhash ? ` · ${k("hash")} ${short(d.blockhash, 6)}` : " · not yet mined") : " (illustrative height)"} · ${k("links back to")} <b>#0 · 3 Jan 2009</b>`,
    conf: `${k("6 conf")} ≈ 1 hour · ${k("P(reversal, 10% attacker)")} <b>≈ 0.02%</b> · ${k("10 conf")} <b>finalized by BCHN</b>${live && d.confirmations !== null ? `<br/>${k("this tx")} <b>${d.confirmations.toLocaleString("en-US")} confirmations</b> as of block ${d.tip?.toLocaleString("en-US") ?? "?"}` : ""}`,
    born2: rows(d.outputs.map((o, n) => `${k("new UTXO")} <span class="${o.kind === "change" ? "v" : "g"}">${fmtSats(o.sats)}</span> → ${esc(shortAddr(o.address))} · <b>${d.txid.slice(0, 8)}…:${n}</b>`), 4),
    _pay: pay ? fmtSats(pay.sats) : "", _chg: chg ? fmtSats(chg.sats) : "",
  };
}

/* ═══════════════════════ stage labels ═══════════════════════ */

function setText(id: string, text: string) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
function show(sel: string, on: boolean) {
  $$(sel).forEach((el) => ((el as HTMLElement).style.display = on ? "" : "none"));
}

function stageLabels(d: TxData) {
  const { pay, second, chg, live, isCoinbase } = pick(d);
  const n = d.inputs.length;
  setText("hero-txid", `${d.txid.slice(0, 6)}…${d.txid.slice(-6)}`);
  setText("lbl-in0", isCoinbase ? "new" : fmtSats(d.inputs[0].sats));
  setText("lbl-in1", n > 1 ? fmtSats(d.inputs[1].sats) : "");
  show(".vial-b, #lbl-in1", n > 1);
  setText("lbl-utxo-title", n > 2 ? `YOUR UTXOs · ${n}` : isCoinbase ? "NO INPUTS" : "YOUR UTXOs");
  const tag = (a: string) => a.replace(/^bitcoincash:/, "").slice(0, 6) + "…";
  setText("lbl-pay-t", pay ? (pay.kind === "payment" ? "PAYMENT" : "OUTPUT") + (live ? ` · ${tag(pay.address)}` : "") : "");
  setText("lbl-pay", pay ? `${fmtSats(pay.sats)} sats${live ? "" : " → merchant"}` : "");
  show(".beaker-chg", !!second);
  if (second) {
    setText("lbl-chg-t", second.kind === "change" ? "CHANGE" : `OUTPUT · ${tag(second.address)}`);
    setText("lbl-chg", `${fmtSats(second.sats)} sats${second.kind === "change" ? " → you" : ""}`);
  }
  setText("lbl-more", d.outputs.length > 2 ? `+${d.outputs.length - 2} more` : "");
  setText("lbl-form", `${d.bytes} bytes · v${d.version} · ${n} in · ${d.outputs.length} out`);
  setText("lbl-drawer-a", isCoinbase ? "coinbase" : `…${d.inputs[0].txid.slice(-4)}:${d.inputs[0].vout} · ${fmtSats(d.inputs[0].sats)}`);
  $$(".drawer-4").forEach((el) => ((el as HTMLElement).style.cssText = n > 1 ? "" : "fill:#0f1a16;stroke:#2e3833"));
  setText("lbl-drawer-b", n > 1 ? `…${d.inputs[1].txid.slice(-4)}:${d.inputs[1].vout} · ${fmtSats(d.inputs[1].sats)}` : "");
  setText("lbl-fee", `${fmtSats(d.feeSats)} sats`);
  setText("lbl-size", `${d.bytes} B`);
  setText("lbl-feerate", `${d.feeRate.toFixed(2)} sat/byte · min 1.0`);
  const h = d.height;
  const hs = h ? `#${h.toLocaleString("en-US")}` : "PENDING";
  ["lbl-height", "lbl-height2", "lbl-height3"].forEach((id) => setText(id, hs));
  $$(".oldblock-label").forEach((el, i) => (el.textContent = h ? `#${(h - 4 + i).toLocaleString("en-US")}` : ""));
  $$(".newblock-label").forEach((el, i) => (el.textContent = h ? `#${(h + 1 + i).toLocaleString("en-US")}` : ""));
  setText("lbl-time", d.blocktime ? `${new Date(d.blocktime * 1000).toISOString().replace("T", " ").slice(0, 19)} UTC` : live ? "not yet mined" : "2026-09-28 17:48:02 UTC");
  setText("lbl-prev", d.blockhash ? `${short(d.blockhash, 8)} (this block's hash)` : "000000000000000000f3…9c1a");
  const conf = d.confirmations;
  setText("lbl-conf6", !live ? "6 CONFIRMATIONS · SETTLED" : conf === null ? "0 CONFIRMATIONS · STILL IN THE MEMPOOL" : `${conf.toLocaleString("en-US")} CONFIRMATION${conf === 1 ? "" : "S"}${conf >= 6 ? " · SETTLED" : ""}`);
  setText("lbl-conf2", live && conf !== null && conf < 2 ? `${conf} CONFIRMATION${conf === 1 ? "" : "S"}` : "2 CONFIRMATIONS");
  show(".conf-note-6", !live || (conf !== null && conf >= 10));
  // how many blocks on top can we honestly draw?
  const onTop = !live ? 5 : conf === null ? 0 : Math.min(5, conf - 1);
  $$(".newblock").forEach((el, i) => ((el as HTMLElement).style.visibility = i < onTop ? "" : "hidden"));
  setText("lbl-shelf-pay", live && pay ? shortAddr(pay.address).toUpperCase() : "THE MERCHANT'S WALLET");
  setText("lbl-coin-pay", pay ? `${fmtSats(pay.sats)} · ${d.txid.slice(0, 6)}…:${d.outputs.indexOf(pay)}` : "");
  show("#shelf-chg", !!second);
  if (second) {
    setText("lbl-shelf-chg", second.kind === "change" || !live ? "YOUR WALLET" : shortAddr(second.address).toUpperCase());
    setText("lbl-coin-chg", `${fmtSats(second.sats)} · ${d.txid.slice(0, 6)}…:${d.outputs.indexOf(second)}`);
  }
  void chg;
  // canonical order: put the hero in its sorted slot and relabel the neighbours
  const slot = sortedSlot(d.txid);
  const slotX = (i: number) => 5130 + 70 * i;
  const others = slot.order.filter((o) => !o.hero);
  $$(".qflask").forEach((el, i) => {
    const o = others[i];
    const idx = slot.order.indexOf(o);
    (el as HTMLElement).style.setProperty("--x1", `${slotX(idx)}px`);
    const t = el.querySelector("text");
    if (t) t.textContent = o.id;
  });
  setStepHx("ctor", slotX(slot.index));
  setStepHx("coinbase", slotX(slot.index));
}

/* ═══════════════════════ opcode cards ═══════════════════════ */

function buildOpCards(d: TxData) {
  const host = $("#op-cards")!;
  host.replaceChildren();
  d.trace.forEach((s, i) => {
    const st = narrate(s, i, d.trace, d);
    const phase = s.phase === "unlock" ? "unlocking script" : s.phase === "lock" ? "locking script" : "redeem script";
    const art = document.createElement("article");
    art.className = "step";
    art.id = `op-${i}`;
    art.dataset.step = `op-${i}`;
    art.innerHTML = `
      <div class="stage-tag">Stage 3 · Check 3 of 5 · ${phase} · step ${i + 1} of ${d.trace.length}</div>
      <h3><code>${esc(s.op)}</code> · ${esc(st.title)}</h3>
      <div class="lens lens-beginner"><p class="voice">${esc(st.voice)}</p></div>
      <div class="lens lens-technical"><p>${esc(st.tech)}</p></div>
      <div class="lens lens-raw"><p>${esc(st.tech)}</p>
        <div class="fact small"><span class="k">stack after</span> ${s.stack.length === 0 ? '<span class="k">(empty)</span>' : s.stack.map((h) => ` [${h.length / 2} B] ${h ? short(h, 8) : "∅"}`).join("")}</div></div>`;
    host.appendChild(art);
  });
}

/* ═══════════════════════ stack machine panel ═══════════════════════ */

const text = (x: number, y: number, str: string, cls = "", anchor = "start") => {
  const t = document.createElementNS(SVG, "text");
  t.setAttribute("x", String(x)); t.setAttribute("y", String(y)); t.setAttribute("text-anchor", anchor);
  if (cls) t.setAttribute("class", cls);
  t.textContent = str;
  return t;
};

function label(h: string, d: TxData) {
  if (h === "") return "empty (false)";
  if (d.signature && h === d.signature) return "signature";
  if (d.pubkey && h === d.pubkey) return "pubkey";
  if (d.pkh && h === d.pkh) return "pubkey hash";
  if (h === "01") return "true";
  if (h.length <= 8) return `number ${vmNumber(h)}`;
  if (h.length === 40) return "20-byte hash";
  if (h.length === 64) return "32-byte hash";
  return `${h.length / 2} bytes`;
}
function vmNumber(h: string): string {
  const bytes = h.match(/../g)!.map((x) => parseInt(x, 16));
  let n = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) n = (n << 8n) | BigInt(i === bytes.length - 1 ? bytes[i] & 0x7f : bytes[i]);
  return ((bytes[bytes.length - 1] & 0x80) ? -n : n).toString();
}

function renderPanel(opIndex: number) {
  const d = data;
  const opsCol = $("#ops-col")!;
  const stackCol = $("#stack-col")!;
  const opTitle = $("#op-title")!;
  opsCol.replaceChildren();
  stackCol.replaceChildren();
  const cur = d.trace[opIndex];
  if (!cur) return;
  const opList = d.trace.filter((s) => s.op !== "done");
  const phaseName = (p: TraceStep["phase"]) => (p === "unlock" ? "UNLOCKING SCRIPT" : p === "lock" ? "LOCKING SCRIPT (the coin)" : "REDEEM SCRIPT (P2SH)");
  opTitle.textContent = cur.op === "done" ? (cur.ok ? "VALID · true on stack" : "FAILED") : `${cur.phase.toUpperCase()} · ${cur.op}`;
  // opcode column: a window of rows around the current instruction
  const MAX = 10;
  let start = 0;
  if (opList.length > MAX) start = Math.max(0, Math.min(opIndex - 4, opList.length - MAX));
  const end = Math.min(opList.length, start + MAX);
  let y = -344;
  if (start > 0) { opsCol.appendChild(text(-140, y, `… ${start} earlier`, "phase")); y += 14; }
  let lastPhase = "";
  for (let i = start; i < end; i++) {
    const s = opList[i];
    if (s.phase !== lastPhase) {
      lastPhase = s.phase;
      opsCol.appendChild(text(-140, y, phaseName(s.phase), "phase"));
      y += 14;
    }
    const state = cur.op === "done" || i < opIndex ? "done" : i === opIndex ? "now" : "";
    opsCol.appendChild(text(-140, y, (state === "now" ? "▸ " : "  ") + s.op, state));
    y += 15;
  }
  if (end < opList.length) opsCol.appendChild(text(-140, y, `… ${opList.length - end} more`, "phase"));
  // stack column: bottom item lowest, top item highest, at most 5 visible
  const items = cur.stack;
  const visible = items.slice(-5);
  const hidden = items.length - visible.length;
  const slotH = 30;
  const baseY = -214;
  visible.forEach((h, i) => {
    const yy = baseY - i * slotH;
    const r = document.createElementNS(SVG, "rect");
    r.setAttribute("x", "4"); r.setAttribute("y", String(yy - 22)); r.setAttribute("width", "168"); r.setAttribute("height", "26"); r.setAttribute("rx", "3");
    const isTop = i === visible.length - 1;
    r.setAttribute("class", `${isTop ? "top" : ""} ${h === "01" && isTop && cur.op === "done" ? "true" : ""}`.trim());
    stackCol.appendChild(r);
    const isTrue = h === "01" && isTop && cur.op === "done";
    stackCol.appendChild(text(10, yy - 11, label(h, d).toUpperCase(), `lbl ${isTrue ? "true" : ""}`));
    stackCol.appendChild(text(10, yy - 1, isTrue ? "0x01 — the script succeeds" : h ? `${h.slice(0, 14)}${h.length > 20 ? "…" + h.slice(-6) : ""}` : "(zero bytes)", isTrue ? "true" : ""));
  });
  if (hidden > 0) stackCol.appendChild(text(10, baseY + 12, `… ${hidden} more below`, "dim"));
  if (items.length === 0) stackCol.appendChild(text(10, baseY - 8, "(empty)", "dim"));
}

/* ═══════════════════════ hex drawer ═══════════════════════ */

const spans = new Map<string, HTMLSpanElement>();
function buildHex(d: TxData) {
  const body = $("#hex-body")!;
  body.replaceChildren();
  spans.clear();
  setText("hex-bytes", String(d.bytes));
  for (const r of d.ranges) {
    const s = document.createElement("span");
    s.className = "r";
    s.textContent = d.hex.slice(r.start * 2, r.end * 2);
    s.title = r.name;
    body.appendChild(s);
    spans.set(r.name, s);
  }
}
function highlight(names: string[]) {
  let first: HTMLSpanElement | null = null;
  spans.forEach((s, n) => {
    const on = names.includes(n);
    s.classList.toggle("hi", on);
    s.classList.toggle("dim", names.length > 0 && !on);
    if (on && !first) first = s;
  });
  setText("hex-field", names.length ? names.join(", ") : "all fields");
  if (first) {
    const el = first as HTMLSpanElement;
    const drawer = $("#hexdrawer")!;
    drawer.scrollTop = Math.max(0, el.offsetTop - drawer.offsetTop - 30);
  }
}

/* ═══════════════════════ apply a transaction to the page ═══════════════════════ */

const STAGE_OF: Record<string, number> = {
  born: 0, inputs: 0, outputs: 0, sign: 0, sealed: 0, leave: 0,
  broadcast: 1, gossip: 1, everywhere: 1, arrive: 1,
  pool: 3, rules: 3, waiting: 3, "block-found": 3,
  "block-arrives": 4, ctor: 4, coinbase: 4, "sealed-in": 4,
  archive: 5, "conf-1": 5, "conf-6": 5, "outputs-born": 5, end: 5,
};

export function applyData(d: TxData) {
  data = d;
  document.body.dataset.mode = d.mode;
  const v = values(d);
  $$("[data-v]").forEach((el) => { const key = el.getAttribute("data-v")!; if (key in v) el.textContent = v[key]; });
  const f = facts(d);
  $$("[data-fact]").forEach((el) => { const key = el.getAttribute("data-fact")!; if (key in f) el.innerHTML = f[key]; });
  $$("[data-livenote]").forEach((el) => {
    const on = d.mode === "live" && d.confirmations === null;
    (el as HTMLElement).hidden = !on;
    if (on) el.textContent = "This transaction has not been mined yet. As of right now it is still in the mempool, so this stage and the next show what will happen, not what has.";
  });
  $$("[data-vmnote]").forEach((el) => { (el as HTMLElement).hidden = !d.vmNote; el.textContent = d.vmNote; });
  $$("[data-live-only]").forEach((el) => ((el as HTMLElement).hidden = d.mode !== "live"));
  $$("[data-demo-only]").forEach((el) => ((el as HTMLElement).hidden = d.mode !== "demo"));
  document.title = d.mode === "live" ? `${short(d.txid, 6)} — The Life of a Transaction — txlab.cash` : "The Life of a Transaction — txlab.cash";

  stageLabels(d);
  buildOpCards(d);
  buildHex(d);

  renderPanel(0);
  engine?.destroy();
  const stage = $<SVGSVGElement>("svg.stage")!;
  const progressBtns = $$<HTMLButtonElement>(".progress [data-jump]");
  engine = startEngine(expandSteps(d.trace.length), {
    stage,
    onStep(r: Resolved) {
      if (r.state.op !== undefined) renderPanel(r.state.op);
      else if (r.flags.has("st3ok")) renderPanel(d.trace.length - 1);
      const card = document.querySelector<HTMLElement>(`[data-step="${r.id}"]`);
      const names = card?.dataset.ranges ? card.dataset.ranges.split(",").map((s) => s.trim()) : [];
      highlight(names);
      const s = STAGE_OF[r.id] ?? 2;
      progressBtns.forEach((b, i) => { b.classList.toggle("is-on", i === s); b.classList.toggle("is-done", i < s); });
    },
  });
}

/* ═══════════════════════ boot ═══════════════════════ */

export function initPage(demo: TxData) {
  // lens
  const setLens = (lens: string) => {
    document.body.dataset.lens = lens;
    $$<HTMLButtonElement>("[data-lens]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lens === lens)));
    try { localStorage.setItem("txlab:lens", lens); } catch { /* private mode */ }
  };
  setLens(new URLSearchParams(location.search).get("lens") || (() => { try { return localStorage.getItem("txlab:lens") || ""; } catch { return ""; } })() || "beginner");
  $$<HTMLButtonElement>("[data-lens]").forEach((b) => b.addEventListener("click", () => setLens(b.dataset.lens!)));

  document.addEventListener("click", (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>("[data-jump], [data-lens-next]");
    if (!t) return;
    e.preventDefault();
    if (t.dataset.jump) engine?.jump(t.dataset.jump);
    else {
      const order = ["beginner", "technical", "raw"];
      setLens(order[(order.indexOf(document.body.dataset.lens!) + 1) % order.length]);
    }
  });

  applyData(demo);

  // paste-a-txid
  const form = $<HTMLFormElement>("#txform");
  const input = $<HTMLInputElement>("#txinput");
  const status = $("#txstatus");
  const load = async (raw: string) => {
    if (!form || !input || !status) return;
    const txid = raw.trim().toLowerCase().replace(/^0x/, "");
    if (!/^[0-9a-f]{64}$/.test(txid)) { status.textContent = "That does not look like a txid: expected 64 hex characters."; status.dataset.state = "err"; return; }
    input.value = txid;
    status.dataset.state = "busy";
    status.textContent = "loading…";
    form.classList.add("is-busy");
    try {
      const { loadLiveTx } = await import("./live");
      const d = await loadLiveTx(txid, (s) => (status.textContent = s));
      const q = new URLSearchParams(location.search); q.set("tx", txid); history.replaceState(null, "", `?${q}${location.hash}`);
      applyData(d);
      status.dataset.state = "ok";
      status.textContent = `loaded · ${d.inputs.length} in · ${d.outputs.length} out · ${d.confirmations === null ? "unconfirmed" : `${d.confirmations.toLocaleString("en-US")} confirmations`}`;
      if (!new URLSearchParams(location.search).get("step")) engine?.jump("born");
    } catch (e) {
      status.dataset.state = "err";
      status.textContent = `could not load: ${(e as Error).message}`;
    } finally {
      form.classList.remove("is-busy");
    }
  };
  form?.addEventListener("submit", (e) => { e.preventDefault(); void load(input?.value ?? ""); });
  $$<HTMLElement>("[data-try-tx]").forEach((el) => el.addEventListener("click", (e) => { e.preventDefault(); void load(el.dataset.tryTx!); }));
  const preset = new URLSearchParams(location.search).get("tx");
  if (preset) void load(preset);
}
