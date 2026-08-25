import React from "react";
import { Link } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { PATHS } from "../../routes/paths";
import { businessToday } from "../../shared/businessDate";

const cards = [
  { key: "urgent", icon: "🔴", title: "Urgents", description: "Voir les dossiers qui demandent une intervention prioritaire." },
  { key: "waiting", icon: "⏳", title: "En attente", description: "Reprendre les dossiers bloqués par une attente." },
  { key: "reviews", icon: "🎯", title: "Révisions dues", description: "Valider l'efficacité des corrections arrivées à échéance." },
] as const;

type HomeCardKey = "mine" | "urgent" | "waiting" | "reviews";

export function HomeView() {
  const { user, meta } = useAuth();
  const today = businessToday(meta?.config.businessTimeZone ?? "America/Toronto");

  const hrefFor = (key: HomeCardKey) => {
    if (key === "mine") return `${PATHS.registry}?ownerUserId=${user?.id ?? ""}`;
    if (key === "urgent") return `${PATHS.registry}?priority=urgent`;
    if (key === "waiting") return `${PATHS.registry}?status=waiting`;
    return `${PATHS.analytics}?vue=reviews&effectivenessReviewDueBefore=${today}`;
  };

  return (
    <div data-testid="home-view">
      <div style={{ marginBottom: "1rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.45rem", color: "var(--color-primary)" }}>
          Bonjour {user?.displayName}
        </h1>
        <p style={{ margin: "0.35rem 0 0", color: "var(--color-text-muted)" }}>
          Accédez rapidement aux dossiers qui nécessitent votre attention.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.85rem" }}>
        <Link to={hrefFor("mine")} className="card" style={{ textDecoration: "none", color: "inherit", margin: 0 }} data-testid="home-my-issues">
          <div style={{ fontSize: "1.75rem" }}>👤</div>
          <h2 style={{ fontSize: "1rem", margin: "0.5rem 0 0.25rem" }}>Mes dossiers</h2>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-text-muted)" }}>Voir les dossiers dont vous êtes responsable.</p>
        </Link>
        {cards.map((card) => (
          <Link key={card.key} to={hrefFor(card.key)} className="card" style={{ textDecoration: "none", color: "inherit", margin: 0 }} data-testid={`home-${card.key}`}>
            <div style={{ fontSize: "1.75rem" }}>{card.icon}</div>
            <h2 style={{ fontSize: "1rem", margin: "0.5rem 0 0.25rem" }}>{card.title}</h2>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-text-muted)" }}>{card.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
