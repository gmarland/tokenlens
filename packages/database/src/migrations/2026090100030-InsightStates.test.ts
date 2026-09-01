import { describe, expect, it, vi } from "vitest";
import { InsightStates2026090100030 } from "./2026090100030-InsightStates";

describe("InsightStates2026090100030", () => {
  it("constrains workflow state and repository insight identity", async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    await new InsightStates2026090100030().up({ query } as any);
    const sql = query.mock.calls.map(([value]) => value).join("\n");
    expect(sql).toContain("CHECK (state IN ('new','acknowledged','monitoring','dismissed','resolved'))");
    expect(sql).toContain("insight_state_repository_insight_uq");
  });
});
