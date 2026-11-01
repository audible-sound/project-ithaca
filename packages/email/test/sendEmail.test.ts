import assert from "node:assert/strict";
import net from "node:net";
import { afterEach, describe, it } from "node:test";
import { sendEmail } from "../src/index.ts";

const previousSmtpHost = process.env.SMTP_HOST;
const previousSmtpPort = process.env.SMTP_PORT;
const previousSmtpFrom = process.env.SMTP_FROM;

afterEach(() => {
  if (previousSmtpHost === undefined) {
    delete process.env.SMTP_HOST;
  } else {
    process.env.SMTP_HOST = previousSmtpHost;
  }

  if (previousSmtpPort === undefined) {
    delete process.env.SMTP_PORT;
  } else {
    process.env.SMTP_PORT = previousSmtpPort;
  }

  if (previousSmtpFrom === undefined) {
    delete process.env.SMTP_FROM;
  } else {
    process.env.SMTP_FROM = previousSmtpFrom;
  }
});

function startSmtpListener(): Promise<{
  port: number;
  messageId: string;
  close: () => Promise<void>;
}> {
  const messageId = "<tc-81@ithaca.example>";

  return new Promise((resolve, reject) => {
    const server = net.createServer((socket) => {
      let buffer = "";
      let inData = false;

      socket.write("220 ithaca.test ESMTP\r\n");

      socket.on("data", (chunk) => {
        buffer += chunk.toString("utf8");

        if (inData) {
          if (buffer.includes("\r\n.\r\n")) {
            inData = false;
            buffer = "";
            socket.write(`250 OK ${messageId}\r\n`);
          }
          return;
        }

        while (true) {
          const end = buffer.indexOf("\r\n");
          if (end === -1) {
            break;
          }

          const line = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          const command = line.toUpperCase();

          if (command.startsWith("EHLO") || command.startsWith("HELO")) {
            socket.write("250-ithaca.test\r\n250 OK\r\n");
          } else if (command.startsWith("MAIL") || command.startsWith("RCPT")) {
            socket.write("250 OK\r\n");
          } else if (command === "DATA") {
            inData = true;
            socket.write("354 End data with <CR><LF>.<CR><LF>\r\n");
          } else if (command === "QUIT") {
            socket.write("221 Bye\r\n");
            socket.end();
          } else if (command === "RSET" || command === "NOOP") {
            socket.write("250 OK\r\n");
          } else {
            socket.write("250 OK\r\n");
          }
        }
      });
    });

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("SMTP listener did not bind a port."));
        return;
      }

      resolve({
        port: address.port,
        messageId,
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((error) => {
              if (error) {
                closeReject(error);
                return;
              }
              closeResolve();
            });
          }),
      });
    });
  });
}

describe("sendEmail", () => {
  it("TC-79 rejects send when the recipient is blank", async () => {
    process.env.SMTP_HOST = "127.0.0.1";

    const result = await sendEmail({
      to: "",
      subject: "Hello",
      body: "Body",
    });

    assert.equal(result.status, "failed");
    assert.equal(result.errorMessage, "Recipient is required.");
  });

  it("TC-80 rejects send when SMTP_HOST is unset", async () => {
    delete process.env.SMTP_HOST;

    await assert.rejects(
      () =>
        sendEmail({
          to: "ada@northwind.example",
          subject: "Hello",
          body: "Body",
        }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, "SMTP host is required.");
        return true;
      },
    );
  });

  it("TC-81 sends a message through SMTP to a local listener", async () => {
    const listener = await startSmtpListener();
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = String(listener.port);
    process.env.SMTP_FROM = "outreach@ithaca.example";

    try {
      const result = await sendEmail({
        to: "ada@northwind.example",
        subject: "Hello",
        body: "Body",
      });

      assert.equal(result.status, "sent");
      assert.ok(
        typeof result.providerMessageId === "string" &&
          result.providerMessageId.length > 0,
      );
    } finally {
      await listener.close();
    }
  });
});
