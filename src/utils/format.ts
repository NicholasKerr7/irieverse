export function formatDriveTime(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0 min";
  const roundedMinutes = Math.round(minutes);
  const hours = Math.floor(roundedMinutes / 60);
  const remainder = roundedMinutes % 60;
  if (!hours) return `${remainder} min`;
  if (!remainder) return `${hours} hr`;
  return `${hours} hr ${remainder} min`;
}

export function formatMiles(distanceKm: number, fallback = "0 mi"): string {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return fallback;
  return `${Math.max(1, Math.round(distanceKm * 0.621371))} mi`;
}

export function formatLocalTimeForAirport(
  dateString: string,
  airportCode: string,
  airportTimeZones: Record<string, string>
): string {
  if (!dateString) return "TBA";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "TBA";

  const targetTimeZone = airportTimeZones[airportCode] ?? "UTC";
  try {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: targetTimeZone,
    }).format(date);
  } catch {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
}
