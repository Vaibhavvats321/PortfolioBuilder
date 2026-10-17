"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { registerUser } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  validateDisplayName,
  validateEmail,
  validatePassword,
} from "@/lib/auth/validation";

interface FieldErrors {
  email?: string;
  password?: string;
  display_name?: string;
}

export function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const errors: FieldErrors = {
      email: validateEmail(email),
      password: validatePassword(password),
      display_name: validateDisplayName(displayName),
    };
    setFieldErrors(errors);
    if (errors.email || errors.password || errors.display_name) {
      return;
    }

    setSubmitting(true);
    try {
      await registerUser({
        email: email.trim(),
        password,
        display_name: displayName.trim(),
      });
      router.push("/");
      router.refresh();
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <TextField
        id="register-display-name"
        label="Display name"
        type="text"
        autoComplete="name"
        value={displayName}
        error={fieldErrors.display_name}
        onChange={(event) => setDisplayName(event.target.value)}
      />
      <TextField
        id="register-email"
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        error={fieldErrors.email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <TextField
        id="register-password"
        label="Password"
        type="password"
        autoComplete="new-password"
        value={password}
        error={fieldErrors.password}
        onChange={(event) => setPassword(event.target.value)}
      />

      {formError ? (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          {formError}
        </p>
      ) : null}

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-sm text-slate-600 dark:text-slate-400">
        Already have an account?{" "}
        <Link href="/login" className="font-medium underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
