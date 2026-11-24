import { useState } from "react";
import { Field, Input, Textarea, Select, Checkbox, Switch } from "../../components/ui";
import { Group } from "./GallerySections";

export function FormSection() {
  const [on, setOn] = useState(true);
  return (
    <>
      <Group title="Field with Input">
        <Field label="Your answer" hint="Use the accent: j'ai mangé." className="w-64">
          <Input placeholder="Type in French" />
        </Field>
        <Field label="Your answer" error="Nearly. One word to check." className="w-64">
          <Input defaultValue="j'ai mange" />
        </Field>
        <Field label="Your answer" className="w-64">
          <Input disabled defaultValue="Locked" />
        </Field>
      </Group>
      <Group title="Textarea, Select">
        <Field label="Note" hint="Saved as you type." className="w-64">
          <Textarea rows={3} defaultValue="Je suis allé au marché." />
        </Field>
        <Field label="Level" className="w-64">
          <Select defaultValue="b1">
            <option value="a2">A2</option>
            <option value="b1">B1</option>
            <option value="b2">B2</option>
          </Select>
        </Field>
        <Field label="Level" error="Choose a level." className="w-64">
          <Select defaultValue=""><option value="">Choose</option><option value="a2">A2</option></Select>
        </Field>
      </Group>
      <Group title="Checkbox, Switch">
        <Field label="Remind me daily"><Checkbox defaultChecked /></Field>
        <Field label="Remind me daily" error="Required."><Checkbox /></Field>
        <Field label="Disabled"><Checkbox disabled /></Field>
        <Checkbox label="With its own label (tap anywhere in the row)" />
        <Switch checked={on} onCheckedChange={setOn} label="Daily reminder" />
        <Switch checked={false} onCheckedChange={() => {}} label="Disabled" disabled />
      </Group>
    </>
  );
}
