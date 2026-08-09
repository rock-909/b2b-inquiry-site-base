import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import {
  buttonVariants,
  type ButtonSize,
  type ButtonVariant,
} from "@/components/ui/button-variants";

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & {
  asChild?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={buttonVariants({ variant, size, className })}
      {...props}
    />
  );
}

export { Button };
