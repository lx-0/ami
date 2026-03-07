/**
 * DistillerModule — KnowledgeDistiller wrapped as a CognitiveModule.
 *
 * Subscribes to `episodes.batch` events on the CognitiveBus, runs the
 * distillation pipeline, and emits a `fact.created` event for each new fact.
 *
 * This is the reference example of how existing implementations are adapted
 * to the capability-based OS architecture (DEC-003).
 *
 * @see ROADMAP.md — "Refactor KnowledgeDistiller as a registered processor"
 */

import type {
    CognitiveBus,
    CognitiveCapability,
    CognitiveModule,
    Fact,
    Message,
} from '@ami/skeleton';

import { ReferenceKnowledgeDistiller } from './knowledge-distiller.js';
import type { ExtractionStrategy, DistillerConfig } from './knowledge-distiller.js';

export interface DistillerModuleConfig {
    /** Extraction strategy for the underlying distiller */
    strategy: ExtractionStrategy;
    /** Optional distiller pipeline config */
    distillerConfig?: DistillerConfig;
}

export class DistillerModule implements CognitiveModule {
    readonly id = 'processor.distiller';
    readonly name = 'Knowledge Distiller';
    readonly capabilities: CognitiveCapability[] = ['processor'];

    status: CognitiveModule['status'] = 'registered';

    private bus: CognitiveBus | null = null;
    private distiller: ReferenceKnowledgeDistiller | null = null;
    private readonly moduleConfig: DistillerModuleConfig;

    constructor(config: DistillerModuleConfig) {
        this.moduleConfig = config;
    }

    async init(bus: CognitiveBus, _config: Record<string, unknown>): Promise<void> {
        this.status = 'initializing';

        this.bus = bus;
        this.distiller = new ReferenceKnowledgeDistiller(
            this.moduleConfig.strategy,
            this.moduleConfig.distillerConfig,
        );

        // Subscribe to episode batches
        bus.on<Message[]>('episodes.batch', this.handleEpisodeBatch);

        this.status = 'ready';
        bus.emit('module.ready', { moduleId: this.id });
    }

    async destroy(): Promise<void> {
        if (this.bus) {
            this.bus.off('episodes.batch', this.handleEpisodeBatch);
        }
        this.bus = null;
        this.distiller = null;
        this.status = 'stopped';
    }

    /**
     * Handle an incoming batch of episodes.
     * Runs the distillation pipeline and emits `fact.created` for each result.
     */
    private handleEpisodeBatch = async (event: { payload: Message[] }): Promise<void> => {
        if (!this.distiller || !this.bus) return;

        try {
            const facts: Fact[] = await this.distiller.distill(event.payload);

            for (const fact of facts) {
                this.bus.emit('fact.created', fact);
            }
        } catch (err) {
            console.error(`[DistillerModule] Distillation failed:`, err);
            this.status = 'degraded';
            this.bus.emit('module.degraded', {
                moduleId: this.id,
                reason: String(err),
            });
        }
    };
}
