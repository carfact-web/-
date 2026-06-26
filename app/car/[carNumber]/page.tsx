import type { Metadata } from "next";
import CarReportPageClient from "./CarReportPageClient";
import { fetchSupabaseVehicle } from "@/lib/supabaseData";
import {
  createPageMetadata,
  getTextExcerpt,
  getVehicleDisplayName,
} from "@/lib/seo";
import { sanitizeVehiclePlateNumber } from "@/utils/inputSanitizer";

type CarReportPageProps = {
  params: Promise<{ carNumber: string }>;
};

const getCarNumber = async (params: CarReportPageProps["params"]) => {
  const { carNumber } = await params;

  return sanitizeVehiclePlateNumber(decodeURIComponent(carNumber));
};

export async function generateMetadata({
  params,
}: CarReportPageProps): Promise<Metadata> {
  const carNumber = await getCarNumber(params);
  const vehicle = await fetchSupabaseVehicle(carNumber).catch(() => null);
  const vehicleName = getVehicleDisplayName(vehicle) || carNumber;
  const title = vehicleName + " 후기·고질병·정비이슈 | 카팩트";
  const description =
    getTextExcerpt(vehicleName, 50) +
    "의 실제 후기, 고질병, 정비 이슈와 차량 정보를 확인하세요.";

  return createPageMetadata({
    description,
    path: "/car/" + encodeURIComponent(carNumber),
    title,
  });
}

export default function CarReportPage() {
  return <CarReportPageClient />;
}
