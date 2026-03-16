#!/usr/bin/env node
/**
 * Demo: ContextManager integration with the cognitive system.
 * 
 * This demonstrates the attention/relevance filtering capabilities:
 * 1. ContextManager processes incoming perceptions
 * 2. Maintains focused attention window
 * 3. Emits context.changed events
 * 4. Works alongside the knowledge distiller
 * 
 * Usage:
 *   npx tsx context-demo.ts
 *   npm run demo:context
 */

import { ReferenceCognitiveRegistry } from './cognitive-registry.js';
import { ReferenceCognitiveBus } from './cognitive-bus.js';
import { DistillerModule } from './distiller-module.js';
import { ContextManagerModule } from './context-manager-module.js';
import { PatternExtractionStrategy } from './strategies/index.js';
import type { Message, Fact } from '@ami/skeleton';
import type { ContextWindow } from './context-manager.js';

async function runContextDemo(): Promise<void> {
    console.log('🧠 AMI ContextManager Demo');
    console.log('============================\n');

    // 1. Create the cognitive infrastructure
    const bus = new ReferenceCognitiveBus();
    const registry = new ReferenceCognitiveRegistry(bus);
    
    // 2. Register modules
    console.log('🔧 Registering cognitive modules...');
    
    const distillerModule = new DistillerModule({
        strategy: new PatternExtractionStrategy()
    });
    registry.register(distillerModule);
    console.log(`   ✅ Registered: ${distillerModule.name}`);
    
    const contextModule = new ContextManagerModule({
        maxMessages: 8,
        maxFacts: 5,
        relevanceThreshold: 0.2,
        recencyWindow: 300000, // 5 minutes
        updateThrottleMs: 500
    });
    registry.register(contextModule);
    console.log(`   ✅ Registered: ${contextModule.name}`);
    
    // 3. Subscribe to context changes
    let contextChangeCount = 0;
    bus.on<ContextWindow>('context.changed', (event) => {
        contextChangeCount++;
        console.log(`\n📡 Context changed (#${contextChangeCount}):`);
        console.log(`   🎯 Focus topic: ${event.payload.focusTopic || 'none'}`);
        console.log(`   💭 Recent messages: ${event.payload.recentMessages.length}`);
        console.log(`   🧠 Relevant facts: ${event.payload.relevantFacts.length}`);
        
        if (event.payload.focusTopic) {
            const recentTopics = event.payload.recentMessages
                .slice(-3)
                .map((m: Message) => `"${m.content.substring(0, 40)}..."`);
            console.log(`   📝 Recent: [${recentTopics.join(', ')}]`);
        }
    });
    
    // Subscribe to fact creation
    let factCount = 0;
    bus.on<Fact>('fact.created', (event) => {
        factCount++;
        console.log(`\n🔬 Fact created (#${factCount}): "${event.payload.text.substring(0, 60)}..."`);
    });

    // 4. Initialize all modules
    console.log('\n🚀 Initializing cognitive system...');
    await registry.initAll({});
    
    // 5. Simulate a conversation about TypeScript
    console.log('\n💬 Simulating TypeScript conversation...');
    
    const messages: Message[] = [
        {
            role: 'user',
            content: 'I want to learn about TypeScript',
            timestamp: Date.now(),
        },
        {
            role: 'assistant', 
            content: 'TypeScript is a superset of JavaScript that adds static typing',
            timestamp: Date.now() + 1000,
        },
        {
            role: 'user',
            content: 'What are generics in TypeScript?',
            timestamp: Date.now() + 2000,
        },
        {
            role: 'assistant',
            content: 'Generics allow you to create reusable components that work with multiple types',
            timestamp: Date.now() + 3000,
        },
        {
            role: 'user',
            content: 'Can you show me an example of TypeScript interfaces?',
            timestamp: Date.now() + 4000,
        },
    ];

    for (const message of messages) {
        console.log(`\n📥 Processing: "${message.content.substring(0, 50)}..."`);
        bus.emit('perception.text', message);
        await new Promise(resolve => setTimeout(resolve, 800)); // Delay for demo
    }

    // 6. Change topic to show context shifting
    console.log('\n🔄 Shifting topic to machine learning...');
    
    const newTopicMessages: Message[] = [
        {
            role: 'user',
            content: 'Now tell me about machine learning algorithms',
            timestamp: Date.now() + 5000,
        },
        {
            role: 'assistant',
            content: 'Machine learning involves training models on data to make predictions',
            timestamp: Date.now() + 6000,
        },
        {
            role: 'user',
            content: 'What is the difference between supervised and unsupervised learning?',
            timestamp: Date.now() + 7000,
        },
    ];

    for (const message of newTopicMessages) {
        console.log(`\n📥 Processing: "${message.content.substring(0, 50)}..."`);
        bus.emit('perception.text', message);
        await new Promise(resolve => setTimeout(resolve, 800));
    }

    // 7. Trigger manual context update with batch
    console.log('\n🔄 Manual context update with all messages...');
    bus.emit('context.update', {
        messages: [...messages, ...newTopicMessages]
    });

    // 8. Wait for processing
    console.log('\n⏳ Waiting for cognitive processing...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 9. Show final context state
    const finalContext = contextModule.getCurrentContext();
    if (finalContext) {
        console.log('\n📊 Final context state:');
        console.log(`   🎯 Focus: ${finalContext.focusTopic}`);
        console.log(`   💭 Messages: ${finalContext.recentMessages.length}`);
        console.log(`   🧠 Facts: ${finalContext.relevantFacts.length}`);
        console.log(`   ⏰ Last updated: ${new Date(finalContext.lastUpdated).toISOString()}`);
    }

    // 10. Graceful shutdown
    console.log('\n🛑 Shutting down cognitive system...');
    await registry.destroyAll();
    
    console.log('\n✅ ContextManager demo completed! 🎉');
    console.log(`📈 Statistics: ${contextChangeCount} context changes, ${factCount} facts created`);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});

// Run the demo
if (import.meta.url === new URL(process.argv[1], 'file://').href) {
    runContextDemo().catch(error => {
        console.error('❌ Context demo failed:', error);
        process.exit(1);
    });
}