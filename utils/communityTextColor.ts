export const communityTextColorOptions = [
  { label: "빨간색", value: "red" },
  { label: "노란색", value: "yellow" },
  { label: "초록색", value: "green" },
  { label: "파란색", value: "blue" },
  { label: "흰색", value: "white" },
  { label: "검은색", value: "black" },
] as const;

export type CommunityTextColor = (typeof communityTextColorOptions)[number]["value"];

export type CommunityTextColorSegment = {
  color?: CommunityTextColor;
  text: string;
};

const communityTextColorValues = communityTextColorOptions.map(
  (option) => option.value,
);
export const isCommunityTextColor = (
  value: string,
): value is CommunityTextColor =>
  communityTextColorValues.includes(value as CommunityTextColor);

const communityTextColorPattern = communityTextColorValues.join("|");
const coloredTextRegex = new RegExp(
  "\\[\\[color:(" + communityTextColorPattern + ")\\]\\]([\\s\\S]*?)\\[\\[\\/color\\]\\]",
  "g",
);
const colorTokenRegex = new RegExp(
  "\\[\\[\\/?color(?::[a-z]+)?\\]\\]",
  "g",
);

export const stripCommunityTextColorMarkup = (content: string) =>
  content
    .replace(coloredTextRegex, (_, _color: string, text: string) => text)
    .replace(colorTokenRegex, "");

export const getSingleCommunityTextColor = (
  content: string,
): CommunityTextColor | null => {
  const trimmedContent = content.trim();
  const match = new RegExp(
    "^\\[\\[color:(" +
      communityTextColorPattern +
      ")\\]\\]([\\s\\S]*?)\\[\\[\\/color\\]\\]$",
  ).exec(trimmedContent);

  return match && stripCommunityTextColorMarkup(trimmedContent) === match[2]
    ? (match[1] as CommunityTextColor)
    : null;
};

export const parseCommunityTextColorSegments = (
  content: string,
): CommunityTextColorSegment[] => {
  const segments: CommunityTextColorSegment[] = [];
  let lastIndex = 0;

  content.replace(
    coloredTextRegex,
    (match, color: CommunityTextColor, text: string, offset: number) => {
      if (offset > lastIndex) {
        segments.push({
          text: stripCommunityTextColorMarkup(content.slice(lastIndex, offset)),
        });
      }

      if (text) {
        segments.push({ color, text });
      }

      lastIndex = offset + match.length;
      return match;
    },
  );

  if (lastIndex < content.length) {
    segments.push({
      text: stripCommunityTextColorMarkup(content.slice(lastIndex)),
    });
  }

  return segments.length > 0 ? segments : [{ text: "" }];
};

export const wrapCommunityTextColor = (
  text: string,
  color: CommunityTextColor,
) => "[[color:" + color + "]]" + text + "[[/color]]";

const appendCommunityTextColorSegment = (
  segments: CommunityTextColorSegment[],
  segment: CommunityTextColorSegment,
) => {
  if (!segment.text) {
    return;
  }

  const previousSegment = segments[segments.length - 1];

  if (previousSegment && previousSegment.color === segment.color) {
    previousSegment.text += segment.text;
    return;
  }

  segments.push(segment);
};

export const serializeCommunityTextColorSegments = (
  segments: CommunityTextColorSegment[],
) =>
  segments
    .map((segment) =>
      segment.color
        ? wrapCommunityTextColor(segment.text, segment.color)
        : segment.text,
    )
    .join("");

export const applyCommunityTextColorToMarkup = (
  content: string,
  startOffset: number,
  endOffset: number,
  color: CommunityTextColor,
) => {
  const plainContent = stripCommunityTextColorMarkup(content);
  const normalizedStartOffset = Math.max(
    0,
    Math.min(startOffset, plainContent.length),
  );
  const normalizedEndOffset = Math.max(
    normalizedStartOffset,
    Math.min(endOffset, plainContent.length),
  );

  if (normalizedStartOffset === normalizedEndOffset) {
    return content;
  }

  const nextSegments: CommunityTextColorSegment[] = [];
  let currentOffset = 0;

  parseCommunityTextColorSegments(content).forEach((segment) => {
    const segmentStartOffset = currentOffset;
    const segmentEndOffset = segmentStartOffset + segment.text.length;

    if (
      normalizedEndOffset <= segmentStartOffset ||
      normalizedStartOffset >= segmentEndOffset
    ) {
      appendCommunityTextColorSegment(nextSegments, segment);
      currentOffset = segmentEndOffset;
      return;
    }

    const selectionStartOffset = Math.max(
      normalizedStartOffset,
      segmentStartOffset,
    );
    const selectionEndOffset = Math.min(normalizedEndOffset, segmentEndOffset);

    if (selectionStartOffset > segmentStartOffset) {
      appendCommunityTextColorSegment(nextSegments, {
        color: segment.color,
        text: segment.text.slice(0, selectionStartOffset - segmentStartOffset),
      });
    }

    if (selectionStartOffset < selectionEndOffset) {
      appendCommunityTextColorSegment(nextSegments, {
        color,
        text: segment.text.slice(
          selectionStartOffset - segmentStartOffset,
          selectionEndOffset - segmentStartOffset,
        ),
      });
    }

    if (selectionEndOffset < segmentEndOffset) {
      appendCommunityTextColorSegment(nextSegments, {
        color: segment.color,
        text: segment.text.slice(selectionEndOffset - segmentStartOffset),
      });
    }

    currentOffset = segmentEndOffset;
  });

  return serializeCommunityTextColorSegments(nextSegments);
};
