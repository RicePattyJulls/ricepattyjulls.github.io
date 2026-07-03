/* Dims the fixed WebGL scene on reading pages so text stays legible.
   Sits between the canvas (z-0) and the page content (z-10). The core stays
   as a faint ambient hint instead of a bright wash behind the copy. */
export function PageBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[1]"
      style={{
        background:
          "radial-gradient(135% 100% at 50% 36%, rgba(5,6,10,0.90), rgba(5,6,10,0.97) 82%)",
      }}
    />
  );
}
