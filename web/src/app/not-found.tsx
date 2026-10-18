import Link from "next/link";

/**
 * Branded catch-all 404. Any unknown or private URL — including public
 * portfolio and page paths for draft or unpublished sites — lands here
 * without revealing whether the resource exists.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center text-slate-900">
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
        404 — Page not found
      </p>
      <h1 className="text-2xl font-semibold">This page does not exist</h1>
      <p className="max-w-md text-sm text-slate-600">
        The page you are looking for is missing, private, or no longer
        published.
      </p>
      <Link
        href="/"
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
      >
        Portfolio Builder home
      </Link>
    </main>
  );
}
