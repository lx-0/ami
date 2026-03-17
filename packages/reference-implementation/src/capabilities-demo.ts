/**
 * Capabilities Demo — Interactive demo of the CapabilitiesManager.
 *
 * This demo shows how the CapabilitiesManager analyzes different types of tasks
 * and suggests appropriate capabilities for handling them.
 *
 * Run with: node dist/capabilities-demo.js
 */

import { 
    CapabilitiesManager, 
    PatternBasedAnalysisStrategy,
    type TaskAnalysisRequest,
    type CapabilitiesAnalysis
} from './capabilities-manager.js';
import { CapabilitiesManagerModule } from './capabilities-manager-module.js';
import { ReferenceCognitiveBus } from './cognitive-bus.js';
import { ReferenceCognitiveRegistry } from './cognitive-registry.js';

function formatSuggestion(suggestion: any, index: number): string {
    const confidence = (suggestion.confidence * 100).toFixed(1);
    const costIcons: Record<string, string> = { low: '💚', medium: '🔶', high: '🔴' };
    const costIcon = costIcons[suggestion.cost] || '❓';
    
    return `  ${index + 1}. ${suggestion.name} (${confidence}%) ${costIcon}\n` +
           `     Type: ${suggestion.type} | Cost: ${suggestion.cost}\n` +
           `     Reason: ${suggestion.reason}`;
}

async function demoTaskAnalysis() {
    console.log('🧠 AMI Capabilities Manager Demo\n');
    console.log('═'.repeat(50));

    // Create the capabilities manager
    const manager = new CapabilitiesManager({
        strategy: new PatternBasedAnalysisStrategy(),
        maxSuggestions: 5,
        minConfidence: 0.1,
        enableMetrics: true
    });

    // Test cases representing different types of tasks
    const testCases: TaskAnalysisRequest[] = [
        {
            description: 'Say hello to the user with a friendly voice',
            priority: 'medium'
        },
        {
            description: 'Take a photo and analyze what objects are in the image',
            availableTools: ['camera', 'vision', 'object-detection']
        },
        {
            description: 'Find information about machine learning and summarize it',
            priority: 'high'
        },
        {
            description: 'Remember this conversation and store important facts',
            context: ['user preference: dark mode', 'location: office']
        },
        {
            description: 'Send an urgent email notification to the team',
            priority: 'urgent',
            availableTools: ['email', 'slack', 'messaging']
        },
        {
            description: 'Process audio input and convert speech to text for analysis',
            constraints: { 'language': 'en-US', 'realtime': true }
        }
    ];

    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        
        console.log(`\n📋 Test Case ${i + 1}: "${testCase.description}"`);
        console.log(`Priority: ${testCase.priority || 'normal'}`);
        
        if (testCase.availableTools) {
            console.log(`Available tools: ${testCase.availableTools.join(', ')}`);
        }
        
        if (testCase.context) {
            console.log(`Context: ${testCase.context.join(', ')}`);
        }

        console.log('\n💡 Capability Analysis Results:');
        
        const analysis = await manager.analyzeTask(testCase);
        
        if (analysis.suggestions.length === 0) {
            console.log('   No capabilities suggested for this task.');
        } else {
            analysis.suggestions.forEach((suggestion, index) => {
                console.log(formatSuggestion(suggestion, index));
            });
        }
        
        console.log(`\n⏱️  Processing time: ${analysis.processingTime}ms`);
        console.log('─'.repeat(50));
    }

    // Show performance metrics
    console.log('\n📊 Performance Metrics:');
    const metrics = manager.getMetrics();
    console.log(`   Total analyses: ${metrics.totalAnalyses}`);
    console.log(`   Average processing time: ${metrics.averageProcessingTime.toFixed(2)}ms`);
    console.log(`   Accuracy score: ${metrics.accuracyScore.toFixed(2)}`);
}

async function demoModuleIntegration() {
    console.log('\n\n🔄 Module Integration Demo\n');
    console.log('═'.repeat(50));

    // Set up the cognitive system
    const bus = new ReferenceCognitiveBus();
    const registry = new ReferenceCognitiveRegistry(bus);

    // Create and register the capabilities manager module
    const capabilitiesModule = new CapabilitiesManagerModule({
        autoAnalyzeContext: true,
        enableLogging: true
    });

    registry.register(capabilitiesModule);
    await registry.initAll();

    console.log('\n🎯 Testing event-driven analysis...\n');

    // Set up event listeners
    bus.on('capabilities.suggested', (event) => {
        const analysis = event.payload as CapabilitiesAnalysis;
        console.log(`📈 Capability suggestions for: "${analysis.task.description.substring(0, 40)}..."`);
        
        if (analysis.suggestions.length > 0) {
            console.log(`   Top suggestion: ${analysis.suggestions[0].name} (${(analysis.suggestions[0].confidence * 100).toFixed(1)}%)`);
            console.log(`   Total suggestions: ${analysis.suggestions.length}`);
        }
        console.log('');
    });

    // Emit some task analysis requests
    const tasks = [
        'Create a presentation and display it on screen',
        'Listen for voice commands and respond with speech',
        'Analyze the current context and suggest next actions',
        'Store these meeting notes in long-term memory'
    ];

    for (const task of tasks) {
        console.log(`🚀 Analyzing: "${task}"`);
        bus.emit('task.analyze', {
            description: task,
            priority: 'medium'
        });
        
        // Brief pause for processing
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Test context change auto-analysis
    console.log('🔍 Testing auto-analysis on context change...\n');
    bus.emit('context.changed', {
        focusTopics: ['audio processing', 'real-time transcription'],
        summary: 'User is working with speech recognition system'
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Clean shutdown
    await registry.destroyAll();
    console.log('✅ Demo completed successfully!');
}

// Main demo runner
async function runDemo() {
    try {
        await demoTaskAnalysis();
        await demoModuleIntegration();
    } catch (error) {
        console.error('❌ Demo failed:', error);
    }
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runDemo();
}

export { runDemo as capabilitiesDemo };