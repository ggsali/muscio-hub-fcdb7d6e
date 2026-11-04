import { supabase } from "@/integrations/supabase/client";

export type LabKind = "slicer" | "kalkulator" | "spardose";

/**
 * Speichert das Ergebnis eines Testlaufs in lab_jobs.
 * Schlaegt still fehl: ein Speicherfehler darf einen Test nie blockieren.
 * lab_jobs ist per RLS nur fuer Admins lesbar und schreibbar.
 */
export async function saveLabJob(input: {
  kind: LabKind;
  filename?: string | null;
  settings?: Record<string, unknown>;
  result?: Record<string, unknown>;
  notes?: string | null;
}): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    await (supabase as any).from("lab_jobs").insert({
      kind: input.kind,
      filename: input.filename ?? null,
      settings: input.settings ?? {},
      result: input.result ?? {},
      notes: input.notes ?? null,
      created_by: data.user?.id ?? null,
    });
  } catch {
    /* Testprotokoll ist optional */
  }
}
