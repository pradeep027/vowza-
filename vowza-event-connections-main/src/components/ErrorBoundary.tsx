// ─── ErrorBoundary — Catches unhandled React render errors ───────────────────
import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props  { children: ReactNode; fallback?: ReactNode; resetKey?: unknown; }
interface State  { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In production wire this to Sentry / Datadog
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  componentDidUpdate(prevProps: Props) {
    // Auto-recover when the reset key changes (e.g. route navigation) after an
    // error, so a crashed route is escapable without a manual reload.
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="min-h-[40vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7 text-red-500" />
          </div>
          <div>
            <h2 className="text-xl font-display font-bold text-foreground mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This section failed to load. The error has been logged.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <pre className="mt-3 text-left text-xs bg-secondary rounded-xl p-4 overflow-x-auto text-destructive">
                {this.state.error.message}
              </pre>
            )}
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-maroon text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <RefreshCw className="w-4 h-4" /> Try Again
            </button>
            <a
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-secondary transition-colors"
            >
              <Home className="w-4 h-4" /> Go to homepage
            </a>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
