import { EventEmitter } from "events";

const emitter = new EventEmitter();
emitter.setMaxListeners(10000);

export function onTicketEvent(ticketId: string, cb: (data: unknown) => void) {
  const handler = (data: unknown) => cb(data);
  emitter.on(`ticket:${ticketId}`, handler);
  return () => { emitter.off(`ticket:${ticketId}`, handler); };
}

export function emitTicketEvent(ticketId: string, data: unknown) {
  emitter.emit(`ticket:${ticketId}`, data);
}
