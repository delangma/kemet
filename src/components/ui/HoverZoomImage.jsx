import { useCallback, useRef, useState } from "react";

const HOVER_DELAY_MS = 500;
const ZOOM_SCALE = 2;
const VIEWPORT_MARGIN = 10;
const TOUCH_MOVE_TOLERANCE = 10;

// Enveloppe une petite image (tuile pouvoir, carte ID, carte de combat) et affiche
// un aperçu agrandi (x2, bordure dorée) ancré à côté d'elle après 500ms de survol
// (souris) ou d'appui (tactile), jusqu'à ce que le curseur/doigt quitte la
// miniature d'origine (peu importe où il va ensuite).
export default function HoverZoomImage({ src, alt = "", className = "", style, children }) {
  const [zoom, setZoom] = useState(null);
  const timerRef = useRef(null);
  const wrapperRef = useRef(null);
  const touchStartRef = useRef(null);
  const zoomShownOnTouchRef = useRef(false);

  const showZoomAfterDelay = useCallback(() => {
    if (!src) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      const maxWidth = window.innerWidth - VIEWPORT_MARGIN * 2;
      const width = Math.min(rect.width * ZOOM_SCALE, maxWidth);
      const estimatedHeight = rect.height > 0 ? width * (rect.height / rect.width) : width * 1.5;
      const spaceRight = window.innerWidth - rect.right;
      const spaceLeft = rect.left;
      const left = (spaceRight >= width + VIEWPORT_MARGIN || spaceRight >= spaceLeft)
        ? Math.min(rect.right + VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN)
        : Math.max(VIEWPORT_MARGIN, rect.left - width - VIEWPORT_MARGIN);
      const top = Math.min(
        Math.max(VIEWPORT_MARGIN, rect.top),
        Math.max(VIEWPORT_MARGIN, window.innerHeight - estimatedHeight - VIEWPORT_MARGIN)
      );
      setZoom({ left, top, width });
      zoomShownOnTouchRef.current = true;
    }, HOVER_DELAY_MS);
  }, [src]);

  const hideZoom = useCallback(() => {
    clearTimeout(timerRef.current);
    setZoom(null);
  }, []);

  const handleTouchStart = useCallback(e => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
    zoomShownOnTouchRef.current = false;
    showZoomAfterDelay();
  }, [showZoomAfterDelay]);

  const handleTouchMove = useCallback(e => {
    const start = touchStartRef.current;
    if (!start) return;
    const t = e.touches[0];
    const dx = Math.abs(t.clientX - start.x);
    const dy = Math.abs(t.clientY - start.y);
    if (dx > TOUCH_MOVE_TOLERANCE || dy > TOUCH_MOVE_TOLERANCE) hideZoom();
  }, [hideZoom]);

  const handleTouchEnd = useCallback(e => {
    if (zoomShownOnTouchRef.current) {
      // Appui long déjà utilisé pour l'aperçu : on évite de déclencher aussi
      // la sélection de la carte (clic) au relâchement du doigt.
      e.preventDefault();
    }
    hideZoom();
  }, [hideZoom]);

  return (
    <div
      ref={wrapperRef}
      className={className}
      style={style}
      onMouseEnter={showZoomAfterDelay}
      onMouseLeave={hideZoom}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={hideZoom}
    >
      {children}
      {zoom && (
        <div
          className="fixed z-[300] pointer-events-none rounded-xl shadow-[0_0_24px_rgba(0,0,0,0.6)] border-[3px] border-amber-400 bg-gray-950/95 p-1.5"
          style={{ left: zoom.left, top: zoom.top, width: zoom.width }}
        >
          <img src={src} alt={alt} className="w-full h-auto object-contain rounded-lg" draggable={false} />
        </div>
      )}
    </div>
  );
}
