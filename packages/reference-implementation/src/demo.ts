#!/usr/bin/env node
/**
 * Demo: Bootstrap and run the Ami reference agent.
 * 
 * This demonstrates the capability-based architecture:
 * 1. Registry discovers modules
 * 2. Bus handles inter-module communication
 * 3. Ami orchestrates the cognitive loop
 * 4. Graceful degradation when modules are missing
 * 
 * Usage:
 *   npx tsx demo.ts
 *   npm run demo
 */

import { ReferenceCognitiveRegistry } from './cognitive-registry.js';
import { ReferenceCognitiveBus } from './cognitive-bus.js';
import { DistillerModule } from './distiller-module.js';
import { PatternExtractionStrategy } from './strategies/index.js';
import { Ami } from './ami.js';

async function runDemo(): Promise<void> {
    console.log('🚀 AMI Reference Agent Demo');
    console.log('============================\n');

    // 1. Create the cognitive infrastructure
    const bus = new ReferenceCognitiveBus();
    const registry = new ReferenceCognitiveRegistry(bus);
    
    // 2. Register available modules
    console.log('🔧 Registering cognitive modules...');
    
    // Register the knowledge distiller as a processor
    const distillerModule = new DistillerModule({
        strategy: new PatternExtractionStrategy()
    });
    registry.register(distillerModule);
    
    console.log(`   ✅ Registered: ${distillerModule.name} (${distillerModule.capabilities.join(', ')})`);
    
    // 3. Create and start Ami
    console.log('\n🧠 Starting Ami...');
    const ami = new Ami(registry, bus, { 
        debug: true,
        maxEpisodeContext: 20,
        distillationInterval: 10000 // 10 seconds for demo
    });
    
    await ami.start();
    
    // 4. Show current status
    console.log('\n📊 Current status:');
    const status = ami.getStatus();
    console.log(JSON.stringify(status, null, 2));
    
    // 5. Simulate some interactions
    console.log('\n💬 Simulating interactions...');
    await ami.processInput('Hello Ami, can you remember this message?', 'user');
    await ami.processInput('I am testing the AMI framework', 'user');
    await ami.processInput('The weather is nice today', 'user');
    await ami.processInput('I like cognitive architectures', 'user');
    await ami.processInput('This is the fifth message, should trigger distillation', 'user');
    
    // 6. Wait a bit to see distillation in action
    console.log('\n⏳ Waiting for cognitive processing...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 7. Trigger a manual cognitive step
    console.log('\n🔄 Manual cognitive step...');
    await ami.step();
    
    // 8. Show final status
    console.log('\n📊 Final status:');
    const finalStatus = ami.getStatus();
    console.log(JSON.stringify(finalStatus, null, 2));
    
    // 9. Graceful shutdown
    console.log('\n🛑 Shutting down...');
    await ami.stop();
    
    console.log('\n✅ Demo completed! This proves that "If it runs, I AM!" 🎉');
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
    runDemo().catch(error => {
        console.error('❌ Demo failed:', error);
        process.exit(1);
    });
}