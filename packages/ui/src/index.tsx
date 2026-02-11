import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

export function Button({ children, ...props }: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) {
  return (
    <button
      {...props}
      style={{
        padding: "10px 16px",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--card-border)",
        background: "var(--button-bg)",
        color: "var(--button-text)",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
