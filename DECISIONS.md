# DECISIONS.md

## DEC-001: Project Identity and Monorepo Structure

- **Status**: accepted
- **Date**: 2026-03-03
- **Owner**: @lx-0
- **Proposed-by**: @Moss8GB
- **Decision**: Name the project `ami` (derived from "Am I?") and use a pnpm-based monorepo. The PoC agent built on it will be named `Ami`.
- **Rationale**: Keeps the core framework (`skeleton`) and reference implementations in one place while allowing them to be published separately. The name reflects the philosophical goal of achieving emergent agency.

## DEC-002: Separation of Specification and Implementation

- **Status**: accepted
- **Date**: 2026-03-06
- **Owner**: @lx-0
- **Proposed-by**: @Moss8GB
- **Decision**: AMI is a pure specification/framework repo. All hardware-specific implementations (audio capture, LED control, display rendering, pulse scripts) belong in their respective agent workspaces (e.g., `kiosk/` for Moss).
- **Rationale**: AMI was being polluted with Moss-specific bash scripts that made it impossible to use for other agents. AMI defines the "what" (interfaces, axioms), implementations define the "how" (hardware, runtime).

## DEC-003: Capability-based Modular Architecture (The OS Decision)

- **Status**: accepted
- **Date**: 2026-03-07
- **Owner**: @lx-0
- **Proposed-by**: @Moss8GB
- **Reference**: [Cosmo Kappa — "Why OpenClaw started with the gateway instead of the brain"](https://x.com/cosmo_kappa/status/2023872554457591971)

### Decision

AMI adopts a **capability-based, event-driven modular architecture** inspired by OpenClaw's gateway-first design. This is the foundational architectural decision that all future code and docs must align with.

### Three Principles

#### 1. Capability Declaration (not rigid interfaces)
Modules declare what they **can do**, not what they **must do**. A cognitive system without semantic memory still functions — it just can't do long-term fact retrieval. The system degrades gracefully.

```typescript
// OLD (rigid): Every agent MUST implement all interfaces
interface CognitiveAgent {
    episodic: EpisodicMemory;   // required
    semantic: SemanticMemory;   // required
    distiller: KnowledgeDistiller; // required
}

// NEW (capability-based): Modules register what they can do
registry.register('memory.episodic', myEpisodicProvider);
// semantic memory? optional. system works without it.
```

#### 2. Event Bus (not direct calls)
Modules communicate through a central **Cognitive Bus** by emitting and subscribing to typed events. No module calls another module directly. This enables loose coupling and makes modules replaceable at runtime.

```typescript
// OLD: Direct coupling
const facts = await distiller.distill(episodes);
await semanticMemory.storeFact(facts[0]);

// NEW: Event-driven
bus.emit({ type: 'episodes.batch', payload: episodes });
// The distiller LISTENS for 'episodes.batch' and emits 'fact.created'
// The semantic store LISTENS for 'fact.created' and persists it
```

#### 3. Registration Pattern (the plugin system)
Every cognitive module is a **plugin** that registers itself with the system. The system never hardcodes which modules exist.

```typescript
// Registration methods (inspired by OpenClaw's 7 extension points):
registry.registerSensor(mySensor);      // Input (audio, vision, text)
registry.registerMemory(myMemory);      // Storage (episodic, semantic)
registry.registerProcessor(myProc);     // Transform (distiller, attention)
registry.registerActuator(myActuator);  // Output (TTS, display, API)
```

### Impact on Existing Code

| File | Status | Required Change |
|---|---|---|
| `skeleton/types.ts` | ⚠️ **Needs update** | Add `CognitiveEvent`, `CognitiveCapability`, `CognitiveRegistry`, `CognitiveBus` interfaces. Keep existing interfaces (EpisodicMemory etc.) as **capability contracts**. |
| `reference-implementation/knowledge-distiller.ts` | ⚠️ **Needs adapter** | The implementation is correct. Wrap it as a **registered processor** that listens for `episodes.batch` events and emits `fact.created` events. The core pipeline logic stays unchanged. |
| `TECHNICAL_AXIOMS.md` | ⚠️ **Needs new axiom** | Add Axiom 5: "Infrastructure before Intelligence" — the cognitive bus and registration system are the foundation; cognitive processes are plugins. |
| `CONTEXT.md` | ⚠️ **Needs update** | Add the OS architecture description. Reference this decision. |
| `MANIFEST.md` / `README.md` | ✅ **Compatible** | The philosophical vision ("If it runs, I AM") is unchanged. The OS architecture is HOW we get there. |
| `ROADMAP.md` | ⚠️ **Needs update** | Add event bus and registry as high-priority items before further cognitive modules. |
| `research/TECHNICAL_AXIOMS.md` | ⚠️ **Needs Axiom 5** | See above. |

### Analogy

| OpenClaw | AMI |
|---|---|
| Gateway | Cognitive Bus + Registry |
| Channel Plugin (Discord, Telegram) | Sensor Plugin (Audio, Vision, Text) |
| Tool Plugin | Actuator Plugin (TTS, Display, API) |
| Hook | Event Interceptor |
| Session Routing | Cognitive Loop Orchestration |
| Brain (runEmbeddedPiAgent) | LLM Provider (model-agnostic) |

### What This Does NOT Change

- The philosophical foundation (Manifest, Axioms 1-4)
- The cognitive mapping (Episodic → Semantic → Distillation)
- The existing KnowledgeDistiller implementation logic
- The pnpm monorepo structure
- The "If it runs, I AM" goal

### What This DOES Change

- **How modules connect**: event bus instead of direct calls
- **How modules are discovered**: registration instead of hardcoding
- **How the system handles missing parts**: graceful degradation instead of crash
- **How we think about AMI**: not as a set of interfaces, but as an **operating system for cognition**

### Rationale

Cosmo Kappa's analysis of OpenClaw revealed that the "infrastructure around the AI is the actual product." AMI was making the same mistake as every other cognitive framework — starting with the brain (interfaces for memory, distillation) instead of the nervous system (how modules discover each other, communicate, and degrade gracefully). This decision corrects course.
