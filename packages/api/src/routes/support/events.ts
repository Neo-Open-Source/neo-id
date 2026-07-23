import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { onTicketEvent } from "../../helpers/events";

export async function ticketEvents(c: Context) {
  const { id } = c.req.param();

  return streamSSE(c, async (stream) => {
    const cleanup = onTicketEvent(id, (data) => {
      void stream.writeSSE({ data: JSON.stringify(data), event: "message" });
    });

    stream.onAbort(cleanup);
  });
}
