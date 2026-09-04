package domain

import (
	"encoding/json"
	"time"
)

// Node types supported by the engine. Each has an executor in internal/engine.
const (
	NodeTrigger   = "TRIGGER"
	NodeHTTP      = "HTTP"
	NodeAI        = "AI"
	NodeCondition = "CONDITION"
	NodeTransform = "TRANSFORM"
	NodeDelay     = "DELAY"
	NodeLog       = "LOG"
)

// Execution + step statuses.
const (
	StatusPending    = "PENDING"
	StatusRunning    = "RUNNING"
	StatusSuccess    = "SUCCESS"
	StatusFailed     = "FAILED"
	StatusSkipped    = "SKIPPED"
	StatusDeadLetter = "DEAD_LETTER"
)

type Workflow struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	// Denormalised summary fields, filled in by list/detail queries.
	NodeCount     int        `json:"node_count"`
	LastRunStatus *string    `json:"last_run_status"`
	LastRunAt     *time.Time `json:"last_run_at"`
}

type Node struct {
	ID         string         `json:"id"`
	WorkflowID string         `json:"workflow_id"`
	Name       string         `json:"name"`
	Type       string         `json:"type"`
	Config     map[string]any `json:"config"`
	PositionX  float64        `json:"position_x"`
	PositionY  float64        `json:"position_y"`
	CreatedAt  time.Time      `json:"created_at"`
}

type Edge struct {
	ID           string `json:"id"`
	WorkflowID   string `json:"workflow_id"`
	SourceNodeID string `json:"source_node_id"`
	TargetNodeID string `json:"target_node_id"`
}

// Graph is everything the canvas and the engine need to render or run a workflow.
type Graph struct {
	Nodes []Node `json:"nodes"`
	Edges []Edge `json:"edges"`
}

type Execution struct {
	ID             string          `json:"id"`
	WorkflowID     string          `json:"workflow_id"`
	Status         string          `json:"status"`
	TriggerType    string          `json:"trigger_type"`
	TriggerPayload map[string]any  `json:"trigger_payload"`
	Error          *string         `json:"error"`
	Attempts       int             `json:"attempts"`
	StartedAt      time.Time       `json:"started_at"`
	CompletedAt    *time.Time      `json:"completed_at"`
	Steps          []ExecutionStep `json:"steps,omitempty"`
}

type ExecutionStep struct {
	ID          string          `json:"id"`
	NodeID      *string         `json:"node_id"`
	NodeName    string          `json:"node_name"`
	NodeType    string          `json:"node_type"`
	StepOrder   int             `json:"step_order"`
	Status      string          `json:"status"`
	Attempt     int             `json:"attempt"`
	Input       json.RawMessage `json:"input"`
	Output      json.RawMessage `json:"output"`
	Error       *string         `json:"error"`
	StartedAt   *time.Time      `json:"started_at"`
	CompletedAt *time.Time      `json:"completed_at"`
}
