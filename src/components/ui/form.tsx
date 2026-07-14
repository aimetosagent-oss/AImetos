import { Search } from "lucide-react";
import {
  forwardRef,
  useId,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

import { cx } from "./cx";

export interface FieldProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
  ...props
}: FieldProps) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;

  return (
    <div className={cx("form-field", className)} {...props}>
      <label className="form-label" htmlFor={htmlFor}>
        {label}
        {required ? (
          <>
            <span aria-hidden="true" className="form-required">*</span>
            <span className="sr-only"> (obligatori)</span>
          </>
        ) : null}
      </label>
      {children}
      {hint ? (
        <p className="form-hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="form-error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cx("form-control", className)} {...props} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cx("form-control form-textarea", className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cx("form-control form-select", className)} {...props}>
        {children}
      </select>
    );
  },
);

export interface CheckboxFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  description?: string;
}

export const CheckboxField = forwardRef<HTMLInputElement, CheckboxFieldProps>(
  function CheckboxField({ label, description, className, id, ...props }, ref) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    return (
      <label className={cx("checkbox-field", className)} htmlFor={inputId}>
        <input ref={ref} id={inputId} type="checkbox" {...props} />
        <span className="checkbox-field__copy">
          <span className="checkbox-field__label">{label}</span>
          {description ? <span className="checkbox-field__description">{description}</span> : null}
        </span>
      </label>
    );
  },
);

export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("form-section", className)}>
      <div className="form-section__heading">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      <div className="form-section__content">{children}</div>
    </section>
  );
}

export function FormGrid({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("form-grid", className)} {...props} />;
}

export function FormActions({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("form-actions", className)} {...props} />;
}

export const SearchInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function SearchInput({ className, ...props }, ref) {
    return (
      <div className={cx("search-input", className)}>
        <Search size={17} aria-hidden="true" />
        <input ref={ref} type="search" {...props} />
      </div>
    );
  },
);
