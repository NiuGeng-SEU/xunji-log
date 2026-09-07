import { useCallback, useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import {
  Analysis,
  fetchAnalysis,
} from "./api";
import Overview from "./pages/Overview";
import FatLoss from "./pages/FatLoss";
import Muscle from "./pages/Muscle";
import { UnitProvider } from "./units";
import { LanguageProvider } from "./language";

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

function AppContent() {
  const [data, setData] = useState<Analysis | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const analysis = await fetchAnalysis();
      setData(analysis);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="loading">Loading workout data…</div>;
  if (error || !data) return <div className="error">{error || "No data"}</div>;

  return (
    <UnitProvider>
      <Routes>
        <Route element={<Layout />}>
        <Route index element={<Overview data={data} />} />
        <Route path="muscle" element={<Muscle data={data} />} />
        <Route path="strength" element={<Muscle data={data} />} />
        <Route path="fat-loss" element={<FatLoss data={data} />} />
        <Route path="cardio" element={<FatLoss data={data} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </UnitProvider>
  );
}
