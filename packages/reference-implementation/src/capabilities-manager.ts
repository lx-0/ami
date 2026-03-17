/**
 * CapabilitiesManager — Tool pre-selection and capability routing.
 *
 * This module analyzes incoming tasks/requests and suggests the most appropriate
 * cognitive modules and tools to handle them. It acts as an intelligent router
 * that helps the system decide which capabilities to activate for a given context.
 *
 * Features:
 * - Tool pre-selection based on task analysis
 * - Capability ranking by relevance and availability
 * - Context-aware routing suggestions
 * - Performance tracking for continuous improvement
 *
 * Events:
 * - Listens to: 'task.analyze' (task description + context)
 * - Emits: 'capabilities.suggested' (ranked list of tools/modules)
 *
 * @see ROADMAP.md — "CapabilitiesManager for tool pre-selection"
 * @see DEC-003 — Capability-based Modular Architecture
 */

export interface TaskAnalysisRequest {
    /** The task description or user intent */
    description: string;
    /** Current conversation context */
    context?: string[];
    /** Available tools/capabilities in the environment */
    availableTools?: string[];
    /** User preferences or constraints */
    constraints?: Record<string, unknown>;
    /** Priority level */
    priority?: 'low' | 'medium' | 'high' | 'urgent';
}

export interface CapabilitySuggestion {
    /** Capability or tool identifier */
    id: string;
    /** Capability type */
    type: 'sensor' | 'processor' | 'actuator' | 'memory' | 'tool';
    /** Human-readable name */
    name: string;
    /** Confidence score (0-1) */
    confidence: number;
    /** Why this capability is suggested */
    reason: string;
    /** Estimated cost/complexity */
    cost: 'low' | 'medium' | 'high';
    /** Prerequisites or dependencies */
    dependencies?: string[];
}

export interface CapabilitiesAnalysis {
    /** Original task request */
    task: TaskAnalysisRequest;
    /** Suggested capabilities ranked by relevance */
    suggestions: CapabilitySuggestion[];
    /** Analysis timestamp */
    timestamp: string;
    /** Processing time in ms */
    processingTime: number;
}

/**
 * Strategy interface for capability analysis.
 * Enables different approaches to tool pre-selection.
 */
export interface CapabilityAnalysisStrategy {
    analyze(request: TaskAnalysisRequest): Promise<CapabilitySuggestion[]>;
}

/**
 * Configuration for the CapabilitiesManager.
 */
export interface CapabilitiesManagerConfig {
    /** Strategy for analyzing tasks and suggesting capabilities */
    strategy: CapabilityAnalysisStrategy;
    /** Maximum number of suggestions to return */
    maxSuggestions?: number;
    /** Minimum confidence threshold for suggestions */
    minConfidence?: number;
    /** Whether to track performance metrics */
    enableMetrics?: boolean;
}

/**
 * Pattern-based capability analysis strategy.
 * 
 * Uses keyword patterns and heuristics to match tasks to capabilities.
 * This is a simple, fast implementation suitable for most use cases.
 */
export class PatternBasedAnalysisStrategy implements CapabilityAnalysisStrategy {
    private readonly patterns = new Map<string, CapabilitySuggestion[]>([
        // Text and communication
        ['write|compose|draft|create.*text', [{
            id: 'text-generator',
            type: 'processor',
            name: 'Text Generator',
            confidence: 0.9,
            reason: 'Task involves text creation',
            cost: 'medium'
        }]],
        
        ['send|message|email|notify|alert', [{
            id: 'messaging',
            type: 'actuator', 
            name: 'Messaging System',
            confidence: 0.85,
            reason: 'Task involves sending communications',
            cost: 'low'
        }]],

        // Audio and speech
        ['speak|say|voice|audio|tts|speech', [{
            id: 'tts',
            type: 'actuator',
            name: 'Text-to-Speech',
            confidence: 0.9,
            reason: 'Task requires audio output',
            cost: 'medium'
        }]],
        
        ['listen|hear|transcribe|stt', [{
            id: 'stt',
            type: 'sensor',
            name: 'Speech-to-Text',
            confidence: 0.9,
            reason: 'Task involves audio input processing',
            cost: 'medium'
        }]],

        // Visual and image processing  
        ['image|photo|picture|visual|see|look|camera', [{
            id: 'vision',
            type: 'sensor',
            name: 'Vision System',
            confidence: 0.85,
            reason: 'Task involves visual processing',
            cost: 'high'
        }]],
        
        ['display|show|render|ui|screen', [{
            id: 'display',
            type: 'actuator',
            name: 'Display System', 
            confidence: 0.8,
            reason: 'Task requires visual output',
            cost: 'medium'
        }]],

        // Memory and knowledge
        ['remember|store|save|archive|memory', [{
            id: 'episodic-memory',
            type: 'memory',
            name: 'Episodic Memory',
            confidence: 0.8,
            reason: 'Task involves storing experiences',
            cost: 'low'
        }]],
        
        ['search|find|lookup|query|recall|know', [{
            id: 'semantic-memory',
            type: 'memory', 
            name: 'Semantic Memory',
            confidence: 0.85,
            reason: 'Task involves knowledge retrieval',
            cost: 'medium'
        }]],

        // Analysis and processing
        ['analyze|process|distill|extract|learn', [{
            id: 'knowledge-distiller',
            type: 'processor',
            name: 'Knowledge Distiller',
            confidence: 0.75,
            reason: 'Task involves data analysis or learning',
            cost: 'high'
        }]],

        // Control and automation
        ['control|automate|execute|run|manage', [{
            id: 'automation',
            type: 'actuator',
            name: 'Automation System',
            confidence: 0.7,
            reason: 'Task involves system control',
            cost: 'medium'
        }]],

        // Web and external services
        ['web|internet|browse|url|api|http', [{
            id: 'web-access',
            type: 'actuator',
            name: 'Web Access',
            confidence: 0.8,
            reason: 'Task requires internet connectivity',
            cost: 'medium'
        }]],

        // File operations
        ['file|document|read|write|edit|folder', [{
            id: 'file-system',
            type: 'actuator',
            name: 'File System',
            confidence: 0.85,
            reason: 'Task involves file operations',
            cost: 'low'
        }]]
    ]);

    async analyze(request: TaskAnalysisRequest): Promise<CapabilitySuggestion[]> {
        const suggestions: CapabilitySuggestion[] = [];
        const description = request.description.toLowerCase();

        // Score each pattern against the task description
        for (const [pattern, capabilities] of this.patterns) {
            const regex = new RegExp(pattern, 'i');
            if (regex.test(description)) {
                suggestions.push(...capabilities);
            }
        }

        // Context analysis - boost suggestions if related tools are available
        if (request.availableTools) {
            for (const suggestion of suggestions) {
                if (request.availableTools.includes(suggestion.id)) {
                    suggestion.confidence = Math.min(1.0, suggestion.confidence + 0.1);
                    suggestion.reason += ' (tool available in environment)';
                }
            }
        }

        // Priority adjustment
        if (request.priority === 'urgent' || request.priority === 'high') {
            for (const suggestion of suggestions) {
                if (suggestion.cost === 'low' || suggestion.cost === 'medium') {
                    suggestion.confidence = Math.min(1.0, suggestion.confidence + 0.05);
                }
            }
        }

        // Remove duplicates and sort by confidence
        const uniqueSuggestions = Array.from(
            new Map(suggestions.map(s => [s.id, s])).values()
        ).sort((a, b) => b.confidence - a.confidence);

        return uniqueSuggestions;
    }
}

/**
 * Main CapabilitiesManager class.
 * 
 * Provides intelligent tool pre-selection and capability routing for cognitive tasks.
 */
export class CapabilitiesManager {
    private readonly config: Required<CapabilitiesManagerConfig>;
    private readonly metrics: {
        totalAnalyses: number;
        averageProcessingTime: number;
        accuracyScore: number;
    } = {
        totalAnalyses: 0,
        averageProcessingTime: 0,
        accuracyScore: 0
    };

    constructor(config: CapabilitiesManagerConfig) {
        this.config = {
            maxSuggestions: 10,
            minConfidence: 0.1,
            enableMetrics: true,
            ...config
        };
    }

    /**
     * Analyze a task and suggest appropriate capabilities.
     */
    async analyzeTask(request: TaskAnalysisRequest): Promise<CapabilitiesAnalysis> {
        const startTime = Date.now();

        try {
            // Run the analysis strategy
            const rawSuggestions = await this.config.strategy.analyze(request);

            // Apply filtering and limits
            const filteredSuggestions = rawSuggestions
                .filter(s => s.confidence >= this.config.minConfidence)
                .slice(0, this.config.maxSuggestions);

            const processingTime = Date.now() - startTime;

            // Update metrics if enabled
            if (this.config.enableMetrics) {
                this.updateMetrics(processingTime);
            }

            return {
                task: request,
                suggestions: filteredSuggestions,
                timestamp: new Date().toISOString(),
                processingTime
            };
        } catch (error) {
            const processingTime = Date.now() - startTime;
            console.error('[CapabilitiesManager] Analysis failed:', error);
            
            return {
                task: request,
                suggestions: [],
                timestamp: new Date().toISOString(),
                processingTime
            };
        }
    }

    /**
     * Get the top N capability suggestions for a task.
     */
    async getTopSuggestions(
        description: string, 
        count: number = 3,
        context?: Partial<TaskAnalysisRequest>
    ): Promise<CapabilitySuggestion[]> {
        const analysis = await this.analyzeTask({
            description,
            ...context
        });

        return analysis.suggestions.slice(0, count);
    }

    /**
     * Check if a specific capability is recommended for a task.
     */
    async isCapabilityRecommended(
        description: string,
        capabilityId: string,
        minConfidence: number = 0.5
    ): Promise<{ recommended: boolean; confidence?: number; reason?: string }> {
        const analysis = await this.analyzeTask({ description });
        const suggestion = analysis.suggestions.find(s => s.id === capabilityId);

        if (!suggestion) {
            return { recommended: false };
        }

        return {
            recommended: suggestion.confidence >= minConfidence,
            confidence: suggestion.confidence,
            reason: suggestion.reason
        };
    }

    /**
     * Get performance metrics.
     */
    getMetrics() {
        return { ...this.metrics };
    }

    /**
     * Reset performance metrics.
     */
    resetMetrics(): void {
        this.metrics.totalAnalyses = 0;
        this.metrics.averageProcessingTime = 0;
        this.metrics.accuracyScore = 0;
    }

    private updateMetrics(processingTime: number): void {
        this.metrics.totalAnalyses++;
        
        // Update rolling average processing time
        const weight = 1 / this.metrics.totalAnalyses;
        this.metrics.averageProcessingTime = 
            (1 - weight) * this.metrics.averageProcessingTime + 
            weight * processingTime;
    }
}