// Vite's dev server runs on a plain node:http server, not Bun.serve, so we
// can't use Bun's native server.upgrade(). A hand-rolled RFC 6455 handshake
// used to live here (raw socket.write of the 101 response), but on current
// Bun the response bytes silently never reach the client even though the
// write call itself reports success - confirmed with a raw TCP byte capture.
// The `ws` package's noServer mode does the equivalent handshake and works.
import type { IncomingMessage } from "node:http";
import type { Socket } from "node:net";
import { WebSocketServer } from "ws";

export type UpgradeSocket = { send(data: string): void };

const wss = new WebSocketServer({ noServer: true });

export function acceptUpgrade(
  req: IncomingMessage,
  socket: Socket,
  head: Buffer,
  onOpen: (client: UpgradeSocket) => void,
  onMessage: (raw: string, client: UpgradeSocket) => void,
  onClose: (client: UpgradeSocket) => void,
): void {
  wss.handleUpgrade(req, socket, head, (ws) => {
    const client: UpgradeSocket = { send: (data) => ws.send(data) };
    onOpen(client);
    ws.on("message", (data) => onMessage(data.toString("utf8"), client));
    ws.on("close", () => onClose(client));
  });
}
