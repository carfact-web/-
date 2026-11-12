import "server-only";
import { isLocalSandbox } from "./sandbox";

// Only server process configuration can enable local login or fixture handlers.
// Query strings, cookies, request headers and submitted form fields are not read.
export function isLocalSandboxServer() {
  return process.env.CARFACT_LOCAL_SANDBOX === "1" && isLocalSandbox();
}
