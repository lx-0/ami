/**
 * Ami — The reference agent implementation.
 * 
 * Demonstrates the capability-based architecture (DEC-003) in action:
 * - Uses CognitiveRegistry to discover available modules
 * - Communicates only through CognitiveBus events
 * - Gracefully degrades when capabilities are missing
 * 
 * This is the "hello world" of AMI — a proof that "if it runs, I AM!"
 */

import type { CognitiveBus, CognitiveRegistry, CognitiveLoop, CognitiveModule, Message } from '@ami/skeleton';

export interface AmiConfig {
    /** Maximum episode context for distillation */
    maxEpisodeContext: number;
    /** How often to trigger distillation (ms) */
    distillationInterval: number;
    /** Debug logging enabled */
    debug: boolean;
}

/**
 * Ami — The reference agent that demonstrates cognitive capabilities.
 * 
 * Architecture:
 * - Registry: Discovers available cognitive modules
 * - Bus: Event-driven communication between modules
 * - Loop: Simple OODA cycle (Observe → Orient → Decide → Act)
 * 
 * Capability graceful degradation:
 * - No episodic memory? Processes inputs immediately
 * - No distiller? Skips fact extraction
 * - No semantic memory? Facts are discarded
 * - No actuators? Runs in "silent mode"
 */
export class Ami implements CognitiveLoop {
    private readonly registry: CognitiveRegistry;
    private readonly bus: CognitiveBus;
    private readonly config: AmiConfig;
    
    private distillationTimer?: NodeJS.Timeout;
    private isRunning = false;

    constructor(
        registry: CognitiveRegistry,
        bus: CognitiveBus,
        config: Partial<AmiConfig> = {}
    ) {
        this.registry = registry;
        this.bus = bus;
        this.config = {
            maxEpisodeContext: 50,
            distillationInterval: 30000, // 30 seconds
            debug: false,
            ...config
        };

        this.setupEventHandlers();
    }

    /**
     * Start Ami's cognitive loop.
     * Initializes all registered modules and begins periodic distillation.
     */
    async start(moduleConfig: Record<string, unknown> = {}): Promise<void> {
        if (this.isRunning) {
            this.log('Already running');
            return;
        }

        this.log('🧠 Ami awakening...');

        // Initialize all registered modules
        await this.registry.initAll(moduleConfig);
        
        // Announce ourselves
        this.bus.emit('module.ready', { 
            id: 'ami-core', 
            capabilities: ['processor'], 
            status: 'ready' 
        });

        // Start periodic distillation if we have the capability
        if (this.registry.hasCapability('processor')) {
            this.startDistillationLoop();
        }

        this.isRunning = true;
        this.log('✅ Ami is alive and thinking');
    }

    /**
     * Stop Ami gracefully.
     */
    async stop(): Promise<void> {
        if (!this.isRunning) return;

        this.log('🛑 Ami shutting down...');
        
        if (this.distillationTimer) {
            clearInterval(this.distillationTimer);
        }

        await this.registry.destroyAll();
        this.isRunning = false;
        
        this.log('💤 Ami has stopped');
    }

    /**
     * Single cognitive step — the core OODA loop.
     * This can be called manually or triggered by events.
     */
    async step(): Promise<void> {
        if (!this.isRunning) return;

        this.log('🔄 Cognitive step...');

        // OBSERVE: Get recent episodes if episodic memory is available
        const episodes = await this.getRecentEpisodes();
        
        // ORIENT: Process context (future: attention/relevance filtering)
        const contextSize = episodes.length;
        
        // DECIDE: Should we distill? (simple heuristic for now)
        const shouldDistill = contextSize >= 5; // Arbitrary threshold
        
        // ACT: Trigger distillation if needed
        if (shouldDistill && this.registry.hasCapability('processor')) {
            this.log(`📚 Triggering distillation with ${contextSize} episodes`);
            this.bus.emit('episodes.batch', episodes);
        }
    }

    /**
     * Process text input — the primary interface for interaction.
     */
    async processInput(text: string, role: 'user' | 'assistant' | 'system' = 'user'): Promise<void> {
        const message: Message = {
            role,
            content: text,
            timestamp: Date.now(),
            metadata: { source: 'ami-input' }
        };

        this.log(`📥 Input: ${text.slice(0, 50)}...`);
        
        // Emit as a perception event
        this.bus.emit('perception.text', message);
        
        // Store in episodic memory if available
        const episodicModules = this.registry.getProviders('memory');
        if (episodicModules.length > 0) {
            // For simplicity, assume first memory module has episodic capability
            // Real implementation would check module-specific capabilities
            this.bus.emit('episode.store', message);
        }
    }

    private setupEventHandlers(): void {
        // Listen for facts created by distillation
        this.bus.on('fact.created', (event) => {
            const payload = event.payload as any;
            this.log(`💡 New fact discovered: ${payload.text}`);
        });

        // Listen for module status changes
        this.bus.on('module.ready', (event) => {
            const payload = event.payload as any;
            this.log(`🔧 Module ready: ${payload.id}`);
        });

        this.bus.on('module.degraded', (event) => {
            const payload = event.payload as any;
            this.log(`⚠️  Module degraded: ${payload.id}`);
        });

        // Handle text input events
        this.bus.on('perception.text', async (event) => {
            // This could trigger immediate processing or queue for later
            await this.step();
        });
    }

    private async getRecentEpisodes(): Promise<Message[]> {
        // For this reference implementation, we'll simulate episodes
        // Real implementation would query episodic memory modules
        
        if (!this.registry.hasCapability('memory')) {
            this.log('📭 No episodic memory available, returning empty episodes');
            return [];
        }

        // Placeholder: In real implementation, would call episodic memory
        // through the bus: bus.emit('episodic.query', { limit: this.config.maxEpisodeContext })
        // For now, return empty array
        return [];
    }

    private startDistillationLoop(): void {
        this.distillationTimer = setInterval(async () => {
            await this.step();
        }, this.config.distillationInterval);
        
        this.log(`⏰ Distillation loop started (${this.config.distillationInterval}ms interval)`);
    }

    private log(message: string): void {
        if (this.config.debug) {
            console.log(`[Ami] ${new Date().toISOString()} ${message}`);
        }
    }

    /**
     * Get current status and capabilities.
     */
    getStatus(): {
        running: boolean;
        capabilities: string[];
        modules: Array<{ id: string; status: string; capabilities: string[] }>;
    } {
        const modules = this.registry.getProviders('sensor')
            .concat(this.registry.getProviders('processor'))
            .concat(this.registry.getProviders('actuator'))
            .concat(this.registry.getProviders('memory'))
            .map(module => ({
                id: module.id,
                status: module.status,
                capabilities: module.capabilities
            }));

        const capabilities = ['sensor', 'processor', 'actuator', 'memory']
            .filter(cap => this.registry.hasCapability(cap as any));

        return {
            running: this.isRunning,
            capabilities,
            modules
        };
    }
}