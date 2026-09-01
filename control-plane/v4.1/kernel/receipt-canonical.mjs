import { createHash } from 'node:crypto';

const SHA40 = /^[0-9a-f]{40}$/;
const SHA64 = /^[0-9a-f]{64}$/;

class GateError extends Error {
  constructor(code, detail = '') {
    super(`${code}: ${detail}`);
    this.code = code;
    this.detail = detail;
  }
}

const fail = (code, detail = '') => { throw new GateError(code, detail); };
const ok = (condition, code, detail = '') => { if (!condition) fail(code, detail); };
const eq = (actual, expected, code, detail = '') => {
  if (actual !== expected) fail(code, `${detail} expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
};
const uniq = (values, code) => {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) fail(code, String(value));
    seen.add(value);
  }
};
const errorCode = error => error instanceof GateError ? error.code : 'UNEXPECTED';

function timestamp(value, label) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) fail('TIME_INVALID', `${label}:${String(value)}`);
  return parsed;
}

function canonical(value, seen = new WeakSet()) {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.normalize('NFC');
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('CANONICAL_NONFINITE', String(value));
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value === 'undefined') fail('CANONICAL_UNDEFINED');
  if (Array.isArray(value)) {
    if (seen.has(value)) fail('CANONICAL_CYCLE', 'array');
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.hasOwn(value, index)) fail('CANONICAL_SPARSE_ARRAY', String(index));
    }
    seen.add(value);
    const out = value.map(item => canonical(item, seen));
    seen.delete(value);
    return out;
  }
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    fail('CANONICAL_NONPLAIN', Object.prototype.toString.call(value));
  }
  if (seen.has(value)) fail('CANONICAL_CYCLE', 'object');
  seen.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const out = {};
  for (const rawKey of Object.keys(descriptors).sort()) {
    const descriptor = descriptors[rawKey];
    if (!Object.hasOwn(descriptor, 'value')) fail('CANONICAL_ACCESSOR', rawKey);
    if (descriptor.value === undefined) fail('CANONICAL_UNDEFINED', rawKey);
    const key = rawKey.normalize('NFC');
    if (Object.hasOwn(out, key)) fail('CANONICAL_KEY_COLLISION', key);
    out[key] = canonical(descriptor.value, seen);
  }
  seen.delete(value);
  return out;
}

function sha256(value) {
  const bytes = typeof value === 'string' ? value : JSON.stringify(canonical(value));
  return createHash('sha256').update(bytes).digest('hex');
}

function sealReceipt(input) {
  ok(input && typeof input === 'object' && !Array.isArray(input), 'RECEIPT_INPUT');
  ok(!Object.hasOwn(input, 'receiptHash'), 'RECEIPT_PRESEALED');
  const receipt = structuredClone(input);
  receipt.hashAlgorithm = 'sha256';
  if (Object.hasOwn(receipt, 'payload')) {
    receipt.payloadHash = sha256(receipt.payload);
  } else {
    delete receipt.payloadHash;
  }
  receipt.receiptHash = sha256(receipt);
  return receipt;
}


export { GateError, SHA40, SHA64, canonical, eq, errorCode, fail, ok, sealReceipt, sha256, timestamp, uniq };
