package ai

import "log"

var AvailableTools = map[string]interface{}{
	"function_declarations": []map[string]interface{}{
		{
			"name":        "refund_customer",
			"description": "Issues a financial refund to a customer based on their support ticket email and amount.",
			"parameters": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"email": map[string]interface{}{
						"type":        "string",
						"description": "The customer's email address.",
					},
					"amount": map[string]interface{}{
						"type":        "number",
						"description": "The dollar amount to refund.",
					},
					"reason": map[string]interface{}{
						"type":        "string",
						"description": "The reason for the refund.",
					},
				},
				"required": []string{"email", "amount"},
			},
		},
	},
}

func ExecuteLocalTool(toolName string, args map[string]interface{}) string {
	switch toolName {
	case "refund_customer":
		email := args["email"]
		amount := args["amount"]
		reason := args["reason"]

		log.Printf("[AGENT ACTION] 💸 Successfully processed refund of $%v for %v. Reason: %v", amount, email, reason)

		return "SUCCESS: Refund transaction processed."
	default:
		return "ERROR: Unknown tool requested."
	}
}
