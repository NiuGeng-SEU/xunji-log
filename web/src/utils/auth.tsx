import React, { createContext, useContext, useEffect, useState } from "react";
import { CyclePlan } from "./cycleTypes";

interface AuthContextType {
  isAdmin: boolean;
  githubToken: string | null;
  plan: CyclePlan | null;
  loadingPlan: boolean;
  updatePlan: (newPlan: CyclePlan) => void;
  login: (secret: string) => boolean;
  logout: () => void;
  savePlan: (plan: CyclePlan) => Promise<{ ok: boolean; message: string }>;
  exportPlanJson: (plan: CyclePlan) => void;
}

const STORAGE_ADMIN_KEY = "workout_admin_authenticated";
const STORAGE_GH_TOKEN = "workout_github_pat";
const STORAGE_PLAN_OVERRIDE = "workout_cycle_plan_override";
const DEFAULT_PASSWORDS = ["ben2026", "workout", "admin888"];

const AuthContext = createContext<AuthContextType>({
  isAdmin: false,
  githubToken: null,
  plan: null,
  loadingPlan: true,
  updatePlan: () => {},
  login: () => false,
  logout: () => {},
  savePlan: async () => ({ ok: false, message: "" }),
  exportPlanJson: () => {},
});

function sanitizePlan(p: CyclePlan): CyclePlan {
  if (!p || !p.schedule) return p;
  const cleanedSchedule = { ...p.schedule };
  for (const [date, day] of Object.entries(cleanedSchedule)) {
    if (day && day.title) {
      cleanedSchedule[date] = {
        ...day,
        title: day.title.replace(/^\s*\[[^\]]*\]\s*/, ""),
      };
    }
  }
  return {
    ...p,
    schedule: cleanedSchedule,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_ADMIN_KEY) === "true";
  });
  const [githubToken, setGithubToken] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_GH_TOKEN);
  });

  const [plan, setPlan] = useState<CyclePlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<boolean>(true);

  // Load authoritative plan from API / file first, falling back to cache
  useEffect(() => {
    async function load() {
      // 1. Try local server API (authoritative)
      try {
        const apiResp = await fetch(`/api/cycle-plan?_t=${Date.now()}`);
        if (apiResp.ok) {
          const json = await apiResp.json();
          const clean = sanitizePlan(json);
          setPlan(clean);
          localStorage.setItem(STORAGE_PLAN_OVERRIDE, JSON.stringify(clean));
          setLoadingPlan(false);
          return;
        }
      } catch {
        // Fallback to static JSON
      }

      // 2. Try static ./data/cycle_plan.json
      try {
        const resp = await fetch(`./data/cycle_plan.json?_t=${Date.now()}`);
        if (resp.ok) {
          const json = await resp.json();
          const clean = sanitizePlan(json);
          setPlan(clean);
          localStorage.setItem(STORAGE_PLAN_OVERRIDE, JSON.stringify(clean));
          setLoadingPlan(false);
          return;
        }
      } catch (err) {
        console.warn("Failed to load ./data/cycle_plan.json", err);
      }

      // 3. Fallback to localStorage if offline / static fetch fails
      const cached = localStorage.getItem(STORAGE_PLAN_OVERRIDE);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const clean = sanitizePlan(parsed);
          setPlan(clean);
          localStorage.setItem(STORAGE_PLAN_OVERRIDE, JSON.stringify(clean));
          setLoadingPlan(false);
          return;
        } catch (e) {
          console.warn("Failed to parse cached cycle plan", e);
        }
      }

      setLoadingPlan(false);
    }
    load();
  }, []);

  const updatePlan = (newPlan: CyclePlan) => {
    const clean = sanitizePlan(newPlan);
    setPlan(clean);
    localStorage.setItem(STORAGE_PLAN_OVERRIDE, JSON.stringify(clean));
  };

  const login = (secret: string): boolean => {
    const trimmed = secret.trim();
    if (!trimmed) return false;

    // If it looks like a GitHub Personal Access Token
    if (trimmed.startsWith("ghp_") || trimmed.startsWith("github_pat_")) {
      localStorage.setItem(STORAGE_GH_TOKEN, trimmed);
      localStorage.setItem(STORAGE_ADMIN_KEY, "true");
      setGithubToken(trimmed);
      setIsAdmin(true);
      return true;
    }

    // Check passphrases
    const customPassword = localStorage.getItem("workout_custom_admin_pwd");
    if (DEFAULT_PASSWORDS.includes(trimmed.toLowerCase()) || (customPassword && trimmed === customPassword)) {
      localStorage.setItem(STORAGE_ADMIN_KEY, "true");
      setIsAdmin(true);
      return true;
    }

    return false;
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_ADMIN_KEY);
    localStorage.removeItem(STORAGE_GH_TOKEN);
    setIsAdmin(false);
    setGithubToken(null);
  };

  const exportPlanJson = (p: CyclePlan) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(p, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `cycle_plan_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const savePlan = async (p: CyclePlan): Promise<{ ok: boolean; message: string }> => {
    const clean = sanitizePlan(p);
    updatePlan(clean);

    // 1. Try local server backend API (saves directly to data/cycle_plan.json on disk)
    try {
      const resp = await fetch("/api/cycle-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clean),
      });
      if (resp.ok) {
        return { ok: true, message: "Saved to local server & disk successfully!" };
      }
    } catch (e) {
      console.warn("Backend API save failed, attempting GitHub or local cache", e);
    }

    // If GitHub PAT is present, commit directly to GitHub repository (works on GitHub Pages!)
    if (githubToken) {
      try {
        const repo = "NiuGeng-SEU/xunji-log";
        const path = "data/cycle_plan.json";
        const getUrl = `https://api.github.com/repos/${repo}/contents/${path}`;

        const getResp = await fetch(getUrl, {
          headers: { Authorization: `token ${githubToken}` },
        });

        let sha: string | undefined;
        if (getResp.ok) {
          const fileData = await getResp.json();
          sha = fileData.sha;
        }

        const contentBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(p, null, 2))));
        const putResp = await fetch(getUrl, {
          method: "PUT",
          headers: {
            Authorization: `token ${githubToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: `chore(cycle): update training cycle and body composition (${new Date().toISOString().slice(0, 10)})`,
            content: contentBase64,
            sha,
          }),
        });

        if (putResp.ok) {
          return { ok: true, message: "Committed to GitHub successfully! GitHub Pages will auto-update." };
        } else {
          const errData = await putResp.json();
          return { ok: false, message: `GitHub commit failed: ${errData.message || "Unknown error"}` };
        }
      } catch (e) {
        return { ok: false, message: `GitHub sync error: ${e instanceof Error ? e.message : String(e)}` };
      }
    }

    return {
      ok: true,
      message: "Saved to browser memory! (Add GitHub Token in settings to automatically sync to cloud)",
    };
  };

  return (
    <AuthContext.Provider
      value={{
        isAdmin,
        githubToken,
        plan,
        loadingPlan,
        updatePlan,
        login,
        logout,
        savePlan,
        exportPlanJson,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
