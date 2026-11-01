import { cn } from "@/lib/utils/cn";

/**
 * Slow-moving light behind the interface. Pure CSS transforms on two blurred
 * fields — composited on the GPU, no JavaScript, and frozen automatically under
 * prefers-reduced-motion (see globals.css).
 */
export function AmbientBackdrop({
  className,
  intensity = "normal",
}: {
  className?: string;
  intensity?: "normal" | "low";
}) {
  const strength = intensity === "low" ? 0.55 : 1;
  return (
    <div aria-hidden className={cn("pointer-events-none fixed inset-0 -z-10 overflow-hidden", className)}>
      <div
        className="absolute -top-[25%] -left-[10%] h-[70vmax] w-[70vmax] animate-drift-a rounded-full blur-3xl will-change-transform"
        style={{
          opacity: 0.32 * strength,
          background: "radial-gradient(circle at center, #2a62e6 0%, transparent 62%)",
        }}
      />
      <div
        className="absolute -right-[15%] -bottom-[30%] h-[65vmax] w-[65vmax] animate-drift-b rounded-full blur-3xl will-change-transform"
        style={{
          opacity: 0.26 * strength,
          background: "radial-gradient(circle at center, #6a4df0 0%, transparent 60%)",
        }}
      />
      {/* Fine grid gives the dark field depth without adding colour. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgb(148 170 255 / 0.035) 1px, transparent 1px), linear-gradient(90deg, rgb(148 170 255 / 0.035) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 30%, black 30%, transparent 85%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 30%, black 30%, transparent 85%)",
        }}
      />
    </div>
  );
}
