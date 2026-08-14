"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import styles from "./CarfactDriveLoading.module.css";

const statusMessages = [
  "차량 기본정보 확인 중",
  "정비·성능정보 확인 중",
  "차량 기록 정리 중",
];

interface CarfactDriveLoadingProps {
  active: boolean;
  onComplete: () => void;
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
      statusTimers.forEach(window.clearTimeout);
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
      <div className={styles.skyGlow} />
      <div className={styles.speedField} aria-hidden="true">
        {Array.from({ length: 18 }, (_, index) => (
          <i key={index} style={{ "--i": index } as React.CSSProperties} />
        ))}
      </div>

      <div className={styles.hud} aria-hidden="true">
        <span>VEHICLE DATA</span>
        <span>SPEC</span>
        <span>MAINTENANCE</span>
        <span>INSPECTION</span>
      </div>

      <div className={styles.road} aria-hidden="true">
        <div className={styles.roadGlow} />
        <div className={styles.laneLeft} />
        <div className={styles.laneRight} />
      </div>

      <motion.div
        className={styles.car}
        initial={{ opacity: 0, y: 22, scale: 0.86 }}
        animate={{ opacity: 1, y: 0, scale: [0.86, 1, 0.94, 1.8] }}
        transition={{ duration: 2.7, times: [0, 0.2, 0.78, 1], ease: "easeInOut" }}
        aria-hidden="true"
      >
        <div className={styles.carRoof} />
        <div className={styles.carBody}>
          <span className={styles.tailLightLeft} />
          <strong>CF</strong>
          <span className={styles.tailLightRight} />
        </div>
        <div className={styles.carShadow} />
      </motion.div>

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

      <motion.div
        className={styles.finish}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: [0, 0, 0, 1], scale: [0.8, 0.8, 1.04, 1] }}
        transition={{ duration: 2.7, times: [0, 0.82, 0.94, 1] }}
      >
        CARFACT <em>CHECK</em>
      </motion.div>
    </div>
  );
}
