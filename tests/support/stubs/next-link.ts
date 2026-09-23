/**
 * Link, as the anchor it renders.
 *
 * These tests are about which href the site chooses, not about how Next
 * routes it - and the bug they exist for was the href itself.
 */
import { createElement, type ReactNode } from "react";

export default function Link({
  href,
  children,
  ...rest
}: {
  href: string;
  children?: ReactNode;
} & Record<string, unknown>) {
  return createElement("a", { href, ...rest }, children);
}
