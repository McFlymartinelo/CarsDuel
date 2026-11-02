// Déclaration minimale pour nodemailer (le paquet ne fournit pas ses types et
// la mission limite les dépendances à nodemailer / jsonwebtoken).
declare module "nodemailer" {
  export interface SendMailOptions {
    from?: string;
    to: string;
    subject: string;
    text?: string;
    html?: string;
  }

  export interface TransportOptions {
    host?: string;
    port?: number;
    secure?: boolean;
    auth?: { user: string; pass: string };
    connectionTimeout?: number;
    greetingTimeout?: number;
    socketTimeout?: number;
  }

  export interface Transporter {
    sendMail(options: SendMailOptions): Promise<unknown>;
    verify(): Promise<boolean>;
  }

  export function createTransport(options: string | TransportOptions): Transporter;

  const nodemailer: { createTransport: typeof createTransport };
  export default nodemailer;
}
