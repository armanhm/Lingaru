import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { landingRouteForMode } from "../lib/modeConfig";
import Dashboard from "../pages/Dashboard";

/**
 * The "/" index route. Different modes have different home pages:
 *   general → /dashboard (the existing Dashboard component, rendered here
 *             directly to avoid a double redirect on first paint).
 *   exam    → /exam-prep
 *   agentic → /assistant
 *
 * For users mid-onboarding (no mode set) we render the general dashboard
 * underneath the modal so the page isn't blank while they pick. Once they
 * submit, refreshUser() flips user.mode and this component re-renders to
 * the right destination.
 */
export default function ModeLanding() {
  const { user } = useAuth();
  const mode = user?.mode || "general";
  const target = landingRouteForMode(mode);

  // General mode's landing IS this index route — render Dashboard inline
  // instead of looping through a redirect.
  if (target === "/dashboard" || target === "/") {
    return <Dashboard />;
  }

  return <Navigate to={target} replace />;
}
