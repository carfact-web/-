export const sanitizeUserText = (value: string) =>
  value.replace(/[<>]/g, "").replace(/[\u0000-\u001F\u007F]/g, "").trim();

export const sanitizeVehiclePlateNumber = (value: string) =>
  value
    .replace(/[^0-9ㄱ-ㅎ가-힣]/g, "")
    .slice(0, 20);

export const sanitizeMileage = (value: string) =>
  value.replace(/[^0-9]/g, "").slice(0, 7);
