// generation/registry.ts — the provider/model registry (DDR-16x). Maps a
// provider id → its descriptor + adapter factory, and answers capability
// lookups ("which providers can do image?") for routing + the Settings panel.
//
// Adding a provider = one entry here. Phase 0 ships Gemini (image); Phase 1 adds
// fal, Phase 2 ElevenLabs, etc. — each is a factory + descriptor, no route change.
//
// The registry holds FACTORIES, not live adapters: an adapter is instantiated
// per-request with the resolved key + localizer injected (AdapterContext), so a
// key never lives on a long-held adapter object.

import { createGeminiAdapter, GEMINI_DESCRIPTOR, GEMINI_MODELS } from './adapters/gemini.ts';
import type {
  AdapterContext,
  AdapterFactory,
  Modality,
  ModelDescriptor,
  ProviderAdapter,
  ProviderDescriptor,
} from './types.ts';

interface ProviderEntry {
  descriptor: ProviderDescriptor;
  factory: AdapterFactory;
  /** Static model list (aggregators refresh via adapter.listModels at runtime). */
  models: ModelDescriptor[];
}

const PROVIDERS: Record<string, ProviderEntry> = {
  gemini: {
    descriptor: GEMINI_DESCRIPTOR,
    factory: createGeminiAdapter,
    models: GEMINI_MODELS,
  },
};

/** Every registered provider descriptor (inert — safe to serialize to the UI). */
export function listProviders(): ProviderDescriptor[] {
  return Object.values(PROVIDERS).map((p) => p.descriptor);
}

/** The descriptor for one provider, or null when unknown. */
export function getProviderDescriptor(id: string): ProviderDescriptor | null {
  return PROVIDERS[id]?.descriptor ?? null;
}

/** The static model list for one provider. */
export function getProviderModels(id: string): ModelDescriptor[] {
  return PROVIDERS[id]?.models ?? [];
}

/** All providers that can produce a given modality (routing + capability UI). */
export function providersForModality(modality: Modality): ProviderDescriptor[] {
  return listProviders().filter((d) => d.modalities.includes(modality));
}

/** Whether a provider id is registered. */
export function hasProvider(id: string): boolean {
  return id in PROVIDERS;
}

/**
 * Instantiate the adapter for `providerId` with a per-request context. Throws on
 * an unknown provider (the route validates first, so this is a defensive guard).
 */
export function createAdapter(providerId: string, ctx: AdapterContext): ProviderAdapter {
  const entry = PROVIDERS[providerId];
  if (!entry) throw new Error(`unknown provider: ${providerId}`);
  return entry.factory(ctx);
}
