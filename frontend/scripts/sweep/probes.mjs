// Computed-style probes. See README.md ("Probes").
//
// Each probe is a small HTML snippet that the sweep injects into an
// authenticated page (light and dark). The first element of the snippet is
// the probed element. Class strings are copied from real usages in src/ (file
// cited above each probe): Tailwind only generates CSS for class names it finds
// in the app's own sources, so an invented class string would measure nothing.
//
// Fields:
//   id             unique name
//   html           snippet with the current class names
//   tw3Html        the same snippet with the Tailwind 3 class names, used when
//                  the page under test runs Tailwind 3 (the Stage 1 baseline)
//   hover / focus  also record the hovered / focused state
//   pseudo         read getComputedStyle(el, pseudo) colours instead
//   expectedDrift  difference that is accepted against a baseline captured
//                  from another Tailwind major version:
//                    "default-palette": colour values from Tailwind's default
//                      palette, which moved to oklch in Tailwind 4
//                    "not-generated-in-tailwind-3": the class is not used in
//                      the app, so Tailwind 3 generated no CSS for it

// The page the probes are injected into; any authenticated route works.
export const PROBE_ROUTE = "settings";

const three = (attrs) => attrs.map((a) => `<div${a ? ` class="${a}"` : ""}>Row</div>`).join("");

function spaceY(id, container) {
  return [
    { id, html: `<div class="${container}">${three(["", "", ""])}</div>` },
    // A child's own bottom margin: kept on the first child, overridden on later ones.
    { id: `${id}-child-mb`, html: `<div class="${container}">${three(["mb-2", "mb-2", ""])}</div>` },
    // A child's own top margin: kept on the first child, overridden on later ones.
    { id: `${id}-child-mt`, html: `<div class="${container}">${three(["mt-3", "", "mt-3"])}</div>` },
  ];
}

export const PROBES = [
  // space-y in the three container types. Block: VideoSection.jsx:280.
  // Flex column: AgentRun.jsx:297. Grid: no element combines `grid` and
  // `space-y-5`, but both classes are used, so their rules exist.
  // Child margins: `mb-2` (MyNotesEdit.jsx:758), `mt-3` (Dashboard.jsx:497).
  ...spaceY("space-y-block", "space-y-5"),
  ...spaceY("space-y-flex-col", "flex flex-col flex-1 min-h-0 space-y-5"),
  ...spaceY("space-y-grid", "grid space-y-5"),

  // Cards. OurNotes.jsx:58; TriumphHero.jsx:73; Documents.jsx:25.
  { id: "card", html: `<div class="card p-6">Card</div>` },
  { id: "card-elevated", html: `<div class="relative mt-8 card card-elevated p-6 sm:p-8">Stats</div>` },
  { id: "card-hover", hover: true, html: `<div class="card p-5 flex flex-col gap-3 card-hover">Document</div>` },

  // Skeletons. Dashboard.jsx:771 (Tailwind 3 source: `rounded`); Dashboard.jsx:776.
  {
    id: "skeleton-rounded-sm",
    html: `<div class="skeleton h-3 w-32 rounded-sm"></div>`,
    tw3Html: `<div class="skeleton h-3 w-32 rounded"></div>`,
  },
  { id: "skeleton-rounded-3xl", html: `<div class="lg:col-span-5 skeleton h-[420px] rounded-3xl"></div>` },

  // Button variants with btn-md: e.g. AIResultModal.jsx:100-106, NoteActions.jsx,
  // ExamExercise.jsx. btn-accent is defined but used nowhere.
  ...["primary", "secondary", "ghost", "danger", "success"].map((v) => ({
    id: `btn-${v}`,
    hover: true,
    html: `<button type="button" class="btn-${v} btn-md">Button</button>`,
  })),
  {
    id: "btn-accent",
    hover: true,
    expectedDrift: "not-generated-in-tailwind-3",
    html: `<button type="button" class="btn-accent btn-md">Button</button>`,
  },
  // Sizes: btn-primary btn-sm / btn-lg / btn-xl (ExamExercise.jsx:424,
  // OurNotes.jsx:64, Dictation.jsx:166).
  ...["sm", "lg", "xl"].map((s) => ({
    id: `btn-${s}`,
    html: `<button type="button" class="btn-primary btn-${s}">Button</button>`,
  })),

  // Badges. ExamPrepHub.jsx:94; GrammarLibrary.jsx:13; Documents.jsx:35,36;
  // OurNotes.jsx:147; GrammarLibrary.jsx:10; MistakeJournal.jsx:19 (bare badge).
  ...["primary", "success", "danger", "warn", "info", "neutral"].map((v) => ({
    id: `badge-${v}`,
    html: `<span class="badge-${v}">Badge</span>`,
  })),
  {
    id: "badge",
    html: `<span class="badge bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400">Badge</span>`,
  },
  // Font-size overrides on badges. ExamPrepHub.jsx:96, 180.
  {
    id: "badge-neutral-10px",
    html: `<span class="badge-neutral text-[10px]!">Not started</span>`,
    tw3Html: `<span class="badge-neutral !text-[10px]">Not started</span>`,
  },
  {
    id: "badge-accent-10px",
    html: `<span class="badge-accent text-[10px]!">France</span>`,
    tw3Html: `<span class="badge-accent !text-[10px]">France</span>`,
  },

  // Inputs. ConjugationDrill.jsx:236. input-error is defined but used nowhere.
  { id: "input", focus: true, html: `<input class="input" value="Bonjour">` },
  { id: "input-placeholder", pseudo: "::placeholder", html: `<input class="input" placeholder="Type here">` },
  {
    id: "input-error",
    focus: true,
    expectedDrift: "not-generated-in-tailwind-3",
    html: `<input class="input input-error" value="Bonjour">`,
  },

  // Other component classes. Layout.jsx:325; SRSReview.jsx:305; GrammarDrill.jsx:343.
  { id: "section-label", html: `<span class="section-label flex-1 text-left">Section</span>` },
  { id: "stat-pill", html: `<div class="stat-pill shrink-0">12 cards</div>` },
  { id: "kbd", html: `<kbd class="kbd">Enter</kbd>` },

  // dark: utilities beside plain hover:/focus: utilities.
  // LessonDetail.jsx:161.
  {
    id: "lesson-summary",
    hover: true,
    html: `<summary class="text-sm font-medium text-primary-600 dark:text-primary-400 cursor-pointer hover:text-primary-700 flex items-center gap-1.5">Show translation</summary>`,
  },
  // Dashboard.jsx:386.
  {
    id: "dashboard-quote-shuffle",
    hover: true,
    html: `<button type="button" class="p-1.5 rounded-lg text-surface-300 dark:text-surface-600 hover:text-primary-500 hover:bg-primary-50/60 dark:hover:bg-primary-900/20 transition-all hover:rotate-180 duration-500 focus-ring">R</button>`,
  },
  // Dashboard.jsx:485 (Tailwind 3 source: `rounded`).
  {
    id: "dashboard-word-shuffle",
    hover: true,
    html: `<button type="button" class="text-surface-300 dark:text-surface-600 hover:text-primary-500 transition-all focus-ring rounded-sm p-1 disabled:opacity-50 hover:rotate-180 duration-500">R</button>`,
    tw3Html: `<button type="button" class="text-surface-300 dark:text-surface-600 hover:text-primary-500 transition-all focus-ring rounded p-1 disabled:opacity-50 hover:rotate-180 duration-500">R</button>`,
  },
  // Dictionary.jsx:463.
  {
    id: "dictionary-quick-lookup",
    hover: true,
    html: `<button type="button" class="px-3.5 py-1.5 text-sm font-medium rounded-lg bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-300 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-700 dark:hover:text-primary-300 hover:scale-105 transition-all animate-fade-in-up active:scale-95">maison</button>`,
  },
  // Dictionary.jsx:545.
  {
    id: "dictionary-quick-conjugate",
    hover: true,
    html: `<button type="button" class="px-3.5 py-1.5 text-sm font-medium rounded-lg bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-300 hover:border-info-400 hover:bg-info-50 dark:hover:bg-info-900/20 hover:text-info-700 dark:hover:text-info-300 hover:scale-105 transition-all animate-fade-in-up active:scale-95">aller</button>`,
  },
  // Dictation.jsx:202 (Tailwind 3 source: `focus:outline-none`).
  {
    id: "dictation-input",
    hover: true,
    focus: true,
    html: `<input class="w-full px-4 py-3 border-2 border-surface-200 dark:border-surface-600 rounded-xl text-base bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-hidden transition-all" value="Bonjour">`,
    tw3Html: `<input class="w-full px-4 py-3 border-2 border-surface-200 dark:border-surface-600 rounded-xl text-base bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none transition-all" value="Bonjour">`,
  },
  // Settings.jsx:159 (the static part; Tailwind 3 source: `focus:outline-none`).
  {
    id: "settings-select",
    hover: true,
    focus: true,
    html: `<select class="px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg text-sm bg-white dark:bg-surface-700 text-surface-800 dark:text-surface-100 focus:outline-hidden focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"><option>English</option></select>`,
    tw3Html: `<select class="px-3 py-2 border border-surface-200 dark:border-surface-600 rounded-lg text-sm bg-white dark:bg-surface-700 text-surface-800 dark:text-surface-100 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"><option>English</option></select>`,
  },
  // ReorderQuestion.jsx:80 (Tailwind 3 source: `shadow-sm`).
  {
    id: "reorder-word",
    hover: true,
    html: `<button type="button" class="px-3 py-1.5 rounded-lg bg-white dark:bg-surface-800 border-2 border-surface-200 dark:border-surface-600 text-surface-800 dark:text-surface-200 text-sm font-medium hover:border-primary-400 hover:scale-105 active:scale-95 transition-all shadow-xs">mot</button>`,
    tw3Html: `<button type="button" class="px-3 py-1.5 rounded-lg bg-white dark:bg-surface-800 border-2 border-surface-200 dark:border-surface-600 text-surface-800 dark:text-surface-200 text-sm font-medium hover:border-primary-400 hover:scale-105 active:scale-95 transition-all shadow-sm">mot</button>`,
  },

  // Chat bubble tails. AgentRun.jsx:61-63 and Assistant.jsx:776-778
  // (Tailwind 3 source: `shadow-sm`, `bg-gradient-to-br`, and `rounded-br-sm` /
  // `rounded-bl-sm`, which were 2px in Tailwind 3 and are `-xs` in Tailwind 4).
  {
    id: "agent-bubble-user",
    html: `<div class="relative group/bubble rounded-2xl px-4 py-3 text-[14px] leading-relaxed shadow-xs bg-linear-to-br from-primary-600 to-purple-700 text-white rounded-br-xs whitespace-pre-wrap">Bonjour</div>`,
    tw3Html: `<div class="relative group/bubble rounded-2xl px-4 py-3 text-[14px] leading-relaxed shadow-sm bg-gradient-to-br from-primary-600 to-purple-700 text-white rounded-br-sm whitespace-pre-wrap">Bonjour</div>`,
  },
  {
    id: "agent-bubble-assistant",
    html: `<div class="relative group/bubble rounded-2xl px-4 py-3 text-[14px] leading-relaxed shadow-xs bg-white dark:bg-surface-900/80 border border-surface-100 dark:border-surface-800 text-surface-900 dark:text-surface-50 rounded-bl-xs">Salut</div>`,
    tw3Html: `<div class="relative group/bubble rounded-2xl px-4 py-3 text-[14px] leading-relaxed shadow-sm bg-white dark:bg-surface-900/80 border border-surface-100 dark:border-surface-800 text-surface-900 dark:text-surface-50 rounded-bl-sm">Salut</div>`,
  },
  {
    id: "assistant-bubble-user",
    html: `<div class="relative group/bubble rounded-2xl px-4 py-3 text-[14px] leading-relaxed shadow-xs bg-linear-to-br from-purple-800 to-surface-700 text-white rounded-br-xs">Bonjour</div>`,
    tw3Html: `<div class="relative group/bubble rounded-2xl px-4 py-3 text-[14px] leading-relaxed shadow-sm bg-gradient-to-br from-purple-800 to-surface-700 text-white rounded-br-sm">Bonjour</div>`,
  },

  // Pseudo-elements styled in index.css (base layer and divider-label, which
  // is defined but used nowhere).
  { id: "selection", pseudo: "::selection", html: `<p>Selected text</p>` },
  {
    id: "scrollbar-thumb",
    pseudo: "::-webkit-scrollbar-thumb",
    html: `<div style="overflow:auto;height:40px"><div style="height:200px"></div></div>`,
  },
  ...["::before", "::after"].map((pseudo) => ({
    id: `divider-label${pseudo.replace("::", "-")}`,
    pseudo,
    expectedDrift: "not-generated-in-tailwind-3",
    html: `<div class="divider-label">or</div>`,
  })),

  // Default text sizes, as set and with the font size overridden (the badge
  // case above, without the badge). MyNotesEdit.jsx:179; MistakeJournal.jsx:134;
  // Settings.jsx:169; NoteAssistant.jsx:43.
  ...["text-xs", "text-sm", "text-base", "text-lg"].flatMap((size) => [
    { id: size, html: `<p class="${size}">Text</p>` },
    { id: `${size}-overridden`, html: `<p class="${size}" style="font-size:10px">Text</p>` },
  ]),
];
