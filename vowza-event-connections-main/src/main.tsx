import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import "./index.css";

const container = document.getElementById("root");
if (!container) throw new Error('Root element "#root" not found');

// Root-level boundary — catches render errors thrown by the provider tree
// (Auth/Cart/Query) that a boundary inside the providers cannot reach.
createRoot(container).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
