import {
  DEFAULT_SETTINGS,
  LEGACY_SETTINGS_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  normalizeSettings,
  type ExtensionSettings,
} from '../../domain/settings';
import type { StoragePort } from '../../ports/StoragePort';

export class SettingsService {
  constructor(private readonly storage: StoragePort) {}

  async load(): Promise<ExtensionSettings> {
    const current = await this.storage.get<unknown>(SETTINGS_STORAGE_KEY);
    if (current) {
      return normalizeSettings(current);
    }

    const legacy = await this.storage.get<unknown>(LEGACY_SETTINGS_STORAGE_KEY);
    if (legacy) {
      return normalizeSettings(legacy);
    }

    return DEFAULT_SETTINGS;
  }

  async save(settings: ExtensionSettings): Promise<ExtensionSettings> {
    const normalized = normalizeSettings(settings);
    await this.storage.set(SETTINGS_STORAGE_KEY, normalized);
    return normalized;
  }
}

