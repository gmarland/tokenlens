import type { FileHotspot, InsightState, MatchedModelComparison, PromptFact, SnapshotDelta, ToolHealth } from "@tokenlens/shared";
import { db } from "./index";

class Parameters {
  values: unknown[] = [];
  add(value: unknown) {
    this.values.push(value);
    return `$${this.values.length}`;
  }
}

const query = async (sql: string, parameters: Parameters) =>
  (await (await db()).query(sql, parameters.values)) as any[];
const number = (value: unknown) => Number(value ?? 0);
const nullableNumber = (value: unknown) => value == null ? null : Number(value);
const medianNumber = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

export type AnalyticsFilter = { provider?: string; model?: string; branch?: string; startAt?: string };

export async function repositoryPromptFacts(
  repositoryId: string,
  filter: AnalyticsFilter = {},
): Promise<PromptFact[]> {
  const parameters = new Parameters();
  const repository = parameters.add(repositoryId);
  const provider = parameters.add(filter.provider ?? null);
  const model = parameters.add(filter.model ?? null);
  const branch = parameters.add(filter.branch ?? null);
  const startAt = parameters.add(filter.startAt ?? null);
  const rows = await query(`
    select p.id,p.repository_id,p.snapshot_id,p.provider,p.prompt_fingerprint,p.prompt_text,p.branch,p.developer_id,p.started_at,
      coalesce(u.model,p.model) model,coalesce(u.api_calls,0)::int api_calls,
      coalesce(u.fresh_input_tokens,0)::bigint fresh_input_tokens,
      coalesce(u.cache_read_tokens,0)::bigint cache_read_tokens,
      coalesce(u.cache_creation_tokens,0)::bigint cache_creation_tokens,
      coalesce(u.output_tokens,0)::bigint output_tokens,coalesce(u.context_tokens,0)::bigint context_tokens,
      u.cost_usd,coalesce(u.response_duration_ms,0)::bigint response_duration_ms,
      coalesce(u.cache_metrics_available,false) cache_metrics_available,
      coalesce(t.tool_calls,0)::int tool_calls,coalesce(t.known_tool_outcomes,0)::int known_tool_outcomes,
      coalesce(t.failed_tools,0)::int failed_tools,t.tool_duration_ms,t.tool_result_bytes,
      coalesce(f.file_access_count,0)::int file_access_count,f.total_reads,f.files_read,f.repeated_reads,
      f.files_edited,f.modules_visited,f.working_set_loc,f.largest_file_loc,f.mean_fan_out,f.cycle_files,
      extract(epoch from(coalesce(f.first_file_edit,t.first_named_edit)-p.started_at))*1000 time_to_first_edit_ms,
      coalesce(greatest(p.hook_received_at,u.last_api_at,t.last_tool_at),p.hook_received_at,p.started_at) > now()-interval '5 minutes' provisional
    from prompts p
    left join lateral(
      select case when count(distinct coalesce(a.model,p.model))>1 then 'Multiple models' else max(coalesce(a.model,p.model)) end model,
        count(*)::int api_calls,sum(a.input_tokens)::bigint fresh_input_tokens,
        sum(a.cache_read_tokens)::bigint cache_read_tokens,sum(a.cache_creation_tokens)::bigint cache_creation_tokens,
        sum(a.output_tokens)::bigint output_tokens,
        sum(a.input_tokens+a.cache_read_tokens+a.cache_creation_tokens)::bigint context_tokens,
        sum(a.cost_usd)::numeric cost_usd,sum(a.duration_ms)::bigint response_duration_ms,
        bool_and(a.cache_metrics_available) cache_metrics_available,max(a.timestamp) last_api_at
      from api_requests a where a.prompt_id=p.id
    )u on true
    left join lateral(
      select count(*)::int tool_calls,count(*)filter(where te.success is not null)::int known_tool_outcomes,
        count(*)filter(where te.success=false)::int failed_tools,sum(te.duration_ms)::bigint tool_duration_ms,
        sum(te.tool_result_size_bytes)::bigint tool_result_bytes,max(te.timestamp) last_tool_at,
        min(te.timestamp)filter(where lower(te.tool_name) in('edit','write','notebookedit','apply_patch')) first_named_edit
      from tool_events te where te.prompt_id=p.id
    )t on true
    left join lateral(
      select coalesce(sum(x.access_count),0)::int file_access_count,
        coalesce(sum(x.access_count)filter(where x.kind='read'),0)::int total_reads,
        count(distinct x.path)filter(where x.kind='read')::int files_read,
        coalesce(sum(x.access_count-1)filter(where x.kind='read'),0)::int repeated_reads,
        count(distinct x.path)filter(where x.kind='edit')::int files_edited,
        count(distinct x.module_name)filter(where x.kind='read' and x.module_name is not null)::int modules_visited,
        sum(x.loc)filter(where x.kind='read')::bigint working_set_loc,
        max(x.loc)filter(where x.kind='read')::int largest_file_loc,
        avg(x.dependency_fan_out)filter(where x.kind='read')::real mean_fan_out,
        count(*)filter(where x.kind='read' and x.in_dependency_cycle)::int cycle_files,
        min(x.timestamp)filter(where x.kind='edit') first_file_edit
      from (
        select a.kind,a.relative_file_path path,count(*)::int access_count,min(te.timestamp) timestamp,max(f.module_name) module_name,
          max(f.loc) loc,max(f.dependency_fan_out) dependency_fan_out,bool_or(coalesce(f.in_dependency_cycle,false)) in_dependency_cycle
        from tool_events te join tool_file_accesses a on a.tool_event_id=te.id
        left join repo_snapshot_files f on f.snapshot_id=p.snapshot_id and f.path=a.relative_file_path
        where te.prompt_id=p.id group by a.kind,a.relative_file_path
      )x
    )f on true
    where p.repository_id=${repository}::uuid and (${provider}::text is null or p.provider=${provider})
      and (${model}::text is null or coalesce(u.model,p.model)=${model})
      and (${branch}::text is null or p.branch=${branch})
      and (${startAt}::timestamptz is null or p.started_at>=${startAt}::timestamptz)
    order by p.started_at,p.id`, parameters);

  return rows.map((row): PromptFact => ({
    id: String(row.id), repositoryId: String(row.repository_id), snapshotId: row.snapshot_id == null ? null : String(row.snapshot_id),
    promptFingerprint: row.prompt_fingerprint == null ? null : String(row.prompt_fingerprint),
    promptText: row.prompt_text == null ? null : String(row.prompt_text), provider: String(row.provider),
    model: row.model == null ? null : String(row.model), branch: row.branch == null ? null : String(row.branch),
    developerId: row.developer_id == null ? null : String(row.developer_id), startedAt: new Date(row.started_at).toISOString(),
    provisional: Boolean(row.provisional), hasUsage: number(row.api_calls) > 0, cacheMetricsAvailable: Boolean(row.cache_metrics_available),
    freshInputTokens: number(row.fresh_input_tokens), cacheReadTokens: number(row.cache_read_tokens),
    cacheCreationTokens: number(row.cache_creation_tokens), outputTokens: number(row.output_tokens), contextTokens: number(row.context_tokens),
    costUsd: nullableNumber(row.cost_usd), responseDurationMs: number(row.response_duration_ms), apiCalls: number(row.api_calls),
    toolCalls: number(row.tool_calls), knownToolOutcomes: number(row.known_tool_outcomes), failedTools: number(row.failed_tools),
    toolDurationMs: nullableNumber(row.tool_duration_ms), toolResultBytes: nullableNumber(row.tool_result_bytes),
    fileAttributionAvailable: number(row.file_access_count) > 0 || number(row.tool_calls) === 0,
    totalReads: number(row.file_access_count) > 0 || number(row.tool_calls) === 0 ? number(row.total_reads) : null,
    filesRead: number(row.file_access_count) > 0 || number(row.tool_calls) === 0 ? number(row.files_read) : null,
    repeatedReads: number(row.file_access_count) > 0 || number(row.tool_calls) === 0 ? number(row.repeated_reads) : null,
    filesEdited: number(row.file_access_count) > 0 || number(row.tool_calls) === 0 ? number(row.files_edited) : null,
    modulesVisited: number(row.file_access_count) > 0 || number(row.tool_calls) === 0 ? number(row.modules_visited) : null,
    workingSetLoc: number(row.file_access_count) > 0 || number(row.tool_calls) === 0 ? number(row.working_set_loc) : null,
    largestFileLoc: number(row.file_access_count) > 0 || number(row.tool_calls) === 0 ? number(row.largest_file_loc) : null,
    meanFanOut: number(row.file_access_count) > 0 || number(row.tool_calls) === 0 ? number(row.mean_fan_out) : null,
    cycleFiles: number(row.file_access_count) > 0 || number(row.tool_calls) === 0 ? number(row.cycle_files) : null,
    timeToFirstEditMs: nullableNumber(row.time_to_first_edit_ms),
  }));
}

export async function repositoryFileHotspots(repositoryId: string, facts: PromptFact[]): Promise<FileHotspot[]> {
  const eligible = facts.filter((fact) => !fact.provisional && fact.hasUsage && fact.fileAttributionAvailable);
  if (!eligible.length) return [];
  const parameters = new Parameters();
  const ids = parameters.add(eligible.map((fact) => fact.id));
  const rows = await query(`
    with accesses as(
      select te.prompt_id,a.relative_file_path path,count(*)filter(where a.kind='read')::int reads
      from tool_events te join tool_file_accesses a on a.tool_event_id=te.id
      where te.prompt_id=any(${ids}::uuid[]) group by te.prompt_id,a.relative_file_path
      having count(*)filter(where a.kind='read')>0
    )
    select a.prompt_id,a.path,a.reads,f.module_name,f.loc,f.dependency_fan_in,f.dependency_fan_out,
      f.cross_module_dependencies,f.in_dependency_cycle,f.is_generated
    from accesses a join prompts p on p.id=a.prompt_id
    left join repo_snapshot_files f on f.snapshot_id=p.snapshot_id and f.path=a.path`, parameters);
  const context = new Map(eligible.map((fact) => [fact.id, fact.contextTokens]));
  const allContexts = eligible.map((fact) => fact.contextTokens).sort((a, b) => a - b);
  const repositoryMedian = medianNumber(allContexts);
  const highThreshold = allContexts[Math.floor((allContexts.length - 1) * .75)] ?? 0;
  const grouped = new Map<string, any[]>();
  for (const row of rows) grouped.set(String(row.path), [...(grouped.get(String(row.path)) ?? []), row]);
  return [...grouped.entries()].map(([path, group]): FileHotspot => {
    const contexts = group.map((row) => context.get(String(row.prompt_id)) ?? 0).sort((a, b) => a - b);
    const med = medianNumber(contexts);
    const first = group[0];
    return {
      path, moduleName: String(first.module_name ?? "Unmatched snapshot"), prompts: group.length,
      promptShare: group.length / eligible.length, reads: group.reduce((sum, row) => sum + number(row.reads), 0),
      repeatedReads: group.reduce((sum, row) => sum + Math.max(0, number(row.reads) - 1), 0), medianContext: med,
      contextLiftPercent: repositoryMedian > 0 ? ((med - repositoryMedian) / repositoryMedian) * 100 : null,
      highContextPromptShare: contexts.filter((value) => value >= highThreshold).length / contexts.length,
      loc: number(first.loc), fanIn: number(first.dependency_fan_in), fanOut: number(first.dependency_fan_out),
      crossModuleDependencies: number(first.cross_module_dependencies), inCycle: Boolean(first.in_dependency_cycle), generated: Boolean(first.is_generated),
    };
  }).sort((a, b) => (b.contextLiftPercent ?? 0) - (a.contextLiftPercent ?? 0) || b.repeatedReads - a.repeatedReads);
}

export async function repositoryToolHealth(facts: PromptFact[]): Promise<ToolHealth[]> {
  const ids = facts.filter((fact) => !fact.provisional && fact.hasUsage).map((fact) => fact.id);
  if (!ids.length) return [];
  const parameters = new Parameters();
  const promptIds = parameters.add(ids);
  const rows = await query(`select coalesce(tool_name,'Unknown') tool_name,count(*)::int calls,
      count(*)filter(where success is not null)::int known_outcomes,count(*)filter(where success=false)::int failed_calls,
      percentile_cont(.5)within group(order by duration_ms)filter(where duration_ms is not null) median_duration_ms,
      percentile_cont(.95)within group(order by duration_ms)filter(where duration_ms is not null) p95_duration_ms,
      percentile_cont(.5)within group(order by tool_result_size_bytes)filter(where tool_result_size_bytes is not null) median_result_bytes,
      percentile_cont(.95)within group(order by tool_result_size_bytes)filter(where tool_result_size_bytes is not null) p95_result_bytes
    from tool_events where prompt_id=any(${promptIds}::uuid[]) group by tool_name order by calls desc`, parameters);
  const category = (name: string) => /read|search|glob|grep/i.test(name) ? "read" : /edit|write|patch/i.test(name) ? "edit" : /shell|bash|exec|command/i.test(name) ? "shell" : "other";
  return rows.map((row): ToolHealth => ({
    toolName: String(row.tool_name), category: category(String(row.tool_name)), calls: number(row.calls),
    knownOutcomes: number(row.known_outcomes), failedCalls: number(row.failed_calls),
    failureRate: number(row.known_outcomes) ? number(row.failed_calls) / number(row.known_outcomes) : null,
    medianDurationMs: nullableNumber(row.median_duration_ms), p95DurationMs: nullableNumber(row.p95_duration_ms),
    medianResultBytes: nullableNumber(row.median_result_bytes), p95ResultBytes: nullableNumber(row.p95_result_bytes),
  }));
}

export async function repositorySnapshotDeltas(repositoryId: string): Promise<SnapshotDelta[]> {
  const parameters = new Parameters();
  const repository = parameters.add(repositoryId);
  const rows = await query(`with facts as(
      select s.*,count(distinct nullif(f.module_name,''))::int modules,
        lag(s.id)over(order by s.captured_at,s.id) previous_snapshot_id,
        lag(s.total_source_loc)over(order by s.captured_at,s.id) previous_loc,
        lag(s.source_files)over(order by s.captured_at,s.id) previous_source_files,
        lag(count(distinct nullif(f.module_name,'')))over(order by s.captured_at,s.id) previous_modules,
        lag(s.dependency_cycle_count)over(order by s.captured_at,s.id) previous_cycles,
        lag(s.cross_module_edge_ratio)over(order by s.captured_at,s.id) previous_cross_ratio,
        lag(s.claude_md_total_bytes+s.agents_md_total_bytes)over(order by s.captured_at,s.id) previous_instruction_bytes,
        lag(s.instruction_fingerprint)over(order by s.captured_at,s.id) previous_instruction_fingerprint
      from repo_snapshots s left join repo_snapshot_files f on f.snapshot_id=s.id
      where s.repository_id=${repository}::uuid group by s.id
    )select * from facts order by captured_at,id`, parameters);
  return rows.map((row): SnapshotDelta => ({
    snapshotId: String(row.id), previousSnapshotId: row.previous_snapshot_id == null ? null : String(row.previous_snapshot_id),
    capturedAt: new Date(row.captured_at).toISOString(), headSha: String(row.head_sha), branch: String(row.branch), dirty: Boolean(row.dirty),
    totalSourceLoc: number(row.total_source_loc), sourceFiles: number(row.source_files), modules: number(row.modules),
    filesOver500Loc: number(row.files_over_500_loc), filesOver1000Loc: number(row.files_over_1000_loc),
    dependencyCycleCount: number(row.dependency_cycle_count), crossModuleEdgeRatio: number(row.cross_module_edge_ratio),
    p95FanOut: number(row.p95_fan_out), testToSourceRatio: number(row.test_to_source_ratio),
    instructionBytes: number(row.claude_md_total_bytes) + number(row.agents_md_total_bytes),
    instructionFiles: number(row.claude_md_count) + number(row.agents_md_count),
    instructionFingerprint: row.instruction_fingerprint == null ? null : String(row.instruction_fingerprint),
    instructionChanged: row.previous_instruction_fingerprint == null || row.instruction_fingerprint == null
      ? null : String(row.previous_instruction_fingerprint) !== String(row.instruction_fingerprint),
    locDelta: row.previous_loc == null ? null : number(row.total_source_loc) - number(row.previous_loc),
    sourceFilesDelta: row.previous_source_files == null ? null : number(row.source_files) - number(row.previous_source_files),
    modulesDelta: row.previous_modules == null ? null : number(row.modules) - number(row.previous_modules),
    cyclesDelta: row.previous_cycles == null ? null : number(row.dependency_cycle_count) - number(row.previous_cycles),
    crossModuleRatioDelta: row.previous_cross_ratio == null ? null : number(row.cross_module_edge_ratio) - number(row.previous_cross_ratio),
    instructionBytesDelta: row.previous_instruction_bytes == null ? null : number(row.claude_md_total_bytes) + number(row.agents_md_total_bytes) - number(row.previous_instruction_bytes),
  }));
}

export function matchedModelComparisons(facts: PromptFact[]): MatchedModelComparison[] {
  const eligible = facts.filter((fact) => !fact.provisional && fact.hasUsage && fact.promptFingerprint && fact.promptText && fact.model && fact.model !== "Multiple models");
  const groups = new Map<string, PromptFact[]>();
  for (const fact of eligible) {
    const key = `${fact.promptFingerprint}\u0000${fact.provider}\u0000${fact.model}`;
    groups.set(key, [...(groups.get(key) ?? []), fact]);
  }
  return [...groups.values()].map((group): MatchedModelComparison => {
    const first = group[0];
    const med = medianNumber;
    const costs = group.map((fact) => fact.costUsd).filter((value): value is number => value != null);
    const files = group.map((fact) => fact.filesRead).filter((value): value is number => value != null);
    const known = group.reduce((sum, fact) => sum + fact.knownToolOutcomes, 0);
    return { promptFingerprint: first.promptFingerprint!, promptText: first.promptText!, provider: first.provider, model: first.model!, runs: group.length,
      medianContext: med(group.map((fact) => fact.contextTokens)), medianDurationMs: med(group.map((fact) => fact.responseDurationMs)),
      medianCostUsd: costs.length ? med(costs) : null, medianFilesRead: files.length ? med(files) : null,
      failureRate: known ? group.reduce((sum, fact) => sum + fact.failedTools, 0) / known : null };
  });
}

export async function repositoryInsightStates(repositoryId: string): Promise<Record<string, InsightState>> {
  const parameters = new Parameters();
  const repository = parameters.add(repositoryId);
  const rows = await query(`select insight_id,state from insight_states where repository_id=${repository}::uuid`, parameters);
  return Object.fromEntries(rows.map((row) => [String(row.insight_id), row.state as InsightState]));
}

export async function setRepositoryInsightState(repositoryId: string, insightId: string, state: InsightState) {
  const parameters = new Parameters();
  const repository = parameters.add(repositoryId);
  const insight = parameters.add(insightId);
  const nextState = parameters.add(state);
  return (await query(`insert into insight_states(workspace_id,repository_id,insight_id,state,updated_at)
      select workspace_id,id,${insight},${nextState},now() from repositories where id=${repository}::uuid
      on conflict(repository_id,insight_id)do update set state=excluded.state,updated_at=now()
      returning insight_id,state,updated_at`, parameters))[0] ?? null;
}
