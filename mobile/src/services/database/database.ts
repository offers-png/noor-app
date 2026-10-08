import { openDatabaseAsync } from 'expo-sqlite';
import { schema } from '../../database/migrations/001';
import type { Database } from './types';
export type { Database } from './types';
let connection: Promise<Database> | undefined;
export function getDb(): Promise<Database> {
  connection ??= (async () => {
    const db = await openDatabaseAsync('kids-islam.db');
    try {
      await db.execAsync(schema);
    } catch (error) {
      await db.closeAsync();
      throw error;
    }
    return db;
  })().catch((error: unknown) => {
    connection = undefined;
    throw error;
  });
  return connection;
}
