package handlers

import (
	"context"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rahuldev403/forgeflow/internal/database"
)

type CreateWorkflowReqeust struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

func CreateWorkflow(c *fiber.Ctx) error {
	var req CreateWorkflowReqeust

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Failed to parse JSON body",
		})
	}

	userID := c.Locals("user_id").(string)

	query := `
		INSERT INTO workflows (user_id, name, description, is_active) 
		VALUES ($1, $2, $3, $4) 
		RETURNING id, created_at
	`

	var id string
	var createdAt time.Time

	err := database.DB.QueryRow(context.Background(), query, userID, req.Name, req.Description, true).Scan(&id, &createdAt)

	if err != nil {
		log.Printf("DB Error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to insert into database",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message":    "Workflow created successfully",
		"id":         id,
		"created_at": createdAt,
	})
}

type WorkflowResponse struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
}

func GetWorkflows(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)

	query := `SELECT id, name, description, is_active, created_at FROM workflows WHERE user_id = $1 ORDER BY created_at DESC`

	rows, err := database.DB.Query(context.Background(), query, userID)
	if err != nil {
		log.Printf("DB Fetch Error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{ 
			"error": "Failed to fetch workflows",
		})
	}

	defer rows.Close()

	var workflows []WorkflowResponse

	// Initialize to empty slice so we return [] instead of null if empty
	workflows = make([]WorkflowResponse, 0)

	for rows.Next() {
		var wf WorkflowResponse

		if err := rows.Scan(&wf.ID, &wf.Name, &wf.Description, &wf.IsActive, &wf.CreatedAt); err != nil {
			log.Printf("Row Scan Error: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to parse a row",
			})
		}
		workflows = append(workflows, wf)
	}

	return c.JSON(workflows)
}
