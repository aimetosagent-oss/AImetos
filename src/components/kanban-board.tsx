"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Building2,
  CalendarDays,
  CircleUserRound,
  GripVertical,
  Layers3,
  RefreshCw,
  X,
} from "lucide-react";
import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
} from "react";

import { Button } from "./ui/button";
import { cx } from "./ui/cx";

export type KanbanStageKind = "OPEN" | "WON" | "LOST";

export interface KanbanStage {
  id: string;
  name: string;
  kind?: KanbanStageKind;
  color?: string;
}

export interface KanbanOpportunity {
  id: string;
  title: string;
  stageId: string;
  companyName?: string | null;
  contactName?: string | null;
  valueCents: number;
  currency?: string;
  probability?: number | null;
  ownerName?: string | null;
  expectedCloseDate?: string | null;
  href?: string;
}

export interface KanbanBoardProps {
  stages: KanbanStage[];
  opportunities: KanbanOpportunity[];
  stageChangeBaseUrl?: string;
  locale?: string;
}

interface PendingLostMove {
  opportunityId: string;
  destinationStageId: string;
}

function isLostStage(stage: KanbanStage): boolean {
  return stage.kind === "LOST" || stage.name.trim().toLocaleLowerCase("ca").includes("perdut");
}

function formatMoney(valueCents: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(valueCents / 100);
}

function formatDate(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function KanbanBoard({
  stages,
  opportunities,
  stageChangeBaseUrl = "/api/opportunities",
  locale = "ca-ES",
}: KanbanBoardProps) {
  const router = useRouter();
  const [items, setItems] = useState(opportunities);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [lostMove, setLostMove] = useState<PendingLostMove | null>(null);
  const [lostReason, setLostReason] = useState("");
  const lostDialogRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Server refreshes can add records or apply filters after the board has mounted.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(opportunities);
  }, [opportunities]);

  useEffect(() => {
    if (!lostMove) return;

    const dialog = lostDialogRef.current;
    const previousBodyOverflow = document.body.style.overflow;
    const focusTarget = previousFocusRef.current;
    document.body.style.overflow = "hidden";

    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setLostMove(null);
        setLostReason("");
        return;
      }

      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("hidden"));

      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleDialogKeyDown);
    return () => {
      document.removeEventListener("keydown", handleDialogKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      window.requestAnimationFrame(() => focusTarget?.focus());
    };
  }, [lostMove]);

  const stageMap = useMemo(() => new Map(stages.map((stage) => [stage.id, stage])), [stages]);

  async function moveOpportunity(
    opportunityId: string,
    destinationStageId: string,
    reason?: string,
  ) {
    const current = items.find((item) => item.id === opportunityId);
    if (!current || current.stageId === destinationStageId || pendingIds.has(opportunityId)) return;

    const previousStageId = current.stageId;
    setError(null);
    setPendingIds((value) => new Set(value).add(opportunityId));
    setItems((value) =>
      value.map((item) =>
        item.id === opportunityId ? { ...item, stageId: destinationStageId } : item,
      ),
    );

    try {
      const response = await fetch(`${stageChangeBaseUrl}/${encodeURIComponent(opportunityId)}/stage`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId: destinationStageId, lostReason: reason || undefined }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string; message?: string }
          | null;
        throw new Error(payload?.message || payload?.error || "No s’ha pogut actualitzar l’etapa.");
      }

      startTransition(() => router.refresh());
    } catch (moveError) {
      setItems((value) =>
        value.map((item) =>
          item.id === opportunityId ? { ...item, stageId: previousStageId } : item,
        ),
      );
      setError(
        moveError instanceof Error
          ? moveError.message
          : "No s’ha pogut actualitzar l’etapa. Torna-ho a provar.",
      );
    } finally {
      setPendingIds((value) => {
        const next = new Set(value);
        next.delete(opportunityId);
        return next;
      });
    }
  }

  function requestMove(opportunityId: string, destinationStageId: string) {
    const stage = stageMap.get(destinationStageId);
    if (!stage) return;
    if (isLostStage(stage)) {
      previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setLostReason("");
      setLostMove({ opportunityId, destinationStageId });
      return;
    }
    void moveOpportunity(opportunityId, destinationStageId);
  }

  function handleDrop(event: DragEvent<HTMLElement>, destinationStageId: string) {
    event.preventDefault();
    const opportunityId = event.dataTransfer.getData("text/plain") || draggedId;
    setDraggedId(null);
    setDragOverStageId(null);
    if (opportunityId) requestMove(opportunityId, destinationStageId);
  }

  function confirmLostMove() {
    if (!lostMove || !lostReason.trim()) return;
    const move = lostMove;
    const reason = lostReason.trim();
    setLostMove(null);
    setLostReason("");
    void moveOpportunity(move.opportunityId, move.destinationStageId, reason);
  }

  return (
    <div className="kanban-region" aria-label="Pipeline comercial">
      {error ? (
        <div className="kanban-alert" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Tanca l’avís">
            <X size={17} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <p className="sr-only" aria-live="polite">
        {pendingIds.size > 0 ? "S’està actualitzant el pipeline." : error ?? ""}
      </p>

      <div className="kanban-board">
        {stages.map((stage) => {
          const stageItems = items.filter((item) => item.stageId === stage.id);
          const total = stageItems.reduce((sum, item) => sum + item.valueCents, 0);
          const currency = stageItems[0]?.currency ?? "EUR";
          const isDropTarget = dragOverStageId === stage.id;
          const style = {
            "--kanban-stage-color": stage.color ?? "#0f7770",
          } as CSSProperties;

          return (
            <section
              key={stage.id}
              className={cx("kanban-column", isDropTarget ? "is-drop-target" : undefined)}
              style={style}
              aria-labelledby={`kanban-stage-${stage.id}`}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragOverStageId(stage.id);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setDragOverStageId(null);
                }
              }}
              onDrop={(event) => handleDrop(event, stage.id)}
            >
              <header className="kanban-column__header">
                <div>
                  <span className="kanban-column__marker" aria-hidden="true" />
                  <h2 id={`kanban-stage-${stage.id}`}>{stage.name}</h2>
                  <span className="kanban-column__count" aria-label={`${stageItems.length} oportunitats`}>
                    {stageItems.length}
                  </span>
                </div>
                <strong>{formatMoney(total, currency, locale)}</strong>
              </header>

              <div className="kanban-column__body">
                {stageItems.length ? (
                  stageItems.map((opportunity) => {
                    const pending = pendingIds.has(opportunity.id);
                    const title = opportunity.href ? (
                      <Link href={opportunity.href}>{opportunity.title}</Link>
                    ) : (
                      opportunity.title
                    );

                    return (
                      <article
                        key={opportunity.id}
                        className={cx(
                          "kanban-card",
                          draggedId === opportunity.id ? "is-dragging" : undefined,
                          pending ? "is-pending" : undefined,
                        )}
                        draggable={!pending}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", opportunity.id);
                          setDraggedId(opportunity.id);
                        }}
                        onDragEnd={() => {
                          setDraggedId(null);
                          setDragOverStageId(null);
                        }}
                      >
                        <div className="kanban-card__heading">
                          <div>
                            <h3>{title}</h3>
                            {opportunity.companyName ? (
                              <span>
                                <Building2 size={14} aria-hidden="true" />
                                {opportunity.companyName}
                              </span>
                            ) : null}
                          </div>
                          {pending ? (
                            <RefreshCw className="kanban-card__spinner" size={16} aria-hidden="true" />
                          ) : (
                            <GripVertical size={17} aria-label="Arrossega per canviar d’etapa" />
                          )}
                        </div>

                        <strong className="kanban-card__value">
                          {formatMoney(opportunity.valueCents, opportunity.currency ?? "EUR", locale)}
                        </strong>

                        <div className="kanban-card__meta">
                          {opportunity.contactName ? (
                            <span>
                              <CircleUserRound size={14} aria-hidden="true" />
                              {opportunity.contactName}
                            </span>
                          ) : null}
                          {opportunity.expectedCloseDate ? (
                            <span>
                              <CalendarDays size={14} aria-hidden="true" />
                              {formatDate(opportunity.expectedCloseDate, locale)}
                            </span>
                          ) : null}
                        </div>

                        <div className="kanban-card__footer">
                          <span>{opportunity.ownerName || "Sense responsable"}</span>
                          {typeof opportunity.probability === "number" ? (
                            <span>{opportunity.probability}%</span>
                          ) : null}
                        </div>

                        <label className="kanban-card__move">
                          <span className="sr-only">Mou {opportunity.title} a una altra etapa</span>
                          <Layers3 size={14} aria-hidden="true" />
                          <select
                            value={opportunity.stageId}
                            disabled={pending}
                            aria-label={`Mou ${opportunity.title} a una altra etapa`}
                            onChange={(event) => requestMove(opportunity.id, event.target.value)}
                          >
                            {stages.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      </article>
                    );
                  })
                ) : (
                  <div className="kanban-column__empty">
                    <Layers3 size={20} strokeWidth={1.6} aria-hidden="true" />
                    <span>Cap oportunitat</span>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {lostMove ? (
        <div className="dialog-backdrop" role="presentation">
          <section
            ref={lostDialogRef}
            className="dialog-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lost-opportunity-title"
            aria-describedby="lost-opportunity-description"
            tabIndex={-1}
          >
            <div className="dialog-card__icon dialog-card__icon--warning">
              <AlertCircle size={21} aria-hidden="true" />
            </div>
            <div className="dialog-card__heading">
              <h2 id="lost-opportunity-title">Marca l’oportunitat com a perduda</h2>
              <p id="lost-opportunity-description">
                Indica el motiu per conservar un historial comercial útil.
              </p>
            </div>
            <label className="form-label" htmlFor="lost-reason">
              Motiu de pèrdua <span className="form-required">*</span>
            </label>
            <textarea
              id="lost-reason"
              className="form-control form-textarea"
              value={lostReason}
              onChange={(event) => setLostReason(event.target.value)}
              rows={4}
              maxLength={500}
              aria-required="true"
              autoFocus
              placeholder="Per exemple: pressupost, calendari o competència…"
            />
            <div className="dialog-card__actions">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setLostMove(null);
                  setLostReason("");
                }}
              >
                Cancel·la
              </Button>
              <Button type="button" variant="danger" disabled={!lostReason.trim()} onClick={confirmLostMove}>
                Marca com a perduda
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
