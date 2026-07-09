import { sanitizeVehiclePlateNumber } from "@/utils/inputSanitizer";

const vehiclePlatePattern = /^\d{2,3}[가-힣]\d{4}$/;
const commercialPlatePattern =
  /^(?:[가-힣]{2}\d{1,3}|\d{2,3})[가-힣]\d{4}$/;

export const normalizeVehiclePlateNumber = (value: string) =>
  sanitizeVehiclePlateNumber(value).replace(/\s+/g, "");

export const isValidVehiclePlateNumber = (value: string) =>
  vehiclePlatePattern.test(normalizeVehiclePlateNumber(value));

export const normalizeCommercialPlateNumber = (value: string) =>
  sanitizeVehiclePlateNumber(value).normalize("NFC").replace(/\s+/g, "");

export const isValidCommercialPlateNumber = (value: string) =>
  commercialPlatePattern.test(normalizeCommercialPlateNumber(value));

export const formatVehiclePlateNumberForDisplay = (value: string) => {
  const normalizedValue = normalizeVehiclePlateNumber(value);
  const match = normalizedValue.match(/^(\d{2,3}[가-힣])(\d{1,4})$/);

  if (!match) {
    return normalizedValue;
  }

  return match[1] + " " + match[2];
};
