import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center px-6 text-center">
      <h1 className="text-3xl font-bold text-slate-950">Page not found</h1>
      <p className="mt-3 text-slate-600">The link may be expired, unavailable, or entered incorrectly.</p>
      <Link className="mx-auto mt-6 rounded-lg bg-teal-700 px-5 py-3 font-semibold text-white" href="/">Return home</Link>
    </main>
  );
}
