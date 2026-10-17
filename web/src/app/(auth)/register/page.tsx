import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Create account — Portfolio Builder",
};

export default function RegisterPage() {
  return (
    <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Start building and publishing your portfolio.
        </p>
      </header>
      <RegisterForm />
      <Link
        href="/"
        className="block text-center text-sm text-slate-500 underline dark:text-slate-400"
      >
        Back to home
      </Link>
    </div>
  );
}
