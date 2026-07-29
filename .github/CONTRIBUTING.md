# Contributing to COS Graph Engine

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Welcome

Thank you for considering contributing to COS Graph Engine! We welcome contributions of all kinds: bug fixes, new features, performance improvements, documentation, and tests.

## Getting Started

### Prerequisites
- Node.js 18+ (20+ recommended for best WASM support)
- npm or bun
- TypeScript basics

### Development Setup
```bash
git clone https://github.com/rotprods/cos-graph-engine.git
cd cos-graph-engine
npm install
```

### Available Commands
```bash
npm run test:all    # Run all test suites
npm run build       # Build TypeScript packages
npm run ci          # Full CI pipeline
npm run benchmark   # Run performance benchmarks
```

## Development Workflow

### Git Flow
1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature-name`
3. Make your changes
4. Write or update tests
5. Run `npm run test:all` to ensure everything passes
6. Commit using conventional commits
7. Push and open a Pull Request

### Commit Conventions
We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]
[optional footer]
```

**Types**: `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `chore`, `style`, `ci`
**Scopes**: `graph`, `wasm`, `observability`, `visualization`, `core`, `runtime`, `memory`, `knowledge`, `api`, `cli`, `ci`, `docker`, `docs`

Examples:
- `feat(graph): add direction-optimizing BFS with 3x speedup`
- `fix(wasm): correct memory growth on large graphs >64KB`
- `perf(core): replace Set with Uint8Array for adjacency checks`
- `docs: update API reference with new method signatures`

## Coding Standards

### TypeScript
- **Strict mode enabled** — no implicit any, strict null checks
- **Zero runtime dependencies** — no new external packages unless approved
- **ESM modules** — use `import`/`export` syntax
- **Documentation** — JSDoc comments on all public APIs
- **Error handling** — throw typed errors, never `any`

### AssemblyScript (WASM)
- Modules in `packages/wasm/assembly/`
- Use `--runtime stub` for minimal binary size
- Export functions must be simple numeric input/output
- Always provide JS fallback for no-WASM environments

### Testing
- Tests in `*.test.ts` files alongside source
- Use `tsx` runner (no Jest/Mocha dependencies)
- Test coverage target: 90%+ lines
- Edge cases: empty graphs, single nodes, disconnected graphs, cycles, NaN inputs

### Zero-Dependency Policy
The project runs on **zero external runtime dependencies**. All ORM, cache, queue, auth, LLM, crawler, storage, and infrastructure must be built in-house. Only Stripe, SendGrid, LangChain, and Algolia are permitted as external exceptions.

## Pull Request Process
1. Ensure your PR description clearly describes the problem and solution
2. Update the README and/or package README with details of changes if appropriate
3. Update CHANGELOG.md with any user-facing changes
4. The PR will be reviewed by at least one maintainer
5. Address review feedback and update your PR
6. Once approved, a maintainer will merge your PR

## Review Process
- All code changes require at least one maintainer review
- Review criteria: correctness, performance, test coverage, code style, zero-dep compliance
- Adversarial review: we may challenge assumptions to ensure robustness
- Benchmark regression checks are run on performance-related changes

## License
By contributing, you agree that your contributions will be licensed under the MIT License.
