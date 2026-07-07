const compactVehicleNumber = (vehicleNumber: string) =>
  vehicleNumber.trim().replace(/\s+/g, "").toUpperCase();

const vehicleNumberPatterns = [
  /^[0-9]{2,3}[가-힣][0-9]{4}$/,
  /^[가-힣]{2}[0-9]{1,3}[가-힣][0-9]{4}$/,
];

export const normalizeVehicleNumber = (vehicleNumber: unknown) => {
  if (typeof vehicleNumber !== "string") {
    return null;
  }

  const normalized = compactVehicleNumber(vehicleNumber);

  if (
    normalized.length < 7 ||
    normalized.length > 20 ||
    !vehicleNumberPatterns.some((pattern) => pattern.test(normalized))
  ) {
    return null;
  }

  return normalized;
};

export const maskVehicleNumber = (vehicleNumber: string | null | undefined) => {
  if (!vehicleNumber) {
    return null;
  }

  const normalized = compactVehicleNumber(vehicleNumber);

  if (normalized.length <= 4) {
    return "*".repeat(normalized.length);
  }

  return normalized.slice(0, -4) + "****";
};
