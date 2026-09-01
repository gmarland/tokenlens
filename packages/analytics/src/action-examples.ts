import type { ActionExample, Insight } from "@tokenlens/shared";

type Scope = Insight["scope"];

const repositoryHref = (
  scope: Scope,
  section = "insights",
  extra: Record<string, string> = {},
  hash?: string,
) => {
  if (!scope.repositoryId) return undefined;
  const query = new URLSearchParams(extra);
  if (scope.provider) query.set("provider", scope.provider);
  if (scope.model) query.set("model", scope.model);
  if (scope.branch) query.set("branch", scope.branch);

  return `/repos/${scope.repositoryId}/${section}${
    query.size ? `?${query}` : ""
  }${hash ? `#${hash}` : ""}`;
};

export const benchmarkRegressionExample = (
  scope: Scope,
  driver: string | null,
): ActionExample => ({
  title: "Example: find what changed in this benchmark",
  steps: [
    `Compare the latest run with the previous five runs, focusing on ${
      driver?.toLowerCase() ?? "files visited, tool calls, and timing"
    }.`,
    "Find the first point where the latest run starts behaving differently, such as opening a new file or retrying a failed command.",
    "Make one small change to the repository guidance or traversal path, then rerun the same benchmark.",
  ],
});

export const repeatedReadsExample = (): ActionExample => ({
  title: "Example: stop agents reopening the same files",
  steps: [
    "Open File hotspots and find a file that agents repeatedly read during the same task.",
    "Check why they keep returning to it: is its purpose unclear, or is the real entry point somewhere else?",
    "Add a short note that tells agents where to start, what this file is for, and what they can safely ignore.",
    "Run a similar prompt again and check whether repeated reads fall.",
  ],
  snippet: {
    language: "markdown",
    content:
      "## Working on authentication\n\n" +
      "Start with:\n" +
      "- `src/auth/index.ts` for the public API\n" +
      "- `src/auth/service.ts` for authentication logic\n\n" +
      "Do not inspect:\n" +
      "- generated session types\n" +
      "- build output\n\n" +
      "Validate with:\n" +
      "`pnpm test auth`",
  },
});

export const timeToEditExample = (): ActionExample => ({
  title: "Example: help the agent reach the right file faster",
  steps: [
    "Pick a common task where the agent spends a long time reading before making its first edit.",
    "Look at the files it explores before the first edit and identify which reads were unnecessary.",
    "Add guidance that names the starting file, the relevant directory, and the validation command.",
    "Repeat the task and compare time to first edit.",
  ],
  snippet: {
    language: "text",
    content:
      "Task: Add a field to the user profile form\n\n" +
      "Before guidance:\n" +
      "Agent reads 18 files\n" +
      "First edit after 2m 14s\n\n" +
      "Guidance:\n" +
      "Start in `apps/web/profile/profile-form.tsx`\n" +
      "Validation: `pnpm test profile`\n" +
      "Ignore `dist/` and generated API clients\n\n" +
      "After guidance:\n" +
      "Agent reads 7 files\n" +
      "First edit after 41s",
  },
});

export const moduleBreadthExample = (): ActionExample => ({
  title: "Example: show agents which modules matter for a task",
  steps: [
    "Find a task where agents regularly wander through many packages or directories.",
    "Write down the small set of modules that actually participate in that workflow.",
    "Document the expected path through those modules and the main entry file for each one.",
    "Repeat the task and check whether the working set becomes smaller.",
  ],
  snippet: {
    language: "markdown",
    content:
      "## Creating an insight\n\n" +
      "Follow this path:\n\n" +
      "1. `analytics/insights.ts` — calculate the insight\n" +
      "2. `shared/insight-types.ts` — shared types\n" +
      "3. `web/components/insight-card.tsx` — display it\n\n" +
      "You normally do not need:\n" +
      "- ingestion\n" +
      "- billing\n" +
      "- authentication\n" +
      "- benchmark scheduling",
  },
});

export const cacheExample = (): ActionExample => ({
  title: "Example: find why repeated context is no longer being reused",
  steps: [
    "Choose one earlier prompt with good cache reuse and one recent prompt with a much higher fresh-input share.",
    "Compare the repeated instructions or generated context sent in both prompts.",
    "Look for changing values such as timestamps, status text, generated metadata, or duplicated context that make otherwise stable input appear different.",
    "Remove or move those changing values where possible, then run ten prompts with the same provider and model and compare fresh-input share.",
  ],
  snippet: {
    language: "text",
    content:
      "Before\n\n" +
      "Stable repository instructions\n" +
      "+ current timestamp\n" +
      "+ changing repository status\n" +
      "+ duplicated generated context\n\n" +
      "The provider sees a different prefix on each prompt.\n\n" +
      "After\n\n" +
      "Stable repository instructions\n" +
      "+ task-specific context added later\n\n" +
      "More of the repeated input can be reused.",
  },
});

export const hotspotExample = (file: {
  path: string;
  generated: boolean;
  inCycle: boolean;
  loc: number;
}): ActionExample => {
  if (file.generated) {
    return {
      title: `Example: stop agents reading generated code`,
      steps: [
        `Find the source file or schema that generates ${file.path}.`,
        "Tell agents to change the source definition instead of opening the generated output.",
        "Mark the generated directory as something they normally should not inspect or edit.",
        "Repeat a similar task and check whether the generated file disappears from routine traversal.",
      ],
      snippet: {
        language: "markdown",
        content:
          "## Generated files\n\n" +
          `Do not edit or inspect \`${file.path}\` unless debugging generation itself.\n\n` +
          "Change the source definition instead:\n" +
          "- `src/schema/api.ts`\n\n" +
          "Regenerate with:\n" +
          "`pnpm generate`",
      },
    };
  }

  if (file.inCycle) {
    return {
      title: `Example: stop agents walking around the import cycle`,
      steps: [
        `Look at the import cycle containing ${file.path}.`,
        "Find the shared type, helper, or contract that causes two modules to depend on each other.",
        "Move that shared piece into a lower-level module that both sides can depend on.",
        "Run the same task again and check whether agents follow fewer files through the cycle.",
      ],
      snippet: {
        language: "text",
        content:
          "Before\n\n" +
          "orders.ts → payments.ts → order-types.ts → orders.ts\n\n" +
          "The agent follows the cycle while trying to understand ownership.\n\n" +
          "After\n\n" +
          "orders.ts → shared/order-contract.ts\n" +
          "payments.ts → shared/order-contract.ts\n\n" +
          "The circular path is gone.",
      },
    };
  }

  if (file.loc > 500) {
    return {
      title: `Example: make ${file.path} easier to understand`,
      steps: [
        `Look at which part of ${file.path} agents usually need when completing a common task.`,
        "Identify one responsibility that can be clearly named and understood on its own.",
        "Either extract that responsibility into a smaller module or document where that responsibility lives inside the file.",
        "Run a similar task and compare how much of the file and surrounding code the agent needs to read.",
      ],
      snippet: {
        language: "text",
        content:
          "Before\n\n" +
          "user-service.ts — 1,200 lines\n" +
          "Contains profile updates, permissions, emails, billing and audit logging.\n\n" +
          "After\n\n" +
          "user-service.ts — public orchestration\n" +
          "profile-service.ts — profile updates\n" +
          "permission-service.ts — permissions\n\n" +
          "A profile task now has a clear place to start.",
      },
    };
  }

  return {
    title: `Example: tell agents when to open ${file.path}`,
    steps: [
      `Write down what ${file.path} is responsible for in plain English.`,
      "List 2–3 types of changes that should start in this file.",
      "List nearby concerns that should start somewhere else, and point to those files.",
      "Run a similar task again and check whether the agent stops reopening this file while searching for the right place.",
    ],
    snippet: {
      language: "markdown",
      content:
        `## ${file.path}\n\n` +
        "This file owns one specific part of the application.\n\n" +
        "Open it when:\n" +
        "- changing behaviour directly owned by this file\n" +
        "- changing the UI or logic exposed by this file\n\n" +
        "Do not start here when:\n" +
        "- changing shared business logic → use the domain/service entry point\n" +
        "- changing telemetry or analytics → use the analytics entry point\n" +
        "- changing generated output → edit the source definition instead",
    },
  };
};

export const toolFailureExample = (toolName: string): ActionExample => ({
  title: `Example: find why ${toolName} keeps failing`,
  steps: [
    `Open a few recent timelines where ${toolName} failed and look for the command or setup step they have in common.`,
    "Run that exact command manually in the same repository and environment.",
    "If something is missing or incorrect, document the prerequisite or corrected command in the repository instructions.",
    "Watch the next 20 known outcomes and check whether the failure rate falls below 10%.",
  ],
});

export const architectureExample = (dimension: string): ActionExample => {
  if (dimension === "fan-out") {
    return {
      title: "Example: stop agents following unnecessary dependencies",
      steps: [
        "Find a file that agents often open and that imports many other modules.",
        "Check whether agents then open several of those imported files just to understand how to make a small change.",
        "If most callers only need a small part of that module, expose that behaviour through one clear entry point or document which file they should use.",
        "Run the same prompt again and check whether the agent visits fewer files and uses less context.",
      ],
      snippet: {
        language: "text",
        content:
          "Before\n\n" +
          "agent-behaviour.tsx\n" +
          "  → insights.ts\n" +
          "  → repository.ts\n" +
          "  → benchmarks.ts\n" +
          "  → telemetry.ts\n" +
          "  → statistics.ts\n\n" +
          "Agent reads 6 files to understand one UI change.\n\n" +
          "After\n\n" +
          "agent-behaviour.tsx\n" +
          "  → agent-insights.ts\n\n" +
          "The public entry point hides the internal implementation.\n\n" +
          "Agent only needs 2 files for the same task.",
      },
    };
  }

  if (dimension === "module-breadth") {
    return moduleBreadthExample();
  }

  if (dimension === "working-set-loc") {
    return {
      title: "Example: reduce how much code an agent has to understand",
      steps: [
        "Find a large file that appears repeatedly in high-context prompt working sets.",
        "Look at what part of that file the agent actually needs for a common task.",
        "Document the relevant section or extract that responsibility behind a clearer entry point.",
        "Run the same prompt again and compare context used and files visited.",
      ],
      snippet: {
        language: "text",
        content:
          "Before\n\n" +
          "Task: change password validation\n" +
          "Agent opens `user-service.ts` — 1,500 lines\n" +
          "Then reads permissions, email and billing helpers.\n\n" +
          "After\n\n" +
          "Repository guidance says:\n" +
          "Password validation starts in `auth/password-policy.ts`.\n\n" +
          "The agent no longer needs to understand the whole user service.",
      },
    };
  }

  if (dimension === "cycle-files") {
    return {
      title: "Example: stop agents walking around an import cycle",
      steps: [
        "Find a cycle that appears in the working set for a high-context prompt.",
        "Check which shared type, helper, or contract forces the files to depend on each other.",
        "Move that shared contract into a lower-level module so the cycle is broken.",
        "Run the same prompt again and check whether the agent follows fewer files through the cycle.",
      ],
      snippet: {
        language: "text",
        content:
          "Before\n\n" +
          "orders.ts → pricing.ts → order-types.ts → orders.ts\n\n" +
          "After\n\n" +
          "orders.ts → shared/order-types.ts\n" +
          "pricing.ts → shared/order-types.ts\n\n" +
          "The agent now sees a one-way dependency path.",
      },
    };
  }

  return {
    title: "Example: test one structural change",
    steps: [
      "Choose the strongest structural pattern associated with high-context prompts.",
      "Make one small change that gives the agent a clearer entry point or smaller working set.",
      "Run the same prompt, provider, and model before and after the change and compare context and files visited.",
    ],
  };
};

export const structuralGrowthExample = (): ActionExample => ({
  title:
    "Example: check whether repository growth actually changed agent behaviour",
  steps: [
    "Choose one saved prompt that already has runs from before the repository grew.",
    "Run the exact same prompt on the latest repository snapshot using the same provider and model.",
    "Compare context used, files visited, and repeated reads.",
    "Only treat repository growth as a problem if the matched task actually became more expensive to navigate.",
  ],
  snippet: {
    language: "text",
    content:
      "Previous snapshot\n" +
      "Repository: 82k LOC\n" +
      "Prompt context: 28k tokens\n" +
      "Files visited: 14\n\n" +
      "Latest snapshot\n" +
      "Repository: 104k LOC\n" +
      "Prompt context: 29k tokens\n" +
      "Files visited: 15\n\n" +
      "The repository grew, but this task did not materially regress.",
  },
});

export const instructionChangeExample = (): ActionExample => ({
  title: "Example: check whether your AGENTS.md change helped",
  steps: [
    "Choose a saved prompt that has at least five runs from before the instruction change.",
    "Run the same prompt at least five times after the change using the same provider and model.",
    "Compare median context, repeated reads, and time to first edit.",
    "Keep the new guidance only if the behaviour actually improves or stays neutral.",
  ],
});

export const instructionEffectivenessExample = (
  result: "improved" | "regressed" | "unchanged",
): ActionExample =>
  result === "improved"
    ? {
        title: "Example: confirm the instruction change really helped",
        steps: [
          "Leave the instruction unchanged for now.",
          "Collect five more complete runs for the same prompt cohorts.",
          "Check whether context and traversal stay below the previous baseline.",
          "Keep the change if the improvement persists.",
        ],
      }
    : {
        title:
          result === "regressed"
            ? "Example: make the new instruction more specific"
            : "Example: turn vague guidance into a clear route",
        steps: [
          "Choose one common task represented in the matched prompts.",
          "Replace broad guidance with a specific starting file, an explicit avoid list, and one validation command.",
          "Run the same task again at least five times.",
          "Compare the new median with both the old and current instruction periods.",
        ],
        snippet: {
          language: "markdown",
          content:
            "For this task:\n" +
            "- Start here: `src/feature/index.ts`\n" +
            "- Avoid: generated output and unrelated packages\n" +
            "- Validate with: `pnpm test feature`",
        },
      };

export const structuralEfficiencyExample = (): ActionExample => ({
  title: "Example: find what became harder after the repository changed",
  steps: [
    "Compare File hotspots before and after the latest repository snapshot.",
    "Look for a file or module that suddenly appears in more prompts or is being reread more often.",
    "Check whether agents now have to pass through that area to reach code they previously found directly.",
    "Add a clearer entry point or tighten the boundary, then rerun the same benchmark.",
  ],
});

export const onboardingExample = (): ActionExample => ({
  title: "Example: give new users a clear first route through the repository",
  steps: [
    "Write down the three things someone needs before making a useful first change: setup, where to start, and how to validate.",
    "Put that information near the top of AGENTS.md.",
    "Keep it short enough that an agent can use it as routing guidance rather than documentation to study.",
    "Compare repeated exploration for the next group of new developers.",
  ],
  snippet: {
    language: "markdown",
    content:
      "## First five minutes\n\n" +
      "1. Install and verify: `pnpm install && pnpm test`\n" +
      "2. Start from the module map below rather than searching the whole repository.\n" +
      "3. Validate the affected package first before running the full suite.",
  },
});

export const modelComparisonExample = (
  first: string,
  second: string,
): ActionExample => ({
  title: `Example: check whether ${first} is actually a better choice`,
  steps: [
    `Run the same saved prompt with ${first} and ${second}.`,
    "Judge both outputs using the same test, acceptance criteria, or human review.",
    "Only prefer the lower-context model if its result is equally good or better.",
    "If quality passes, collect at least five runs per model before changing routing.",
  ],
});

export const promptComparisonExample = (
  aboveBaseline: boolean,
): ActionExample =>
  aboveBaseline
    ? {
        title: "Example: find why this prompt needed more context",
        steps: [
          "Open the prompt working set and sort files by reads or size.",
          "Look for a file that was reopened several times or caused the agent to branch into many related files.",
          "Add a clearer entry-point note or simplify that path.",
          "Save this exact prompt as a benchmark and rerun it to see whether context falls.",
        ],
      }
    : {
        title: "Example: preserve this efficient path",
        steps: [
          "Save this exact prompt as a benchmark.",
          "Record the current provider, model, and repository snapshot as the baseline.",
          "Rerun it after future instruction or structural changes.",
          "Investigate if context increases by more than 10% or the agent starts visiting substantially more files.",
        ],
      };

export const actionHref = {
  repository: repositoryHref,
  benchmark: (scope: Scope) =>
    scope.benchmarkId
      ? `/benchmarks/${scope.benchmarkId}`
      : repositoryHref(scope, "benchmarks"),
  hotspot: (scope: Scope, path: string) =>
    repositoryHref(scope, "hotspots", { file: path }, "evidence"),
  tool: (scope: Scope, toolName: string) =>
    repositoryHref(scope, "tools", { tool: toolName }, "evidence"),
  structure: (scope: Scope) =>
    scope.repositoryId
      ? `/repos/${scope.repositoryId}#repository-structure`
      : undefined,
  comparisons: (scope: Scope) => repositoryHref(scope, "comparisons"),
  promptWorkingSet: (scope: Scope) =>
    scope.promptId ? `/prompts/${scope.promptId}#working-set` : undefined,
  promptBenchmark: (scope: Scope) =>
    scope.promptId ? `/prompts/${scope.promptId}#create-benchmark` : undefined,
};
