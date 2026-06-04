import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AppLayout } from "./components/AppLayout";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Counterparties from "./pages/Counterparties";
import CounterpartyDetail from "./pages/CounterpartyDetail";
import Contracts from "./pages/Contracts";
import Specifications from "./pages/Specifications";
import Waybills from "./pages/Waybills";

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/counterparties" component={Counterparties} />
        <Route path="/counterparties/:id" component={CounterpartyDetail} />
        <Route path="/contracts" component={Contracts} />
        <Route path="/specifications" component={Specifications} />
        <Route path="/waybills" component={Waybills} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
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
