import React, { useState } from "react";
import { AuthProvider } from "./features/auth/AuthContext";
import { AppShell } from "./components/AppShell";
import { CreateIssueForm } from "./features/issues/CreateIssueForm";
import { IssueList } from "./features/issues/IssueList";
import { IssueDetailView } from "./features/issues/IssueDetailView";

function AppContent() {
  const [currentTab, setCurrentTab] = useState<"new" | "list">("new");
  const [selectedIssuePublicId, setSelectedIssuePublicId] = useState<string | null>(null);

  const handleTabChange = (tab: "new" | "list") => {
    setCurrentTab(tab);
    setSelectedIssuePublicId(null);
  };

  const handleSelectIssue = (publicId: string) => {
    setSelectedIssuePublicId(publicId);
  };

  const handleBackToList = () => {
    setSelectedIssuePublicId(null);
    setCurrentTab("list");
  };

  return (
    <AppShell currentTab={currentTab} onTabChange={handleTabChange}>
      {selectedIssuePublicId ? (
        <IssueDetailView
          publicId={selectedIssuePublicId}
          onBack={handleBackToList}
        />
      ) : currentTab === "new" ? (
        <CreateIssueForm
          onSuccess={(created) => {
            // Permet d'accéder au dossier ou de rester sur la confirmation
          }}
        />
      ) : (
        <IssueList
          onSelectIssue={handleSelectIssue}
          onNewIssue={() => handleTabChange("new")}
        />
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
