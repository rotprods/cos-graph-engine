const SHA40=/^[0-9a-f]{40}$/;
const STATES=new Set(['OBSERVED','UNKNOWN']);
const REQUIRED=['repositoryRoot','headSha','currentBranch','targetBranch','defaultBranch','workingTree'];
const ALLOWED_UNKNOWN=new Set(['HEAD_SHA_UNAVAILABLE','DETACHED_HEAD','TARGET_REF_UNAVAILABLE_LOCALLY','ORIGIN_HEAD_UNAVAILABLE','WORKTREE_STATUS_UNAVAILABLE','WORKTREE_STATUS_WITHHELD_UNSAFE_REPO_CONFIG','WORKTREE_STATUS_WITHHELD_CONFIG_SCAN_FAILED']);

class SnapshotError extends Error{constructor(code,detail=''){super(`${code}: ${detail}`);this.code=code;this.detail=detail}}
const fail=(c,d='')=>{throw new SnapshotError(c,d)};const ok=(v,c,d='')=>{if(!v)fail(c,d)};const eq=(a,b,c,d='')=>{if(a!==b)fail(c,`${d} expected=${JSON.stringify(b)} actual=${JSON.stringify(a)}`)};

function validateField(name,field){
  ok(field&&typeof field==='object'&&!Array.isArray(field),'FIELD_OBJECT',name);
  ok(STATES.has(field.status),'FIELD_STATUS',`${name}:${field.status}`);
  if(field.status==='UNKNOWN'){
    eq(field.value??field.sha??field.dirty??null,null,'UNKNOWN_VALUE_MUST_BE_NULL',name);
    ok(ALLOWED_UNKNOWN.has(field.reason),'UNKNOWN_REASON',`${name}:${field.reason}`);
  }
}
function validateSnapshot(snapshot){
  eq(snapshot.schemaVersion,1,'SNAPSHOT_SCHEMA');
  eq(snapshot.snapshotType,'LIVE_TRUTH_LOCAL_GIT','SNAPSHOT_TYPE');
  eq(snapshot.observerVersion,'4.1.0-alpha.8','OBSERVER_VERSION');
  eq(snapshot.authorityCeiling,'SHADOW_ONLY','SNAPSHOT_AUTHORITY');
  eq(snapshot.trustClass,'INTEGRITY_ONLY','SNAPSHOT_TRUST');
  eq(snapshot.mutationMode,'READ_ONLY','SNAPSHOT_MUTATION_MODE');
  ok(Number.isFinite(Date.parse(snapshot.observedAt)),'SNAPSHOT_TIME');
  for(const name of REQUIRED){ok(Object.hasOwn(snapshot,name),'SNAPSHOT_FIELD_MISSING',name);validateField(name,snapshot[name])}
  ok(snapshot.repositoryRoot.status==='OBSERVED','ROOT_MUST_BE_OBSERVED');
  if(snapshot.headSha.status==='OBSERVED')ok(SHA40.test(snapshot.headSha.value),'HEAD_MUST_BE_EXACT');
  else eq(snapshot.headSha.reason,'HEAD_SHA_UNAVAILABLE','HEAD_UNKNOWN_REASON');
  if(snapshot.currentBranch.status==='OBSERVED')ok(typeof snapshot.currentBranch.value==='string'&&snapshot.currentBranch.value.length>0,'CURRENT_BRANCH_VALUE');
  if(snapshot.targetBranch.status==='OBSERVED')ok(SHA40.test(snapshot.targetBranch.sha),'TARGET_BRANCH_SHA');
  ok(Array.isArray(snapshot.commandTrace)&&(snapshot.commandTrace.length===6||snapshot.commandTrace.length===7),'COMMAND_TRACE_COUNT');
  const operations=snapshot.commandTrace.map(x=>x.operation);
  const allowedOps=new Set(['ROOT','HEAD','CURRENT_BRANCH','TARGET_REF','ORIGIN_HEAD','EXECUTABLE_CONFIG_SCAN','WORKTREE_STATUS']);
  ok(operations.every(x=>allowedOps.has(x)),'COMMAND_TRACE_MUTATION');
  ok(snapshot.commandTrace.every(x=>!['fetch','pull','push','checkout','switch','reset','clean','update-ref','commit','merge','rebase'].includes(x.command)),'COMMAND_TRACE_WRITE');
  if(['WORKTREE_STATUS_WITHHELD_UNSAFE_REPO_CONFIG','WORKTREE_STATUS_WITHHELD_CONFIG_SCAN_FAILED'].includes(snapshot.workingTree.reason))ok(!operations.includes('WORKTREE_STATUS'),'UNSAFE_STATUS_EXECUTED');
  ok(Array.isArray(snapshot.proofBoundary)&&snapshot.proofBoundary.some(x=>x.includes('remote/provider state not inferred')),'PROOF_BOUNDARY_REMOTE');
  return true;
}

export { SnapshotError, validateSnapshot };
