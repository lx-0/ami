/**
 * Reference ContextManager implementation.
 * 
 * The ContextManager handles attention and relevance filtering in the cognitive system.
 * It maintains a sliding window of relevant context based on recency, importance,
 * and semantic similarity.
 * 
 * Key responsibilities:
 * - Filter incoming perceptions by relevance
 * - Maintain focused attention window
 * - Emit context.changed events when focus shifts
 * 
 * @see ROADMAP.md — "ContextManager implementation"
 */

import type { Message, Fact, SearchResult } from '@ami/skeleton';

export interface ContextWindow {
    /** Recent messages in the attention window */
    recentMessages: Message[];
    /** Relevant facts from semantic memory */
    relevantFacts: Fact[];
    /** Current attention topic/theme */
    focusTopic?: string;
    /** Timestamp of last context update */
    lastUpdated: number;
}

export interface RelevanceScore {
    /** The message or fact being scored */
    item: Message | Fact;
    /** Relevance score 0.0-1.0 */
    score: number;
    /** Why this item is relevant */
    reasons: string[];
}

export interface ContextManagerConfig {
    /** Maximum messages to keep in attention window */
    maxMessages?: number;
    /** Maximum facts to keep in context */
    maxFacts?: number;
    /** Minimum relevance score to include (0.0-1.0) */
    relevanceThreshold?: number;
    /** Window of recency in milliseconds */
    recencyWindow?: number;
}

export class ReferenceContextManager {
    private readonly config: Required<ContextManagerConfig>;
    private currentContext: ContextWindow;

    constructor(config: ContextManagerConfig = {}) {
        this.config = {
            maxMessages: config.maxMessages ?? 20,
            maxFacts: config.maxFacts ?? 10,
            relevanceThreshold: config.relevanceThreshold ?? 0.3,
            recencyWindow: config.recencyWindow ?? 300000, // 5 minutes
        };

        this.currentContext = {
            recentMessages: [],
            relevantFacts: [],
            lastUpdated: Date.now(),
        };
    }

    /**
     * Update context with new messages and facts.
     * Returns true if context changed significantly.
     */
    async updateContext(
        newMessages: Message[],
        availableFacts?: Fact[]
    ): Promise<{ contextChanged: boolean; context: ContextWindow }> {
        const now = Date.now();
        const previousTopic = this.currentContext.focusTopic;

        // Filter messages by recency and relevance
        const allMessages = [...this.currentContext.recentMessages, ...newMessages];
        const recentMessages = this.filterByRecency(allMessages, now);
        const relevantMessages = this.filterByRelevance(recentMessages);

        // Extract current topic/focus from recent messages
        const focusTopic = this.extractFocusTopic(relevantMessages);

        // Filter facts by relevance to current focus
        let relevantFacts: Fact[] = [];
        if (availableFacts && availableFacts.length > 0) {
            relevantFacts = this.filterFactsByRelevance(availableFacts, focusTopic);
        } else {
            // Keep existing facts if no new ones provided
            relevantFacts = this.currentContext.relevantFacts;
        }

        // Update context
        this.currentContext = {
            recentMessages: relevantMessages.slice(-this.config.maxMessages),
            relevantFacts: relevantFacts.slice(0, this.config.maxFacts),
            focusTopic,
            lastUpdated: now,
        };

        // Determine if context changed significantly
        const contextChanged = 
            previousTopic !== focusTopic ||
            newMessages.length > 0 ||
            Boolean(availableFacts && availableFacts.length > 0);

        return {
            contextChanged,
            context: { ...this.currentContext }
        };
    }

    /**
     * Get the current context window.
     */
    getCurrentContext(): ContextWindow {
        return { ...this.currentContext };
    }

    /**
     * Calculate relevance score for a message or fact.
     */
    calculateRelevance(item: Message | Fact, focusTopic?: string): RelevanceScore {
        const reasons: string[] = [];
        let score = 0;

        // Base recency score
        const age = Date.now() - item.timestamp;
        const recencyScore = Math.max(0, 1 - age / this.config.recencyWindow);
        if (recencyScore > 0.7) {
            reasons.push('very recent');
            score += 0.3;
        } else if (recencyScore > 0.3) {
            reasons.push('recent');
            score += 0.2;
        }

        // Content-based relevance
        const content = 'content' in item ? item.content : item.text;
        const contentScore = this.scoreContentRelevance(content, focusTopic);
        score += contentScore.score;
        reasons.push(...contentScore.reasons);

        // Message-specific scoring
        if ('role' in item) {
            // User messages are inherently important
            if (item.role === 'user') {
                score += 0.2;
                reasons.push('user input');
            }
            // Questions are important
            if (content.includes('?')) {
                score += 0.15;
                reasons.push('question');
            }
        }

        // Fact-specific scoring
        if ('relations' in item) {
            // Facts with more relations are more central
            if (item.relations.length > 2) {
                score += 0.1;
                reasons.push('well-connected');
            }
        }

        return {
            item,
            score: Math.min(1.0, score),
            reasons
        };
    }

    private filterByRecency(messages: Message[], now: number): Message[] {
        return messages.filter(msg => 
            now - msg.timestamp <= this.config.recencyWindow
        );
    }

    private filterByRelevance(messages: Message[]): Message[] {
        const focusTopic = this.extractFocusTopic(messages);
        
        return messages
            .map(msg => this.calculateRelevance(msg, focusTopic))
            .filter(scored => scored.score >= this.config.relevanceThreshold)
            .sort((a, b) => b.score - a.score)
            .map(scored => scored.item as Message);
    }

    private filterFactsByRelevance(facts: Fact[], focusTopic?: string): Fact[] {
        return facts
            .map(fact => this.calculateRelevance(fact, focusTopic))
            .filter(scored => scored.score >= this.config.relevanceThreshold)
            .sort((a, b) => b.score - a.score)
            .map(scored => scored.item as Fact);
    }

    private extractFocusTopic(messages: Message[]): string | undefined {
        if (messages.length === 0) return undefined;

        // Simple topic extraction: look for repeated keywords in recent messages
        const recentContent = messages
            .slice(-5) // Last 5 messages
            .map(msg => msg.content.toLowerCase())
            .join(' ');

        // Extract potential topics (simplified approach)
        const words = recentContent
            .split(/\s+/)
            .filter(word => word.length > 3)
            .filter(word => !/^(the|and|but|for|you|are|this|that|with|have|will|from)$/.test(word));

        if (words.length === 0) return undefined;

        // Find most frequent meaningful word as topic
        const wordCount = new Map<string, number>();
        words.forEach(word => {
            wordCount.set(word, (wordCount.get(word) || 0) + 1);
        });

        const sortedWords = Array.from(wordCount.entries())
            .sort((a, b) => b[1] - a[1]);

        return sortedWords[0]?.[0];
    }

    private scoreContentRelevance(content: string, focusTopic?: string): { score: number; reasons: string[] } {
        const reasons: string[] = [];
        let score = 0;

        // Topic relevance
        if (focusTopic && content.toLowerCase().includes(focusTopic)) {
            score += 0.4;
            reasons.push(`mentions topic: ${focusTopic}`);
        }

        // Keywords that indicate importance
        const importantKeywords = ['error', 'bug', 'issue', 'problem', 'important', 'urgent', 'help'];
        const hasImportantKeyword = importantKeywords.some(keyword => 
            content.toLowerCase().includes(keyword)
        );
        if (hasImportantKeyword) {
            score += 0.2;
            reasons.push('contains important keyword');
        }

        // Length-based relevance (longer content often more substantive)
        if (content.length > 100) {
            score += 0.1;
            reasons.push('substantive content');
        }

        return { score, reasons };
    }
}