# ROADMAP.md

## High Priority (OS Foundation — DEC-003)

- [x] Define core interfaces for `EpisodicMemory` and `SemanticMemory`. (Done in `types.ts`)
- [ ] Define `CognitiveEvent` type (unified event format for the bus).
- [ ] Define `CognitiveRegistry` interface (register/discover capabilities).
- [ ] Define `CognitiveBus` interface (emit/subscribe events).
- [ ] Refactor `KnowledgeDistiller` reference-implementation as a registered processor (listens for `episodes.batch`, emits `fact.created`).

## High Priority (Cognitive Modules)

- [x] Implement `KnowledgeDistiller` (The "Agent Dream" loop). (Done in `reference-implementation`)
- [ ] Bootstrap the reference agent: **Ami**.

## Medium Priority

- [ ] `ContextManager` implementation (attention/relevance filtering).
- [ ] `CapabilitiesManager` for tool pre-selection.
- [ ] Define Sensor and Actuator capability contracts.
