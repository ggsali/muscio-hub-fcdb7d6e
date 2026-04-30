import { Link } from "react-router-dom";
import { Sparkles, ArrowRight } from "lucide-react";

export const ShopPromoBanner = () => (
  <div className="bg-foreground text-background text-center text-xs py-2 px-4">
    <Link to="/shop" className="inline-flex items-center gap-2 hover:text-primary transition-colors">
      <Sparkles className="w-3.5 h-3.5 text-primary" />
      <span>Neue Produkte im Shop entdecken</span>
      <ArrowRight className="w-3 h-3" />
    </Link>
  </div>
);
