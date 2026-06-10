import { ImageResponse } from "next/og";

export const runtime = "edge";

const size = {
  width: 1200,
  height: 630,
};

const notoSansKrBold =
  "https://fonts.gstatic.com/s/notosanskr/v39/PbyxFmXiEBPT4ITbgNA5Cgms3VYcOA-vvnIzzmo1eLQ.ttf";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const iconUrl = new URL("/brand/carfact-header-icon.png", origin).toString();
  const fontData = await fetch(notoSansKrBold).then((response) =>
    response.arrayBuffer(),
  );

  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background:
            "linear-gradient(135deg, #050505 0%, #111113 48%, #1a0505 100%)",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "flex-start",
          padding: "98px 88px 64px",
          width: "100%",
        }}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
            gap: 20,
            justifyContent: "center",
            marginBottom: 76,
          }}
        >
          <img
            alt="카팩트"
            src={iconUrl}
            style={{
              height: 96,
              objectFit: "contain",
              width: 96,
            }}
          />
          <div
            style={{
              display: "flex",
              fontFamily: "Arial, sans-serif",
              fontSize: 72,
              fontWeight: 900,
              letterSpacing: 2,
              lineHeight: 1,
            }}
          >
            <div
              style={{
                color: "#ffffff",
              }}
            >
              CAR
            </div>
            <div
              style={{
                color: "#FF3B30",
              }}
            >
              FACT
            </div>
          </div>
        </div>
        <div
          style={{
            alignItems: "center",
            display: "flex",
            flexDirection: "column",
            fontFamily: '"Noto Sans KR", sans-serif',
            fontSize: 70,
            fontWeight: 800,
            letterSpacing: 0,
            lineHeight: 1.22,
            textAlign: "center",
          }}
        >
          <div style={{ color: "#ffffff" }}>판매글에는 없는 이야기,</div>
          <div style={{ color: "#FF3B30" }}>후기에서 확인하세요.</div>
        </div>
        <div
          style={{
            color: "#d4d4d8",
            fontFamily: '"Noto Sans KR", sans-serif',
            fontSize: 32,
            fontWeight: 800,
            lineHeight: 1,
            marginTop: 52,
            textAlign: "center",
          }}
        >
          중고차 실매물 후기 공유 플랫폼
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          data: fontData,
          name: "Noto Sans KR",
          style: "normal",
          weight: 800,
        },
      ],
    },
  );
}
