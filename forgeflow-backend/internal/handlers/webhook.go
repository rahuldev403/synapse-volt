package handlers

import (
	"encoding/json"
	"errors"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
	"github.com/rahuldev403/forgeflow/internal/database"
	"github.com/rahuldev403/forgeflow/internal/domain"
	"github.com/rahuldev403/forgeflow/internal/engine"
)

// TriggerWebhook is the public ingress. It is deliberately not behind auth -- the
// workflow id in the URL is the credential, the same shape Stripe and GitHub use.
//
// It does the smallest possible amount of work: validate, insert one row, hand the
// id to the worker pool, return 202. The run happens on a background goroutine, so
// a slow AI call never holds the caller's connection open.
func TriggerWebhook(c *fiber.Ctx) error {
	workflowID := c.Params("workflowId")
	if !isUUID(workflowID) {
		return badRequest(c, "Invalid workflow id")
	}

	// v1 inserted an execution for any id at all and let the foreign key blow up as
	// a 500. Checking first turns that into an honest 404, and lets a paused
	// workflow reject traffic without discarding it silently.
	var isActive bool
	err := database.DB.QueryRow(c.Context(),
		`SELECT is_active FROM workflows WHERE id = $1`, workflowID).Scan(&isActive)
	if errors.Is(err, pgx.ErrNoRows) {
		return notFound(c, "No workflow with that id")
	}
	if err != nil {
		return serverError(c, "looking up workflow for webhook", err)
	}
	if !isActive {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error": "This workflow is paused. Activate it to accept webhooks.",
		})
	}

	payload := map[string]any{}
	if len(c.Body()) > 0 {
		if err := json.Unmarshal(c.Body(), &payload); err != nil {
			return badRequest(c, "Request body must be a JSON object")
		}
	}

	triggerType := "WEBHOOK"
	if c.Query("source") == "manual" {
		triggerType = "MANUAL"
	}

	return startExecution(c, workflowID, triggerType, payload)
}

// RunWorkflow is the authenticated "Run now" button in the builder. Same machinery
// as the webhook, but it works on a paused workflow so you can test before going live.
func RunWorkflow(c *fiber.Ctx) error {
	workflowID, _, guardErr := guardWorkflow(c)
	if guardErr != nil {
		return guardErr
	}

	payload := map[string]any{}
	if len(c.Body()) > 0 {
		if err := json.Unmarshal(c.Body(), &payload); err != nil {
			return badRequest(c, "Request body must be a JSON object")
		}
	}

	return startExecution(c, workflowID, "MANUAL", payload)
}

func startExecution(c *fiber.Ctx, workflowID, triggerType string, payload map[string]any) error {
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return badRequest(c, "Payload could not be encoded as JSON")
	}

	var executionID string
	err = database.DB.QueryRow(c.Context(), `
		INSERT INTO executions (workflow_id, status, trigger_type, trigger_payload)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`, workflowID, domain.StatusPending, triggerType, payloadJSON).Scan(&executionID)
	if err != nil {
		return serverError(c, "creating execution", err)
	}

	if err := engine.Enqueue(executionID); err != nil {
		// The row is already written and marked failed by the pool, so the run shows
		// up in the timeline with a reason instead of vanishing.
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error":        "The engine is at capacity, try again in a moment",
			"execution_id": executionID,
		})
	}

	return c.Status(fiber.StatusAccepted).JSON(fiber.Map{
		"message":      "Execution queued",
		"execution_id": executionID,
		"status":       domain.StatusPending,
	})
}
