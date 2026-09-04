package engine

import (
	"context"
	"log"
	"sync"

	"github.com/rahuldev403/forgeflow/internal/domain"
)

// Pool is a fixed set of goroutines draining a buffered channel of execution ids.
//
// The buffer is what makes the webhook endpoint fast: the HTTP handler writes one
// row, drops the id on the channel and returns 202 without waiting for the run.
type Pool struct {
	jobs   chan string
	wg     sync.WaitGroup
	ctx    context.Context
	cancel context.CancelFunc
	once   sync.Once
}

var defaultPool *Pool

// Start spins up the worker pool. queueSize bounds how many runs can be waiting
// before Enqueue starts reporting back-pressure instead of blocking the request.
func Start(workers, queueSize int) *Pool {
	ctx, cancel := context.WithCancel(context.Background())

	p := &Pool{
		jobs:   make(chan string, queueSize),
		ctx:    ctx,
		cancel: cancel,
	}

	for i := 1; i <= workers; i++ {
		p.wg.Add(1)
		go p.run(i)
	}

	defaultPool = p
	log.Printf("engine: %d workers started, queue depth %d", workers, queueSize)
	return p
}

func (p *Pool) run(id int) {
	defer p.wg.Done()
	log.Printf("engine: worker %d ready", id)

	for {
		select {
		case <-p.ctx.Done():
			log.Printf("engine: worker %d stopping", id)
			return

		case executionID, ok := <-p.jobs:
			if !ok {
				return
			}

			status, err := runExecution(p.ctx, id, executionID)
			if err != nil {
				// Every node already exhausted its own retries by this point, so the
				// run is genuinely dead rather than transiently unlucky.
				log.Printf("[worker %d] execution %s FAILED: %v", id, short(executionID), err)
				continue
			}
			log.Printf("[worker %d] execution %s %s", id, short(executionID), status)
		}
	}
}

// Enqueue submits an execution. It never blocks: if the queue is saturated the
// execution is marked failed straight away so the caller sees back-pressure
// instead of a request that hangs.
func (p *Pool) Enqueue(executionID string) error {
	select {
	case p.jobs <- executionID:
		return nil
	default:
		msg := "engine queue is full, try again shortly"
		markExecution(context.Background(), executionID, domain.StatusFailed, &msg)
		return ErrQueueFull
	}
}

// Shutdown stops accepting work and waits for in-flight runs to unwind.
func (p *Pool) Shutdown() {
	p.once.Do(func() {
		log.Println("engine: draining workers")
		p.cancel()
		close(p.jobs)
		p.wg.Wait()
		log.Println("engine: all workers stopped")
	})
}

// Enqueue on the process-wide pool, for handlers that do not hold a reference.
func Enqueue(executionID string) error {
	if defaultPool == nil {
		return ErrNotStarted
	}
	return defaultPool.Enqueue(executionID)
}

type engineError string

func (e engineError) Error() string { return string(e) }

const (
	ErrQueueFull  = engineError("engine queue is full")
	ErrNotStarted = engineError("engine has not been started")
)
