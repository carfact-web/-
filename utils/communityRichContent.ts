import type { CommunityImageAttachment } from "@/types/community";

export type CommunityRichContentBlock =
  | { kind: "text"; text: string }
  | { image: CommunityImageAttachment; kind: "image" };

const communityImageTokenRegex = /\[\[image:([^\]]+)\]\]/g;

export const createCommunityImageToken = (imageId: string) =>
  "[[image:" + imageId + "]]";

export const stripCommunityImageTokens = (content: string) =>
  content.replace(communityImageTokenRegex, "").replace(/\n{3,}/g, "\n\n");

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
