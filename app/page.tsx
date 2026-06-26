import { JsonLd } from "@/components/JsonLd";
import { SeoBreadcrumb } from "@/components/SeoBreadcrumb";
import {
  createBreadcrumbListJsonLd,
  createHomeFaqPageJsonLd,
} from "@/lib/structuredData";
import HomePageClient from "./HomePageClient";

const breadcrumbItems = [{ href: "/", name: "홈" }];

export default function HomePage() {
  return (
    <>
      <JsonLd
        data={[
          createBreadcrumbListJsonLd(breadcrumbItems),
          createHomeFaqPageJsonLd(),
        ]}
      />
      <SeoBreadcrumb items={breadcrumbItems} />
      <HomePageClient />
    </>
  );
}
