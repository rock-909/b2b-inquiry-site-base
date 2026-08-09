import * as React from "react";
import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn("surface-card flex flex-col gap-6 py-6", className)}
      {...props}
    />
  );
}

export { Card };
