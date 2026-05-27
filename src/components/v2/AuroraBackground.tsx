/**
 * v2 page backdrop — 4 warm-toned blurred blobs over the canvas color.
 * Renders as `position: fixed` at z-index -10, so it sits behind page content
 * but on top of the layout's v1 AI rings. Drop one of these at the top of any
 * v2 page to switch the visual environment from blue/indigo to warm earthy.
 */
export function AuroraBackground() {
  return (
    <div className="aurora-bg" aria-hidden="true">
      <div className="aurora-blob aurora-1" />
      <div className="aurora-blob aurora-2" />
      <div className="aurora-blob aurora-3" />
      <div className="aurora-blob aurora-4" />
      <div className="aurora-noise" />
    </div>
  );
}
