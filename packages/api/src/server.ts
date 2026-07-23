import { serve } from "@hono/node-server";
import app from "./app";

const port = parseInt(process.env.API_PORT || "3000", 10);

console.log(`Neo ID API running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
