# ROADMAP.md

## High Priority (OS Foundation — DEC-003)

- [x] Define core interfaces for `EpisodicMemory` and `SemanticMemory`. (Done in `types.ts`)
- [x] Define `CognitiveEvent` type (unified event format for the bus). (Done in `types.ts`, PR #10)
- [x] Define `CognitiveRegistry` interface (register/discover capabilities). (Done in `types.ts`, PR #10)
- [x] Define `CognitiveBus` interface (emit/subscribe events). (Done in `types.ts`, PR #10)
- [x] Refactor `KnowledgeDistiller` reference-implementation as a registered processor (listens for `episodes.batch`, emits `fact.created`). (Done: `DistillerModule` + `ReferenceCognitiveBus`)
- [ ] Implement `CognitiveRegistry` reference (register/init/discover modules).

## High Priority (Cognitive Modules)

- [x] Implement `KnowledgeDistiller` (The "Agent Dream" loop). (Done in `reference-implementation`)
- [ ] Bootstrap the reference agent: **Ami**.

## Medium Priority

- [ ] `ContextManager` implementation (attention/relevance filtering).
- [ ] `CapabilitiesManager` for tool pre-selection.
- [ ] Define Sensor and Actuator capability contracts.
