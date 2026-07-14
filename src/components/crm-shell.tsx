"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  Building2,
  CheckSquare2,
  ChevronLeft,
  Columns3,
  ContactRound,
  FileInput,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PanelLeftOpen,
  ReceiptText,
  Search,
  Settings2,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEventHandler,
  type ReactNode,
} from "react";

import { BrandLogo } from "./brand-logo";
import { cx } from "./ui/cx";

export interface NavigationItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const crmNavigation: NavigationItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Empreses", href: "/companies", icon: Building2 },
  { label: "Contactes", href: "/contacts", icon: ContactRound },
  { label: "Pipeline", href: "/pipeline", icon: Columns3 },
  { label: "Formularis", href: "/forms", icon: FileInput },
  { label: "Tasques", href: "/tasks", icon: CheckSquare2 },
  { label: "Productes", href: "/products", icon: Package },
  { label: "Pressupostos", href: "/quotes", icon: FileText },
  { label: "Factures", href: "/invoices", icon: ReceiptText },
  { label: "Activitat", href: "/activity", icon: Activity },
  { label: "Configuració", href: "/settings", icon: Settings2 },
];

export interface CrmShellProps {
  children: ReactNode;
  organization: {
    name: string;
  };
  user: {
    name?: string | null;
    email: string;
  };
  pendingTasks?: number;
  searchPath?: string;
  signOutAction?: (formData: FormData) => void | Promise<void>;
}

function getInitials(name: string | null | undefined, email: string): string {
  const source = name?.trim() || email.split("@")[0] || "AU";
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function isItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const mobileSidebarQuery = "(max-width: 960px)";

function subscribeToMobileViewport(callback: () => void): () => void {
  const media = window.matchMedia(mobileSidebarQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function getMobileViewportSnapshot(): boolean {
  return window.matchMedia(mobileSidebarQuery).matches;
}

function getServerMobileViewportSnapshot(): boolean {
  return false;
}

export function CrmShell({
  children,
  organization,
  user,
  pendingTasks = 0,
  searchPath = "/search",
  signOutAction,
}: CrmShellProps) {
  const pathname = usePathname();
  const sidebarId = useId();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuCloseButtonRef = useRef<HTMLButtonElement>(null);
  const isMobileViewport = useSyncExternalStore(
    subscribeToMobileViewport,
    getMobileViewportSnapshot,
    getServerMobileViewportSnapshot,
  );

  const closeMobileMenu = useCallback((restoreFocus = true) => {
    if (restoreFocus && getMobileViewportSnapshot()) {
      mobileMenuButtonRef.current?.focus({ preventScroll: true });
    }
    setMobileOpen(false);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMobileMenu();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [closeMobileMenu, mobileOpen]);

  useEffect(() => {
    if (mobileOpen) mobileMenuCloseButtonRef.current?.focus();
  }, [mobileOpen]);

  useEffect(() => {
    const media = window.matchMedia(mobileSidebarQuery);
    const closeAfterDesktopResize = (event: MediaQueryListEvent) => {
      if (!event.matches) setMobileOpen(false);
    };
    media.addEventListener("change", closeAfterDesktopResize);
    return () => media.removeEventListener("change", closeAfterDesktopResize);
  }, []);

  useEffect(() => {
    const focusGlobalSearch = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;
      if (event.key === "/" && !isTyping && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        document.querySelector<HTMLInputElement>("#crm-global-search")?.focus();
      }
    };
    document.addEventListener("keydown", focusGlobalSearch);
    return () => document.removeEventListener("keydown", focusGlobalSearch);
  }, []);

  const displayName = user.name?.trim() || user.email;
  const initials = useMemo(() => getInitials(user.name, user.email), [user.email, user.name]);
  const taskLabel = pendingTasks === 1 ? "1 tasca pendent" : `${pendingTasks} tasques pendents`;

  const toggleCollapsed = () => {
    setCollapsed((current) => !current);
  };

  const preventMissingSignOut: FormEventHandler<HTMLFormElement> | undefined = signOutAction
    ? undefined
    : (event) => event.preventDefault();

  return (
    <div className="crm-shell" data-sidebar-collapsed={collapsed ? "true" : "false"}>
      <a className="skip-link" href="#contingut-principal">
        Salta al contingut principal
      </a>
      <button
        type="button"
        className={cx("crm-sidebar-overlay", mobileOpen ? "is-visible" : undefined)}
        aria-label="Tanca el menú"
        tabIndex={mobileOpen ? 0 : -1}
        onClick={() => closeMobileMenu()}
      />

      <aside
        id={sidebarId}
        className={cx("crm-sidebar", mobileOpen ? "is-mobile-open" : undefined)}
        aria-label="Navegació principal"
        aria-hidden={isMobileViewport && !mobileOpen ? true : undefined}
        inert={isMobileViewport && !mobileOpen}
      >
        <div className="crm-sidebar__brand">
          <Link
            href="/dashboard"
            aria-label="AImetos CRM — Dashboard"
            onClick={() => closeMobileMenu()}
          >
            <BrandLogo priority />
          </Link>
          <button
            ref={mobileMenuCloseButtonRef}
            type="button"
            className="crm-sidebar__mobile-close"
            onClick={() => closeMobileMenu()}
            aria-label="Tanca el menú"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>

        <nav className="crm-sidebar__nav" aria-label="Seccions del CRM">
          <ul>
            {crmNavigation.map((item) => {
              const Icon = item.icon;
              const active = isItemActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cx("crm-nav-link", active ? "is-active" : undefined)}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                    onClick={() => closeMobileMenu()}
                  >
                    <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="crm-sidebar__footer">
          <div className="crm-sidebar__organization" title={organization.name}>
            <span className="crm-sidebar__organization-mark" aria-hidden="true">
              {organization.name.charAt(0).toUpperCase()}
            </span>
            <span>
              <small>Organització</small>
              <strong>{organization.name}</strong>
            </span>
          </div>
          <button
            type="button"
            className="crm-sidebar__collapse"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Amplia la barra lateral" : "Contreu la barra lateral"}
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <PanelLeftOpen size={18} aria-hidden="true" />
            ) : (
              <ChevronLeft size={18} aria-hidden="true" />
            )}
            <span>{collapsed ? "Amplia" : "Contreu la barra"}</span>
          </button>
        </div>
      </aside>

      <div className="crm-workspace">
        <header className="crm-topbar">
          <div className="crm-topbar__mobile-brand">
            <button
              ref={mobileMenuButtonRef}
              type="button"
              className="crm-icon-button"
              onClick={() => setMobileOpen(true)}
              aria-label="Obre el menú"
              aria-controls={sidebarId}
              aria-expanded={mobileOpen}
            >
              <Menu size={20} aria-hidden="true" />
            </button>
            <BrandLogo compact />
          </div>

          <form className="crm-global-search" action={searchPath} role="search">
            <Search size={18} aria-hidden="true" />
            <label className="sr-only" htmlFor="crm-global-search">
              Cerca global
            </label>
            <input
              id="crm-global-search"
              type="search"
              name="q"
              placeholder="Cerca empreses, contactes, oportunitats…"
              autoComplete="off"
            />
            <kbd aria-hidden="true">/</kbd>
          </form>

          <div className="crm-topbar__actions">
            <Link
              href="/tasks?view=pending"
              className="crm-icon-button crm-task-button"
              aria-label={taskLabel}
              title={taskLabel}
            >
              <Bell size={19} aria-hidden="true" />
              {pendingTasks > 0 ? (
                <span className="crm-task-button__count" aria-hidden="true">
                  {pendingTasks > 99 ? "99+" : pendingTasks}
                </span>
              ) : null}
            </Link>

            <div className="crm-topbar__organization">
              <Building2 size={16} aria-hidden="true" />
              <span>{organization.name}</span>
            </div>

            <div className="crm-user-chip" title={user.email}>
              <span className="crm-user-chip__avatar" aria-hidden="true">
                {initials}
              </span>
              <span className="crm-user-chip__copy">
                <strong>{displayName}</strong>
                <small>{user.email}</small>
              </span>
            </div>

            <form action={signOutAction} onSubmit={preventMissingSignOut}>
              <button
                type="submit"
                className="crm-icon-button"
                aria-label="Tanca la sessió"
                title="Tanca la sessió"
                disabled={!signOutAction}
              >
                <LogOut size={18} aria-hidden="true" />
              </button>
            </form>
          </div>
        </header>

        <main className="crm-main" id="contingut-principal" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
