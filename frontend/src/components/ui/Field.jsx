import { Children, cloneElement, isValidElement, useId } from "react";
import { cx } from "./cx";

/**
 * Label, hint and error around one form control. Clones its single child with
 * `id`, `aria-describedby` and `aria-invalid`, so it works with Input,
 * Textarea, Select, Checkbox and Switch.
 */
export function Field({ id, label, hint, error, className, children }) {
  const autoId = useId();
  const child = Children.only(children);
  const fieldId = id ?? child.props.id ?? autoId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [child.props["aria-describedby"], hintId, errorId].filter(Boolean).join(" ");

  const control = isValidElement(child)
    ? cloneElement(child, {
        id: fieldId,
        "aria-describedby": describedBy || undefined,
        "aria-invalid": !!error,
      })
    : child;

  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={fieldId} className="text-small font-medium text-fg">
          {label}
        </label>
      )}
      {control}
      {hint && (
        <p id={hintId} className="text-small text-fg-3">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-small text-err">
          {error}
        </p>
      )}
    </div>
  );
}
