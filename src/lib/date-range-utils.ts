import { startOfDay, endOfDay, subDays, subMonths, subYears } from 'date-fns';

export type DateRangeKey = '7D' | '30D' | '6M' | '12M';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

/**
 * Calculates the start and end dates for a given date range key.
 * @param rangeKey The key representing the desired date range (e.g., '7D', '30D').
 * @returns An object containing the startDate and endDate for the selected range.
 */
export const getDatesForRange = (rangeKey: DateRangeKey): DateRange => {
  const now = new Date();
  let startDate: Date;

  switch (rangeKey) {
    case '7D':
      startDate = subDays(now, 6); // Last 7 days including today
      break;
    case '30D':
      startDate = subDays(now, 29); // Last 30 days including today
      break;
    case '6M':
      startDate = subMonths(now, 5); // Last 6 months including current month
      startDate = startOfDay(startDate); // Ensure it starts from the beginning of the day
      break;
    case '12M':
      startDate = subYears(now, 0); // Last 12 months including current month
      startDate = startOfDay(subMonths(startDate, 11)); // Start of the month 12 months ago
      break;
    default:
      startDate = subDays(now, 6); // Default to 7 days
  }

  return {
    startDate: startOfDay(startDate),
    endDate: endOfDay(now),
  };
};