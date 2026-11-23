import Link from "next/link";
import { Card } from "@/components/ui/Card";
import type { Guide } from "@/content/guides";
import s from "./guides.module.css";

/** One guide as a card: kind, headline, one-line summary. Used on /guides and under each guide. */
export function GuideTile({ guide }: { guide: Guide }) {
  return (
    <Link href={`/guides/${guide.slug}`} className="pillFocus">
      <Card className={s.tile}>
        <span className={s.tileKind}>{guide.kind}</span>
        <span className={s.tileTitle}>{guide.h1}</span>
        <span className={s.tileBody}>{guide.intro}</span>
      </Card>
    </Link>
  );
}
