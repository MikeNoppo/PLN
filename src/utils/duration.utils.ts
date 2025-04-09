/**
 * Converts a duration string (e.g., '1h', '7d', '30m') to milliseconds.
 * @param duration The duration string.
 * @param defaultMs The default value in milliseconds if duration is invalid or missing.
 * @returns The duration in milliseconds.
 */
export const getDurationInMs = (duration: string | undefined | null, defaultMs: number): number => {
  if (!duration) return defaultMs;
  const value = parseInt(duration);
  if (isNaN(value)) return defaultMs; // Handle cases like "invalid"

  if (duration.includes('d')) return value * 24 * 3600000; // days to ms
  if (duration.includes('h')) return value * 3600000; // hours to ms
  if (duration.includes('m')) return value * 60000; // minutes to ms
  if (duration.includes('s')) return value * 1000; // seconds to ms (added for completeness)

  // If no unit, assume milliseconds or return default
  // Depending on requirements, you might want to treat unitless numbers differently
  return value; // Or return defaultMs if unitless numbers are not desired
};
