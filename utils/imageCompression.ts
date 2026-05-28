"use client";

/**
 * 이미지 압축 유틸리티
 * - jpg/jpeg/png/webp 지원
 * - 최대 1600px로 리사이즈
 * - jpeg/webp 품질 0.75-0.8로 압축
 * - 3MB 이하로 처리
 * - HEIC/HEIF 미지원
 */

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.78;
const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB

const UNSUPPORTED_TYPES = ["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"];
const SUPPORTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export interface ImageCompressionError {
  success: false;
  type: "unsupported-format" | "canvas-error" | "size-exceeds" | "unknown";
  message: string;
}

export interface ImageCompressionResult {
  success: true;
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

export type ImageCompressionOutput = ImageCompressionResult | ImageCompressionError;

/**
 * 이미지 파일이 지원되는 형식인지 확인
 */
export const isUnsupportedImageFormat = (mimeType: string): boolean => {
  return UNSUPPORTED_TYPES.includes(mimeType.toLowerCase());
};

/**
 * 이미지 파일이 지원되는 형식인지 확인
 */
export const isSupportedImageFormat = (mimeType: string): boolean => {
  return SUPPORTED_TYPES.includes(mimeType.toLowerCase());
};

/**
 * 이미지를 리사이즈하고 압축
 */
export const compressImage = async (
  file: File
): Promise<ImageCompressionOutput> => {
  try {
    // 형식 체크
    if (isUnsupportedImageFormat(file.type)) {
      return {
        success: false,
        type: "unsupported-format",
        message:
          "HEIC/HEIF 형식은 지원되지 않습니다. jpg, png, webp 형식의 이미지를 업로드해주세요.",
      };
    }

    if (!isSupportedImageFormat(file.type)) {
      return {
        success: false,
        type: "unsupported-format",
        message: `${file.type} 형식은 지원되지 않습니다. jpg, png, webp 형식의 이미지를 업로드해주세요.`,
      };
    }

    // 이미지 로드
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;

    // 계산: 리사이즈 크기
    let newWidth = width;
    let newHeight = height;

    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
      newWidth = Math.round(width * ratio);
      newHeight = Math.round(height * ratio);
    }

    // Canvas 생성 및 이미지 그리기
    const canvas = document.createElement("canvas");
    canvas.width = newWidth;
    canvas.height = newHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return {
        success: false,
        type: "canvas-error",
        message: "캔버스 컨텍스트를 생성할 수 없습니다. 다시 시도해주세요.",
      };
    }

    ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);
    bitmap.close();

    // 압축: 목표 품질 설정
    const outputMimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const quality = file.type === "image/png" ? undefined : JPEG_QUALITY;

    // Canvas → Blob 변환 (비동기)
    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve({
              success: false,
              type: "canvas-error",
              message: "이미지 압축에 실패했습니다. 다시 시도해주세요.",
            });
            return;
          }

          // 크기 체크
          if (blob.size > MAX_FILE_SIZE) {
            // 더 낮은 품질로 재압축
            if (quality && quality > 0.5) {
              canvas.toBlob(
                (retryBlob) => {
                  if (retryBlob && retryBlob.size <= MAX_FILE_SIZE) {
                    resolve({
                      success: true,
                      blob: retryBlob,
                      originalSize: file.size,
                      compressedSize: retryBlob.size,
                      compressionRatio: retryBlob.size / file.size,
                    });
                  } else {
                    resolve({
                      success: false,
                      type: "size-exceeds",
                      message: `압축 후에도 파일 크기가 3MB를 초과합니다. 더 작은 용량의 이미지를 업로드해주세요. (현재: ${(blob.size / 1024 / 1024).toFixed(2)}MB)`,
                    });
                  }
                },
                outputMimeType,
                quality * 0.9
              );
            } else {
              resolve({
                success: false,
                type: "size-exceeds",
                message: `압축 후에도 파일 크기가 3MB를 초과합니다. 더 작은 용량의 이미지를 업로드해주세요. (현재: ${(blob.size / 1024 / 1024).toFixed(2)}MB)`,
              });
            }
            return;
          }

          resolve({
            success: true,
            blob,
            originalSize: file.size,
            compressedSize: blob.size,
            compressionRatio: blob.size / file.size,
          });
        },
        outputMimeType,
        quality
      );
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";

    // HEIC/HEIF 형식이 지원되지 않는 경우 감지
    if (
      message.includes("heic") ||
      message.includes("heif") ||
      message.includes("HEIC") ||
      message.includes("HEIF")
    ) {
      return {
        success: false,
        type: "unsupported-format",
        message:
          "HEIC/HEIF 형식은 지원되지 않습니다. jpg, png, webp 형식의 이미지를 업로드해주세요.",
      };
    }

    return {
      success: false,
      type: "unknown",
      message: `이미지 압축 중 오류가 발생했습니다: ${message}`,
    };
  }
};

/**
 * 파일 크기를 읽을 수 있는 형식으로 변환
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};
