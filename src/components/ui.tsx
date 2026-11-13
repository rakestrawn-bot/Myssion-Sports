import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

// Small shared building blocks so every page looks the same.

export function PageTitle({ children, subtitle }: { children: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold">{children}</h1>
      {subtitle && <p className="text-gray-600 dark:text-gray-400">{subtitle}</p>}
    </div>
  );
}

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-md border border-gray-200 p-4 dark:border-gray-800 ${className}`}>
      {children}
    </div>
  );
}

export function Banner({ kind, children }: { kind: "error" | "success" | "warning"; children: ReactNode }) {
  const styles = {
    error: "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100",
    success: "border-green-300 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100",
    warning: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100",
  }[kind];
  return (
    <p role={kind === "error" ? "alert" : "status"} className={`rounded-md border p-3 text-sm ${styles}`}>
      {children}
    </p>
  );
}

export function Label({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium">
      {children}
    </label>
  );
}

export function Input(props: ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={`rounded-md border border-gray-300 bg-transparent px-3 py-2 text-base dark:border-gray-700 ${props.className ?? ""}`}
    />
  );
}

export function Select(props: ComponentProps<"select">) {
  return (
    <select
      {...props}
      className={`rounded-md border border-gray-300 bg-transparent px-3 py-2 text-base dark:border-gray-700 dark:bg-gray-950 ${props.className ?? ""}`}
    />
  );
}

export function Button({
  variant = "primary",
  ...props
}: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "danger" }) {
  const styles = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "border border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900",
    danger: "border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950",
  }[variant];
  return (
    <button
      type="submit"
      {...props}
      className={`rounded-md px-3 py-2 text-sm font-medium ${styles} ${props.className ?? ""}`}
    />
  );
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-blue-700 underline hover:text-blue-900 dark:text-blue-400">
      {children}
    </Link>
  );
}

export function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-gray-600 dark:text-gray-400">
      {items.map((item, i) => (
        <span key={i}>
          {i > 0 && <span className="mx-1">/</span>}
          {item.href ? <TextLink href={item.href}>{item.label}</TextLink> : <span>{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}
