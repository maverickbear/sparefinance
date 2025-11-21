-- ============================================================================
-- Create User Block History table
-- ============================================================================
-- Date: 2025-02-02
-- Description: Creates table to track history of user blocks and unblocks
--              with reasons/comments
-- ============================================================================

CREATE TABLE IF NOT EXISTS "public"."UserBlockHistory" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "userId" uuid NOT NULL,
    "action" text NOT NULL,
    "reason" text,
    "blockedBy" uuid NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "UserBlockHistory_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UserBlockHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE,
    CONSTRAINT "UserBlockHistory_blockedBy_fkey" FOREIGN KEY ("blockedBy") REFERENCES "public"."User"("id") ON DELETE SET NULL,
    CONSTRAINT "UserBlockHistory_action_check" CHECK (("action" = ANY (ARRAY['block'::"text", 'unblock'::"text"])))
);

ALTER TABLE "public"."UserBlockHistory" OWNER TO "postgres";

COMMENT ON TABLE "public"."UserBlockHistory" IS 'Tracks history of user blocks and unblocks with reasons';
COMMENT ON COLUMN "public"."UserBlockHistory"."action" IS 'Action taken: block or unblock';
COMMENT ON COLUMN "public"."UserBlockHistory"."reason" IS 'Reason/comment for the action';
COMMENT ON COLUMN "public"."UserBlockHistory"."blockedBy" IS 'User ID of the admin who performed the action';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS "UserBlockHistory_userId_idx" ON "public"."UserBlockHistory"("userId");
CREATE INDEX IF NOT EXISTS "UserBlockHistory_createdAt_idx" ON "public"."UserBlockHistory"("createdAt" DESC);

