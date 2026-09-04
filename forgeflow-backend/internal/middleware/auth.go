package middleware

import (
	"log"
	"strings"
	"sync"

	"github.com/clerk/clerk-sdk-go/v2"
	"github.com/clerk/clerk-sdk-go/v2/jwt"
	"github.com/gofiber/fiber/v2"
	"github.com/rahuldev403/forgeflow/internal/config"
)

var configureClerk sync.Once

// ClerkAuth verifies the session token and puts the user id on the request.
//
// Every workflow-scoped handler then re-checks that this user owns the row it is
// about to touch: authentication here, authorisation there. Proving who you are is
// not the same as being allowed to touch a particular graph.
func ClerkAuth() fiber.Handler {
	return func(c *fiber.Ctx) error {
		token, ok := bearerToken(c.Get("Authorization"))
		if !ok {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Missing or malformed Authorization header",
			})
		}

		secretKey := config.GetEnv("CLERK_SECRET_KEY", "")
		if secretKey == "" {
			log.Println("CLERK_SECRET_KEY is not set — every authenticated request will fail")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Authentication is not configured on the server",
			})
		}

		// v1 called SetKey on every single request. It is process-global state, so
		// once is both correct and one less data race under concurrent load.
		configureClerk.Do(func() { clerk.SetKey(secretKey) })

		claims, err := jwt.Verify(c.Context(), &jwt.VerifyParams{Token: token})
		if err != nil {
			// The underlying reason is logged but not returned: telling a caller
			// exactly why a token failed helps them forge a better one.
			log.Printf("clerk token verification failed: %v", err)
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Your session is invalid or has expired. Please sign in again.",
			})
		}

		c.Locals("user_id", claims.Subject)
		return c.Next()
	}
}

func bearerToken(header string) (string, bool) {
	if header == "" {
		return "", false
	}
	parts := strings.Fields(header)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") || parts[1] == "" {
		return "", false
	}
	return parts[1], true
}
