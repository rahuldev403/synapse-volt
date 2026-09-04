-- Upgrades a ForgeFlow v1 database in place. Safe to re-run.
BEGIN;

-- workflows -------------------------------------------------------------
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
UPDATE workflows SET description = '' WHERE description IS NULL;
ALTER TABLE workflows ALTER COLUMN description SET DEFAULT '';
ALTER TABLE workflows ALTER COLUMN description SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON workflows (user_id, created_at DESC);

-- nodes -----------------------------------------------------------------
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS position_x DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS position_y DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_nodes_workflow_id ON nodes (workflow_id, created_at);

-- edges: new table, backfilled from the old next_node_id linked list ------
CREATE TABLE IF NOT EXISTS edges (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id    UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    source_node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    target_node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT edges_no_self_loop CHECK (source_node_id <> target_node_id),
    CONSTRAINT edges_unique_pair  UNIQUE (source_node_id, target_node_id)
);
CREATE INDEX IF NOT EXISTS idx_edges_workflow_id ON edges (workflow_id);

INSERT INTO edges (workflow_id, source_node_id, target_node_id)
SELECT n.workflow_id, n.id, n.next_node_id
FROM nodes n
WHERE n.next_node_id IS NOT NULL AND n.next_node_id <> n.id
ON CONFLICT (source_node_id, target_node_id) DO NOTHING;

ALTER TABLE nodes DROP COLUMN IF EXISTS next_node_id;

-- give migrated nodes a readable left-to-right layout
WITH ordered AS (
    SELECT id, row_number() OVER (PARTITION BY workflow_id ORDER BY created_at) - 1 AS idx
    FROM nodes
)
UPDATE nodes n SET position_x = 260, position_y = 80 + ordered.idx * 150
FROM ordered WHERE ordered.id = n.id AND n.position_x = 0 AND n.position_y = 0;

-- executions ------------------------------------------------------------
ALTER TABLE executions ADD COLUMN IF NOT EXISTS trigger_type VARCHAR(50) NOT NULL DEFAULT 'WEBHOOK';
ALTER TABLE executions ADD COLUMN IF NOT EXISTS error TEXT;
ALTER TABLE executions ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0;
UPDATE executions SET trigger_payload = '{}'::jsonb WHERE trigger_payload IS NULL;
ALTER TABLE executions ALTER COLUMN trigger_payload SET DEFAULT '{}';
ALTER TABLE executions ALTER COLUMN trigger_payload SET NOT NULL;
UPDATE executions SET started_at = now() WHERE started_at IS NULL;
ALTER TABLE executions ALTER COLUMN started_at SET DEFAULT now();
ALTER TABLE executions ALTER COLUMN started_at SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_executions_workflow_id ON executions (workflow_id, started_at DESC);

-- execution_steps -------------------------------------------------------
CREATE TABLE IF NOT EXISTS execution_steps (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
    node_id      UUID REFERENCES nodes(id) ON DELETE SET NULL,
    node_name    VARCHAR(255) NOT NULL,
    node_type    VARCHAR(50)  NOT NULL,
    step_order   INT NOT NULL,
    status       VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    attempt      INT NOT NULL DEFAULT 0,
    input        JSONB,
    output       JSONB,
    error        TEXT,
    started_at   TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    CONSTRAINT execution_steps_unique_node UNIQUE (execution_id, node_id)
);
CREATE INDEX IF NOT EXISTS idx_execution_steps_execution ON execution_steps (execution_id, step_order);

COMMIT;
