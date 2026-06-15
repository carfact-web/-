import Image from "next/image";
import { Fragment, type ReactNode } from "react";
import type { CommunityImageAttachment } from "@/types/community";
import { parseCommunityTextColorSegments } from "@/utils/communityTextColor";
import { parseCommunityRichContentBlocks } from "@/utils/communityRichContent";
import { cn } from "@/utils/cn";

const communityTextColorClassNames = {
  black: "text-black",
  blue: "text-blue-400",
  green: "text-emerald-400",
  red: "text-red-400",
  white: "text-white",
  yellow: "text-yellow-300",
} as const;

export const renderCommunityTextColorSegments = (content: string): ReactNode => {
  const segments = parseCommunityTextColorSegments(content);

  return segments.map((segment, index) => {
    const previousText = segments[index - 1]?.text ?? "";
    const needsLeadingSpace =
      segment.color &&
      segment.text.startsWith("[") &&
      previousText &&
      !/\s$/.test(previousText);
    const segmentText = segment.text;

    if (!segment.color) {
      return segmentText;
    }

    const coloredSegment = (
      <span
        className={cn("font-semibold", communityTextColorClassNames[segment.color])}
      >
        {segmentText}
      </span>
    );

    return needsLeadingSpace ? (
      <Fragment key={index}> {coloredSegment}</Fragment>
    ) : (
      <Fragment key={index}>{coloredSegment}</Fragment>
    );
  });
};

interface CommunityPostBodyProps {
  className?: string;
  content: string;
  images: CommunityImageAttachment[];
  showUnplacedImages?: boolean;
}

export function CommunityPostBody({
  className,
  content,
  images,
  showUnplacedImages = true,
}: CommunityPostBodyProps) {
  const blocks = parseCommunityRichContentBlocks(content, images);
  const placedImageIds = new Set(
    blocks
      .filter((block) => block.kind === "image")
      .map((block) => block.image.id),
  );
  const unplacedImages = showUnplacedImages
    ? images.filter((image) => !placedImageIds.has(image.id))
    : [];

  return (
    <div className={cn("space-y-5", className)}>
      {blocks.map((block, index) => {
        if (block.kind === "image") {
          const imageUrl = block.image.url ?? block.image.dataUrl;

          if (!imageUrl) {
            return null;
          }

          return (
            <a
              key={block.image.id + "-" + index}
              href={imageUrl}
              target="_blank"
              rel="noreferrer"
              className="relative block overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900"
            >
              <Image
                src={imageUrl}
                alt={block.image.name}
                width={1600}
                height={1000}
                unoptimized
                sizes="(min-width: 768px) 720px, 100vw"
                className="h-auto w-full object-contain"
              />
            </a>
          );
        }

        const trimmedText = block.text.trim();

        if (!trimmedText) {
          return null;
        }

        return (
          <p
            key={"text-" + index}
            className="whitespace-pre-wrap break-words text-base leading-[1.75] text-zinc-200"
          >
            {renderCommunityTextColorSegments(trimmedText)}
          </p>
        );
      })}

      {unplacedImages.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {unplacedImages.map((image) => {
            const imageUrl = image.url ?? image.dataUrl;

            if (!imageUrl) {
              return null;
            }

            return (
              <a
                key={image.id}
                href={imageUrl}
                target="_blank"
                rel="noreferrer"
                className="relative aspect-square overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900"
              >
                <Image
                  src={imageUrl}
                  alt={image.name}
                  fill
                  unoptimized
                  sizes="160px"
                  className="object-cover"
                />
              </a>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
