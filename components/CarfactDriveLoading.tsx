"use client";

import { motion } from "framer-motion";
import { useEffect, useState, type CSSProperties } from "react";
import styles from "./CarfactDriveLoading.module.css";

const statusMessages = [
  "차량 기본정보 확인 중",
  "정비·성능정보 확인 중",
  "차량 기록 정리 중",
];

const radarObjects = [
  { type: "car", label: "차량", x: "18%", y: "42%", delay: "0s" },
  { type: "bike", label: "자전거", x: "78%", y: "36%", delay: "0.22s" },
  { type: "animal", label: "동물", x: "82%", y: "64%", delay: "0.4s" },
  { type: "car", label: "차량", x: "22%", y: "68%", delay: "0.58s" },
] as const;

interface CarfactDriveLoadingProps {
  active: boolean;
  onComplete: () => void;
}

function RadarObject({ type }: { type: (typeof radarObjects)[number]["type"] }) {
  if (type === "bike") {
    return (
      <svg viewBox="0 0 64 42" aria-hidden="true">
        <circle cx="15" cy="30" r="9" />
        <circle cx="49" cy="30" r="9" />
        <path d="M15 30 27 15l10 15H15Zm12-15h10l12 15M31 12l-5-5m17 7h8" />
      </svg>
    );
  }

  if (type === "animal") {
    return (
      <svg viewBox="0 0 66 42" aria-hidden="true">
        <path d="M10 29c3-11 11-17 24-16l10 4 8-8 3 3-4 9 5 8-8 1-5-5H25l-7 8H9l5-8" />
        <circle cx="47" cy="16" r="1.5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 70 42" aria-hidden="true">
      <path d="M8 29 14 17l12-6h22l11 7 4 11v5H8Z" />
      <path d="m22 15 8-4h15l8 7H18Z" />
      <circle cx="20" cy="32" r="5" />
      <circle cx="53" cy="32" r="5" />
    </svg>
  );
}

export function CarfactDriveLoading({
  active,
  onComplete,
}: CarfactDriveLoadingProps) {
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setStatusIndex(0);
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
      <div className={styles.brand}>CAR<span>FACT</span></div>
      <div className={styles.horizonGlow} aria-hidden="true" />
      <div className={styles.sensorGrid} aria-hidden="true" />

      <div className={styles.speedField} aria-hidden="true">
        {Array.from({ length: 20 }, (_, index) => (
          <i key={index} style={{ "--i": index } as CSSProperties} />
        ))}
      </div>

      <div className={styles.roadScene} aria-hidden="true">
        <div className={styles.roadSurface}>
          <span className={styles.roadEdgeLeft} />
          <span className={styles.roadEdgeRight} />
          <span className={styles.laneLeft} />
          <span className={styles.laneRight} />
          <span className={styles.roadPulse} />
        </div>
      </div>

      <div className={styles.radarScene} aria-hidden="true">
        <span className={styles.radarRingOne} />
        <span className={styles.radarRingTwo} />
        <span className={styles.radarRingThree} />
        {radarObjects.map((object, index) => (
          <div
            key={`${object.type}-${index}`}
            className={styles.radarObject}
            style={{
              left: object.x,
              top: object.y,
              animationDelay: object.delay,
            }}
          >
            <RadarObject type={object.type} />
            <small>{object.label}</small>
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
          <text x="260" y="212" textAnchor="middle" fill="#f4f4f5" fontSize="23" fontWeight="800" letterSpacing="8">CF</text>
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
