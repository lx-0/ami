/**
 * KnowledgeDistiller — The "Agent Dream" Loop.
 *
 * Processes episodic memory (recent conversation messages) and distills them
 * into semantic facts for long-term storage. This mirrors the biological
 * process of memory consolidation during sleep/rest.
 *
 * The distiller is model-agnostic: it accepts an ExtractionStrategy that
 * defines HOW facts are extracted from text. This allows plugging in
 * rule-based, LLM-based, or hybrid extractors.
 */

import type { KnowledgeDistiller, Message, Fact } from '@ami/skeleton';

/**
 * Strategy for extracting facts from message content.
 * Implement this to plug in your own extraction logic (rules, LLM, hybrid).
 */
export interface ExtractionStrategy {
    /**
     * Extract candidate facts from a batch of messages.
     * Each returned FactCandidate may be merged, deduplicated, or discarded
     * by the distiller's pipeline.
     */
    extract(messages: Message[]): Promise<FactCandidate[]>;
}

/**
 * A candidate fact before final processing (dedup, relation linking).
 */
export interface FactCandidate {
    text: string;
    sourceMessageIndex: number;
    confidence: number; // 0..1
    relations?: string[];
    metadata?: Record<string, unknown>;
}

/**
 * Configuration for the distiller pipeline.
 */
export interface DistillerConfig {
    /** Minimum confidence threshold to keep a fact (default: 0.3) */
    minConfidence?: number;
    /** Maximum facts to emit per distillation run (default: 20) */
    maxFacts?: number;
    /** Custom ID generator (default: timestamp + index) */
    idGenerator?: () => string;
}

const DEFAULT_CONFIG: Required<DistillerConfig> = {
    minConfidence: 0.3,
    maxFacts: 20,
    idGenerator: () => `fact_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
};

/**
 * Reference implementation of the KnowledgeDistiller interface.
 *
 * Pipeline:
 *   1. Filter — remove system messages and empty content
 *   2. Extract — delegate to the ExtractionStrategy
 *   3. Threshold — drop candidates below minConfidence
 *   4. Deduplicate — merge candidates with identical normalized text
 *   5. Limit — cap output to maxFacts (highest confidence first)
 *   6. Finalize — assign IDs, timestamps, and build Fact objects
 */
export class ReferenceKnowledgeDistiller implements KnowledgeDistiller {
    private readonly strategy: ExtractionStrategy;
    private readonly config: Required<DistillerConfig>;

    constructor(strategy: ExtractionStrategy, config?: DistillerConfig) {
        this.strategy = strategy;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    async distill(episodes: Message[]): Promise<Fact[]> {
        // Step 1: Filter
        const meaningful = episodes.filter(
            (m) => m.role !== 'system' && m.content.trim().length > 0
        );

        if (meaningful.length === 0) {
            return [];
        }

        // Step 2: Extract
        const candidates = await this.strategy.extract(meaningful);

        // Step 3: Threshold
        const aboveThreshold = candidates.filter(
            (c) => c.confidence >= this.config.minConfidence
        );

        // Step 4: Deduplicate
        const deduped = this.deduplicate(aboveThreshold);

        // Step 5: Limit (sort by confidence desc, then cap)
        const sorted = deduped.sort((a, b) => b.confidence - a.confidence);
        const limited = sorted.slice(0, this.config.maxFacts);

        // Step 6: Finalize
        return limited.map((candidate) => this.toFact(candidate, meaningful));
    }

    /**
     * Merge candidates with identical normalized text.
     * Keeps the highest confidence and merges relations.
     */
    private deduplicate(candidates: FactCandidate[]): FactCandidate[] {
        const seen = new Map<string, FactCandidate>();

        for (const c of candidates) {
            const key = this.normalize(c.text);
            const existing = seen.get(key);

            if (existing) {
                // Merge: keep higher confidence, union relations
                existing.confidence = Math.max(existing.confidence, c.confidence);
                if (c.relations) {
                    existing.relations = [
                        ...new Set([...(existing.relations ?? []), ...c.relations]),
                    ];
                }
            } else {
                seen.set(key, { ...c });
            }
        }

        return [...seen.values()];
    }

    private normalize(text: string): string {
        return text.toLowerCase().trim().replace(/\s+/g, ' ');
    }

    private toFact(candidate: FactCandidate, sourceMessages: Message[]): Fact {
        const sourceMessage = sourceMessages[candidate.sourceMessageIndex];
        return {
            id: this.config.idGenerator(),
            text: candidate.text,
            relations: candidate.relations ?? [],
            sourceEpisodeId: sourceMessage
                ? `episode_${sourceMessage.timestamp}`
                : undefined,
            timestamp: Date.now(),
            metadata: {
                confidence: candidate.confidence,
                ...candidate.metadata,
            },
        };
    }
}
