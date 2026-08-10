/**
 * Zwischenspeicher für Dateien, die auf einer anderen Seite (z. B. Startseite)
 * ausgewählt wurden und im Online-Kalkulator weiterverarbeitet werden sollen.
 * File-Objekte lassen sich nicht in sessionStorage ablegen, darum ein Modul-Singleton.
 */
let pending: File[] = [];

export const setPendingUploads = (files: File[]) => {
  pending = files;
};

export const takePendingUploads = (): File[] => {
  const f = pending;
  pending = [];
  return f;
};

export const ACCEPTED_MODEL_EXTENSIONS = [".stl", ".step", ".stp", ".3mf", ".obj"];

export const isAcceptedModel = (name: string) =>
  ACCEPTED_MODEL_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));
