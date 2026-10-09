import { openDatabaseAsync } from 'expo-sqlite';
import { schema } from '../../database/migrations/001';
import { schemaV2 } from '../../database/migrations/002';
import type { Database } from './types';
import { serializeDatabase } from './serialized';
export type { Database } from './types';
let connection: Promise<Database> | undefined;
export function getDb(): Promise<Database> {
  connection ??= (async () => {
    const db = await openDatabaseAsync('kids-islam.db');
    try {
      await db.execAsync(schema);
      await db.execAsync(schemaV2);
    } catch (error) {
      await db.closeAsync();
      throw error;
    }
    return serializeDatabase(db);
  })().catch((error: unknown) => {
    connection = undefined;
    throw error;
  });
  return connection;
}
