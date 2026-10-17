import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in — Portfolio Builder",
};

export default function LoginPage() {
  return (
    <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Sign in to manage your portfolios.
        </p>
      </header>
      <LoginForm />
      <Link
        href="/"
        className="block text-center text-sm text-slate-500 underline dark:text-slate-400"
      >
        Back to home
      </Link>
    </div>
  );
}
