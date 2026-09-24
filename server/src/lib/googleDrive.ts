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

async function getOrCreateTruckFolder(truckName: string): Promise<string> {
  const safeTruckName = truckName.trim();

  if (!safeTruckName) {
    throw new Error("Truck name is required for Google Drive folder");
  }

  const escapedTruckName = safeTruckName.replace(/'/g, "\\'");

  // Look for an existing truck folder inside NEXTMILE Payment Proofs
  const existing = await drive.files.list({
    q: [
      `'${driveFolderId}' in parents`,
      `name = '${escapedTruckName}'`,
      `mimeType = 'application/vnd.google-apps.folder'`,
      `trashed = false`,
    ].join(" and "),
    fields: "files(id,name)",
    pageSize: 1,
  });

  const existingFolder = existing.data.files?.[0];

  if (existingFolder?.id) {
    return existingFolder.id;
  }

  // Create the truck folder if it doesn't exist yet
  const created = await drive.files.create({
    requestBody: {
      name: safeTruckName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [driveFolderId],
    },
    fields: "id,name",
  });

  if (!created.data.id) {
    throw new Error("Google Drive did not return a truck folder ID");
  }

  return created.data.id;
}

export async function uploadPaymentFile(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  truckName?: string,
) {
  let parentFolderId = driveFolderId;

  if (truckName?.trim()) {
    parentFolderId = await getOrCreateTruckFolder(truckName);
  }

  const response = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [parentFolderId],
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
