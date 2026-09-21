import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "outline" | "ghost";

const base =
  "inline-flex items-center justify-center gap-2 font-display text-[0.8rem] tracking-[0.12em] px-6 py-3.5 transition-all duration-200 active:scale-[0.98]";

const variants: Record<Variant, string> = {
  primary:
    "bg-lime text-ink hover:bg-white hover:shadow-[0_0_28px_-6px_var(--bx-lime)]",
  outline:
    "border border-line text-white hover:border-lime hover:text-lime",
  ghost: "text-grey hover:text-white",
};

export function Button({
  children,
  href,
  variant = "primary",
  className = "",
  ...rest
}: {
  children: ReactNode;
  href: string;
  variant?: Variant;
  className?: string;
} & Omit<ComponentProps<typeof Link>, "href" | "className">) {
  const cls = `${base} ${variants[variant]} ${className}`;

  // Same-page anchors are plain <a>. next/link does not reliably scroll to a
  // hash on the route it is already on, which is every section link here.
  if (href.startsWith("#")) {
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    );
  }

  const external =
    href.startsWith("http") || href.startsWith("tel:") || href.startsWith("mailto:");

  if (external) {
    return (
      <a
        href={href}
        className={cls}
        {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={cls} {...rest}>
      {children}
    </Link>
  );
}
