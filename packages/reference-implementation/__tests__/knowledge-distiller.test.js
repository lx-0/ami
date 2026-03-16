import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    ReferenceKnowledgeDistiller,
    PatternExtractionStrategy,
} from '../dist/index.js';

/**
 * Helper to create a Message.
 */
function msg(role, content, timestamp) {
    return { role, content, timestamp: timestamp ?? Date.now() };
}

describe('ReferenceKnowledgeDistiller', () => {
    it('returns empty array for empty input', async () => {
        const distiller = new ReferenceKnowledgeDistiller(
            new PatternExtractionStrategy()
        );
        const facts = await distiller.distill([]);
        assert.deepEqual(facts, []);
    });

    it('filters out system messages', async () => {
        const distiller = new ReferenceKnowledgeDistiller(
            new PatternExtractionStrategy()
        );
        const facts = await distiller.distill([
            msg('system', 'You are a helpful assistant.'),
        ]);
        assert.deepEqual(facts, []);
    });

    it('extracts declarative facts', async () => {
        const distiller = new ReferenceKnowledgeDistiller(
            new PatternExtractionStrategy()
        );
        const facts = await distiller.distill([
            msg('user', 'TypeScript is a typed superset of JavaScript.'),
        ]);
        assert.ok(facts.length > 0, 'Should extract at least one fact');
        assert.ok(
            facts[0].text.includes('TypeScript'),
            'Fact should contain the subject'
        );
        assert.ok(facts[0].id.startsWith('fact_'), 'Should have a generated ID');
        assert.ok(facts[0].timestamp > 0, 'Should have a timestamp');
    });

    it('extracts preference facts', async () => {
        const distiller = new ReferenceKnowledgeDistiller(
            new PatternExtractionStrategy()
        );
        const facts = await distiller.distill([
            msg('user', 'I prefer dark mode for coding.'),
        ]);
        assert.ok(facts.length > 0);
        assert.equal(facts[0].metadata.tag, 'preference');
    });

    it('extracts decision facts', async () => {
        const distiller = new ReferenceKnowledgeDistiller(
            new PatternExtractionStrategy()
        );
        const facts = await distiller.distill([
            msg('user', 'We decided to use pnpm for package management.'),
        ]);
        assert.ok(facts.length > 0);
        assert.equal(facts[0].metadata.tag, 'decision');
    });

    it('respects confidence threshold', async () => {
        const distiller = new ReferenceKnowledgeDistiller(
            new PatternExtractionStrategy(),
            { minConfidence: 0.9 }
        );
        const facts = await distiller.distill([
            msg('user', 'TypeScript is a typed superset of JavaScript.'),
        ]);
        // declaration confidence is 0.5, should be filtered out
        assert.equal(facts.length, 0);
    });

    it('deduplicates identical facts', async () => {
        const distiller = new ReferenceKnowledgeDistiller(
            new PatternExtractionStrategy()
        );
        const facts = await distiller.distill([
            msg('user', 'I prefer TypeScript.'),
            msg('assistant', 'Noted.'),
            msg('user', 'I prefer TypeScript.'),
        ]);
        // Should be deduped to a single fact
        const prefFacts = facts.filter(
            (f) => f.metadata && f.metadata.tag === 'preference'
        );
        assert.equal(prefFacts.length, 1);
    });

    it('respects maxFacts limit', async () => {
        const distiller = new ReferenceKnowledgeDistiller(
            new PatternExtractionStrategy(),
            { maxFacts: 2 }
        );
        const facts = await distiller.distill([
            msg('user', 'I prefer dark mode.'),
            msg('user', 'I like TypeScript.'),
            msg('user', 'I want a fast editor.'),
            msg('user', 'We decided to ship weekly.'),
        ]);
        assert.ok(facts.length <= 2);
    });

    it('links sourceEpisodeId to the originating message', async () => {
        const ts = 1700000000000;
        const distiller = new ReferenceKnowledgeDistiller(
            new PatternExtractionStrategy()
        );
        const facts = await distiller.distill([
            msg('user', 'I prefer vim keybindings.', ts),
        ]);
        assert.ok(facts.length > 0);
        assert.equal(facts[0].sourceEpisodeId, `episode_${ts}`);
    });
});

describe('PatternExtractionStrategy', () => {
    it('detects corrections with high confidence', async () => {
        const strategy = new PatternExtractionStrategy();
        const candidates = await strategy.extract([
            msg('user', 'Actually, the deadline is Friday.'),
        ]);
        assert.ok(candidates.length > 0);
        assert.ok(candidates[0].confidence >= 0.8);
        assert.equal(candidates[0].metadata.tag, 'correction');
    });

    it('skips trivially short sentences', async () => {
        const strategy = new PatternExtractionStrategy();
        const candidates = await strategy.extract([
            msg('user', 'OK. Yes. No.'),
        ]);
        assert.equal(candidates.length, 0);
    });
});
