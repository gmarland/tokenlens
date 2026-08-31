export type AgentBehaviourPrompt = {
  id: string;
  startedAt: string;
  context: number;
  files: number;
  branch: string | null;
  developerId: string | null;
  developerLabel: string | null;
};

export type BehaviourDimension = "branch" | "user";

export type BehaviourGroup = {
  key: string;
  label: string;
  prompts: AgentBehaviourPrompt[];
};

export type BehaviourMetric = "context" | "files";
export type TimeAggregation = "minute" | "hour" | "day" | "week" | "month";
export type TimeRange = "all" | "24h" | "7d" | "30d" | "90d" | "1y" | "custom";

export type CustomTimeRange = {
  start: string;
  end: string;
};

export type BehaviourTrendSeries = {
  id: string;
  label: string;
  data: Array<number | null>;
};

export type BehaviourTrend = {
  timestamps: string[];
  series: BehaviourTrendSeries[];
};

export const timeAggregationOptions: Array<{ value: TimeAggregation; label: string }> = [
  { value: "minute", label: "Minutes" },
  { value: "hour", label: "Hours" },
  { value: "day", label: "Days" },
  { value: "week", label: "Weeks" },
  { value: "month", label: "Months" },
];

export const timeRangeOptions: Array<{ value: TimeRange; label: string }> = [
  { value: "all", label: "All time" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "1y", label: "Last year" },
  { value: "custom", label: "Custom range…" },
];

const timeRangeMilliseconds: Record<Exclude<TimeRange, "all" | "custom">, number> = {
  "24h": 24 * 60 * 60 * 1_000,
  "7d": 7 * 24 * 60 * 60 * 1_000,
  "30d": 30 * 24 * 60 * 60 * 1_000,
  "90d": 90 * 24 * 60 * 60 * 1_000,
  "1y": 365 * 24 * 60 * 60 * 1_000,
};

export function filterBehaviourPromptsByRange(
  prompts: AgentBehaviourPrompt[],
  range: TimeRange,
  customRange: CustomTimeRange | null = null,
  referenceTimestamp?: string,
) {
  return filterByTimeRange(prompts, (prompt) => prompt.startedAt, range, customRange, referenceTimestamp);
}

export function filterByTimeRange<T>(
  items: T[],
  timestamp: (item: T) => string,
  range: TimeRange,
  customRange: CustomTimeRange | null = null,
  referenceTimestamp?: string,
) {
  if (range === "all" || !items.length) return items;

  if (range === "custom") {
    if (!customRange) return items;
    const start = Date.parse(`${customRange.start}T00:00:00.000Z`);
    const end = Date.parse(`${customRange.end}T23:59:59.999Z`);
    return items.filter((item) => {
      const value = Date.parse(timestamp(item));
      return value >= start && value <= end;
    });
  }

  const latestTimestamp = referenceTimestamp
    ? Date.parse(referenceTimestamp)
    : Math.max(...items.map((item) => Date.parse(timestamp(item))));
  const cutoff = latestTimestamp - timeRangeMilliseconds[range];
  return items.filter((item) => Date.parse(timestamp(item)) >= cutoff);
}

export function agentBehaviourUserLabel(prompt: AgentBehaviourPrompt) {
  if (prompt.developerLabel) return prompt.developerLabel;
  if (prompt.developerId) return `Identity ${prompt.developerId.slice(0, 8)}`;
  return "Identity pending";
}

export function groupBehaviourPrompts(
  prompts: AgentBehaviourPrompt[],
  dimension: BehaviourDimension,
): BehaviourGroup[] {
  const groups = new Map<string, BehaviourGroup>();

  for (const prompt of prompts) {
    const branch = prompt.branch?.trim();
    const key = dimension === "branch"
      ? branch ? `branch:${branch}` : "branch:unknown"
      : prompt.developerId ? `user:${prompt.developerId}` : "user:pending";
    const label = dimension === "branch" ? branch || "Unknown branch" : agentBehaviourUserLabel(prompt);
    const group = groups.get(key);

    if (group) group.prompts.push(prompt);
    else groups.set(key, { key, label, prompts: [prompt] });
  }

  return [...groups.values()].sort((a, b) =>
    b.prompts.length - a.prompts.length || a.label.localeCompare(b.label));
}

export function behaviourBucketStart(startedAt: string, aggregation: TimeAggregation) {
  const date = new Date(startedAt);

  if (aggregation === "minute") date.setUTCSeconds(0, 0);
  else if (aggregation === "hour") date.setUTCMinutes(0, 0, 0);
  else if (aggregation === "day") date.setUTCHours(0, 0, 0, 0);
  else if (aggregation === "week") {
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  } else {
    date.setUTCDate(1);
    date.setUTCHours(0, 0, 0, 0);
  }

  return date.toISOString();
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function buildAggregatedBehaviourTrend(
  prompts: AgentBehaviourPrompt[],
  groups: BehaviourGroup[],
  metric: BehaviourMetric,
  aggregation: TimeAggregation,
): BehaviourTrend {
  const timestamps = [...new Set(prompts.map((prompt) =>
    behaviourBucketStart(prompt.startedAt, aggregation)))].sort();
  const series = groups.map((group) => {
    const groupPromptIds = new Set(group.prompts.map((prompt) => prompt.id));
    const valuesByTimestamp = new Map<string, number[]>();

    for (const prompt of prompts) {
      if (!groupPromptIds.has(prompt.id)) continue;
      const timestamp = behaviourBucketStart(prompt.startedAt, aggregation);
      const values = valuesByTimestamp.get(timestamp);
      if (values) values.push(prompt[metric]);
      else valuesByTimestamp.set(timestamp, [prompt[metric]]);
    }

    return {
      id: group.key,
      label: group.label,
      data: timestamps.map((timestamp) => {
        const values = valuesByTimestamp.get(timestamp);
        return values ? median(values) : null;
      }),
    };
  });

  return { timestamps, series };
}
