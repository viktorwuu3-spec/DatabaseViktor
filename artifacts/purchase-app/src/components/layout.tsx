import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ShoppingCart, LayoutDashboard, CalendarClock, Banknote, Sparkles, FileText, Tags, Truck, Package, ChevronDown, Database } from "lucide-react";
import { Button } from "./ui/button";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [masterOpen, setMasterOpen] = useState(false);

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/pembelian", label: "Data Pembelian", icon: ShoppingCart },
    { href: "/rencana", label: "Rencana Pembelian", icon: CalendarClock },
    { href: "/kas-masuk", label: "Kas Masuk", icon: Banknote },
    { href: "/invoice", label: "Invoice", icon: FileText },
  ];

  const masterItems = [
    { href: "/master/kategori", label: "Kategori", icon: Tags },
    { href: "/master/supplier", label: "Supplier", icon: Truck },
    { href: "/master/item", label: "Item", icon: Package },
  ];

  const isMasterActive = location.startsWith("/master");

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
            <div className="relative">
              <Button
                variant={isMasterActive ? "secondary" : "ghost"}
                className="gap-2"
                onClick={() => setMasterOpen(!masterOpen)}
              >
                <Database className="w-4 h-4" />
                Master Data
                <ChevronDown className={`w-3 h-3 transition-transform ${masterOpen ? "rotate-180" : ""}`} />
              </Button>
              {masterOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 rounded-md border bg-popover shadow-lg z-50">
                  {masterItems.map((item) => {
                    const isActive = location === item.href;
                    const Icon = item.icon;
                    return (
                      <Link key={item.href} href={item.href}>
                        <button
                          onClick={() => setMasterOpen(false)}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent ${isActive ? "bg-accent font-medium" : ""}`}
                        >
                          <Icon className="w-4 h-4" />
                          {item.label}
                        </button>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
            <Link href="/ai" asChild>
              <Button
                variant={location === "/ai" ? "secondary" : "ghost"}
                className="gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Asisten AI
              </Button>
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 p-6 container mx-auto max-w-7xl">
        {children}
      </main>
    </div>
  );
}
