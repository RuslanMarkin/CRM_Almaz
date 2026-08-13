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
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

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
  const { isAuthenticated, loading, logout } = useAuth();

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          {loading ? <main className="min-h-screen bg-muted/30" /> : isAuthenticated ? (
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="fixed right-28 top-4 z-[100] bg-background/95"
                onClick={() => { window.location.href = "/recycle-bin"; }}
              >
                Корзина
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="fixed right-4 top-4 z-[100] bg-background/95"
                onClick={() => void logout()}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Выйти
              </Button>
              <Router />
            </div>
          ) : <Login />}
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
