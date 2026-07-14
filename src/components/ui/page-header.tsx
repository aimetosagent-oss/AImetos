import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  breadcrumbs,
  actions,
}: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header__copy">
        {breadcrumbs?.length ? (
          <nav aria-label="Fil d’Ariadna" className="page-breadcrumbs">
            <ol>
              {breadcrumbs.map((item, index) => (
                <li key={`${item.label}-${index}`}>
                  {index > 0 ? <ChevronRight size={14} aria-hidden="true" /> : null}
                  {item.href ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
        {eyebrow ? <span className="page-header__eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}
