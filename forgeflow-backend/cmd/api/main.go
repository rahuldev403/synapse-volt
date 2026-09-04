package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/rahuldev403/forgeflow/internal/config"
	"github.com/rahuldev403/forgeflow/internal/database"
	"github.com/rahuldev403/forgeflow/internal/engine"
	"github.com/rahuldev403/forgeflow/internal/routes"
)

func main() {
	config.LoadConfig()

	database.Connect()
	defer database.Close()

	pool := engine.Start(
		config.GetEnvInt("ENGINE_WORKERS", 3),
		config.GetEnvInt("ENGINE_QUEUE_SIZE", 100),
	)

	app := fiber.New(fiber.Config{
		AppName:               "ForgeFlow API",
		DisableStartupMessage: true,
		BodyLimit:             1 << 20, // 1MB is plenty for a webhook payload
		ReadTimeout:           15 * time.Second,
		WriteTimeout:          30 * time.Second,
	})

	app.Use(recover.New())
	app.Use(logger.New(logger.Config{
		Format: "${time} ${status} ${method} ${path} ${latency}\n",
	}))
	app.Use(cors.New(cors.Config{
		AllowOrigins: allowedOrigins(),
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
		AllowMethods: "GET, POST, PATCH, PUT, DELETE, OPTIONS",
	}))

	routes.SetupRoutes(app)

	port := config.GetEnv("PORT", "8080")

	go func() {
		log.Printf("ForgeFlow API listening on :%s", port)
		if err := app.Listen(":" + port); err != nil {
			log.Fatalf("server failed to start: %v", err)
		}
	}()

	// Wait for Ctrl+C or a container stop signal, then unwind in the right order:
	// stop accepting requests, let in-flight runs finish, then close the pool.
	// v1 had no shutdown path at all, so a restart could abandon a run mid-refund.
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	log.Println("shutting down")

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	if err := app.ShutdownWithContext(ctx); err != nil {
		log.Printf("http shutdown: %v", err)
	}

	pool.Shutdown()
	log.Println("goodbye")
}

// allowedOrigins builds the CORS allowlist from CLIENT_URL plus the usual local
// dev hosts, de-duplicated and trimmed.
func allowedOrigins() string {
	origins := []string{"http://localhost:3000", "http://127.0.0.1:3000"}

	for _, extra := range strings.Split(config.GetEnv("CLIENT_URL", ""), ",") {
		extra = strings.TrimSpace(strings.TrimSuffix(strings.TrimSpace(extra), "/"))
		if extra == "" {
			continue
		}
		if !contains(origins, extra) {
			origins = append(origins, extra)
		}
	}

	return strings.Join(origins, ",")
}

func contains(list []string, want string) bool {
	for _, v := range list {
		if v == want {
			return true
		}
	}
	return false
}
