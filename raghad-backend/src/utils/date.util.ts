export const TIMEZONE = 'Africa/Nouakchott';

export function getLocalDate(date: Date = new Date()): Date {
  return new Date(date.toLocaleString('en-US', { timeZone: TIMEZONE }));
}

export function startOfDay(date: Date = new Date()): Date {
  const local = new Date(date.toLocaleString('en-US', { timeZone: TIMEZONE }));
  local.setHours(0, 0, 0, 0);
  return local;
}

export function endOfDay(date: Date = new Date()): Date {
  const local = new Date(date.toLocaleString('en-US', { timeZone: TIMEZONE }));
  local.setHours(23, 59, 59, 999);
  return local;
}

export function toISODateString(date: Date): string {
  return date.toISOString();
}

export function parseLocalDate(dateString: string): Date {
  return new Date(`${dateString}T00:00:00.000Z`);
}