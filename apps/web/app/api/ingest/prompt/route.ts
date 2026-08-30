import { promptHookSchema } from "@tokenlens/shared";
import { ingestPrompt } from "@tokenlens/database/services";
import { ingest } from "../../../../lib/http";
export const POST = (req: any) =>
  ingest(
    req,
    async (w, b) => ingestPrompt(w.id, promptHookSchema.parse(b)),
    64_000,
  );
