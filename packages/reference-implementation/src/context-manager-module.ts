/**
 * ContextManagerModule — ContextManager wrapped as a CognitiveModule.
 *
 * Subscribes to perception events and fact updates, maintains focused
 * attention window, and emits `context.changed` events when focus shifts.
 *
 * This demonstrates how attention/relevance filtering integrates with
 * the capability-based OS architecture (DEC-003).
 *
 * @see ROADMAP.md — "ContextManager implementation (attention/relevance filtering)"
 */

import type {
    CognitiveBus,
    CognitiveCapability,
    CognitiveModule,
    Message,
    Fact,
} from '@ami/skeleton';

import { ReferenceContextManager } from './context-manager.js';
import type { ContextManagerConfig, ContextWindow } from './context-manager.js';

export interface ContextManagerModuleConfig extends ContextManagerConfig {
    /** Whether to auto-update context on incoming messages */
    autoUpdate?: boolean;
    /** Minimum time between context updates (ms) */
    updateThrottleMs?: number;
}

export class ContextManagerModule implements CognitiveModule {
    readonly id = 'processor.context';
    readonly name = 'Context Manager';
    readonly capabilities: CognitiveCapability[] = ['processor'];

    status: CognitiveModule['status'] = 'registered';

    private bus: CognitiveBus | null = null;
    private contextManager: ReferenceContextManager | null = null;
    private readonly moduleConfig: ContextManagerModuleConfig;
    private readonly factsBuffer: Fact[] = [];
    private lastUpdateTime = 0;

    constructor(config: ContextManagerModuleConfig = {}) {
        this.moduleConfig = {
            autoUpdate: config.autoUpdate ?? true,
            updateThrottleMs: config.updateThrottleMs ?? 1000,
            ...config
        };
    }

    async init(bus: CognitiveBus, _config: Record<string, unknown>): Promise<void> {
        this.status = 'initializing';

        this.bus = bus;
        this.contextManager = new ReferenceContextManager(this.moduleConfig);

        // Subscribe to inputs that affect context
        if (this.moduleConfig.autoUpdate) {
            bus.on<Message>('perception.text', this.handleTextPerception);
            bus.on<Message>('perception.audio', this.handleAudioPerception);
            bus.on<Fact>('fact.created', this.handleNewFact);
            bus.on<Fact>('fact.updated', this.handleUpdatedFact);
        }

        // Subscribe to manual context update requests
        bus.on<{ messages?: Message[]; facts?: Fact[] }>('context.update', this.handleContextUpdateRequest);

        this.status = 'ready';
        bus.emit('module.ready', { moduleId: this.id });
    }

    async destroy(): Promise<void> {
        if (this.bus) {
            this.bus.off('perception.text', this.handleTextPerception);
            this.bus.off('perception.audio', this.handleAudioPerception);
            this.bus.off('fact.created', this.handleNewFact);
            this.bus.off('fact.updated', this.handleUpdatedFact);
            this.bus.off('context.update', this.handleContextUpdateRequest);
        }
        this.bus = null;
        this.contextManager = null;
        this.status = 'stopped';
    }

    /**
     * Get current context window.
     */
    getCurrentContext(): ContextWindow | null {
        return this.contextManager?.getCurrentContext() ?? null;
    }

    /**
     * Handle text perception (user input, etc.)
     */
    private handleTextPerception = async (event: { payload: Message }): Promise<void> => {
        await this.processNewMessage(event.payload);
    };

    /**
     * Handle audio perception (transcribed speech, etc.)
     */
    private handleAudioPerception = async (event: { payload: Message }): Promise<void> => {
        await this.processNewMessage(event.payload);
    };

    /**
     * Handle new fact creation from distillation
     */
    private handleNewFact = async (event: { payload: Fact }): Promise<void> => {
        this.factsBuffer.push(event.payload);
        await this.maybeUpdateContext();
    };

    /**
     * Handle fact updates
     */
    private handleUpdatedFact = async (event: { payload: Fact }): Promise<void> => {
        // Replace existing fact in buffer or add if not present
        const existingIndex = this.factsBuffer.findIndex(f => f.id === event.payload.id);
        if (existingIndex >= 0) {
            this.factsBuffer[existingIndex] = event.payload;
        } else {
            this.factsBuffer.push(event.payload);
        }
        await this.maybeUpdateContext();
    };

    /**
     * Handle manual context update requests
     */
    private handleContextUpdateRequest = async (event: { 
        payload: { messages?: Message[]; facts?: Fact[] } 
    }): Promise<void> => {
        if (!this.contextManager || !this.bus) return;

        try {
            const { messages = [], facts } = event.payload;
            
            // If facts provided, update buffer
            if (facts) {
                this.factsBuffer.splice(0, this.factsBuffer.length, ...facts);
            }

            const result = await this.contextManager.updateContext(messages, this.factsBuffer);
            
            if (result.contextChanged) {
                this.bus.emit('context.changed', result.context);
            }

            this.lastUpdateTime = Date.now();
        } catch (err) {
            console.error(`[ContextManagerModule] Manual context update failed:`, err);
            this.status = 'degraded';
            this.bus?.emit('module.degraded', {
                moduleId: this.id,
                reason: String(err),
            });
        }
    };

    private async processNewMessage(message: Message): Promise<void> {
        await this.maybeUpdateContext([message]);
    }

    private async maybeUpdateContext(newMessages: Message[] = []): Promise<void> {
        if (!this.contextManager || !this.bus) return;

        // Throttle updates to avoid excessive processing
        const now = Date.now();
        if (now - this.lastUpdateTime < this.moduleConfig.updateThrottleMs!) {
            return;
        }

        try {
            const result = await this.contextManager.updateContext(newMessages, this.factsBuffer);
            
            if (result.contextChanged) {
                this.bus.emit('context.changed', result.context);
            }

            this.lastUpdateTime = now;
        } catch (err) {
            console.error(`[ContextManagerModule] Context update failed:`, err);
            this.status = 'degraded';
            this.bus?.emit('module.degraded', {
                moduleId: this.id,
                reason: String(err),
            });
        }
    }
}