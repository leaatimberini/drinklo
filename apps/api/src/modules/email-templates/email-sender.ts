import nodemailer from "nodemailer";

export type EmailSendInput = {
  to: string;
  subject: string;
  html: string;
};

export interface EmailSender {
  send(input: EmailSendInput): Promise<void>;
}

export class MockEmailSender implements EmailSender {
  async send(input: EmailSendInput) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ msg: "email_send_mock", to: input.to, subject: input.subject }));
  }
}

export class SmtpEmailSender implements EmailSender {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async send(input: EmailSendInput) {
    await this.transporter.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
  }
}

export function buildEmailSender(): EmailSender {
  const provider = (process.env.EMAIL_PROVIDER ?? "mock").toLowerCase();
  if (provider === "smtp") {
    return new SmtpEmailSender();
  }
  return new MockEmailSender();
}
