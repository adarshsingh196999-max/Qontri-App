import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, QueryCache } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ApiError } from "@workspace/api-client-react";
import { initAuth } from "@/lib/auth";

import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Analytics from "@/pages/analytics";
import Users from "@/pages/users";
import Performance from "@/pages/performance";
import AuditLogs from "@/pages/audit-logs";
import Trips from "@/pages/trips";
import Expenses from "@/pages/expenses";

const TOKEN_KEY = "qontri_admin_token";

// Initialize auth interceptor
initAuth();

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        window.location.href = import.meta.env.BASE_URL.replace(/\/$/, "") + "/login";
      }
    }
  }),
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status === 401) return false;
        return failureCount < 2;
      }
    }
  }
});

// Navigate once on mount — empty deps is intentional to avoid redirect loops.
function Redirect({ to }: { to: string }) {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate(to);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  // Read directly from localStorage so this instance is always current,
  // regardless of which useAuth() call last called setToken.
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return <Redirect to="/login" />;
  return <Component />;
}

function Router() {
  // Read token directly from localStorage — no React state, no stale-closure risk.
  const token = localStorage.getItem(TOKEN_KEY);

  return (
    <Switch>
      <Route path="/login">
        {token ? <Redirect to="/analytics" /> : <Login />}
      </Route>
      <Route path="/analytics">
        <ProtectedRoute component={Analytics} />
      </Route>
      <Route path="/users">
        <ProtectedRoute component={Users} />
      </Route>
      <Route path="/performance">
        <ProtectedRoute component={Performance} />
      </Route>
      <Route path="/audit-logs">
        <ProtectedRoute component={AuditLogs} />
      </Route>
      <Route path="/trips">
        <ProtectedRoute component={Trips} />
      </Route>
      <Route path="/expenses">
        <ProtectedRoute component={Expenses} />
      </Route>
      <Route path="/">
        <Redirect to={token ? "/analytics" : "/login"} />
      </Route>
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
