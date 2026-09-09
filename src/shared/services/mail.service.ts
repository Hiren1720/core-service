import nodemailer from "nodemailer";
import { google } from "googleapis";
import { env } from "../../config/env.js";
const OAuth2 = google.auth.OAuth2;

const createTransporter = async () => {
    const oauth2Client = new OAuth2(
        env.GOOGLE_CLIENT_ID,
        env.GOOGLE_CLIENT_SECRET,
        "https://developers.google.com/oauthplayground"
    );

    oauth2Client.setCredentials({
        refresh_token:
            env.GOOGLE_REFRESH_TOKEN,
    });

    const accessToken =
        await oauth2Client.getAccessToken();

    return nodemailer.createTransport({
        service: "gmail",
        auth: {
            type: "OAuth2",
            user: env.MAIL_FROM,
            clientId:
                env.GOOGLE_CLIENT_ID,
            clientSecret:
                env.GOOGLE_CLIENT_SECRET,
            refreshToken:
                env.GOOGLE_REFRESH_TOKEN,
            accessToken:
                accessToken.token || "",
        },
    });
};

interface SendMailOptions {
    to: string;
    subject: string;
    html?: string;
    text?: string;
    attachments?: Array<{
        filename: string;
        path: string;
    }>;
}

export const sendMail = async ({
    to,
    subject,
    html,
    text,
    attachments,
}: SendMailOptions) => {
    const transporter =
        await createTransporter();

    await transporter.sendMail({
        from: env.MAIL_FROM,
        to,
        subject,
        html,
        text,
        attachments,
    });
};