"use client";

import { useAuth } from "@/hooks/useAuth";
import styles from "./VehicleReportPreview.module.css";

const report = {
  aiSummary:
    "정비이력 25건과 성능점검 2건이 확인됩니다. 최근 확인된 성능점검에서는 사고·침수·불법구조변경 기록이 없으며 엔진·변속기는 양호로 기록되었습니다. 과거 제동 계통 정비 이력이 확인됩니다.",
  checkedAt: "2026.08.13 10:44",
  checkItems: [
    ["사고", "무"],
    ["침수", "없음"],
    ["불법구조변경", "없음"],
    ["엔진 상태", "양호"],
    ["변속기 상태", "양호"],
    ["계기 작동", "작동"],
    ["용도변경", "없음"],
    ["튜닝", "없음"],
    ["단순수리", "없음"],
  ],
  historyCounts: [
    ["정비이력", "25건"],
    ["성능점검", "2건"],
  ],
  maintenance: [
    {
      date: "2020.06.23",
      mileage: "54,337 km",
      work: "와이퍼모터/링케이지",
    },
    {
      date: "2020.01.15",
      mileage: "47,998 km",
      work: "제동 마스터백/실린더",
    },
  ],
  performanceCheckedDate: "2021.09.08",
  specs: [
    ["승차정원", "4명"],
    ["차체형상", "2도어 컨버터블"],
    ["배기량", "1,991 cc"],
    ["최고출력", "184"],
    ["변속기", "자동"],
    ["연비", "10.6"],
    ["차체크기", "4,700 × 1,810 × 1,420 mm"],
  ],
  summary: {
    bodyType: "승용 / 중형",
    color: "빨강(주홍)",
    firstRegisteredAt: "2017.06.23",
    fuel: "휘발유",
    mileage: "102,333 km",
    modelYear: "2017년식",
    name: "C200 Cabriolet",
    plateMasked: "390우****",
    transmission: "자동",
    usage: "자가용",
  },
  timeline: [
    { date: "2020.01.15", kind: "정비", mileage: "47,998 km" },
    { date: "2020.06.23", kind: "정비", mileage: "54,337 km" },
    { date: "2020.08.24", kind: "성능점검", mileage: "56,290 km" },
    { date: "2021.09.08", kind: "성능점검", mileage: "79,712 km" },
    { date: "현재 조회", kind: "조회", mileage: "102,333 km" },
  ],
};

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.infoCell}>
      <div className={styles.cellLabel}>{label}</div>
      <div className={styles.cellValue}>{value}</div>
    </div>
  );
}

export default function VehicleReportPreviewPage() {
  const { isAdmin, isAuthReady, isProfileReady } = useAuth();
  const localPreview = process.env.NODE_ENV !== "production";
  const canAccess = localPreview || (isAuthReady && isProfileReady && isAdmin);

  if (!localPreview && (!isAuthReady || !isProfileReady)) {
    return (
      <main className={styles.page} data-report-preview="true">
        <section className={styles.sheet}>관리자 권한을 확인하고 있습니다.</section>
      </main>
    );
  }

  if (!canAccess) {
    return (
      <main className={styles.page} data-report-preview="true">
        <section className={styles.sheet}>관리자 권한이 필요합니다.</section>
      </main>
    );
  }

  return (
    <main className={styles.page} data-report-preview="true">
      <div className={styles.toolbar}>
        <p className={styles.toolbarText}>
          관리자 내부 프리뷰 · 실제 API 연결 없음 · fixture 기반
        </p>
        <button className={styles.printButton} onClick={() => window.print()} type="button">
          인쇄 미리보기
        </button>
      </div>

      <article className={styles.sheet} aria-label="CARFACT 차량정보 리포트 Preview">
        <header className={styles.header}>
          <div>
            <div className={styles.wordmark}>CARFACT</div>
            <h1 className={styles.title}>CARFACT 차량정보 리포트</h1>
            <p className={styles.subtitle}>공공데이터 기반 차량정보 조회</p>
          </div>
          <div className={styles.metaBox}>
            <div className={styles.metaLabel}>조회일시</div>
            <div className={styles.metaValue}>{report.checkedAt}</div>
            <div className={styles.metaLabel}>차량번호</div>
            <div className={styles.metaValue}>{report.summary.plateMasked}</div>
          </div>
        </header>

        <section className={styles.summary}>
          <div>
            <div className={styles.vehicleName}>{report.summary.name}</div>
            <div className={styles.vehicleYear}>{report.summary.modelYear}</div>
            <div className={styles.mileageBox}>
              <div className={styles.mileageLabel}>현재 주행거리</div>
              <div className={styles.mileageValue}>{report.summary.mileage}</div>
            </div>
          </div>
          <div className={styles.summaryGrid}>
            <InfoCell label="연료" value={report.summary.fuel} />
            <InfoCell label="변속기" value={report.summary.transmission} />
            <InfoCell label="배기량" value="1,991 cc" />
            <InfoCell label="용도" value={report.summary.usage} />
            <InfoCell label="최초등록" value={report.summary.firstRegisteredAt} />
            <InfoCell label="차종" value={report.summary.bodyType} />
            <InfoCell label="색상" value={report.summary.color} />
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>CARFACT CHECK</h2>
            <p className={styles.sectionHint}>
              최근 확인된 성능점검 기준 · {report.performanceCheckedDate}
            </p>
          </div>
          <div className={styles.checks}>
            {report.checkItems.map(([label, value]) => (
              <div className={styles.checkCell} key={label}>
                <span className={styles.checkLabel}>{label}</span>
                <span className={styles.checkValue}>{value}</span>
              </div>
            ))}
          </div>
          <p className={styles.notice}>
            ※ 위 내용은 {report.performanceCheckedDate} 성능점검 당시 기록이며 현재
            차량 상태를 의미하지 않습니다.
          </p>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>주요 제원</h2>
            <p className={styles.sectionHint}>상세 제원은 향후 웹 상세보기로 분리</p>
          </div>
          <div className={styles.specGrid}>
            {report.specs.map(([label, value]) => (
              <InfoCell key={label} label={label} value={value} />
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>이력 요약</h2>
            <p className={styles.sectionHint}>공공데이터 반환 기준</p>
          </div>
          <div className={styles.historyCounts}>
            {report.historyCounts.map(([label, value]) => (
              <div className={styles.countCard} key={label}>
                <div className={styles.countLabel}>{label}</div>
                <div className={styles.countValue}>{value}</div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>주행거리 타임라인</h2>
            <p className={styles.sectionHint}>판정 없이 기록 흐름만 표시</p>
          </div>
          <div className={styles.timeline}>
            {report.timeline.map((item) => (
              <div className={styles.timelineItem} key={`${item.date}-${item.kind}`}>
                <div className={styles.timelineDate}>{item.date}</div>
                <div className={styles.timelineMileage}>{item.mileage}</div>
                <div className={styles.timelineKind}>{item.kind}</div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>주요 정비이력</h2>
            <p className={styles.sectionHint}>총 25건 · 프리뷰는 확정된 2건만 표시</p>
          </div>
          <table className={styles.maintenanceTable}>
            <thead>
              <tr>
                <th>정비일</th>
                <th>당시 주행거리</th>
                <th>작업내용</th>
              </tr>
            </thead>
            <tbody>
              {report.maintenance.map((item) => (
                <tr key={`${item.date}-${item.work}`}>
                  <td>{item.date}</td>
                  <td>{item.mileage}</td>
                  <td>{item.work}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className={styles.aiBox}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>CARFACT AI 분석</h2>
            <p className={styles.sectionHint}>프리뷰 샘플 문구</p>
          </div>
          <p className={styles.aiText}>{report.aiSummary}</p>
        </section>

        <footer className={styles.footer}>
          본 리포트는 관계기관에서 제공되는 차량정보를 기반으로 구성되며, 조회 시점 및
          데이터 제공 범위에 따라 실제 차량 상태와 차이가 있을 수 있습니다. 차량 구매 전
          실차 확인 및 최신 성능·상태점검기록부 확인을 권장합니다.
        </footer>
      </article>
    </main>
  );
}
