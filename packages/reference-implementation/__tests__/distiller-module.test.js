import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { DistillerModule, ReferenceCognitiveBus } from '../dist/index.js';

/**
 * Stub strategy that returns one fact per message.
 */
const stubStrategy = {
    async extract(messages) {
        return messages.map((m, i) => ({
            text: `fact: ${m.content}`,
            sourceMessageIndex: i,
            confidence: 0.9,
        }));
    },
};

describe('ReferenceCognitiveBus', () => {
    it('emits and receives events', () => {
        const bus = new ReferenceCognitiveBus();
        const received = [];

        bus.on('test.event', (event) => {
            received.push(event.payload);
        });

        bus.emit('test.event', 'hello');
        bus.emit('test.event', 'world');

        assert.deepStrictEqual(received, ['hello', 'world']);
    });

    it('once handler fires only once', () => {
        const bus = new ReferenceCognitiveBus();
        let count = 0;

        bus.once('once.event', () => {
            count++;
        });

        bus.emit('once.event', null);
        bus.emit('once.event', null);

        assert.equal(count, 1);
    });

    it('off removes handler', () => {
        const bus = new ReferenceCognitiveBus();
        let count = 0;
        const handler = () => { count++; };

        bus.on('off.event', handler);
        bus.emit('off.event', null);
        bus.off('off.event', handler);
        bus.emit('off.event', null);

        assert.equal(count, 1);
    });

    it('handles errors in handlers without crashing', () => {
        const bus = new ReferenceCognitiveBus();
        let afterError = false;

        bus.on('err.event', () => {
            throw new Error('boom');
        });
        bus.on('err.event', () => {
            afterError = true;
        });

        // Should not throw
        bus.emit('err.event', null);
        assert.equal(afterError, true);
    });
});

describe('DistillerModule', () => {
    it('implements CognitiveModule interface', () => {
        const mod = new DistillerModule({ strategy: stubStrategy });

        assert.equal(mod.id, 'processor.distiller');
        assert.equal(mod.name, 'Knowledge Distiller');
        assert.deepStrictEqual(mod.capabilities, ['processor']);
        assert.equal(mod.status, 'registered');
        assert.equal(typeof mod.init, 'function');
        assert.equal(typeof mod.destroy, 'function');
    });

    it('subscribes to episodes.batch and emits fact.created on init', async () => {
        const bus = new ReferenceCognitiveBus();
        const mod = new DistillerModule({ strategy: stubStrategy });

        await mod.init(bus, {});
        assert.equal(mod.status, 'ready');

        // Collect emitted facts
        const facts = [];
        bus.on('fact.created', (event) => {
            facts.push(event.payload);
        });

        // Emit episode batch
        const episodes = [
            { role: 'user', content: 'The sky is blue', timestamp: 1000 },
            { role: 'assistant', content: 'Indeed it is', timestamp: 2000 },
        ];

        bus.emit('episodes.batch', episodes);

        // Allow async handler to complete
        await new Promise((r) => setTimeout(r, 50));

        assert.equal(facts.length, 2);
        assert.equal(facts[0].text, 'fact: The sky is blue');
        assert.equal(facts[1].text, 'fact: Indeed it is');
    });

    it('stops listening after destroy', async () => {
        const bus = new ReferenceCognitiveBus();
        const mod = new DistillerModule({ strategy: stubStrategy });

        await mod.init(bus, {});

        const facts = [];
        bus.on('fact.created', (event) => {
            facts.push(event.payload);
        });

        await mod.destroy();
        assert.equal(mod.status, 'stopped');

        bus.emit('episodes.batch', [
            { role: 'user', content: 'ignored', timestamp: 3000 },
        ]);

        await new Promise((r) => setTimeout(r, 50));
        assert.equal(facts.length, 0);
    });

    it('emits module.degraded on distillation error', async () => {
        const failingStrategy = {
            async extract() { throw new Error('extraction failed'); },
        };
        const bus = new ReferenceCognitiveBus();
        const mod = new DistillerModule({ strategy: failingStrategy });

        await mod.init(bus, {});

        const degraded = [];
        bus.on('module.degraded', (event) => {
            degraded.push(event.payload);
        });

        bus.emit('episodes.batch', [
            { role: 'user', content: 'trigger error', timestamp: 4000 },
        ]);

        await new Promise((r) => setTimeout(r, 50));

        assert.equal(degraded.length, 1);
        assert.equal(degraded[0].moduleId, 'processor.distiller');
        assert.equal(mod.status, 'degraded');
    });
});
