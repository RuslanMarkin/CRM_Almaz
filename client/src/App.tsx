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
import Login from "./pages/Login";
import RecycleBin from "./pages/RecycleBin";
import { useAuth } from "./_core/hooks/useAuth";

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
      <Route path="/contracts">
        <AgroTradePrototype initialView="contracts" />
      </Route>
      <Route path="/specifications">
        <AgroTradePrototype initialView="specifications" />
      </Route>

      <Route path="/deals">
        <AgroTradePrototype initialView="deals" />
      </Route>
      <Route path="/counterparties">
        <AgroTradePrototype initialView="contractors" />
      </Route>
      <Route path="/contractors">
        <AgroTradePrototype initialView="contractors" />
      </Route>
      <Route path="/counterparties/:id">
        {(params) => (
          <AgroTradePrototype initialView="contractors" initialCounterpartyId={parseInt(params.id, 10)} />
        )}
      </Route>
      <Route path="/contractors/:id">
        {(params) => (
          <AgroTradePrototype initialView="contractors" initialCounterpartyId={parseInt(params.id, 10)} />
        )}
      </Route>
      <Route path="/legacy-counterparties">
        <AppLayout>
          <Counterparties />
        </AppLayout>
      </Route>
      <Route path="/legacy-counterparties/:id">
        <AppLayout>
          <CounterpartyDetail />
        </AppLayout>
      </Route>
      <Route path="/legacy-contracts">
        <AppLayout>
          <Contracts />
        </AppLayout>
      </Route>
      <Route path="/legacy-specifications">
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
      <Route path="/recycle-bin">
        <AppLayout>
          <RecycleBin />
        </AppLayout>
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const { isAuthenticated, loading } = useAuth();

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          {loading ? <main className="min-h-screen bg-muted/30" /> : isAuthenticated ? (
            <Router />
          ) : <Login />}
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
