import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 rounded-2xl",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-md",
        outline: "border border-border bg-background/50 backdrop-blur-sm hover:bg-accent/50 hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm",
        ghost: "hover:bg-accent/50 hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        glass: "bg-[var(--glass-medium)] backdrop-blur-2xl border border-[var(--glass-border)] text-foreground hover:bg-[var(--glass-hover)] hover:border-white/15 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]",
        "glass-primary": "bg-primary/10 backdrop-blur-2xl border border-primary/20 text-primary-foreground hover:bg-primary/20 hover:border-primary/30 shadow-lg shadow-primary/10 hover:shadow-xl hover:shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]",
        "glass-success": "bg-[hsl(var(--success))]/10 backdrop-blur-2xl border border-[hsl(var(--success))]/20 text-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/20 hover:border-[hsl(var(--success))]/30 shadow-lg shadow-[hsl(var(--success))]/10 hover:shadow-xl hover:shadow-[hsl(var(--success))]/20 hover:scale-[1.02] active:scale-[0.98]",
        "glass-danger": "bg-destructive/10 backdrop-blur-2xl border border-destructive/20 text-destructive hover:bg-destructive/20 hover:border-destructive/30 shadow-lg shadow-destructive/10 hover:shadow-xl hover:shadow-destructive/20 hover:scale-[1.02] active:scale-[0.98]",
        "glass-white": "bg-white/10 backdrop-blur-2xl border border-white/20 text-white hover:bg-white/15 hover:border-white/30 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]",
        white: "bg-white text-black hover:bg-white/90 border border-white/80 shadow-lg hover:shadow-xl",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 rounded-xl px-4",
        lg: "h-12 rounded-2xl px-8",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
