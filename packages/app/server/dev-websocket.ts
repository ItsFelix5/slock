// Vite's dev server runs on a plain node:http server, not Bun.serve, so we
// can't use Bun's native `server.upgrade()`. This hand-rolls just enough of
// RFC 6455 to accept a browser WebSocket connection: the handshake, and
// single-frame (unfragmented) text messages, which is all the /ws relay
// protocol ever sends in either direction.
import { createHash } from "node:crypto";
import type { Socket } from "node:net";

const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

export type UpgradeSocket = { send(data: string): void };

function encodeFrame(payload: Buffer, opcode: number): Buffer {
  const len = payload.length;
  let header: Buffer;
  if (len < 126) {
    header = Buffer.from([0x80 | opcode, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

export function acceptUpgrade(
  socket: Socket,
  key: string,
  onMessage: (raw: string, client: UpgradeSocket) => void,
  onClose: (client: UpgradeSocket) => void,
): UpgradeSocket {
  const accept = createHash("sha1")
    .update(key + WS_GUID)
    .digest("base64");
  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
  );

  const client: UpgradeSocket = {
    send(data) {
      if (!socket.destroyed) socket.write(encodeFrame(Buffer.from(data, "utf8"), 0x1));
    },
  };

  let buffer = Buffer.alloc(0);
  socket.on("data", (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (true) {
      if (buffer.length < 2) return;
      const opcode = buffer[0] & 0x0f;
      const masked = (buffer[1] & 0x80) !== 0;
      let payloadLen = buffer[1] & 0x7f;
      let offset = 2;
      if (payloadLen === 126) {
        if (buffer.length < offset + 2) return;
        payloadLen = buffer.readUInt16BE(offset);
        offset += 2;
      } else if (payloadLen === 127) {
        if (buffer.length < offset + 8) return;
        payloadLen = Number(buffer.readBigUInt64BE(offset));
        offset += 8;
      }
      let maskKey: Buffer | null = null;
      if (masked) {
        if (buffer.length < offset + 4) return;
        maskKey = buffer.subarray(offset, offset + 4);
        offset += 4;
      }
      if (buffer.length < offset + payloadLen) return;
      let payload = buffer.subarray(offset, offset + payloadLen);
      buffer = buffer.subarray(offset + payloadLen);
      if (maskKey) {
        const key = maskKey;
        payload = Buffer.from(payload);
        for (let i = 0; i < payload.length; i++) payload[i] ^= key[i % 4];
      }

      if (opcode === 0x8) {
        socket.end();
        onClose(client);
      } else if (opcode === 0x9) {
        socket.write(encodeFrame(payload, 0xa));
      } else if (opcode === 0x1) {
        onMessage(payload.toString("utf8"), client);
      }
    }
  });
  socket.on("close", () => onClose(client));
  socket.on("error", () => onClose(client));

  return client;
}
