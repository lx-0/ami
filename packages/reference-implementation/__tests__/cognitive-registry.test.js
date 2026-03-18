import test from 'node:test';
import assert from 'node:assert';
import { ReferenceCognitiveBus, ReferenceCognitiveRegistry } from '../dist/index.js';

// Mock cognitive module for testing
class MockSensorModule {
    constructor(id, name, shouldFailInit = false) {
        this.id = id;
        this.name = name;
        this.capabilities = ['sensor'];
        this.status = 'registered';
        this.shouldFailInit = shouldFailInit;
        this.initCalled = false;
        this.destroyCalled = false;
    }

    async init(bus, config) {
        this.initCalled = true;
        this.bus = bus;
        this.config = config;
        if (this.shouldFailInit) {
            throw new Error('Intentional init failure for testing');
        }
    }

    async destroy() {
        this.destroyCalled = true;
    }
}

class MockProcessorModule {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        this.capabilities = ['processor'];
        this.status = 'registered';
        this.initCalled = false;
        this.destroyCalled = false;
    }

    async init(bus, config) {
        this.initCalled = true;
        this.bus = bus;
        this.config = config;
    }

    async destroy() {
        this.destroyCalled = true;
    }
}

test('ReferenceCognitiveRegistry', async (t) => {
    await t.test('registers and discovers modules', async () => {
        const bus = new ReferenceCognitiveBus();
        const registry = new ReferenceCognitiveRegistry(bus);

        const sensor = new MockSensorModule('audio-sensor', 'Audio Input');
        const processor = new MockProcessorModule('nlp-proc', 'NLP Processor');

        registry.register(sensor);
        registry.register(processor);

        assert.strictEqual(registry.getModule('audio-sensor'), sensor);
        assert.strictEqual(registry.getModule('nlp-proc'), processor);
        assert.strictEqual(registry.getModule('nonexistent'), undefined);
    });

    await t.test('prevents duplicate registrations', async () => {
        const bus = new ReferenceCognitiveBus();
        const registry = new ReferenceCognitiveRegistry(bus);

        const sensor1 = new MockSensorModule('audio-sensor', 'Audio Input 1');
        const sensor2 = new MockSensorModule('audio-sensor', 'Audio Input 2'); // Same ID

        registry.register(sensor1);
        
        assert.throws(() => {
            registry.register(sensor2);
        }, /already registered/);
    });

    await t.test('finds providers by capability', async () => {
        const bus = new ReferenceCognitiveBus();
        const registry = new ReferenceCognitiveRegistry(bus);

        const sensor1 = new MockSensorModule('audio', 'Audio Sensor');
        const sensor2 = new MockSensorModule('vision', 'Vision Sensor');
        const processor = new MockProcessorModule('nlp', 'NLP Processor');

        registry.register(sensor1);
        registry.register(sensor2);
        registry.register(processor);

        // Initialize modules so they become ready
        await registry.initAll();

        const sensors = registry.getProviders('sensor');
        const processors = registry.getProviders('processor');
        const actuators = registry.getProviders('actuator');

        assert.strictEqual(sensors.length, 2);
        assert.strictEqual(processors.length, 1);
        assert.strictEqual(actuators.length, 0);

        assert.strictEqual(registry.hasCapability('sensor'), true);
        assert.strictEqual(registry.hasCapability('processor'), true);
        assert.strictEqual(registry.hasCapability('actuator'), false);
    });

    await t.test('handles initialization lifecycle', async () => {
        const bus = new ReferenceCognitiveBus();
        const registry = new ReferenceCognitiveRegistry(bus);

        const sensor = new MockSensorModule('audio', 'Audio Sensor');
        const processor = new MockProcessorModule('nlp', 'NLP Processor');

        registry.register(sensor);
        registry.register(processor);

        // Modules start as 'registered'
        assert.strictEqual(sensor.status, 'registered');
        assert.strictEqual(processor.status, 'registered');

        await registry.initAll({ 'audio': { sampleRate: 44100 } });

        // After init, modules should be ready
        assert.strictEqual(sensor.status, 'ready');
        assert.strictEqual(processor.status, 'ready');
        assert.strictEqual(sensor.initCalled, true);
        assert.strictEqual(processor.initCalled, true);

        // Check config was passed correctly
        assert.deepStrictEqual(sensor.config, { sampleRate: 44100 });
        assert.deepStrictEqual(processor.config, {});
    });

    await t.test('handles graceful degradation on init failure', async () => {
        const bus = new ReferenceCognitiveBus();
        const registry = new ReferenceCognitiveRegistry(bus);

        const goodSensor = new MockSensorModule('good', 'Good Sensor');
        const badSensor = new MockSensorModule('bad', 'Bad Sensor', true); // Will fail init

        registry.register(goodSensor);
        registry.register(badSensor);

        await registry.initAll();

        // Good sensor should be ready
        assert.strictEqual(goodSensor.status, 'ready');
        assert.strictEqual(registry.hasCapability('sensor'), true);

        // Bad sensor should be in error state, but system continues
        assert.strictEqual(badSensor.status, 'error');

        const status = registry.getStatus();
        assert.strictEqual(status.totalModules, 2);
        assert.strictEqual(status.readyModules, 1);
        assert.strictEqual(status.degradedModules, 1);
    });

    await t.test('destroys all modules', async () => {
        const bus = new ReferenceCognitiveBus();
        const registry = new ReferenceCognitiveRegistry(bus);

        const sensor = new MockSensorModule('audio', 'Audio Sensor');
        const processor = new MockProcessorModule('nlp', 'NLP Processor');

        registry.register(sensor);
        registry.register(processor);
        await registry.initAll();

        assert.strictEqual(sensor.status, 'ready');
        assert.strictEqual(processor.status, 'ready');

        await registry.destroyAll();

        assert.strictEqual(sensor.status, 'stopped');
        assert.strictEqual(processor.status, 'stopped');
        assert.strictEqual(sensor.destroyCalled, true);
        assert.strictEqual(processor.destroyCalled, true);
    });

    await t.test('emits registry events on bus', async () => {
        const bus = new ReferenceCognitiveBus();
        const registry = new ReferenceCognitiveRegistry(bus);

        const events = [];
        bus.on('module.registered', (event) => events.push({ type: 'registered', data: event.payload }));
        bus.on('module.ready', (event) => events.push({ type: 'ready', data: event.payload }));

        const sensor = new MockSensorModule('audio', 'Audio Sensor');
        registry.register(sensor);
        
        await registry.initAll();

        assert.strictEqual(events.length, 2);
        assert.strictEqual(events[0].type, 'registered');
        assert.strictEqual(events[0].data.moduleId, 'audio');
        assert.strictEqual(events[1].type, 'ready');
        assert.strictEqual(events[1].data.moduleId, 'audio');
    });
});