package handlers

import (
	"errors"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/rahuldev403/forgeflow/internal/database"
	"github.com/rahuldev403/forgeflow/internal/domain"
	"github.com/rahuldev403/forgeflow/internal/engine"
)

type createEdgeInput struct {
	SourceNodeID string `json:"source_node_id"`
	TargetNodeID string `json:"target_node_id"`
}

func fetchEdges(c *fiber.Ctx, workflowID string) ([]domain.Edge, error) {
	rows, err := database.DB.Query(c.Context(), `
		SELECT id, workflow_id, source_node_id, target_node_id
		FROM edges WHERE workflow_id = $1 ORDER BY created_at ASC
	`, workflowID)
	if err != nil {
		return nil, serverError(c, "fetching edges", err)
	}
	defer rows.Close()

	edges := make([]domain.Edge, 0)
	for rows.Next() {
		var e domain.Edge
		if err := rows.Scan(&e.ID, &e.WorkflowID, &e.SourceNodeID, &e.TargetNodeID); err != nil {
			return nil, serverError(c, "scanning edge row", err)
		}
		edges = append(edges, e)
	}
	if err := rows.Err(); err != nil {
		return nil, serverError(c, "reading edge rows", err)
	}
	return edges, nil
}

// CreateEdge connects two nodes, rejecting anything that would stop the graph from
// being a DAG. Validating here rather than at run time means the user finds out
// while they are drawing the connection, not when a run fails an hour later.
func CreateEdge(c *fiber.Ctx) error {
	workflowID, _, guardErr := guardWorkflow(c)
	if guardErr != nil {
		return guardErr
	}

	var in createEdgeInput
	if err := c.BodyParser(&in); err != nil {
		return badRequest(c, "Could not read the request body as JSON")
	}

	source := strings.TrimSpace(in.SourceNodeID)
	target := strings.TrimSpace(in.TargetNodeID)
	if !isUUID(source) || !isUUID(target) {
		return badRequest(c, "source_node_id and target_node_id must both be node ids")
	}
	if source == target {
		return badRequest(c, "A node cannot connect to itself")
	}

	// Both endpoints must live in this workflow -- otherwise a caller could stitch
	// their graph onto somebody else's node.
	var count int
	if err := database.DB.QueryRow(c.Context(),
		`SELECT count(*) FROM nodes WHERE workflow_id = $1 AND id = ANY($2::uuid[])`,
		workflowID, []string{source, target},
	).Scan(&count); err != nil {
		return serverError(c, "validating edge endpoints", err)
	}
	if count != 2 {
		return badRequest(c, "Both nodes must belong to this workflow")
	}

	nodes, err := fetchNodes(c, workflowID)
	if err != nil {
		return err
	}
	existing, err := fetchEdges(c, workflowID)
	if err != nil {
		return err
	}

	// Dry-run the topological sort with the new edge in place; if it no longer
	// sorts, this edge is the one that closed a cycle.
	candidate := append(existing, domain.Edge{SourceNodeID: source, TargetNodeID: target})
	if _, err := engine.BuildGraph(nodes, candidate).TopoSort(); err != nil {
		return badRequest(c, "That connection would create a loop, so the workflow could never finish")
	}

	var edge domain.Edge
	err = database.DB.QueryRow(c.Context(), `
		INSERT INTO edges (workflow_id, source_node_id, target_node_id)
		VALUES ($1, $2, $3)
		RETURNING id, workflow_id, source_node_id, target_node_id
	`, workflowID, source, target).Scan(&edge.ID, &edge.WorkflowID, &edge.SourceNodeID, &edge.TargetNodeID)

	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Those nodes are already connected"})
	}
	if err != nil {
		return serverError(c, "creating edge", err)
	}

	touchWorkflow(c, workflowID)
	return c.Status(fiber.StatusCreated).JSON(edge)
}

func DeleteEdge(c *fiber.Ctx) error {
	workflowID, _, guardErr := guardWorkflow(c)
	if guardErr != nil {
		return guardErr
	}

	edgeID := c.Params("edgeId")
	if !isUUID(edgeID) {
		return badRequest(c, "Invalid edge id")
	}

	tag, err := database.DB.Exec(c.Context(),
		`DELETE FROM edges WHERE id = $1 AND workflow_id = $2`, edgeID, workflowID)
	if err != nil {
		return serverError(c, "deleting edge", err)
	}
	if tag.RowsAffected() == 0 {
		return notFound(c, "Connection not found in this workflow")
	}

	touchWorkflow(c, workflowID)
	return c.JSON(fiber.Map{"message": "Connection removed", "id": edgeID})
}

// ValidateWorkflow reports whether the graph can run, and why not if it cannot.
// The builder calls this so the Run button can explain itself before firing.
func ValidateWorkflow(c *fiber.Ctx) error {
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

	problems := make([]string, 0)

	if len(nodes) == 0 {
		problems = append(problems, "This workflow has no nodes yet.")
	}

	graph := engine.BuildGraph(nodes, edges)
	order, sortErr := graph.TopoSort()
	if sortErr != nil {
		problems = append(problems, sortErr.Error())
	}

	// Config problems the user can fix now, rather than discovering mid-run.
	for _, n := range nodes {
		for _, problem := range validateNodeConfig(n) {
			problems = append(problems, n.Name+": "+problem)
		}
	}

	// An orphan cannot receive data from anything, which is nearly always a mistake.
	if len(nodes) > 1 {
		for _, n := range nodes {
			if len(graph.Parents[n.ID]) == 0 && len(graph.Children[n.ID]) == 0 {
				problems = append(problems, n.Name+" is not connected to anything.")
			}
		}
	}

	return c.JSON(fiber.Map{
		"valid":    len(problems) == 0,
		"problems": problems,
		"order":    order,
	})
}

// validateNodeConfig checks the required fields declared in the node type catalog.
func validateNodeConfig(n domain.Node) []string {
	problems := make([]string, 0)

	for _, spec := range domain.NodeTypeCatalog {
		if spec.Type != n.Type {
			continue
		}
		for _, field := range spec.Fields {
			if !field.Required {
				continue
			}
			value, present := n.Config[field.Key]
			if !present {
				problems = append(problems, field.Label+" is required")
				continue
			}
			if s, ok := value.(string); ok && strings.TrimSpace(s) == "" {
				problems = append(problems, field.Label+" is required")
			}
		}
	}
	return problems
}
