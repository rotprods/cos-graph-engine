import { CosHub } from './hub';
import {
  HubRecoveryCoordinator,
  type HubRecoveryReport,
  type IHubSnapshotStore,
} from './store';

export interface StrictHubRecoveryOptions {
  /**
   * False by default: authority restore must reconstruct every declared durable
   * resource class, not merely repository state. Set true only for explicit
   * forensic/shadow recovery while agent/workflow projectors are unavailable.
   */
  allowPartialDefinitions?: boolean;
}

/**
 * Authority wrapper around HubRecoveryCoordinator.
 *
 * The lower-level coordinator deliberately reports missing agent/workflow
 * definition projectors as warnings for backwards compatibility. This wrapper
 * upgrades those warnings into a fail-closed gate unless partial recovery was
 * explicitly authorized by the caller.
 */
export class StrictHubRecoveryCoordinator {
  private readonly inner: HubRecoveryCoordinator;

  constructor(private readonly store: IHubSnapshotStore) {
    this.inner = new HubRecoveryCoordinator(store);
  }

  async restoreLatest(
    hub: CosHub,
    options: StrictHubRecoveryOptions = {},
  ): Promise<HubRecoveryReport> {
    const stored = await this.store.latest();
    if (!stored) throw new Error('HUB_SNAPSHOT_NOT_FOUND');

    const unresolved: string[] = [];
    if (stored.snapshot.agentIds.length > 0) {
      unresolved.push(`agents=${stored.snapshot.agentIds.length}`);
    }
    if (stored.snapshot.workflowIds.length > 0) {
      unresolved.push(`workflows=${stored.snapshot.workflowIds.length}`);
    }

    if (unresolved.length > 0 && !options.allowPartialDefinitions) {
      throw new Error(
        `HUB_RESTORE_INCOMPLETE_DEFINITIONS ${unresolved.join(' ')}; `
        + 'attach the corresponding projectors or explicitly authorize partial shadow recovery',
      );
    }

    const report = await this.inner.restoreLatest(hub);
    if (!options.allowPartialDefinitions && report.warnings.length > 0) {
      throw new Error(`HUB_RESTORE_UNRESOLVED_WARNINGS: ${report.warnings.join('; ')}`);
    }
    return report;
  }
}
