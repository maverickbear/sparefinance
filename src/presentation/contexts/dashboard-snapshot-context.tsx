"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { DashboardWidgetsData } from "@/src/domain/dashboard/types";

const STORAGE_KEY_PREFIX = "dashboard";
const STORAGE_VIEW_EVERYONE = "everyone";

/** View key for storage: "everyone" or member id. Same cache + version flow for all views. */
function getViewKey(memberId: string | null): string {
  return memberId ?? STORAGE_VIEW_EVERYONE;
}

function loadStoredSnapshot(viewKey: string): {
  data: DashboardWidgetsData | null;
  version: string | null;
  dateKey: string | null;
} {
  if (typeof window === "undefined") return { data: null, version: null, dateKey: null };
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}-snapshot-${viewKey}`);
    const version = localStorage.getItem(`${STORAGE_KEY_PREFIX}-version-${viewKey}`);
    const dateKey = localStorage.getItem(`${STORAGE_KEY_PREFIX}-date-${viewKey}`);
    if (!raw || !version || !dateKey) return { data: null, version: null, dateKey: null };
    const data = JSON.parse(raw) as DashboardWidgetsData;
    return { data, version, dateKey };
  } catch {
    return { data: null, version: null, dateKey: null };
  }
}

function saveSnapshot(
  data: DashboardWidgetsData,
  version: string,
  dateKey: string,
  viewKey: string
) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}-snapshot-${viewKey}`, JSON.stringify(data));
    localStorage.setItem(`${STORAGE_KEY_PREFIX}-version-${viewKey}`, version);
    localStorage.setItem(`${STORAGE_KEY_PREFIX}-date-${viewKey}`, dateKey);
  } catch (e) {
    console.warn("[Dashboard] Failed to persist snapshot:", e);
  }
}

function clearStoredVersion(viewKey?: string) {
  if (typeof window === "undefined") return;
  try {
    if (viewKey) {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}-version-${viewKey}`);
    } else {
      [STORAGE_VIEW_EVERYONE, ...getStoredViewKeys()].forEach((key) =>
        localStorage.removeItem(`${STORAGE_KEY_PREFIX}-version-${key}`)
      );
    }
  } catch {}
}

function getStoredViewKeys(): string[] {
  if (typeof window === "undefined") return [];
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(`${STORAGE_KEY_PREFIX}-snapshot-`) && k.length > `${STORAGE_KEY_PREFIX}-snapshot-`.length)
      keys.push(k.replace(`${STORAGE_KEY_PREFIX}-snapshot-`, ""));
  }
  return keys;
}

interface DashboardSnapshotContextValue {
  data: DashboardWidgetsData | null;
  version: string | null;
  loading: boolean;
  error: string | null;
  /** Selected household member id; null = "Everyone". When set, dashboard shows that member's data only. */
  selectedMemberId: string | null;
  setSelectedMemberId: (memberId: string | null) => void;
  /** Force version check; if version changed (or force is true), refetch dashboard and update snapshot. */
  refresh: (force?: boolean) => Promise<void>;
  /** Mark local snapshot as stale (e.g. after Realtime event). Next version check will refetch. */
  markStale: () => void;
}

const DashboardSnapshotContext = createContext<DashboardSnapshotContextValue | null>(null);

export function useDashboardSnapshot() {
  const ctx = useContext(DashboardSnapshotContext);
  if (!ctx) {
    throw new Error("useDashboardSnapshot must be used within DashboardSnapshotProvider");
  }
  return ctx;
}

interface DashboardSnapshotProviderProps {
  children: ReactNode;
  /** Date used for dashboard range (e.g. selected month). */
  selectedDate?: Date;
}

export function DashboardSnapshotProvider({ children, selectedDate }: DashboardSnapshotProviderProps) {
  const date = selectedDate ?? new Date();
  const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

  const [data, setData] = useState<DashboardWidgetsData | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const initialLoadDone = useRef(false);
  const versionCheckInProgress = useRef(false);

  const fetchDashboard = useCallback(
    async (memberId: string | null) => {
      const params = new URLSearchParams({ date: date.toISOString() });
      if (memberId) params.set("memberId", memberId);
      const res = await fetch(`/api/dashboard?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Dashboard fetch failed: ${res.statusText}`);
      return res.json() as Promise<DashboardWidgetsData>;
    },
    [date]
  );

  const checkVersionAndRefetchIfNeeded = useCallback(
    async (viewKey: string, forceRefetch = false) => {
      if (versionCheckInProgress.current && !forceRefetch) return;
      versionCheckInProgress.current = true;
      try {
        const versionRes = await fetch("/api/dashboard/version", { cache: "no-store" });
        if (!versionRes.ok) return;
        const { version: currentVersion } = (await versionRes.json()) as { version: string };
        const stored = loadStoredSnapshot(viewKey);
        const storedVersion = forceRefetch ? null : version ?? stored.version;
        const isInitialLoad = !initialLoadDone.current;
        if (
          !isInitialLoad &&
          storedVersion !== null &&
          storedVersion === currentVersion &&
          stored.dateKey === dateKey &&
          !forceRefetch
        ) {
          return;
        }
        const memberIdForFetch = viewKey === STORAGE_VIEW_EVERYONE ? null : viewKey;
        const payload = await fetchDashboard(memberIdForFetch);
        setData(payload);
        setVersion(currentVersion);
        saveSnapshot(payload, currentVersion, dateKey, viewKey);
        setError(null);
      } catch (err) {
        if (initialLoadDone.current) {
          setError(err instanceof Error ? err.message : "Failed to update dashboard");
        } else {
          setError(err instanceof Error ? err.message : "Failed to load dashboard");
        }
      } finally {
        versionCheckInProgress.current = false;
      }
    },
    [dateKey, version, fetchDashboard]
  );

  /** Version check; refetch when server version differs or when force is true (e.g. user clicked Refresh). */
  const refresh = useCallback(async (force = false) => {
    setError(null);
    const viewKey = getViewKey(selectedMemberId);
    await checkVersionAndRefetchIfNeeded(viewKey, force);
  }, [checkVersionAndRefetchIfNeeded, selectedMemberId]);

  const markStale = useCallback(() => {
    clearStoredVersion();
    setVersion(null);
    // Trigger immediate refetch so the dashboard updates without waiting for the next poll
    const viewKey = getViewKey(selectedMemberId);
    void checkVersionAndRefetchIfNeeded(viewKey, true);
  }, [selectedMemberId, checkVersionAndRefetchIfNeeded]);

  useEffect(() => {
    const viewKey = getViewKey(selectedMemberId);
    const stored = loadStoredSnapshot(viewKey);

    const hasValidShape =
      stored.data?.accountStats == null ||
      (stored.data.accountStats as { totalAvailable?: number }).totalAvailable !== undefined;
    const useStored =
      stored.data != null &&
      stored.version != null &&
      stored.dateKey === dateKey &&
      hasValidShape;

    if (useStored) {
      setData(stored.data);
      setVersion(stored.version);
      setLoading(false);
    } else {
      setLoading(true);
    }

    checkVersionAndRefetchIfNeeded(viewKey, false).finally(() => {
      initialLoadDone.current = true;
      setLoading(false);
    });
  }, [dateKey, selectedMemberId]); // eslint-disable-line react-hooks/exhaustive-deps -- refetch when date or member changes

  const value: DashboardSnapshotContextValue = {
    data,
    version,
    loading,
    error,
    selectedMemberId,
    setSelectedMemberId,
    refresh,
    markStale,
  };

  return (
    <DashboardSnapshotContext.Provider value={value}>
      {children}
    </DashboardSnapshotContext.Provider>
  );
}
