package engine

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/rahuldev403/forgeflow/internal/database"
	"github.com/rahuldev403/forgeflow/internal/domain"
)

const (
	maxNodeAttempts = 3
	nodeTimeout     = 45 * time.Second
)

// runExecution runs one execution to completion and returns the terminal status.
//
// Two properties matter here and neither existed in v1:
//
//  1. Retries are per node, not per workflow. A flaky HTTP call is retried on its
//     own; the refund the AI node already issued is not issued again.
//  2. Steps are persisted as they run, so the UI can watch a run in flight instead
//     of waiting for a single status flip at the end.
func runExecution(ctx context.Context, workerID int, executionID string) (string, error) {
	var (
		workflowID  string
		payloadJSON []byte
	)
	err := database.DB.QueryRow(ctx,
		`SELECT workflow_id, trigger_payload FROM executions WHERE id = $1`,
		executionID,
	).Scan(&workflowID, &payloadJSON)
	if err != nil {
		return domain.StatusFailed, fmt.Errorf("loading execution: %w", err)
	}

	trigger := map[string]any{}
	if len(payloadJSON) > 0 {
		// A malformed payload should fail this run, not crash the worker.
		if err := json.Unmarshal(payloadJSON, &trigger); err != nil {
			trigger = map[string]any{"_raw": string(payloadJSON)}
		}
	}

	nodes, edges, err := loadGraph(ctx, workflowID)
	if err != nil {
		return domain.StatusFailed, fmt.Errorf("loading graph: %w", err)
	}
	if len(nodes) == 0 {
		markExecution(ctx, executionID, domain.StatusFailed, strPtr("This workflow has no nodes yet. Add a trigger to get started."))
		return domain.StatusFailed, nil
	}

	graph := BuildGraph(nodes, edges)
	order, err := graph.TopoSort()
	if err != nil {
		// A cycle is a user error in the graph, not a transient fault, so it is
		// reported immediately rather than retried three times.
		msg := err.Error()
		markExecution(ctx, executionID, domain.StatusFailed, &msg)
		return domain.StatusFailed, nil
	}

	setExecutionRunning(ctx, executionID)
	seedSteps(ctx, executionID, graph, order)

	rc := NewRunContext(trigger)

	// live tracks which nodes are reachable given the conditions evaluated so far.
	// Roots are always live; any other node is live if at least one parent both ran
	// and passed. That single rule gives us conditional branching for free.
	live := make(map[string]bool, len(order))
	passed := make(map[string]bool, len(order))
	for _, id := range graph.Roots() {
		live[id] = true
	}

	var runErr error

	for stepIndex, nodeID := range order {
		node := graph.Nodes[nodeID]

		if !isLive(graph, node.ID, live, passed) {
			markStepSkipped(ctx, executionID, node.ID, "upstream condition did not pass")
			log.Printf("[worker %d] execution %s | step %d %s (%s) SKIPPED", workerID, short(executionID), stepIndex+1, node.Name, node.Type)
			continue
		}
		live[node.ID] = true

		result, err := runNodeWithRetries(ctx, workerID, executionID, stepIndex, node, rc)
		if err != nil {
			runErr = fmt.Errorf("node %q (%s): %w", node.Name, node.Type, err)
			break
		}

		rc.Record(node.ID, node.Name, result.Output)
		passed[node.ID] = result.Pass
	}

	if runErr != nil {
		msg := runErr.Error()
		markExecution(ctx, executionID, domain.StatusFailed, &msg)
		return domain.StatusFailed, runErr
	}

	markExecution(ctx, executionID, domain.StatusSuccess, nil)
	return domain.StatusSuccess, nil
}

// isLive reports whether a node should run. Roots run unconditionally; everything
// else needs at least one parent that ran and passed.
func isLive(g *Graph, nodeID string, live, passed map[string]bool) bool {
	parents := g.Parents[nodeID]
	if len(parents) == 0 {
		return true
	}
	for _, parent := range parents {
		if live[parent] && passed[parent] {
			return true
		}
	}
	return false
}

// runNodeWithRetries executes a single node, retrying transient failures with
// exponential backoff. A step that already succeeded in an earlier attempt of this
// execution is replayed from its stored output instead of being run again, which is
// what makes a workflow-level retry safe.
func runNodeWithRetries(
	ctx context.Context,
	workerID int,
	executionID string,
	stepIndex int,
	node domain.Node,
	rc *RunContext,
) (StepResult, error) {
	if cached, ok := loadCompletedStep(ctx, executionID, node.ID); ok {
		log.Printf("[worker %d] execution %s | step %d %s already succeeded, replaying stored output",
			workerID, short(executionID), stepIndex+1, node.Name)
		return cached, nil
	}

	exec, err := executorFor(node.Type)
	if err != nil {
		markStepFailed(ctx, executionID, node.ID, 1, err.Error(), nil)
		return StepResult{}, err
	}

	inputSnapshot := map[string]any{"config": node.Config, "trigger": rc.Trigger}

	var lastErr error
	for attempt := 1; attempt <= maxNodeAttempts; attempt++ {
		markStepRunning(ctx, executionID, node.ID, attempt, inputSnapshot)

		nodeCtx, cancel := context.WithTimeout(ctx, nodeTimeout)
		result, err := exec(nodeCtx, node, rc)
		cancel()

		if err == nil {
			markStepSuccess(ctx, executionID, node.ID, attempt, result)
			log.Printf("[worker %d] execution %s | step %d %s (%s) OK",
				workerID, short(executionID), stepIndex+1, node.Name, node.Type)
			return result, nil
		}

		lastErr = err
		log.Printf("[worker %d] execution %s | step %d %s (%s) attempt %d/%d failed: %v",
			workerID, short(executionID), stepIndex+1, node.Name, node.Type, attempt, maxNodeAttempts, err)

		// A cancelled parent context means shutdown -- stop immediately rather than
		// burning the remaining attempts.
		if errors.Is(ctx.Err(), context.Canceled) {
			break
		}
		if attempt < maxNodeAttempts {
			backoff := time.Duration(1<<(attempt-1)) * time.Second // 1s, 2s
			select {
			case <-time.After(backoff):
			case <-ctx.Done():
				lastErr = ctx.Err()
			}
		}
	}

	markStepFailed(ctx, executionID, node.ID, maxNodeAttempts, lastErr.Error(), nil)
	return StepResult{}, lastErr
}

// --- persistence ------------------------------------------------------------

func loadGraph(ctx context.Context, workflowID string) ([]domain.Node, []domain.Edge, error) {
	nodeRows, err := database.DB.Query(ctx,
		`SELECT id, name, type, config FROM nodes WHERE workflow_id = $1 ORDER BY created_at ASC`,
		workflowID)
	if err != nil {
		return nil, nil, err
	}
	defer nodeRows.Close()

	nodes := make([]domain.Node, 0)
	for nodeRows.Next() {
		var n domain.Node
		var configJSON []byte
		if err := nodeRows.Scan(&n.ID, &n.Name, &n.Type, &configJSON); err != nil {
			return nil, nil, err
		}
		n.Config = map[string]any{}
		if len(configJSON) > 0 {
			_ = json.Unmarshal(configJSON, &n.Config)
		}
		nodes = append(nodes, n)
	}
	if err := nodeRows.Err(); err != nil {
		return nil, nil, err
	}

	edgeRows, err := database.DB.Query(ctx,
		`SELECT source_node_id, target_node_id FROM edges WHERE workflow_id = $1`,
		workflowID)
	if err != nil {
		return nil, nil, err
	}
	defer edgeRows.Close()

	edges := make([]domain.Edge, 0)
	for edgeRows.Next() {
		var e domain.Edge
		if err := edgeRows.Scan(&e.SourceNodeID, &e.TargetNodeID); err != nil {
			return nil, nil, err
		}
		edges = append(edges, e)
	}
	return nodes, edges, edgeRows.Err()
}

// seedSteps writes one PENDING row per node up front, so the UI can render the
// full timeline (including nodes that have not started) the moment a run begins.
func seedSteps(ctx context.Context, executionID string, g *Graph, order []string) {
	for i, nodeID := range order {
		node := g.Nodes[nodeID]
		_, err := database.DB.Exec(ctx, `
			INSERT INTO execution_steps (execution_id, node_id, node_name, node_type, step_order, status)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (execution_id, node_id) DO UPDATE SET step_order = EXCLUDED.step_order
		`, executionID, node.ID, node.Name, node.Type, i, domain.StatusPending)
		if err != nil {
			log.Printf("seeding step for node %s: %v", node.ID, err)
		}
	}
}

// loadCompletedStep returns a previously successful step so a workflow retry does
// not re-run side effects that already happened.
func loadCompletedStep(ctx context.Context, executionID, nodeID string) (StepResult, bool) {
	var outputJSON []byte
	err := database.DB.QueryRow(ctx,
		`SELECT output FROM execution_steps WHERE execution_id = $1 AND node_id = $2 AND status = $3`,
		executionID, nodeID, domain.StatusSuccess,
	).Scan(&outputJSON)
	if err != nil {
		return StepResult{}, false
	}

	output := map[string]any{}
	if len(outputJSON) > 0 {
		_ = json.Unmarshal(outputJSON, &output)
	}

	// A condition node stores its verdict in the output, so a replayed condition
	// keeps gating the graph the same way it did the first time.
	pass := true
	if v, ok := output["result"].(bool); ok {
		pass = v
	}
	return StepResult{Output: output, Pass: pass}, true
}

func markStepRunning(ctx context.Context, executionID, nodeID string, attempt int, input map[string]any) {
	_, err := database.DB.Exec(ctx, `
		UPDATE execution_steps
		SET status = $1, attempt = $2, input = $3, started_at = COALESCE(started_at, now())
		WHERE execution_id = $4 AND node_id = $5
	`, domain.StatusRunning, attempt, jsonOrNull(input), executionID, nodeID)
	if err != nil {
		log.Printf("marking step running: %v", err)
	}
}

func markStepSuccess(ctx context.Context, executionID, nodeID string, attempt int, result StepResult) {
	_, err := database.DB.Exec(ctx, `
		UPDATE execution_steps
		SET status = $1, attempt = $2, output = $3, error = NULL, completed_at = now()
		WHERE execution_id = $4 AND node_id = $5
	`, domain.StatusSuccess, attempt, jsonOrNull(result.Output), executionID, nodeID)
	if err != nil {
		log.Printf("marking step success: %v", err)
	}
}

func markStepFailed(ctx context.Context, executionID, nodeID string, attempt int, message string, output map[string]any) {
	_, err := database.DB.Exec(ctx, `
		UPDATE execution_steps
		SET status = $1, attempt = $2, error = $3, output = $4, completed_at = now()
		WHERE execution_id = $5 AND node_id = $6
	`, domain.StatusFailed, attempt, message, jsonOrNull(output), executionID, nodeID)
	if err != nil {
		log.Printf("marking step failed: %v", err)
	}
}

func markStepSkipped(ctx context.Context, executionID, nodeID, reason string) {
	_, err := database.DB.Exec(ctx, `
		UPDATE execution_steps
		SET status = $1, error = $2, completed_at = now()
		WHERE execution_id = $3 AND node_id = $4
	`, domain.StatusSkipped, reason, executionID, nodeID)
	if err != nil {
		log.Printf("marking step skipped: %v", err)
	}
}

func setExecutionRunning(ctx context.Context, executionID string) {
	_, err := database.DB.Exec(ctx,
		`UPDATE executions SET status = $1, attempts = attempts + 1 WHERE id = $2`,
		domain.StatusRunning, executionID)
	if err != nil {
		log.Printf("marking execution running: %v", err)
	}
}

func markExecution(ctx context.Context, executionID, status string, errMsg *string) {
	_, err := database.DB.Exec(ctx,
		`UPDATE executions SET status = $1, error = $2, completed_at = now() WHERE id = $3`,
		status, errMsg, executionID)
	if err != nil {
		log.Printf("marking execution %s: %v", status, err)
	}
}

func strPtr(s string) *string { return &s }

func short(id string) string {
	if len(id) > 8 {
		return id[:8]
	}
	return id
}
