/** Join class names, skipping false, null, undefined and empty values. */
export function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}
