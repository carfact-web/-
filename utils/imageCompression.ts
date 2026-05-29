"use client";

/**
 * 이미지 압축 유틸리티
 * - jpg/jpeg/png/webp 지원
 * - 긴 변 1600px 이하로 리사이즈
 * - WebP 품질 80%로 변환
 * - 1MB 이하 목표
 * - HEIC/HEIF 미지원
 */

const MAX_DIMENSION = 1600;
const MIN_DIMENSION = 640;
const WEBP_QUALITY = 0.8;
const TARGET_FILE_SIZE = 1024 * 1024; // 1MB
const OUTPUT_MIME_TYPE = "image/webp";
const MAX_RESIZE_ATTEMPTS = 8;

const UNSUPPORTED_TYPES = [
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
];
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
  width: number;
  height: number;
}

export type ImageCompressionOutput =
  | ImageCompressionResult
  | ImageCompressionError;

interface LoadedImageSource {
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}

interface WebpRenderResult {
  blob: Blob;
  width: number;
  height: number;
}

export const isUnsupportedImageFormat = (mimeType: string): boolean => {
  return UNSUPPORTED_TYPES.includes(mimeType.toLowerCase());
};

export const isSupportedImageFormat = (mimeType: string): boolean => {
  return SUPPORTED_TYPES.includes(mimeType.toLowerCase());
};

const getResizedDimensions = (
  width: number,
  height: number,
  maxDimension: number
) => {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }

  const ratio = Math.min(maxDimension / width, maxDimension / height);

  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
};

const waitForImageLoad = (image: HTMLImageElement) =>
  new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("invalid-image"));
  });

const loadImageSource = async (file: File): Promise<LoadedImageSource> => {
  if ("createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(file);

      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      };
    } catch {
      // 일부 모바일 브라우저는 createImageBitmap 디코딩이 불안정해서 img fallback을 사용합니다.
    }
  }

  const imageUrl = URL.createObjectURL(file);
  const image = new Image();

  image.decoding = "async";
  image.src = imageUrl;

  if (image.decode) {
    await image.decode().catch(() => waitForImageLoad(image));
  } else {
    await waitForImageLoad(image);
  }

  return {
    source: image,
    width: image.naturalWidth || image.width,
    height: image.naturalHeight || image.height,
    cleanup: () => URL.revokeObjectURL(imageUrl),
  };
};

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
) =>
  new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });

const renderWebp = async (
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  maxDimension: number
): Promise<WebpRenderResult | null> => {
  const { width, height } = getResizedDimensions(
    sourceWidth,
    sourceHeight,
    maxDimension
  );
  const canvas = document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return null;
  }

  ctx.drawImage(source, 0, 0, width, height);

  const blob = await canvasToBlob(canvas, OUTPUT_MIME_TYPE, WEBP_QUALITY);

  if (!blob || blob.type !== OUTPUT_MIME_TYPE) {
    return null;
  }

  return { blob, width, height };
};

const logCompressionResult = (
  file: File,
  result: ImageCompressionResult,
  targetReached: boolean
) => {
  const message = "[CarFact] image compressed before/after";
  const payload = {
    name: file.name,
    before: formatFileSize(result.originalSize),
    after: formatFileSize(result.compressedSize),
    outputType: result.blob.type,
    quality: "80%",
    dimensions: `${result.width}x${result.height}`,
    target: "1 MB",
  };

  if (targetReached) {
    console.info(message, payload);
  } else {
    console.warn(message, {
      ...payload,
      note: "1 MB target was not reached after resizing attempts.",
    });
  }
};

/**
 * 이미지를 WebP 80%로 변환하고 1MB 이하를 목표로 리사이즈합니다.
 */
export const compressImage = async (
  file: File
): Promise<ImageCompressionOutput> => {
  try {
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

    const loadedImage = await loadImageSource(file);

    try {
      let maxDimension = MAX_DIMENSION;
      let bestResult: WebpRenderResult | null = null;

      for (let attempt = 0; attempt < MAX_RESIZE_ATTEMPTS; attempt += 1) {
        const renderResult = await renderWebp(
          loadedImage.source,
          loadedImage.width,
          loadedImage.height,
          maxDimension
        );

        if (!renderResult) {
          return {
            success: false,
            type: "canvas-error",
            message: "이미지 압축에 실패했습니다. 다시 시도해주세요.",
          };
        }

        bestResult = renderResult;

        if (
          renderResult.blob.size <= TARGET_FILE_SIZE ||
          Math.max(renderResult.width, renderResult.height) <= MIN_DIMENSION
        ) {
          break;
        }

        maxDimension = Math.max(MIN_DIMENSION, Math.round(maxDimension * 0.9));
      }

      if (!bestResult) {
        return {
          success: false,
          type: "canvas-error",
          message: "이미지 압축에 실패했습니다. 다시 시도해주세요.",
        };
      }

      const result: ImageCompressionResult = {
        success: true,
        blob: bestResult.blob,
        originalSize: file.size,
        compressedSize: bestResult.blob.size,
        compressionRatio: bestResult.blob.size / file.size,
        width: bestResult.width,
        height: bestResult.height,
      };

      logCompressionResult(file, result, result.compressedSize <= TARGET_FILE_SIZE);

      return result;
    } finally {
      loadedImage.cleanup();
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";

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

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};
