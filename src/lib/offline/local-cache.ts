import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { postMemory } from './post-memory';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';

// Structured cache only. Credentials stay in SecureStore; media stays in the file cache.
let database: Promise<SQLite.SQLiteDatabase> | undefined;
let cipherUnavailable = false;
let account: string | null = null;
let generation = 0;
let operations: Promise<unknown> = Promise.resolve();
const memory = new Map<string, { value: unknown; savedAt: number }>();

async function openDatabase() {
  if (cipherUnavailable) throw new Error('Encrypted cache requires a native rebuild');
  if (Platform.OS === 'web') throw new Error('Native cache only');
  if (!database)
    database = (async () => {
      const db = await SQLite.openDatabaseAsync('yrdly-encrypted-cache-v1.db');
      const cipher = await db.getFirstAsync<Record<string, string>>('PRAGMA cipher_version');
      // Expo Go / old binaries cannot provide SQLCipher. Keep working online/in memory.
      if (!cipher || !Object.values(cipher).some(Boolean)) {
        cipherUnavailable = true;
        await db.closeAsync();
        throw new Error('Encrypted cache requires the updated native build');
      }
      let key = await SecureStore.getItemAsync('yrdly-cache-key');
      if (!key) {
        key = Array.from(await Crypto.getRandomBytesAsync(32), (b) =>
          b.toString(16).padStart(2, '0')
        ).join('');
        await SecureStore.setItemAsync('yrdly-cache-key', key);
      }
      if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('Invalid cache key');
      await db.execAsync(
        `PRAGMA key = "x'${key}'"; PRAGMA journal_mode = WAL; PRAGMA secure_delete = ON;`
      );
      const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      if ((version?.user_version ?? 0) < 1) {
        await db.withTransactionAsync(async () => {
          await db.execAsync(`CREATE TABLE IF NOT EXISTS cache_entries (
          account_id TEXT NOT NULL, namespace TEXT NOT NULL, id TEXT NOT NULL,
          payload TEXT NOT NULL, saved_at INTEGER NOT NULL,
          PRIMARY KEY (account_id, namespace, id)
        ); PRAGMA user_version = 1;`);
        });
      }
      return db;
    })().catch((error) => {
      database = undefined;
      throw error;
    });
  return database;
}

function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const result = operations.catch(() => {}).then(work);
  operations = result;
  return result;
}

export const localCache = {
  setAccount(next: string | null) {
    if (next === account) return;
    postMemory.setAccount(next);
    account = next;
    generation++;
    memory.clear();
    if (!next) {
      void Image.clearMemoryCache().catch(() => {});
      void Image.clearDiskCache().catch(() => {});
    }
    // Retire the old cross-account plaintext caches without touching user media.
    if (FileSystem.documentDirectory)
      void FileSystem.readDirectoryAsync(FileSystem.documentDirectory)
        .then((files) =>
          Promise.all(
            files
              .filter(
                (name) =>
                  name === 'user_profile_cache.json' || /^yrdly_posts_cache_.*\.json$/.test(name)
              )
              .map((name) =>
                FileSystem.deleteAsync(FileSystem.documentDirectory + name, { idempotent: true })
              )
          )
        )
        .catch(() => {});
    void enqueue(async () => {
      const db = await openDatabase();
      if (account) await db.runAsync('DELETE FROM cache_entries WHERE account_id <> ?', account);
      else await db.runAsync('DELETE FROM cache_entries');
    }).catch(() => {});
  },
  async read<T>(owner: string, namespace: string, id: string, maxAge = 15 * 60 * 1000) {
    const epoch = generation;
    if (owner !== account) return null;
    return enqueue(async () => {
      const memoryKey = `${owner}:${namespace}:${id}`;
      let entry = memory.get(memoryKey);
      if (!entry) {
        try {
          const db = await openDatabase();
          const row = await db.getFirstAsync<{ payload: string; saved_at: number }>(
            'SELECT payload, saved_at FROM cache_entries WHERE account_id = ? AND namespace = ? AND id = ?',
            owner,
            namespace,
            id
          );
          if (row) entry = { value: JSON.parse(row.payload), savedAt: row.saved_at };
        } catch {
          /* Cache failure must not prevent online use. */
        }
      }
      if (
        epoch !== generation ||
        owner !== account ||
        !entry ||
        Date.now() - entry.savedAt > maxAge
      )
        return null;
      return { value: entry.value as T, savedAt: entry.savedAt };
    });
  },
  async write<T>(owner: string, namespace: string, id: string, value: T, savedAt = Date.now()) {
    const epoch = generation;
    return enqueue(async () => {
      if (epoch !== generation || owner !== account) return;
      const memoryKey = `${owner}:${namespace}:${id}`;
      if ((memory.get(memoryKey)?.savedAt ?? 0) > savedAt) return;
      memory.set(memoryKey, { value, savedAt });
      if (memory.size > 160) {
        const disposable = Array.from(memory.keys()).find(
          (key) => !['profile', 'drafts', 'outbox'].includes(key.split(':')[1])
        );
        if (disposable) memory.delete(disposable);
      }
      try {
        const db = await openDatabase();
        if (epoch !== generation || owner !== account) return;
        await db.runAsync(
          `INSERT INTO cache_entries(account_id,namespace,id,payload,saved_at) VALUES(?,?,?,?,?)
          ON CONFLICT(account_id,namespace,id) DO UPDATE SET payload=excluded.payload,saved_at=excluded.saved_at
          WHERE excluded.saved_at >= cache_entries.saved_at`,
          owner,
          namespace,
          id,
          JSON.stringify(value),
          savedAt
        );
      } catch {
        /* The in-memory cache is available until the native rebuild. */
      }
    });
  },
  async remove(owner: string, namespace: string, id: string) {
    return enqueue(async () => {
      memory.delete(`${owner}:${namespace}:${id}`);
      try {
        await (
          await openDatabase()
        ).runAsync(
          'DELETE FROM cache_entries WHERE account_id=? AND namespace=? AND id=?',
          owner,
          namespace,
          id
        );
      } catch {}
    });
  },
  async invalidate(namespace: string) {
    return enqueue(async () => {
      for (const key of memory.keys()) if (key.split(':')[1] === namespace) memory.delete(key);
      try {
        await (
          await openDatabase()
        ).runAsync('DELETE FROM cache_entries WHERE namespace=?', namespace);
      } catch {}
    });
  },
};
