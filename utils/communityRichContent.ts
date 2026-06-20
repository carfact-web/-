import type { CommunityImageAttachment } from "@/types/community";

export type CommunityRichContentBlock =
  | { kind: "text"; text: string }
  | { image: CommunityImageAttachment; kind: "image" };

const communityImageTokenRegex = /\[\[image:([^\]]+)\]\]/g;
const markdownImageRegex = /!\[[^\]]*\]\([^)]*\)/g;
const htmlImageRegex = /<img\b[^>]*>/gi;
const looseImageTokenRegex = /\[image:[^\]]+\]/gi;
const looseImageIdRegex = /\bimage\s*[:：]\s*[^\s,;)}\]]+/gi;
const storageUrlRegex =
  /https?:\/\/[^\s)]*(?:supabase\.co|supabase\.in)[^\s)]*\/storage\/v1\/object\/(?:public|sign)\/[^\s)]*/gi;
const storagePathRegex = /\/?storage\/[^\s)]*/gi;
const imageDataUrlRegex = /data:image\/[^\s)]+/gi;
const imagePathRegex =
  /\/?(?:[\w.-]+\/)+[\w.@%+-]+\.(?:avif|gif|heic|heif|jpe?g|png|webp)(?:\?\S*)?/gi;
const imageFileNameRegex =
  /\b[\w .@%+()-]+\.(?:avif|gif|heic|heif|jpe?g|png|webp)\b/gi;
const uuidRegex =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const uuidImageFileRegex =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:avif|gif|heic|heif|jpe?g|png|webp)\b/gi;
const longImageIdRegex = /\b[0-9a-f]{24,}\b/gi;
const generatedImageMetaBlockRegex =
  /^\s*(?:chatgpt|openai|uploaded?|upload)\b(?=.*(?:image|img|photo|screenshot|이미지|사진|파일|\.(?:avif|gif|heic|heif|jpe?g|png|webp)\b)).*$/gim;
const generatedImagePhraseRegex =
  /\b(?:chatgpt|openai|uploaded?|upload)\b[^\n.!?。！？]*?(?:image|img|photo|screenshot|이미지|사진|파일|[\w .@%+()-]+\.(?:avif|gif|heic|heif|jpe?g|png|webp)\b)/gi;
const generatedImageMarkerRegex = /\b(?:chatgpt|uploaded?|upload)\b/gi;
const imageMetaLineRegex =
  /^\s*(?:\[?image\]?|img|photo|file|filename|upload(?:ed)?|path|uuid|id|이미지|사진|파일|업로드)\s*[:：-]\s*\S.*$/i;
const bareImageFileLineRegex =
  /^\s*[\w .@%+()-]+\.(?:avif|gif|heic|heif|jpe?g|png|webp)\s*$/i;
const generatedImageMetaLineRegex =
  /^\s*(?:chatgpt|openai|uploaded?|upload)\b(?=.*(?:image|img|photo|screenshot|이미지|사진|파일|\.(?:avif|gif|heic|heif|jpe?g|png|webp)\b)).*$/i;

export const createCommunityImageToken = (imageId: string) =>
  "[[image:" + imageId + "]]";

export const stripCommunityImageTokens = (content: string) =>
  content.replace(communityImageTokenRegex, "").replace(/\n{3,}/g, "\n\n");

export const cleanSummary = (
  content: string,
  fallbackText = "",
) => {
  const previewText = content
    .replace(generatedImageMetaBlockRegex, "")
    .replace(markdownImageRegex, "")
    .replace(htmlImageRegex, "")
    .replace(communityImageTokenRegex, "")
    .replace(looseImageTokenRegex, "")
    .replace(looseImageIdRegex, "")
    .replace(storageUrlRegex, "")
    .replace(storagePathRegex, "")
    .replace(imageDataUrlRegex, "")
    .replace(imagePathRegex, "")
    .replace(generatedImagePhraseRegex, "")
    .replace(uuidImageFileRegex, "")
    .replace(imageFileNameRegex, "")
    .replace(generatedImageMarkerRegex, "")
    .replace(uuidRegex, "")
    .replace(longImageIdRegex, "")
    .split("\n")
    .filter((line) => {
      const trimmedLine = line.trim();

      return (
        trimmedLine &&
        !imageMetaLineRegex.test(trimmedLine) &&
        !bareImageFileLineRegex.test(trimmedLine) &&
        !generatedImageMetaLineRegex.test(trimmedLine)
      );
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return previewText || fallbackText;
};

export const getCommunityPreviewText = cleanSummary;

export const parseCommunityRichContentBlocks = (
  content: string,
  images: CommunityImageAttachment[],
): CommunityRichContentBlock[] => {
  const imageMap = new Map(images.map((image) => [image.id, image]));
  const blocks: CommunityRichContentBlock[] = [];
  let lastIndex = 0;

  content.replace(communityImageTokenRegex, (match, imageId: string, offset) => {
    if (offset > lastIndex) {
      blocks.push({ kind: "text", text: content.slice(lastIndex, offset) });
    }

    const image = imageMap.get(imageId);

    if (image) {
      blocks.push({ image, kind: "image" });
    }

    lastIndex = offset + match.length;
    return match;
  });

  if (lastIndex < content.length) {
    blocks.push({ kind: "text", text: content.slice(lastIndex) });
  }

  if (blocks.length === 0) {
    return [{ kind: "text", text: content }];
  }

  return blocks;
};
