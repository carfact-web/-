import { bannedReviewWords } from "@/data/bannedWords";
import { sanitizeMultilineUserText } from "@/utils/inputSanitizer";
import type { Review } from "@/types/review";

export interface ReviewValidationResult {
  isValid: boolean;
  message?: string;
  content: string;
}

const minimumReviewLength = 5;
const maximumReviewLength = 500;
const emptyReviewMessage = "후기 내용을 입력해주세요.";
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
