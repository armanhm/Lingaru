import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface-50 dark:bg-surface-900 px-4">
      <div className="text-center animate-fade-in-up">
        <span className="text-7xl font-extrabold text-gradient-primary">404</span>
        <p className="text-lg font-medium text-surface-600 dark:text-surface-400 mt-3 mb-6">
          Oops, this page doesn't exist.
        </p>
        <Link to="/" className="btn-primary btn-lg">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
