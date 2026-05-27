import Link from "next/link";
import { Fragment } from "react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

/**
 * Top breadcrumb trail. Items without `href` render as the current page (no link).
 *   <Breadcrumb items={[{ label: "Sensei", href: "/" }, { label: "Analisis Foto" }]} />
 */
export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <div className="breadcrumbs">
      {items.map((it, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="bc-sep">/</span>}
          {it.href ? (
            <Link className="bc-link" href={it.href}>{it.label}</Link>
          ) : (
            <span className="bc-current">{it.label}</span>
          )}
        </Fragment>
      ))}
    </div>
  );
}
