package config

import (
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

func LoadConfig() {
	if err := godotenv.Load(); err != nil {
		log.Println("no .env file found, falling back to system environment variables")
	}
}

func GetEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok && strings.TrimSpace(value) != "" {
		return value
	}
	return fallback
}

// GetEnvInt reads an integer setting, warning rather than failing silently when the
// value is unparseable -- a typo in ENGINE_WORKERS should be visible, not just
// quietly reverted to the default.
func GetEnvInt(key string, fallback int) int {
	raw, ok := os.LookupEnv(key)
	if !ok || strings.TrimSpace(raw) == "" {
		return fallback
	}

	value, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || value <= 0 {
		log.Printf("%s=%q is not a positive integer, using %d", key, raw, fallback)
		return fallback
	}
	return value
}
