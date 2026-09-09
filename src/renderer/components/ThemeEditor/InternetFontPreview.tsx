import { useEffect, useState } from "react";
import { CircleAlert } from "lucide-react";
import type { GoogleFontMeta } from "../../data/googleFontsCatalog";
import { applyGoogleFontPreviewStyle, fetchGoogleFontPreviewCss, getPreviewFontIdForFamily } from "../../utils/googleFontCss";

type PreviewState = "loading" | "ready" | "error";
const previewLabels = { loading: "Loading preview", ready: "Preview ready", error: "Preview unavailable" } as const satisfies Record<PreviewState, string>;

export function InternetFontPreview({ font }: { readonly font: GoogleFontMeta }): JSX.Element {
  const [state, setState] = useState<PreviewState>("loading");
  const variant = font.variants.find((item) => item.weight === "400" && item.style === "normal") ?? font.variants[0];
  const previewFamily = getPreviewFontIdForFamily(font.family);

  useEffect(() => {
    const cancellation = { cancelled: false };
    let cleanup: (() => void) | undefined;
    setState("loading");
    const load = async (): Promise<void> => {
      try {
        const result = await fetchGoogleFontPreviewCss({ family: font.family, weight: variant.weight, style: variant.style }, {
          fetchGoogleFontCss: (request) => window.api.fonts.fetchGoogleFontCss(request),
          fetchGoogleFontFile: (url) => window.api.fonts.fetchGoogleFontFile({ url }),
        });
        if (cancellation.cancelled) return;
        if (!result.success || typeof result.css !== "string") {
          setState("error");
          return;
        }
        cleanup = applyGoogleFontPreviewStyle(font.family, result.css, cancellation);
        const faces = await document.fonts.load(`${variant.style} ${variant.weight} 16px "${previewFamily}"`, font.family);
        if (!cancellation.cancelled) setState(faces.length > 0 ? "ready" : "error");
      } catch {
        if (!cancellation.cancelled) setState("error");
      }
    };
    void load();
    return () => {
      cancellation.cancelled = true;
      cleanup?.();
    };
  }, [font.family, variant.weight, variant.style, previewFamily]);

  return (
    <span className="theme-font-preview" data-state={state} role="status" aria-label={`${font.family}: ${previewLabels[state]}`}>
      <span className="theme-font-preview-slot" aria-busy={state === "loading"}>
        {state === "loading" && <span className="theme-font-preview-skeleton" aria-hidden="true" />}
        {state === "ready" && <span className="theme-font-preview-text" style={{ fontFamily: `"${previewFamily}", sans-serif` }}>{font.family}</span>}
        {state === "error" && <span className="theme-font-preview-error" title="Preview unavailable. You can still download this font.">
          <CircleAlert size={16} aria-hidden="true" />
        </span>}
      </span>
    </span>
  );
}
