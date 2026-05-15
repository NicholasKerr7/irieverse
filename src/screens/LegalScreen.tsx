import { ArrowLeft, FileText, ShieldCheck } from "lucide-react";
import { PageFooter } from "../components/PageFooter";
import type { MobileTabId } from "../components/mobile/BottomNav";

export type LegalPageId = "privacy" | "terms";

type LegalScreenProps = {
  page: LegalPageId;
  onNavigate: (tab: MobileTabId) => void;
};

type PolicySection = {
  title: string;
  body: string[];
};

const LAST_UPDATED = "May 15, 2026";

const PRIVACY_SECTIONS: PolicySection[] = [
  {
    title: "What IrieVerse Stores",
    body: [
      "IrieVerse keeps trip preferences, saved places, saved experiences, imported travel ideas, and board organization in the browser so the planner can work without an account.",
      "When online boards or share links are enabled, the app can store the same trip and board data with the configured cloud services so it can sync across devices or open from a shared link.",
    ],
  },
  {
    title: "Imported Links",
    body: [
      "When a link is imported, the app may request public page metadata such as title, description, preview image, source site, and related place details.",
      "Do not import private links, sensitive notes, passwords, payment details, medical details, or documents that should not become part of a travel board.",
    ],
  },
  {
    title: "Live Planning Services",
    body: [
      "Optional live services can support place details, road geometry, hotel options, and flight snapshots. Those services may receive the query needed to answer the request, such as a place name, route coordinates, airport codes, or travel dates.",
      "If a live service is unavailable or not configured, IrieVerse uses saved examples or estimates and labels the planning state inside the app.",
    ],
  },
  {
    title: "Your Choices",
    body: [
      "You can use IrieVerse without signing in. Browser data can be cleared by clearing site data for this app.",
      "Anyone with a trip share link can view that shared trip. Editing a shared trip requires the local edit token stored in the browser that created or updated it.",
    ],
  },
  {
    title: "No Ad Tracking",
    body: [
      "This app does not include advertising trackers or sell personal data. If analytics, payments, or new account features are added later, this policy should be reviewed before launch.",
    ],
  },
];

const TERMS_SECTIONS: PolicySection[] = [
  {
    title: "Planning Only",
    body: [
      "IrieVerse is a travel planning aid. It is not a booking agent, emergency service, navigation service, airline, hotel, transportation provider, or official tourism authority.",
      "Always confirm prices, schedules, road conditions, attraction hours, entry requirements, weather, and safety information with official or direct sources before booking or traveling.",
    ],
  },
  {
    title: "Your Content",
    body: [
      "You are responsible for the links, notes, trip plans, and board content you add to the app.",
      "Do not add unlawful, harmful, confidential, or highly sensitive content to saved boards or shared trips.",
    ],
  },
  {
    title: "Shared Trips",
    body: [
      "A shared trip link is intended to be viewable by anyone who has the link. Only share a trip link with people who should see the plan.",
      "The browser that creates or updates a shared trip stores a local edit token. Losing browser data can remove the ability to edit that shared link from that device.",
    ],
  },
  {
    title: "Third-Party Services",
    body: [
      "The app may link to or request information from third-party travel, map, place, lodging, flight, and content services. Those services are independent and can change, limit, or remove their data at any time.",
      "IrieVerse is not responsible for third-party content, availability, pricing, policies, or transactions.",
    ],
  },
  {
    title: "Availability",
    body: [
      "The app is provided as-is and may be unavailable, incomplete, or inaccurate. Use judgment and verify important details before relying on a plan.",
    ],
  },
];

const PAGE_COPY: Record<LegalPageId, {
  eyebrow: string;
  title: string;
  summary: string;
  icon: typeof ShieldCheck;
  sections: PolicySection[];
}> = {
  privacy: {
    eyebrow: "Privacy",
    title: "Privacy Policy",
    summary: "How IrieVerse handles saved plans, imported links, shared trips, and optional online planning services.",
    icon: ShieldCheck,
    sections: PRIVACY_SECTIONS,
  },
  terms: {
    eyebrow: "Terms",
    title: "Terms of Use",
    summary: "The ground rules for using IrieVerse as a planning aid before making real travel decisions.",
    icon: FileText,
    sections: TERMS_SECTIONS,
  },
};

export function LegalScreen({ page, onNavigate }: LegalScreenProps) {
  const copy = PAGE_COPY[page];
  const Icon = copy.icon;

  return (
    <main className="min-h-dvh bg-slate-950 text-slate-100">
      <section className="border-b border-white/10 bg-slate-950 px-5 py-8 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-4xl">
          <button
            type="button"
            onClick={() => onNavigate("home")}
            className="mb-8 inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-slate-200 transition hover:border-cyan-200/50 hover:text-cyan-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Back home
          </button>

          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/25 bg-cyan-200/10 text-cyan-100">
              <Icon className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">{copy.eyebrow}</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-white sm:text-4xl">{copy.title}</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">{copy.summary}</p>
              <p className="mt-4 text-sm text-slate-500">Last updated: {LAST_UPDATED}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-8 sm:px-6 lg:px-10">
        <div className="mx-auto grid max-w-4xl gap-5">
          {copy.sections.map((section) => (
            <article key={section.title} className="border-b border-white/10 pb-5">
              <h2 className="text-lg font-semibold text-white">{section.title}</h2>
              <div className="mt-3 space-y-3 text-sm leading-6 text-slate-300">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <PageFooter />
    </main>
  );
}
