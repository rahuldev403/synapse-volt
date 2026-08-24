package handlers

import (
	"context"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rahuldev403/forgeflow/internal/database"
)

type ExecutionResponse struct {
	ID             string                 `json:"id"`
	Status         string                 `json:"status"`
	TriggerPayload map[string]interface{} `json:"trigger_payload"`
	StartedAt      time.Time              `json:"started_at"`
	CompletedAt    *time.Time             `json:"completed_at"`
}

func GetWorkflowExecutions(c *fiber.Ctx) error {
	workflowID := c.Params("workflowId")

	query := `
		SELECT id, status, trigger_payload, started_at, completed_at 
		FROM executions 
		WHERE workflow_id = $1 
		ORDER BY started_at DESC LIMIT 10
	`
	rows, err := database.DB.Query(context.Background(), query, workflowID)

	if err != nil {
		log.Printf("DB Fetch Error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch executions",
		})
	}

	defer rows.Close()

	executions := make([]ExecutionResponse, 0)

	for rows.Next() {
		var ex ExecutionResponse
		if err := rows.Scan(&ex.ID, &ex.Status, &ex.TriggerPayload, &ex.StartedAt, &ex.CompletedAt); err != nil {
			log.Printf("Row Scan Error: %v", err)
			continue
		}
		executions = append(executions, ex)
	}

	return c.JSON(executions)
}
