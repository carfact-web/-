export const sanitizeUserText = (value: string) =>
  value.replace(/[<>]/g, "").replace(/[\u0000-\u001F\u007F]/g, "").trim();

export const sanitizeMultilineUserText = (value: string) =>
  value
    .replace(/[<>]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();

export const sanitizeVehiclePlateNumber = (value: string) =>
  value
    .replace(/[^0-9ㄱ-ㅎ가-힣]/g, "")
    .slice(0, 20);

export const sanitizeMileage = (value: string) =>
  value.replace(/[^0-9]/g, "").slice(0, 7);
