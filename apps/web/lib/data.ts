import { db } from "@tokenlens/database";

class Parameters {
  values: unknown[] = [];
  add(value: unknown) {
    this.values.push(value);
    return `$${this.values.length}`;
  }
}

const rows = async (query: string, parameters: Parameters) =>
  (await (await db()).query(query, parameters.values)) as any[];

const providerWhere = (provider: string | undefined, parameters: Parameters, alias = "p") =>
  provider ? `and ${alias}.provider = ${parameters.add(provider)}` : "";

const escapeLikePattern = (value: string) => value.replace(/[\\%_]/g, "\\$&");

export async function overview(model?: string, provider?: string) {
  const summaryParameters = new Parameters();
  const summaryModelWhere = model ? `and model=${summaryParameters.add(model)}` : "";
  const summarySelectedModel = summaryParameters.add(model ?? null);
  const summary = (await rows(`select (select count(*)::int from repositories) repositories,
    count(distinct p.developer_id)::int developers, count(distinct p.id)::int prompts,
    coalesce(sum(a.context_tokens),0)::bigint context_tokens
    from prompts p left join lateral(select sum(input_tokens+cache_read_tokens+cache_creation_tokens) context_tokens,
      max(model) model from api_requests where prompt_id=p.id ${summaryModelWhere})a on true
    where (${summarySelectedModel}::text is null or a.model=${summarySelectedModel} or (a.model is null and p.model=${summarySelectedModel}))
      ${providerWhere(provider, summaryParameters)}`, summaryParameters))[0] ?? {};

  const repositoryParameters = new Parameters();
  const modelWhere = model ? `and model=${repositoryParameters.add(model)}` : "";
  const selectedModel = repositoryParameters.add(model ?? null);
  const repositories = await rows(`with usage as (
      select p.repository_id,count(distinct p.id)::int prompts,
        percentile_cont(.5) within group(order by coalesce(u.context_tokens,0)) median_context,
        percentile_cont(.5) within group(order by coalesce(t.files_read,0)) median_files
      from prompts p
      join lateral(select sum(input_tokens+cache_read_tokens+cache_creation_tokens) context_tokens,max(model) model
        from api_requests where prompt_id=p.id ${modelWhere})u on true
      left join lateral(select count(distinct a.relative_file_path) files_read
        from tool_events te join tool_file_accesses a on a.tool_event_id=te.id
        where te.prompt_id=p.id and a.kind='read')t on true
      where (${selectedModel}::text is null or u.model=${selectedModel} or (u.model is null and p.model=${selectedModel}))
        ${providerWhere(provider, repositoryParameters)} group by p.repository_id
    ), latest as(select distinct on(repository_id)* from repo_snapshots order by repository_id,captured_at desc)
    select r.id,r.name,l.source_files,l.total_source_loc loc,coalesce(u.prompts,0) prompts,
      coalesce(u.median_context,0) median_context,coalesce(u.median_files,0) median_files
    from repositories r left join latest l on l.repository_id=r.id left join usage u on u.repository_id=r.id
    order by median_context desc`, repositoryParameters);

  const modelParameters = new Parameters();
  const models = await rows(`select a.model,count(distinct a.prompt_id)::int count
    from api_requests a join prompts p on p.id=a.prompt_id
    where a.model is not null ${providerWhere(provider, modelParameters)}
    group by a.model order by count desc`, modelParameters);
  const providers = await rows("select provider,count(*)::int count from prompts group by provider order by count desc", new Parameters());
  return { summary, repositories, models, providers };
}

export async function repository(id: string, model?: string, provider?: string) {
  const repoParameters = new Parameters();
  const repo = (await rows(`select r.*,to_jsonb(s.*) snapshot from repositories r
    left join lateral(select * from repo_snapshots where repository_id=r.id order by captured_at desc limit 1)s on true
    where r.id=${repoParameters.add(id)}::uuid`, repoParameters))[0];
  if (!repo) return null;

  const snapshotParameters = new Parameters();
  const snapshots = (await rows(`select s.id,s.captured_at,s.branch,s.head_sha,s.dirty,s.total_source_loc,s.source_files,
      s.files_over_500_loc,s.files_over_1000_loc,s.dependency_cycle_count,s.cross_module_edge_ratio,s.p95_fan_out,
      s.test_to_source_ratio,(s.claude_md_total_bytes+s.agents_md_total_bytes)::bigint instruction_bytes,
      count(distinct nullif(f.module_name,''))::int modules
    from repo_snapshots s left join repo_snapshot_files f on f.snapshot_id=s.id
    where s.repository_id=${snapshotParameters.add(id)}::uuid
    group by s.id,s.captured_at,s.branch,s.head_sha,s.dirty,s.total_source_loc,s.source_files
    order by s.captured_at,s.id`, snapshotParameters)).map((snapshot) => ({
      id: snapshot.id,
      capturedAt: new Date(snapshot.captured_at).toISOString(),
      branch: snapshot.branch,
      headSha: snapshot.head_sha,
      dirty: snapshot.dirty,
      totalSourceLoc: Number(snapshot.total_source_loc ?? 0),
      sourceFiles: Number(snapshot.source_files ?? 0),
      modules: Number(snapshot.modules ?? 0),
      filesOver500Loc: Number(snapshot.files_over_500_loc ?? 0),
      filesOver1000Loc: Number(snapshot.files_over_1000_loc ?? 0),
      dependencyCycleCount: Number(snapshot.dependency_cycle_count ?? 0),
      crossModuleEdgeRatio: Number(snapshot.cross_module_edge_ratio ?? 0),
      p95FanOut: Number(snapshot.p95_fan_out ?? 0),
      testToSourceRatio: Number(snapshot.test_to_source_ratio ?? 0),
      instructionBytes: Number(snapshot.instruction_bytes ?? 0),
    }));

  const commitParameters = new Parameters();
  const commits = (await rows(`select * from (
      select sha,author_name,author_email,authored_at,committer_name,committer_email,committed_at,
        observed_branch,first_observed_at
      from repo_commits where repository_id=${commitParameters.add(id)}::uuid
      order by committed_at desc limit 1000
    )c order by committed_at`, commitParameters)).map((commit) => ({
      sha: commit.sha,
      authorName: commit.author_name,
      authorEmail: commit.author_email,
      authoredAt: new Date(commit.authored_at).toISOString(),
      committerName: commit.committer_name,
      committerEmail: commit.committer_email,
      committedAt: new Date(commit.committed_at).toISOString(),
      observedBranch: commit.observed_branch,
      firstObservedAt: new Date(commit.first_observed_at).toISOString(),
    }));

  const promptParameters = new Parameters();
  const repositoryId = promptParameters.add(id);
  const apiModelWhere = model ? `and model=${promptParameters.add(model)}` : "";
  const promptProviderWhere = providerWhere(provider, promptParameters);
  const selectedModel = promptParameters.add(model ?? null);
  const promptRows = await rows(`select p.id,p.provider,p.started_at,p.branch,p.developer_id,d.email,
    coalesce(u.context_tokens,0)::bigint context_tokens,coalesce(t.files_read,0)::int files_read,
    coalesce(t.repeated_reads,0)::int repeated_reads,coalesce(t.tool_bytes,0)::bigint tool_bytes,
    coalesce(t.modules,0)::int modules,coalesce(t.working_loc,0)::bigint working_loc,
    coalesce(t.max_file_loc,0)::int max_file_loc,coalesce(t.mean_fan_out,0)::real mean_fan_out,t.first_edit,
    coalesce(u.model,p.model) model
    from prompts p left join developers d on d.id=p.developer_id
    left join lateral(select sum(input_tokens+cache_read_tokens+cache_creation_tokens) context_tokens,
      case when count(distinct model)>1 then 'Multiple models' else max(model) end model
      from api_requests where prompt_id=p.id ${apiModelWhere})u on true
    left join lateral(select count(distinct a.relative_file_path)filter(where a.kind='read')files_read,
      count(*)filter(where a.kind='read')-count(distinct a.relative_file_path)filter(where a.kind='read')repeated_reads,
      (select sum(tool_result_size_bytes) from tool_events where prompt_id=p.id)tool_bytes,
      count(distinct f.module_name)filter(where a.kind='read')modules,
      (select sum(ff.loc) from(
        select distinct a2.relative_file_path,f2.loc from tool_events te2
        join tool_file_accesses a2 on a2.tool_event_id=te2.id
        join repo_snapshot_files f2 on f2.snapshot_id=p.snapshot_id and f2.path=a2.relative_file_path
        where te2.prompt_id=p.id and a2.kind='read'
      )ff)working_loc,max(f.loc)filter(where a.kind='read')max_file_loc,
      avg(f.dependency_fan_out)filter(where a.kind='read')mean_fan_out,
      min(te.timestamp)filter(where a.kind='edit' or lower(te.tool_name) in('edit','write','notebookedit','apply_patch'))first_edit
      from tool_events te left join tool_file_accesses a on a.tool_event_id=te.id
      left join repo_snapshot_files f on f.snapshot_id=p.snapshot_id and f.path=a.relative_file_path
      where te.prompt_id=p.id)t on true
    where p.repository_id=${repositoryId}::uuid ${promptProviderWhere}
      and (${selectedModel}::text is null or u.model=${selectedModel} or (u.model is null and p.model=${selectedModel}))
    order by p.started_at`, promptParameters);

  const modelParameters = new Parameters();
  const models = await rows(`select a.model,count(*)::int count from api_requests a join prompts p on p.id=a.prompt_id
    where p.repository_id=${modelParameters.add(id)}::uuid and a.model is not null ${providerWhere(provider, modelParameters)}
    group by a.model order by count desc`, modelParameters);
  const providerParameters = new Parameters();
  const providers = await rows(`select provider,count(*)::int count from prompts where repository_id=${providerParameters.add(id)}::uuid
    group by provider order by count desc`, providerParameters);
  return { repo, snapshots, commits, prompts: promptRows, models, providers };
}

export async function repositoryPrompts(
  id: string,
  sort = "context",
  model?: string,
  provider?: string,
  search?: string,
) {
  const order = ({ context: "context_tokens desc", cost: "cost_usd desc nulls last", files: "files_read desc",
    repeated: "repeated_reads desc", edit: "time_to_first_edit_ms desc" } as Record<string, string>)[sort] ?? "started_at desc";
  const parameters = new Parameters();
  const repositoryId = parameters.add(id);
  const modelWhere = model ? `and model=${parameters.add(model)}` : "";
  const selectedModel = parameters.add(model ?? null);
  const promptProviderWhere = providerWhere(provider, parameters);
  const normalizedSearch = search?.trim();
  const promptSearchWhere = normalizedSearch
    ? `and p.prompt_text ilike ${parameters.add(`%${escapeLikePattern(normalizedSearch)}%`)} escape '\\'`
    : "";
  return rows(`select p.id,p.provider,p.external_prompt_id,p.prompt_text,p.prompt_length,p.started_at,d.email,
    coalesce(u.model,p.model) model,u.context_tokens,u.cost_usd,u.api_calls,t.files_read,t.modules,t.repeated_reads,
    extract(epoch from(t.first_edit-p.started_at))*1000 time_to_first_edit_ms
    from prompts p left join developers d on d.id=p.developer_id
    left join lateral(select case when count(distinct model)>1 then 'Multiple models' else max(model) end model,
      sum(input_tokens+cache_read_tokens+cache_creation_tokens)::bigint context_tokens,
      sum(cost_usd)::numeric cost_usd,count(*)::int api_calls from api_requests where prompt_id=p.id ${modelWhere})u on true
    left join lateral(select count(distinct a.relative_file_path)filter(where a.kind='read')::int files_read,
      count(*)filter(where a.kind='read')-count(distinct a.relative_file_path)filter(where a.kind='read') repeated_reads,
      count(distinct f.module_name)filter(where a.kind='read')::int modules,
      min(t.timestamp)filter(where a.kind='edit' or lower(t.tool_name) in('edit','write','notebookedit','apply_patch'))first_edit
      from tool_events t left join tool_file_accesses a on a.tool_event_id=t.id
      left join repo_snapshot_files f on f.snapshot_id=p.snapshot_id and f.path=a.relative_file_path
      where t.prompt_id=p.id)t on true
    where p.repository_id=${repositoryId}::uuid ${promptProviderWhere} ${promptSearchWhere}
      and (${selectedModel}::text is null or u.model=${selectedModel} or (u.model is null and p.model=${selectedModel}))
    order by ${order}`, parameters);
}

export async function promptDetail(id: string) {
  const promptParameters = new Parameters();
  const prompt = (await rows(`select p.*,r.name repository_name,d.email from prompts p
    left join repositories r on r.id=p.repository_id left join developers d on d.id=p.developer_id
    where p.id=${promptParameters.add(id)}::uuid`, promptParameters))[0];
  if (!prompt) return null;
  const apiParameters = new Parameters();
  const api = await rows(`select * from api_requests where prompt_id=${apiParameters.add(id)}::uuid order by timestamp`, apiParameters);
  const toolParameters = new Parameters();
  const tools = await rows(`select t.*,coalesce(a.relative_file_path,t.relative_file_path)relative_file_path,
      a.kind file_access_kind,a.attribution file_access_attribution,
      f.loc,f.module_name,f.dependency_fan_out,f.dependency_fan_in,f.in_dependency_cycle
    from tool_events t left join prompts p on p.id=t.prompt_id
    left join tool_file_accesses a on a.tool_event_id=t.id left join repo_snapshot_files f
    on f.snapshot_id=p.snapshot_id and f.path=a.relative_file_path
    where t.prompt_id=${toolParameters.add(id)}::uuid order by t.timestamp`, toolParameters);
  return { prompt, api, tools };
}

export class BenchmarkValidationError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

const normalizedPromptSql = (alias: string) =>
  `replace(replace(${alias}.prompt_text, E'\\r\\n', E'\\n'), E'\\r', E'\\n')`;

export async function createPromptBenchmark(
  repositoryId: string,
  sourcePromptId: string,
  requestedModel?: string,
  requestedName?: string,
) {
  const sourceParameters = new Parameters();
  const source = (await rows(`select p.id,p.workspace_id,p.repository_id,p.provider,p.prompt_text,p.prompt_fingerprint,
      case when count(distinct coalesce(a.model,p.model)) <= 1
        then max(coalesce(a.model,p.model)) end effective_model,
      count(distinct coalesce(a.model,p.model))::int model_count
    from prompts p left join api_requests a on a.prompt_id=p.id
    where p.id=${sourceParameters.add(sourcePromptId)}::uuid
      and p.repository_id=${sourceParameters.add(repositoryId)}::uuid
    group by p.id`, sourceParameters))[0];

  if (!source) throw new BenchmarkValidationError("Prompt not found in this repository", 404);
  if (!source.prompt_text || !source.prompt_fingerprint) {
    throw new BenchmarkValidationError("This prompt has no captured text and cannot be benchmarked");
  }
  if (Number(source.model_count) > 1) {
    throw new BenchmarkValidationError("Prompts that used multiple models cannot be benchmarked");
  }
  if (!source.effective_model) {
    throw new BenchmarkValidationError("Model telemetry has not arrived for this prompt");
  }
  const model = requestedModel?.trim() || String(source.effective_model);
  if (model !== source.effective_model) {
    throw new BenchmarkValidationError("The selected model does not match this prompt");
  }
  const fallbackName = String(source.prompt_text).replace(/\s+/g, " ").trim().slice(0, 80) || "Benchmark prompt";
  const name = requestedName?.trim().slice(0, 120) || fallbackName;

  const insertParameters = new Parameters();
  return (await rows(`insert into prompt_benchmarks(
      workspace_id,repository_id,source_prompt_id,name,provider,model,prompt_text,prompt_fingerprint,matcher_version
    ) values(
      ${insertParameters.add(source.workspace_id)}::uuid,${insertParameters.add(repositoryId)}::uuid,
      ${insertParameters.add(sourcePromptId)}::uuid,${insertParameters.add(name)},${insertParameters.add(source.provider)},
      ${insertParameters.add(model)},${insertParameters.add(source.prompt_text)},${insertParameters.add(source.prompt_fingerprint)},1
    ) on conflict(repository_id,provider,model,prompt_fingerprint) where archived_at is null
      do update set name=prompt_benchmarks.name
    returning id,name,model,provider`, insertParameters))[0];
}

export async function repositoryBenchmarks(repositoryId: string) {
  const parameters = new Parameters();
  return rows(`select b.id,b.name,b.provider,b.model,b.created_at,
      coalesce(s.runs,0)::int runs,s.last_seen_at,s.median_context
    from prompt_benchmarks b
    left join lateral(
      select count(*)::int runs,max(run.started_at) last_seen_at,
        percentile_cont(.5) within group(order by run.context_tokens) median_context
      from (
        select p.started_at,coalesce(u.context_tokens,0)::bigint context_tokens
        from prompts p
        left join lateral(
          select sum(input_tokens+cache_read_tokens+cache_creation_tokens)::bigint context_tokens,
            max(coalesce(model,p.model)) model,
            count(distinct coalesce(model,p.model))::int model_count
          from api_requests where prompt_id=p.id
        )u on true
        where p.repository_id=b.repository_id and p.provider=b.provider
          and p.prompt_fingerprint=b.prompt_fingerprint
          and ${normalizedPromptSql("p")}=replace(replace(b.prompt_text,E'\\r\\n',E'\\n'),E'\\r',E'\\n')
          and u.model_count <= 1 and coalesce(u.model,p.model)=b.model
      )run
    )s on true
    where b.repository_id=${parameters.add(repositoryId)}::uuid and b.archived_at is null
    order by s.last_seen_at desc nulls last,b.created_at desc`, parameters);
}

export async function benchmarkDetail(id: string) {
  const benchmarkParameters = new Parameters();
  const benchmark = (await rows(`select b.*,r.name repository_name
    from prompt_benchmarks b join repositories r on r.id=b.repository_id
    where b.id=${benchmarkParameters.add(id)}::uuid and b.archived_at is null`, benchmarkParameters))[0];
  if (!benchmark) return null;

  const pointParameters = new Parameters();
  const points = (await rows(`select p.id,p.started_at,p.branch,p.head_sha,p.dirty,
      coalesce(u.context_tokens,0)::bigint context_tokens,coalesce(u.fresh_input_tokens,0)::bigint fresh_input_tokens,
      coalesce(u.cache_read_tokens,0)::bigint cache_read_tokens,coalesce(u.cache_creation_tokens,0)::bigint cache_creation_tokens,
      coalesce(u.output_tokens,0)::bigint output_tokens,
      u.cost_usd,coalesce(u.duration_ms,0)::bigint response_duration_ms,coalesce(u.api_calls,0)::int api_calls,
      coalesce(t.tool_calls,0)::int tool_calls,coalesce(t.failed_tools,0)::int failed_tools,
      coalesce(t.files_read,0)::int files_read,coalesce(t.files_edited,0)::int files_edited,
      coalesce(t.repeated_reads,0)::int repeated_reads,t.time_to_first_edit_ms,
      greatest(p.hook_received_at,u.last_api_at,t.last_tool_at) > now()-interval '5 minutes' provisional
    from prompts p
    left join lateral(
      select sum(input_tokens+cache_read_tokens+cache_creation_tokens)::bigint context_tokens,
        sum(input_tokens)::bigint fresh_input_tokens,sum(cache_read_tokens)::bigint cache_read_tokens,
        sum(cache_creation_tokens)::bigint cache_creation_tokens,
        sum(output_tokens)::bigint output_tokens,sum(cost_usd)::numeric cost_usd,
        sum(duration_ms)::bigint duration_ms,count(*)::int api_calls,max(timestamp) last_api_at,
        max(coalesce(model,p.model)) model,count(distinct coalesce(model,p.model))::int model_count
      from api_requests where prompt_id=p.id
    )u on true
    left join lateral(
      select count(distinct te.id)::int tool_calls,
        count(distinct te.id)filter(where te.success=false)::int failed_tools,
        count(distinct a.relative_file_path)filter(where a.kind='read')::int files_read,
        count(distinct a.relative_file_path)filter(where a.kind='edit')::int files_edited,
        (count(*)filter(where a.kind='read')-count(distinct a.relative_file_path)filter(where a.kind='read'))::int repeated_reads,
        extract(epoch from(min(te.timestamp)filter(where a.kind='edit' or lower(te.tool_name) in('edit','write','notebookedit','apply_patch'))-p.started_at))*1000 time_to_first_edit_ms,
        max(te.timestamp) last_tool_at
      from tool_events te left join tool_file_accesses a on a.tool_event_id=te.id where te.prompt_id=p.id
    )t on true
    where p.repository_id=${pointParameters.add(benchmark.repository_id)}::uuid
      and p.provider=${pointParameters.add(benchmark.provider)}
      and p.prompt_fingerprint=${pointParameters.add(benchmark.prompt_fingerprint)}
      and ${normalizedPromptSql("p")}=${pointParameters.add(
        String(benchmark.prompt_text).replace(/\r\n?/g, "\n"),
      )}
      and u.model_count <= 1 and coalesce(u.model,p.model)=${pointParameters.add(benchmark.model)}
    order by p.started_at,p.id`, pointParameters)).map((point) => ({
      id: String(point.id),
      startedAt: new Date(point.started_at).toISOString(),
      branch: point.branch == null ? null : String(point.branch),
      headSha: point.head_sha == null ? null : String(point.head_sha),
      dirty: point.dirty == null ? null : Boolean(point.dirty),
      contextTokens: Number(point.context_tokens ?? 0),
      freshInputTokens: Number(point.fresh_input_tokens ?? 0),
      cacheReadTokens: Number(point.cache_read_tokens ?? 0),
      cacheCreationTokens: Number(point.cache_creation_tokens ?? 0),
      outputTokens: Number(point.output_tokens ?? 0),
      costUsd: point.cost_usd == null ? null : Number(point.cost_usd),
      responseDurationMs: Number(point.response_duration_ms ?? 0),
      apiCalls: Number(point.api_calls ?? 0),
      toolCalls: Number(point.tool_calls ?? 0),
      failedTools: Number(point.failed_tools ?? 0),
      filesRead: Number(point.files_read ?? 0),
      filesEdited: Number(point.files_edited ?? 0),
      repeatedReads: Number(point.repeated_reads ?? 0),
      timeToFirstEditMs: point.time_to_first_edit_ms == null ? null : Number(point.time_to_first_edit_ms),
      provisional: Boolean(point.provisional),
    }));

  return { benchmark, points };
}

export async function archiveBenchmark(id: string) {
  const parameters = new Parameters();
  return (await rows(`update prompt_benchmarks set archived_at=now()
    where id=${parameters.add(id)}::uuid and archived_at is null returning id,repository_id`, parameters))[0] ?? null;
}

export async function developersList() {
  return rows(`select d.*,count(p.id)::int prompts from developers d left join prompts p on p.developer_id=d.id
    group by d.id order by d.last_seen_at desc`, new Parameters());
}
