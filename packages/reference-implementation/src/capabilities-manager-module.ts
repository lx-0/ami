/**
 * CapabilitiesManagerModule — CapabilitiesManager wrapped as a CognitiveModule.
 *
 * Subscribes to `task.analyze` events on the CognitiveBus, analyzes the task
 * for appropriate capabilities, and emits `capabilities.suggested` events
 * with ranked tool/module recommendations.
 *
 * This enables intelligent tool pre-selection throughout the cognitive system.
 *
 * Events:
 * - Listens to: 'task.analyze'
 * - Emits: 'capabilities.suggested'
 *
 * @see ROADMAP.md — "CapabilitiesManager for tool pre-selection"
 * @see DEC-003 — Capability-based Modular Architecture
 */

import type {
    CognitiveBus,
    CognitiveCapability,
    CognitiveModule,
} from '@ami/skeleton';

import { 
    CapabilitiesManager, 
    PatternBasedAnalysisStrategy,
    type CapabilitiesManagerConfig,
    type TaskAnalysisRequest,
    type CapabilitiesAnalysis
} from './capabilities-manager.js';

export interface CapabilitiesManagerModuleConfig {
    /** Configuration for the underlying capabilities manager */
    managerConfig?: Partial<CapabilitiesManagerConfig>;
    /** Whether to auto-analyze context changes */
    autoAnalyzeContext?: boolean;
    /** Whether to log analysis results */
    enableLogging?: boolean;
}

export class CapabilitiesManagerModule implements CognitiveModule {
    readonly id = 'processor.capabilities-manager';
    readonly name = 'Capabilities Manager';
    readonly capabilities: CognitiveCapability[] = ['processor'];

    status: CognitiveModule['status'] = 'registered';

    private bus: CognitiveBus | null = null;
    private manager: CapabilitiesManager | null = null;
    private readonly moduleConfig: CapabilitiesManagerModuleConfig;

    constructor(config: CapabilitiesManagerModuleConfig = {}) {
        this.moduleConfig = config;
    }

    async init(bus: CognitiveBus, _config: Record<string, unknown>): Promise<void> {
        this.status = 'initializing';

        this.bus = bus;

        // Create the capabilities manager with default strategy
        const managerConfig: CapabilitiesManagerConfig = {
            strategy: new PatternBasedAnalysisStrategy(),
            maxSuggestions: 10,
            minConfidence: 0.1,
            enableMetrics: true,
            ...this.moduleConfig.managerConfig
        };

        this.manager = new CapabilitiesManager(managerConfig);

        // Subscribe to task analysis requests
        bus.on<TaskAnalysisRequest>('task.analyze', this.handleTaskAnalysis);

        // Optionally subscribe to context changes for auto-analysis
        if (this.moduleConfig.autoAnalyzeContext) {
            bus.on('context.changed', this.handleContextChange);
        }

        this.status = 'ready';
        
        if (this.moduleConfig.enableLogging) {
            console.log('[CapabilitiesManager] Module initialized and ready for task analysis');
        }
    }

    async destroy(): Promise<void> {
        if (this.bus) {
            this.bus.off('task.analyze', this.handleTaskAnalysis);
            if (this.moduleConfig.autoAnalyzeContext) {
                this.bus.off('context.changed', this.handleContextChange);
            }
        }
        this.bus = null;
        this.manager = null;
        this.status = 'stopped';
    }

    /**
     * Handle an incoming task analysis request.
     * Analyzes the task and emits capability suggestions.
     */
    private handleTaskAnalysis = async (event: { payload: TaskAnalysisRequest }): Promise<void> => {
        if (!this.manager || !this.bus) return;

        try {
            const analysis: CapabilitiesAnalysis = await this.manager.analyzeTask(event.payload);

            if (this.moduleConfig.enableLogging && analysis.suggestions.length > 0) {
                console.log(
                    `[CapabilitiesManager] Analyzed task: "${analysis.task.description.substring(0, 50)}..." ` +
                    `→ ${analysis.suggestions.length} suggestions (${analysis.processingTime}ms)`
                );

                // Log top 3 suggestions
                const topSuggestions = analysis.suggestions.slice(0, 3);
                for (const suggestion of topSuggestions) {
                    console.log(
                        `  • ${suggestion.name} (${suggestion.confidence.toFixed(2)}) - ${suggestion.reason}`
                    );
                }
            }

            // Emit the analysis results
            this.bus.emit('capabilities.suggested', analysis);

        } catch (error) {
            console.error('[CapabilitiesManagerModule] Task analysis failed:', error);
            this.status = 'degraded';
            
            if (this.bus) {
                this.bus.emit('module.degraded', {
                    moduleId: this.id,
                    reason: `Task analysis failed: ${String(error)}`
                });
            }
        }
    };

    /**
     * Handle context changes for auto-analysis.
     * Extracts potential tasks from context and suggests capabilities.
     */
    private handleContextChange = async (event: { payload: any }): Promise<void> => {
        if (!this.manager || !this.bus || !this.moduleConfig.autoAnalyzeContext) return;

        try {
            // Extract task hints from context change
            const contextPayload = event.payload;
            let taskDescription = '';

            // Try to extract meaningful task description from context
            if (typeof contextPayload === 'string') {
                taskDescription = contextPayload;
            } else if (contextPayload?.focusTopics && Array.isArray(contextPayload.focusTopics)) {
                taskDescription = contextPayload.focusTopics.join(' ');
            } else if (contextPayload?.summary) {
                taskDescription = contextPayload.summary;
            }

            if (taskDescription && taskDescription.length > 10) {
                const analysisRequest: TaskAnalysisRequest = {
                    description: taskDescription,
                    context: contextPayload?.context || [],
                    priority: 'low' // Auto-analysis has low priority
                };

                const analysis = await this.manager.analyzeTask(analysisRequest);

                // Only emit if we have confident suggestions
                const confidentSuggestions = analysis.suggestions.filter(s => s.confidence >= 0.6);
                if (confidentSuggestions.length > 0) {
                    this.bus.emit('capabilities.suggested', {
                        ...analysis,
                        suggestions: confidentSuggestions
                    });

                    if (this.moduleConfig.enableLogging) {
                        console.log(
                            `[CapabilitiesManager] Auto-analyzed context change → ${confidentSuggestions.length} suggestions`
                        );
                    }
                }
            }
        } catch (error) {
            if (this.moduleConfig.enableLogging) {
                console.warn('[CapabilitiesManagerModule] Context auto-analysis failed:', error);
            }
            // Don't degrade the module for auto-analysis failures
        }
    };

    /**
     * Get current performance metrics from the capabilities manager.
     */
    getMetrics() {
        return this.manager?.getMetrics() || null;
    }

    /**
     * Manually trigger task analysis (for testing/debugging).
     */
    async analyzeTask(request: TaskAnalysisRequest): Promise<CapabilitiesAnalysis | null> {
        if (!this.manager) return null;
        return await this.manager.analyzeTask(request);
    }
}