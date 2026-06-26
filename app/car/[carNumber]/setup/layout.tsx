import { createPageMetadata } from "@/lib/seo";
import { sanitizeVehiclePlateNumber } from "@/utils/inputSanitizer";

type VehicleSetupLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ carNumber: string }>;
};

export async function generateMetadata({ params }: VehicleSetupLayoutProps) {
  const { carNumber } = await params;
  const normalizedCarNumber = sanitizeVehiclePlateNumber(
    decodeURIComponent(carNumber),
  );

  return createPageMetadata({
    description: "카팩트에 차량 정보를 등록하고 실제 후기를 공유할 준비를 합니다.",
    path: "/car/" + encodeURIComponent(normalizedCarNumber) + "/setup",
    title: normalizedCarNumber + " 차량정보 등록 | 카팩트",
  });
}

export default function VehicleSetupLayout({
  children,
}: VehicleSetupLayoutProps) {
  return children;
}
