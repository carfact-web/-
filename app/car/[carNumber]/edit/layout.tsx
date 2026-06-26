import { createPageMetadata } from "@/lib/seo";
import { sanitizeVehiclePlateNumber } from "@/utils/inputSanitizer";

type VehicleEditLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ carNumber: string }>;
};

export async function generateMetadata({ params }: VehicleEditLayoutProps) {
  const { carNumber } = await params;
  const normalizedCarNumber = sanitizeVehiclePlateNumber(
    decodeURIComponent(carNumber),
  );

  return createPageMetadata({
    description: "카팩트 차량 정보를 수정합니다.",
    path: "/car/" + encodeURIComponent(normalizedCarNumber) + "/edit",
    title: normalizedCarNumber + " 차량정보 수정 | 카팩트",
  });
}

export default function VehicleEditLayout({
  children,
}: VehicleEditLayoutProps) {
  return children;
}
