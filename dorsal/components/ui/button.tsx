import { forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'quiet' | 'destructive';

const BASE =
  'tap inline-flex items-center justify-center gap-2 rounded-[4px] px-4 py-2.5 ' +
  'font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-55';

const VARIANTS: Record<Variant, string> = {
  // --pista, not --dorsal: the accent belongs to the dorsal number, and a
  // button shouting as loudly as the identity object leaves no focus.
  primary: 'bg-pista text-linea hover:bg-pista-dark',
  secondary: 'border border-borde bg-linea text-tinta hover:border-pista',
  quiet: 'text-pista underline underline-offset-4 hover:text-tinta',
  destructive: 'border border-aviso bg-linea text-aviso hover:bg-aviso hover:text-linea',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', className = '', type = 'button', ...props },
  ref,
) {
  return (
    <button ref={ref} type={type} className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />
  );
});
