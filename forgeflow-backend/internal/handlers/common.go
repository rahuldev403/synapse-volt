package handlers

import (
	"context"
	"errors"
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
	"github.com/rahuldev403/forgeflow/internal/database"
)

// userID reads the id the auth middleware stashed on the request. It returns "" if
// the route was not actually protected, which callers must treat as unauthorised
// rather than assuming a value is present.
func userID(c *fiber.Ctx) string {
	id, _ := c.Locals("user_id").(string)
	return id
}

func badRequest(c *fiber.Ctx, message string) error {
	return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": message})
}

func notFound(c *fiber.Ctx, message string) error {
	return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": message})
}

func unauthorized(c *fiber.Ctx) error {
	return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Not signed in"})
}

// serverError logs the real cause and returns a generic message, so internal
// details (table names, driver errors) never reach the client.
func serverError(c *fiber.Ctx, context string, err error) error {
	log.Printf("%s: %v", context, err)
	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Something went wrong on our side"})
}

var errNotOwner = errors.New("workflow not found for this user")

// ownsWorkflow is the single authorisation check for every workflow-scoped route.
//
// In v1 the node, edge and execution handlers took a workflowId straight from the
// URL and never checked who it belonged to, so any signed-in user could read or
// delete another user's graph. Every such handler now starts here.
func ownsWorkflow(ctx context.Context, workflowID, uid string) error {
	if workflowID == "" || uid == "" {
		return errNotOwner
	}

	var found string
	err := database.DB.QueryRow(ctx,
		`SELECT id FROM workflows WHERE id = $1 AND user_id = $2`,
		workflowID, uid,
	).Scan(&found)

	if errors.Is(err, pgx.ErrNoRows) {
		return errNotOwner
	}
	return err
}

// guardWorkflow resolves the workflow id from the URL and verifies ownership,
// writing the response itself when access is denied. A nil error means proceed.
func guardWorkflow(c *fiber.Ctx) (string, string, error) {
	uid := userID(c)
	if uid == "" {
		return "", "", unauthorized(c)
	}

	workflowID := c.Params("workflowId")
	if !isUUID(workflowID) {
		return "", "", badRequest(c, "Invalid workflow id")
	}

	switch err := ownsWorkflow(c.Context(), workflowID, uid); {
	case errors.Is(err, errNotOwner):
		// Deliberately a 404, not a 403: a 403 would confirm that this workflow
		// exists and belongs to somebody else.
		return "", "", notFound(c, "Workflow not found")
	case err != nil:
		return "", "", serverError(c, "checking workflow ownership", err)
	}

	return workflowID, uid, nil
}

// isUUID is a cheap shape check so a malformed path segment becomes a 400 instead
// of a Postgres type error surfacing as a 500.
func isUUID(s string) bool {
	if len(s) != 36 {
		return false
	}
	for i, r := range s {
		if i == 8 || i == 13 || i == 18 || i == 23 {
			if r != '-' {
				return false
			}
			continue
		}
		isHex := (r >= '0' && r <= '9') || (r >= 'a' && r <= 'f') || (r >= 'A' && r <= 'F')
		if !isHex {
			return false
		}
	}
	return true
}
