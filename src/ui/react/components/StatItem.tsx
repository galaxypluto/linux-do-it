import * as React from "react";
import { cn } from "../lib/cn";
import { compactNumber } from "../../format";

type StatItemProps = {
  icon: string;
  value: number;
  label: string;
  className?: string;
};

export function StatItem({ icon, value, label, className }: StatItemProps): React.ReactElement {
  return (
    <span className={cn("ldcv-stat", className)} title={`${compactNumber(value)} ${label}`}>
      <span className="ldcv-stat__icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: icon }} />
      <span className="ldcv-stat__value">{compactNumber(value)}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
