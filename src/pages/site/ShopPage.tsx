import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/site/ScrollReveal";
import { Input } from "@/components/ui/input";
import { ShoppingCart, Search, Package, Star, X, Loader2, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  slug: string;
  kurzbeschreibung: string | null;
  preis: number;
  vergleichspreis: number | null;
  material: string | null;
  lagerbestand: number;
  unendlich_bestand: boolean;
  featured: boolean;
  shop_product_images: { storage_path: string; is_primary: boolean; sort_order: number }[];
  shop_categories: { name: string; slug: string } | null;
  kategorie_id: string | null;
}
interface Category { id: string; name: string; slug: string; }

const getImageUrl = (path: string) =>
  supabase.storage.from("shop-products").getPublicUrl(path).data.publicUrl;

const ShopPage = () => {
  const [params, setParams] = useSearchParams();
  const { addItem } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(params.get("kategorie") || "alle");
  const [sort, setSort] = useState("featured");

  useEffect(() => {
    supabase.from("shop_categories").select("*").eq("aktiv", true).order("sort_order")
      .then(({ data }) => setCats(data || []));
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      let q = supabase.from("shop_products")
        .select("*, shop_product_images(*), shop_categories(name, slug)")
        .eq("aktiv", true);
      if (active && active !== "alle") {
        const cat = cats.find(c => c.slug === active);
        if (cat) q = q.eq("kategorie_id", cat.id);
      }
      const { data } = await q.order("sort_order");
      setProducts((data || []).map((p: any) => ({
        ...p,
        shop_product_images: [...(p.shop_product_images || [])].sort(
          (a, b) => (a.is_primary ? -1 : 1) || a.sort_order - b.sort_order
        ),
      })) as Product[]);
      setLoading(false);
    };
    load();
  }, [active, cats]);

  const filtered = products
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.kurzbeschreibung || "").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === "preis-asc") return a.preis - b.preis;
      if (sort === "preis-desc") return b.preis - a.preis;
      return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
    });

  const handleAdd = (p: Product, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const img = p.shop_product_images[0];
    addItem({
      productId: p.id, name: p.name, preis: Number(p.preis), quantity: 1,
      image: img ? getImageUrl(img.storage_path) : undefined, slug: p.slug,
    });
    toast.success(`${p.name} hinzugefügt`);
  };

  const changeCat = (slug: string) => {
    setActive(slug);
    setParams(slug !== "alle" ? { kategorie: slug } : {});
  };

  return (
    <div className="pt-24 pb-20 min-h-screen">
      <div className="container mx-auto px-4 max-w-7xl">
        <ScrollReveal>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-foreground via-foreground/95 to-foreground/80 text-background p-10 md:p-16 mb-12">
            <div className="absolute inset-0 opacity-10">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="absolute rounded-full bg-primary"
                  style={{
                    width: Math.random() * 200 + 50, height: Math.random() * 200 + 50,
                    left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
                    transform: "translate(-50%,-50%)", filter: "blur(60px)",
                  }} />
              ))}
            </div>
            <div className="relative z-10 max-w-xl">
              <p className="text-xs font-bold text-primary uppercase tracking-[0.25em] mb-3">3D-Druck Shop</p>
              <h1 className="font-heading text-4xl md:text-6xl font-extrabold tracking-tight mb-4">
                Handgefertigte<br /><span className="text-primary">3D-Produkte</span>
              </h1>
              <p className="text-background/60 text-base md:text-lg max-w-sm">
                Einzigartige Teile aus dem 3D-Drucker. Direkt aus der Schweiz.
              </p>
            </div>
          </div>
        </ScrollReveal>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Produkte suchen…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
          <select value={sort} onChange={e => setSort(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="featured">Empfohlen</option>
            <option value="preis-asc">Preis aufsteigend</option>
            <option value="preis-desc">Preis absteigend</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          {cats.map(c => (
            <button key={c.slug} onClick={() => changeCat(c.slug)}
              className={cn(
                "px-4 py-2 rounded-full text-xs font-semibold transition-all border",
                active === c.slug
                  ? "bg-foreground text-background border-foreground shadow-lg"
                  : "bg-card text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
              )}>{c.name}</button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <ShoppingBag className="w-12 h-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">Noch keine Produkte verfügbar.</p>
            <Button asChild variant="outline"><Link to="/kalkulator-online">Stattdessen Auftrag berechnen</Link></Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
            <AnimatePresence>
              {filtered.map((p, i) => {
                const img = p.shop_product_images[0];
                const inStock = p.unendlich_bestand || p.lagerbestand > 0;
                const disc = p.vergleichspreis ? Math.round((1 - Number(p.preis) / Number(p.vergleichspreis)) * 100) : null;
                return (
                  <motion.div key={p.id} layout
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: i * 0.04 }}>
                    <Link to={`/shop/${p.slug}`} className="block group">
                      <motion.div className="bg-card rounded-2xl border border-border hover:border-primary/30 overflow-hidden transition-all"
                        whileHover={{ y: -4 }}>
                        <div className="relative aspect-square bg-muted overflow-hidden">
                          <img src={img ? getImageUrl(img.storage_path) : "/placeholder.svg"} alt={p.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          {disc && <div className="absolute top-2 left-2 bg-secondary text-secondary-foreground text-[10px] font-bold px-2 py-0.5 rounded">-{disc}%</div>}
                          {p.featured && <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded">★</div>}
                          {!inStock && (
                            <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] flex items-center justify-center">
                              <span className="bg-background text-muted-foreground text-xs font-semibold px-3 py-1 rounded-full shadow">Ausverkauft</span>
                            </div>
                          )}
                        </div>
                        <div className="p-4">
                          {p.shop_categories && (
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{p.shop_categories.name}</p>
                          )}
                          <h3 className="font-heading text-sm font-bold text-foreground line-clamp-2 mb-1 leading-tight">{p.name}</h3>
                          {p.kurzbeschreibung && (
                            <p className="text-[11px] text-muted-foreground line-clamp-2 mb-3">{p.kurzbeschreibung}</p>
                          )}
                          <div className="flex items-center justify-between">
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-base font-bold">CHF {Number(p.preis).toFixed(2)}</span>
                              {p.vergleichspreis && <span className="text-xs text-muted-foreground line-through">{Number(p.vergleichspreis).toFixed(2)}</span>}
                            </div>
                            {inStock && (
                              <button onClick={e => handleAdd(p, e)}
                                className="rounded-lg p-2 bg-muted hover:bg-primary hover:text-primary-foreground transition-all">
                                <ShoppingCart className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    </Link>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShopPage;
