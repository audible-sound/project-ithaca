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

/**
 * Gmail client stub. Real Gmail API sends will be wired later.
 */
export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  void input;
  return {
    status: "queued",
    providerMessageId: "stub-message-id",
  };
}
