import { createHash } from 'node:crypto';

const SHA40 = /^[0-9a-f]{40}$/;
const SHA64 = /^[0-9a-f]{64}$/;
const CURRENT_TRUST_CLASS = 'INTEGRITY_ONLY';
const CURRENT_AUTHORITY_CEILING = 'SHADOW_ONLY';

class GateError extends Error {
  constructor(code, detail='') { super(`${code}: ${detail}`); this.code=code; this.detail=detail; }
}
const fail=(code,detail='')=>{throw new GateError(code,detail)};
const ok=(condition,code,detail='')=>{if(!condition) fail(code,detail)};
const eq=(actual,expected,code,detail='')=>{if(actual!==expected) fail(code,`${detail} expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`)};
const uniq=(values,code)=>{const seen=new Set(); for(const value of values){if(seen.has(value)) fail(code,String(value)); seen.add(value)}};
const errorCode=e=>e instanceof GateError?e.code:'UNEXPECTED';

function timestamp(value,label){
  ok(typeof value==='string'&&value.length>0,'TIME_TYPE',label);
  const parsed=Date.parse(value); if(!Number.isFinite(parsed)) fail('TIME_INVALID',`${label}:${value}`); return parsed;
}

function canonical(value,seen=new WeakSet()){
  if(value===null||typeof value==='boolean') return value;
  if(typeof value==='string') return value.normalize('NFC');
  if(typeof value==='number'){
    if(!Number.isFinite(value)) fail('CANONICAL_NONFINITE',String(value));
    return Object.is(value,-0)?0:value;
  }
  if(typeof value==='undefined') fail('CANONICAL_UNDEFINED');
  if(Array.isArray(value)){
    if(seen.has(value)) fail('CANONICAL_CYCLE','array');
    for(let i=0;i<value.length;i+=1) if(!Object.hasOwn(value,i)) fail('CANONICAL_SPARSE_ARRAY',String(i));
    seen.add(value); const out=value.map(item=>canonical(item,seen)); seen.delete(value); return out;
  }
  if(!value||typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype) fail('CANONICAL_NONPLAIN',Object.prototype.toString.call(value));
  if(seen.has(value)) fail('CANONICAL_CYCLE','object');
  seen.add(value);
  const symbols=Object.getOwnPropertySymbols(value);
  if(symbols.length>0) fail('CANONICAL_SYMBOL_KEY',String(symbols[0]));
  const descriptors=Object.getOwnPropertyDescriptors(value);
  const normalized=[]; const seenKeys=new Set();
  for(const rawKey of Object.keys(descriptors)){
    const descriptor=descriptors[rawKey];
    if(!Object.hasOwn(descriptor,'value')) fail('CANONICAL_ACCESSOR',rawKey);
    if(descriptor.enumerable!==true) fail('CANONICAL_NONENUMERABLE',rawKey);
    if(descriptor.value===undefined) fail('CANONICAL_UNDEFINED',rawKey);
    const key=rawKey.normalize('NFC');
    if(seenKeys.has(key)) fail('CANONICAL_KEY_COLLISION',key);
    seenKeys.add(key); normalized.push([key,descriptor.value]);
  }
  normalized.sort(([a],[b])=>a<b?-1:a>b?1:0);
  const out={}; for(const [key,item] of normalized) out[key]=canonical(item,seen);
  seen.delete(value); return out;
}

function canonicalBytes(value){return Buffer.from(JSON.stringify(canonical(value)),'utf8')}
function sha256(value){return createHash('sha256').update(canonicalBytes(value)).digest('hex')}
function sha256Raw(bytes){return createHash('sha256').update(bytes).digest('hex')}

function sealReceipt(input){
  ok(input&&typeof input==='object'&&!Array.isArray(input),'RECEIPT_INPUT');
  ok(!Object.hasOwn(input,'receiptHash'),'RECEIPT_PRESEALED');
  canonical(input);
  if(Object.hasOwn(input,'trustClass')) eq(input.trustClass,CURRENT_TRUST_CLASS,'RECEIPT_TRUST_ESCALATION');
  const receipt=structuredClone(input);
  receipt.trustClass=CURRENT_TRUST_CLASS;
  receipt.hashAlgorithm='sha256';
  if(Object.hasOwn(receipt,'payload')) receipt.payloadHash=sha256(receipt.payload); else delete receipt.payloadHash;
  receipt.receiptHash=sha256(receipt);
  return receipt;
}
function canonicalIdentity(value,label){
  ok(typeof value==='string'&&value.length>0,'IDENTITY_STRING',label);
  eq(value,value.normalize('NFC'),'IDENTITY_NOT_NFC',label);
  return value;
}
function receiptAuthorityCeiling(receipt){
  eq(receipt.trustClass,CURRENT_TRUST_CLASS,'RECEIPT_TRUST_ESCALATION');
  return CURRENT_AUTHORITY_CEILING;
}

export { CURRENT_AUTHORITY_CEILING, CURRENT_TRUST_CLASS, GateError, SHA40, SHA64, canonical, canonicalBytes, canonicalIdentity, eq, errorCode, fail, ok, receiptAuthorityCeiling, sealReceipt, sha256, sha256Raw, timestamp, uniq };
