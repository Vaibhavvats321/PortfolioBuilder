"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, buttonClassName } from "@/components/ui/button";
import { fetchCurrentUser, logoutUser } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import type { AuthUser } from "@/types/auth";

type AuthState =
  | { state: "loading" }
  | { state: "anonymous" }
  | { state: "authenticated"; user: AuthUser }
  | { state: "error"; message: string };

export function AuthStatus() {
  const [auth, setAuth] = useState<AuthState>({ state: "loading" });
  const [loggingOut, setLoggingOut] = useState(false);

  const load = useCallback((signal?: AbortSignal) => {
    fetchCurrentUser().then(
      (user) => {
        if (signal?.aborted) {
          return;
        }
        setAuth(
          user ? { state: "authenticated", user } : { state: "anonymous" },
        );
      },
      (error: unknown) => {
        if (signal?.aborted) {
          return;
        }
        setAuth({
          state: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to load your account.",
        });
      },
    );
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await logoutUser();
      setAuth({ state: "anonymous" });
    } catch (error) {
      setAuth({
        state: "error",
        message:
          error instanceof ApiError
            ? error.message
            : "Unable to sign out. Please try again.",
      });
    } finally {
      setLoggingOut(false);
    }
  }, []);

  return (
    <section
      aria-live="polite"
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <h2 className="text-lg font-medium">Account</h2>

      {auth.state === "loading" && (
        <p className="mt-3 text-slate-500 dark:text-slate-400">
          Checking your session…
        </p>
      )}

      {auth.state === "anonymous" && (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            You are not signed in.
          </p>
          <div className="flex gap-3">
            <Link href="/login" className={buttonClassName("primary")}>
              Sign in
            </Link>
            <Link href="/register" className={buttonClassName("secondary")}>
              Create account
            </Link>
          </div>
        </div>
      )}

      {auth.state === "authenticated" && (
        <div className="mt-3 space-y-3">
          <dl className="space-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="font-medium text-slate-500 dark:text-slate-400">
                Name:
              </dt>
              <dd>{auth.user.display_name}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium text-slate-500 dark:text-slate-400">
                Email:
              </dt>
              <dd>{auth.user.email}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard" className={buttonClassName("primary")}>
              Open dashboard
            </Link>
            <Button
              variant="secondary"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              {loggingOut ? "Signing out…" : "Sign out"}
            </Button>
          </div>
        </div>
      )}

      {auth.state === "error" && (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-rose-600 dark:text-rose-400">
            {auth.message}
          </p>
          <Button variant="secondary" onClick={() => load()}>
            Retry
          </Button>
        </div>
      )}
    </section>
  );
}
