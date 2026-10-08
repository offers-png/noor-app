import type { Database, SqlValue } from './types';

/** The native driver's transaction callback does not provide a separate connection. */
export type DatabaseDriver = Omit<Database, 'withTransactionAsync'> & {
  withTransactionAsync(work: () => Promise<void>): Promise<void>;
};

/** Keep unrelated async queries out of a transaction on our shared connection. */
export function serializeDatabase(driver: DatabaseDriver): Database {
  let pending: Promise<void> = Promise.resolve();
  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = pending.then(operation);
    pending = result.then(() => undefined, () => undefined);
    return result;
  }

  return {
    execAsync: sql => enqueue(() => driver.execAsync(sql)),
    runAsync: (sql, ...params) => enqueue(() => driver.runAsync(sql, ...params)),
    getFirstAsync: <T>(sql: string, ...params: SqlValue[]) => enqueue(() => driver.getFirstAsync<T>(sql, ...params)),
    getAllAsync: <T>(sql: string, ...params: SqlValue[]) => enqueue(() => driver.getAllAsync<T>(sql, ...params)),
    withTransactionAsync: work => enqueue(async () => {
      let active = true;
      const check = () => { if (!active) throw new Error('The database transaction has ended.'); };
      const transaction: Database = {
        execAsync: sql => { check(); return driver.execAsync(sql); },
        runAsync: (sql, ...params) => { check(); return driver.runAsync(sql, ...params); },
        getFirstAsync: <T>(sql: string, ...params: SqlValue[]) => { check(); return driver.getFirstAsync<T>(sql, ...params); },
        getAllAsync: <T>(sql: string, ...params: SqlValue[]) => { check(); return driver.getAllAsync<T>(sql, ...params); },
        withTransactionAsync: async () => { throw new Error('Nested database transactions are not supported.'); },
      };
      try {
        await driver.withTransactionAsync(() => work(transaction));
      } finally {
        active = false;
      }
    }),
  };
}
