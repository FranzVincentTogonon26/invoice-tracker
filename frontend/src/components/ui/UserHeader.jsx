import { getInitials, greetingFor } from "@/lib/utils";

export function UserHeader({ user }) {
  const displayName = user?.name?.trim() || "Account";
  const firstName = displayName.split(" ")[0] || "there";
  const greeting = greetingFor();

  return (
    <>
      {/* Desktop — greeting + subtitle */}
      <div className="hidden min-w-0 md:block">
        <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight text-[var(--ink)] md:text-3xl">
          {greeting}, {firstName}.
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-[var(--ink-muted)]">
          Here&apos;s what&apos;s happening with your budget today.
        </p>
      </div>

      {/* Mobile — signed-in user identity */}
      <div className="flex min-w-0 flex-1 items-center gap-3 md:hidden">
        <h1 className="sr-only">
          {greeting}, {firstName}.
        </h1>

        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent-strong)] ring-2 ring-[var(--surface)]"
          aria-hidden="true"
        >
          {getInitials(user?.name)}
        </div>

        <div className="min-w-0 flex-1">
          <p className="type-eyebrow text-[11px]  leading-tight text-[var(--ink-muted)]">
            {greeting}
          </p>
          <p className="type-eyebrow text-sm font-bold leading-tight text-[var(--ink)]">
            {displayName}
          </p>
        </div>
      </div>
    </>
  );
}
