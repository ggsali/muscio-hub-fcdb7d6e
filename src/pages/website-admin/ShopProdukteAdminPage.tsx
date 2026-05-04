import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Pencil, X, Star, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

interface Category { id: string; name: string; slug: string; aktiv: boolean; sort_order: number; }
interface ProductImage { id: string; storage_path: string; is_primary: boolean; sort_order: number; }
interface Product {
  id: string;
  name: string;
  slug: string;
  kurzbeschreibung: string | null;
  beschreibung: string | null;
  preis: number;
  vergleichspreis: number | null;
  material: string | null;
  lagerbestand: number;
  unendlich_bestand: boolean;
  aktiv: boolean;
  featured: boolean;
  sort_order: number;
  kategorie_id: string | null;
  tags: string[] | null;
  shop_product_images: ProductImage[];
}

const slugify = (s: string) =>
  s.toLowerCase().trim()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const imgUrl = (p: string) => supabase.storage.from("shop-products").getPublicUrl(p).data.publicUrl;

const emptyForm = {
  name: "", slug: "", kurzbeschreibung: "", beschreibung: "",
  preis: "0", vergleichspreis: "", material: "", lagerbestand: "0",
  unendlich_bestand: false, aktiv: true, featured: false, sort_order: 0,
  kategorie_id: "" as string | "", tags: "",
};

export default function ShopProdukteAdminPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"products" | "categories">("products");

  // Produkt-Dialog
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Kategorie-Form
  const [catForm, setCatForm] = useState({ name: "", slug: "" });

  const load = async () => {
    setLoading(true);
    const [prodRes, catRes] = await Promise.all([
      supabase.from("shop_products").select("*, shop_product_images(*)").order("sort_order"),
      supabase.from("shop_categories").select("*").order("sort_order"),
    ]);
    setProducts((prodRes.data as any) || []);
    setCategories((catRes.data as any) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm, sort_order: products.length + 1 });
    setOpen(true);
  };
  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name, slug: p.slug,
      kurzbeschreibung: p.kurzbeschreibung || "",
      beschreibung: p.beschreibung || "",
      preis: String(p.preis), vergleichspreis: p.vergleichspreis ? String(p.vergleichspreis) : "",
      material: p.material || "", lagerbestand: String(p.lagerbestand),
      unendlich_bestand: p.unendlich_bestand, aktiv: p.aktiv, featured: p.featured,
      sort_order: p.sort_order, kategorie_id: p.kategorie_id || "",
      tags: (p.tags || []).join(", "),
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Name fehlt"); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      slug: (form.slug || slugify(form.name)).trim(),
      kurzbeschreibung: form.kurzbeschreibung || null,
      beschreibung: form.beschreibung || null,
      preis: Number(form.preis) || 0,
      vergleichspreis: form.vergleichspreis ? Number(form.vergleichspreis) : null,
      material: form.material || null,
      lagerbestand: Number(form.lagerbestand) || 0,
      unendlich_bestand: form.unendlich_bestand,
      aktiv: form.aktiv,
      featured: form.featured,
      sort_order: Number(form.sort_order) || 0,
      kategorie_id: form.kategorie_id || null,
      tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : null,
    };
    let err;
    if (editing) {
      ({ error: err } = await supabase.from("shop_products").update(payload).eq("id", editing.id));
    } else {
      ({ error: err } = await supabase.from("shop_products").insert(payload));
    }
    setSaving(false);
    if (err) { toast.error(err.message); return; }
    toast.success(editing ? "Produkt gespeichert" : "Produkt erstellt");
    setOpen(false);
    load();
  };

  const remove = async (p: Product) => {
    if (!confirm(`Produkt "${p.name}" wirklich löschen?`)) return;
    // Bilder aus Storage löschen
    if (p.shop_product_images?.length) {
      await supabase.storage.from("shop-products").remove(p.shop_product_images.map(i => i.storage_path));
    }
    const { error } = await supabase.from("shop_products").delete().eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Gelöscht");
    load();
  };

  const toggleField = async (p: Product, field: "aktiv" | "featured") => {
    const patch = field === "aktiv" ? { aktiv: !p.aktiv } : { featured: !p.featured };
    await supabase.from("shop_products").update(patch).eq("id", p.id);
    load();
  };

  const uploadImage = async (p: Product, file: File) => {
    const path = `${p.id}/${crypto.randomUUID()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("shop-products").upload(path, file);
    if (upErr) { toast.error(upErr.message); return; }
    const isPrimary = (p.shop_product_images?.length || 0) === 0;
    const { error } = await supabase.from("shop_product_images").insert({
      product_id: p.id, storage_path: path, is_primary: isPrimary,
      sort_order: (p.shop_product_images?.length || 0) + 1,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Bild hochgeladen");
    load();
  };

  const removeImage = async (img: ProductImage) => {
    await supabase.storage.from("shop-products").remove([img.storage_path]);
    await supabase.from("shop_product_images").delete().eq("id", img.id);
    load();
  };

  const setPrimary = async (p: Product, img: ProductImage) => {
    await supabase.from("shop_product_images").update({ is_primary: false }).eq("product_id", p.id);
    await supabase.from("shop_product_images").update({ is_primary: true }).eq("id", img.id);
    load();
  };

  // Kategorien
  const addCategory = async () => {
    if (!catForm.name.trim()) return;
    const { error } = await supabase.from("shop_categories").insert({
      name: catForm.name.trim(),
      slug: (catForm.slug || slugify(catForm.name)).trim(),
      sort_order: categories.length + 1,
    });
    if (error) { toast.error(error.message); return; }
    setCatForm({ name: "", slug: "" });
    toast.success("Kategorie erstellt");
    load();
  };
  const toggleCat = async (c: Category) => {
    await supabase.from("shop_categories").update({ aktiv: !c.aktiv }).eq("id", c.id);
    load();
  };
  const removeCat = async (c: Category) => {
    if (!confirm(`Kategorie "${c.name}" löschen?`)) return;
    const { error } = await supabase.from("shop_categories").delete().eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-3xl font-bold mb-1">Shop-Produkte</h1>
          <p className="text-muted-foreground">Verwalte Produkte, Bilder und Kategorien.</p>
        </div>
        {tab === "products" && (
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Produkt</Button>
        )}
      </div>

      <div className="flex gap-2 mb-6 border-b border-border">
        <button
          onClick={() => setTab("products")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === "products" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >Produkte ({products.length})</button>
        <button
          onClick={() => setTab("categories")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === "categories" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >Kategorien ({categories.length})</button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Lädt…</p>
      ) : tab === "products" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {products.map(p => {
            const primary = p.shop_product_images?.find(i => i.is_primary) || p.shop_product_images?.[0];
            return (
              <div key={p.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="aspect-video bg-muted relative">
                  {primary ? (
                    <img src={imgUrl(primary.storage_path)} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">Kein Bild</div>
                  )}
                  {p.featured && (
                    <span className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] uppercase tracking-wider px-2 py-1 rounded-full">Featured</span>
                  )}
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.slug}</p>
                    </div>
                    <p className="font-bold text-primary whitespace-nowrap">CHF {p.preis.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Lager: {p.unendlich_bestand ? "∞" : p.lagerbestand}</span>
                    {p.material && <span>· {p.material}</span>}
                  </div>

                  {/* Bilder */}
                  <div className="flex gap-1 flex-wrap">
                    {p.shop_product_images?.map(img => (
                      <div key={img.id} className="relative group w-12 h-12 rounded overflow-hidden border border-border">
                        <img src={imgUrl(img.storage_path)} className="w-full h-full object-cover" alt="" />
                        {img.is_primary && <Star className="absolute top-0.5 left-0.5 w-3 h-3 text-primary fill-primary" />}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                          {!img.is_primary && (
                            <button onClick={() => setPrimary(p, img)} title="Als Hauptbild" className="text-white"><Star className="w-3 h-3" /></button>
                          )}
                          <button onClick={() => removeImage(img)} title="Löschen" className="text-white"><X className="w-3 h-3" /></button>
                        </div>
                      </div>
                    ))}
                    <label className="w-12 h-12 rounded border border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-muted">
                      <ImagePlus className="w-4 h-4 text-muted-foreground" />
                      <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadImage(p, e.target.files[0])} />
                    </label>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                    <label className="flex items-center gap-2 text-xs">
                      <Switch checked={p.aktiv} onCheckedChange={() => toggleField(p, "aktiv")} />
                      Aktiv
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <Switch checked={p.featured} onCheckedChange={() => toggleField(p, "featured")} />
                      Featured
                    </label>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(p)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(p)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {products.length === 0 && <p className="text-muted-foreground col-span-full">Noch keine Produkte.</p>}
        </div>
      ) : (
        <div className="space-y-4 max-w-2xl">
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <p className="font-semibold text-sm">Neue Kategorie</p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Name</Label><Input value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} /></div>
              <div><Label>Slug (optional)</Label><Input value={catForm.slug} onChange={e => setCatForm({ ...catForm, slug: e.target.value })} placeholder="auto" /></div>
            </div>
            <div className="flex justify-end"><Button onClick={addCategory}><Plus className="w-4 h-4 mr-1" /> Hinzufügen</Button></div>
          </div>
          <div className="space-y-2">
            {categories.map(c => (
              <div key={c.id} className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.slug}</p>
                </div>
                <Switch checked={c.aktiv} onCheckedChange={() => toggleCat(c)} />
                <Button size="sm" variant="ghost" onClick={() => removeCat(c)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
              </div>
            ))}
            {categories.length === 0 && <p className="text-muted-foreground text-sm">Noch keine Kategorien.</p>}
          </div>
        </div>
      )}

      {/* Produkt-Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Produkt bearbeiten" : "Neues Produkt"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Slug</Label><Input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="auto" /></div>
            </div>
            <div><Label>Kurzbeschreibung</Label><Input value={form.kurzbeschreibung} onChange={e => setForm({ ...form, kurzbeschreibung: e.target.value })} /></div>
            <div><Label>Beschreibung</Label><Textarea rows={4} value={form.beschreibung} onChange={e => setForm({ ...form, beschreibung: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Preis (CHF) *</Label><Input type="number" step="0.01" value={form.preis} onChange={e => setForm({ ...form, preis: e.target.value })} /></div>
              <div><Label>Vergleichspreis</Label><Input type="number" step="0.01" value={form.vergleichspreis} onChange={e => setForm({ ...form, vergleichspreis: e.target.value })} /></div>
              <div><Label>Material</Label><Input value={form.material} onChange={e => setForm({ ...form, material: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Lagerbestand</Label><Input type="number" value={form.lagerbestand} onChange={e => setForm({ ...form, lagerbestand: e.target.value })} disabled={form.unendlich_bestand} /></div>
              <div className="flex items-end pb-2"><label className="flex items-center gap-2 text-sm"><Switch checked={form.unendlich_bestand} onCheckedChange={v => setForm({ ...form, unendlich_bestand: v })} /> Unbegrenzt</label></div>
              <div><Label>Reihenfolge</Label><Input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Kategorie</Label>
                <Select value={form.kategorie_id || "none"} onValueChange={v => setForm({ ...form, kategorie_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">– keine –</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Tags (komma-getrennt)</Label><Input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="neu, sale" /></div>
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.aktiv} onCheckedChange={v => setForm({ ...form, aktiv: v })} /> Aktiv</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.featured} onCheckedChange={v => setForm({ ...form, featured: v })} /> Featured</label>
            </div>
            {!editing && (
              <p className="text-xs text-muted-foreground">Bilder kannst du nach dem Erstellen direkt in der Produktkarte hochladen.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Speichert…" : "Speichern"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
