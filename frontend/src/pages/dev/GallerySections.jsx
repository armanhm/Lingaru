import { BookOpen, Plus, Search, Settings } from "lucide-react";
import {
  Button,
  IconButton,
  Card,
  Badge,
  EmptyState,
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonCircle,
  PageHeader,
} from "../../components/ui";

export function Group({ title, note, children }) {
  return (
    <section className="mb-8">
      <h3 className="text-h3 text-fg">{title}</h3>
      {note && <p className="mb-3 text-small text-fg-3">{note}</p>}
      <div className="mt-3 flex flex-wrap items-start gap-3">{children}</div>
    </section>
  );
}

export function Labelled({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-caption text-fg-3">{label}</span>
      {children}
    </div>
  );
}

const VARIANTS = ["primary", "secondary", "quiet", "danger"];

export function ButtonSection() {
  return (
    <>
      <Group title="Button" note="Hover and focus-visible are live: tab to any control to see the 2 px accent ring.">
        {VARIANTS.map((v) => (
          <Labelled key={v} label={v}>
            <Button variant={v}>Continue</Button>
          </Labelled>
        ))}
      </Group>
      <Group title="Button sizes and states">
        {["sm", "md", "lg"].map((s) => (
          <Labelled key={s} label={s}>
            <Button size={s}>Start · 20 min</Button>
          </Labelled>
        ))}
        <Labelled label="disabled"><Button disabled>Continue</Button></Labelled>
        <Labelled label="loading"><Button loading>Saving</Button></Labelled>
        <Labelled label="icons"><Button iconLeft={<Plus className="size-4" />} variant="secondary">New note</Button></Labelled>
        <Labelled label="asChild"><Button asChild variant="quiet"><a href="#top">Back to top</a></Button></Labelled>
      </Group>
      <Group title="IconButton">
        {VARIANTS.map((v) => (
          <Labelled key={v} label={v}>
            <IconButton label={`Search (${v})`} icon={Search} variant={v} />
          </Labelled>
        ))}
        {["sm", "md", "lg"].map((s) => (
          <Labelled key={s} label={s}>
            <IconButton label={`Settings (${s})`} icon={Settings} size={s} variant="secondary" />
          </Labelled>
        ))}
        <Labelled label="disabled"><IconButton label="Search disabled" icon={Search} disabled /></Labelled>
      </Group>
    </>
  );
}

export function SurfaceSection() {
  return (
    <>
      <Group title="Card">
        <Card className="w-64"><p className="text-body text-fg">Plain card, p-5.</p></Card>
        <Card padding="lg" className="w-64"><p className="text-body text-fg">Large padding.</p></Card>
        <Card as="button" interactive className="w-64">
          <p className="text-body font-medium text-fg">Interactive card</p>
          <p className="text-small text-fg-2">Hover and focus change the border and ring.</p>
        </Card>
      </Group>
      <Group title="Badge">
        {["neutral", "accent", "ok", "err", "warn"].map((t) => (
          <Badge key={t} tone={t}>{t === "ok" ? "Mastered" : t === "err" ? "To review" : t === "warn" ? "Due soon" : t === "accent" ? "New" : "Draft"}</Badge>
        ))}
      </Group>
      <Group title="PageHeader">
        <div className="w-full">
          <PageHeader
            eyebrow="Grammar"
            title="Passé composé"
            subtitle="Twelve exercises, about 20 minutes."
            backTo="/dev/ui"
            backLabel="All topics"
            icon={<BookOpen className="size-5" aria-hidden="true" />}
            actions={<Button size="sm">Start · 20 min</Button>}
          />
        </div>
      </Group>
      <Group title="EmptyState" note="Tones: neutral, success, info, warn.">
        {["neutral", "success", "info", "warn"].map((tone) => (
          <Card key={tone} className="w-72" padding="none">
            <EmptyState
              tone={tone}
              title={tone === "success" ? "All caught up" : "No notes yet"}
              subtitle={tone === "success" ? "Nothing is due today." : "Write your first note to see it here."}
              action={<Button size="sm" variant="secondary">New note</Button>}
            />
          </Card>
        ))}
      </Group>
      <Group title="Skeleton" note="The pulse stops when the system asks for reduced motion.">
        <div className="w-64"><SkeletonText lines={3} /></div>
        <div className="w-48"><SkeletonCard /></div>
        <SkeletonCircle />
        <Skeleton className="h-6 w-40" />
      </Group>
    </>
  );
}
