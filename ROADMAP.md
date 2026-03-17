# ROADMAP.md

## High Priority (OS Foundation — DEC-003)

- [x] Define core interfaces for `EpisodicMemory` and `SemanticMemory`. (Done in `types.ts`)
- [x] Define `CognitiveEvent` type (unified event format for the bus). (Done in `types.ts`, PR #10)
- [x] Define `CognitiveRegistry` interface (register/discover capabilities). (Done in `types.ts`, PR #10)
- [x] Define `CognitiveBus` interface (emit/subscribe events). (Done in `types.ts`, PR #10)
- [x] Refactor `KnowledgeDistiller` reference-implementation as a registered processor (listens for `episodes.batch`, emits `fact.created`). (Done: `DistillerModule` + `ReferenceCognitiveBus`)
- [x] Implement `CognitiveRegistry` reference (register/init/discover modules). (Done: `ReferenceCognitiveRegistry` + tests)

## High Priority (Cognitive Modules)

- [x] Implement `KnowledgeDistiller` (The "Agent Dream" loop). (Done in `reference-implementation`)
- [x] Bootstrap the reference agent: **Ami**. (Done: `Ami` class + demo + capability-based architecture)

## Medium Priority

- [ ] `ContextManager` implementation (attention/relevance filtering). *(In PR #14 - waiting for review)*
- [x] `CapabilitiesManager` for tool pre-selection.
- [ ] Define Sensor and Actuator capability contracts.
