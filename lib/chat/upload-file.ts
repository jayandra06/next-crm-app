/** Client-side upload for chat attachments. */

import { uploadFileToAppStorage } from "@/lib/upload/client-upload";

export async function uploadChatFile(
  file: File
): Promise<{ url: string; name: string; mime: string; size: number }> {
  const uploaded = await uploadFileToAppStorage(file, { folder: "uploads" });
  return {
    url: uploaded.url,
    name: uploaded.name,
    mime: uploaded.mime,
    size: file.size,
  };
}
