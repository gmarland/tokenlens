import { compact } from "../lib/format";
import { Cards, StatCard } from "./ui";

type LanguageDistribution = Record<string, { loc?: number | null }>;

export type RepositoryStructureSnapshot = {
  median_file_loc?: number | null;
  p95_file_loc?: number | null;
  max_file_loc?: number | null;
  files_over_500_loc?: number | null;
  files_over_1000_loc?: number | null;
  files_over_2000_loc?: number | null;
  p95_directory_depth?: number | null;
  max_directory_depth?: number | null;
  test_file_count?: number | null;
  test_to_source_ratio?: number | null;
  claude_md_count?: number | null;
  claude_md_total_bytes?: number | null;
  agents_md_count?: number | null;
  agents_md_total_bytes?: number | null;
  p95_fan_out?: number | null;
  dependency_cycle_count?: number | null;
  cross_module_edge_ratio?: number | null;
  language_distribution_json?: LanguageDistribution | null;
};

export function RepositoryStructureCards({
  snapshot,
}: {
  snapshot: RepositoryStructureSnapshot;
}) {
  const languages = Object.entries(snapshot.language_distribution_json ?? {})
    .map(([language, value]) => `${language} ${compact(value.loc)}`)
    .join(", ");

  return (
    <Cards compact>
      <StatCard
        label="File LOC median / p95 / max"
        value={`${compact(snapshot.median_file_loc)} / ${compact(snapshot.p95_file_loc)} / ${compact(snapshot.max_file_loc)}`}
      />
      <StatCard
        label="Large files >500 / >1k / >2k"
        value={`${snapshot.files_over_500_loc ?? 0} / ${snapshot.files_over_1000_loc ?? 0} / ${snapshot.files_over_2000_loc ?? 0}`}
      />
      <StatCard
        label="Directory depth p95 / max"
        value={`${Number(snapshot.p95_directory_depth ?? 0).toFixed(1)} / ${snapshot.max_directory_depth ?? 0}`}
      />
      <StatCard
        label="Tests / source ratio"
        value={`${snapshot.test_file_count ?? 0} / ${(Number(snapshot.test_to_source_ratio ?? 0) * 100).toFixed(1)}%`}
      />
      <StatCard
        label="CLAUDE.md files / bytes"
        value={`${snapshot.claude_md_count ?? 0} / ${compact(snapshot.claude_md_total_bytes)}`}
      />
      <StatCard
        label="AGENTS.md files / bytes"
        value={`${snapshot.agents_md_count ?? 0} / ${compact(snapshot.agents_md_total_bytes)}`}
      />
      <StatCard
        label="Fan-out p95 / cycles"
        value={`${Number(snapshot.p95_fan_out ?? 0).toFixed(1)} / ${snapshot.dependency_cycle_count ?? 0}`}
      />
      <StatCard
        label="Cross-module edge ratio"
        value={`${(Number(snapshot.cross_module_edge_ratio ?? 0) * 100).toFixed(1)}%`}
      />
      <StatCard label="Languages" value={languages || "—"} />
    </Cards>
  );
}
