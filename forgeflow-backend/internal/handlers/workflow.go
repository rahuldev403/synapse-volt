package handlers

import (
	"errors"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
	"github.com/rahuldev403/forgeflow/internal/database"
	"github.com/rahuldev403/forgeflow/internal/domain"
)

type workflowInput struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	IsActive    *bool  `json:"is_active"`
}

func (in workflowInput) validate() (string, string, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return "", "", errors.New("Name is required")
	}
	if len(name) > 255 {
		return "", "", errors.New("Name must be 255 characters or fewer")
	}

	description := strings.TrimSpace(in.Description)
	if len(description) > 2000 {
		return "", "", errors.New("Description must be 2000 characters or fewer")
	}
	return name, description, nil
}

func CreateWorkflow(c *fiber.Ctx) error {
	uid := userID(c)
	if uid == "" {
		return unauthorized(c)
	}

	var in workflowInput
	if err := c.BodyParser(&in); err != nil {
		return badRequest(c, "Could not read the request body as JSON")
	}

	name, description, err := in.validate()
	if err != nil {
		return badRequest(c, err.Error())
	}

	var wf domain.Workflow
	err = database.DB.QueryRow(c.Context(), `
		INSERT INTO workflows (user_id, name, description, is_active)
		VALUES ($1, $2, $3, true)
		RETURNING id, name, description, is_active, created_at, updated_at
	`, uid, name, description).Scan(
		&wf.ID, &wf.Name, &wf.Description, &wf.IsActive, &wf.CreatedAt, &wf.UpdatedAt,
	)
	if err != nil {
		return serverError(c, "creating workflow", err)
	}

	return c.Status(fiber.StatusCreated).JSON(wf)
}

// GetWorkflows returns the dashboard list. Node counts and last-run status are
// computed in a single query with lateral joins -- fetching them per workflow from
// the client would be the classic N+1 that makes a dashboard crawl.
func GetWorkflows(c *fiber.Ctx) error {
	uid := userID(c)
	if uid == "" {
		return unauthorized(c)
	}

	rows, err := database.DB.Query(c.Context(), `
		SELECT
			w.id, w.name, w.description, w.is_active, w.created_at, w.updated_at,
			COALESCE(n.node_count, 0),
			e.status,
			e.started_at
		FROM workflows w
		LEFT JOIN LATERAL (
			SELECT count(*) AS node_count FROM nodes WHERE workflow_id = w.id
		) n ON true
		LEFT JOIN LATERAL (
			SELECT status, started_at FROM executions
			WHERE workflow_id = w.id
			ORDER BY started_at DESC
			LIMIT 1
		) e ON true
		WHERE w.user_id = $1
		ORDER BY w.updated_at DESC
	`, uid)
	if err != nil {
		return serverError(c, "listing workflows", err)
	}
	defer rows.Close()

	workflows := make([]domain.Workflow, 0)
	for rows.Next() {
		var wf domain.Workflow
		if err := rows.Scan(
			&wf.ID, &wf.Name, &wf.Description, &wf.IsActive, &wf.CreatedAt, &wf.UpdatedAt,
			&wf.NodeCount, &wf.LastRunStatus, &wf.LastRunAt,
		); err != nil {
			return serverError(c, "scanning workflow row", err)
		}
		workflows = append(workflows, wf)
	}
	if err := rows.Err(); err != nil {
		return serverError(c, "reading workflow rows", err)
	}

	return c.JSON(workflows)
}

func GetWorkflow(c *fiber.Ctx) error {
	workflowID, _, guardErr := guardWorkflow(c)
	if guardErr != nil {
		return guardErr
	}

	var wf domain.Workflow
	err := database.DB.QueryRow(c.Context(), `
		SELECT w.id, w.name, w.description, w.is_active, w.created_at, w.updated_at,
		       (SELECT count(*) FROM nodes WHERE workflow_id = w.id)
		FROM workflows w WHERE w.id = $1
	`, workflowID).Scan(
		&wf.ID, &wf.Name, &wf.Description, &wf.IsActive, &wf.CreatedAt, &wf.UpdatedAt, &wf.NodeCount,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return notFound(c, "Workflow not found")
	}
	if err != nil {
		return serverError(c, "fetching workflow", err)
	}

	return c.JSON(wf)
}

func UpdateWorkflow(c *fiber.Ctx) error {
	workflowID, _, guardErr := guardWorkflow(c)
	if guardErr != nil {
		return guardErr
	}

	var in workflowInput
	if err := c.BodyParser(&in); err != nil {
		return badRequest(c, "Could not read the request body as JSON")
	}

	name, description, err := in.validate()
	if err != nil {
		return badRequest(c, err.Error())
	}

	var wf domain.Workflow
	err = database.DB.QueryRow(c.Context(), `
		UPDATE workflows
		SET name = $1, description = $2, is_active = COALESCE($3, is_active), updated_at = now()
		WHERE id = $4
		RETURNING id, name, description, is_active, created_at, updated_at
	`, name, description, in.IsActive, workflowID).Scan(
		&wf.ID, &wf.Name, &wf.Description, &wf.IsActive, &wf.CreatedAt, &wf.UpdatedAt,
	)
	if err != nil {
		return serverError(c, "updating workflow", err)
	}

	return c.JSON(wf)
}

func DeleteWorkflow(c *fiber.Ctx) error {
	workflowID, _, guardErr := guardWorkflow(c)
	if guardErr != nil {
		return guardErr
	}

	// Nodes, edges, executions and steps all cascade from this one delete.
	if _, err := database.DB.Exec(c.Context(), `DELETE FROM workflows WHERE id = $1`, workflowID); err != nil {
		return serverError(c, "deleting workflow", err)
	}

	return c.JSON(fiber.Map{"message": "Workflow deleted", "id": workflowID})
}
