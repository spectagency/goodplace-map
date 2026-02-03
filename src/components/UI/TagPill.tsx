interface TagPillProps {
  name: string;
  size?: 'small' | 'default';
}

export function TagPill({ name, size = 'default' }: TagPillProps) {
  const sizeClasses = size === 'small'
    ? 'px-2 py-0.5 text-[11px]'
    : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-block ${sizeClasses} bg-[#60977F]/10 text-gray-700 rounded-[12px] font-semibold uppercase tracking-wide`}
    >
      {name}
    </span>
  );
}
