/**
 * Core interfaces for the Agent Mind Interface (ami).
 * This file defines the agnostic cognitive skeleton.
 */

export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

/**
 * Episodic Memory: The short-term "sliding window" of experiences.
 */
export interface EpisodicMemory {
    getRecentContext(limit?: number): Promise<Message[]>;
    storeEpisode(message: Message): Promise<void>;
    clear(): Promise<void>;
}

/**
 * Semantic Memory: Long-term fact storage.
 */
export interface SemanticMemory {
    query(query: string, limit?: number): Promise<SearchResult[]>;
    storeFact(fact: Fact): Promise<void>;
    forget(factId: string): Promise<void>;
}

export interface SearchResult {
    fact: Fact;
    score: number;
}

export interface Fact {
    id: string;
    text: string;
    relations: string[]; // IDs of related facts
    sourceEpisodeId?: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

/**
 * Knowledge Distiller: The process of moving info from episodic to semantic.
 * This is the "Agent Dream" loop.
 */
export interface KnowledgeDistiller {
    distill(episodes: Message[]): Promise<Fact[]>;
}

// ─── Cognitive OS Architecture (DEC-003) ───────────────────────────────────

/**
 * Unified event flowing through the CognitiveBus.
 * All inter-module communication happens through events.
 *
 * Naming convention: "domain.action" — e.g., "perception.audio", "fact.created"
 */
export interface CognitiveEvent<T = unknown> {
    /** Event type, dot-namespaced */
    type: string;
    /** Event payload */
    payload: T;
    /** ISO timestamp */
    timestamp: string;
    /** Module that emitted this event */
    source?: string;
}

/**
 * Well-known event types in the cognitive system.
 */
export type CognitiveEventType =
    | 'perception.audio'       // Raw audio input captured
    | 'perception.vision'      // Visual input captured
    | 'perception.text'        // Text input received
    | 'episodes.batch'         // Batch of episodes ready for distillation
    | 'fact.created'           // New fact distilled from episodes
    | 'fact.updated'           // Existing fact modified
    | 'fact.forgotten'         // Fact removed
    | 'action.tts'             // Request TTS output
    | 'action.display'         // Request display output
    | 'action.notify'          // Request notification
    | 'context.changed'        // Attention/context window shifted
    | 'module.ready'           // A module completed initialization
    | 'module.degraded'        // A module is partially functional
    | 'module.unavailable';    // A module failed

/**
 * Handler for bus events.
 */
export type CognitiveEventHandler<T = unknown> = (event: CognitiveEvent<T>) => void | Promise<void>;

/**
 * Central event bus — the nervous system.
 * No module calls another directly. All communication is event-driven.
 *
 * Axiom 5: "Infrastruktur vor Intelligenz" — the bus exists before any cognitive module.
 *
 * @see DEC-003
 */
export interface CognitiveBus {
    /** Emit an event to all subscribers */
    emit<T>(type: string, payload: T): void;

    /** Subscribe to events matching a type */
    on<T>(type: string, handler: CognitiveEventHandler<T>): void;

    /** Unsubscribe a handler */
    off<T>(type: string, handler: CognitiveEventHandler<T>): void;

    /** Subscribe once, auto-unsubscribe after first match */
    once<T>(type: string, handler: CognitiveEventHandler<T>): void;
}

/**
 * Capability categories for cognitive modules.
 */
export type CognitiveCapability =
    | 'sensor'       // Input: audio, vision, text
    | 'processor'    // Transform: distillation, context, reasoning
    | 'actuator'     // Output: TTS, display, notification
    | 'memory';      // Storage: episodic, semantic

/**
 * A cognitive module — the atomic unit of the mind.
 *
 * Sensors perceive, Processors transform, Actuators act, Memory stores.
 * All register capabilities and communicate only through the bus.
 */
export interface CognitiveModule {
    /** Unique module identifier */
    readonly id: string;

    /** Human-readable name */
    readonly name: string;

    /** What this module provides */
    readonly capabilities: CognitiveCapability[];

    /** Current module status */
    status: 'registered' | 'initializing' | 'ready' | 'degraded' | 'stopped' | 'error';

    /** Initialize with bus access */
    init(bus: CognitiveBus, config: Record<string, unknown>): Promise<void>;

    /** Graceful shutdown */
    destroy(): Promise<void>;
}

/**
 * Registry — the brain stem. Knows what capabilities exist and who provides them.
 *
 * Graceful degradation: if a module fails, the capability is simply absent.
 * No crashes, no hard dependencies.
 *
 * @see DEC-003
 */
export interface CognitiveRegistry {
    /** Register a module */
    register(module: CognitiveModule): void;

    /** Initialize all registered modules */
    initAll(config: Record<string, unknown>): Promise<void>;

    /** Destroy all modules */
    destroyAll(): Promise<void>;

    /** Get a module by ID */
    getModule(id: string): CognitiveModule | undefined;

    /** Get all modules providing a capability */
    getProviders(capability: CognitiveCapability): CognitiveModule[];

    /** Check if a capability is available */
    hasCapability(capability: CognitiveCapability): boolean;
}

/**
 * Cognitive Loop: The OODA loop (Observe, Orient, Decide, Act).
 * Orchestrates the flow: Sensors → Processors → Actuators.
 */
export interface CognitiveLoop {
    step(): Promise<void>;
}
