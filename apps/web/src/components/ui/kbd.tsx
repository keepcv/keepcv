export function Kbd({ children }: { children: string }) {
  return (
    <kbd className="rounded border border-line bg-surface-sunken px-1.5 py-0.5 font-sans text-[0.6875rem] font-medium text-text-subtle">
      {children}
    </kbd>
  );
}
