import { useId } from 'react';

export function Field({
  label,
  help,
  error,
  children,
}: {
  label: string;
  help?: string;
  error?: string;
  children: (props: { id: string; 'aria-describedby': string | undefined }) => React.ReactNode;
}) {
  const id = useId();
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      {help ? (
        <p id={helpId} className="text-[15px] text-tinta-60">
          {help}
        </p>
      ) : null}
      {children({ id, 'aria-describedby': describedBy })}
      {error ? (
        <p id={errorId} role="alert" className="text-[15px] text-aviso">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const inputClass =
  'tap w-full rounded-[4px] border border-borde bg-linea px-3 py-2.5 text-[16px] ' +
  'text-tinta placeholder:text-tinta-60/70 focus:border-pista';
