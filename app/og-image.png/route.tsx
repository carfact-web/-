import { ImageResponse } from "next/og";

export const runtime = "edge";

const size = {
  width: 1200,
  height: 630,
};

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const iconUrl = new URL("/brand/carfact-header-icon.png", origin).toString();

  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#ffffff",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
            gap: 52,
            justifyContent: "center",
          }}
        >
          <img
            alt="카팩트"
            src={iconUrl}
            style={{
              height: 250,
              objectFit: "contain",
              width: 250,
            }}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 22,
            }}
          >
            <div
              style={{
                color: "#111827",
                fontFamily: "Arial, sans-serif",
                fontSize: 104,
                fontWeight: 900,
                letterSpacing: 0,
                lineHeight: 1,
              }}
            >
              CARFACT
            </div>
            <div
              style={{
                background: "#ef4444",
                borderRadius: 999,
                color: "#ffffff",
                display: "flex",
                fontFamily: "Arial, sans-serif",
                fontSize: 38,
                fontWeight: 800,
                lineHeight: 1,
                padding: "20px 30px",
              }}
            >
              OWNER REVIEW · INSPECTION · TROUBLE DATA
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
