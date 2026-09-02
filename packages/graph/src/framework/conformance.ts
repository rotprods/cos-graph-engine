import { GraphFrameworkError } from './errors';
import {
  COS_GRAPH_PROTOCOL_VERSION,
  GraphCapabilityDescriptor,
  GraphModule,
} from './protocol';

export interface GraphConformanceIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface GraphConformanceReport {
  readonly valid: boolean;
  readonly issues: readonly GraphConformanceIssue[];
}

const IDENTIFIER = /^[a-z][a-z0-9._/-]*$/;
const VERSION = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

function descriptorsMatch(left: GraphCapabilityDescriptor, right: GraphCapabilityDescriptor): boolean {
  return (
    left.id === right.id &&
    left.kind === right.kind &&
    left.version === right.version &&
    left.maturity === right.maturity &&
    left.description === right.description &&
    left.determinism === right.determinism &&
    left.sideEffects === right.sideEffects &&
    left.idempotency === right.idempotency &&
    left.modes.length === right.modes.length &&
    left.modes.every((mode, index) => mode === right.modes[index])
  );
}

function validateDescriptor(
  descriptor: GraphCapabilityDescriptor,
  path: string,
  issues: GraphConformanceIssue[],
): void {
  if (!IDENTIFIER.test(descriptor.id)) {
    issues.push({ code: 'INVALID_CAPABILITY_ID', path: `${path}.id`, message: `Invalid capability id: ${descriptor.id}` });
  }
  if (!VERSION.test(descriptor.version)) {
    issues.push({ code: 'INVALID_CAPABILITY_VERSION', path: `${path}.version`, message: `Invalid semantic version: ${descriptor.version}` });
  }
  if (descriptor.description.trim().length === 0) {
    issues.push({ code: 'EMPTY_CAPABILITY_DESCRIPTION', path: `${path}.description`, message: 'Capability description must not be empty' });
  }
  if (descriptor.modes.length === 0) {
    issues.push({ code: 'EMPTY_EXECUTION_MODES', path: `${path}.modes`, message: 'Capability must support at least one execution mode' });
  }
  if (new Set(descriptor.modes).size !== descriptor.modes.length) {
    issues.push({ code: 'DUPLICATE_EXECUTION_MODE', path: `${path}.modes`, message: 'Capability execution modes must be unique' });
  }
  if (descriptor.idempotency === 'required' && descriptor.sideEffects === 'none') {
    issues.push({
      code: 'UNNECESSARY_IDEMPOTENCY_REQUIREMENT',
      path: `${path}.idempotency`,
      message: 'Read-only capabilities must not require idempotency keys',
    });
  }
}

export function inspectGraphModule(module: GraphModule): GraphConformanceReport {
  const issues: GraphConformanceIssue[] = [];
  const { manifest } = module;

  if (!IDENTIFIER.test(manifest.id)) {
    issues.push({ code: 'INVALID_MODULE_ID', path: 'manifest.id', message: `Invalid module id: ${manifest.id}` });
  }
  if (!VERSION.test(manifest.version)) {
    issues.push({ code: 'INVALID_MODULE_VERSION', path: 'manifest.version', message: `Invalid semantic version: ${manifest.version}` });
  }
  if (manifest.protocol !== COS_GRAPH_PROTOCOL_VERSION) {
    issues.push({
      code: 'PROTOCOL_MISMATCH',
      path: 'manifest.protocol',
      message: `Expected ${COS_GRAPH_PROTOCOL_VERSION}, received ${manifest.protocol}`,
    });
  }
  if (manifest.name.trim().length === 0) {
    issues.push({ code: 'EMPTY_MODULE_NAME', path: 'manifest.name', message: 'Module name must not be empty' });
  }
  if (manifest.description.trim().length === 0) {
    issues.push({ code: 'EMPTY_MODULE_DESCRIPTION', path: 'manifest.description', message: 'Module description must not be empty' });
  }

  const manifestIds = new Set<string>();
  manifest.capabilities.forEach((descriptor, index) => {
    validateDescriptor(descriptor, `manifest.capabilities[${index}]`, issues);
    if (manifestIds.has(descriptor.id)) {
      issues.push({
        code: 'DUPLICATE_MANIFEST_CAPABILITY',
        path: `manifest.capabilities[${index}].id`,
        message: `Duplicate capability descriptor: ${descriptor.id}`,
      });
    }
    manifestIds.add(descriptor.id);
  });

  const implementationIds = new Set<string>();
  module.capabilities.forEach((capability, index) => {
    const id = capability.descriptor.id;
    if (implementationIds.has(id)) {
      issues.push({
        code: 'DUPLICATE_IMPLEMENTED_CAPABILITY',
        path: `capabilities[${index}].descriptor.id`,
        message: `Duplicate capability implementation: ${id}`,
      });
    }
    implementationIds.add(id);
    const declared = manifest.capabilities.find((descriptor) => descriptor.id === id);
    if (!declared) {
      issues.push({
        code: 'UNDECLARED_CAPABILITY_IMPLEMENTATION',
        path: `capabilities[${index}]`,
        message: `Capability ${id} is implemented but absent from the manifest`,
      });
    } else if (!descriptorsMatch(declared, capability.descriptor)) {
      issues.push({
        code: 'CAPABILITY_DESCRIPTOR_DRIFT',
        path: `capabilities[${index}].descriptor`,
        message: `Capability ${id} implementation metadata does not match its manifest declaration`,
      });
    }
  });

  for (const id of manifestIds) {
    if (!implementationIds.has(id)) {
      issues.push({
        code: 'MISSING_CAPABILITY_IMPLEMENTATION',
        path: 'capabilities',
        message: `Manifest capability ${id} has no implementation`,
      });
    }
  }

  const requirementIds = new Set<string>();
  for (const requirement of manifest.requires ?? []) {
    if (!IDENTIFIER.test(requirement.moduleId)) {
      issues.push({
        code: 'INVALID_REQUIREMENT_ID',
        path: 'manifest.requires',
        message: `Invalid required module id: ${requirement.moduleId}`,
      });
    }
    if (requirement.moduleId === manifest.id) {
      issues.push({ code: 'SELF_DEPENDENCY', path: 'manifest.requires', message: 'A module cannot require itself' });
    }
    if (requirementIds.has(requirement.moduleId)) {
      issues.push({
        code: 'DUPLICATE_MODULE_REQUIREMENT',
        path: 'manifest.requires',
        message: `Duplicate module requirement: ${requirement.moduleId}`,
      });
    }
    requirementIds.add(requirement.moduleId);
  }

  return { valid: issues.length === 0, issues };
}

export function assertGraphModuleConformant(module: GraphModule): void {
  const report = inspectGraphModule(module);
  if (!report.valid) {
    throw new GraphFrameworkError(
      'MODULE_CONFORMANCE_FAILED',
      `Module ${module.manifest.id} does not conform to ${COS_GRAPH_PROTOCOL_VERSION}`,
      { issues: report.issues },
    );
  }
}
