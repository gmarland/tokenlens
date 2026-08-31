export type AgentBehaviourPrompt = {
  id: string;
  date: string;
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

export type BehaviourTrendSeries = {
  id: string;
  label: string;
  data: Array<number | null>;
};

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

export function buildUserTrendSeries(
  prompts: AgentBehaviourPrompt[],
  users: BehaviourGroup[],
  metric: BehaviourMetric,
): BehaviourTrendSeries[] {
  return users.map((user) => {
    const userPromptIds = new Set(user.prompts.map((prompt) => prompt.id));
    return {
      id: user.key,
      label: user.label,
      data: prompts.map((prompt) => userPromptIds.has(prompt.id) ? prompt[metric] : null),
    };
  });
}
