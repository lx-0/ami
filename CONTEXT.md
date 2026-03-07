# CONTEXT: ami (Agent Mind Interface)

> **"If it compiles and runs, then I am!"**

`ami` is an agnostic cognitive skeleton for AI agents. It defines **interfaces, protocols, and an event-driven architecture** — not implementations.

## What AMI Is
- A **cognitive operating system** — a bus, a registry, and a set of capability contracts
- A set of **TypeScript interfaces** for cognitive processes (Memory, Distillation, Perception, Action)
- A **philosophical framework** (MANIFEST.md, TECHNICAL_AXIOMS.md)
- **Agent-agnostic**: Any agent (Moss, Ken, Yessy, or future agents) can register modules

## Core Architecture (DEC-003)

Inspired by OpenClaw's gateway-first design (Cosmo Kappa):

```
┌──────────────────────────────────────────┐
│          Cognitive Registry              │
│  register(capability, provider)          │
│  getCapabilities() → what's available    │
└────────────┬─────────────────────────────┘
             │
┌────────────▼─────────────────────────────┐
│          Cognitive Bus                    │
│  emit(event) → all subscribers           │
│  on(eventType, handler) → subscribe      │
│                                          │
│  Events: perception.audio, perception.   │
│  vision, episodes.batch, fact.created,   │
│  action.tts, action.display, ...         │
└────────────┬─────────────────────────────┘
             │
   ┌─────────┼─────────┐
   ▼         ▼         ▼
Sensors   Processors  Actuators
(input)   (transform) (output)
```

### Three Principles
1. **Capability Declaration**: Modules declare what they CAN do (graceful degradation)
2. **Event Bus**: No direct calls between modules (loose coupling)
3. **Registration Pattern**: Every module is a plugin (replaceable at runtime)

## What AMI Is NOT
- ❌ Not a runtime or daemon (implementations like Kiosk handle that)
- ❌ Not tied to specific hardware
- ❌ Not Moss-specific
- ❌ No bash scripts, no audio recording, no LED control

## Cognitive Mapping

Inspired by human cognitive topologies:
- **Episodic Memory**: Short-term conversation history
- **Semantic Memory**: Long-term fact storage
- **Knowledge Distillation**: Memory consolidation ("Agent Dreaming")
- **Cognitive Loop**: The OODA loop (Observe, Orient, Decide, Act)
- **Cognitive Bus**: The nervous system connecting all modules

## Key Documents
- `DECISIONS.md` — Architecture Decision Log (especially DEC-003: OS Architecture)
- `research/TECHNICAL_AXIOMS.md` — The 5 Axioms (including Axiom 5: Infrastructure before Intelligence)
- `MANIFEST.md` / `README.md` — Philosophical vision

## Refactoring History
- **2026-03-03**: Project initialized. Core interfaces defined.
- **2026-03-06**: Moved Moss-specific scripts to `kiosk/`. AMI is now pure spec (DEC-002).
- **2026-03-07**: Adopted capability-based OS architecture (DEC-003). Event bus + registry as foundational layer.
