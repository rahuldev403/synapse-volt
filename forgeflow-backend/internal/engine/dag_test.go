package engine

import (
	"testing"

	"github.com/rahuldev403/forgeflow/internal/domain"
)

func nodes(ids ...string) []domain.Node {
	out := make([]domain.Node, 0, len(ids))
	for _, id := range ids {
		out = append(out, domain.Node{ID: id, Name: id, Type: domain.NodeLog})
	}
	return out
}

func edge(from, to string) domain.Edge {
	return domain.Edge{SourceNodeID: from, TargetNodeID: to}
}

func indexOf(order []string, id string) int {
	for i, v := range order {
		if v == id {
			return i
		}
	}
	return -1
}

// A -> B, A -> C, B -> D, C -> D  (the diamond from questions.js)
func TestTopoSortDiamond(t *testing.T) {
	g := BuildGraph(nodes("A", "B", "C", "D"),
		[]domain.Edge{edge("A", "B"), edge("A", "C"), edge("B", "D"), edge("C", "D")})

	order, err := g.TopoSort()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(order) != 4 {
		t.Fatalf("expected 4 nodes, got %d: %v", len(order), order)
	}
	if indexOf(order, "A") > indexOf(order, "B") || indexOf(order, "A") > indexOf(order, "C") {
		t.Errorf("A must run before B and C: %v", order)
	}
	if indexOf(order, "D") < indexOf(order, "B") || indexOf(order, "D") < indexOf(order, "C") {
		t.Errorf("D must run after B and C: %v", order)
	}
}

func TestTopoSortDetectsCycle(t *testing.T) {
	g := BuildGraph(nodes("A", "B", "C"),
		[]domain.Edge{edge("A", "B"), edge("B", "C"), edge("C", "A")})

	if _, err := g.TopoSort(); err == nil {
		t.Fatal("expected a cycle error, got nil")
	}
}

func TestTopoSortIsDeterministic(t *testing.T) {
	n := nodes("A", "B", "C", "D")
	e := []domain.Edge{edge("A", "B"), edge("A", "C"), edge("B", "D"), edge("C", "D")}

	first, err := BuildGraph(n, e).TopoSort()
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 25; i++ {
		again, err := BuildGraph(n, e).TopoSort()
		if err != nil {
			t.Fatal(err)
		}
		for j := range first {
			if first[j] != again[j] {
				t.Fatalf("order is not stable across runs: %v vs %v", first, again)
			}
		}
	}
}

func TestTopoSortDisconnectedAndEmpty(t *testing.T) {
	order, err := BuildGraph(nodes("A", "B", "C"), nil).TopoSort()
	if err != nil || len(order) != 3 {
		t.Fatalf("disconnected nodes should all run: %v %v", order, err)
	}

	order, err = BuildGraph(nil, nil).TopoSort()
	if err != nil || len(order) != 0 {
		t.Fatalf("empty graph should be a no-op: %v %v", order, err)
	}
}

func TestBuildGraphIgnoresDanglingAndDuplicateEdges(t *testing.T) {
	g := BuildGraph(nodes("A", "B"),
		[]domain.Edge{edge("A", "B"), edge("A", "B"), edge("A", "GHOST")})

	if g.Indegree["B"] != 1 {
		t.Errorf("duplicate edge inflated indegree to %d", g.Indegree["B"])
	}
	if _, err := g.TopoSort(); err != nil {
		t.Errorf("dangling edge should be ignored, got %v", err)
	}
}
