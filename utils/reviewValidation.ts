import { bannedReviewWords } from "@/data/bannedWords";
import { sanitizeMultilineUserText } from "@/utils/inputSanitizer";
import type { Review } from "@/types/review";

export interface ReviewValidationResult {
  isValid: boolean;
  message?: string;
  content: string;
}

export interface ReviewTitleValidationResult {
  isValid: boolean;
  message?: string;
  title: string;
}

const minimumReviewLength = 5;
const maximumReviewLength = 500;
const minimumReviewTitleLength = 2;
const maximumReviewTitleLength = 60;
const emptyReviewMessage = "후기 내용을 입력해주세요.";
const emptyReviewTitleMessage = "후기 제목을 입력해주세요.";
export const minimumReviewTitleLengthMessage =
  "후기 제목은 최소 2자 이상 작성해주세요.";
export const maximumReviewTitleLengthMessage =
  "후기 제목은 60자 이하로 작성해주세요.";
export const minimumReviewLengthMessage = "후기는 최소 5자 이상 작성해주세요.";
export const maximumReviewLengthMessage = "후기는 500자 이하로 작성해주세요.";
export const inappropriateReviewMessage =
  "부적절한 표현이 포함되어 있어요. 내용을 수정해주세요.";

const normalizeForFilter = (value: string) =>
  value.toLowerCase().replace(/[^0-9a-zㄱ-ㅎ가-힣]+/g, "");

const hasBannedReviewWord = (value: string) =>
  bannedReviewWords.some((word) =>
    normalizeForFilter(value).includes(normalizeForFilter(word))
  );

export const validateReviewTitle = (
  title: string
): ReviewTitleValidationResult => {
  const trimmedTitle = sanitizeMultilineUserText(title).replace(/\s+/g, " ");

  if (!trimmedTitle) {
    return {
      isValid: false,
      message: emptyReviewTitleMessage,
      title: trimmedTitle,
    };
  }

  if (hasBannedReviewWord(trimmedTitle)) {
    return {
      isValid: false,
      message: inappropriateReviewMessage,
      title: trimmedTitle,
    };
  }

  if (Array.from(trimmedTitle).length < minimumReviewTitleLength) {
    return {
      isValid: false,
      message: minimumReviewTitleLengthMessage,
      title: trimmedTitle,
    };
  }

  if (Array.from(trimmedTitle).length > maximumReviewTitleLength) {
    return {
      isValid: false,
      message: maximumReviewTitleLengthMessage,
      title: trimmedTitle,
    };
  }

  return {
    isValid: true,
    title: trimmedTitle,
  };
};

export const validateReviewContent = (
  content: string
): ReviewValidationResult => {
  const trimmedContent = sanitizeMultilineUserText(content);

  if (!trimmedContent) {
    return {
      isValid: false,
      message: emptyReviewMessage,
      content: trimmedContent,
    };
  }

  if (hasBannedReviewWord(trimmedContent)) {
    return {
      isValid: false,
      message: inappropriateReviewMessage,
      content: trimmedContent,
    };
  }

  if (Array.from(trimmedContent).length < minimumReviewLength) {
    return {
      isValid: false,
      message: minimumReviewLengthMessage,
      content: trimmedContent,
    };
  }

  if (Array.from(trimmedContent).length > maximumReviewLength) {
    return {
      isValid: false,
      message: maximumReviewLengthMessage,
      content: trimmedContent,
    };
  }

  return {
    isValid: true,
    content: trimmedContent,
  };
};

export const filterValidReviews = (reviews: Review[]) =>
  reviews.filter(
    (review) => !review.isHidden && validateReviewContent(review.content).isValid
  );
