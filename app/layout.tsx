import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./style.css";

export const metadata: Metadata = {
  title: "Campus Bites | Waterloo",
  description: "Find a nearby meal that fits your budget around UW and Laurier.",
};

export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en-CA"><body>{children}</body></html>;
}
