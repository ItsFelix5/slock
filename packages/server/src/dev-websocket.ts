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
