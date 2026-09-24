import { google } from "googleapis";
import { Readable } from "stream";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const GOOGLE_DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

if (!GOOGLE_CLIENT_ID) {
  throw new Error("Missing GOOGLE_CLIENT_ID");
}

if (!GOOGLE_CLIENT_SECRET) {
  throw new Error("Missing GOOGLE_CLIENT_SECRET");
}

if (!GOOGLE_REFRESH_TOKEN) {
  throw new Error("Missing GOOGLE_REFRESH_TOKEN");
}

if (!GOOGLE_DRIVE_FOLDER_ID) {
  throw new Error("Missing GOOGLE_DRIVE_FOLDER_ID");
}

const driveFolderId: string = GOOGLE_DRIVE_FOLDER_ID;

const auth = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);

auth.setCredentials({
  refresh_token: GOOGLE_REFRESH_TOKEN,
});

const drive = google.drive({
  version: "v3",
  auth,
});

export async function uploadPaymentFile(
  buffer: Buffer,
  filename: string,
  mimeType: string,
) {
  const response = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [driveFolderId],
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: "id,name,size,mimeType",
  });

  if (!response.data.id) {
    throw new Error("Google Drive did not return a file ID");
  }

  return response.data;
}

export async function getPaymentFile(fileId: string) {
  return drive.files.get(
    {
      fileId,
      alt: "media",
    },
    {
      responseType: "stream",
    },
  );
}

export async function deletePaymentFile(fileId: string) {
  await drive.files.delete({
    fileId,
  });
}
