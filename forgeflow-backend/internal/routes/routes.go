package routes

import (
	"github.com/gofiber/fiber/v2"
	"github.com/rahuldev403/forgeflow/internal/handlers"
	"github.com/rahuldev403/forgeflow/internal/middleware"
)

func SetupRoutes(app *fiber.App) {
	api := app.Group("/api/v1")

	api.Get("/health", handlers.HealthCheck)
	api.Post("/webhooks/:workflowId", handlers.TriggerWebhook)
	protected := api.Group("/", middleware.ClerkAuth())

	protected.Post("/workflows", handlers.CreateWorkflow)
	protected.Get("/workflows", handlers.GetWorkflows)
	protected.Post("/workflows/:workflowId/nodes", handlers.CreateWorkflowNode)
	protected.Delete("/workflows/:workflowId/nodes/:nodeId", handlers.DeleteWorkflowNode)
	protected.Get("/workflows/:workflowId/executions", handlers.GetWorkflowExecutions)
	api.Get("/workflows/:workflowId/nodes", handlers.GetWorkflowNodes)
}
