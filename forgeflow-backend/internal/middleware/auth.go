package middleware

import (
	"log"
	"strings"

	"github.com/clerk/clerk-sdk-go/v2"
	"github.com/clerk/clerk-sdk-go/v2/jwt"
	"github.com/gofiber/fiber/v2"
	"github.com/rahuldev403/forgeflow/internal/config"
)

// ClerkAuth validates the JWT from the Authorization header using Clerk
func ClerkAuth() fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Missing Authorization header",
			})
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Invalid Authorization header format",
			})
		}

		token := parts[1]

		// Ensure we load the secret key from the env
		secretKey := config.GetEnv("CLERK_SECRET_KEY", "")
		if secretKey == "" {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Clerk secret key is not configured",
			})
		}
		
		clerk.SetKey(secretKey)

		// Verify the session token
		claims, err := jwt.Verify(c.Context(), &jwt.VerifyParams{
			Token: token,
		})
		
		if err != nil {
			log.Printf("Clerk JWT Verify Error: %v\n", err)
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Invalid token",
				"details": err.Error(),
			})
		}

		// Store user_id in locals
		c.Locals("user_id", claims.Subject)

		return c.Next()
	}
}
