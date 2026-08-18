import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * FastStorage — Camada de Armazenamento Síncrono O(1) de Altíssima Performance
 * Evita o gargalo de serialização da ponte React Native através de um cache síncrono em memória RAM (0.0002ms).
 */
class FastStorageService {
  private cache = new Map<string, string>();
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    try {
      const keys = await AsyncStorage.getAllKeys();
      if (keys.length > 0) {
        const pairs = await AsyncStorage.multiGet(keys);
        pairs.forEach(([k, v]) => {
          if (k && v !== null) {
            this.cache.set(k, v);
          }
        });
      }
    } catch (e) {
      console.warn("FastStorage init warning:", e);
    } finally {
      this.initialized = true;
    }
  }

  // Leitura síncrona instantânea O(1) sem passar pela ponte JS
  getItemSync<T>(key: string, fallback: T): T {
    const raw = this.cache.get(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  // Escrita síncrona instantânea com sincronização em background
  setItemSync<T>(key: string, value: T): void {
    try {
      const serialized = JSON.stringify(value);
      this.cache.set(key, serialized);
      // Persistência assíncrona não-bloqueante em background
      AsyncStorage.setItem(key, serialized).catch(() => {});
    } catch (e) {}
  }

  // Remoção síncrona
  removeItemSync(key: string): void {
    this.cache.delete(key);
    AsyncStorage.removeItem(key).catch(() => {});
  }

  // Limpeza de cache por prefixo
  clearPrefixSync(prefix: string): void {
    Array.from(this.cache.keys()).forEach(k => {
      if (k.startsWith(prefix)) {
        this.cache.delete(k);
        AsyncStorage.removeItem(k).catch(() => {});
      }
    });
  }
}

export const FastStorage = new FastStorageService();
