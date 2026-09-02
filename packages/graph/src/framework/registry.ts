import { assertGraphModuleConformant } from './conformance';
import { GraphFrameworkError } from './errors';
import {
  COS_GRAPH_PROTOCOL_VERSION,
  GraphCapabilityBase,
  GraphCapabilityDescriptor,
  GraphModule,
} from './protocol';

export interface RegisteredGraphCapability {
  readonly moduleId: string;
  readonly capability: GraphCapabilityBase;
}

export interface GraphRegistrySnapshot {
  readonly protocol: typeof COS_GRAPH_PROTOCOL_VERSION;
  readonly modules: readonly {
    readonly id: string;
    readonly name: string;
    readonly version: string;
    readonly maturity: string;
  }[];
  readonly capabilities: readonly {
    readonly moduleId: string;
    readonly descriptor: GraphCapabilityDescriptor;
  }[];
}

export class GraphRegistry {
  private readonly modules = new Map<string, GraphModule>();
  private readonly capabilities = new Map<string, RegisteredGraphCapability>();

  async install(module: GraphModule): Promise<void> {
    assertGraphModuleConformant(module);

    const moduleId = module.manifest.id;
    if (this.modules.has(moduleId)) {
      throw new GraphFrameworkError(
        'MODULE_ALREADY_INSTALLED',
        `Module ${moduleId} is already installed`,
        { moduleId },
      );
    }

    for (const requirement of module.manifest.requires ?? []) {
      if (!requirement.optional && !this.modules.has(requirement.moduleId)) {
        throw new GraphFrameworkError(
          'MODULE_DEPENDENCY_MISSING',
          `Module ${moduleId} requires ${requirement.moduleId}`,
          { moduleId, requiredModuleId: requirement.moduleId },
        );
      }
    }

    for (const capability of module.capabilities) {
      const existing = this.capabilities.get(capability.descriptor.id);
      if (existing) {
        throw new GraphFrameworkError(
          'CAPABILITY_ALREADY_REGISTERED',
          `Capability ${capability.descriptor.id} is already registered by ${existing.moduleId}`,
          { capabilityId: capability.descriptor.id, ownerModuleId: existing.moduleId, attemptedModuleId: moduleId },
        );
      }
    }

    await module.onInstall?.({
      protocol: COS_GRAPH_PROTOCOL_VERSION,
      installedModuleIds: this.listModuleIds(),
    });

    this.modules.set(moduleId, module);
    for (const capability of module.capabilities) {
      this.capabilities.set(capability.descriptor.id, { moduleId, capability });
    }
  }

  async uninstall(moduleId: string): Promise<void> {
    const module = this.modules.get(moduleId);
    if (!module) return;

    const dependant = Array.from(this.modules.values()).find((candidate) =>
      candidate.manifest.requires?.some((requirement) => !requirement.optional && requirement.moduleId === moduleId),
    );
    if (dependant) {
      throw new GraphFrameworkError(
        'MODULE_IN_USE',
        `Cannot uninstall ${moduleId}; required by ${dependant.manifest.id}`,
        { moduleId, dependantModuleId: dependant.manifest.id },
      );
    }

    await module.onUninstall?.({
      protocol: COS_GRAPH_PROTOCOL_VERSION,
      installedModuleIds: this.listModuleIds(),
    });

    for (const capability of module.capabilities) {
      this.capabilities.delete(capability.descriptor.id);
    }
    this.modules.delete(moduleId);
  }

  resolveCapability(capabilityId: string): RegisteredGraphCapability {
    const registered = this.capabilities.get(capabilityId);
    if (!registered) {
      throw new GraphFrameworkError(
        'CAPABILITY_NOT_FOUND',
        `Capability ${capabilityId} is not registered`,
        { capabilityId },
      );
    }
    return registered;
  }

  hasModule(moduleId: string): boolean {
    return this.modules.has(moduleId);
  }

  listModuleIds(): string[] {
    return Array.from(this.modules.keys()).sort();
  }

  snapshot(): GraphRegistrySnapshot {
    const modules = Array.from(this.modules.values())
      .map((module) => ({
        id: module.manifest.id,
        name: module.manifest.name,
        version: module.manifest.version,
        maturity: module.manifest.maturity,
      }))
      .sort((left, right) => left.id.localeCompare(right.id));

    const capabilities = Array.from(this.capabilities.values())
      .map((registered) => ({
        moduleId: registered.moduleId,
        descriptor: registered.capability.descriptor,
      }))
      .sort((left, right) => left.descriptor.id.localeCompare(right.descriptor.id));

    return { protocol: COS_GRAPH_PROTOCOL_VERSION, modules, capabilities };
  }
}
