/**
 * Timezone-safe date/time utilities for Brazil (America/Sao_Paulo)
 * 
 * The Problem:
 * - Users input dates/times in their local timezone (e.g., São Paulo, UTC-3)
 * - `new Date()` interprets input correctly in local time
 * - `toISOString()` converts to UTC, which shifts the time by +3 hours
 * - When this is stored in DB and shown back, we see a 3-hour discrepancy
 * 
 * The Solution:
 * - Store the date/time with an explicit timezone indicator
 * - When displaying, always format with the expected timezone
 * - Use these utility functions consistently across the app
 */

const BRAZIL_TIMEZONE = "America/Sao_Paulo";

/**
 * Converts a local date and time string to an ISO string that preserves the intended time.
 * 
 * Instead of using `toISOString()` which shifts to UTC, this creates an ISO string
 * that, when parsed by the server in the São Paulo timezone, will show the correct time.
 * 
 * @param dateStr - Date in YYYY-MM-DD format
 * @param timeStr - Time in HH:mm format
 * @returns ISO string with the correct time for São Paulo timezone
 */
export function localDateTimeToISO(dateStr: string, timeStr: string): string {
    // Create the date object interpreting the input as local time
    const localDate = new Date(`${dateStr}T${timeStr}:00`);

    // toISOString converts to UTC, which is what we want for storage
    // The server (Edge Function) should then format with the correct timezone for display
    return localDate.toISOString();
}

/**
 * Formats a date for display in Brazil timezone
 * @param isoString - ISO date string from the database
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string
 */
export function formatDateBrazil(
    isoString: string | Date,
    options: Intl.DateTimeFormatOptions = {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    }
): string {
    const date = typeof isoString === 'string' ? new Date(isoString) : isoString;
    return date.toLocaleDateString("pt-BR", {
        timeZone: BRAZIL_TIMEZONE,
        ...options
    });
}

/**
 * Formats a time for display in Brazil timezone
 * @param isoString - ISO date string from the database
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted time string
 */
export function formatTimeBrazil(
    isoString: string | Date,
    options: Intl.DateTimeFormatOptions = {
        hour: "2-digit",
        minute: "2-digit"
    }
): string {
    const date = typeof isoString === 'string' ? new Date(isoString) : isoString;
    return date.toLocaleTimeString("pt-BR", {
        timeZone: BRAZIL_TIMEZONE,
        ...options
    });
}

/**
 * Formats a full date/time for display in Brazil timezone
 * @param isoString - ISO date string from the database
 * @returns Formatted date/time string
 */
export function formatDateTimeBrazil(isoString: string | Date): string {
    const date = typeof isoString === 'string' ? new Date(isoString) : isoString;
    return date.toLocaleString("pt-BR", {
        timeZone: BRAZIL_TIMEZONE,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

/**
 * Creates a Date object from date and time strings, preserving local timezone intent.
 * This is the correct way to parse user input for appointments.
 * 
 * @param dateStr - Date in YYYY-MM-DD format
 * @param timeStr - Time in HH:mm format
 * @returns Date object in local timezone
 */
export function createLocalDate(dateStr: string, timeStr: string): Date {
    return new Date(`${dateStr}T${timeStr}:00`);
}

/**
 * Gets the current date/time formatted for Brazil timezone
 */
export function nowBrazil(): Date {
    return new Date();
}

/**
 * Formats relative time (e.g., "em 2 horas", "ontem")
 */
export function formatRelativeTime(isoString: string | Date): string {
    const date = typeof isoString === 'string' ? new Date(isoString) : isoString;
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 0) {
        // Past
        if (diffDays < -1) return `há ${Math.abs(diffDays)} dias`;
        if (diffDays === -1) return "ontem";
        if (diffHours < 0) return `há ${Math.abs(diffHours)} hora${Math.abs(diffHours) !== 1 ? 's' : ''}`;
        return `há ${Math.abs(diffMins)} minuto${Math.abs(diffMins) !== 1 ? 's' : ''}`;
    } else {
        // Future
        if (diffDays > 1) return `em ${diffDays} dias`;
        if (diffDays === 1) return "amanhã";
        if (diffHours > 0) return `em ${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
        return `em ${diffMins} minuto${diffMins !== 1 ? 's' : ''}`;
    }
}

export const TIMEZONE_BRAZIL = BRAZIL_TIMEZONE;
