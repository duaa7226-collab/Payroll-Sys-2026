import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely read a JSON-encoded string array (e.g. CustomBonus.targetRiderIds).
 * A single malformed row used to throw and break every payroll calculation.
 */
export function parseStringArray(json: string | null | undefined): string[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}
