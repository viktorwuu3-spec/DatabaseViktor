import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Purchases from "@/pages/purchases";
import PurchasePlans from "@/pages/purchase-plans";
import KasMasuk from "@/pages/kas-masuk";
import AiAssistant from "@/pages/ai-assistant";
import InvoicePage from "@/pages/invoice";
import MasterKategori from "@/pages/master-kategori";
import MasterSupplier from "@/pages/master-supplier";
import MasterItem from "@/pages/master-item";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/pembelian" component={Purchases} />
      <Route path="/rencana" component={PurchasePlans} />
      <Route path="/kas-masuk" component={KasMasuk} />
      <Route path="/invoice" component={InvoicePage} />
      <Route path="/master/kategori" component={MasterKategori} />
      <Route path="/master/supplier" component={MasterSupplier} />
      <Route path="/master/item" component={MasterItem} />
      <Route path="/ai" component={AiAssistant} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
