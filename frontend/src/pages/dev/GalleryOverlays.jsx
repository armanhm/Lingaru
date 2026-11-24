import { useState } from "react";
import {
  Button,
  Dialog,
  Drawer,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  ProgressBar,
  SegmentedProgress,
  FeedbackPanel,
} from "../../components/ui";
import { useToast } from "../../contexts/ToastContext";
import { Group } from "./GallerySections";

export function OverlaySection() {
  const [dialog, setDialog] = useState(false);
  const [drawer, setDrawer] = useState(null);
  const { showToast } = useToast();
  return (
    <>
      <Group title="Dialog, Drawer, Toast" note="Overlays portal to the body, so they show the page theme, not a dark column.">
        <Button variant="secondary" onClick={() => setDialog(true)}>Open dialog</Button>
        <Button variant="secondary" onClick={() => setDrawer("bottom")}>Open bottom sheet</Button>
        <Button variant="secondary" onClick={() => setDrawer("right")}>Open side panel</Button>
        {["success", "info", "warn", "error"].map((t) => (
          <Button key={t} variant="quiet" onClick={() => showToast(`Toast: ${t}`, t, 4000)}>Toast {t}</Button>
        ))}
      </Group>
      <Dialog
        open={dialog}
        onOpenChange={setDialog}
        title="Leave this session?"
        description="Your progress so far is saved."
        footer={<><Button variant="quiet" onClick={() => setDialog(false)}>Stay</Button><Button onClick={() => setDialog(false)}>Leave</Button></>}
      >
        <p>You answered 7 of 12 questions.</p>
      </Dialog>
      <Drawer open={drawer !== null} onOpenChange={(o) => !o && setDrawer(null)} side={drawer || "bottom"} title="Filters" description="Narrow the list.">
        <p>Level, topic and date filters go here.</p>
      </Drawer>
    </>
  );
}

export function TabsProgressSection() {
  return (
    <>
      <Group title="Tabs">
        <Tabs defaultValue="a" className="w-full max-w-md">
          <TabsList aria-label="Sections">
            <TabsTrigger value="a">Lessons</TabsTrigger>
            <TabsTrigger value="b">Practice</TabsTrigger>
            <TabsTrigger value="c">Notes</TabsTrigger>
          </TabsList>
          <TabsContent value="a"><p className="text-body text-fg-2">Twelve lessons in this topic.</p></TabsContent>
          <TabsContent value="b"><p className="text-body text-fg-2">Start · 20 min</p></TabsContent>
          <TabsContent value="c"><p className="text-body text-fg-2">Your notes appear here.</p></TabsContent>
        </Tabs>
      </Group>
      <Group title="ProgressBar, SegmentedProgress">
        <div className="flex w-full max-w-md flex-col gap-3">
          <ProgressBar value={0} label="Not started" />
          <ProgressBar value={0.4} label="Lesson progress" />
          <ProgressBar value={1} label="Complete" />
          <SegmentedProgress label="Session" segments={[{ weight: 2, value: 1 }, { weight: 3, value: 0.5 }, { weight: 1, value: 0 }]} />
        </div>
      </Group>
      <Group title="FeedbackPanel">
        <div className="flex w-full max-w-md flex-col gap-3">
          <FeedbackPanel state="correct" title="Correct" action={<Button size="sm">Continue</Button>}>Bien joué.</FeedbackPanel>
          <FeedbackPanel state="nearly" title="Nearly. One word to check." action={<Button size="sm">Continue</Button>}>Check the accent on mangé.</FeedbackPanel>
          <FeedbackPanel state="wrong" title="Not quite" action={<Button size="sm">Continue</Button>}>The answer is "allée".</FeedbackPanel>
        </div>
      </Group>
    </>
  );
}
