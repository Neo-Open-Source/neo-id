import { neon } from "@neondatabase/serverless";

export type SqlValue = string | number | boolean | null | Uint8Array | Date;

export type SqlRow = Record<string, unknown>;

export interface NeonHttpClient {
  query<T = SqlRow>(text: string, params?: unknown[]): Promise<T[]>;
  sql<T = SqlRow>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]>;
}

export function neonHttpEndpoint(connectionString: string): string {
  const url = new URL(connectionString.replace(/^postgres(ql)?:\/\//, "https://"));
  return `https://${url.hostname}/sql`;
}

export function createNeonClient(connectionString: string): NeonHttpClient {
  const sql = neon(connectionString);
  return {
    query: <T = SqlRow>(text: string, params: unknown[] = []) =>
      sql.query(text, params) as Promise<T[]>,
    sql: <T = SqlRow>(strings: TemplateStringsArray, ...values: unknown[]) =>
      sql(strings, ...values) as Promise<T[]>,
  };
}
