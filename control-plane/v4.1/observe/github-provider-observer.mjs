const SHA40=/^[0-9a-f]{40}$/;
const SAFE_BRANCH=/^(?!-)(?!.*\.\.)(?!.*@\{)(?!.*\/\/)(?!.*\.lock(?:\/|$))[A-Za-z0-9._/-]+$/;
const AUTHORITY_CEILING='SHADOW_ONLY';
const TRUST_CLASS='INTEGRITY_ONLY';
const REQUIRED_METHODS=['readRepository','readBranch','readBranchProtection'];
const ERROR_REASON={FORBIDDEN:'PROVIDER_FORBIDDEN',NOT_FOUND:'PROVIDER_NOT_FOUND_OR_HIDDEN',RATE_LIMITED:'PROVIDER_RATE_LIMITED',UNAVAILABLE:'PROVIDER_UNAVAILABLE',UNSUPPORTED:'PROVIDER_UNSUPPORTED',MALFORMED:'PROVIDER_MALFORMED_RESPONSE',TIMEOUT:'PROVIDER_TIMEOUT'};
class ProviderObservationError extends Error{constructor(code,detail=''){super(`${code}: ${detail}`);this.code=code;this.detail=detail}}
const fail=(c,d='')=>{throw new ProviderObservationError(c,d)};const ok=(v,c,d='')=>{if(!v)fail(c,d)};const observed=value=>({status:'OBSERVED',value});const unknown=reason=>({status:'UNKNOWN',value:null,reason});
function validateRepo(value){ok(typeof value==='string','REPOSITORY_ID_INVALID',String(value));const parts=value.split('/');ok(parts.length===2,'REPOSITORY_ID_INVALID',value);const [owner,repo]=parts;ok(/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(owner),'REPOSITORY_OWNER_INVALID',owner);ok(/^[A-Za-z0-9._-]+$/.test(repo)&&repo!=='.'&&repo!=='..','REPOSITORY_NAME_INVALID',repo);return value}
function validateBranch(value){ok(typeof value==='string'&&value.length>0&&value.length<=200&&SAFE_BRANCH.test(value),'BRANCH_ID_INVALID',String(value));return value}
function ensureClient(client){ok(client&&typeof client==='object','PROVIDER_CLIENT_REQUIRED');for(const method of REQUIRED_METHODS)ok(typeof client[method]==='function','PROVIDER_READ_METHOD_MISSING',method)}
function normalizeFailure(result){return unknown(ERROR_REASON[result?.errorCode]??'PROVIDER_UNAVAILABLE')}
function verifyRepositoryResponse(requested,result){if(!result?.ok)return normalizeFailure(result);const value=result.value;ok(value&&typeof value==='object','PROVIDER_REPOSITORY_MALFORMED');ok(value.fullName===requested,'PROVIDER_REPOSITORY_IDENTITY_MISMATCH');validateBranch(value.defaultBranch);return observed({fullName:value.fullName,defaultBranch:value.defaultBranch})}
function verifyBranchResponse(requested,result){if(!result?.ok)return normalizeFailure(result);const value=result.value;ok(value&&typeof value==='object','PROVIDER_BRANCH_MALFORMED');ok(value.name===requested,'PROVIDER_BRANCH_IDENTITY_MISMATCH');ok(SHA40.test(value.sha??''),'PROVIDER_BRANCH_SHA_INVALID');return observed({name:value.name,sha:value.sha})}
function verifyProtectionResponse(result){if(!result?.ok)return normalizeFailure(result);const value=result.value;ok(value&&typeof value==='object','PROVIDER_PROTECTION_MALFORMED');ok(typeof value.protected==='boolean','PROVIDER_PROTECTION_FLAG');const checks=value.requiredChecks??[];ok(Array.isArray(checks)&&checks.every(x=>typeof x==='string'&&x.length>0),'PROVIDER_REQUIRED_CHECKS');ok(new Set(checks).size===checks.length,'PROVIDER_REQUIRED_CHECKS_DUPLICATE');return observed({protected:value.protected,requiredChecks:[...checks].sort()})}
async function boundedCall(fn,timeoutMs){let timer;try{return await Promise.race([Promise.resolve().then(fn),new Promise(resolve=>{timer=setTimeout(()=>resolve({ok:false,errorCode:'TIMEOUT'}),timeoutMs)})])}catch{return {ok:false,errorCode:'UNAVAILABLE'}}finally{clearTimeout(timer)}}
async function observeGitHubProvider({repository,targetBranch='main',client,now=()=>new Date().toISOString(),timeoutMs=5000}={}){
  validateRepo(repository);validateBranch(targetBranch);ensureClient(client);ok(Number.isSafeInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=30000,'PROVIDER_TIMEOUT_INVALID');
  const trace=[];const call=async(operation,fn)=>{trace.push(operation);return boundedCall(fn,timeoutMs)};
  const repoResult=await call('READ_REPOSITORY',()=>client.readRepository(repository));const repo=verifyRepositoryResponse(repository,repoResult);
  let defaultBranch=repo.status==='OBSERVED'?observed(repo.value.defaultBranch):unknown(repo.reason);
  const branchCache=new Map();const readBranch=async name=>{if(branchCache.has(name))return branchCache.get(name);const result=verifyBranchResponse(name,await call('READ_BRANCH',()=>client.readBranch(repository,name)));branchCache.set(name,result);return result};
  const defaultBranchRef=repo.status==='OBSERVED'?await readBranch(repo.value.defaultBranch):unknown(repo.reason);
  const targetRef=await readBranch(targetBranch);
  const protection=verifyProtectionResponse(await call('READ_BRANCH_PROTECTION',()=>client.readBranchProtection(repository,targetBranch)));
  return {schemaVersion:1,snapshotType:'LIVE_TRUTH_GITHUB_PROVIDER',observerVersion:'4.1.0-alpha.9',observedAt:now(),provider:'GITHUB',repository,authorityCeiling:AUTHORITY_CEILING,trustClass:TRUST_CLASS,mutationMode:'READ_ONLY',repositoryMetadata:repo,defaultBranch,defaultBranchRef,targetBranch:targetRef,branchProtection:protection,operationTrace:trace,proofBoundary:['injected provider client','404/403 are UNKNOWN not absence','PR/issues/Actions not observed','client read-only behavior is assumed by capability contract, not independently proved here']};
}
export { AUTHORITY_CEILING, ProviderObservationError, TRUST_CLASS, observeGitHubProvider, validateBranch, validateRepo };
