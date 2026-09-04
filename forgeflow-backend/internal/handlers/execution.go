package handlers

import (
	"encoding/json"
	"errors"
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
	"github.com/rahuldev403/forgeflow/internal/database"
	"github.com/rahuldev403/forgeflow/internal/domain"
)

// GetExecutions lists recent runs for a workflow. The panel polls this while a run
// is in flight, so it stays deliberately small -- steps come from GetExecution.
func GetExecutions(c *fiber.Ctx) error {
	workflowID, _, guardErr := guardWorkflow(c)
	if guardErr != nil {
		return guardErr
	}

	limit := 20
	if raw := c.Query("limit"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}

	rows, err := database.DB.Query(c.Context(), `
		SELECT id, workflow_id, status, trigger_type, trigger_payload, error, attempts, started_at, completed_at
		FROM executions
		WHERE workflow_id = $1
		ORDER BY started_at DESC
		LIMIT $2
	`, workflowID, limit)
	if err != nil {
		return serverError(c, "listing executions", err)
	}
	defer rows.Close()

	executions := make([]domain.Execution, 0)
	for rows.Next() {
		ex, err := scanExecution(rows)
		if err != nil {
			return serverError(c, "scanning execution row", err)
		}
		executions = append(executions, ex)
	}
	if err := rows.Err(); err != nil {
		return serverError(c, "reading execution rows", err)
	}

	return c.JSON(executions)
}

// GetExecution returns one run with its full per-node timeline. This is the view
// that answers "what actually happened", which v1 had no way to show at all.
func GetExecution(c *fiber.Ctx) error {
	workflowID, _, guardErr := guardWorkflow(c)
	if guardErr != nil {
		return guardErr
	}

	executionID := c.Params("executionId")
	if !isUUID(executionID) {
		return badRequest(c, "Invalid execution id")
	}

	row := database.DB.QueryRow(c.Context(), `
		SELECT id, workflow_id, status, trigger_type, trigger_payload, error, attempts, started_at, completed_at
		FROM executions WHERE id = $1 AND workflow_id = $2
	`, executionID, workflowID)

	ex, err := scanExecution(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return notFound(c, "Execution not found")
	}
	if err != nil {
		return serverError(c, "fetching execution", err)
	}

	steps, err := fetchSteps(c, executionID)
	if err != nil {
		return err
	}
	ex.Steps = steps

	return c.JSON(ex)
}

func fetchSteps(c *fiber.Ctx, executionID string) ([]domain.ExecutionStep, error) {
	rows, err := database.DB.Query(c.Context(), `
		SELECT id, node_id, node_name, node_type, step_order, status, attempt,
		       input, output, error, started_at, completed_at
		FROM execution_steps
		WHERE execution_id = $1
		ORDER BY step_order ASC
	`, executionID)
	if err != nil {
		return nil, serverError(c, "fetching execution steps", err)
	}
	defer rows.Close()

	steps := make([]domain.ExecutionStep, 0)
	for rows.Next() {
		var s domain.ExecutionStep
		if err := rows.Scan(&s.ID, &s.NodeID, &s.NodeName, &s.NodeType, &s.StepOrder,
			&s.Status, &s.Attempt, &s.Input, &s.Output, &s.Error,
			&s.StartedAt, &s.CompletedAt); err != nil {
			return nil, serverError(c, "scanning step row", err)
		}
		steps = append(steps, s)
	}
	if err := rows.Err(); err != nil {
		return nil, serverError(c, "reading step rows", err)
	}
	return steps, nil
}

// scanner lets the same scan logic serve both Query rows and a single QueryRow.
type scanner interface {
	Scan(dest ...any) error
}

func scanExecution(s scanner) (domain.Execution, error) {
	var ex domain.Execution
	var payloadJSON []byte

	err := s.Scan(&ex.ID, &ex.WorkflowID, &ex.Status, &ex.TriggerType, &payloadJSON,
		&ex.Error, &ex.Attempts, &ex.StartedAt, &ex.CompletedAt)
	if err != nil {
		return ex, err
	}

	ex.TriggerPayload = map[string]any{}
	if len(payloadJSON) > 0 {
		_ = json.Unmarshal(payloadJSON, &ex.TriggerPayload)
	}
	return ex, nil
}
