import { assertGraphModuleConformant } from './conformance';
import { GraphFrameworkError } from './errors';
import {
  COS_GRAPH_PROTOCOL_VERSION,
  GraphCapabilityBase,
  GraphCapabilityDescriptor,
  GraphExecutionContext,
  GraphModule,
  GraphModuleManifest,
} from './protocol';

export interface RegisteredGraphCapability {
  readonly moduleId: string;
  readonly capability: GraphCapabilityBase;
  readonly descriptor: GraphCapabilityDescriptor;
  invokeRaw(input: unknown, context: GraphExecutionContext): Promise<unknown>;
}

interface RegisteredGraphModule {
  readonly module: GraphModule;
  readonly manifest: GraphModuleManifest;
  readonly capabilityIds: readonly string[];
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

function snapshotDescriptor(descriptor: GraphCapabilityDescriptor): GraphCapabilityDescriptor {
  return Object.freeze({ ...descriptor, modes: Object.freeze([...descriptor.modes]) });
}

function snapshotManifest(manifest: GraphModuleManifest): GraphModuleManifest {
  return Object.freeze({
    ...manifest,
    capabilities: Object.freeze(manifest.capabilities.map(snapshotDescriptor)),
    requires: manifest.requires
      ? Object.freeze(manifest.requires.map((requirement) => Object.freeze({ ...requirement })))
      : undefined,
  });
}

export class GraphRegistry {
  private readonly modules = new Map<string, RegisteredGraphModule>();
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

    // Snapshot all security- and routing-relevant metadata before lifecycle code can yield.
    // Third-party module objects are treated as mutable/untrusted configuration surfaces.
    const manifest = snapshotManifest(module.manifest);
    const capabilityRecords = module.capabilities.map((capability): RegisteredGraphCapability => {
      const descriptor = snapshotDescriptor(capability.descriptor);
      return {
        moduleId,
        capability,
        descriptor,
        invokeRaw: capability.invokeRaw.bind(capability),
      };
    });
    const capabilityIds = Object.freeze(capabilityRecords.map((registered) => registered.descriptor.id));

    await module.onInstall?.({
      protocol: COS_GRAPH_PROTOCOL_VERSION,
      installedModuleIds: this.listModuleIds(),
    });

    this.modules.set(moduleId, { module, manifest, capabilityIds });
    for (const registered of capabilityRecords) {
      this.capabilities.set(registered.descriptor.id, registered);
    }
  }

  async uninstall(moduleId: string): Promise<void> {
    const registeredModule = this.modules.get(moduleId);
    if (!registeredModule) return;

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

    await registeredModule.module.onUninstall?.({
      protocol: COS_GRAPH_PROTOCOL_VERSION,
      installedModuleIds: this.listModuleIds(),
    });

    for (const capabilityId of registeredModule.capabilityIds) {
      this.capabilities.delete(capabilityId);
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
      .map((registered) => ({
        id: registered.manifest.id,
        name: registered.manifest.name,
        version: registered.manifest.version,
        maturity: registered.manifest.maturity,
      }))
      .sort((left, right) => left.id.localeCompare(right.id));

    const capabilities = Array.from(this.capabilities.values())
      .map((registered) => ({
        moduleId: registered.moduleId,
        descriptor: registered.descriptor,
      }))
      .sort((left, right) => left.descriptor.id.localeCompare(right.descriptor.id));

    return { protocol: COS_GRAPH_PROTOCOL_VERSION, modules, capabilities };
  }
}
