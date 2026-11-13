"use client";

import type { ComponentProps } from "react";
import { Button } from "./ui";

// A submit button that asks "Are you sure?" before deleting something.
export function ConfirmButton({
  message,
  ...props
}: ComponentProps<typeof Button> & { message: string }) {
  return (
    <Button
      {...props}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    />
  );
}
