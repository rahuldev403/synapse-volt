-- ForgeFlow schema v2
-- Full current schema. For upgrading an existing v1 database, run migrations/ in order.

-- =============================================================
-- 1. Workflows
-- =============================================================
CREATE TABLE IF NOT EXISTS workflows (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     VARCHAR(255) NOT NULL,
    name        VARCHAR(255) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON workflows (user_id, created_at DESC);

-- =============================================================
-- 2. Nodes -- the steps of the graph
-- =============================================================
CREATE TABLE IF NOT EXISTS nodes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    type        VARCHAR(50)  NOT NULL,  -- TRIGGER | HTTP | AI | CONDITION | TRANSFORM | DELAY | LOG
    config      JSONB NOT NULL DEFAULT '{}',
    position_x  DOUBLE PRECISION NOT NULL DEFAULT 0,
    position_y  DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nodes_workflow_id ON nodes (workflow_id, created_at);

-- =============================================================
-- 3. Edges -- the graph is a DAG, not a linked list
-- =============================================================
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

-- =============================================================
-- 4. Executions -- one run of a workflow
-- =============================================================
CREATE TABLE IF NOT EXISTS executions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id     UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    status          VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING|RUNNING|SUCCESS|FAILED|DEAD_LETTER
    trigger_type    VARCHAR(50) NOT NULL DEFAULT 'WEBHOOK', -- WEBHOOK|MANUAL
    trigger_payload JSONB NOT NULL DEFAULT '{}',
    error           TEXT,
    attempts        INT NOT NULL DEFAULT 0,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_executions_workflow_id ON executions (workflow_id, started_at DESC);

-- =============================================================
-- 5. Execution steps -- per-node observability, one row per node per run
-- =============================================================
CREATE TABLE IF NOT EXISTS execution_steps (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
    node_id      UUID REFERENCES nodes(id) ON DELETE SET NULL,
    node_name    VARCHAR(255) NOT NULL,
    node_type    VARCHAR(50)  NOT NULL,
    step_order   INT NOT NULL,
    status       VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING|RUNNING|SUCCESS|FAILED|SKIPPED
    attempt      INT NOT NULL DEFAULT 0,
    input        JSONB,
    output       JSONB,
    error        TEXT,
    started_at   TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    CONSTRAINT execution_steps_unique_node UNIQUE (execution_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_execution_steps_execution ON execution_steps (execution_id, step_order);
