import { Eye } from "lucide-react";
import type { ViewStats as Stats } from "@/lib/view-stats";

/** Visits + visitors, shown publicly. The tooltip is doing real work: the
 * visitor hash rotates daily, so a returning visitor is counted again. */
export function ViewStats({
  stats,
  className,
}: {
  stats: Stats;
  className?: string;
}) {
  return (
    <span
      className={className}
      title="Visitors are counted per day — someone returning on another day counts again. Staff visits are excluded."
    >
      <span className="inline-flex items-center gap-1">
        <Eye className="size-3.5" aria-hidden />
        {stats.views.toLocaleString()} {stats.views === 1 ? "visit" : "visits"}
      </span>
      <span aria-hidden> · </span>
      <span>
        {stats.visitors.toLocaleString()}{" "}
        {stats.visitors === 1 ? "visitor" : "visitors"}
      </span>
    </span>
  );
}
