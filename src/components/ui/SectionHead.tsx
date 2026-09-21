import Reveal from "./Reveal";

/**
 * The BX poster masthead: a lime rule, a letterspaced kicker, then a heavy
 * display line with one phrase dropped to lime.
 */
export default function SectionHead({
  kicker,
  title,
  accent,
  copy,
  align = "left",
}: {
  kicker: string;
  title: string;
  accent?: string;
  copy?: string;
  align?: "left" | "center";
}) {
  return (
    <Reveal className={align === "center" ? "text-center" : ""}>
      <div
        className={`flex items-center gap-3 ${align === "center" ? "justify-center" : ""}`}
      >
        <span className="h-px w-8 bg-lime" />
        <span className="kicker">{kicker}</span>
      </div>
      <h2 className="font-display mt-5 text-[2.25rem] leading-[0.95] sm:text-5xl lg:text-6xl">
        {title}
        {accent && <span className="text-lime"> {accent}</span>}
      </h2>
      {copy && (
        <p
          className={`mt-5 max-w-xl text-[0.95rem] leading-relaxed text-grey ${
            align === "center" ? "mx-auto" : ""
          }`}
        >
          {copy}
        </p>
      )}
    </Reveal>
  );
}
