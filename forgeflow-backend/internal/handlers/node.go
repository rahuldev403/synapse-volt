package handlers

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rahuldev403/forgeflow/internal/database"
)

type CreateNodeRequest struct {
	Name       string                 `json:"name"`
	Type       string                 `json:"type"`
	Config     map[string]interface{} `json:"config"`
	NextNodeId *string                `json:"next_node_id"`
}

type NodeResponse struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	Type       string  `json:"type"`
	NextNodeID *string `json:"next_node_id"`
}

func CreateWorkflowNode(c *fiber.Ctx) error {
	workflowId := c.Params("workflowId")

	var req CreateNodeRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	query := `
		INSERT INTO nodes (workflow_id, name, type, config, next_node_id)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at
	`
	var nodeId string
	var createdAt time.Time

	configBytes, err := json.Marshal(req.Config)
	if err != nil {
		log.Printf("Failed to marshal config: %v", err)
		configBytes = []byte("{}")
	}

	err = database.DB.QueryRow(
		context.Background(),
		query,
		workflowId,
		req.Name,
		req.Type,
		configBytes,
		req.NextNodeId,
	).Scan(&nodeId, &createdAt)

	if err != nil {
		log.Printf("Failed to create node: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to create workflow node",
		})
	}

	// Auto-link: If this isn't the first node and next_node_id wasn't explicitly provided, link the previous tail node to this new node
	if req.NextNodeId == nil {
		updateTailQuery := `
			UPDATE nodes 
			SET next_node_id = $1 
			WHERE workflow_id = $2 
			  AND next_node_id IS NULL 
			  AND id != $1
		`
		if _, err := database.DB.Exec(context.Background(), updateTailQuery, nodeId, workflowId); err != nil {
			log.Printf("Warning: Failed to update previous tail node next_node_id: %v", err)
		}
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message":     "Node added successfully",
		"node_id":     nodeId,
		"workflow_id": workflowId,
		"created_at":  createdAt,
	})
}

func GetWorkflowNodes(c *fiber.Ctx) error {
	workflowID := c.Params("workflowId")

	query := `SELECT id, name, type, next_node_id FROM nodes WHERE workflow_id = $1 ORDER BY created_at ASC`
	rows, err := database.DB.Query(context.Background(), query, workflowID)

	if err != nil {
		log.Printf("Failed to fetch nodes: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Database error"})
	}
	defer rows.Close()

	nodes := make([]NodeResponse, 0)
	for rows.Next() {
		var n NodeResponse
		if err := rows.Scan(&n.ID, &n.Name, &n.Type, &n.NextNodeID); err != nil {
			continue
		}
		nodes = append(nodes, n)
	}

	return c.JSON(nodes)
}

func DeleteWorkflowNode(c *fiber.Ctx) error {
	workflowId := c.Params("workflowId")
	nodeId := c.Params("nodeId")

	ctx := context.Background()

	// 1. Get target node's next_node_id before deleting
	var nextNodeId *string
	query := `SELECT next_node_id FROM nodes WHERE id = $1 AND workflow_id = $2`
	err := database.DB.QueryRow(ctx, query, nodeId, workflowId).Scan(&nextNodeId)
	if err != nil {
		log.Printf("Node not found or DB error: %v", err)
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Node not found",
		})
	}

	// 2. Relink any node pointing to this node to point to this node's next_node_id
	updateQuery := `UPDATE nodes SET next_node_id = $1 WHERE workflow_id = $2 AND next_node_id = $3`
	if _, err := database.DB.Exec(ctx, updateQuery, nextNodeId, workflowId, nodeId); err != nil {
		log.Printf("Warning: Failed to update linked nodes when deleting node: %v", err)
	}

	// 3. Delete the node
	deleteQuery := `DELETE FROM nodes WHERE id = $1 AND workflow_id = $2`
	res, err := database.DB.Exec(ctx, deleteQuery, nodeId, workflowId)
	if err != nil {
		log.Printf("Failed to delete node: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to delete node",
		})
	}

	if res.RowsAffected() == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Node not found",
		})
	}

	return c.JSON(fiber.Map{
		"message": "Node deleted successfully",
		"node_id": nodeId,
	})
}
