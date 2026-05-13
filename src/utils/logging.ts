export function logRecoverableWarning(message: string, error: unknown) {
  const formattedError = formatErrorForLog(error);
  console.warn(`${message}${formattedError ? ` ${formattedError}` : ""}`);
}

export function formatErrorForLog(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "";
}
