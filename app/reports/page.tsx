import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileText, ShieldAlert } from "lucide-react";
import SceneBackground from "@/components/canvas/SceneBackground";
import { PageBackdrop } from "@/components/layout/PageBackdrop";
import { Nav } from "@/components/layout/Nav";
import { Section } from "@/components/layout/Section";
import { Contact } from "@/components/sections/Contact";

export const metadata: Metadata = {
  title: "Sample Report — RicePattyJulls",
  description:
    "An illustrative, sanitized engagement report showing structure and quality — executive summary, findings, and remediation.",
};

type Sev = "Critical" | "High" | "Medium" | "Low";
const sevColor: Record<Sev, string> = {
  Critical: "var(--danger)",
  High: "var(--violet)",
  Medium: "var(--blue)",
  Low: "var(--cyan)",
};

const findings: { id: string; title: string; sev: Sev }[] = [
  { id: "WEB-01", title: "Business logic account takeover chain", sev: "Critical" },
  { id: "WEB-02", title: "Web cache poisoning via unkeyed Host input", sev: "High" },
  { id: "WEB-03", title: "CORS misconfiguration exposes credentialed data", sev: "Medium" },
  { id: "WEB-04", title: "User enumeration through signup response timing", sev: "Low" },
];

function SevPill({ sev }: { sev: Sev }) {
  return (
    <span
      className="font-mono inline-block rounded-full border px-2.5 py-0.5 text-[10.5px] uppercase tracking-[0.14em]"
      style={{ borderColor: sevColor[sev], color: sevColor[sev] }}
    >
      {sev}
    </span>
  );
}

export default function Page() {
  return (
    <>
      <SceneBackground />
      <PageBackdrop />
      <Nav />
      <main className="relative z-10">
        <Section className="pt-32 pb-20 lg:pt-40">
          <Link
            href="/#selected-work"
            className="font-mono inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-text-mute transition-colors hover:text-white"
          >
            <ArrowLeft size={12} /> Back to selected work
          </Link>

          {/* header */}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <span
              className="font-mono inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-[0.22em]"
              style={{ borderColor: "var(--border-strong)", color: "var(--cyan)" }}
            >
              <FileText size={12} /> Sample Report
            </span>
            <span className="font-mono rounded-full border border-[color:var(--border-strong)] bg-white/[0.03] px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-text-dim">
              Illustrative · Sanitized
            </span>
          </div>

          <h1 className="font-display mt-6 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
            Web Application Security Assessment
          </h1>
          <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-text-dim sm:text-lg">
            A one-page extract showing how I write up an engagement — clear
            executive framing, risk-ranked findings, and remediation a team can
            act on. All names, hosts, and data below are fictional.
          </p>

          {/* meta */}
          <dl className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--border)] sm:grid-cols-4">
            {[
              ["Client", "Redacted (fictional)"],
              ["Engagement", "Web + Identity"],
              ["Window", "10 business days"],
              ["Classification", "Confidential"],
            ].map(([k, v]) => (
              <div key={k} className="bg-bg-1 p-4">
                <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-mute">{k}</dt>
                <dd className="mt-1.5 text-[13px] font-medium text-white">{v}</dd>
              </div>
            ))}
          </dl>

          {/* executive summary */}
          <div className="mt-14">
            <h2 className="font-display text-xl font-semibold tracking-tight">Executive summary</h2>
            <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-text-dim">
              The assessment identified a critical account-takeover chain reachable
              by any external user. No exploit-grade payloads were required — the
              application trusted its own legitimate flows. A self-registered,
              low-privileged account was escalated into another user&apos;s session
              by abusing an authentication logic flaw in the backend panel. Three
              lower-severity issues compounded the exposure. None of the findings
              depended on the perimeter WAF being absent; they lived in application
              logic and identity handling, where a proxy cannot help.
            </p>
          </div>

          {/* findings table */}
          <div className="mt-14">
            <h2 className="font-display text-xl font-semibold tracking-tight">Findings summary</h2>
            <div className="mt-5 overflow-x-auto rounded-2xl border border-[color:var(--border)]">
              <table className="w-full min-w-[520px] text-left">
                <thead>
                  <tr className="border-b border-[color:var(--border)] bg-white/[0.02]">
                    {["ID", "Finding", "Severity", "Status"].map((h) => (
                      <th
                        key={h}
                        className="font-mono px-4 py-3 text-[10.5px] uppercase tracking-[0.16em] text-text-mute"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {findings.map((f) => (
                    <tr key={f.id} className="border-b border-[color:var(--border)] last:border-0">
                      <td className="font-mono px-4 py-4 text-[12px] text-text-dim">{f.id}</td>
                      <td className="px-4 py-4 text-[13px] text-white">{f.title}</td>
                      <td className="px-4 py-4"><SevPill sev={f.sev} /></td>
                      <td className="font-mono px-4 py-4 text-[12px] text-text-mute">Open</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* detailed finding */}
          <div className="mt-14 panel-strong rounded-3xl p-7">
            <div className="flex flex-wrap items-center gap-3">
              <ShieldAlert size={18} style={{ color: "var(--danger)" }} />
              <span className="font-mono text-[12px] tracking-wide text-text-dim">WEB-01</span>
              <SevPill sev="Critical" />
            </div>
            <h3 className="font-display mt-4 text-2xl font-semibold tracking-tight">
              Business logic account takeover chain
            </h3>

            <div className="mt-6 space-y-6 text-[14px] leading-relaxed text-text-dim">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-mute">Description</div>
                <p className="mt-2 max-w-3xl">
                  Public self-registration created a fully functional identity inside
                  the same tenant as real users. Using that account&apos;s valid JWT,
                  internal users were enumerated and a backend panel was discovered
                  from its own JavaScript bundle. The panel&apos;s login endpoint
                  authorized on the submitted email while validating the caller&apos;s
                  own password — supplying a target email with the attacker&apos;s
                  password returned a session token for the target user.
                </p>
              </div>
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-mute">Impact</div>
                <p className="mt-2 max-w-3xl">
                  Full takeover of arbitrary accounts from an unauthenticated starting
                  position, including subsequent password change and downstream service
                  access. Rated Critical: trivial to reproduce, no privileged access
                  required, high confidentiality and integrity impact.
                </p>
              </div>
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-mute">Remediation</div>
                <ul className="mt-2 max-w-3xl list-disc space-y-1.5 pl-5">
                  <li>Bind session issuance to the exact identity whose credential was verified.</li>
                  <li>Never issue a session for an account other than the authenticated one.</li>
                  <li>Restrict backend panels behind Zero Trust / allowlist and block direct origin access.</li>
                  <li>Rate-limit signup, login, and directory queries; return uniform errors.</li>
                </ul>
              </div>
            </div>
            <Link
              href="/hacking-web/business-logic-account-takeover"
              className="group mt-7 inline-flex items-center gap-1.5 text-sm font-medium text-white"
            >
              Read the full technical writeup
              <span style={{ color: "var(--cyan)" }} className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
          </div>

          <p className="font-mono mt-10 max-w-3xl text-[11px] leading-relaxed text-text-mute">
            This is an illustrative sample built from sanitized, fictional data to
            show report structure and writing quality. It is not a real client
            deliverable.
          </p>
        </Section>
        <Contact />
      </main>
    </>
  );
}
