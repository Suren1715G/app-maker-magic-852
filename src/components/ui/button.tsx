import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold tracking-tight ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.97] overflow-hidden before:pointer-events-none before:absolute before:inset-0 before:rounded-full before:bg-gradient-to-b before:from-white/15 before:to-transparent before:opacity-80",
  {
    variants: {
      variant: {
        default:
          "text-primary-foreground border border-white/15 shadow-[0_8px_24px_-6px_hsl(280_90%_50%/0.55),inset_0_1px_0_hsl(0_0%_100%/0.25)] [background-image:linear-gradient(135deg,hsl(320_95%_65%)_0%,hsl(280_90%_60%)_45%,hsl(260_85%_55%)_100%)] hover:brightness-110 hover:shadow-[0_10px_30px_-6px_hsl(280_90%_55%/0.7),inset_0_1px_0_hsl(0_0%_100%/0.3)]",
        destructive:
          "text-destructive-foreground border border-white/15 shadow-[0_8px_24px_-6px_hsl(0_72%_50%/0.55),inset_0_1px_0_hsl(0_0%_100%/0.25)] [background-image:linear-gradient(135deg,hsl(10_95%_65%)_0%,hsl(0_85%_55%)_100%)] hover:brightness-110",
        outline:
          "text-foreground border border-white/15 bg-[hsl(280_30%_8%/0.55)] backdrop-blur-xl shadow-[inset_0_1px_0_hsl(0_0%_100%/0.12),0_4px_16px_-4px_hsl(0_0%_0%/0.5)] hover:bg-[hsl(280_30%_12%/0.7)] hover:border-white/25",
        secondary:
          "text-foreground border border-white/10 bg-[hsl(280_30%_10%/0.6)] backdrop-blur-xl shadow-[inset_0_1px_0_hsl(0_0%_100%/0.1),0_4px_16px_-4px_hsl(0_0%_0%/0.5)] hover:bg-[hsl(280_30%_14%/0.75)]",
        ghost:
          "before:hidden text-foreground hover:bg-white/5 hover:backdrop-blur-xl",
        link: "before:hidden text-primary underline-offset-4 hover:underline rounded-md",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 px-4",
        lg: "h-12 px-8 text-[15px]",
        icon: "h-10 w-10",
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
