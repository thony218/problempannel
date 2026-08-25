import React, { useState } from "react";
import { AuthProvider } from "./features/auth/AuthContext";
import { AppShell } from "./components/AppShell";
import { CreateIssueForm } from "./features/issues/CreateIssueForm";

function AppContent() {
  const [currentTab, setCurrentTab] = useState<"new" | "list">("new");

  return (
    <AppShell currentTab={currentTab} onTabChange={setCurrentTab}>
      {currentTab === "new" ? (
        <CreateIssueForm onSuccess={() => {}} />
      ) : (
        <div className="card" data-testid="registry-placeholder">
          <h2 className="card-title">Registre des incidents</h2>
          <p style={{ color: "var(--color-text-muted)" }}>
            L'écran de consultation et de recherche dans le registre est accessible.
          </p>
        </div>
      )}
    </AppShell>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
