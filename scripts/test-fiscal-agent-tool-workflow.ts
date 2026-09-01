import { strict as assert } from 'node:assert';
import {
  buildFiscalAgentRuntime,
  buildFiscalToolFabric,
} from '../packages/graph/src/profiles/fiscal-agent-runtime';
import {
  CrewAIAdapter,
  LangGraphAdapter,
  type COSContextPack,
} from '../packages/graph/src/profiles/fiscal-external-adapters';

const runtime = buildFiscalAgentRuntime();
assert.deepEqual(runtime.agents.validate(), []);
assert.deepEqual(runtime.tools.validate(), []);
assert.equal(runtime.workflows.size, 4);
for (const [name, workflow] of runtime.workflows) {
  assert.deepEqual(workflow.validate(), [], `${name} workflow must validate`);
  assert.equal(workflow.detectCycle(), null, `${name} must be acyclic`);
  assert.ok(workflow.getNodes().length > 1);
}

const agentNodes = runtime.agents.getNodes();
assert.ok(agentNodes.some(a => a.name === 'Mission Commander'));
assert.ok(agentNodes.some(a => a.capabilities.includes('HUMAN_ONLY') && a.name.includes('Tax Adviser')));
assert.ok(agentNodes.some(a => a.capabilities.includes('HUMAN_ONLY') && a.name.includes('Owner Approval')));

const quarterly = runtime.workflows.get('quarterly-close')!;
assert.ok(quarterly.getNodes().some(n => n.service === 'HUMAN_ONLY' && n.name.includes('adviser')));
assert.ok(quarterly.getNodes().some(n => n.service === 'HUMAN_ONLY' && n.name.includes('Owner')));

const tools = buildFiscalToolFabric();
const gmailRead = tools.decide({
  capability: 'email_search', operation: 'READ', maxSensitivity: 'RESTRICTED_FINANCIAL',
});
assert.equal(gmailRead.allowed, true);
assert.equal(gmailRead.tool?.name, 'Gmail');

const gmailWriteDenied = tools.decide({
  capability: 'email_draft', operation: 'WRITE', maxSensitivity: 'RESTRICTED_FINANCIAL', humanWriteApproval: false,
});
assert.equal(gmailWriteDenied.allowed, false);
assert.match(gmailWriteDenied.reason, /requires explicit human approval/);

const gmailWriteAllowed = tools.decide({
  capability: 'email_draft', operation: 'WRITE', maxSensitivity: 'RESTRICTED_FINANCIAL', humanWriteApproval: true,
});
assert.equal(gmailWriteAllowed.allowed, true);

const authorityUnavailable = tools.decide({
  capability: 'authority_filing_truth', operation: 'READ', maxSensitivity: 'RESTRICTED_FINANCIAL',
});
assert.equal(authorityUnavailable.allowed, false);
assert.match(authorityUnavailable.reason, /unavailable/);

const restrictedDenied = tools.decide({
  capability: 'sql_read', operation: 'READ', maxSensitivity: 'INTERNAL',
});
assert.equal(restrictedDenied.allowed, false);
assert.match(restrictedDenied.reason, /exceeds allowed sensitivity/);

const crew = new CrewAIAdapter();
const imported = crew.importDefinition({
  id: 'crew-close',
  name: 'Quarter close crew',
  agents: [{ id: 'researcher', name: 'Researcher', role: 'researcher' }],
  tasks: [
    { id: 'collect', name: 'Collect evidence', agent: 'researcher' },
    { id: 'review', name: 'Review', dependsOn: ['collect'] },
  ],
});
assert.equal(imported.framework, 'crewai');
assert.equal(imported.actors.length, 1);
assert.equal(imported.tasks.length, 2);
assert.deepEqual(imported.tasks[1].dependsOn, ['collect']);

const context: COSContextPack = {
  query: 'Prepare evidence review',
  taskId: 'review',
  evidenceIds: ['evidence:1'],
  facts: [{ id: 'fact:1', text: 'A verified fact', truthClass: 'CONFIRMED' }],
  unresolvedGaps: ['receipt missing'],
  toolCapabilities: ['email_search'],
  sensitivity: 'RESTRICTED_FINANCIAL',
};
const exported = crew.exportContext(context);
assert.equal((exported.policy as Record<string, unknown>).canonicalStateOwner, 'COS');
assert.equal((exported.policy as Record<string, unknown>).legalTruthMutationAllowed, false);

const observation = crew.ingestRunResult({
  runId: 'run-1', framework: 'crewai', output: { recommendation: 'review receipt' }, trace: ['step-1'],
});
assert.equal(observation.canonicalTruth, false);
assert.equal(observation.requiresValidation, true);
assert.equal(observation.sourceClass, 'EXTERNAL_RUNTIME_OBSERVATION');

const langGraph = new LangGraphAdapter();
assert.throws(
  () => langGraph.ingestRunResult({ runId: 'wrong', framework: 'crewai', output: {} }),
  /cannot ingest crewai run/,
);

console.log('Fiscal L13-L15 runtime + adapters: PASS');
