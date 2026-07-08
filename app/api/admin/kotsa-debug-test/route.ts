import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getKotsaConfig } from "@/lib/server/kotsa/config";
import {
  decryptKotsaPayload,
  encryptKotsaPayload,
} from "@/lib/server/kotsa/security";
import {
  decodeKotsaPackage,
  readDerChildren,
  readDerNode,
} from "@/lib/server/kotsa/der";
import { maskVehicleNumber } from "@/lib/server/kotsa/vehicleNumber";
import { assertAdminRequest } from "@/lib/server/kotsa/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RequestMode = "full" | "minimal";
type ContentTypeMode = "charset" | "plain";

interface DebugRequest {
  contentTypeMode?: ContentTypeMode;
  nfcNormalize?: boolean;
  requestMode?: RequestMode;
  vehicleNumber?: unknown;
}

const linkInfoCd = "AC1_ZA90_01";
const picId = "ZA90";
const picIpAddr = "95.217.167.210";
const picNm = "케이엠컴퍼니";

const sha256 = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asString = (value: unknown) =>
  typeof value === "string" ? value : "";

const readEncryptedResponseBody = async (response: Response) => {
  const text = (await response.text()).trim();

  try {
    const parsed = JSON.parse(text) as unknown;

    if (typeof parsed === "string") {
      return parsed;
    }
  } catch {
    // KOTSA normally returns the encrypted Base64 package as a raw body.
  }

  return text.replace(/^"|"$/g, "");
};

const normalizeInput = (vehicleNumber: string, nfcNormalize: boolean) =>
  nfcNormalize ? vehicleNumber.normalize("NFC") : vehicleNumber;

const maskInput = (vehicleNumber: string) =>
  maskVehicleNumber(vehicleNumber) ?? "****";

const maskJsonText = (value: unknown) =>
  JSON.stringify(value).replace(
    /"(vhclNo|vhrno)"\s*:\s*"([^"]*)"/g,
    (_match, key: string, vehicleNumber: string) =>
      `"${key}":"${maskInput(vehicleNumber)}"`,
  );

const getVehicleAssertions = (vehicleNumber: string) => ({
  byteLength: Buffer.byteLength(vehicleNumber, "utf8"),
  hasMaskCharacter: vehicleNumber.includes("*"),
  hasPercentEncodingCharacter: vehicleNumber.includes("%"),
  hasWhitespace: /\s/.test(vehicleNumber),
  isNfc: vehicleNumber === vehicleNumber.normalize("NFC"),
  isNfd: vehicleNumber === vehicleNumber.normalize("NFD"),
  stringLength: [...vehicleNumber].length,
});

const createRequestObject = (
  vehicleNumber: string,
  requestMode: RequestMode,
) => {
  const item: Record<string, string> = { linkInfoCd };

  if (requestMode === "full") {
    item.picId = picId;
    item.picNm = picNm;
    item.picIpAddr = picIpAddr;
  }

  item.vhclNo = vehicleNumber;

  return { data: [item] };
};

const getDerSummary = (base64Payload: string) => {
  const decoded = Buffer.from(base64Payload, "base64");
  const sequence = readDerNode(decoded);
  const children = sequence.tag === 0x30 ? readDerChildren(sequence.value) : [];

  return {
    objectCount: children.length,
    objects: children.map((child, index) => ({
      byteLength: child.value.length,
      index,
      length: child.value.length,
      tag: "0x" + child.tag.toString(16).padStart(2, "0"),
      tagName: child.tag === 0x04 ? "OCTET STRING" : "UNKNOWN",
    })),
    sequenceLength: sequence.value.length,
    sequenceTag: "0x" + sequence.tag.toString(16).padStart(2, "0"),
    totalLength: decoded.length,
  };
};

const getHeaderSummary = (headers: Headers) => ({
  connection: headers.get("connection"),
  contentLength: headers.get("content-length"),
  contentType: headers.get("content-type"),
  date: headers.get("date"),
  hubResult: headers.get("hub_result"),
  hubResultCode: headers.get("hub_result_code"),
  server: headers.get("server"),
  transactionId: headers.get("transaction_id"),
  transferEncoding: headers.get("transfer-encoding"),
});

const getDataSummary = (payload: unknown) => {
  const root = asRecord(payload);
  const dataValue = root.data;
  const data = Array.isArray(dataValue) ? dataValue : [];
  const first = asRecord(data[0]);
  const record = first.record;

  return {
    dataExists: Object.prototype.hasOwnProperty.call(root, "data"),
    dataLength: Array.isArray(dataValue) ? dataValue.length : null,
    dataType: Array.isArray(dataValue) ? "array" : typeof dataValue,
    firstRowKeys: Object.keys(first),
    fields: {
      atmbNmExists: first.atmbNm !== null && first.atmbNm !== undefined,
      frstRegYmdExists:
        first.frstRegYmd !== null && first.frstRegYmd !== undefined,
      linkRsltCd: first.linkRsltCd ?? null,
      linkRsltDtl: first.linkRsltDtl ?? null,
      prcsImprtyRsnCd: first.prcsImprtyRsnCd ?? null,
      prcsImprtyRsnDtls: first.prcsImprtyRsnDtls ?? null,
      recordExists: Array.isArray(record),
      recordLength: Array.isArray(record) ? record.length : 0,
      usgSeNmExists: first.usgSeNm !== null && first.usgSeNm !== undefined,
      vhrnoExists: first.vhrno !== null && first.vhrno !== undefined,
    },
  };
};

export async function POST(request: NextRequest) {
  const adminResult = await assertAdminRequest(request);

  if ("error" in adminResult) {
    return NextResponse.json(
      { error: adminResult.error },
      { status: adminResult.status },
    );
  }

  let body: DebugRequest;

  try {
    body = (await request.json()) as DebugRequest;
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const rawVehicleNumber = asString(body.vehicleNumber).trim();

  if (!rawVehicleNumber) {
    return NextResponse.json({ error: "차량번호를 입력해주세요." }, { status: 400 });
  }

  const requestMode: RequestMode =
    body.requestMode === "full" ? "full" : "minimal";
  const contentTypeMode: ContentTypeMode =
    body.contentTypeMode === "charset" ? "charset" : "plain";
  const nfcNormalize = body.nfcNormalize !== false;
  const vehicleNumber = normalizeInput(rawVehicleNumber, nfcNormalize);
  const requestObject = createRequestObject(vehicleNumber, requestMode);
  const requestJson = JSON.stringify(requestObject);
  const requestJsonMasked = maskJsonText(requestObject);
  const requestSha256 = sha256(requestJson);
  const config = getKotsaConfig();
  const contentType =
    contentTypeMode === "charset"
      ? "application/json; charset=utf-8"
      : "application/json";
  const startedAt = Date.now();

  let encryptedRequest = "";
  let derSummary: ReturnType<typeof getDerSummary> | null = null;
  let packageDecoded = false;
  let requestBase64Length = 0;

  try {
    encryptedRequest = await encryptKotsaPayload(requestJson, config);
    requestBase64Length = encryptedRequest.length;
    decodeKotsaPackage(Buffer.from(encryptedRequest, "base64"));
    derSummary = getDerSummary(encryptedRequest);
    packageDecoded = true;
  } catch (error) {
    return NextResponse.json(
      {
        error: "KOTSA 요청 암호화에 실패했습니다.",
        request: {
          fieldKeys: Object.keys(requestObject.data[0]),
          linkInfoCd,
          requestSha256,
          vehicleNumberMasked: maskInput(vehicleNumber),
          vhclNoExists: true,
        },
        status: {
          encrypted: false,
          message: error instanceof Error ? error.message : "unknown",
        },
      },
      { status: 500 },
    );
  }

  const response = await fetch(config.apiBaseUrl, {
    body: encryptedRequest,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Length": String(Buffer.byteLength(encryptedRequest, "utf8")),
      "Content-Type": contentType,
      cvmis_apikey: config.apiKey,
    },
    method: "POST",
  });
  const responseTimeMs = Date.now() - startedAt;
  const encryptedResponse = await readEncryptedResponseBody(response);
  const responseBodyLength = Buffer.byteLength(encryptedResponse, "utf8");

  let decryptedPayload: unknown = null;
  let responseDecryptOk = false;
  let decryptError: string | null = null;

  try {
    const decryptedResponse = await decryptKotsaPayload(
      encryptedResponse,
      config,
    );
    decryptedPayload = JSON.parse(decryptedResponse) as unknown;
    responseDecryptOk = true;
  } catch (error) {
    decryptError = error instanceof Error ? error.message : "unknown";
  }

  return NextResponse.json({
    diagnostics: {
      encryption: {
        base64Length: requestBase64Length,
        derPackageOk: packageDecoded,
        derSummary,
        requestSha256,
        success: Boolean(encryptedRequest),
      },
      http: {
        accept: "application/json",
        contentLength: Buffer.byteLength(encryptedRequest, "utf8"),
        contentType,
        endpoint: config.apiBaseUrl,
        host: new URL(config.apiBaseUrl).host,
        method: "POST",
        responseTimeMs,
        status: response.status,
        tls: new URL(config.apiBaseUrl).protocol === "https:",
      },
      request: {
        fieldKeys: Object.keys(requestObject.data[0]),
        linkInfoCd,
        mode: requestMode,
        plainJsonByteLength: Buffer.byteLength(requestJson, "utf8"),
        plainJsonMasked: requestJsonMasked,
        plainJsonSha256: requestSha256,
        vehicleAssertions: getVehicleAssertions(vehicleNumber),
        vehicleNumberMasked: maskInput(vehicleNumber),
        vhclNoExists: Object.prototype.hasOwnProperty.call(
          requestObject.data[0],
          "vhclNo",
        ),
      },
      response: {
        bodyLength: responseBodyLength,
        decryptError,
        decryptOk: responseDecryptOk,
        decryptedJsonMasked: decryptedPayload
          ? maskJsonText(decryptedPayload)
          : null,
        headers: getHeaderSummary(response.headers),
      },
      raw: {
        httpRequestSummary: {
          accept: "application/json",
          bodyHasTrailingNewline: encryptedRequest.endsWith("\n"),
          bodyLength: Buffer.byteLength(encryptedRequest, "utf8"),
          bodyShape: "raw encrypted base64",
          contentLength: Buffer.byteLength(encryptedRequest, "utf8"),
          contentType,
          finalBodyLastChar: encryptedRequest.slice(-1),
          method: "POST",
          transferEncoding: null,
          url: config.apiBaseUrl,
        },
        httpResponseSummary: getHeaderSummary(response.headers),
      },
      structure: getDataSummary(decryptedPayload),
    },
  });
}
