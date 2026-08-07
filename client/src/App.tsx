import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AppLayout } from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Counterparties from "./pages/Counterparties";
import CounterpartyDetail from "./pages/CounterpartyDetail";
import Contracts from "./pages/Contracts";
import Specifications from "./pages/Specifications";
import Waybills from "./pages/Waybills";
import AgroTradePrototype from "./pages/AgroTradePrototype";

function Router() {
  return (
    <Switch>
      <Route path="/">
        <AgroTradePrototype initialView="dashboard" />
      </Route>
      <Route path="/dashboard">
        <AgroTradePrototype initialView="dashboard" />
      </Route>
      <Route path="/ttn">
        <AgroTradePrototype initialView="ttn" />
      </Route>
      <Route path="/waybills">
        <AgroTradePrototype initialView="ttn" />
      </Route>

      <Route path="/counterparties">
        <AppLayout>
          <Counterparties />
        </AppLayout>
      </Route>
      <Route path="/counterparties/:id">
        <AppLayout>
          <CounterpartyDetail />
        </AppLayout>
      </Route>
      <Route path="/contracts">
        <AppLayout>
          <Contracts />
        </AppLayout>
      </Route>
      <Route path="/specifications">
        <AppLayout>
          <Specifications />
        </AppLayout>
      </Route>
      <Route path="/legacy-dashboard">
        <AppLayout>
          <Dashboard />
        </AppLayout>
      </Route>
      <Route path="/legacy-waybills">
        <AppLayout>
          <Waybills />
        </AppLayout>
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
