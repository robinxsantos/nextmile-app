import { lazy, Suspense, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { Toaster } from "sonner";
import AppLayout from "./components/layout/AppLayout";
import PageSkeleton from "./components/shared/PageSkeleton";
import { useAuthStore } from "./store/useAuthStore";

// Lazy load all pages for code splitting
const LoginPage = lazy(() => import("./pages/LoginPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const TripsPage = lazy(() => import("./pages/TripsPage"));
const ExpensesPage = lazy(() => import("./pages/ExpensesPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const TrucksPage = lazy(() => import("./pages/TrucksPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const PaymentsPage = lazy(() => import("./pages/PaymentsPage"));
const CollectionsPage = lazy(() => import("./pages/CollectionsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

/** Redirect to /login if not authenticated */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token, initialized } = useAuthStore();
  const location = useLocation();

  if (!initialized) return <PageSkeleton />;
  if (!token)
    return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

/** Redirect to / if already authenticated */
function RedirectIfAuth({ children }: { children: React.ReactNode }) {
  const { token, initialized } = useAuthStore();

  if (!initialized) return <PageSkeleton />;
  if (token) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Admin and Manager can access */
function RequireManagerOrAdmin({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();

  if (user?.role !== "admin" && user?.role !== "manager") {
    return <Navigate to="/trips" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const { checkAuth, initialized } = useAuthStore();

  useEffect(() => {
    if (!initialized) {
      checkAuth();
    }
  }, [checkAuth, initialized]);

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        expand={false}
        richColors
        closeButton
        toastOptions={{
          classNames: {
            toast: "glass-card border-slate-200/90 dark:border-slate-700/90",
            title: "text-slate-900 dark:text-slate-100",
            description: "text-slate-600 dark:text-slate-400",
          },
        }}
      />
      <Routes>
        {/* Public: Login */}
        <Route
          path="/login"
          element={
            <RedirectIfAuth>
              <Suspense fallback={<PageSkeleton />}>
                <LoginPage />
              </Suspense>
            </RedirectIfAuth>
          }
        />

        {/* Protected: App */}
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route
            path="/"
            element={
              <RequireManagerOrAdmin>
                <Suspense fallback={<PageSkeleton />}>
                  <DashboardPage />
                </Suspense>
              </RequireManagerOrAdmin>
            }
          />
          <Route
            path="/trips"
            element={
              <Suspense fallback={<PageSkeleton />}>
                <TripsPage />
              </Suspense>
            }
          />
          <Route
            path="/expenses"
            element={
              <RequireManagerOrAdmin>
                <Suspense fallback={<PageSkeleton />}>
                  <ExpensesPage />
                </Suspense>
              </RequireManagerOrAdmin>
            }
          />
          <Route
            path="/reports"
            element={
              <RequireManagerOrAdmin>
                <Suspense fallback={<PageSkeleton />}>
                  <ReportsPage />
                </Suspense>
              </RequireManagerOrAdmin>
            }
          />
          <Route
            path="/trucks"
            element={
              <RequireManagerOrAdmin>
                <Suspense fallback={<PageSkeleton />}>
                  <TrucksPage />
                </Suspense>
              </RequireManagerOrAdmin>
            }
          />
          <Route
            path="/users"
            element={
              <RequireManagerOrAdmin>
                <Suspense fallback={<PageSkeleton />}>
                  <UsersPage />
                </Suspense>
              </RequireManagerOrAdmin>
            }
          />
          <Route
            path="/payments"
            element={
              <RequireManagerOrAdmin>
                <Suspense fallback={<PageSkeleton />}>
                  <PaymentsPage />
                </Suspense>
              </RequireManagerOrAdmin>
            }
          />
          <Route
            path="/collections"
            element={
              <RequireManagerOrAdmin>
                <Suspense fallback={<PageSkeleton />}>
                  <CollectionsPage />
                </Suspense>
              </RequireManagerOrAdmin>
            }
          />
          <Route
            path="/settings"
            element={
              <Suspense fallback={<PageSkeleton />}>
                <SettingsPage />
              </Suspense>
            }
          />
        </Route>

        {/* Catch-all: redirect to login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
