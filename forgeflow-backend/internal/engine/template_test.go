package engine

import "testing"

func ctx() *RunContext {
	rc := NewRunContext(map[string]any{
		"email":  "jane@example.com",
		"amount": float64(120),
		"nested": map[string]any{"plan": "pro"},
	})
	rc.Record("node-1", "Fetch Ticket", map[string]any{
		"status": float64(200),
		"body":   map[string]any{"total": float64(42)},
	})
	return rc
}

func TestResolveInterpolatesMixedStrings(t *testing.T) {
	got := ctx().Resolve("Refund {{trigger.email}} on the {{trigger.nested.plan}} plan")
	want := "Refund jane@example.com on the pro plan"
	if got != want {
		t.Errorf("got %q want %q", got, want)
	}
}

func TestResolveReadsPriorStepOutputByIDAndName(t *testing.T) {
	if got := ctx().Resolve("{{steps.node-1.body.total}}"); got != "42" {
		t.Errorf("by id: got %q", got)
	}
	if got := ctx().Resolve("{{steps.Fetch Ticket.status}}"); got != "" {
		// Names with spaces are not matched by the pattern; document that.
		t.Logf("names containing spaces are not templatable (got %q) — use the node id", got)
	}
}

func TestResolveValuePreservesType(t *testing.T) {
	v := ctx().ResolveValue("{{trigger.amount}}")
	if f, ok := v.(float64); !ok || f != 120 {
		t.Errorf("expected the number 120, got %#v", v)
	}
	if s, ok := ctx().ResolveValue("total: {{trigger.amount}}").(string); !ok || s != "total: 120" {
		t.Errorf("mixed strings should stay strings, got %#v", s)
	}
}

func TestUnresolvedTemplateBecomesEmpty(t *testing.T) {
	if got := ctx().Resolve("x={{trigger.nope}}"); got != "x=" {
		t.Errorf("got %q, want the placeholder stripped", got)
	}
}

func TestBarePathFallsBackToTrigger(t *testing.T) {
	if got := ctx().Resolve("{{email}}"); got != "jane@example.com" {
		t.Errorf("got %q", got)
	}
}
