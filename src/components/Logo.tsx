import Image from "next/image";

/** Logo CarsDuel (public/logo.svg, carré). `size` en px. */
export function Logo({ size = 40, className }: { size?: number; className?: string }) {
  return <Image src="/logo.svg" alt="CarsDuel" width={size} height={size} priority className={className} unoptimized />;
}
