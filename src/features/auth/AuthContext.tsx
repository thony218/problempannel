import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { components } from "../../shared/api-types.generated";
import { apiFetch } from "../../shared/apiClient";

export type CurrentUser = components["schemas"]["User"];
export type MetaData = components["schemas"]["MetaResponse"]["data"];
export type MetaResponse = components["schemas"]["MetaResponse"];
export type UserResponse = components["schemas"]["UserResponse"];

export interface AuthError {
  status: number;
  message: string;
}

export interface AuthContextValue {
  user: CurrentUser | null;
  meta: MetaData | null;
  loading: boolean;
  error: AuthError | null;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [meta, setMeta] = useState<MetaData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<AuthError | null>(null);

  const fetchSessionAndMeta = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [meRes, metaRes] = await Promise.all([apiFetch("/api/me"), apiFetch("/api/meta")]);

      if (meRes.status === 401) {
        setError({
          status: 401,
          message: "Authentification requise. Veuillez vous connecter via Cloudflare Access.",
        });
        setUser(null);
        setMeta(null);
        return;
      }

      if (meRes.status === 403) {
        setError({
          status: 403,
          message: "Votre compte utilisateur est inactif ou n'a pas les droits nécessaires.",
        });
        setUser(null);
        setMeta(null);
        return;
      }

      if (!meRes.ok) {
        throw new Error(`Erreur lors de la récupération du profil utilisateur (${meRes.status}).`);
      }

      if (!metaRes.ok) {
        throw new Error(`Erreur lors de la récupération des référentiels (${metaRes.status}).`);
      }

      const meData = (await meRes.json()) as UserResponse;
      const metaData = (await metaRes.json()) as MetaResponse;

      if (!meData.ok || !metaData.ok) {
        throw new Error("Format de réponse inattendu du serveur.");
      }

      setUser(meData.data);
      setMeta(metaData.data);
    } catch (err: any) {
      setError({
        status: 0,
        message: err.message || "Impossible de contacter le serveur. Vérifiez votre connexion.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessionAndMeta();
  }, [fetchSessionAndMeta]);

  const value: AuthContextValue = {
    user,
    meta,
    loading,
    error,
    refresh: fetchSessionAndMeta,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
