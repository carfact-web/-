import type { WebtoonAsset } from "@/types/webtoon";
export interface DraftFile {
  id: string;
  name: string;
  size: number;
  sha256: string;
  type: string;
  asset?: WebtoonAsset;
}
export interface DraftData {
  jobs: DraftFile[];
  pageIds: string[];
  pdfAssetId: string | null;
  coverAssetId: string | null;
  coverUploadId: string;
  title: string;
  popup: boolean;
  message: string;
  startsAt: string;
  endsAt: string;
  ready?: boolean;
}
