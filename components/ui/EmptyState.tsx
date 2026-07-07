import type { ReactNode } from "react";

export function EmptyState({
  title,
  children
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-md border border-dashed border-line bg-gray-50 p-6 text-center">
      <h3 className="text-sm font-bold text-ink">{title}</h3>
      {children ? <div className="mt-2 text-sm text-steel">{children}</div> : null}
    </div>
  );
}
