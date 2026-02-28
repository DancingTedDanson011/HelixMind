/**
 * Shared WebSocket registry for CLI connections.
 *
 * useCliConnection registers its WebSocket here so that useCliOutput can
 * listen for raw output_line events without creating a circular dependency
 * between the two hook modules.
 */

const registry = new Map<string, WebSocket>();

/** Register a WebSocket for a connection identified by its unique ID. */
export function registerConnectionWs(connectionId: string, ws: WebSocket): void {
  registry.set(connectionId, ws);
}

/** Remove the WebSocket entry for a connection. */
export function unregisterConnectionWs(connectionId: string): void {
  registry.delete(connectionId);
}

/** Look up the WebSocket for a connection by its unique ID. */
export function getConnectionWs(connectionId: string): WebSocket | null {
  return registry.get(connectionId) ?? null;
}
