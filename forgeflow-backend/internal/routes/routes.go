package routes

import (
	"github.com/gofiber/fiber/v2"
	"github.com/rahuldev403/forgeflow/internal/handlers"
	"github.com/rahuldev403/forgeflow/internal/middleware"
)

func SetupRoutes(app *fiber.App) {
	api := app.Group("/api/v1")

	// --- public -------------------------------------------------------------
	api.Get("/health", handlers.HealthCheck)
	api.Get("/node-types", handlers.GetNodeTypes)

	// Ingress is public by design: the workflow id in the path is the credential.
	api.Post("/webhooks/:workflowId", handlers.TriggerWebhook)

	// --- authenticated ------------------------------------------------------
	// Everything below requires a Clerk session. In v1 the node listing sat outside
	// this group, which let anyone read any user's graph.
	protected := api.Group("", middleware.ClerkAuth())

	protected.Post("/workflows", handlers.CreateWorkflow)
	protected.Get("/workflows", handlers.GetWorkflows)
	protected.Get("/workflows/:workflowId", handlers.GetWorkflow)
	protected.Patch("/workflows/:workflowId", handlers.UpdateWorkflow)
	protected.Delete("/workflows/:workflowId", handlers.DeleteWorkflow)

	protected.Get("/workflows/:workflowId/graph", handlers.GetGraph)
	protected.Get("/workflows/:workflowId/validate", handlers.ValidateWorkflow)

	protected.Post("/workflows/:workflowId/nodes", handlers.CreateNode)
	protected.Patch("/workflows/:workflowId/nodes/:nodeId", handlers.UpdateNode)
	protected.Delete("/workflows/:workflowId/nodes/:nodeId", handlers.DeleteNode)

	protected.Post("/workflows/:workflowId/edges", handlers.CreateEdge)
	protected.Delete("/workflows/:workflowId/edges/:edgeId", handlers.DeleteEdge)

	protected.Post("/workflows/:workflowId/run", handlers.RunWorkflow)
	protected.Get("/workflows/:workflowId/executions", handlers.GetExecutions)
	protected.Get("/workflows/:workflowId/executions/:executionId", handlers.GetExecution)
}
