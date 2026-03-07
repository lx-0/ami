/**
 * PatternExtractionStrategy — A rule-based fact extractor.
 *
 * Uses linguistic patterns to identify factual statements in messages.
 * This is a baseline strategy: simple, fast, no external dependencies.
 * For production use, combine with or replace by an LLM-based strategy.
 *
 * Recognized patterns:
 *   - Declarative statements ("X is Y", "X are Y")
 *   - Definitions ("X means Y", "X refers to Y")
 *   - Preferences ("I prefer X", "I like X", "I want X")
 *   - Decisions ("We decided to X", "The plan is X")
 *   - Corrections ("Actually, X", "No, X")
 */

import type { Message } from '@ami/skeleton';
import type { ExtractionStrategy, FactCandidate } from '../knowledge-distiller.js';

interface PatternRule {
    /** Regex to match against a sentence */
    pattern: RegExp;
    /** Confidence boost for matches (0..1) */
    confidence: number;
    /** Optional metadata tag */
    tag?: string;
}

const DEFAULT_RULES: PatternRule[] = [
    // Corrections first (high confidence — explicit knowledge update)
    {
        pattern: /\b(?:actually|no|correction|wrong),?\s+(.+)/i,
        confidence: 0.8,
        tag: 'correction',
    },
    // Decisions
    {
        pattern: /\b(?:we|I)\s+(?:decided|agreed|chose|will)\s+(?:to\s+)?(.+)/i,
        confidence: 0.7,
        tag: 'decision',
    },
    // Definitions
    {
        pattern: /\b(\w[\w\s]+?)\s+(?:means|refers to|stands for)\s+(.+)/i,
        confidence: 0.7,
        tag: 'definition',
    },
    // Preferences
    {
        pattern: /\bI\s+(?:prefer|like|want|need|love|hate|dislike)\s+(.+)/i,
        confidence: 0.6,
        tag: 'preference',
    },
    // Instructions and rules
    {
        pattern: /\b(?:always|never|must|should|rule:?)\s+(.+)/i,
        confidence: 0.6,
        tag: 'rule',
    },
    // Declarations (broadest, lowest priority)
    {
        pattern: /\b(\w[\w\s]+?)\s+(?:is|are|was|were)\s+(?:a|an|the)?\s*(.+)/i,
        confidence: 0.5,
        tag: 'declaration',
    },
];

export class PatternExtractionStrategy implements ExtractionStrategy {
    private readonly rules: PatternRule[];

    constructor(customRules?: PatternRule[]) {
        this.rules = customRules ?? DEFAULT_RULES;
    }

    async extract(messages: Message[]): Promise<FactCandidate[]> {
        const candidates: FactCandidate[] = [];

        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            const sentences = this.splitSentences(msg.content);

            for (const sentence of sentences) {
                if (sentence.length < 10) continue; // skip trivial fragments

                for (const rule of this.rules) {
                    if (rule.pattern.test(sentence)) {
                        candidates.push({
                            text: sentence.trim(),
                            sourceMessageIndex: i,
                            confidence: rule.confidence,
                            metadata: rule.tag ? { tag: rule.tag } : undefined,
                        });
                        break; // one match per sentence to avoid duplicates
                    }
                }
            }
        }

        return candidates;
    }

    private splitSentences(text: string): string[] {
        // Simple sentence splitter: split on . ! ? followed by space or end
        return text
            .split(/(?<=[.!?])\s+/)
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
    }
}
