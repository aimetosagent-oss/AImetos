-- Keep internal outbox events while allowing their external webhook fan-out to be disabled.
ALTER TABLE "OutboxEvent"
ADD COLUMN "webhookDispatchEnabled" BOOLEAN NOT NULL DEFAULT true;
