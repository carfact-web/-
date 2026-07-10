import Script from "next/script";

const gaMeasurementId =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-PG4WB3T5S5";

export function GoogleAnalytics() {
  if (!gaMeasurementId) {
    return null;
  }

  return (
    <>
      <Script
        src={"https://www.googletagmanager.com/gtag/js?id=" + gaMeasurementId}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${gaMeasurementId}', { send_page_view: false });
        `}
      </Script>
    </>
  );
}
