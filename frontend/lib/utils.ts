import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(isoString: string | null | undefined, formatStr: string = "MMM d, yyyy HH:mm"): string {
  if (!isoString) return "—";
  try {
    const d = typeof isoString === "string" ? parseISO(isoString) : new Date(isoString);
    return format(d, formatStr);
  } catch {
    return isoString;
  }
}

export function formatRelativeTime(isoString: string | null | undefined): string {
  if (!isoString) return "—";
  try {
    const d = typeof isoString === "string" ? parseISO(isoString) : new Date(isoString);
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return isoString;
  }
}

export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}
