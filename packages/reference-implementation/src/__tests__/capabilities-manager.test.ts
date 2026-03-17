/**
 * Tests for CapabilitiesManager and CapabilitiesManagerModule
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { 
    CapabilitiesManager,
    PatternBasedAnalysisStrategy,
    type TaskAnalysisRequest,
    type CapabilityAnalysisStrategy
} from '../capabilities-manager.js';
import { CapabilitiesManagerModule } from '../capabilities-manager-module.js';
import { ReferenceCognitiveBus } from '../cognitive-bus.js';

describe('PatternBasedAnalysisStrategy', () => {
    let strategy: PatternBasedAnalysisStrategy;

    beforeEach(() => {
        strategy = new PatternBasedAnalysisStrategy();
    });

    it('should suggest TTS for speech tasks', async () => {
        const request: TaskAnalysisRequest = {
            description: 'Please say hello to the user'
        };

        const suggestions = await strategy.analyze(request);
        
        assert(suggestions.length > 0, 'Should have suggestions');
        const ttsSuggestion = suggestions.find(s => s.id === 'tts');
        assert(ttsSuggestion !== undefined, 'Should suggest TTS');
        assert(ttsSuggestion.confidence > 0.8, 'Should have high confidence for TTS');
    });

    it('should suggest vision system for image tasks', async () => {
        const request: TaskAnalysisRequest = {
            description: 'Take a photo and analyze the image'
        };

        const suggestions = await strategy.analyze(request);
        
        const visionSuggestion = suggestions.find(s => s.id === 'vision');
        assert(visionSuggestion !== undefined, 'Should suggest vision system');
        assert(visionSuggestion.confidence > 0.7, 'Should have good confidence for vision');
    });

    it('should suggest semantic memory for search tasks', async () => {
        const request: TaskAnalysisRequest = {
            description: 'Find information about artificial intelligence'
        };

        const suggestions = await strategy.analyze(request);
        
        const memorySuggestion = suggestions.find(s => s.id === 'semantic-memory');
        assert(memorySuggestion !== undefined, 'Should suggest semantic memory');
        assert(memorySuggestion.confidence > 0.7, 'Should have good confidence for memory');
    });

    it('should boost confidence for available tools', async () => {
        const request: TaskAnalysisRequest = {
            description: 'Send a message to the user',
            availableTools: ['messaging']
        };

        const suggestions = await strategy.analyze(request);
        
        const messagingSuggestion = suggestions.find(s => s.id === 'messaging');
        assert(messagingSuggestion !== undefined, 'Should suggest messaging');
        assert(messagingSuggestion.reason.includes('tool available in environment'), 
               'Should note tool availability');
    });

    it('should handle empty descriptions gracefully', async () => {
        const request: TaskAnalysisRequest = {
            description: ''
        };

        const suggestions = await strategy.analyze(request);
        assert.deepStrictEqual(suggestions, [], 'Should return empty array for empty description');
    });
});

describe('CapabilitiesManager', () => {
    let manager: CapabilitiesManager;

    beforeEach(() => {
        manager = new CapabilitiesManager({
            strategy: new PatternBasedAnalysisStrategy(),
            maxSuggestions: 5,
            minConfidence: 0.2
        });
    });

    it('should analyze tasks and return structured results', async () => {
        const request: TaskAnalysisRequest = {
            description: 'Write a summary and send it via email',
            priority: 'medium'
        };

        const analysis = await manager.analyzeTask(request);
        
        assert.deepStrictEqual(analysis.task, request, 'Should preserve original task');
        assert(Array.isArray(analysis.suggestions), 'Should return suggestions array');
        assert(typeof analysis.timestamp === 'string', 'Should have timestamp');
        assert(analysis.processingTime > 0, 'Should track processing time');
    });

    it('should limit suggestions to maxSuggestions', async () => {
        const request: TaskAnalysisRequest = {
            description: 'Complex task involving text writing, image analysis, web search, memory storage, and audio output'
        };

        const analysis = await manager.analyzeTask(request);
        assert(analysis.suggestions.length <= 5, 'Should limit suggestions to maxSuggestions');
    });

    it('should filter suggestions below minConfidence', async () => {
        const request: TaskAnalysisRequest = {
            description: 'Vague task description that might not match patterns well'
        };

        const analysis = await manager.analyzeTask(request);
        
        for (const suggestion of analysis.suggestions) {
            assert(suggestion.confidence >= 0.2, 'All suggestions should meet minimum confidence');
        }
    });

    it('should return top suggestions correctly', async () => {
        const topSuggestions = await manager.getTopSuggestions('Say hello to the user', 2);
        
        assert(topSuggestions.length <= 2, 'Should limit to requested count');
        if (topSuggestions.length > 1) {
            assert(topSuggestions[0].confidence >= topSuggestions[1].confidence, 
                   'Should sort by confidence descending');
        }
    });

    it('should check capability recommendations', async () => {
        const result = await manager.isCapabilityRecommended('Speak to the user', 'tts', 0.5);
        
        assert(result.recommended === true, 'Should recommend TTS for speech task');
        assert(typeof result.confidence === 'number' && result.confidence > 0.5, 
               'Should provide high confidence');
        assert(typeof result.reason === 'string', 'Should provide reason');
    });

    it('should handle analysis errors gracefully', async () => {
        // Create manager with failing strategy
        const failingStrategy: CapabilityAnalysisStrategy = {
            analyze: async () => { throw new Error('Analysis failed'); }
        };

        const errorManager = new CapabilitiesManager({
            strategy: failingStrategy
        });

        const analysis = await errorManager.analyzeTask({
            description: 'Any task'
        });

        assert.deepStrictEqual(analysis.suggestions, [], 'Should return empty suggestions on error');
        assert(analysis.processingTime > 0, 'Should still track processing time');
    });

    it('should track metrics when enabled', async () => {
        const metricManager = new CapabilitiesManager({
            strategy: new PatternBasedAnalysisStrategy(),
            enableMetrics: true
        });

        await metricManager.analyzeTask({ description: 'Test task' });
        
        const metrics = metricManager.getMetrics();
        assert(metrics.totalAnalyses === 1, 'Should track analysis count');
        assert(metrics.averageProcessingTime > 0, 'Should track average processing time');
    });
});

describe('CapabilitiesManagerModule', () => {
    let module: CapabilitiesManagerModule;
    let bus: ReferenceCognitiveBus;

    beforeEach(() => {
        bus = new ReferenceCognitiveBus();
        module = new CapabilitiesManagerModule({
            enableLogging: false // Disable for tests
        });
    });

    it('should initialize and register correctly', async () => {
        assert.strictEqual(module.id, 'processor.capabilities-manager');
        assert.strictEqual(module.name, 'Capabilities Manager');
        assert.deepStrictEqual(module.capabilities, ['processor']);
        assert.strictEqual(module.status, 'registered');

        await module.init(bus, {});
        assert.strictEqual(module.status, 'ready');
    });

    it('should handle task analysis events', async () => {
        await module.init(bus, {});

        const analysisResults: any[] = [];
        bus.on('capabilities.suggested', (event) => {
            analysisResults.push(event.payload);
        });

        const taskRequest: TaskAnalysisRequest = {
            description: 'Send a voice message to the user'
        };

        bus.emit('task.analyze', taskRequest);

        // Wait a bit for async processing
        await new Promise(resolve => setTimeout(resolve, 50));

        assert(analysisResults.length === 1, 'Should emit capabilities.suggested event');
        assert.deepStrictEqual(analysisResults[0].task, taskRequest, 'Should preserve task request');
        assert(Array.isArray(analysisResults[0].suggestions), 'Should include suggestions');
    });

    it('should cleanup properly on destroy', async () => {
        await module.init(bus, {});
        await module.destroy();

        assert.strictEqual(module.status, 'stopped', 'Should be stopped after destroy');
    });

    it('should provide manual analysis interface', async () => {
        await module.init(bus, {});

        const result = await module.analyzeTask({
            description: 'Test manual analysis'
        });

        assert(result !== null, 'Should return analysis result');
        assert(Array.isArray(result?.suggestions), 'Should include suggestions array');
    });

    it('should provide metrics when available', async () => {
        await module.init(bus, {});

        // Perform an analysis to generate metrics
        await module.analyzeTask({
            description: 'Test task for metrics'
        });

        const metrics = module.getMetrics();
        assert(metrics !== null, 'Should return metrics');
        assert(typeof metrics?.totalAnalyses === 'number', 'Should track analyses count');
    });
});