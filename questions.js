Coding Problem — Task Dependency Executor

You are given a list of tasks. Each task may depend on one or more other tasks.

A task can only be executed after all of its dependencies have been completed.

For example:

type Task = {
  id: string;
  dependsOn: string[];};

const tasks: Task[] = [
  { id: "A", dependsOn: [] },
  { id: "B", dependsOn: ["A"] },
  { id: "C", dependsOn: ["A"] },
  { id: "D", dependsOn: ["B", "C"] }
];

The dependency relationship is:

      A
     / \
    B   C
     \ /
      D

Implement:

function executionOrder(tasks: Task[]): string[] {
  // Your implementation
}

The function should return one valid order in which the tasks can safely be executed.

For the example above, one valid answer is:

["A", "B", "C", "D"]

This is also valid:

["A", "C", "B", "D"]

There may be multiple correct answers.

Requirements:
A task must appear only after all of its dependencies.
Every task must appear exactly once.
The input tasks may be provided in any order.