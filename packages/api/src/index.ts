import app from "./app";
import { serve } from "@hono/node-server";

export default app;

// Start server only when run directly
if (process.argv[1]?.endsWith("index.ts") || process.argv[1]?.endsWith("index.js")) {
  const port = parseInt(process.env.API_PORT || "3000", 10);
  console.warn(`Neo ID API running on port ${port}`);
  serve({ fetch: app.fetch, port });
}
