import type { SyncHighlight } from "../types";

const FADE_DURATION_MS = 3000;
const FADE_TRANSITION_MS = 800;

export function renderSyncHighlights(
  viewerElement: HTMLElement,
  highlights: SyncHighlight[],
  getPageSizePt: (page: number) => { width: number; height: number } | null,
) {
  viewerElement.querySelectorAll(".synctex-highlight").forEach((node) => node.remove());

  const timers: number[] = [];

  for (const highlight of highlights) {
    const pageElement = viewerElement.querySelector(
      `.page[data-page-number="${highlight.page}"]`,
    );
    if (!(pageElement instanceof HTMLElement)) {
      continue;
    }

    const canvas = pageElement.querySelector("canvas");
    if (!(canvas instanceof HTMLCanvasElement) || canvas.clientWidth <= 0 || canvas.clientHeight <= 0) {
      continue;
    }

    const sizePt = getPageSizePt(highlight.page);
    if (!sizePt || sizePt.width <= 0 || sizePt.height <= 0) {
      continue;
    }

    const pageBounds = pageElement.getBoundingClientRect();
    const canvasBounds = canvas.getBoundingClientRect();
    const canvasOffsetLeft = canvasBounds.left - pageBounds.left;
    const canvasOffsetTop = canvasBounds.top - pageBounds.top;
    const scaleX = canvas.clientWidth / sizePt.width;
    const scaleY = canvas.clientHeight / sizePt.height;
    const left = canvasOffsetLeft + (highlight.h * scaleX);
    const topPt = Math.max(0, sizePt.height - highlight.v - highlight.height);
    const top = canvasOffsetTop + (topPt * scaleY);
    const width = Math.max(highlight.width * scaleX, 20);
    const height = Math.max(highlight.height * scaleY, 8);

    const overlay = document.createElement("div");
    overlay.className = "synctex-highlight";
    Object.assign(overlay.style, {
      position: "absolute",
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
      background: "rgba(255, 220, 0, 0.35)",
      border: "2px solid rgba(255, 180, 0, 0.65)",
      borderRadius: "3px",
      pointerEvents: "none",
      zIndex: "12",
      opacity: "1",
      transition: `opacity ${FADE_TRANSITION_MS}ms ease-out`,
    } satisfies Partial<CSSStyleDeclaration>);

    pageElement.style.position = "relative";
    pageElement.appendChild(overlay);

    timers.push(
      window.setTimeout(() => {
        overlay.style.opacity = "0";
      }, FADE_DURATION_MS - FADE_TRANSITION_MS),
    );
    timers.push(
      window.setTimeout(() => {
        overlay.remove();
      }, FADE_DURATION_MS),
    );
  }

  return {
    clear() {
      timers.forEach((timer) => window.clearTimeout(timer));
      viewerElement.querySelectorAll(".synctex-highlight").forEach((node) => node.remove());
    },
  };
}
