import { migrate, query, send, handleError } from "./_lib.mjs";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
    if (!process.env.AWAHOUSE_SECRET || req.headers["x-awahouse-secret"] !== process.env.AWAHOUSE_SECRET) {
      return send(res, 401, { error: "Invalid bootstrap secret" });
    }
    await migrate();
    const tables = await query("select table_name from information_schema.tables where table_schema='public' order by table_name");
    send(res, 200, { ok: true, tables: tables.rows.map((row) => row.table_name) });
  } catch (error) {
    handleError(res, error);
  }
}

