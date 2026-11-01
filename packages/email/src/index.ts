import nodemailer from "nodemailer";

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
}

export interface SendEmailResult {
  status: "queued" | "sent" | "failed";
  providerMessageId?: string;
  errorMessage?: string;
}

const recipientRequired = "Recipient is required.";
const smtpHostRequired = "SMTP host is required.";
const defaultSmtpPort = 1025;
const defaultSmtpFrom = "outreach@ithaca.example";

function readSmtpHost(): string {
  const host = process.env.SMTP_HOST?.trim() ?? "";
  if (host.length === 0) {
    throw new Error(smtpHostRequired);
  }

  return host;
}

function readSmtpPort(): number {
  const raw = process.env.SMTP_PORT?.trim() ?? "";
  if (raw.length === 0) {
    return defaultSmtpPort;
  }

  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0) {
    return defaultSmtpPort;
  }

  return port;
}

function readSmtpFrom(): string {
  const from = process.env.SMTP_FROM?.trim() ?? "";
  if (from.length === 0) {
    return defaultSmtpFrom;
  }

  return from;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "SMTP send failed.";
}

/**
 * Sends mail through SMTP. Local 
 * Development uses Mailpit.
 */
export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const to = input.to.trim();
  if (to.length === 0) {
    return {
      status: "failed",
      errorMessage: recipientRequired,
    };
  }

  const host = readSmtpHost();
  const port = readSmtpPort();
  const from = readSmtpFrom();

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: false,
    tls: {
      rejectUnauthorized: false,
    },
  });

  try {
    const info = await transport.sendMail({
      from,
      to,
      subject: input.subject,
      text: input.body,
    });

    const providerMessageId = info.messageId?.trim() ?? "";
    return {
      status: "sent",
      providerMessageId:
        providerMessageId.length > 0 ? providerMessageId : undefined,
    };
  } catch (error) {
    return {
      status: "failed",
      errorMessage: errorMessage(error),
    };
  } finally {
    transport.close();
  }
}
