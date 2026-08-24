package main

import (
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/rahuldev403/forgeflow/internal/config"
	"github.com/rahuldev403/forgeflow/internal/database"
	"github.com/rahuldev403/forgeflow/internal/handlers/engine"
	"github.com/rahuldev403/forgeflow/internal/routes"
)

func main() {
	config.LoadConfig()

	database.Connect()
	defer database.Close()

	engine.StartWorkerPool(3)

	app := fiber.New(fiber.Config{
		AppName: "ForgeFlow Backend v1",
	})

	app.Use(cors.New(cors.Config{
		AllowOrigins: config.GetEnv("CLIENT_URL", "http://localhost:3000"),
		AllowHeaders: "Origin,Content-type,Accept,Authorization",
	}))

	app.Use(logger.New())
	app.Use(recover.New())

	routes.SetupRoutes(app)

	port := config.GetEnv("PORT", "3000")
	log.Printf("Starting server on port %s", port)

	err := app.Listen(":" + port)
	if err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
