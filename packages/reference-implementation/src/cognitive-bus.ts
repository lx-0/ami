/**
 * ReferenceCognitiveBus — A simple synchronous event emitter implementing CognitiveBus.
 *
 * This is the nervous system of the cognitive architecture. All modules
 * communicate exclusively through this bus — no direct calls between modules.
 *
 * Design: intentionally simple (in-process, synchronous dispatch). Production
 * systems may replace this with async queues, distributed buses, etc.
 *
 * @see DEC-003 — Capability-based Modular Architecture
 */

import type { CognitiveBus, CognitiveEvent, CognitiveEventHandler } from '@ami/skeleton';

export class ReferenceCognitiveBus implements CognitiveBus {
    private handlers = new Map<string, Set<CognitiveEventHandler<unknown>>>();
    private onceHandlers = new WeakSet<CognitiveEventHandler<unknown>>();

    emit<T>(type: string, payload: T): void {
        const event: CognitiveEvent<T> = {
            type,
            payload,
            timestamp: new Date().toISOString(),
        };

        const subscribers = this.handlers.get(type);
        if (!subscribers) return;

        // Iterate over a copy so handlers can safely unsubscribe during dispatch
        for (const handler of [...subscribers]) {
            try {
                const result = (handler as CognitiveEventHandler<T>)(event);
                // Fire-and-forget for async handlers — errors are caught below
                if (result instanceof Promise) {
                    result.catch((err) => {
                        console.error(`[CognitiveBus] Async handler error for "${type}":`, err);
                    });
                }
            } catch (err) {
                console.error(`[CognitiveBus] Handler error for "${type}":`, err);
            }

            // Auto-remove once handlers
            if (this.onceHandlers.has(handler)) {
                subscribers.delete(handler);
                this.onceHandlers.delete(handler);
            }
        }
    }

    on<T>(type: string, handler: CognitiveEventHandler<T>): void {
        if (!this.handlers.has(type)) {
            this.handlers.set(type, new Set());
        }
        this.handlers.get(type)!.add(handler as CognitiveEventHandler<unknown>);
    }

    off<T>(type: string, handler: CognitiveEventHandler<T>): void {
        const subscribers = this.handlers.get(type);
        if (subscribers) {
            subscribers.delete(handler as CognitiveEventHandler<unknown>);
            if (subscribers.size === 0) {
                this.handlers.delete(type);
            }
        }
    }

    once<T>(type: string, handler: CognitiveEventHandler<T>): void {
        this.onceHandlers.add(handler as CognitiveEventHandler<unknown>);
        this.on(type, handler);
    }
}
