import { differenceInMinutes } from "date-fns";
import type { Appointment } from "@/types";

export interface AppointmentEventDetails {
  title: string;
  category?: string;
  categoryLabel?: string;
  location?: string;
}

export const getDurationString = (start: string, end: string) => {
  const minutes = differenceInMinutes(new Date(end), new Date(start));
  if (minutes >= 60 && minutes % 60 === 0) {
    return `${minutes / 60}h`;
  }
  if (minutes >= 60) {
    return `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
  }
  return `${minutes}min`;
};

export const getInitials = (name: string) => {
  if (!name) return "??";
  const names = name.split(' ');
  if (names.length > 1) {
    return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

export const parseAppointmentEventDetails = (notes?: string | null): AppointmentEventDetails | null => {
  if (!notes) return null;

  const eventLine = notes
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("[EVENT]"));

  if (!eventLine) return null;

  try {
    const parsed = JSON.parse(eventLine.replace("[EVENT]", ""));
    if (!parsed?.title) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const getAppointmentDisplayTitle = (
  appointment: Pick<Appointment, "metadata" | "notes" | "patient_name" | "patient_id" | "start_time" | "end_time" | "location"> & {
    type: Appointment["type"] | "teleconsulta";
  },
) => {
  if (appointment.patient_name) return appointment.patient_name;

  if (appointment.metadata?.kind === "event" && appointment.metadata.eventTitle) {
    return appointment.metadata.eventTitle;
  }

  const eventDetails = parseAppointmentEventDetails(appointment.notes);
  if (eventDetails?.title) return eventDetails.title;

  if (appointment.type === "block" && appointment.notes) {
    return appointment.notes
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith("[EVENT]")) || "Compromisso";
  }

  return "Paciente não identificado";
};
