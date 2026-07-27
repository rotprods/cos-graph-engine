"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gen = gen;
exports.createMemoryBackend = createMemoryBackend;
exports.createMemoryMediaAdapter = createMemoryMediaAdapter;
exports.createMemoryProfileAdapter = createMemoryProfileAdapter;
const media_1 = require("@higgsfield/fnf/media");
function gen(id, status, extra) {
    return { id, model: 'demo', type: 'image', status, input: { model: 'demo', settings: {} }, ...extra };
}
// In-memory port stubs, inlined from @higgsfield/fnf-adapters' memory adapters.
// fnf-react tests must depend only on @higgsfield/fnf so the vendored snapshot
// (template app/packages/) stays self-sufficient without the adapters package.
function createMemoryBackend(options = {}) {
    const jobs = new Map();
    const cost = options.cost ?? 1;
    let seq = 0;
    return {
        async createJobs({ jobSetType, params }) {
            const id = `mem_${++seq}`;
            jobs.set(id, {
                id,
                job_set_type: jobSetType,
                status: 'completed',
                params,
                result_url: `memory://${jobSetType}/${id}.out`,
                created_at: seq,
            });
            return [id];
        },
        async getJob(id) {
            return jobs.get(id) ?? { id, status: 'failed', fail_reason: 'not found' };
        },
        async listJobs() {
            return { items: [...jobs.values()], next_cursor: null };
        },
        async estimateCost() {
            return { credits: cost };
        },
    };
}
function createMemoryMediaAdapter() {
    let seq = 0;
    return {
        async getMedia({ id }) {
            return { id, type: 'media_input' };
        },
        async listMedia() {
            return { items: [], next_cursor: null };
        },
        async getUploadUrl({ type }) {
            const id = `mem_media_${++seq}`;
            return { id, type: media_1.REF_TYPE_BY_UPLOAD[type], url: `memory://${type}/${id}`, upload_url: `memory://upload/${id}` };
        },
        async confirmMedia({ mediaId, type }) {
            return { id: mediaId, status: 'uploaded', type: media_1.REF_TYPE_BY_UPLOAD[type], url: `memory://${type}/${mediaId}` };
        },
    };
}
const DEFAULT_USER = {
    id: 'mem_user',
    email: 'memory@example.com',
    workspace_id: 'mem_private',
    workspace_type: 'private',
    workspace_role: 'owner',
    workspace_membership_exists: true,
    plan_type: 'free',
    credits: 0,
    billing_period: 'monthly',
    total_plan_credits: 0,
    package_credits: 0,
    subscription_credits: 0,
};
const DEFAULT_WORKSPACES = [
    {
        id: 'mem_private',
        clerk_organization_id: '',
        name: 'Personal',
        type: 'private',
        user_role: 'owner',
    },
];
const DEFAULT_WALLET = {
    workspace_id: 'mem_private',
    subscription_balance: 0,
    total_credits: 0,
    credits_balance: 0,
    on_demand_credits: 0,
    wallet_created_at: null,
    next_credit_allocation_date: null,
};
function createMemoryProfileAdapter(options = {}) {
    const user = { ...DEFAULT_USER, ...options.user };
    const workspaces = options.workspaces?.map(item => ({ ...item })) ?? DEFAULT_WORKSPACES.map(item => ({ ...item }));
    const wallet = { ...DEFAULT_WALLET, ...options.wallet };
    let currentWorkspaceId = options.currentWorkspaceId
        ?? (typeof user.workspace_id === 'string' ? user.workspace_id : undefined)
        ?? (typeof workspaces[0]?.id === 'string' ? workspaces[0].id : 'mem_private');
    const currentWorkspace = () => workspaces.find(workspace => workspace.id === currentWorkspaceId) ?? workspaces[0] ?? null;
    return {
        async getUser() {
            const workspace = currentWorkspace();
            return {
                ...user,
                ...(workspace
                    ? {
                        workspace_id: workspace.id,
                        workspace_type: workspace.type,
                        workspace_role: workspace.user_role,
                    }
                    : {}),
            };
        },
        async listWorkspaces() {
            return workspaces;
        },
        async getCurrentWorkspace() {
            return currentWorkspace();
        },
        async getWorkspaceWallet() {
            return {
                ...wallet,
                workspace_id: currentWorkspaceId,
            };
        },
        async switchWorkspace({ workspaceId }) {
            currentWorkspaceId = workspaceId;
            return {};
        },
    };
}
//# sourceMappingURL=test-utils.js.map