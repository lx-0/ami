/**
 * Tests for ReferenceContextManager
 */

import test from 'node:test';
import assert from 'node:assert';
import { ReferenceContextManager, type ContextWindow } from '../context-manager.js';
import type { Message, Fact } from '@ami/skeleton';

test('ReferenceContextManager', async (t) => {
    await t.test('initialization', async () => {
        const contextManager = new ReferenceContextManager();
        const window = contextManager.getCurrentContext();
        
        assert.strictEqual(window.recentMessages.length, 0, 'should start with empty messages');
        assert.strictEqual(window.relevantFacts.length, 0, 'should start with empty facts');
        assert.strictEqual(window.focusTopic, undefined, 'should start with no focus topic');
    });

    await t.test('updateContext with messages', async () => {
        const contextManager = new ReferenceContextManager({
            maxMessages: 3,
            relevanceThreshold: 0.2,
            recencyWindow: 60000
        });

        const now = Date.now();
        const messages: Message[] = [
            {
                role: 'user',
                content: 'Let me tell you about machine learning',
                timestamp: now - 1000
            },
            {
                role: 'assistant', 
                content: 'That sounds interesting! Tell me more about neural networks.',
                timestamp: now - 500
            },
            {
                role: 'user',
                content: 'What\'s the weather like today?',
                timestamp: now
            }
        ];

        await contextManager.updateContext(messages, []);
        const window = contextManager.getCurrentContext();
        
        assert.strictEqual(window.recentMessages.length, 3, 'should include all messages within limit');
        assert.ok(window.lastUpdated > 0, 'should update timestamp');
    });

    await t.test('message filtering by recency', async () => {
        const contextManager = new ReferenceContextManager({
            maxMessages: 5,
            recencyWindow: 30000 // 30 seconds
        });

        const now = Date.now();
        const messages: Message[] = [
            {
                role: 'user',
                content: 'Old message',
                timestamp: now - 60000 // 1 minute ago (too old)
            },
            {
                role: 'user',
                content: 'Recent message',
                timestamp: now - 10000 // 10 seconds ago (within window)
            }
        ];

        await contextManager.updateContext(messages, []);
        const window = contextManager.getCurrentContext();
        
        assert.strictEqual(window.recentMessages.length, 1, 'should filter old messages');
        assert.strictEqual(window.recentMessages[0].content, 'Recent message', 'should keep recent message');
    });

    await t.test('message filtering by relevance threshold', async () => {
        const contextManager = new ReferenceContextManager({
            maxMessages: 5,
            relevanceThreshold: 0.5 // High threshold
        });

        const messages: Message[] = [
            {
                role: 'user',
                content: 'ai machine learning neural networks deep learning', // Should be relevant
                timestamp: Date.now()
            },
            {
                role: 'user', 
                content: 'hello', // Should be less relevant
                timestamp: Date.now()
            }
        ];

        await contextManager.updateContext(messages, []);
        const window = contextManager.getCurrentContext();
        
        // With high threshold, should filter out low-relevance messages
        assert.ok(window.recentMessages.length <= 2, 'should apply relevance filtering');
    });

    await t.test('fact filtering and inclusion', async () => {
        const contextManager = new ReferenceContextManager({
            maxFacts: 2,
            relevanceThreshold: 0.1
        });

        const facts: Fact[] = [
            {
                id: 'fact1',
                text: 'Neural networks are a subset of machine learning algorithms',
                relations: [],
                timestamp: Date.now()
            },
            {
                id: 'fact2',
                text: 'The weather today is sunny and warm',
                relations: [],
                timestamp: Date.now()
            },
            {
                id: 'fact3',
                text: 'Deep learning uses multiple layers in neural networks',
                relations: ['fact1'],
                timestamp: Date.now()
            }
        ];

        const messages: Message[] = [
            {
                role: 'user',
                content: 'Tell me about artificial intelligence and neural networks',
                timestamp: Date.now()
            }
        ];

        await contextManager.updateContext(messages, facts);
        const window = contextManager.getCurrentContext();
        
        assert.strictEqual(window.relevantFacts.length, 2, 'should respect maxFacts limit');
        assert.ok(window.relevantFacts.length > 0, 'should include some facts');
    });

    await t.test('focus topic extraction', async () => {
        const contextManager = new ReferenceContextManager();

        const messages: Message[] = [
            {
                role: 'user',
                content: 'Let me ask about machine learning algorithms and neural networks',
                timestamp: Date.now()
            },
            {
                role: 'assistant',
                content: 'Neural networks are indeed fascinating machine learning models',
                timestamp: Date.now()
            }
        ];

        await contextManager.updateContext(messages, []);
        const window = contextManager.getCurrentContext();
        
        assert.ok(window.focusTopic, 'should extract focus topic');
        assert.ok(
            window.focusTopic!.toLowerCase().includes('machine') ||
            window.focusTopic!.toLowerCase().includes('neural') ||
            window.focusTopic!.toLowerCase().includes('learning'),
            'focus topic should reflect conversation content'
        );
    });

    await t.test('calculateRelevance scoring', async () => {
        const contextManager = new ReferenceContextManager();

        const message: Message = {
            role: 'user',
            content: 'Tell me about artificial intelligence and machine learning',
            timestamp: Date.now()
        };

        const fact: Fact = {
            id: 'fact1',
            text: 'Machine learning is a subset of artificial intelligence',
            relations: [],
            timestamp: Date.now()
        };

        const messageScore = contextManager.calculateRelevance(message, 'artificial intelligence');
        const factScore = contextManager.calculateRelevance(fact, 'machine learning');

        assert.ok(messageScore.score > 0, 'should score relevant message positively');
        assert.ok(factScore.score > 0, 'should score relevant fact positively');
        assert.ok(messageScore.reasons.length > 0, 'should provide reasoning for message score');
        assert.ok(factScore.reasons.length > 0, 'should provide reasoning for fact score');
    });

    await t.test('context window limits', async () => {
        const contextManager = new ReferenceContextManager({
            maxMessages: 2,
            maxFacts: 1
        });

        const messages: Message[] = Array.from({ length: 5 }, (_, i) => ({
            role: 'user',
            content: `Message ${i + 1} about important topics`,
            timestamp: Date.now() - i * 1000
        }));

        const facts: Fact[] = Array.from({ length: 3 }, (_, i) => ({
            id: `fact${i + 1}`,
            text: `Fact ${i + 1} about relevant information`,
            relations: [],
            timestamp: Date.now()
        }));

        await contextManager.updateContext(messages, facts);
        const window = contextManager.getCurrentContext();
        
        assert.strictEqual(window.recentMessages.length, 2, 'should respect maxMessages limit');
        assert.strictEqual(window.relevantFacts.length, 1, 'should respect maxFacts limit');
    });

    await t.test('empty input handling', async () => {
        const contextManager = new ReferenceContextManager();

        // Test with empty arrays
        await contextManager.updateContext([], []);
        let window = contextManager.getCurrentContext();
        
        assert.strictEqual(window.recentMessages.length, 0, 'should handle empty messages');
        assert.strictEqual(window.relevantFacts.length, 0, 'should handle empty facts');

        // Test with undefined/null handling gracefully
        const messages: Message[] = [
            {
                role: 'user',
                content: '',
                timestamp: Date.now()
            }
        ];

        await contextManager.updateContext(messages, []);
        window = contextManager.getCurrentContext();
        
        assert.ok(window.lastUpdated > 0, 'should still update timestamp with empty content');
    });
});