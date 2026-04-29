import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User } from "lucide-react";

export default function PortalProfilePage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState({
    full_name: "", phone: "", address: "", postal_code: "", city: "", country: "Schweiz",
  });
  const [profileId, setProfileId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setEmail(u.user.email || "");
      const { data: p } = await supabase.from("profiles").select("*").eq("user_id", u.user.id).maybeSingle();
      if (p) {
        setProfileId(p.id);
        setProfile({
          full_name: p.full_name || "", phone: p.phone || "", address: p.address || "",
          postal_code: p.postal_code || "", city: p.city || "", country: p.country || "Schweiz",
        });
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setSaving(false); return; }
    const payload = { ...profile, user_id: u.user.id };
    const { error } = profileId
      ? await supabase.from("profiles").update(payload).eq("id", profileId)
      : await supabase.from("profiles").insert(payload);
    setSaving(false);
    if (error) toast({ title: "Fehler", description: error.message, variant: "destructive" });
    else toast({ title: "Profil gespeichert" });
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground text-sm">Laden...</div>;

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <h1 className="text-2xl font-bold flex items-center gap-2"><User className="w-5 h-5 text-primary" /> Mein Profil</h1>
      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <div>
          <Label>E-Mail</Label>
          <Input value={email} disabled className="bg-input border-border" />
        </div>
        <div>
          <Label>Voller Name</Label>
          <Input value={profile.full_name} onChange={e => setProfile({ ...profile, full_name: e.target.value })} className="bg-input border-border" />
        </div>
        <div>
          <Label>Telefon</Label>
          <Input value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} className="bg-input border-border" />
        </div>
        <div>
          <Label>Adresse</Label>
          <Input value={profile.address} onChange={e => setProfile({ ...profile, address: e.target.value })} className="bg-input border-border" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>PLZ</Label>
            <Input value={profile.postal_code} onChange={e => setProfile({ ...profile, postal_code: e.target.value })} className="bg-input border-border" />
          </div>
          <div className="col-span-2">
            <Label>Ort</Label>
            <Input value={profile.city} onChange={e => setProfile({ ...profile, city: e.target.value })} className="bg-input border-border" />
          </div>
        </div>
        <div>
          <Label>Land</Label>
          <Input value={profile.country} onChange={e => setProfile({ ...profile, country: e.target.value })} className="bg-input border-border" />
        </div>
        <Button onClick={save} disabled={saving} className="gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Speichern
        </Button>
      </div>
    </div>
  );
}
