# LlamaIndex Workflows for TypeScript

> **Last updated**: April 2026
> **Source**: Official documentation at [developers.llamaindex.ai](https://developers.llamaindex.ai/typescript/workflows/), [GitHub repo](https://github.com/run-llama/workflows-ts), and npm package source code.

## Table of Contents

- [Overview](#overview)
- [Deprecation Notice](#deprecation-notice)
- [Installation](#installation)
- [Core Concepts](#core-concepts)
  - [Events](#events)
  - [Workflows](#workflows)
  - [Handlers](#handlers)
  - [Context](#context)
  - [Stream](#stream)
- [Basic Usage](#basic-usage)
- [Running a Workflow](#running-a-workflow)
- [Stream Utilities](#stream-utilities)
- [Middleware](#middleware)
  - [State Middleware (withState)](#state-middleware-withstate)
  - [Validation Middleware (withValidation)](#validation-middleware-withvalidation)
  - [Trace Events Middleware (withTraceEvents)](#trace-events-middleware-withtraceevents)
- [Common Patterns](#common-patterns)
  - [Branching](#branching)
  - [Loops](#loops)
  - [Fan-In / Fan-Out (Parallelism)](#fan-in--fan-out-parallelism)
  - [Human-in-the-Loop](#human-in-the-loop)
- [Error Handling and Retries](#error-handling-and-retries)
- [OpenAI Integration](#openai-integration)
- [Server Integration](#server-integration)
- [Agent Workflows (Higher-Level API)](#agent-workflows-higher-level-api)
- [Visualization](#visualization)
- [Zod Event Validation](#zod-event-validation)
- [OR Event Combinator](#or-event-combinator)
- [Complete Working Examples](#complete-working-examples)
- [API Reference Summary](#api-reference-summary)
- [Gotchas and Notes](#gotchas-and-notes)

---

## Overview

LlamaIndex Workflows is a simple, lightweight, event-driven workflow engine for TypeScript and JavaScript. It provides minimal boilerplate for building complex workflows with full type safety, streaming support, and multi-runtime compatibility.

**Key characteristics:**
- Minimal core API (less than 2kb)
- 100% type-safe
- Event-driven, stream-oriented programming
- Supports Node.js, Deno, Bun, Cloudflare Workers, browsers
- Built on standard `ReadableStream` (works with RxJS, Node streams, etc.)

---

## Deprecation Notice

**Important**: There are two related packages with different deprecation statuses:

1. **`@llamaindex/workflow-core`** (v1.3.x) - The core standalone workflow engine. Lives in [github.com/run-llama/workflows-ts](https://github.com/run-llama/workflows-ts). The GitHub README has a deprecation notice pointing to LlamaAgents (Python), but the npm package was still receiving updates as of mid-2026. The TypeScript documentation at developers.llamaindex.ai still actively references it.

2. **`@llamaindex/workflow`** (v1.1.x) - A wrapper that re-exports `@llamaindex/workflow-core` plus adds LlamaIndex-specific agent functionality (`agent()`, `multiAgent()`). Lives in [github.com/run-llama/LlamaIndexTS](https://github.com/run-llama/LlamaIndexTS). Its `package.json` has a `"deprecated"` field.

**Recommendation**: For pure workflow orchestration (event-driven steps, no LlamaIndex agent framework), use `@llamaindex/workflow-core` directly. For LlamaIndex agent workflows (with `agent()`, `multiAgent()`, tools), use `@llamaindex/workflow` which re-exports everything from `workflow-core` plus agent utilities.

Check the current status of these packages before adopting them for a new project.

---

## Installation

### Core workflow engine only

```bash
npm i @llamaindex/workflow-core
# or
yarn add @llamaindex/workflow-core
# or
pnpm add @llamaindex/workflow-core
# or
bun add @llamaindex/workflow-core
# or
deno add npm:@llamaindex/workflow-core
```

### With LlamaIndex agent support

```bash
npm i @llamaindex/workflow @llamaindex/openai
```

### For OpenAI integration (standalone, without LlamaIndex)

```bash
npm i @llamaindex/workflow-core openai
```

### Optional peer dependencies

The core package has optional peer dependencies you install only when needed:

| Package | When needed |
|---------|-------------|
| `zod` (v3 or v4) | Using `zodEvent` for runtime data validation |
| `p-retry` | Using `pRetryHandler` for automatic retries |
| `hono` | Using `createHonoHandler` server integration |
| `next` | Using Next.js integration |
| `rxjs` | Using RxJS stream interop |
| `@modelcontextprotocol/sdk` | MCP integration |

### For workflow visualization

```bash
npm i @llamaindex/workflow-viz
```

---

## Core Concepts

### Events

Events are the core building blocks. They represent typed data that flows through the system. Create them with `workflowEvent<DataType>()`:

```typescript
import { workflowEvent } from "@llamaindex/workflow-core";

// Event with no data
const startEvent = workflowEvent<void>();

// Event with string data
const messageEvent = workflowEvent<string>();

// Event with complex data
const userEvent = workflowEvent<{ name: string; email: string }>();

// Event with a debug label (useful for logging and visualization)
const processEvent = workflowEvent<number>({ debugLabel: "process" });

// Event with a unique ID (for serialization/network communication)
const networkEvent = workflowEvent<string>({ uniqueId: "net-event-1" });
```

#### Event API

| Method | Description |
|--------|-------------|
| `event.with(data)` | Creates an event data instance with the given payload |
| `event.include(unknown)` | Type guard - checks if an event data instance belongs to this event type |
| `event.onInit(callback)` | Registers a callback called when this event is instantiated; returns a cleanup function |
| `event.debugLabel` | Optional label for debugging/logging |
| `event.uniqueId` | Unique identifier for serialization |

```typescript
// Creating event data
const evt = messageEvent.with("hello world");

// Type-checking event data
if (messageEvent.include(someEvent)) {
  console.log(someEvent.data); // TypeScript knows this is string
}
```

### Workflows

A workflow is a registry of event handlers. Create one with `createWorkflow()`:

```typescript
import { createWorkflow } from "@llamaindex/workflow-core";

const workflow = createWorkflow();
```

#### Workflow API

| Method | Description |
|--------|-------------|
| `workflow.handle(events, handler)` | Registers a handler for one or more event types |
| `workflow.createContext()` | Creates a new execution context for processing events |

### Handlers

Handlers are functions that process events and optionally emit new events. They receive:
1. **context** - The workflow context (provides `sendEvent`, `stream`, `signal`)
2. **event data** - One or more event data instances matching the registered event types

```typescript
// Handler with context parameter (recommended)
workflow.handle([startEvent], async (context, event) => {
  console.log("Received:", event.data);
  // Return an event to emit it
  return stopEvent.with("done");
});

// Handler that uses context to send events manually
workflow.handle([startEvent], async (context, event) => {
  const { sendEvent } = context;
  sendEvent(processEvent.with(42));
  // No return value needed when using sendEvent
});

// Handler for multiple event types
workflow.handle([eventA, eventB], async (context, evtA, evtB) => {
  // This handler fires only when BOTH eventA AND eventB are in the queue
  return resultEvent.with(evtA.data + evtB.data);
});
```

**Important**: When a handler returns an event data instance, it is automatically sent to the workflow (equivalent to calling `context.sendEvent()`).

### Context

The context is the execution environment for a workflow. It provides:

```typescript
const { stream, sendEvent, signal } = workflow.createContext();
```

| Property | Type | Description |
|----------|------|-------------|
| `stream` | `WorkflowStream` | Stream of all events flowing through this context |
| `sendEvent(...events)` | Function | Sends one or more events into the workflow |
| `signal` | `AbortSignal` | Indicates if the workflow has been cancelled |

### Stream

`WorkflowStream` extends `ReadableStream` with workflow-specific methods:

| Method | Description |
|--------|-------------|
| `stream.filter(eventOrFn)` | Filter events by type or predicate function |
| `stream.until(eventOrFn)` | Collect events until a condition is met, then terminate |
| `stream.untilEvent(eventOrFn)` | Like `until` but returns only the matching event directly |
| `stream.take(n)` | Take only the first N events |
| `stream.map(fn)` | Transform each event |
| `stream.forEach(fn)` | Process each event with a callback |
| `stream.toArray()` | Collect all events into an array |
| `stream.on(event, handler)` | Subscribe to specific event types; returns unsubscribe function |
| `stream.tee()` | Split into two independent streams |
| `stream.toResponse(init?)` | Convert to HTTP Response (for server use) |
| `WorkflowStream.fromResponse(response, eventMap)` | Create from HTTP Response |

---

## Basic Usage

```typescript
import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";

// 1. Define events
const startEvent = workflowEvent<string>();
const convertEvent = workflowEvent<number>();
const stopEvent = workflowEvent<1 | -1>();

// 2. Create workflow and register handlers
const workflow = createWorkflow();

workflow.handle([startEvent], (context, start) => {
  return convertEvent.with(Number.parseInt(start.data, 10));
});

workflow.handle([convertEvent], (context, convert) => {
  return stopEvent.with(convert.data > 0 ? 1 : -1);
});

// 3. Execute
const { stream, sendEvent } = workflow.createContext();
sendEvent(startEvent.with("42"));

const allEvents = await stream.until(stopEvent).toArray();
const result = allEvents.at(-1);
console.log(result?.data); // 1
```

---

## Running a Workflow

### Manual execution with stream

```typescript
const { stream, sendEvent } = workflow.createContext();
sendEvent(startEvent.with("hello"));

// Option 1: for-await loop
for await (const event of stream) {
  if (stopEvent.include(event)) {
    console.log("Result:", event.data);
    break; // Important: break to stop consuming the stream
  }
}

// Option 2: stream.until().toArray()
const events = await stream.until(stopEvent).toArray();
const finalEvent = events.at(-1);

// Option 3: stream.untilEvent() - returns just the matching event
const result = await stream.untilEvent(stopEvent);
console.log(result.data);

// Option 4: Node.js pipeline
import { pipeline } from "node:stream/promises";
const result = await pipeline(stream, async (source) => {
  for await (const event of source) {
    if (stopEvent.include(event)) {
      return event.data;
    }
  }
});
```

### Helper functions

```typescript
import {
  run,
  runWorkflow,
  runAndCollect,
  runStream,
} from "@llamaindex/workflow-core/stream/run";

// run() - returns a stream directly
const eventStream = run(workflow, startEvent.with("42"));
const events = await eventStream.until(stopEvent).toArray();

// runWorkflow() - returns the first matching output event (deprecated, use stream.until)
const result = await runWorkflow(workflow, startEvent.with("42"), stopEvent);
console.log(result.data);

// runAndCollect() - returns all events until output (deprecated, use stream.until)
const allEvents = await runAndCollect(workflow, startEvent.with("42"), stopEvent);

// runStream() - returns async iterable (deprecated, use stream.until)
for await (const event of runStream(workflow, startEvent.with("42"), stopEvent)) {
  console.log(event);
}
```

---

## Stream Utilities

### Filtering events

```typescript
// Filter by event type
const userEvents = stream.filter(userEvent);

// Filter by predicate function
const importantEvents = stream.filter(event => event.data.priority === "high");

// Filter by specific event instance
const specificEvent = stream.filter(myEventInstance);
```

### Subscribing to events

```typescript
// Subscribe to specific event type
const unsubscribe = stream.on(userEvent, (event) => {
  console.log("User event received:", event.data);
});

// Later, clean up
unsubscribe();
```

### Chaining stream operations

```typescript
const results = await stream
  .filter(processEvent)
  .take(5)
  .map(event => event.data * 2)
  .toArray();
```

---

## Middleware

### State Middleware (withState)

Adds persistent state to the workflow context, with snapshot/resume support.

```typescript
import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";
import { createStatefulMiddleware } from "@llamaindex/workflow-core/middleware/state";

// Define state type
type MyState = {
  counter: number;
  messages: string[];
};

// Create middleware with initializer function
const { withState } = createStatefulMiddleware((input: MyState) => input);

// Wrap workflow
const workflow = withState(createWorkflow());

// Use state in handlers
workflow.handle([startEvent], async (context, event) => {
  const { state, sendEvent } = context;
  state.counter += 1;
  state.messages.push(`Processed: ${event.data}`);
  sendEvent(outputEvent.with({ count: state.counter }));
});

// Create context with initial state
const ctx = workflow.createContext({
  counter: 0,
  messages: [],
});
```

#### Without input (default state):

```typescript
const { withState } = createStatefulMiddleware(() => ({
  pendingTasks: new Set<Promise<unknown>>(),
}));

const workflow = withState(createWorkflow());
const { state } = workflow.createContext();
```

#### Snapshot and Resume:

```typescript
// Take a snapshot (freezes the context)
const snapshotData = await ctx.snapshot();

// Resume from snapshot in a new context
const resumedCtx = workflow.resume(snapshotData);
resumedCtx.sendEvent(humanResponseEvent.with("user input"));

// Continue processing
const result = await resumedCtx.stream.until(stopEvent).toArray();
```

**SnapshotData structure:**
```typescript
interface SnapshotData {
  queue: [data: any, id: number][];
  unrecoverableQueue: any[];
  version: string;
  state?: string | undefined;
}
```

### Validation Middleware (withValidation)

Adds type-safe and runtime-safe event routing validation:

```typescript
import { withValidation } from "@llamaindex/workflow-core/middleware/validation";

const startEvent = workflowEvent<void, "start">();
const parseEvent = workflowEvent<string, "parse">();
const stopEvent = workflowEvent<number, "stop">();
const disallowedEvent = workflowEvent<void, "disallowed">();

// Define allowed event transitions
const workflow = withValidation(createWorkflow(), [
  [[startEvent], [stopEvent]],
  [[startEvent], [parseEvent]],
]);

// strictHandle enforces the transition rules at compile AND runtime
workflow.strictHandle([startEvent], (sendEvent, start) => {
  sendEvent(disallowedEvent.with()); // Type error + runtime error
  sendEvent(parseEvent.with(""));    // OK
  sendEvent(stopEvent.with(1));      // OK
});
```

### Trace Events Middleware (withTraceEvents)

Adds tracing and handler decorators for debugging:

```typescript
import {
  withTraceEvents,
  runOnce,
  createHandlerDecorator,
} from "@llamaindex/workflow-core/middleware/trace-events";

const workflow = withTraceEvents(createWorkflow());

// runOnce - handler only executes the first time per context
workflow.handle(
  [messageEvent],
  runOnce(() => {
    console.log("This runs only once per context");
  }),
);

// Custom handler decorator
const myDecorator = createHandlerDecorator({
  debugLabel: "myHook",
  getInitialValue: () => 0,
  onBeforeHandler: (handler, handlerContext, count) => {
    console.log(`Handler called ${count} times`);
    return handler;
  },
  onAfterHandler: (count) => count + 1,
});
```

#### Substream

Track events emitted by a specific handler invocation:

```typescript
workflow.handle([startEvent], async (context) => {
  const { sendEvent, stream } = context;
  const ev = networkRequestEvent.with();
  sendEvent(ev);
  // Only get events spawned from this specific event
  const responses = await collect(workflow.substream(ev, stream));
});
```

---

## Common Patterns

### Branching

Emit different events based on conditions:

```typescript
workflow.handle([startEvent], async (context, event) => {
  const { sendEvent, stream } = context;

  // Fan-out to 3 branches
  sendEvent(branchAEvent.with("Branch A"));
  sendEvent(branchBEvent.with("Branch B"));
  sendEvent(branchCEvent.with("Branch C"));

  // Collect all branch results
  const results = await stream.filter(branchCompleteEvent).take(3).toArray();

  return allCompleteEvent.with(results.map(e => e.data).join(", "));
});

workflow.handle([branchAEvent], (ctx, evt) => branchCompleteEvent.with(evt.data));
workflow.handle([branchBEvent], (ctx, evt) => branchCompleteEvent.with(evt.data));
workflow.handle([branchCEvent], (ctx, evt) => branchCompleteEvent.with(evt.data));
```

### Loops

Create cyclic workflows by emitting events that trigger earlier handlers:

```typescript
import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";
import { createStatefulMiddleware } from "@llamaindex/workflow-core/middleware/state";

type CounterState = {
  counter: number;
  max_counter: number;
};

const { withState } = createStatefulMiddleware(
  (state: CounterState) => state,
);
const workflow = withState(createWorkflow());

const startEvent = workflowEvent<void>();
const increaseCounterEvent = workflowEvent<void>();
const stopEvent = workflowEvent<number>();

// Decision handler: loop or stop
workflow.handle([startEvent], async (context) => {
  const { sendEvent, state } = context;
  if (state.counter < state.max_counter) {
    sendEvent(increaseCounterEvent.with());
  } else {
    sendEvent(stopEvent.with(state.counter));
  }
});

// Loop body: increment and go back to start
workflow.handle([increaseCounterEvent], async (context) => {
  const { sendEvent, state } = context;
  state.counter += 1;
  sendEvent(startEvent.with());
});

// Execute
const { stream, sendEvent } = workflow.createContext({
  counter: 0,
  max_counter: 5,
});

sendEvent(startEvent.with());
const result = await stream.until(stopEvent).toArray();
console.log(result[result.length - 1].data); // 5
```

### Fan-In / Fan-Out (Parallelism)

Emit multiple events for concurrent processing, then aggregate results:

```typescript
import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";
import { createStatefulMiddleware } from "@llamaindex/workflow-core/middleware/state";

const startEvent = workflowEvent<string>();
const processItemEvent = workflowEvent<number>();
const resultEvent = workflowEvent<string>();
const completeEvent = workflowEvent<string[]>();

const { withState } = createStatefulMiddleware(() => ({
  itemsToProcess: 10,
  itemsProcessed: 0,
  processResults: [] as string[],
}));
const workflow = withState(createWorkflow());

// Fan-out: emit N events
workflow.handle([startEvent], async (context) => {
  const { sendEvent, state } = context;
  state.itemsProcessed = 0;
  for (let i = 0; i < state.itemsToProcess; i++) {
    sendEvent(processItemEvent.with(i));
  }
});

// Process each item independently
workflow.handle([processItemEvent], async (context, event) => {
  const { sendEvent, state } = context;
  await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
  const processedValue = `Processed: ${event.data}`;
  state.itemsProcessed++;
  sendEvent(resultEvent.with(processedValue));
});

// Fan-in: aggregate results
workflow.handle([resultEvent], async (context, event) => {
  const { sendEvent, state } = context;
  state.processResults.push(event.data);
  if (state.itemsProcessed === state.itemsToProcess) {
    sendEvent(completeEvent.with(state.processResults));
  }
});

// Run
const { stream, sendEvent } = workflow.createContext();
sendEvent(startEvent.with("Start"));
const result = await stream.untilEvent(completeEvent);
console.log("Results:", result.data);
```

#### Simpler fan-out using stream

```typescript
let condition = false;
workflow.handle([startEvent], async (context) => {
  const { sendEvent, stream } = context;
  for (let i = 0; i < 10; i++) {
    sendEvent(convertEvent.with(i));
  }
  const results = await stream
    .until(() => condition)
    .filter(convertStopEvent)
    .toArray();
  console.log(results.length); // 10
  return stopEvent.with();
});

workflow.handle([convertEvent], (ctx, convert) => {
  if (convert.data === 9) {
    condition = true;
  }
  return convertStopEvent.with(convert.data);
});
```

### Human-in-the-Loop

Pause workflow, wait for human input, then resume:

```typescript
import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";
import { createStatefulMiddleware } from "@llamaindex/workflow-core/middleware/state";

const startEvent = workflowEvent<string>({ debugLabel: "start" });
const humanRequestEvent = workflowEvent<string>({ debugLabel: "humanRequest" });
const humanResponseEvent = workflowEvent<string>({ debugLabel: "humanResponse" });
const stopEvent = workflowEvent<string>({ debugLabel: "stop" });

const { withState } = createStatefulMiddleware();
const workflow = withState(createWorkflow());

// Main handler - may request human input
workflow.handle([startEvent], async (context, { data }) => {
  const { sendEvent } = context;
  // If we need human input, request it
  if (needsHumanInput(data)) {
    sendEvent(humanRequestEvent.with("What is your name?"));
    return; // Workflow pauses here
  }
  return stopEvent.with(`Processed: ${data}`);
});

// Human response handler - feeds input back to start
workflow.handle([humanResponseEvent], async (context, { data }) => {
  context.sendEvent(startEvent.with(data));
});

// Execute with stream event listener for human interaction
const ctx = workflow.createContext();
const { stream, sendEvent } = ctx;

stream.on(humanRequestEvent, async (event) => {
  console.log("Question:", JSON.parse(event.data).message);
  // In practice, collect input from user here
  const userInput = "Alice";
  sendEvent(humanResponseEvent.with(userInput));
});

sendEvent(startEvent.with("analyze this"));
await stream.until(stopEvent).toArray();
```

#### With snapshot/resume (for server-side HITL):

```typescript
// Start workflow
const ctx = workflow.createContext({ humanToolId: null });
ctx.sendEvent(startEvent.with("Hello"));

// When human input is needed, take a snapshot
ctx.stream.on(humanRequestEvent, async () => {
  const snapshotData = await ctx.snapshot();
  // Store snapshotData (e.g., in database, Redis, etc.)
  saveSnapshot(requestId, snapshotData);
});

// Later, when human responds:
const snapshotData = loadSnapshot(requestId);
const resumedCtx = workflow.resume(snapshotData);
resumedCtx.sendEvent(humanResponseEvent.with("User's answer"));
const result = await resumedCtx.stream.until(finalEvent).toArray();
```

---

## Error Handling and Retries

### AbortSignal for error detection

```typescript
workflow.handle([convertEvent], (context) => {
  const { signal } = context;
  signal.onabort = () => {
    console.error("Error in handler:", signal.reason);
  };
  // ... processing
});
```

### Automatic retries with p-retry

Install the optional dependency: `npm i p-retry`

```typescript
import { pRetryHandler } from "@llamaindex/workflow-core/util/p-retry";

workflow.handle(
  [startEvent],
  pRetryHandler(
    async (context, event) => {
      // This handler will be retried on failure
      const result = await unreliableApiCall(event.data);
      return stopEvent.with(result);
    },
    {
      retries: 3,
      onFailedAttempt: (error) => {
        console.log(`Attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`);
      },
    },
  ),
);
```

The `pRetryHandler` wraps any handler with [p-retry](https://github.com/sindresorhus/p-retry) options.

### Manual error handling in handlers

```typescript
workflow.handle([startEvent], async (context, event) => {
  try {
    const result = await riskyOperation(event.data);
    return successEvent.with(result);
  } catch (error) {
    return errorEvent.with({
      message: error instanceof Error ? error.message : "Unknown error",
      originalData: event.data,
    });
  }
});
```

---

## OpenAI Integration

Use the standard `openai` npm package directly in workflow handlers:

```typescript
import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";
import { OpenAI } from "openai";

const openai = new OpenAI(); // Uses OPENAI_API_KEY env var

const startEvent = workflowEvent<string>();
const stopEvent = workflowEvent<string>();

const workflow = createWorkflow();

workflow.handle([startEvent], async (context, event) => {
  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: event.data }],
  });
  return stopEvent.with(response.choices[0].message.content ?? "");
});

// Run
const { stream, sendEvent } = workflow.createContext();
sendEvent(startEvent.with("What is the capital of France?"));
const result = await stream.untilEvent(stopEvent);
console.log(result.data);
```

### Tool-calling agent with OpenAI

```typescript
import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";
import { OpenAI } from "openai";
import type {
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
} from "openai/resources/chat/completions/completions";

const llm = new OpenAI();

const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get the current weather",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "City name" },
        },
        required: ["location"],
      },
    },
  },
];

const startEvent = workflowEvent<string>();
const chatEvent = workflowEvent<string>();
const toolCallEvent = workflowEvent<ChatCompletionMessageToolCall>();
const toolCallResultEvent = workflowEvent<string>();
const stopEvent = workflowEvent<string>();

const workflow = createWorkflow();

workflow.handle([startEvent], async (context, { data }) => {
  context.sendEvent(chatEvent.with(data));
});

workflow.handle([toolCallEvent], async () => {
  // Execute tool (mock implementation)
  return toolCallResultEvent.with("Today is sunny, 72F.");
});

workflow.handle([chatEvent], async (context, { data }) => {
  const { choices } = await llm.chat.completions.create({
    model: "gpt-4-turbo",
    tools,
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: data },
    ],
  });

  const { sendEvent, stream } = context;
  const toolCalls = choices[0]?.message?.tool_calls;

  if (toolCalls && toolCalls.length > 0) {
    // Fan-out tool calls, collect results
    const result = (
      await Promise.all(
        toolCalls.map(async (toolCall) => {
          sendEvent(toolCallEvent.with(toolCall));
          return stream.until(toolCallResultEvent).toArray();
        }),
      )
    )
      .map((list) => list.at(-1))
      .filter((event) => event !== undefined)
      .map(({ data }) => data)
      .join("\n");

    // Feed results back to chat
    sendEvent(chatEvent.with(result));
  } else {
    return stopEvent.with(choices[0]?.message.content ?? "");
  }
});
```

---

## Server Integration

### Express

```typescript
import express from "express";
import { v4 as uuid } from "uuid";
import type { SnapshotData } from "@llamaindex/workflow-core/middleware/state";

const app = express();
app.use(express.json());

const snapshots = new Map<string, SnapshotData>();

app.post("/workflow/start", async (req, res) => {
  const requestId = uuid();
  const context = workflow.createContext({ messages: [] });

  context.stream.on(humanRequestEvent, async () => {
    const snapshotData = await context.snapshot();
    snapshots.set(requestId, snapshotData);
    res.json({
      type: "waiting_for_human",
      requestId,
      messages: context.state.messages,
    });
  });

  context.sendEvent(startEvent.with(req.body));
  await context.stream.until(finalEvent).toArray();
  res.json({ type: "completed", messages: context.state.messages });
});

app.post("/workflow/resume", async (req, res) => {
  const { requestId, userInput } = req.body;
  const snapshotData = snapshots.get(requestId);
  if (!snapshotData) {
    return res.status(404).json({ error: "Not found" });
  }

  const context = workflow.resume(snapshotData);
  context.sendEvent(humanResponseEvent.with(userInput));
  await context.stream.until(finalEvent).toArray();

  snapshots.delete(requestId);
  res.json({ type: "completed", messages: context.state.messages });
});

app.listen(3000);
```

### Hono

```typescript
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { createHonoHandler } from "@llamaindex/workflow-core/hono";

const app = new Hono();

app.post(
  "/workflow",
  createHonoHandler(
    workflow,
    async (ctx) => startEvent.with(await ctx.req.text()),
    stopEvent,
  ),
);

serve(app, ({ port }) => {
  console.log(`Server at http://localhost:${port}`);
});
```

### HTTP Response streaming

```typescript
// Server side: convert stream to HTTP response
const { stream, sendEvent } = workflow.createContext();
sendEvent(startEvent.with("input"));
const response = stream.toResponse();
// Return this Response object from your server handler

// Client side: reconstruct stream from HTTP response
const eventMap = {
  start: startEvent,
  stop: stopEvent,
};
const clientStream = WorkflowStream.fromResponse(response, eventMap);
for await (const event of clientStream) {
  console.log(event.data);
}
```

### RxJS interop

```typescript
import { from } from "rxjs";
import { filter } from "rxjs/operators";

const { stream, sendEvent } = workflow.createContext();

from(stream)
  .pipe(filter(ev => messageEvent.include(ev)))
  .subscribe(ev => {
    console.log(ev.data);
  });

sendEvent(startEvent.with("hello"));
```

---

## Agent Workflows (Higher-Level API)

The `@llamaindex/workflow` package provides a higher-level abstraction for building agent workflows with LlamaIndex.

### Single Agent

```typescript
import { tool } from "llamaindex";
import { agent } from "@llamaindex/workflow";
import { openai } from "@llamaindex/openai";

const weatherTool = tool(
  (params: { location: string }) => `Weather in ${params.location}: Sunny, 72F`,
  {
    name: "get_weather",
    description: "Get the weather for a location",
  },
);

const myAgent = agent({
  tools: [weatherTool],
  llm: openai({ model: "gpt-4o-mini" }),
});

const result = await myAgent.run("What's the weather in San Francisco?");
console.log(result);
```

### With structured output (Zod schema)

```typescript
import { z } from "zod";

const weatherSchema = z.object({
  temperature: z.number(),
  humidity: z.number(),
  windSpeed: z.number(),
});

const result = await weatherAgent.run("What's the weather in Tokyo?", {
  responseFormat: weatherSchema,
});
// result includes structured data matching the schema
```

### Event streaming from agents

```typescript
import { agentToolCallEvent } from "@llamaindex/workflow";

const events = myAgent.runStream("Tell me something funny");

for await (const event of events) {
  if (agentToolCallEvent.include(event)) {
    console.log(`Tool called: ${event.data.toolName}`);
  }
}
```

### Multi-Agent orchestration

```typescript
import { agent, multiAgent } from "@llamaindex/workflow";
import { openai } from "@llamaindex/openai";

const jokeAgent = agent({
  name: "JokeAgent",
  description: "Tells jokes and funny stories",
  tools: [jokeTool],
  llm: openai({ model: "gpt-4o-mini" }),
  canHandoffTo: [weatherAgent],
});

const weatherAgent = agent({
  name: "WeatherAgent",
  description: "Provides weather information",
  tools: [weatherTool],
  llm: openai({ model: "gpt-4o-mini" }),
});

const agents = multiAgent({
  agents: [jokeAgent, weatherAgent],
  rootAgent: jokeAgent,
});

const result = await agents.run("What's the weather like?");
```

---

## Visualization

Install: `npm i @llamaindex/workflow-viz`

```typescript
import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";
import { withDrawing } from "@llamaindex/workflow-viz";

// Use debugLabel for graph node names
const startEvent = workflowEvent<string>({ debugLabel: "start" });
const doneEvent = workflowEvent<string>({ debugLabel: "done" });

const workflow = withDrawing(createWorkflow());

workflow.handle([startEvent], (ctx, start) => {
  return doneEvent.with(`Hello ${start.data}`);
});

// Render in browser
const container = document.getElementById("app") as HTMLElement;
workflow.draw(container, {
  layout: "force",         // "force" (default) or "none"
  defaultEdgeColor: "#999",
  // Any Sigma.js renderer settings
});
```

The visualization uses [Sigma.js](https://github.com/jacomyal/sigma.js) under the hood. Register all handlers before calling `draw()`.

---

## Zod Event Validation

Use `zodEvent` for runtime data validation on events:

```typescript
import { zodEvent } from "@llamaindex/workflow-core/util/zod";
import { z } from "zod";

// Event with Zod schema validation (supports Zod v3 and v4)
const userEvent = zodEvent(
  z.object({
    name: z.string().min(1),
    email: z.string().email(),
    age: z.number().int().positive(),
  }),
  { debugLabel: "UserEvent" },
);

// This works
const valid = userEvent.with({ name: "Alice", email: "alice@example.com", age: 30 });

// This throws a Zod validation error at runtime
const invalid = userEvent.with({ name: "", email: "not-an-email", age: -1 });
```

The `zodEvent` has the same API as `workflowEvent` plus a `.schema` property:

```typescript
console.log(userEvent.schema); // The Zod schema used for validation
```

---

## OR Event Combinator

Handle multiple event types with the `or()` combinator:

```typescript
import { or, workflowEvent } from "@llamaindex/workflow-core";

const eventA = workflowEvent<string>();
const eventB = workflowEvent<number>();

// Create an OR event that matches either eventA or eventB
const eitherEvent = or(eventA, eventB);

// Handler fires when EITHER eventA OR eventB is received
workflow.handle([eitherEvent], (context, event) => {
  if (eventA.include(event)) {
    console.log("Got string:", event.data);
  } else if (eventB.include(event)) {
    console.log("Got number:", event.data);
  }
});
```

---

## Complete Working Examples

### Example 1: Joke Generation with Critique Loop

A workflow that generates a joke, critiques it, and iterates until quality is acceptable:

```typescript
import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";
import { createStatefulMiddleware } from "@llamaindex/workflow-core/middleware/state";
import { OpenAI } from "openai";

const llm = new OpenAI();

// Events
const startEvent = workflowEvent<string>();
const jokeEvent = workflowEvent<{ joke: string }>();
const critiqueEvent = workflowEvent<{ joke: string; critique: string }>();
const resultEvent = workflowEvent<{ joke: string; critique: string }>();

// State
const { withState } = createStatefulMiddleware(() => ({
  numIterations: 0,
  maxIterations: 3,
}));
const jokeFlow = withState(createWorkflow());

// Step 1: Generate a joke
jokeFlow.handle([startEvent], async (context, event) => {
  const prompt = `Write your best joke about ${event.data}.`;
  const response = await llm.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: prompt }],
  });
  return jokeEvent.with({ joke: response.choices[0].message.content ?? "" });
});

// Step 2: Critique the joke (loops or completes)
jokeFlow.handle([jokeEvent], async (context, event) => {
  const { state, sendEvent } = context;
  state.numIterations += 1;

  const prompt = `Rate this joke on a scale of 1-10 and explain why:\n"${event.data.joke}"`;
  const response = await llm.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: prompt }],
  });
  const critique = response.choices[0].message.content ?? "";

  if (state.numIterations >= state.maxIterations) {
    return resultEvent.with({ joke: event.data.joke, critique });
  }
  return critiqueEvent.with({ joke: event.data.joke, critique });
});

// Step 3: Improve the joke based on critique (loop back)
jokeFlow.handle([critiqueEvent], async (context, event) => {
  const prompt = `Improve this joke based on the critique:\nJoke: "${event.data.joke}"\nCritique: "${event.data.critique}"`;
  const response = await llm.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: prompt }],
  });
  return jokeEvent.with({ joke: response.choices[0].message.content ?? "" });
});

// Run
const { stream, sendEvent } = jokeFlow.createContext();
sendEvent(startEvent.with("pirates"));

const events = await stream.until(resultEvent).toArray();
const final = events.at(-1);
if (final && resultEvent.include(final)) {
  console.log("Final joke:", final.data.joke);
  console.log("Critique:", final.data.critique);
}
```

### Example 2: Branching Workflow with Fan-Out

```typescript
import { createWorkflow, workflowEvent } from "@llamaindex/workflow-core";

const startEvent = workflowEvent<string>();
const branchAEvent = workflowEvent<string>();
const branchBEvent = workflowEvent<string>();
const branchCEvent = workflowEvent<string>();
const branchCompleteEvent = workflowEvent<string>();
const allCompleteEvent = workflowEvent<string>();
const stopEvent = workflowEvent<string>();

const workflow = createWorkflow();

workflow.handle([startEvent], async (context) => {
  const { sendEvent, stream } = context;
  sendEvent(branchAEvent.with("Branch A"));
  sendEvent(branchBEvent.with("Branch B"));
  sendEvent(branchCEvent.with("Branch C"));

  const results = await stream.filter(branchCompleteEvent).take(3).toArray();
  return allCompleteEvent.with(results.map(e => e.data).join(", "));
});

workflow.handle([branchAEvent], (ctx, evt) => branchCompleteEvent.with(evt.data));
workflow.handle([branchBEvent], (ctx, evt) => branchCompleteEvent.with(evt.data));
workflow.handle([branchCEvent], (ctx, evt) => branchCompleteEvent.with(evt.data));
workflow.handle([allCompleteEvent], (ctx, evt) => stopEvent.with(evt.data));

const { stream, sendEvent } = workflow.createContext();
sendEvent(startEvent.with("initial data"));

const result = await stream.untilEvent(stopEvent);
console.log(`Result: ${result.data}`); // Result: Branch A, Branch B, Branch C
```

---

## API Reference Summary

### `@llamaindex/workflow-core` exports

| Export | Description |
|--------|-------------|
| `workflowEvent<Data>(config?)` | Create a new event type |
| `createWorkflow()` | Create a new workflow |
| `or(...events)` | Combine events with OR logic |
| `isWorkflowEvent(value)` | Type guard for workflow events |
| `isWorkflowEventData(value)` | Type guard for event data |
| `eventSource(eventData)` | Get the event type that created an event data instance |
| `getContext()` | **Deprecated** - Get current workflow context (use handler parameter instead) |

### `@llamaindex/workflow-core/middleware/state` exports

| Export | Description |
|--------|-------------|
| `createStatefulMiddleware(init?)` | Create state middleware |
| `SnapshotData` | Type for serialized workflow state |

### `@llamaindex/workflow-core/middleware/validation` exports

| Export | Description |
|--------|-------------|
| `withValidation(workflow, rules)` | Add event transition validation |

### `@llamaindex/workflow-core/middleware/trace-events` exports

| Export | Description |
|--------|-------------|
| `withTraceEvents(workflow)` | Add tracing capabilities |
| `runOnce(handler)` | Handler decorator that runs only once per context |
| `createHandlerDecorator(config)` | Create custom handler decorators |

### `@llamaindex/workflow-core/stream/run` exports

| Export | Description |
|--------|-------------|
| `run(workflow, events)` | Run workflow, return stream |
| `runWorkflow(workflow, input, output)` | Run and get final event *(deprecated)* |
| `runAndCollect(workflow, input, output)` | Run and collect all events *(deprecated)* |
| `runStream(workflow, input, output)` | Run and get async iterable *(deprecated)* |

### `@llamaindex/workflow-core/util/p-retry` exports

| Export | Description |
|--------|-------------|
| `pRetryHandler(handler, options)` | Wrap handler with retry logic |

### `@llamaindex/workflow-core/util/zod` exports

| Export | Description |
|--------|-------------|
| `zodEvent(schema, config?)` | Create event with Zod validation |

### `@llamaindex/workflow` re-exports

Everything from `@llamaindex/workflow-core` plus:
- `@llamaindex/workflow-core/middleware/state`
- `@llamaindex/workflow-core/stream/run`
- `zodEvent` from `@llamaindex/workflow-core/util/zod`
- Agent API: `agent()`, `multiAgent()`, agent events, etc.

---

## Gotchas and Notes

1. **Handler signature**: The first parameter is always `context`, followed by event data. The older `getContext()` function is deprecated.

   ```typescript
   // Correct (current API)
   workflow.handle([event], (context, eventData) => { ... });

   // Deprecated
   workflow.handle([event], (eventData) => {
     const context = getContext(); // Don't do this
   });
   ```

2. **Returning vs sending events**: Both `return eventType.with(data)` and `context.sendEvent(eventType.with(data))` emit events. Use `return` for single events; use `sendEvent` when emitting multiple events or sending mid-handler.

3. **Multi-event handlers**: When a handler is registered with `[eventA, eventB]`, it waits for BOTH events to be in the queue before firing. This is AND semantics. For OR semantics, use the `or()` combinator.

4. **Stream must be consumed**: If you create a context but never consume the stream, handlers may not execute properly. Always iterate or call `.toArray()`.

5. **Breaking out of for-await**: When using `for await (const event of stream)`, you MUST `break` when done, otherwise the loop runs forever.

6. **Snapshot freezes the context**: After calling `snapshot()`, no more events can be sent on that context. Use `resume()` to create a new context from the snapshot.

7. **Package deprecation**: Both `@llamaindex/workflow` and `@llamaindex/workflow-core` have deprecation notices in their package.json files pointing to Python LlamaAgents. However, as of early-mid 2026 they were still receiving updates. Evaluate the current status before starting a new project.

8. **No `@step()` decorator pattern**: Unlike the Python LlamaIndex Workflows, the TypeScript version does NOT use decorators or class-based workflows. It uses a functional API with `createWorkflow()` and `workflow.handle()`.

9. **State mutation**: Unlike typical immutable patterns, the state middleware (`withState`) uses direct mutation: `state.counter += 1`. This is by design for the workflow engine.

10. **Event `uniqueId` and serialization**: Events auto-generate unique IDs. For HTTP/network transport, use `debugLabel` or `uniqueId` config to create stable identifiers that survive serialization.

11. **Middleware composition**: Middleware wraps workflows. Apply them in order: `withState(withValidation(createWorkflow()))`. Each middleware extends the context with new properties.

12. **Supported runtimes**: Works in Node.js, Deno, Bun, Cloudflare Workers, and browsers. The core package has separate browser/node builds.
