/**
 * Serialised "latest draft wins" save queue for autosave.
 *
 * - markDirty() bumps a version counter; call it on every edit.
 * - flush() saves until the saved version equals the current one. Edits made
 *   while a save is in flight are never dropped: the loop re-reads the latest
 *   payload via getPayload() and saves again.
 * - A save only counts as done for the version it was started with, so a slow
 *   save can never mark newer edits as saved.
 *
 * getPayload() may return null to mean "nothing worth saving yet".
 * Status transitions are reported through onStatus: "saving" | "saved" | "error".
 */
export function createSaveQueue({ getPayload, save, onStatus = () => {} }) {
  let version = 0;
  let savedVersion = 0;
  let running = null;

  const run = async () => {
    onStatus("saving");
    try {
      while (savedVersion < version) {
        const startedAt = version;
        const payload = getPayload();
        if (payload != null) await save(payload);
        savedVersion = startedAt;
      }
      onStatus("saved");
      return { ok: true };
    } catch (error) {
      onStatus("error");
      return { ok: false, error };
    } finally {
      running = null;
    }
  };

  return {
    markDirty() {
      version += 1;
    },
    isDirty() {
      return savedVersion < version;
    },
    isSaving() {
      return running !== null;
    },
    // Resolves once the latest edit is persisted (or a save failed).
    flush() {
      if (running) return running;
      if (savedVersion >= version) return Promise.resolve({ ok: true });
      running = run();
      return running;
    },
  };
}
