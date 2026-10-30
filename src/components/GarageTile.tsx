import Link from "next/link";
import type { ReactNode } from "react";
import { TileBody, tileClass } from "@/components/ActionTile";

type Props = {
  href: string;
  title: string;
  text: string;
  image?: string;
  imageFit?: "cover" | "contain";
  /** Pastille optionnelle sous le texte (ex. disponibilité des tirages). */
  badge?: ReactNode;
};

/** Lien-carte du garage. */
export function GarageTile({ href, title, text, image, badge, imageFit }: Props) {
  return (
    <Link href={href} className={tileClass()}>
      <TileBody title={title} text={text} image={image} badge={badge} imageFit={imageFit} />
    </Link>
  );
}
