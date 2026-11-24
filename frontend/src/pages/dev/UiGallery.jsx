import { ButtonSection, SurfaceSection } from "./GallerySections";
import { FormSection } from "./GalleryForms";
import { OverlaySection, TabsProgressSection } from "./GalleryOverlays";

// Dev-only: registered in App.jsx under import.meta.env.DEV and checked out of
// the production bundle by scripts/checks/no-gallery-in-build.mjs.
function Column({ theme }) {
  return (
    <div className={`${theme} min-w-0 flex-1 rounded-2xl border border-line bg-canvas p-6 text-fg`}>
      <p className="eyebrow-primary mb-6">{theme === "dark" ? "Dark" : "Light"}</p>
      <ButtonSection />
      <SurfaceSection />
      <FormSection />
      <TabsProgressSection />
    </div>
  );
}

export default function UiGallery() {
  return (
    <div data-ui-gallery="" className="mx-auto max-w-[1600px] p-6">
      <h1 className="text-h1 text-fg">Paper UI gallery</h1>
      <p className="mb-6 mt-1 text-body text-fg-2">
        Every component in every state, light and dark side by side. Development server only.
      </p>
      <div className="flex flex-col gap-6 xl:flex-row">
        <Column theme="light" />
        <Column theme="dark" />
      </div>
      <OverlaySection />
    </div>
  );
}
