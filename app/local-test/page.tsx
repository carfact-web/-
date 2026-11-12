import { notFound } from "next/navigation";
import { isLocalSandboxServer } from "@/lib/local/sandbox.server";
import LocalTestClient from "./LocalTestClient";

export const dynamic = "force-dynamic";

export default function LocalTestPage() {
  if (!isLocalSandboxServer()) notFound();
  return <LocalTestClient />;
}
