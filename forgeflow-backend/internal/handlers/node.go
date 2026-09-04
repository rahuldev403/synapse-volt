package handlers

import (
	"encoding/json"
	"errors"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
	"github.com/rahuldev403/forgeflow/internal/database"
	"github.com/rahuldev403/forgeflow/internal/domain"
)

type createNodeInput struct {
	Name      string         `json:"name"`
	Type      string         `json:"type"`
	Config    map[string]any `json:"config"`
	PositionX float64        `json:"position_x"`
	PositionY float64        `json:"position_y"`
}

type updateNodeInput struct {
	Name      *string        `json:"name"`
	Config    map[string]any `json:"config"`
	PositionX *float64       `json:"position_x"`
	PositionY *float64       `json:"position_y"`
}

// GetGraph returns nodes and edges together. The canvas needs both to render, and
// two round trips would let it paint edges pointing at nodes it has not loaded yet.
func GetGraph(c *fiber.Ctx) error {
	workflowID, _, guardErr := guardWorkflow(c)
	if guardErr != nil {
		return guardErr
	}

	nodes, err := fetchNodes(c, workflowID)
	if err != nil {
		return err
	}
	edges, err := fetchEdges(c, workflowID)
	if err != nil {
		return err
	}

	return c.JSON(domain.Graph{Nodes: nodes, Edges: edges})
}

func fetchNodes(c *fiber.Ctx, workflowID string) ([]domain.Node, error) {
	rows, err := database.DB.Query(c.Context(), `
		SELECT id, workflow_id, name, type, config, position_x, position_y, created_at
		FROM nodes WHERE workflow_id = $1 ORDER BY created_at ASC
	`, workflowID)
	if err != nil {
		return nil, serverError(c, "fetching nodes", err)
	}
	defer rows.Close()

	nodes := make([]domain.Node, 0)
	for rows.Next() {
		var n domain.Node
		var configJSON []byte
		if err := rows.Scan(&n.ID, &n.WorkflowID, &n.Name, &n.Type, &configJSON,
			&n.PositionX, &n.PositionY, &n.CreatedAt); err != nil {
			return nil, serverError(c, "scanning node row", err)
		}
		n.Config = map[string]any{}
		if len(configJSON) > 0 {
			_ = json.Unmarshal(configJSON, &n.Config)
		}
		nodes = append(nodes, n)
	}
	if err := rows.Err(); err != nil {
		return nil, serverError(c, "reading node rows", err)
	}
	return nodes, nil
}

func CreateNode(c *fiber.Ctx) error {
	workflowID, _, guardErr := guardWorkflow(c)
	if guardErr != nil {
		return guardErr
	}

	var in createNodeInput
	if err := c.BodyParser(&in); err != nil {
		return badRequest(c, "Could not read the request body as JSON")
	}

	nodeType := strings.ToUpper(strings.TrimSpace(in.Type))
	if !domain.IsValidNodeType(nodeType) {
		return badRequest(c, "Unknown node type: "+in.Type)
	}

	name := strings.TrimSpace(in.Name)
	if name == "" {
		name = domain.DefaultName(nodeType)
	}
	if len(name) > 255 {
		return badRequest(c, "Node name must be 255 characters or fewer")
	}

	// Start from the type's defaults so a node is runnable-ish the moment it lands
	// on the canvas, then let anything the client sent override them.
	config := domain.DefaultConfig(nodeType)
	for k, v := range in.Config {
		config[k] = v
	}
	configJSON, err := json.Marshal(config)
	if err != nil {
		return badRequest(c, "Node config could not be encoded as JSON")
	}

	var node domain.Node
	err = database.DB.QueryRow(c.Context(), `
		INSERT INTO nodes (workflow_id, name, type, config, position_x, position_y)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, workflow_id, name, type, position_x, position_y, created_at
	`, workflowID, name, nodeType, configJSON, in.PositionX, in.PositionY).Scan(
		&node.ID, &node.WorkflowID, &node.Name, &node.Type,
		&node.PositionX, &node.PositionY, &node.CreatedAt,
	)
	if err != nil {
		return serverError(c, "creating node", err)
	}
	node.Config = config

	touchWorkflow(c, workflowID)
	return c.Status(fiber.StatusCreated).JSON(node)
}

// UpdateNode handles both inspector edits and canvas drags. Every field is optional
// so a drag can persist a position without resending the whole config.
func UpdateNode(c *fiber.Ctx) error {
	workflowID, _, guardErr := guardWorkflow(c)
	if guardErr != nil {
		return guardErr
	}

	nodeID := c.Params("nodeId")
	if !isUUID(nodeID) {
		return badRequest(c, "Invalid node id")
	}

	var in updateNodeInput
	if err := c.BodyParser(&in); err != nil {
		return badRequest(c, "Could not read the request body as JSON")
	}

	var name *string
	if in.Name != nil {
		trimmed := strings.TrimSpace(*in.Name)
		if trimmed == "" {
			return badRequest(c, "Node name cannot be empty")
		}
		if len(trimmed) > 255 {
			return badRequest(c, "Node name must be 255 characters or fewer")
		}
		name = &trimmed
	}

	var configJSON []byte
	if in.Config != nil {
		encoded, err := json.Marshal(in.Config)
		if err != nil {
			return badRequest(c, "Node config could not be encoded as JSON")
		}
		configJSON = encoded
	}

	var node domain.Node
	var storedConfig []byte
	err := database.DB.QueryRow(c.Context(), `
		UPDATE nodes SET
			name       = COALESCE($1, name),
			config     = COALESCE($2::jsonb, config),
			position_x = COALESCE($3, position_x),
			position_y = COALESCE($4, position_y),
			updated_at = now()
		WHERE id = $5 AND workflow_id = $6
		RETURNING id, workflow_id, name, type, config, position_x, position_y, created_at
	`, name, configJSON, in.PositionX, in.PositionY, nodeID, workflowID).Scan(
		&node.ID, &node.WorkflowID, &node.Name, &node.Type, &storedConfig,
		&node.PositionX, &node.PositionY, &node.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return notFound(c, "Node not found in this workflow")
	}
	if err != nil {
		return serverError(c, "updating node", err)
	}

	node.Config = map[string]any{}
	if len(storedConfig) > 0 {
		_ = json.Unmarshal(storedConfig, &node.Config)
	}

	touchWorkflow(c, workflowID)
	return c.JSON(node)
}

func DeleteNode(c *fiber.Ctx) error {
	workflowID, _, guardErr := guardWorkflow(c)
	if guardErr != nil {
		return guardErr
	}

	nodeID := c.Params("nodeId")
	if !isUUID(nodeID) {
		return badRequest(c, "Invalid node id")
	}

	// Edges referencing this node are removed by ON DELETE CASCADE, so unlike v1
	// there is no hand-rolled relinking step that can leave the graph inconsistent.
	tag, err := database.DB.Exec(c.Context(),
		`DELETE FROM nodes WHERE id = $1 AND workflow_id = $2`, nodeID, workflowID)
	if err != nil {
		return serverError(c, "deleting node", err)
	}
	if tag.RowsAffected() == 0 {
		return notFound(c, "Node not found in this workflow")
	}

	touchWorkflow(c, workflowID)
	return c.JSON(fiber.Map{"message": "Node deleted", "id": nodeID})
}

// touchWorkflow keeps updated_at meaningful so the dashboard can sort by recent
// activity. A failure here is not worth failing the request over.
func touchWorkflow(c *fiber.Ctx, workflowID string) {
	_, _ = database.DB.Exec(c.Context(), `UPDATE workflows SET updated_at = now() WHERE id = $1`, workflowID)
}

// GetNodeTypes serves the catalog the frontend builds its node library and
// inspector forms from, so a new node type ships without a frontend change.
func GetNodeTypes(c *fiber.Ctx) error {
	return c.JSON(domain.NodeTypeCatalog)
}
