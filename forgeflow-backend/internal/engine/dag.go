package engine

import (
	"fmt"
	"sort"

	"github.com/rahuldev403/forgeflow/internal/domain"
)

// Graph is the runtime view of a workflow: adjacency lists plus indegrees.
type Graph struct {
	Nodes     map[string]domain.Node
	Children  map[string][]string
	Parents   map[string][]string
	Indegree  map[string]int
	nodeOrder []string // stable creation order, used to break ties deterministically
}

func BuildGraph(nodes []domain.Node, edges []domain.Edge) *Graph {
	g := &Graph{
		Nodes:    make(map[string]domain.Node, len(nodes)),
		Children: make(map[string][]string, len(nodes)),
		Parents:  make(map[string][]string, len(nodes)),
		Indegree: make(map[string]int, len(nodes)),
	}

	for _, n := range nodes {
		g.Nodes[n.ID] = n
		g.Indegree[n.ID] = 0
		g.nodeOrder = append(g.nodeOrder, n.ID)
	}

	seen := make(map[string]struct{}, len(edges))
	for _, e := range edges {
		// Ignore edges pointing at nodes that no longer exist, and duplicates.
		if _, ok := g.Nodes[e.SourceNodeID]; !ok {
			continue
		}
		if _, ok := g.Nodes[e.TargetNodeID]; !ok {
			continue
		}
		key := e.SourceNodeID + "->" + e.TargetNodeID
		if _, dup := seen[key]; dup {
			continue
		}
		seen[key] = struct{}{}

		g.Children[e.SourceNodeID] = append(g.Children[e.SourceNodeID], e.TargetNodeID)
		g.Parents[e.TargetNodeID] = append(g.Parents[e.TargetNodeID], e.SourceNodeID)
		g.Indegree[e.TargetNodeID]++
	}

	return g
}

// TopoSort returns a safe execution order using Kahn's algorithm: repeatedly take a
// node whose dependencies are all satisfied, then relax its outgoing edges.
//
// Ties are broken by creation order so the same graph always runs in the same
// order — a run you debugged yesterday reproduces today.
//
// If the queue drains before every node is emitted, the remaining nodes are all
// part of (or downstream of) a cycle, which is what makes this a *directed acyclic*
// graph check rather than just a traversal.
func (g *Graph) TopoSort() ([]string, error) {
	rank := make(map[string]int, len(g.nodeOrder))
	for i, id := range g.nodeOrder {
		rank[id] = i
	}

	indegree := make(map[string]int, len(g.Indegree))
	for id, d := range g.Indegree {
		indegree[id] = d
	}

	ready := make([]string, 0, len(g.Nodes))
	for id, d := range indegree {
		if d == 0 {
			ready = append(ready, id)
		}
	}
	sort.Slice(ready, func(i, j int) bool { return rank[ready[i]] < rank[ready[j]] })

	order := make([]string, 0, len(g.Nodes))
	for len(ready) > 0 {
		current := ready[0]
		ready = ready[1:]
		order = append(order, current)

		promoted := make([]string, 0, len(g.Children[current]))
		for _, child := range g.Children[current] {
			indegree[child]--
			if indegree[child] == 0 {
				promoted = append(promoted, child)
			}
		}
		sort.Slice(promoted, func(i, j int) bool { return rank[promoted[i]] < rank[promoted[j]] })
		ready = append(ready, promoted...)
	}

	if len(order) != len(g.Nodes) {
		stuck := make([]string, 0)
		for id := range g.Nodes {
			if indegree[id] > 0 {
				stuck = append(stuck, g.Nodes[id].Name)
			}
		}
		sort.Strings(stuck)
		return nil, fmt.Errorf("workflow contains a cycle — these nodes can never run: %v", stuck)
	}

	return order, nil
}

// Roots are the nodes with no dependencies; they start the run.
func (g *Graph) Roots() []string {
	roots := make([]string, 0)
	for _, id := range g.nodeOrder {
		if g.Indegree[id] == 0 {
			roots = append(roots, id)
		}
	}
	return roots
}
