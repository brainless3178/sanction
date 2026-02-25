// SSS-1: Minimal stablecoin. No compliance features.
export const SSS1_PRESET = {
    enablePermanentDelegate: false,
    enableTransferHook: false,
    defaultAccountFrozen: false,
} as const;

// SSS-2: Full institutional controls.
// Permanent delegate for seize, transfer hook for blacklist enforcement.
export const SSS2_PRESET = {
    enablePermanentDelegate: true,
    enableTransferHook: true,
    defaultAccountFrozen: false,
} as const;

export type PresetConfig = typeof SSS1_PRESET | typeof SSS2_PRESET;

export function resolvePreset(preset: 'SSS_1' | 'SSS_2'): PresetConfig {
    switch (preset) {
        case 'SSS_1':
            return SSS1_PRESET;
        case 'SSS_2':
            return SSS2_PRESET;
        default:
            throw new Error(`Unknown preset: ${preset}`);
    }
}
