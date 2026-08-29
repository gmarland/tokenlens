ALTER TABLE "prompts" RENAME COLUMN "claude_prompt_id" TO "external_prompt_id";--> statement-breakpoint
DROP INDEX "prompt_workspace_claude_uq";--> statement-breakpoint
DROP INDEX "tool_event_uq";--> statement-breakpoint
ALTER TABLE "api_requests" ALTER COLUMN "cost_usd" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "api_requests" ALTER COLUMN "cost_usd" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "developers" ADD COLUMN "provider" text DEFAULT 'claude' NOT NULL;--> statement-breakpoint
ALTER TABLE "developers" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "prompts" ADD COLUMN "provider" text DEFAULT 'claude' NOT NULL;--> statement-breakpoint
ALTER TABLE "prompts" ADD COLUMN "model" text;--> statement-breakpoint
ALTER TABLE "repo_snapshots" ADD COLUMN "agents_md_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "repo_snapshots" ADD COLUMN "agents_md_total_bytes" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "developers" SET "external_id" = coalesce("anthropic_account_uuid", "anthropic_account_id", "anthropic_anonymous_id", "email");--> statement-breakpoint
UPDATE "prompts" p SET "model" = (SELECT max(a."model") FROM "api_requests" a WHERE a."prompt_id" = p."id");--> statement-breakpoint
CREATE UNIQUE INDEX "developer_workspace_provider_external_uq" ON "developers" USING btree ("workspace_id","provider","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prompt_workspace_provider_external_uq" ON "prompts" USING btree ("workspace_id","provider","external_prompt_id");--> statement-breakpoint
CREATE INDEX "prompt_provider_idx" ON "prompts" USING btree ("provider");--> statement-breakpoint
CREATE UNIQUE INDEX "tool_event_uq" ON "tool_events" USING btree ("workspace_id","prompt_id","tool_use_id");--> statement-breakpoint
ALTER TABLE "developers" DROP COLUMN "anthropic_account_id";--> statement-breakpoint
ALTER TABLE "developers" DROP COLUMN "anthropic_account_uuid";--> statement-breakpoint
ALTER TABLE "developers" DROP COLUMN "anthropic_anonymous_id";
