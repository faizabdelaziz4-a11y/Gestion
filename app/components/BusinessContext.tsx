"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { api, getActiveBusinessId, setActiveBusinessId } from "./api";

export interface Business {
  id: number;
  name: string;
  opening_time: string;
  closing_time: string;
  region: string;
  diesel_consumption: number;
  default_diesel_price: number;
  employer_onss_rate: number;
  onss_worker_rate: number;
  onss_student_rate: number;
  diesel_product: string;
  diesel_source_url: string;
  ingest_token: string;
}

interface Ctx {
  businesses: Business[];
  active: Business | null;
  setActive: (id: number) => void;
  refresh: () => Promise<void>;
  ready: boolean;
}

const BusinessCtx = createContext<Ctx>({
  businesses: [],
  active: null,
  setActive: () => {},
  refresh: async () => {},
  ready: false,
});

export function useBusiness() {
  return useContext(BusinessCtx);
}

export function BusinessProvider({ children }: { children: React.ReactNode }) {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const r = await api<{ businesses: Business[] }>("/api/businesses");
    setBusinesses(r.businesses);
    // Choix de l'actif : sessionStorage de l'onglet, sinon le premier.
    const stored = getActiveBusinessId();
    const storedId = stored ? Number(stored) : null;
    const valid = r.businesses.find((b) => b.id === storedId);
    const chosen = valid ?? r.businesses[0];
    if (chosen) {
      setActiveId(chosen.id);
      setActiveBusinessId(chosen.id);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setActive = useCallback((id: number) => {
    setActiveBusinessId(id);
    setActiveId(id);
  }, []);

  const active = businesses.find((b) => b.id === activeId) ?? null;

  return (
    <BusinessCtx.Provider value={{ businesses, active, setActive, refresh, ready }}>
      {children}
    </BusinessCtx.Provider>
  );
}
