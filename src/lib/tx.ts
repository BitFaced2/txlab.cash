/**
 * The demo transaction. Built, signed and evaluated at build time with
 * Libauth. Nothing here is faked: the keys are real (derived from a fixed
 * seed so the story is stable), the signature is a real Schnorr signature
 * with SIGHASH_ALL | SIGHASH_FORKID, and the script trace comes from
 * Libauth's BCH virtual machine. Only the two "previous" coins are invented,
 * because a demo wallet has no history.
 */
import {
  assertSuccess,
  binToHex,
  createVirtualMachineBCH,
  disassembleBytecodeBCH,
  encodeLockingBytecodeP2pkh,
  encodeTransaction,
  generateTransaction,
  hash160,
  hash256,
  hashTransactionUiOrder,
  importWalletTemplate,
  lockingBytecodeToCashAddress,
  secp256k1,
  sha256,
  walletTemplateP2pkhNonHd,
  walletTemplateToCompilerBCH,
} from "@bitauth/libauth";
import { layoutRanges, traceFromStates, type TxData } from "./txshape";

const enc = (s: string) => new TextEncoder().encode(s);

/** Illustrative block height for the demo's block and archive rooms. */
export const DEMO_HEIGHT = 966_240;

export function buildDemoTx(): TxData {
  const template = assertSuccess(importWalletTemplate(walletTemplateP2pkhNonHd));
  const compiler = walletTemplateToCompilerBCH(template);

  const key = sha256.hash(enc("txlab:hero:alice"));
  const bobKey = sha256.hash(enc("txlab:merchant:bob"));
  const pub = assertSuccess(secp256k1.derivePublicKeyCompressed(key));
  const bobPub = assertSuccess(secp256k1.derivePublicKeyCompressed(bobKey));
  const alicePkh = hash160(pub);
  const aliceLock = encodeLockingBytecodeP2pkh(alicePkh);
  const bobLock = encodeLockingBytecodeP2pkh(hash160(bobPub));
  const addr = (bytecode: Uint8Array) =>
    assertSuccess(lockingBytecodeToCashAddress({ bytecode, prefix: "bitcoincash" })).address;

  const utxos = [
    { txid: hash256(enc("txlab:prev:a")), vout: 1, sats: 30_000n },
    { txid: hash256(enc("txlab:prev:b")), vout: 0, sats: 17_500n },
  ];
  const outs = [
    { kind: "payment" as const, lock: bobLock, sats: 42_000n },
    { kind: "change" as const, lock: aliceLock, sats: 5_100n },
  ];

  const data = { keys: { privateKeys: { key } } };
  const attempt = generateTransaction({
    version: 2,
    locktime: 0,
    inputs: utxos.map((u) => ({
      outpointTransactionHash: u.txid,
      outpointIndex: u.vout,
      sequenceNumber: 0,
      unlockingBytecode: { compiler, data, script: "unlock", valueSatoshis: u.sats },
    })),
    outputs: outs.map((o) => ({ lockingBytecode: o.lock, valueSatoshis: o.sats })),
  });
  if (!attempt.success) throw new Error("transaction generation failed");
  const tx = attempt.transaction;
  const encoded = encodeTransaction(tx);
  const inSum = utxos.reduce((a, u) => a + u.sats, 0n);
  const outSum = outs.reduce((a, o) => a + o.sats, 0n);
  const feeSats = inSum - outSum;

  const vm = createVirtualMachineBCH();
  const sourceOutputs = utxos.map((u) => ({ lockingBytecode: aliceLock, valueSatoshis: u.sats }));
  const states = vm.debug({ inputIndex: 0, sourceOutputs, transaction: tx });
  const valid = vm.verify({ sourceOutputs, transaction: tx }) === true;

  const unlock = tx.inputs[0].unlockingBytecode;
  const sigLen = unlock[0];
  const signature = binToHex(unlock.slice(1, 1 + sigLen));

  return {
    mode: "demo",
    txid: binToHex(hashTransactionUiOrder(encoded)),
    hex: binToHex(encoded),
    bytes: encoded.length,
    version: tx.version,
    locktime: tx.locktime,
    inputs: utxos.map((u, n) => ({
      txid: binToHex(u.txid),
      vout: u.vout,
      sats: u.sats.toString(),
      address: addr(aliceLock),
      unlockAsm: disassembleBytecodeBCH(tx.inputs[n].unlockingBytecode),
      lockAsm: disassembleBytecodeBCH(aliceLock),
    })),
    outputs: outs.map((o) => ({ address: addr(o.lock), sats: o.sats.toString(), kind: o.kind })),
    inSum: inSum.toString(),
    outSum: outSum.toString(),
    feeSats: feeSats.toString(),
    feeRate: Number(feeSats) / encoded.length,
    signature,
    pubkey: binToHex(pub),
    pkh: binToHex(alicePkh),
    sighash: signature.slice(-2),
    trace: traceFromStates(states as Parameters<typeof traceFromStates>[0]),
    valid,
    vmNote: "",
    ranges: layoutRanges(tx),
    confirmations: 6,
    height: DEMO_HEIGHT,
    blockhash: null,
    blocktime: null,
    tip: DEMO_HEIGHT + 5,
  };
}
