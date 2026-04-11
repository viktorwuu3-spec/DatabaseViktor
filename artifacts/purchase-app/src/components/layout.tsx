import { Link, useLocation } from "wouter";
import { ShoppingCart, LayoutDashboard, CalendarClock, Banknote, Sparkles, FileText } from "lucide-react";
import { Button } from "./ui/button";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/pembelian", label: "Data Pembelian", icon: ShoppingCart },
    { href: "/rencana", label: "Rencana Pembelian", icon: CalendarClock },
    { href: "/kas-masuk", label: "Kas Masuk", icon: Banknote },
    { href: "/invoice", label: "Invoice", icon: FileText },
    { href: "/ai", label: "Asisten AI", icon: Sparkles },
  ];

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 print-hide">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-lg">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
              <ShoppingCart className="w-5 h-5" />
            </div>
            Manajemen Pembelian
          </div>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location === item.href;
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} asChild>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className="gap-2"
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="flex-1 p-6 container mx-auto max-w-7xl">
        {children}
      </main>
    </div>
  );
}
