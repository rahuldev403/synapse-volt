package engine

import (
	"context"
	"log"
	"time"

	"github.com/rahuldev403/forgeflow/internal/ai"
	"github.com/rahuldev403/forgeflow/internal/database"
)

var JobQueue = make(chan string, 100)

func StartWorkerPool(numWorkers int) {
	for i := 1; i <= numWorkers; i++ {
		go worker(i)
	}
	log.Printf("Started %d background workers", numWorkers)
}

func worker(id int) {
	log.Printf("Worker %d is ready and listening", id)

	for executionID := range JobQueue {
		log.Printf("[Worker %d] Picked up execution: %s", id, executionID)

		maxRetries := 3
		attempt := 1
		success := false

		for attempt <= maxRetries {
			log.Printf("[Worker %d] Starting execution: %s (Attempt %d/%d)", id, executionID, attempt, maxRetries)

			err := processWorkflowSteps(id, executionID)

			if err != nil {
				log.Printf("[Worker %d] ⚠️ Execution FAILED: %v", id, err)
				
				if attempt < maxRetries {
					backoff := time.Duration(attempt*2) * time.Second
					log.Printf("[Worker %d] Retrying in %v...", id, backoff)
					time.Sleep(backoff)
					attempt++
				} else {
					log.Printf("[Worker %d] ❌ Max retries reached. Marking as FAILED.", id)
					updateExecutionStatus(executionID, "FAILED")
					break
				}
			} else {
				log.Printf("[Worker %d] ✅ Execution SUCCESS: %s", id, executionID)
				updateExecutionStatus(executionID, "SUCCESS")
				success = true
				break 
			}
		}

		if !success && attempt > maxRetries {
			log.Printf("[Worker %d] Job %s moved to Dead-Letter state.", id, executionID)
		}
	}
}

func processWorkflowSteps(workerID int, executionID string) error {
	ctx := context.Background()

	var workflowID string
	var triggerPayload []byte

	query := `SELECT workflow_id, trigger_payload FROM executions WHERE id = $1`
	err := database.DB.QueryRow(ctx, query, executionID).Scan(&workflowID, &triggerPayload)
	if err != nil {
		return err
	}
	rows, err := database.DB.Query(ctx, `SELECT id, name, type FROM nodes WHERE workflow_id = $1 ORDER BY created_at ASC`, workflowID)

	if err != nil {
		return err
	}
	defer rows.Close()

	stepCount := 0
	for rows.Next() {
		var nodeID, nodeName, nodeType string
		if err := rows.Scan(&nodeID, &nodeName, &nodeType); err != nil {
			continue
		}

		stepCount++
		log.Printf("[Worker %d]   -> Running Step %d: [%s] %s", workerID, stepCount, nodeType, nodeName)

		if nodeType == "AI" {
			log.Printf("[Worker %d]      Contacting AI Agent with Tools...", workerID)

			prompt := "Read this support ticket. If the customer is asking for money back or a refund, use the refund_customer tool."
			webhookData := string(triggerPayload)
			toolName, toolArgs, err := ai.AnalyzePayloadWithTools(prompt, webhookData, ai.AvailableTools)
			if err != nil {
				log.Printf("[Worker %d]      AI Error: %v", workerID, err)
				return err
			} else if toolName != "NO_TOOL_CALLED" {
				log.Printf("[Worker %d]      🤖 AI decided to call tool: %s", workerID, toolName)

				toolResult := ai.ExecuteLocalTool(toolName, toolArgs)
				log.Printf("[Worker %d]      Tool Result: %s", workerID, toolResult)
			} else {
				log.Printf("[Worker %d]      AI Decision: Routine message, no tool required.", workerID)
			}
		}

		time.Sleep(1 * time.Second)
	}

	if stepCount == 0 {
		log.Printf("[Worker %d]   -> No steps found for workflow %s", workerID, workflowID)

	}

	return nil
}

func updateExecutionStatus(executionID, status string) {
	query := `UPDATE executions SET status = $1, completed_at = $2 WHERE id = $3`
	_, err := database.DB.Exec(context.Background(), query, status, time.Now(), executionID)
	if err != nil {
		log.Printf("Failed to update execution status: %v", err)
	}
}
