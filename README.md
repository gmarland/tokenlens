# TokenLens

TokenLens measures how Claude Code and Codex interact with your repository and
helps identify relationships between codebase structure and agent context
consumption. It combines privacy-preserving agent telemetry with local static
repository analysis; it is not a generic usage dashboard or an employee
productivity score.

> Demo data is synthetic and exists only to exercise the product. Correlations
> in demo mode are not research findings.

## Architecture

```text
Claude/Codex hooks ── repo, provider, turn ID, relative file paths ─┐
Claude/Codex OTLP ─── tokens, model, API and tool events ──────────┼─> Next.js ingestion ─> PostgreSQL
Local profiler ────── snapshot and file metrics ──────────────────┘                         │
                                                                                           v
Repository structure <──────── analytics + file attribution <──────────────── Dashboard
```

The CLI never proxies agent traffic, reads transcript files, or uploads source
contents. Next.js route handlers authenticate and validate requests, then call
package-level ingestion services. Events are idempotent and can arrive in any
order.

## Local setup

Use the current Node.js LTS and pnpm:

```bash
cp .env.example .env
pnpm install
docker compose up -d
pnpm demo:seed
pnpm test
pnpm dev
```

Open <http://localhost:3000>. The default development ingest key is
`development-key-change-me`; replace it outside local development.

## Agent setup

Install the package so `repo-profiler` is on `PATH`, then choose one provider or
install both:

```bash
repo-profiler install --provider claude --endpoint http://localhost:3000 --key development-key-change-me
repo-profiler install --provider codex --endpoint http://localhost:3000 --key development-key-change-me
# or: repo-profiler install --provider all ...
```

For Codex, open `/hooks` once after installation and review and trust the two
TokenLens hooks. Check either integration with:

```bash
repo-profiler doctor --provider claude
repo-profiler doctor --provider codex
```

Claude installation backs up `~/.claude/settings.json`, preserves unrelated
settings and hooks, and installs asynchronous `UserPromptSubmit` and
`PostToolUse` hooks. Codex installation similarly backs up and preserves
`~/.codex/hooks.json` and `~/.codex/config.toml`, adding a marked TokenLens OTel
block. Existing non-TokenLens OTel destinations are preserved unless `--force`
is explicitly supplied. Installation is idempotent.

Scan on demand with `repo-profiler scan .`; `--force` bypasses the local snapshot
cache. Remove only TokenLens-owned settings with
`repo-profiler uninstall --provider claude|codex|all`.

Prompt text is disabled by default. Explicitly opt in with
`--capture-prompts`. Both providers otherwise send only prompt length.

## Privacy and security

By default, the server receives provider, prompt/session identifiers, prompt
character length, available developer identity, normalized Git remote identity,
branch/commit/dirty state, relative file paths, token totals, model and tool
metadata, and repository/file structural metrics.

It does **not** receive prompt text unless opted in, assistant responses, source
contents, tool output, search patterns, matched text, raw terminal output,
credentials from Git remotes, or absolute local paths. Source and dependency
analysis happens locally. Ingest routes require a bearer secret; only its SHA-256
digest is stored in PostgreSQL. Payloads are size-limited and relative paths
reject traversal.

Codex plan usage does not expose a comparable per-turn dollar cost, so TokenLens
records Codex cost as unavailable. OpenAI cached input is normalized as a subset
of input tokens before storage to prevent double-counting.

## Analytics

The primary metric is input context tokens: fresh input plus cache reads and,
where provided, cache creation. Output and cost remain separate. Correlations use
Spearman rank correlation, require at least 20 same-model prompts within a
repository, and are labeled as observed relationships—not causes. Cross-repository
claims require five repositories with ten prompts each.

Task complexity, developer behaviour, provider, model selection, session history,
and tools also affect token usage. This MVP cannot control for them.

## Commands and tests

Builds and tests are orchestrated by Turborepo. Turbo follows the workspace
dependency graph and caches successful task outputs locally in `.turbo`.

```bash
pnpm test
pnpm exec tsc --noEmit
pnpm build
pnpm turbo build --filter=@tokenlens/web
pnpm exec playwright test
```

The backend runs pending TypeORM migrations automatically when it first connects
to PostgreSQL. `pnpm db:migrate` is available for deployments that want to apply
them before starting the application.

## Troubleshooting

Run `repo-profiler doctor --provider <provider>` first. Hook errors are silent to
the agent and written to `~/.repo-profiler/diagnostics.log`.

Claude should emit `claude_code.user_prompt`, `claude_code.api_request`, and
`claude_code.tool_result`. Codex should emit `codex.user_prompt`, completed
`codex.sse_event` or `codex.websocket_event` records, and `codex.tool_result` to
`/api/ingest/otel/v1/logs`. Do not enable prompt or tool-content telemetry unless
your privacy policy explicitly allows it.
