import { NextRequest, NextResponse } from "next/server";
import { assertAdminRequest } from "@/lib/server/kotsa/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const adminResult = await assertAdminRequest(request);

  if ("error" in adminResult) {
    return NextResponse.json(
      { error: adminResult.error },
      { status: adminResult.status },
    );
  }

  const { searchParams } = new URL(request.url);
  const searchText = searchParams.get("search") ?? "";
  const isCsv = searchParams.get("format") === "csv";
  const limit = Math.min(
    Number(searchParams.get("limit") ?? (isCsv ? 1000 : 100)) ||
      (isCsv ? 1000 : 100),
    isCsv ? 1000 : 200,
  );
  const { data, error } = await adminResult.clients.admin.rpc(
    "admin_list_kotsa_api_audit_logs",
    {
      row_limit: limit,
      search_text: searchText,
    },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (isCsv) {
    const rows = (data ?? []) as Record<string, unknown>[];
    const headers = [
      "created_at",
      "request_id",
      "user_id",
      "vehicle_number_masked",
      "status",
      "response_code",
      "response_time_ms",
      "endpoint",
      "request_ip",
      "error_type",
    ];
    const escapeCsv = (value: unknown) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [
      headers.join(","),
      ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(",")),
    ].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Disposition": 'attachment; filename="kotsa-audit-logs.csv"',
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  }

  return NextResponse.json({ logs: data ?? [] });
}
