import { execFile } from 'node:child_process';
import { realpath, stat } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const SHA40 = /^[0-9a-f]{40}$/;
const SAFE_BRANCH = /^(?!-)(?!.*\.\.)(?!.*@\{)(?!.*\/\/)(?!.*\.lock(?:\/|$))[A-Za-z0-9._/-]+$/;
const AUTHORITY_CEILING = 'SHADOW_ONLY';
const TRUST_CLASS = 'INTEGRITY_ONLY';
const GIT_BASE_ARGS = ['-c','core.fsmonitor=false','-c','core.untrackedCache=false','-c','core.preloadindex=false','-c','pager.status=false'];
const GIT_BINARY = '/usr/bin/git';
const EXECUTABLE_CONFIG_PATTERN = '^(filter\..*\.(clean|process|smudge)|diff\..*\.command)$';

class ObservationError extends Error {
  constructor(code, detail='') { super(`${code}: ${detail}`); this.code=code; this.detail=detail; }
}
const fail=(code,detail='')=>{throw new ObservationError(code,detail)};
const ok=(v,code,detail='')=>{if(!v)fail(code,detail)};

function minimalGitEnv(sourceEnv=process.env){
  return {
    PATH: '/usr/bin:/bin',
    HOME: '/nonexistent-cos-observer-home',
    LANG: 'C',
    LC_ALL: 'C',
    GIT_OPTIONAL_LOCKS: '0',
    GIT_PAGER: 'cat',
    PAGER: 'cat',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
    GIT_TERMINAL_PROMPT: '0'
  };
}

function validateTargetBranch(value){
  ok(typeof value==='string' && value.length>0 && value.length<=200, 'TARGET_BRANCH_INVALID', String(value));
  ok(SAFE_BRANCH.test(value), 'TARGET_BRANCH_INVALID', value);
  return value;
}

function classifyGitOperation(args){
  ok(Array.isArray(args) && args.every(x=>typeof x==='string'), 'GIT_ARGS_INVALID');
  const joined=args.join('\0');
  if(joined==='rev-parse\0--show-toplevel') return 'ROOT';
  if(joined==='rev-parse\0--verify\0HEAD') return 'HEAD';
  if(args.length===3 && args[0]==='rev-parse' && args[1]==='--verify' && args[2].startsWith('refs/heads/')) {
    validateTargetBranch(args[2].slice('refs/heads/'.length)); return 'TARGET_REF';
  }
  if(joined==='symbolic-ref\0--quiet\0--short\0HEAD') return 'CURRENT_BRANCH';
  if(joined==='symbolic-ref\0--quiet\0--short\0refs/remotes/origin/HEAD') return 'ORIGIN_HEAD';
  if(joined===`config\0--local\0--name-only\0--get-regexp\0${EXECUTABLE_CONFIG_PATTERN}`) return 'EXECUTABLE_CONFIG_SCAN';
  if(joined==='status\0--porcelain=v1\0-z\0--untracked-files=normal\0--ignore-submodules=all') return 'WORKTREE_STATUS';
  fail('GIT_OPERATION_NOT_ALLOWED', args.join(' '));
}

async function defaultRunGit({cwd,args,env,timeoutMs=5000}){
  const operation=classifyGitOperation(args);
  const fullArgs=[...GIT_BASE_ARGS,...args];
  try {
    const {stdout,stderr}=await execFileAsync(GIT_BINARY,fullArgs,{cwd,env,timeout:timeoutMs,maxBuffer:1024*1024,windowsHide:true,encoding:'utf8'});
    return {ok:true,stdout,stderr,code:0,operation};
  } catch(error) {
    return {ok:false,stdout:typeof error.stdout==='string'?error.stdout:'',stderr:typeof error.stderr==='string'?error.stderr:'',code:Number.isInteger(error.code)?error.code:1,timedOut:Boolean(error.killed),operation};
  }
}

const observed=value=>({status:'OBSERVED',value});
const unknown=reason=>({status:'UNKNOWN',value:null,reason});

async function observeLocalGit({repoPath,targetBranch='main',runGit=defaultRunGit,now=()=>new Date().toISOString(),sourceEnv=process.env}={}){
  validateTargetBranch(targetBranch);
  ok(typeof repoPath==='string' && repoPath.length>0,'REPOSITORY_PATH_REQUIRED');
  let root;
  try {
    root=await realpath(repoPath);
    const info=await stat(root);
    ok(info.isDirectory(),'REPOSITORY_PATH_NOT_DIRECTORY',root);
  } catch(error) {
    if(error instanceof ObservationError) throw error;
    fail('REPOSITORY_PATH_UNAVAILABLE',String(error.code ?? error.message));
  }

  const env=minimalGitEnv(sourceEnv);
  const trace=[];
  const run=async args=>{
    const operation=classifyGitOperation(args);
    trace.push({operation,command:args[0],args:[...args]});
    return runGit({cwd:root,args,env});
  };

  const top=await run(['rev-parse','--show-toplevel']);
  if(!top.ok) fail('REPOSITORY_GIT_CONTEXT_UNAVAILABLE');
  const gitRoot=(top.stdout ?? '').trim(); ok(gitRoot.length>0,'REPOSITORY_ROOT_EMPTY');

  const head=await run(['rev-parse','--verify','HEAD']);
  let headSha;
  if(head.ok){const value=(head.stdout ?? '').trim();ok(SHA40.test(value),'HEAD_SHA_INVALID',value);headSha=observed(value);}
  else headSha=unknown('HEAD_SHA_UNAVAILABLE');

  const current=await run(['symbolic-ref','--quiet','--short','HEAD']);
  const currentBranch=current.ok ? observed(current.stdout.trim()) : unknown('DETACHED_HEAD');

  const targetRef=await run(['rev-parse','--verify',`refs/heads/${targetBranch}`]);
  let target;
  if(targetRef.ok){const sha=targetRef.stdout.trim();ok(SHA40.test(sha),'TARGET_SHA_INVALID',sha);target={status:'OBSERVED',name:targetBranch,sha};}
  else target={status:'UNKNOWN',name:targetBranch,sha:null,reason:'TARGET_REF_UNAVAILABLE_LOCALLY'};

  const originHead=await run(['symbolic-ref','--quiet','--short','refs/remotes/origin/HEAD']);
  let defaultBranch;
  if(originHead.ok){const value=originHead.stdout.trim();ok(value.startsWith('origin/'),'ORIGIN_HEAD_FORMAT',value);defaultBranch=observed(value.slice('origin/'.length));}
  else defaultBranch=unknown('ORIGIN_HEAD_UNAVAILABLE');

  const executableConfig=await run(['config','--local','--name-only','--get-regexp',EXECUTABLE_CONFIG_PATTERN]);
  let workingTree;
  const noExecutableConfig = !executableConfig.ok && executableConfig.code===1 && !executableConfig.timedOut && executableConfig.stdout.trim().length===0;
  if(executableConfig.ok && executableConfig.stdout.trim().length>0){
    workingTree={status:'UNKNOWN',dirty:null,entryCount:null,reason:'WORKTREE_STATUS_WITHHELD_UNSAFE_REPO_CONFIG'};
  } else if(executableConfig.ok || noExecutableConfig) {
    const status=await run(['status','--porcelain=v1','-z','--untracked-files=normal','--ignore-submodules=all']);
    if(status.ok){const entries=status.stdout.length===0?[]:status.stdout.split('\0').filter(Boolean);workingTree={status:'OBSERVED',dirty:entries.length>0,entryCount:entries.length};}
    else workingTree={status:'UNKNOWN',dirty:null,entryCount:null,reason:'WORKTREE_STATUS_UNAVAILABLE'};
  } else {
    workingTree={status:'UNKNOWN',dirty:null,entryCount:null,reason:'WORKTREE_STATUS_WITHHELD_CONFIG_SCAN_FAILED'};
  }

  return {
    schemaVersion:1,snapshotType:'LIVE_TRUTH_LOCAL_GIT',observerVersion:'4.1.0-alpha.8',observedAt:now(),authorityCeiling:AUTHORITY_CEILING,trustClass:TRUST_CLASS,mutationMode:'READ_ONLY',
    repositoryRoot:observed(gitRoot),headSha,currentBranch,targetBranch:target,defaultBranch,workingTree,commandTrace:trace,
    proofBoundary:['local Git only','remote/provider state not inferred from local absence','branch protection/PR/Actions not observed']
  };
}

export { AUTHORITY_CEILING, EXECUTABLE_CONFIG_PATTERN, GIT_BASE_ARGS, GIT_BINARY, ObservationError, TRUST_CLASS, classifyGitOperation, defaultRunGit, minimalGitEnv, observeLocalGit, validateTargetBranch };
