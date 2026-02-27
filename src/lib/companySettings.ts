import { supabase } from "@/integrations/supabase/client";

export interface CompanySettings {
  firmenname: string;
  slogan: string;
  adresse: string;
  uid_nummer: string;
  telefon: string;
  email: string;
  website: string;
  bank_name: string;
  bank_iban: string;
  bank_inhaber: string;
  primary_color: string; // hex e.g. "#FF5A00"
  logo_url: string;
  zahlungsbedingungen: string;
  qr_bill_image_url: string;
}

export const DEFAULT_COMPANY: CompanySettings = {
  firmenname: "3dMuscio",
  slogan: "Professioneller 3D-Druck | Schweiz",
  adresse: "",
  uid_nummer: "",
  telefon: "",
  email: "",
  website: "",
  bank_name: "",
  bank_iban: "",
  bank_inhaber: "",
  primary_color: "#FF5A00",
  logo_url: "",
  zahlungsbedingungen: "Zahlung fällig innerhalb von 30 Tagen nach Rechnungsdatum. Bei Fragen stehen wir Ihnen gerne zur Verfügung.",
  qr_bill_image_url: "",
};

export async function loadCompanySettings(): Promise<CompanySettings> {
  const { data } = await supabase.from("company_settings").select("*");
  if (!data || data.length === 0) return DEFAULT_COMPANY;
  const s: Partial<CompanySettings> = {};
  for (const row of data) {
    (s as Record<string, string>)[row.key] = row.value ?? "";
  }
  return { ...DEFAULT_COMPANY, ...s };
}

export async function saveCompanySettings(settings: CompanySettings): Promise<void> {
  const entries = Object.entries(settings).map(([key, value]) => ({
    key,
    value: String(value ?? ""),
    updated_at: new Date().toISOString(),
  }));
  for (const entry of entries) {
    await supabase.from("company_settings").upsert(entry, { onConflict: "key" });
  }
}

export async function uploadLogo(file: File): Promise<string> {
  const ext = file.name.split(".").pop();
  const path = `logo.${ext}`;
  const { error } = await supabase.storage
    .from("company-assets")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from("company-assets").getPublicUrl(path);
  return data.publicUrl + `?t=${Date.now()}`;
}
