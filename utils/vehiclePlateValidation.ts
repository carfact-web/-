import { sanitizeVehiclePlateNumber } from "@/utils/inputSanitizer";

const vehiclePlatePattern = /^\d{2,3}[가-힣]\d{4}$/;

export const normalizeVehiclePlateNumber = (value: string) =>
  sanitizeVehiclePlateNumber(value).replace(/\s+/g, "");

export const isValidVehiclePlateNumber = (value: string) =>
  vehiclePlatePattern.test(normalizeVehiclePlateNumber(value));

export const formatVehiclePlateNumberForDisplay = (value: string) => {
  const normalizedValue = normalizeVehiclePlateNumber(value);
  const match = normalizedValue.match(/^(\d{2,3}[가-힣])(\d{1,4})$/);

  if (!match) {
    return normalizedValue;
  }

  return match[1] + " " + match[2];
};
