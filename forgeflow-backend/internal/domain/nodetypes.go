package domain

// FieldSpec describes one configurable field on a node type. The frontend renders
// its inspector form straight from this, so adding a node type is a backend-only change.
type FieldSpec struct {
	Key         string   `json:"key"`
	Label       string   `json:"label"`
	Kind        string   `json:"kind"` // text | textarea | number | select | keyvalue | code
	Placeholder string   `json:"placeholder,omitempty"`
	Help        string   `json:"help,omitempty"`
	Options     []string `json:"options,omitempty"`
	Default     any      `json:"default,omitempty"`
	Required    bool     `json:"required,omitempty"`
}

type NodeTypeSpec struct {
	Type        string      `json:"type"`
	Label       string      `json:"label"`
	Category    string      `json:"category"` // trigger | action | logic
	Description string      `json:"description"`
	Icon        string      `json:"icon"`   // lucide-react icon name
	Accent      string      `json:"accent"` // design token key used by the canvas
	Fields      []FieldSpec `json:"fields"`
}

// NodeTypeCatalog is the single source of truth for what a node is and how it is
// configured. Served at GET /api/v1/node-types.
var NodeTypeCatalog = []NodeTypeSpec{
	{
		Type:        NodeTrigger,
		Label:       "Webhook Trigger",
		Category:    "trigger",
		Description: "Entry point. The inbound JSON body becomes {{trigger.*}} for every node downstream.",
		Icon:        "Webhook",
		Accent:      "amber",
		Fields:      []FieldSpec{},
	},
	{
		Type:        NodeHTTP,
		Label:       "HTTP Request",
		Category:    "action",
		Description: "Call an external API. Returns {status, body}.",
		Icon:        "Globe",
		Accent:      "sky",
		Fields: []FieldSpec{
			{Key: "method", Label: "Method", Kind: "select", Options: []string{"GET", "POST", "PUT", "PATCH", "DELETE"}, Default: "POST", Required: true},
			{Key: "url", Label: "URL", Kind: "text", Placeholder: "https://api.example.com/tickets", Required: true,
				Help: "Supports templates, e.g. https://api.example.com/users/{{trigger.id}}"},
			{Key: "headers", Label: "Headers", Kind: "keyvalue", Help: "Sent as-is. Values support templates."},
			{Key: "body", Label: "Body", Kind: "code", Placeholder: "{\n  \"email\": \"{{trigger.email}}\"\n}", Help: "JSON. Templates are resolved before sending."},
		},
	},
	{
		Type:        NodeAI,
		Label:       "AI Agent",
		Category:    "action",
		Description: "Ask Gemini to read the run context and optionally call one of your registered tools.",
		Icon:        "Bot",
		Accent:      "violet",
		Fields: []FieldSpec{
			{Key: "prompt", Label: "Prompt", Kind: "textarea", Required: true,
				Placeholder: "Read this support ticket. If the customer is asking for their money back, call refund_customer.",
				Help:        "Templates allowed. The full run context is appended as JSON."},
			{Key: "model", Label: "Model", Kind: "select", Options: []string{"gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.5-pro"}, Default: "gemini-2.0-flash"},
			{Key: "tools", Label: "Tools", Kind: "select", Options: []string{"none", "refund_customer", "escalate_ticket", "all"}, Default: "all",
				Help: "Which local tools the model is allowed to call."},
		},
	},
	{
		Type:        NodeCondition,
		Label:       "Condition",
		Category:    "logic",
		Description: "Branch the graph. When it evaluates false, everything reachable only through it is skipped.",
		Icon:        "GitBranch",
		Accent:      "emerald",
		Fields: []FieldSpec{
			{Key: "left", Label: "Left", Kind: "text", Placeholder: "{{trigger.amount}}", Required: true},
			{Key: "operator", Label: "Operator", Kind: "select", Required: true,
				Options: []string{"eq", "neq", "gt", "gte", "lt", "lte", "contains", "exists"}, Default: "gt"},
			{Key: "right", Label: "Right", Kind: "text", Placeholder: "100"},
		},
	},
	{
		Type:        NodeTransform,
		Label:       "Transform",
		Category:    "logic",
		Description: "Reshape data into a new object that downstream nodes can read.",
		Icon:        "Shuffle",
		Accent:      "cyan",
		Fields: []FieldSpec{
			{Key: "mapping", Label: "Field mapping", Kind: "keyvalue",
				Help: "Output key on the left, template on the right — e.g. customer -> {{trigger.email}}"},
		},
	},
	{
		Type:        NodeDelay,
		Label:       "Delay",
		Category:    "logic",
		Description: "Pause before continuing. Capped at 30s so a run cannot hold a worker forever.",
		Icon:        "Timer",
		Accent:      "slate",
		Fields: []FieldSpec{
			{Key: "ms", Label: "Milliseconds", Kind: "number", Default: 1000, Required: true},
		},
	},
	{
		Type:        NodeLog,
		Label:       "Log",
		Category:    "action",
		Description: "Write a resolved message into the run timeline. Useful for debugging templates.",
		Icon:        "ScrollText",
		Accent:      "slate",
		Fields: []FieldSpec{
			{Key: "message", Label: "Message", Kind: "textarea", Placeholder: "Refund requested by {{trigger.email}}", Required: true},
		},
	},
}

func IsValidNodeType(t string) bool {
	for _, spec := range NodeTypeCatalog {
		if spec.Type == t {
			return true
		}
	}
	return false
}

// DefaultConfig returns the starting config for a newly created node of this type.
func DefaultConfig(t string) map[string]any {
	cfg := map[string]any{}
	for _, spec := range NodeTypeCatalog {
		if spec.Type != t {
			continue
		}
		for _, f := range spec.Fields {
			if f.Default != nil {
				cfg[f.Key] = f.Default
			}
		}
	}
	return cfg
}

// DefaultName is the label shown when a node is dropped on the canvas.
func DefaultName(t string) string {
	for _, spec := range NodeTypeCatalog {
		if spec.Type == t {
			return spec.Label
		}
	}
	return t
}
