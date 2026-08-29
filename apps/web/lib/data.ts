import { db } from "@tokenlens/database";
import { sql } from "drizzle-orm";

const rows = async (q: any) => Array.from(await db().execute(q)) as any[];
const providerWhere = (provider?: string, alias = "p") =>
  provider
    ? sql.raw(`and ${alias}.provider = '${provider.replaceAll("'", "''")}'`)
    : sql``;

export async function overview(model?: string, provider?: string) {
  const summary =
    (
      await rows(sql`select count(distinct p.repository_id)::int repositories,
        count(distinct p.developer_id)::int developers,
        count(distinct p.id)::int prompts,
        coalesce(sum(a.input_tokens+a.cache_read_tokens+a.cache_creation_tokens),0)::bigint context_tokens
        from prompts p left join api_requests a on a.prompt_id=p.id
        where true ${providerWhere(provider)}`)
    )[0] ?? {};
  const repositories = await rows(sql`with usage as (
      select p.repository_id,count(distinct p.id)::int prompts,
        percentile_cont(.5) within group(order by coalesce(u.context_tokens,0)) median_context,
        percentile_cont(.5) within group(order by coalesce(t.files_read,0)) median_files
      from prompts p
      join lateral(
        select sum(input_tokens+cache_read_tokens+cache_creation_tokens) context_tokens
        from api_requests where prompt_id=p.id
        ${model ? sql`and model=${model}` : sql``} having count(*)>0
      )u on true
      left join lateral(
        select count(distinct relative_file_path) files_read from tool_events
        where prompt_id=p.id and tool_name='Read'
      )t on true
      where true ${providerWhere(provider)} group by p.repository_id
    ), latest as(
      select distinct on(repository_id)* from repo_snapshots
      order by repository_id,captured_at desc
    )
    select r.id,r.name,l.total_source_loc loc,coalesce(u.prompts,0) prompts,
      coalesce(u.median_context,0) median_context,
      coalesce(u.median_files,0) median_files
    from repositories r left join latest l on l.repository_id=r.id
    left join usage u on u.repository_id=r.id
    where u.repository_id is not null
    order by median_context desc`);
  const models = await rows(sql`select a.model,count(distinct a.prompt_id)::int count
    from api_requests a join prompts p on p.id=a.prompt_id
    where a.model is not null ${providerWhere(provider)}
    group by a.model order by count desc`);
  const providers = await rows(sql`select provider,count(*)::int count
    from prompts group by provider order by count desc`);
  return { summary, repositories, models, providers };
}

export async function repository(
  id: string,
  model?: string,
  provider?: string,
) {
  const repo = (
    await rows(sql`select r.*,to_jsonb(s.*) snapshot from repositories r
      left join lateral(select * from repo_snapshots where repository_id=r.id
      order by captured_at desc limit 1)s on true where r.id=${id}::uuid`)
  )[0];
  if (!repo) return null;
  const promptRows = await rows(sql`select p.id,p.provider,p.started_at,
    coalesce(u.context_tokens,0)::bigint context_tokens,
    coalesce(t.files_read,0)::int files_read,
    coalesce(t.repeated_reads,0)::int repeated_reads,
    coalesce(t.tool_bytes,0)::bigint tool_bytes,
    coalesce(t.modules,0)::int modules,
    coalesce(t.working_loc,0)::bigint working_loc,
    coalesce(t.max_file_loc,0)::int max_file_loc,
    coalesce(t.mean_fan_out,0)::real mean_fan_out,t.first_edit,u.model
    from prompts p
    left join lateral(
      select sum(input_tokens+cache_read_tokens+cache_creation_tokens) context_tokens,
      max(model) model from api_requests where prompt_id=p.id
      ${model ? sql`and model=${model}` : sql``}
    )u on true
    left join lateral(
      select count(distinct te.relative_file_path)filter(where te.tool_name='Read')files_read,
      count(*)filter(where te.tool_name='Read')-count(distinct te.relative_file_path)filter(where te.tool_name='Read')repeated_reads,
      sum(te.tool_result_size_bytes)tool_bytes,
      count(distinct f.module_name)filter(where te.tool_name='Read')modules,
      sum(distinct f.loc)filter(where te.tool_name='Read')working_loc,
      max(f.loc)filter(where te.tool_name='Read')max_file_loc,
      avg(f.dependency_fan_out)filter(where te.tool_name='Read')mean_fan_out,
      min(te.timestamp)filter(where te.tool_name in('Edit','Write','NotebookEdit'))first_edit
      from tool_events te left join repo_snapshot_files f
      on f.snapshot_id=p.snapshot_id and f.path=te.relative_file_path
      where te.prompt_id=p.id
    )t on true
    where p.repository_id=${id}::uuid ${providerWhere(provider)}
      and (${model ?? null}::text is null or u.model=${model ?? null})
    order by p.started_at`);
  const models = await rows(sql`select a.model,count(*)::int count
    from api_requests a join prompts p on p.id=a.prompt_id
    where p.repository_id=${id}::uuid and a.model is not null
      ${providerWhere(provider)} group by a.model order by count desc`);
  const providers = await rows(sql`select provider,count(*)::int count from prompts
    where repository_id=${id}::uuid group by provider order by count desc`);
  return { repo, prompts: promptRows, models, providers };
}

export async function repositoryPrompts(
  id: string,
  sort = "context",
  model?: string,
  provider?: string,
) {
  const order: any =
    {
      context: sql`context_tokens desc`,
      cost: sql`cost_usd desc nulls last`,
      files: sql`files_read desc`,
      repeated: sql`repeated_reads desc`,
      edit: sql`time_to_first_edit_ms desc`,
    }[sort] ?? sql`started_at desc`;
  return rows(sql`select p.id,p.provider,p.external_prompt_id,p.prompt_text,
    p.prompt_length,p.started_at,d.email,u.model,u.context_tokens,u.cost_usd,
    u.api_calls,t.files_read,t.modules,t.repeated_reads,
    extract(epoch from(t.first_edit-p.started_at))*1000 time_to_first_edit_ms
    from prompts p left join developers d on d.id=p.developer_id
    left join lateral(
      select max(model)model,
      sum(input_tokens+cache_read_tokens+cache_creation_tokens)::bigint context_tokens,
      sum(cost_usd)::numeric cost_usd,count(*)::int api_calls
      from api_requests where prompt_id=p.id
      ${model ? sql`and model=${model}` : sql``}
    )u on true
    left join lateral(
      select count(distinct relative_file_path)filter(where tool_name='Read')::int files_read,
      count(*)filter(where tool_name='Read')-count(distinct relative_file_path)filter(where tool_name='Read') repeated_reads,
      count(distinct f.module_name)::int modules,
      min(t.timestamp)filter(where tool_name in('Edit','Write','NotebookEdit'))first_edit
      from tool_events t left join repo_snapshot_files f
      on f.snapshot_id=p.snapshot_id and f.path=t.relative_file_path
      where t.prompt_id=p.id
    )t on true
    where p.repository_id=${id}::uuid ${providerWhere(provider)}
      and (${model ?? null}::text is null or u.model=${model ?? null})
    order by ${order}`);
}

export async function promptDetail(id: string) {
  const prompt = (
    await rows(sql`select p.*,r.name repository_name,d.email from prompts p
      left join repositories r on r.id=p.repository_id
      left join developers d on d.id=p.developer_id where p.id=${id}::uuid`)
  )[0];
  if (!prompt) return null;
  const api = await rows(
    sql`select * from api_requests where prompt_id=${id}::uuid order by timestamp`,
  );
  const tools = await rows(sql`select t.*,f.loc,f.module_name,
    f.dependency_fan_out,f.dependency_fan_in,f.in_dependency_cycle
    from tool_events t left join prompts p on p.id=t.prompt_id
    left join repo_snapshot_files f
    on f.snapshot_id=p.snapshot_id and f.path=t.relative_file_path
    where t.prompt_id=${id}::uuid order by t.timestamp`);
  return { prompt, api, tools };
}

export async function developersList() {
  return rows(sql`select d.*,count(p.id)::int prompts from developers d
    left join prompts p on p.developer_id=d.id group by d.id
    order by d.last_seen_at desc`);
}
