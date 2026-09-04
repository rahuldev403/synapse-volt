package ai

import (
	"fmt"
	"log"
	"sort"
	"strings"
)

// ToolDeclaration is the JSON-schema shape Gemini expects for a callable function.
type ToolDeclaration struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Parameters  map[string]any `json:"parameters"`
}

// LocalTool pairs the declaration the model sees with the Go function that runs
// when it decides to call it.
type LocalTool struct {
	Declaration ToolDeclaration
	Run         func(args map[string]any) string
}

// registry is the set of side effects an AI node is allowed to trigger. Keeping it
// an explicit allowlist is the whole safety story: the model chooses *which* tool
// and *with what arguments*, but it can never reach code that is not registered here.
var registry = map[string]LocalTool{
	"refund_customer": {
		Declaration: ToolDeclaration{
			Name:        "refund_customer",
			Description: "Issue a financial refund to a customer who has asked for their money back.",
			Parameters: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"email":  map[string]any{"type": "string", "description": "The customer's email address."},
					"amount": map[string]any{"type": "number", "description": "The amount to refund, in dollars."},
					"reason": map[string]any{"type": "string", "description": "Why the refund is being issued."},
				},
				"required": []string{"email", "amount"},
			},
		},
		Run: func(args map[string]any) string {
			email, ok := args["email"].(string)
			if !ok || strings.TrimSpace(email) == "" {
				return "ERROR: refund_customer requires an email address."
			}
			amount, ok := args["amount"].(float64)
			if !ok {
				return "ERROR: refund_customer requires a numeric amount."
			}
			if amount <= 0 {
				return "ERROR: refund amount must be greater than zero."
			}
			// A refund above this threshold is the kind of thing that should need a
			// human, so the tool refuses rather than trusting the model's judgement.
			if amount > 500 {
				return fmt.Sprintf("REJECTED: $%.2f exceeds the $500 auto-refund limit. Escalate to a human.", amount)
			}

			reason, _ := args["reason"].(string)
			log.Printf("[tool] refund_customer: $%.2f to %s (%s)", amount, email, reason)
			return fmt.Sprintf("SUCCESS: refunded $%.2f to %s.", amount, email)
		},
	},

	"escalate_ticket": {
		Declaration: ToolDeclaration{
			Name:        "escalate_ticket",
			Description: "Escalate a support ticket to a human agent when it is angry, ambiguous, or high value.",
			Parameters: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"email":    map[string]any{"type": "string", "description": "The customer's email address."},
					"priority": map[string]any{"type": "string", "enum": []string{"low", "normal", "high", "urgent"}},
					"summary":  map[string]any{"type": "string", "description": "One-line summary for the human agent."},
				},
				"required": []string{"email", "summary"},
			},
		},
		Run: func(args map[string]any) string {
			email, _ := args["email"].(string)
			summary, _ := args["summary"].(string)
			priority, _ := args["priority"].(string)
			if priority == "" {
				priority = "normal"
			}
			log.Printf("[tool] escalate_ticket: %s [%s] %s", email, priority, summary)
			return fmt.Sprintf("SUCCESS: escalated %s to a human agent at %s priority.", email, priority)
		},
	},
}

// SelectTools maps the node's `tools` config value to the declarations sent to the
// model. "none" (or an unknown name) sends nothing, so the model can only answer
// in text.
func SelectTools(selection string) []ToolDeclaration {
	selection = strings.ToLower(strings.TrimSpace(selection))

	switch selection {
	case "", "all":
		return allDeclarations()
	case "none":
		return nil
	default:
		if tool, ok := registry[selection]; ok {
			return []ToolDeclaration{tool.Declaration}
		}
		return nil
	}
}

func allDeclarations() []ToolDeclaration {
	names := make([]string, 0, len(registry))
	for name := range registry {
		names = append(names, name)
	}
	sort.Strings(names) // stable ordering keeps prompts cacheable and runs reproducible

	out := make([]ToolDeclaration, 0, len(names))
	for _, name := range names {
		out = append(out, registry[name].Declaration)
	}
	return out
}

// ExecuteLocalTool runs the tool the model asked for. An unknown name returns an
// error string rather than failing the run, so the timeline records the attempt.
func ExecuteLocalTool(name string, args map[string]any) string {
	tool, ok := registry[name]
	if !ok {
		log.Printf("[tool] model requested unregistered tool %q", name)
		return fmt.Sprintf("ERROR: %q is not a registered tool.", name)
	}
	if args == nil {
		args = map[string]any{}
	}
	return tool.Run(args)
}

// ToolNames lists the registered tools, for the node-type catalog.
func ToolNames() []string {
	names := make([]string, 0, len(registry))
	for name := range registry {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}
