"use client";

import { useEffect, useRef, useState } from "react";

type Field = {
  id: string;
  label: string;
  name: string;
  type: "TEXT" | "EMAIL" | "PHONE" | "TEXTAREA" | "NUMBER" | "SELECT" | "CHECKBOX" | "HIDDEN";
  required: boolean;
  placeholder: string | null;
  options: unknown;
  defaultValue: string | null;
};

export function PublicForm({ slug, fields, consentText }: { slug: string; fields: Field[]; consentText: string | null }) {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const requestIdRef = useRef<string | null>(null);
  const consentField = consentText
    ? fields.find((field) => field.type === "CHECKBOX" && field.name.toLowerCase() === "consent")
    : undefined;

  useEffect(() => {
    if (status !== "error") return;
    const form = formRef.current;
    const firstInvalidField = form?.querySelector<HTMLElement>('[aria-invalid="true"]');
    const errorSummary = form?.querySelector<HTMLElement>("[data-public-form-error]");
    (firstInvalidField ?? errorSummary)?.focus();
  }, [errors, status]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setStatus("sending");
    setErrors({});
    const formData = new FormData(form);
    const requestId = requestIdRef.current ?? window.crypto.randomUUID();
    requestIdRef.current = requestId;
    const values: Record<string, string | boolean> = {};
    for (const field of fields) {
      values[field.name] = field.type === "CHECKBOX" ? formData.get(field.name) === "on" : String(formData.get(field.name) ?? "");
    }
    values._company_website = String(formData.get("_company_website") ?? "");
    const query = new URLSearchParams(window.location.search);
    try {
      const response = await fetch(`/api/public/forms/${encodeURIComponent(slug)}/submissions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requestId,
          values,
          consentAccepted: consentText
            ? formData.get(consentField?.name ?? "_consentAccepted") === "on"
            : true,
          sourceUrl: document.referrer || window.location.href,
          utm: {
            source: query.get("utm_source"),
            medium: query.get("utm_medium"),
            campaign: query.get("utm_campaign"),
            term: query.get("utm_term"),
            content: query.get("utm_content"),
          },
        }),
      });
      const result = (await response.json()) as { message?: string; redirectUrl?: string; errors?: Record<string, string> };
      if (!response.ok) {
        setErrors(result.errors ?? {});
        throw new Error(result.message ?? "No s’ha pogut enviar el formulari");
      }
      form.reset();
      requestIdRef.current = window.crypto.randomUUID();
      setStatus("success");
      setMessage(result.message ?? "Gràcies. Hem rebut la teva sol·licitud.");
      if (result.redirectUrl) window.setTimeout(() => window.location.assign(result.redirectUrl!), 800);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "No s’ha pogut enviar el formulari");
    }
  }

  if (status === "success") {
    return (
      <div className="public-success" role="status">
        <span aria-hidden="true">✓</span>
        <h2>Sol·licitud rebuda</h2>
        <p>{message}</p>
      </div>
    );
  }

  return (
    <form ref={formRef} className="public-form" onSubmit={submit} noValidate>
      <div className="honeypot" aria-hidden="true">
        <label>
          No emplenis aquest camp
          <input name="_company_website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {fields.map((field) => (
        <FieldControl
          key={field.id}
          field={field}
          error={errors[field.name]}
          label={field.id === consentField?.id ? consentText ?? field.label : undefined}
        />
      ))}
      {consentText && !consentField ? (
        <label className="checkbox-field">
          <input name="_consentAccepted" type="checkbox" required />
          <span>{consentText}</span>
        </label>
      ) : null}
      {status === "error" ? (
        <div
          className="alert alert-error"
          role="alert"
          aria-live="assertive"
          tabIndex={-1}
          data-public-form-error
        >
          {message}
        </div>
      ) : null}
      <button
        className="button button-primary button-full"
        type="submit"
        disabled={status === "sending"}
        aria-busy={status === "sending" || undefined}
      >
        {status === "sending" ? "Enviant…" : "Enviar sol·licitud"}
      </button>
    </form>
  );
}

function FieldControl({ field, error, label }: { field: Field; error?: string; label?: string }) {
  const inputId = `public-field-${field.id}`;
  const errorId = `${inputId}-error`;
  const common = {
    id: inputId,
    name: field.name,
    required: field.required,
    placeholder: field.placeholder ?? undefined,
    defaultValue: field.defaultValue ?? undefined,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? errorId : undefined,
  };
  if (field.type === "HIDDEN") return <input type="hidden" {...common} />;
  if (field.type === "CHECKBOX") {
    return (
      <div className="field-group">
        <label className="checkbox-field" htmlFor={inputId}>
          <input
            id={inputId}
            type="checkbox"
            name={field.name}
            required={field.required}
            defaultChecked={field.defaultValue === "true"}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
          <span>{label ?? field.label}</span>
        </label>
        {error ? (
          <small className="field-error" id={errorId}>
            {error}
          </small>
        ) : null}
      </div>
    );
  }
  return (
    <div className="field-group">
      <label htmlFor={inputId}>
        {field.label} {field.required ? <b aria-label="obligatori">*</b> : null}
      </label>
      {field.type === "TEXTAREA" ? (
        <textarea rows={4} {...common} />
      ) : field.type === "SELECT" ? (
        <select {...common} defaultValue={field.defaultValue ?? ""}>
          <option value="" disabled>
            Selecciona una opció
          </option>
          {(Array.isArray(field.options) ? field.options : []).map((option) => (
            <option key={String(option)} value={String(option)}>
              {String(option)}
            </option>
          ))}
        </select>
      ) : (
        <input type={field.type === "EMAIL" ? "email" : field.type === "PHONE" ? "tel" : field.type === "NUMBER" ? "number" : "text"} {...common} />
      )}
      {error ? (
        <small className="field-error" id={errorId}>
          {error}
        </small>
      ) : null}
    </div>
  );
}
