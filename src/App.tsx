import React from "react";
import { Navigate, Route, Routes } from "react-router";
import { AuthProvider, useAuth } from "./features/auth/AuthContext";
import { AppShell } from "./components/AppShell";
import { PATHS } from "./routes/paths";
import { CreateIssueForm } from "./features/issues/CreateIssueForm";
import { IssueList } from "./features/issues/IssueList";
import { IssueDetailView } from "./features/issues/IssueDetailView";
import { AnalyticsView } from "./features/analytics/AnalyticsView";
import { AdminView } from "./features/admin/AdminView";

/**
 * Masquer l'onglet Administration ne suffit pas : une URL se tape à la main.
 * Le Worker refuse de toute façon toute route `/admin` à un non-administrateur
 * (G-006, la permission se vérifie côté serveur) — cette garde évite seulement
 * d'afficher un écran qui ne se remplirait jamais.
 */
function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user?.role !== "admin") return <Navigate to={PATHS.registry} replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route path={PATHS.root} element={<Navigate to={PATHS.registry} replace />} />
          <Route path={PATHS.newIssue} element={<CreateIssueForm />} />
          <Route path={PATHS.registry} element={<IssueList />} />
          <Route path={PATHS.issueDetail} element={<IssueDetailView />} />
          <Route path={PATHS.analytics} element={<AnalyticsView />} />
          <Route
            path={PATHS.admin}
            element={
              <AdminOnly>
                <AdminView />
              </AdminOnly>
            }
          />
          {/* Une URL inconnue ramène au Registre plutôt que sur une page blanche. */}
          <Route path="*" element={<Navigate to={PATHS.registry} replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
