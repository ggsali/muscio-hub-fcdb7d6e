import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Upload, Loader2, Package } from "lucide-react";
import { toast } from "sonner";

interface Category { id: string; name: string; slug: string; }
interface ProductImage { id: string; storage_path: string; is_primary: boolean; sort_order: number; }
interface Product {
  id: string; name: string; slug: string;
  kurzbeschreibung: string | null; beschreibung: string | null;
  preis: number; vergleichspreis: number | null; material: string | null;
  lagerbestand: number; unendlich_bestand: boolean; featured: boolean; aktiv: boolean;
  kategorie_id: string | null; sort_order: number;
  shop_product_images: ProductImage[];
}

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const empty = {
  name: "", slug: "", kurzbeschreibung: "", beschreibung: "",
  preis: 0, vergleichspreis: null as number | null, material: "",
  lagerbestand: 0, unendlich_bestand: false, featured: false, aktiv: true,
  kategorie_id: null as string | null, sort_order: 0,
};

export default function AdminShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [uploading, setUploading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const load = async () => {
    setLoading(true);
    const [pRes, cRes] = await Promise.all([
      supabase.from("shop_products").select("*, shop_product_images(*)").order("created_at", { ascending: false }),
      supabase.from("shop_categories").select("*").order("sort_order"),
    ]);
    setProducts((pRes.data || []) as any);
    setCats((cRes.data || []) as any);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const startNew = () => { setEditing(null); setForm({ ...empty }); setImageFile(null); setOpen(true); };
  const startEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name, slug: p.slug,
      kurzbeschreibung: p.kurzbeschreibung || "", beschreibung: p.beschreibung || "",
      preis: Number(p.preis), vergleichspreis: p.vergleichspreis ? Number(p.vergleichspreis) : null,
      material: p.material || "", lagerbestand: p.lagerbestand,
      unendlich_bestand: p.unendlich_bestand, featured: p.featured, aktiv: p.aktiv,
      kategorie_id: p.kategorie_id, sort_order: p.sort_order,
    });
    setImageFile(null);
    setOpen(true);
  };

  const save = async () => {
    if (!form.name) { toast.error("Name fehlt"); return; }
    const slug = form.slug || slugify(form.name);
    setUploading(true);
    try {
      let productId = editing?.id;
      if (editing) {
        const { error } = await supabase.from("shop_products").update({
          ...form, slug, vergleichspreis: form.vergleichspreis || null,
        }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("shop_products").insert({
          ...form, slug, vergleichspreis: form.vergleichspreis || null,
        }).select().single();
        if (error) throw error;
        productId = data.id;
      }

      if (imageFile && productId) {
        const path = `${productId}/${Date.now()}-${imageFile.name}`;
        const { error: upErr } = await supabase.storage.from("shop-products")
          .upload(path, imageFile, { contentType: imageFile.type });
        if (upErr) throw upErr;
        const isPrimary = !editing || (editing?.shop_product_images?.length ?? 0) === 0;
        await supabase.from("shop_product_images").insert({
          product_id: productId, storage_path: path, is_primary: isPrimary, sort_order: 0,
        });
      }

      toast.success(editing ? "Produkt aktualisiert" : "Produkt erstellt");
      setOpen(false);
      load();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Fehler beim Speichern");
    } finally {
      setUploading(false);
    }
  };

  const del = async (id: string) => {
    if (!confirm("Produkt wirklich löschen?")) return;
    await supabase.from("shop_products").delete().eq("id", id);
    toast.success("Gelöscht");
    load();
  };

  const getImg = (path: string) => supabase.storage.from("shop-products").getPublicUrl(path).data.publicUrl;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Shop-Produkte</h1>
          <p className="text-sm text-muted-foreground">Produkte, Bilder, Bestand und Sichtbarkeit verwalten</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={startNew} className="gap-2"><Plus className="w-4 h-4" /> Neues Produkt</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Produkt bearbeiten" : "Neues Produkt"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: f.slug || slugify(e.target.value) }))} /></div>
                <div><Label>Slug</Label><Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="auto" /></div>
              </div>
              <div><Label>Kurzbeschreibung</Label><Input value={form.kurzbeschreibung} onChange={e => setForm(f => ({ ...f, kurzbeschreibung: e.target.value }))} /></div>
              <div><Label>Beschreibung</Label><Textarea rows={4} value={form.beschreibung} onChange={e => setForm(f => ({ ...f, beschreibung: e.target.value }))} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Preis (CHF) *</Label><Input type="number" step="0.01" value={form.preis} onChange={e => setForm(f => ({ ...f, preis: Number(e.target.value) }))} /></div>
                <div><Label>Vergleichspreis</Label><Input type="number" step="0.01" value={form.vergleichspreis ?? ""} onChange={e => setForm(f => ({ ...f, vergleichspreis: e.target.value ? Number(e.target.value) : null }))} /></div>
                <div><Label>Material</Label><Input value={form.material} onChange={e => setForm(f => ({ ...f, material: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Kategorie</Label>
                  <Select value={form.kategorie_id ?? "none"} onValueChange={v => setForm(f => ({ ...f, kategorie_id: v === "none" ? null : v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Keine</SelectItem>
                      {cats.filter(c => c.slug !== "alle").map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Lagerbestand</Label><Input type="number" value={form.lagerbestand} onChange={e => setForm(f => ({ ...f, lagerbestand: Number(e.target.value) }))} disabled={form.unendlich_bestand} /></div>
              </div>
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm"><Switch checked={form.unendlich_bestand} onCheckedChange={v => setForm(f => ({ ...f, unendlich_bestand: v }))} /> Unbegrenzt</label>
                <label className="flex items-center gap-2 text-sm"><Switch checked={form.featured} onCheckedChange={v => setForm(f => ({ ...f, featured: v }))} /> Featured</label>
                <label className="flex items-center gap-2 text-sm"><Switch checked={form.aktiv} onCheckedChange={v => setForm(f => ({ ...f, aktiv: v }))} /> Aktiv</label>
              </div>
              <div>
                <Label>Bild hinzufügen</Label>
                <Input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} />
                {editing && editing.shop_product_images?.length > 0 && (
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {editing.shop_product_images.map(im => (
                      <img key={im.id} src={getImg(im.storage_path)} alt="" className="w-16 h-16 rounded object-cover border" />
                    ))}
                  </div>
                )}
              </div>
              <Button onClick={save} disabled={uploading} className="w-full gap-2">
                {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Speichern…</> : <><Upload className="w-4 h-4" /> Speichern</>}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-2xl">
          <Package className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">Noch keine Produkte. Lege das erste an.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {products.map(p => {
            const img = p.shop_product_images?.find(i => i.is_primary) || p.shop_product_images?.[0];
            return (
              <div key={p.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="aspect-video bg-muted">
                  {img ? <img src={getImg(img.storage_path)} alt={p.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><Package className="w-8 h-8 text-muted-foreground/30" /></div>}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground truncate">/{p.slug}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => startEdit(p)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => del(p.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 text-xs">
                    <span className="font-bold text-primary">CHF {Number(p.preis).toFixed(2)}</span>
                    {!p.aktiv && <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">inaktiv</span>}
                    {p.featured && <span className="px-2 py-0.5 rounded bg-primary/10 text-primary">★ featured</span>}
                    {!p.unendlich_bestand && <span className="text-muted-foreground">Lager: {p.lagerbestand}</span>}
                    {p.unendlich_bestand && <span className="text-muted-foreground">∞</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
