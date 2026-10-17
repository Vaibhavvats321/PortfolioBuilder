import { AuthStatus } from "@/components/auth/auth-status";
import { HealthStatus } from "@/components/health-status";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <header className="space-y-3">
        <p className="text-sm font-medium tracking-wide text-slate-500 uppercase">
          Phase 2 — Portfolio management
        </p>
        <h1 className="text-3xl font-semibold">Portfolio Builder</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Create an account or sign in to get started. The panels below confirm
          your session and the backend health.
        </p>
      </header>
      <AuthStatus />
      <HealthStatus />
    </main>
  );
}
