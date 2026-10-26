import type { Metadata } from "next";
import { DesignGallery } from "./DesignGallery";

export const metadata: Metadata = { title: "Design system", robots: { index: false, follow: false } };

export default function DesignPage() {
  return (
    <main id="main" className="container inset" style={{ paddingBlock: 48 }}>
      <DesignGallery />
    </main>
  );
}
