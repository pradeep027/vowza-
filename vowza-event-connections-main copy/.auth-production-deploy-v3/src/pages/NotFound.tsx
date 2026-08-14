import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { useBackNavigation } from "@/hooks/useBackNavigation";

const NotFound = () => {
  const location = useLocation();
  const { goBack, canGoBack } = useBackNavigation("/");

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
        <div className="flex items-center justify-center gap-4">
          {canGoBack && (
            <button
              onClick={goBack}
              className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Go Back
            </button>
          )}
          <Link to="/" className="text-primary underline hover:text-primary/90">
            Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
