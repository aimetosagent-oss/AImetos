import Image from "next/image";

import { cx } from "./ui/cx";

export function BrandLogo({
  className,
  priority = false,
  compact = false,
}: {
  className?: string;
  priority?: boolean;
  compact?: boolean;
}) {
  return (
    <Image
      src="/brand/logo-web.png"
      alt="AImetos"
      width={186}
      height={50}
      priority={priority}
      className={cx("brand-logo", compact ? "brand-logo--compact" : undefined, className)}
      sizes={compact ? "96px" : "(max-width: 960px) 120px, 150px"}
    />
  );
}
