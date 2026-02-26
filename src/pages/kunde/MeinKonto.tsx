import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, User, Upload, FileText, LogOut, CheckCircle, MessageSquare, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const statusColors: Record<string, string> = {
  "Offen": "bg-yellow-100 text-yellow-800",
  "In Bearbeitung": "bg-blue-100 text-blue-800",
  "In Druck": "bg-purple-100 text-purple-800",
  "Abgeschlossen": "bg-green-100 text-green-800",
  "Geliefert": "bg-green-100 text-green-800",
  "Storniert": "bg-red-100 text-red-800",
  "Neu": "bg-orange-100 text-orange-800",
  "Beantwortet": "bg-blue-100 text-blue-800",
  "Erledigt": "bg-green-100 text-green-800",
};

const MeinKonto = () => {
  const { user, signOut } = useCustomerAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ full_name: "", phone: "", address: "", city: "", postal_code: "" });
  const [files, setFiles] = useState<any[]>([]);
  const [portalData, setPortalData] = useState<{ customer: any; orders: any[]; inquiries: any[] } | null>(null);
  const [portalLoading, setPortalLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate("/anmelden"); return; }
    loadProfile();
    loadPortalData();
    loadFiles();
  }, [user]);

  const loadProfile = async () => {
    const { data } = await supabase.from("profiles").select("*").eq("user_id", user!.id).single();
    if (data) {
      setProfileForm({ full_name: data.full_name || "", phone: data.phone || "", address: data.address || "", city: data.city || "", postal_code: data.postal_code || "" });
    }
  };

  const loadPortalData = async () => {
    setPortalLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("get-customer-portal", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!error && data) setPortalData(data);
    } catch {}
    setPortalLoading(false);
  };

  const loadFiles = async () => {
    const { data } = await supabase.from("user_files").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
    setFiles(data || []);
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    const { error } = await supabase.from("profiles").update(profileForm).eq("user_id", user!.id);
    if (error) toast({ title: "Fehler", description: "Profil konnte nicht gespeichert werden.", variant: "destructive" });
    else toast({ title: "Gespeichert!", description: "Profil erfolgreich aktualisiert." });
    setSavingProfile(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `${user!.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("user-files").upload(path, file);
    if (uploadError) {
      toast({ title: "Fehler", description: "Datei konnte nicht hochgeladen werden.", variant: "destructive" });
    } else {
      await supabase.from("user_files").insert({ user_id: user!.id, file_name: file.name, file_path: path, file_size: file.size, file_type: file.type });
      toast({ title: "Hochgeladen!", description: `${file.name} wurde erfolgreich hochgeladen.` });
      loadFiles();
    }
    setUploading(false);
  };

  const hubOrders = portalData?.orders || [];
  const hubInquiries = portalData?.inquiries || [];

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="font-heading text-xl font-extrabold text-foreground">
            3D<span className="text-primary">Muscio</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={() => { signOut(); navigate("/"); }}>
              <LogOut className="w-4 h-4 mr-1" /> Abmelden
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold text-foreground">Mein Konto</h1>
          <p className="text-muted-foreground">Willkommen, {profileForm.full_name || user?.email}</p>
        </div>

        {new URLSearchParams(window.location.search).get("success") && (
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center gap-3 mb-6">
            <CheckCircle className="w-5 h-5 text-primary" />
            <p className="text-foreground font-medium">Zahlung erfolgreich! Vielen Dank für deine Bestellung.</p>
          </div>
        )}

        <Tabs defaultValue="auftraege">
          <TabsList className="mb-6">
            <TabsTrigger value="auftraege">
              <Package className="w-4 h-4 mr-2" />
              Aufträge
              {hubOrders.length > 0 && <Badge variant="secondary" className="ml-2 text-xs">{hubOrders.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="anfragen">
              <MessageSquare className="w-4 h-4 mr-2" />
              Anfragen
              {hubInquiries.length > 0 && <Badge variant="secondary" className="ml-2 text-xs">{hubInquiries.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="files"><Upload className="w-4 h-4 mr-2" />Dateien</TabsTrigger>
            <TabsTrigger value="profile"><User className="w-4 h-4 mr-2" />Profil</TabsTrigger>
          </TabsList>

          {/* Aufträge Tab */}
          <TabsContent value="auftraege">
            <Card>
              <CardHeader>
                <CardTitle>Meine Aufträge & Offerten</CardTitle>
              </CardHeader>
              <CardContent>
                {portalLoading ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Clock className="w-8 h-8 mx-auto mb-3 opacity-30 animate-spin" />
                    <p>Lädt...</p>
                  </div>
                ) : hubOrders.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Noch keine Aufträge vorhanden.</p>
                    {!portalData?.customer && (
                      <p className="text-sm mt-2 text-muted-foreground">
                        Damit Ihre Aufträge hier erscheinen, muss Ihre E-Mail-Adresse <strong>{user?.email}</strong> bei einem Auftrag hinterlegt sein.
                      </p>
                    )}
                    <Link to="/kontakt">
                      <Button variant="outline" className="mt-4">Anfrage stellen</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {hubOrders.map((order: any) => (
                      <div key={order.id} className="border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-medium text-foreground">
                              {order.name || order.beschreibung || `Auftrag #${order.id.slice(0, 8).toUpperCase()}`}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[order.status] || "bg-muted text-muted-foreground"}`}>
                              {order.status || "Offen"}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {order.datum ? new Date(order.datum).toLocaleDateString("de-CH") : "—"}
                            {order.beschreibung && ` · ${order.beschreibung}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {order.umsatz_total > 0 && (
                            <span className="font-semibold text-foreground">CHF {Number(order.umsatz_total).toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Anfragen Tab */}
          <TabsContent value="anfragen">
            <Card>
              <CardHeader>
                <CardTitle>Meine Anfragen & Support</CardTitle>
              </CardHeader>
              <CardContent>
                {portalLoading ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Clock className="w-8 h-8 mx-auto mb-3 opacity-30 animate-spin" />
                    <p>Lädt...</p>
                  </div>
                ) : hubInquiries.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Noch keine Anfragen vorhanden.</p>
                    <Link to="/kontakt">
                      <Button variant="outline" className="mt-4">Neue Anfrage stellen</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {hubInquiries.map((inq: any) => (
                      <div key={inq.id} className="border border-border rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-medium text-foreground">{inq.betreff || "Anfrage"}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[inq.status] || "bg-muted text-muted-foreground"}`}>
                            {inq.status}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{inq.nachricht}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(inq.created_at).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Files Tab */}
          <TabsContent value="files">
            <Card>
              <CardHeader><CardTitle>Meine 3D-Dateien</CardTitle></CardHeader>
              <CardContent>
                <div className="mb-4">
                  <Label htmlFor="file-upload" className="cursor-pointer">
                    <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary transition-colors">
                      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground">STL / OBJ / 3MF Datei hochladen</p>
                      <p className="text-xs text-muted-foreground mt-1">Klicken zum Auswählen</p>
                    </div>
                  </Label>
                  <Input id="file-upload" type="file" className="hidden" accept=".stl,.obj,.3mf,.step,.stp" onChange={handleFileUpload} disabled={uploading} />
                  {uploading && <p className="text-sm text-primary mt-2">Wird hochgeladen...</p>}
                </div>
                {files.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Noch keine Dateien hochgeladen.</p>
                ) : (
                  <div className="space-y-2">
                    {files.map((f: any) => (
                      <div key={f.id} className="flex items-center justify-between border border-border rounded-lg p-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{f.file_name}</p>
                          <p className="text-xs text-muted-foreground">{f.file_size ? `${(f.file_size / 1024).toFixed(0)} KB` : ""} · {new Date(f.created_at).toLocaleDateString("de-CH")}</p>
                        </div>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={async () => {
                          await supabase.storage.from("user-files").remove([f.file_path]);
                          await supabase.from("user_files").delete().eq("id", f.id);
                          loadFiles();
                        }}>Löschen</Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader><CardTitle>Mein Profil</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><Label>Vollständiger Name</Label><Input value={profileForm.full_name} onChange={e => setProfileForm(p => ({ ...p, full_name: e.target.value }))} /></div>
                  <div><Label>Telefon</Label><Input value={profileForm.phone} onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))} placeholder="+41 79 123 45 67" /></div>
                  <div className="sm:col-span-2"><Label>Adresse</Label><Input value={profileForm.address} onChange={e => setProfileForm(p => ({ ...p, address: e.target.value }))} placeholder="Musterstrasse 1" /></div>
                  <div><Label>Stadt</Label><Input value={profileForm.city} onChange={e => setProfileForm(p => ({ ...p, city: e.target.value }))} placeholder="Zürich" /></div>
                  <div><Label>PLZ</Label><Input value={profileForm.postal_code} onChange={e => setProfileForm(p => ({ ...p, postal_code: e.target.value }))} placeholder="8000" /></div>
                </div>
                <div className="border-t border-border pt-4">
                  <p className="text-sm text-muted-foreground mb-1">E-Mail (nicht änderbar)</p>
                  <p className="text-foreground font-medium">{user?.email}</p>
                  {portalData?.customer && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Mit 3DMuscio-Konto verknüpft
                    </p>
                  )}
                </div>
                <Button onClick={handleSaveProfile} disabled={savingProfile} className="w-full sm:w-auto">
                  {savingProfile ? "Speichern..." : "Profil speichern"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default MeinKonto;
