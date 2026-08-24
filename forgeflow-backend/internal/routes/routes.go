package routes

import (
	"github.com/gofiber/fiber/v2"
	"github.com/rahuldev403/forgeflow/internal/handlers"
)

func SetupRoutes(app *fiber.App) {
	api := app.Group("api/v1")

	api.Get("/helath", handlers.HealthCheck)

	api.Post("/workflows", handlers.CreateWorkflow)

	api.Get("/workflows", handlers.GetWorkflows)

	api.Post("/workflows/:workflowId/nodes", handlers.CreateWorkflowNode)

	api.Post("/webhooks/:workflowId", handlers.TriggerWebhook)

	api.Get("workflows/:workflowId/exections", handlers.GetWorkflowExecutions)
}
