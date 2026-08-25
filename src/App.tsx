import React, { useState } from "react";
import { AuthProvider } from "./features/auth/AuthContext";
import { AppShell, type NavTab } from "./components/AppShell";
import { CreateIssueForm } from "./features/issues/CreateIssueForm";
import { IssueList } from "./features/issues/IssueList";
import { IssueDetailView } from "./features/issues/IssueDetailView";
import { AnalyticsView } from "./features/analytics/AnalyticsView";
import { AdminView } from "./features/admin/AdminView";

function AppContent() {
  const [currentTab, setCurrentTab] = useState<NavTab>("new");
  const [selectedIssuePublicId, setSelectedIssuePublicId] = useState<string | null>(null);

  const handleTabChange = (tab: NavTab) => {
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
          onSelectIssue={handleSelectIssue}
        />
      ) : currentTab === "new" ? (
        <CreateIssueForm
          onSuccess={(created) => {
            setSelectedIssuePublicId(created.publicId);
          }}
        />
      ) : currentTab === "list" ? (
        <IssueList
          onSelectIssue={handleSelectIssue}
          onNewIssue={() => handleTabChange("new")}
        />
      ) : currentTab === "analytics" ? (
        <AnalyticsView onSelectIssue={handleSelectIssue} />
      ) : (
        <AdminView />
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
