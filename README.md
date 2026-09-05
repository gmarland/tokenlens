# TokenLens

TokenLens measures how Claude Code and Codex interact with your repository and
helps identify relationships between codebase structure and agent context
consumption. It combines privacy-preserving agent telemetry with local static
repository analysis; it is not a generic usage dashboard or an employee
productivity score.

## Architecture

```text
Claude/Codex hooks ── repo, provider, turn ID, relative file paths ─┐
Claude/Codex OTLP ─── tokens, model, API and tool events ──────────┼─> Ingestion API ─> PostgreSQL
Local profiler ────── snapshot and file metrics ──────────────────┘                    │
                                                                                      v
Repository structure <──────── analytics + file attribution <────────── Next.js dashboard
```

The CLI never proxies agent traffic, reads transcript files, or uploads source
contents. The standalone ingestion API authenticates and validates requests,
then calls the same package-level database code used by the website API. Events
are idempotent and can arrive in any order.

## Local setup

Use the current Node.js LTS and pnpm:

```bash
cp .env.example .env
pnpm install
docker compose up -d
pnpm db:migrate
pnpm test
pnpm dev
```

Open the dashboard at <http://localhost:3000>. The ingestion API runs at
<http://localhost:3001>. The default development ingest key is
`development-key-change-me`; replace it outside local development.

## Authentication and workspaces

The dashboard requires a verified email magic link. Google sign-in is also
enabled when `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are configured. Each new
account receives a workspace and owner membership; verified
`gareth.marland@gmail.com` claims the existing unowned workspace. Owners can
invite other users and create, rotate, or revoke write-only ingestion keys from
the API Keys page. Dashboard sessions use Auth.js encrypted JWT cookies with a
seven-day lifetime. Workspace membership and owner permissions are loaded from
the database on protected requests so access changes take effect immediately.

Set a long random `AUTH_SECRET` in every environment. Email delivery uses
Resend for both magic links and workspace invitations. Set `AUTH_RESEND_KEY` to
a Resend API key and set `EMAIL_FROM` to an address on a verified Resend domain.
The `onboarding@resend.dev` sender in `.env.example` can only send test messages
to the email address associated with the Resend account.

## Agent setup

Install the package so `repo-profiler` is on `PATH`, then choose one provider or
install both:

```bash
repo-profiler install --provider claude --endpoint http://localhost:3001 --key development-key-change-me --name "My Mac"
repo-profiler install --provider codex --endpoint http://localhost:3001 --key development-key-change-me --name "My Mac"
# or: repo-profiler install --provider all ...
```

When invoking the repository's npm script instead of a globally installed
binary, include npm's `--` argument separator and use a plain URL:

```bash
npm run repo-profiler -- install --provider codex --endpoint http://localhost:3001 --key development-key-change-me
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

Installation registers a stable, named CLI installation in the key's
workspace. Hook and OTEL requests include its installation ID, allowing owners
to see and revoke individual installations without rotating the workspace key.

Scan on demand with `repo-profiler scan .`; `--force` bypasses the local snapshot
cache. Remove only TokenLens-owned settings with
`repo-profiler uninstall --provider claude|codex|all`.

Prompt capture is always enabled. Both providers send the prompt body and its
character length; provider telemetry is used to attribute prompts to the
developer who owns the session.

Captured prompts with a single resolved model can be saved as benchmarks from
their detail page. TokenLens matches the same prompt text, provider, repository,
and model across historical and future turns, then plots usage and agent
behaviour over time. Matching normalizes line endings only; case and all other
whitespace remain significant.

## Privacy and security

The server receives provider, prompt/session identifiers, prompt text and
character length, available developer identity, normalized Git remote identity,
branch/commit/dirty state, commit author and committer identities and timestamps,
relative file paths, token totals, model and tool metadata, and repository/file
structural metrics.

Instruction-file contents remain local; snapshots include an aggregate SHA-256
fingerprint so same-size AGENTS.md and CLAUDE.md changes can be detected without
uploading their contents or individual file hashes.

It does **not** receive assistant responses, source contents, tool output, search
patterns, matched text, commit messages, raw terminal output, credentials from
Git remotes, or absolute local paths. Source and dependency analysis happens
locally. Ingest routes require a bearer secret; only its SHA-256 digest is stored
in PostgreSQL. Payloads are size-limited and relative paths reject traversal.

Codex plan usage does not expose a comparable per-turn dollar cost, so TokenLens
records Codex cost as unavailable. OpenAI cache reads and writes are normalized
as subsets of input tokens before storage to prevent double-counting.

## Analytics

The primary metric is input context tokens: fresh input plus cache reads and,
where provided, cache creation. Output and cost remain separate. Correlations use
Spearman rank correlation, require at least 20 prompts within the current provider
and model filter scope, and are labeled as observed relationships—not causes. With
no filters selected, analytics include all providers and models. Cross-repository
claims require five repositories with ten prompts each.

Task complexity, developer behaviour, provider, model selection, session history,
and tools also affect token usage. This MVP cannot control for them.

Prompt benchmarks measure observed token usage, duration, cost availability,
tool activity, and file-access behaviour. They do not score response correctness
or quality because assistant response contents are not collected.

The action centre applies versioned, deterministic rules to complete telemetry.
Repository relationship insights require at least 20 prompts and file-based
insights require at least 70% attribution coverage; matched benchmark regressions
use five preceding complete runs. Each recommendation exposes its sample size,
coverage, evidence, caveats, validation step, and a deterministic illustrative
example with ordered actions. Examples may include observed file, tool, provider,
or model names, but never source contents, tool output, absolute paths, prompt
text, or developer identity. Evidence links retain the active analysis scope and
focus the relevant file or tool where applicable. Users can acknowledge, monitor,
dismiss, or resolve an insight without altering the underlying measurements.

Hotspot, tool-health, and matched-model pages provide the supporting evidence.
Matched model/provider results are candidates for a separate quality evaluation,
not automatic routing advice. Onboarding insights require an aggregate cohort of
at least five developers and never expose individual rankings.

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

Run `pnpm db:migrate` before starting either application. Migrations are kept out
of application startup so independently starting the website and ingestion API
cannot race to apply the same database changes.

## Troubleshooting

Run `repo-profiler doctor --provider <provider>` first. Hook errors are silent to
the agent and written to `~/.repo-profiler/diagnostics.log`.

Claude should emit `claude_code.user_prompt`, `claude_code.api_request`, and
`claude_code.tool_result`. Codex should emit `codex.user_prompt`, completed
`codex.sse_event` or `codex.websocket_event` records, and `codex.tool_result` to
`/api/ingest/otel/v1/logs`. Because TokenLens always captures prompt text, only
install it where that collection is permitted by your privacy policy. Tool
contents remain disabled.
