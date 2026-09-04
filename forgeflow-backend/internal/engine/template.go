package engine

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// templatePattern matches {{ trigger.email }} / {{steps.<id>.body.total}}.
var templatePattern = regexp.MustCompile(`\{\{\s*([a-zA-Z0-9_.\-\[\]]+)\s*\}\}`)

// RunContext is the data every node can read from. It is built up as the run
// progresses: the trigger payload is there from the start, and each node's output
// is added under steps.<nodeID> once it succeeds.
type RunContext struct {
	Trigger map[string]any            `json:"trigger"`
	Steps   map[string]map[string]any `json:"steps"`
	// Named is an alias of Steps keyed by node name, so users can write the readable
	// {{steps.Fetch Ticket.body}} instead of pasting a UUID.
	Named map[string]map[string]any `json:"-"`
}

func NewRunContext(trigger map[string]any) *RunContext {
	if trigger == nil {
		trigger = map[string]any{}
	}
	return &RunContext{
		Trigger: trigger,
		Steps:   map[string]map[string]any{},
		Named:   map[string]map[string]any{},
	}
}

func (rc *RunContext) Record(nodeID, nodeName string, output map[string]any) {
	if output == nil {
		output = map[string]any{}
	}
	rc.Steps[nodeID] = output
	rc.Named[nodeName] = output
}

// lookup walks a dotted path through the context and returns the raw value.
func (rc *RunContext) lookup(path string) (any, bool) {
	parts := strings.Split(path, ".")
	if len(parts) == 0 {
		return nil, false
	}

	var current any
	switch parts[0] {
	case "trigger":
		current = rc.Trigger
		parts = parts[1:]
	case "steps":
		if len(parts) < 2 {
			return nil, false
		}
		key := parts[1]
		if v, ok := rc.Steps[key]; ok {
			current = v
		} else if v, ok := rc.Named[key]; ok {
			current = v
		} else {
			return nil, false
		}
		parts = parts[2:]
	default:
		// Bare paths fall back to the trigger payload: {{email}} == {{trigger.email}}.
		current = rc.Trigger
	}

	for _, part := range parts {
		m, ok := current.(map[string]any)
		if !ok {
			return nil, false
		}
		current, ok = m[part]
		if !ok {
			return nil, false
		}
	}
	return current, true
}

// Resolve replaces every {{path}} in s with its value from the context.
// A whole-string template ({{trigger.amount}} on its own) keeps the underlying
// type when converted via ResolveValue; here everything becomes a string.
func (rc *RunContext) Resolve(s string) string {
	return templatePattern.ReplaceAllStringFunc(s, func(match string) string {
		path := strings.TrimSpace(templatePattern.FindStringSubmatch(match)[1])
		value, ok := rc.lookup(path)
		if !ok {
			return "" // unresolved templates become empty rather than leaking {{...}}
		}
		return stringify(value)
	})
}

// ResolveValue is Resolve for a single field, but preserves the original type when
// the string is exactly one template — so {{trigger.amount}} stays a number.
func (rc *RunContext) ResolveValue(s string) any {
	trimmed := strings.TrimSpace(s)
	if m := templatePattern.FindStringSubmatch(trimmed); m != nil && m[0] == trimmed {
		if value, ok := rc.lookup(strings.TrimSpace(m[1])); ok {
			return value
		}
		return nil
	}
	return rc.Resolve(s)
}

func stringify(v any) string {
	switch t := v.(type) {
	case nil:
		return ""
	case string:
		return t
	case bool:
		return strconv.FormatBool(t)
	case float64:
		return strconv.FormatFloat(t, 'f', -1, 64)
	case int:
		return strconv.Itoa(t)
	case json.Number:
		return t.String()
	default:
		b, err := json.Marshal(v)
		if err != nil {
			return fmt.Sprintf("%v", v)
		}
		return string(b)
	}
}
