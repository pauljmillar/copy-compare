import {
  DetectDocumentTextCommand,
  TextractClient,
} from "@aws-sdk/client-textract";

const textractClient = new TextractClient({
  region: process.env.AWS_REGION,
});

export async function extractTextFromBuffer(buffer: Buffer) {
  if (!process.env.AWS_REGION) {
    throw new Error(
      "AWS_REGION is not set. Update your environment variables before using Textract.",
    );
  }

  const command = new DetectDocumentTextCommand({
    Document: {
      Bytes: buffer,
    },
  });

  const response = await textractClient.send(command);
  const lines =
    response.Blocks?.filter(
      (block) => block.BlockType === "LINE" && Boolean(block.Text),
    ).map((block) => block.Text?.trim() ?? "") ?? [];

  return lines.filter(Boolean).join("\n");
}
