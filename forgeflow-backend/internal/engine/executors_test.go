package engine

import (
	"context"
	"testing"

	"github.com/rahuldev403/forgeflow/internal/domain"
)

func node(nodeType string, config map[string]any) domain.Node {
	return domain.Node{ID: "n1", Name: "test node", Type: nodeType, Config: config}
}

func TestConditionGatesTheGraph(t *testing.T) {
	rc := NewRunContext(map[string]any{"amount": float64(250)})

	cases := []struct {
		name     string
		config   map[string]any
		wantPass bool
	}{
		{"numeric greater-than passes", map[string]any{"left": "{{trigger.amount}}", "operator": "gt", "right": "100"}, true},
		{"numeric greater-than fails", map[string]any{"left": "{{trigger.amount}}", "operator": "gt", "right": "500"}, false},
		{"string equality", map[string]any{"left": "{{trigger.amount}}", "operator": "eq", "right": "250"}, true},
		{"exists on a missing field", map[string]any{"left": "{{trigger.nope}}", "operator": "exists"}, false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			result, err := execCondition(context.Background(), node(domain.NodeCondition, tc.config), rc)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if result.Pass != tc.wantPass {
				t.Errorf("Pass = %v, want %v", result.Pass, tc.wantPass)
			}
			// A false condition is a normal outcome, so the step still succeeds.
			if result.Output["result"] != tc.wantPass {
				t.Errorf("output result = %v, want %v", result.Output["result"], tc.wantPass)
			}
		})
	}
}

func TestConditionRejectsNonNumericComparison(t *testing.T) {
	rc := NewRunContext(map[string]any{"name": "jane"})
	_, err := execCondition(context.Background(),
		node(domain.NodeCondition, map[string]any{"left": "{{trigger.name}}", "operator": "gt", "right": "10"}), rc)
	if err == nil {
		t.Fatal("comparing a name with > should be an error, not a silent false")
	}
}

func TestTransformResolvesEachMappedField(t *testing.T) {
	rc := NewRunContext(map[string]any{"email": "jane@example.com", "amount": float64(42)})

	result, err := execTransform(context.Background(), node(domain.NodeTransform, map[string]any{
		"mapping": map[string]any{
			"customer": "{{trigger.email}}",
			"total":    "{{trigger.amount}}",
			"note":     "refund for {{trigger.email}}",
		},
	}), rc)
	if err != nil {
		t.Fatal(err)
	}

	if result.Output["customer"] != "jane@example.com" {
		t.Errorf("customer = %v", result.Output["customer"])
	}
	// A whole-string template keeps its original type instead of stringifying.
	if total, ok := result.Output["total"].(float64); !ok || total != 42 {
		t.Errorf("total = %#v, want the number 42", result.Output["total"])
	}
	if result.Output["note"] != "refund for jane@example.com" {
		t.Errorf("note = %v", result.Output["note"])
	}
}

func TestTransformWithoutMappingIsAnError(t *testing.T) {
	_, err := execTransform(context.Background(), node(domain.NodeTransform, map[string]any{}), NewRunContext(nil))
	if err == nil {
		t.Fatal("a transform with no mapping should tell the user, not emit an empty object")
	}
}

func TestDelayIsCapped(t *testing.T) {
	// Asserted on the pure helper so the test does not actually sleep for 30s.
	cases := map[any]int{999999: maxDelayMS, -5: 0, 250: 250, "750": 750}
	for input, want := range cases {
		if got := cappedDelayMS(node(domain.NodeDelay, map[string]any{"ms": input})); got != want {
			t.Errorf("ms=%v: got %d, want %d", input, got, want)
		}
	}
}

func TestDelayIsCancellable(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	if _, err := execDelay(ctx, node(domain.NodeDelay, map[string]any{"ms": 5000}), nil); err == nil {
		t.Error("a cancelled context should abort the delay rather than holding the worker")
	}
}

func TestDelayCompletes(t *testing.T) {
	result, err := execDelay(context.Background(), node(domain.NodeDelay, map[string]any{"ms": 5}), nil)
	if err != nil {
		t.Fatal(err)
	}
	if result.Output["waited_ms"] != 5 {
		t.Errorf("waited_ms = %v", result.Output["waited_ms"])
	}
}

func TestHTTPRejectsMissingAndNonHTTPURLs(t *testing.T) {
	rc := NewRunContext(nil)

	if _, err := execHTTP(context.Background(), node(domain.NodeHTTP, map[string]any{"url": ""}), rc); err == nil {
		t.Error("an empty URL should be rejected before any network call")
	}
	if _, err := execHTTP(context.Background(), node(domain.NodeHTTP, map[string]any{"url": "file:///etc/passwd"}), rc); err == nil {
		t.Error("a non-http scheme should be rejected")
	}
}

func TestUnknownNodeTypeHasNoExecutor(t *testing.T) {
	if _, err := executorFor("TELEPORT"); err == nil {
		t.Fatal("expected an error for an unregistered node type")
	}
	for _, spec := range domain.NodeTypeCatalog {
		if _, err := executorFor(spec.Type); err != nil {
			t.Errorf("catalog advertises %s but no executor is registered", spec.Type)
		}
	}
}

// isLive encodes the branching rule: a node runs when at least one parent ran and
// passed. This is what makes a false CONDITION skip its whole downstream subtree.
func TestIsLiveBranchingRule(t *testing.T) {
	g := BuildGraph(nodes("cond", "yes", "no", "join"), []domain.Edge{
		edge("cond", "yes"),
		edge("no", "join"),
		edge("yes", "join"),
	})

	live := map[string]bool{"cond": true, "no": true}
	passed := map[string]bool{"cond": false, "no": true}

	if !isLive(g, "cond", live, passed) {
		t.Error("a root node should always be live")
	}
	if isLive(g, "yes", live, passed) {
		t.Error("a child of a failed condition should be skipped")
	}
	if !isLive(g, "join", live, passed) {
		t.Error("a node with one live, passing parent should still run")
	}
}
