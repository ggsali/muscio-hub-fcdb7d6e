import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { ScrollReveal } from "@/components/site/ScrollReveal";
import { ShoppingCart, Search, Package, Star, X, Loader2, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

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
  tags: string[] | null;
  shop_product_images: { storage_path: string; is_primary: boolean; sort_order: number }[];
  shop_categories: { name: string; slug: string } | null;
}

interface Category { id: string; name: string; slug: string; }

const getImageUrl = (path: string) =>
  supabase.storage.from("shop-products").getPublicUrl(path).data.publicUrl;

export default function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { addItem } = useCart();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(searchParams.get("kategorie") || "alle");
  const [sortBy, setSortBy] = useState("featured");
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.from("shop_categories").select("*").eq("aktiv", true).order("sort_order")
      .then(({ data }) => setCategories([{ id: "all", name: "Alle", slug: "alle" }, ...(data || [])]));
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      let query = supabase
        .from("shop_products")
        .select("*, shop_product_images(*), shop_categories(name, slug)")
        .eq("aktiv", true);
      if (activeCategory && activeCategory !== "alle") {
        const cat = categories.find(c => c.slug === activeCategory);
        if (cat) query = query.eq("kategorie_id", cat.id);
      }
      const { data } = await query.order("sort_order");
      setProducts((data || []).map((p: any) => ({
        ...p,
        shop_product_images: [...(p.shop_product_images || [])].sort(
          (a: any, b: any) => (a.is_primary ? -1 : 1) || a.sort_order - b.sort_order
        ),
      })) as Product[]);
      setLoading(false);
    };
    if (categories.length > 0) load();
  }, [activeCategory, categories]);

  const filtered = products
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.kurzbeschreibung || "").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "preis-asc") return a.preis - b.preis;
      if (sortBy === "preis-desc") return b.preis - a.preis;
      if (sortBy === "featured") return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
      return 0;
    });

  const featured = filtered.filter(p => p.featured);

  const handleCategoryChange = (slug: string) => {
    setActiveCategory(slug);
    setSearchParams(slug !== "alle" ? { kategorie: slug } : {});
  };

  const handleAddToCart = (p: Product, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const img = p.shop_product_images[0];
    addItem({
      productId: p.id, name: p.name, preis: p.preis, quantity: 1,
      image: img ? getImageUrl(img.storage_path) : undefined, slug: p.slug,
    });
    setAddedIds(prev => new Set([...prev, p.id]));
    setTimeout(() => setAddedIds(prev => { const n = new Set(prev); n.delete(p.id); return n; }), 1500);
    toast({ title: "In den Warenkorb", description: p.name });
  };

  return (
    <div className="pt-12 pb-20 min-h-screen">
      <Helmet>
        <title>Shop – Handgefertigte 3D-Druck Produkte | 3DMuscio</title>
        <meta name="description" content="Einzigartige 3D-Druck-Produkte aus der Schweiz. Präzise gefertigt, langlebig, fair kalkuliert. Jetzt im 3DMuscio Shop entdecken." />
        <meta property="og:title" content="Shop – Handgefertigte 3D-Druck Produkte | 3DMuscio" />
        <meta property="og:description" content="Einzigartige 3D-Druck-Produkte aus der Schweiz – jetzt im Shop entdecken." />
        <meta property="og:url" content="https://3dmuscio.com/shop" />
      </Helmet>
      <div className="container mx-auto px-4 max-w-7xl">
        <ScrollReveal>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-foreground via-foreground/95 to-foreground/80 text-background p-10 md:p-16 mb-12">
            <div className="relative z-10 max-w-xl">
              <p className="text-xs font-bold text-primary uppercase tracking-[0.25em] mb-3 flex items-center gap-2">
                <span className="w-4 h-px bg-primary" />3D-Druck Shop
              </p>
              <h1 className="font-heading text-4xl md:text-6xl font-extrabold tracking-tight mb-4 text-background">
                Handgefertigte<br /><span className="text-primary">3D-Produkte</span>
              </h1>
              <p className="text-background/60 text-base md:text-lg max-w-sm">
                Einzigartige Teile aus dem 3D-Drucker. Präzise, langlebig, direkt aus der Schweiz.
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
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            aria-label="Produkte sortieren"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground">
            <option value="featured">Empfohlen</option>
            <option value="preis-asc">Preis aufsteigend</option>
            <option value="preis-desc">Preis absteigend</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map(cat => (
            <button key={cat.slug} onClick={() => handleCategoryChange(cat.slug)}
              className={cn("px-4 py-2 rounded-full text-xs font-semibold transition-all border",
                activeCategory === cat.slug
                  ? "bg-foreground text-background border-foreground shadow-lg"
                  : "bg-card text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
              )}>
              {cat.name}
            </button>
          ))}
        </div>

        {activeCategory === "alle" && !search && featured.length > 0 && (
          <ScrollReveal>
            <div className="mb-12">
              <h2 className="text-xs font-bold text-primary uppercase tracking-widest mb-5 flex items-center gap-2">
                <Star className="w-3 h-3" /> Empfohlen
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {featured.slice(0, 2).map((p, i) => {
                  const img = p.shop_product_images[0];
                  const inStock = p.unendlich_bestand || p.lagerbestand > 0;
                  const disc = p.vergleichspreis ? Math.round((1 - p.preis / p.vergleichspreis) * 100) : null;
                  return (
                    <Link key={p.id} to={`/shop/${p.slug}`}>
                      <motion.div className="group relative overflow-hidden rounded-2xl border border-border hover:border-primary/40 bg-card transition-all"
                        whileHover={{ y: -4 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                        <div className="aspect-[4/3] overflow-hidden bg-muted">
                          <img src={img ? getImageUrl(img.storage_path) : "/placeholder.svg"} alt={p.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                        </div>
                        <div className="absolute top-3 left-3 flex gap-2">
                          <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-1 rounded">FEATURED</span>
                          {disc && <span className="bg-secondary text-secondary-foreground text-[10px] font-bold px-2 py-1 rounded">-{disc}%</span>}
                        </div>
                        <div className="p-5 flex items-end justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">{p.shop_categories?.name}</p>
                            <h3 className="font-heading text-lg font-bold text-foreground">{p.name}</h3>
                            {p.kurzbeschreibung && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{p.kurzbeschreibung}</p>}
                            <div className="flex items-baseline gap-2 mt-2">
                              <span className="text-xl font-bold text-primary">CHF {p.preis.toFixed(2)}</span>
                              {p.vergleichspreis && <span className="text-sm text-muted-foreground line-through">CHF {p.vergleichspreis.toFixed(2)}</span>}
                            </div>
                          </div>
                          {inStock && (
                            <button onClick={e => handleAddToCart(p, e)}
                              aria-label={`${p.name} in den Warenkorb`}
                              className="flex-shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl p-3 transition-all shadow-lg">
                              <ShoppingCart className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </motion.div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </ScrollReveal>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <ShoppingBag className="w-12 h-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">Keine Produkte gefunden.</p>
          </div>
        ) : (
          <>
            <h2 className="text-xs font-bold text-primary uppercase tracking-widest mb-5 flex items-center gap-2">
              <Package className="w-3 h-3" /> Alle Produkte
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
              <AnimatePresence>
                {filtered.map((p, i) => {
                  const img = p.shop_product_images[0];
                  const inStock = p.unendlich_bestand || p.lagerbestand > 0;
                  const disc = p.vergleichspreis ? Math.round((1 - p.preis / p.vergleichspreis) * 100) : null;
                  const wasAdded = addedIds.has(p.id);
                  return (
                    <motion.div key={p.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: i * 0.04 }}>
                      <Link to={`/shop/${p.slug}`} className="block group">
                        <motion.div className="bg-card rounded-2xl border border-border hover:border-primary/30 overflow-hidden transition-all" whileHover={{ y: -4 }}>
                          <div className="relative aspect-square bg-muted overflow-hidden">
                            <img src={img ? getImageUrl(img.storage_path) : "/placeholder.svg"} alt={p.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            {disc && <div className="absolute top-2 left-2 bg-secondary text-secondary-foreground text-[10px] font-bold px-2 py-0.5 rounded">-{disc}%</div>}
                            {p.featured && <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded">★</div>}
                            {!inStock && (
                              <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] flex items-center justify-center">
                                <span className="bg-background text-muted-foreground text-xs font-semibold px-3 py-1 rounded-full shadow">Ausverkauft</span>
                              </div>
                            )}
                          </div>
                          <div className="p-4">
                            {p.shop_categories && <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{p.shop_categories.name}</p>}
                            <h3 className="font-heading text-sm font-bold text-foreground line-clamp-2 mb-1 leading-tight">{p.name}</h3>
                            {p.kurzbeschreibung && <p className="text-[11px] text-muted-foreground line-clamp-2 mb-3 leading-relaxed">{p.kurzbeschreibung}</p>}
                            <div className="flex items-center justify-between">
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-base font-bold text-foreground">CHF {p.preis.toFixed(2)}</span>
                                {p.vergleichspreis && <span className="text-xs text-muted-foreground line-through">{p.vergleichspreis.toFixed(2)}</span>}
                              </div>
                              {inStock && (
                                <button onClick={e => handleAddToCart(p, e)}
                                  aria-label={`${p.name} in den Warenkorb`}
                                  className={cn("rounded-lg p-2 transition-all",
                                    wasAdded ? "bg-primary/10 text-primary" : "bg-muted hover:bg-primary hover:text-primary-foreground")}>
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
          </>
        )}
      </div>
    </div>
  );
}
