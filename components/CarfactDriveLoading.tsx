"use client";

import { motion } from "framer-motion";
import { useEffect, useState, type CSSProperties } from "react";
import { CarfactDriveWorld } from "./CarfactDriveWorld";
import styles from "./CarfactDriveLoading.module.css";

const statusMessages = [
  "차량 기본정보 확인 중",
  "정비·성능정보 확인 중",
  "차량 기록 정리 중",
];

const documentCards = [
  { code: "BASIC", title: "기본정보", meta: "차량 식별 · 등록", x: "clamp(-210px, -23vw, -92px)", delay: "0s" },
  { code: "SPEC", title: "제원정보", meta: "차체 · 동력계", x: "clamp(92px, 23vw, 210px)", delay: "0.18s" },
  { code: "MAINT", title: "정비이력", meta: "정비 · 주행거리", x: "clamp(-180px, -20vw, -78px)", delay: "0.36s" },
  { code: "CHECK", title: "성능점검", meta: "사고 · 상태 확인", x: "clamp(78px, 20vw, 180px)", delay: "0.54s" },
] as const;

interface CarfactDriveLoadingProps {
  active: boolean;
  plateNumber: string;
  onComplete: () => void;
}

export function CarfactDriveLoading({
  active,
  plateNumber,
  onComplete,
}: CarfactDriveLoadingProps) {
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      void Promise.resolve().then(() => {
        setStatusIndex(0);
      });
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const statusTimers = [
      window.setTimeout(() => setStatusIndex(1), 820),
      window.setTimeout(() => setStatusIndex(2), 1640),
    ];
    const completionTimer = window.setTimeout(onComplete, 2700);

    return () => {
      document.body.style.overflow = previousOverflow;
      statusTimers.forEach((timer) => window.clearTimeout(timer));
      window.clearTimeout(completionTimer);
    };
  }, [active, onComplete]);

  if (!active) {
    return null;
  }

  return (
    <div
      className={styles.overlay}
      role="status"
      aria-live="polite"
      aria-label={statusMessages[statusIndex]}
    >
      <div className={styles.world} aria-hidden="true">
        <CarfactDriveWorld />
      </div>
      <div className={styles.brand}>CAR<span>FACT</span></div>
      <div className={styles.horizonGlow} aria-hidden="true" />

      <div className={styles.documentField} aria-hidden="true">
        {documentCards.map((card) => (
          <div
            key={card.code}
            className={styles.documentCard}
            style={{
              "--card-x": card.x,
              "--card-delay": card.delay,
            } as CSSProperties}
          >
            <div className={styles.documentTop}>
              <span>{card.code}</span>
              <i />
            </div>
            <strong>{card.title}</strong>
            <small>{card.meta}</small>
            <div className={styles.documentLines}>
              <b />
              <b />
              <b />
            </div>
          </div>
        ))}
      </div>

      <div className={styles.vehicleStage} aria-hidden="true">
        <motion.div
          className={styles.vehicleMotion}
          initial={{ opacity: 0, scale: 0.86, y: 24 }}
          animate={{ opacity: 1, scale: [0.86, 1, 0.98, 1.03], y: [24, 0, 3, 0] }}
          transition={{ duration: 2.7, times: [0, 0.2, 0.72, 1], ease: "easeInOut" }}
        >
          <div className={styles.vehicleAura} />
        <svg
          className={styles.suv}
          viewBox="0 0 520 290"
          role="img"
          aria-label="CARFACT SUV 실루엣"
        >
          <defs>
            <linearGradient id="bodyPaint" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#393d43" />
              <stop offset=".48" stopColor="#181b20" />
              <stop offset="1" stopColor="#07080a" />
            </linearGradient>
            <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#1e2b33" />
              <stop offset="1" stopColor="#050708" />
            </linearGradient>
            <filter id="redGlow">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <ellipse cx="260" cy="251" rx="205" ry="27" fill="#000" opacity=".72" />
          <path d="M57 196 72 126 122 100l55-62h166l58 63 48 26 14 69-22 41H79Z" fill="url(#bodyPaint)" stroke="#676c73" strokeWidth="3" />
          <path d="m158 98 42-47h120l45 47Z" fill="url(#glass)" stroke="#59636c" strokeWidth="2" />
          <path d="M259 52v45M111 111c47-12 94-17 149-17s107 6 151 18" fill="none" stroke="#8a9097" strokeWidth="2" opacity=".52" />
          <path d="M84 140c35 8 68 11 102 12M334 152c36-1 69-5 101-12" fill="none" stroke="#5a6067" strokeWidth="2" />
          <path d="M89 151c35 4 64 5 95 2l-9 24c-31 5-59 2-91-9Z" fill="#ff2535" filter="url(#redGlow)" />
          <path d="M431 151c-35 4-64 5-95 2l9 24c31 5 59 2 91-9Z" fill="#ff2535" filter="url(#redGlow)" />
          <path d="M181 153c49 7 109 7 158 0" fill="none" stroke="#fa303d" strokeWidth="5" opacity=".72" filter="url(#redGlow)" />
          <path d="M199 188h122l-8 34H207Z" fill="#050608" stroke="#3f444a" strokeWidth="2" />
          <text
            x="260"
            y="212"
            textAnchor="middle"
            fill="#f4f4f5"
            fontSize={plateNumber.length > 9 ? "15" : "19"}
            fontWeight="800"
            letterSpacing="2"
          >
            {plateNumber || "CARFACT"}
          </text>
          <path d="M66 197h52l-13 44H75M454 197h-52l13 44h30" fill="#090a0c" stroke="#454a50" strokeWidth="3" />
          <path d="M121 220h52M347 220h52" stroke="#b9bdc2" strokeWidth="4" opacity=".62" />
          <path d="M82 128c23-14 49-23 77-28M438 128c-23-14-49-23-77-28" fill="none" stroke="#9ca2a9" strokeWidth="3" opacity=".55" />
          </svg>
        </motion.div>
      </div>

      <div className={styles.statusAnchor}>
        <motion.div
          key={statusIndex}
          className={styles.status}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24 }}
        >
          <span>{statusMessages[statusIndex]}</span>
          <i />
        </motion.div>
      </div>

      <div className={styles.finishAnchor}>
        <motion.div
          className={styles.finish}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: [0, 0, 0, 1], scale: [0.9, 0.9, 1.08, 1] }}
          transition={{ duration: 2.7, times: [0, 0.82, 0.94, 1] }}
        >
          CARFACT <em>CHECK</em>
        </motion.div>
      </div>
    </div>
  );
}
