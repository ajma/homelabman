import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-xl text-[13px] font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40',
  {
    variants: {
      variant: {
        // Primary: solid blue fill, dark text
        default: 'bg-[#649ef5] text-[#101827] hover:bg-[#7db0ff]',
        // Destructive: dark red glass
        destructive:
          'bg-[rgba(127,29,29,0.20)] text-[rgba(254,202,202,0.92)] border border-[rgba(248,113,113,0.36)] hover:bg-[rgba(127,29,29,0.30)] hover:border-[rgba(248,113,113,0.52)]',
        // Outline: blue border, blue text, subtle hover fill
        outline:
          'border border-[rgba(100,158,245,0.4)] text-[#7db0ff] hover:bg-[rgba(100,158,245,0.08)]',
        // Secondary: ghost glass with white border
        secondary:
          'bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.07)] text-[rgba(255,255,255,0.45)] hover:bg-[rgba(255,255,255,0.07)] hover:text-[rgba(255,255,255,0.6)] hover:border-[rgba(255,255,255,0.12)]',
        // Ghost: text only, subtle hover
        ghost: 'text-[rgba(255,255,255,0.4)] hover:text-[rgba(255,255,255,0.65)] hover:bg-[rgba(255,255,255,0.04)]',
        // Link: blue text underline
        link: 'text-[#7db0ff] underline-offset-4 hover:text-[#9cc3ff] hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-lg px-3 text-[12px]',
        lg: 'h-10 px-6',
        icon: 'h-9 w-9 rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
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
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
