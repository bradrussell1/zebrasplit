import Link from "next/link";
import { Card } from "@/components/ui/Card";
import type { Feature } from "@/content/features";
import s from "@/app/guides/guides.module.css";

/** One feature as a card, the same shape as a guide tile. Used under feature pages and guides. */
export function FeatureTile({ feature }: { feature: Feature }) {
  return (
    <Link href={`/features/${feature.slug}`} className="pillFocus">
      <Card className={s.tile}>
        <span className={s.tileKind}>Feature</span>
        <span className={s.tileTitle}>{feature.nav}</span>
        <span className={s.tileBody}>{feature.intro}</span>
      </Card>
    </Link>
  );
}
