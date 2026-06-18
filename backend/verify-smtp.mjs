import dotenv from "dotenv";
import nodemailer from "nodemailer";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
const smtpConfig = {
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true" && Number(process.env.SMTP_PORT) === 465,
  requireTLS: Number(process.env.SMTP_PORT) === 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: { rejectUnauthorized: false },
};
console.log("SMTP config:", JSON.stringify(smtpConfig, null, 2));
const transporter = nodemailer.createTransport(smtpConfig);
transporter.verify((err, success) => {
  if (err) {
    console.error("SMTP verify failed", err);
    process.exit(1);
  }
  console.log("SMTP verify success", success);
  process.exit(0);
});
