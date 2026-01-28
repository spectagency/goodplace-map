interface TagPillProps {
  name: string;
  size?: 'small' | 'default';
}

export function TagPill({ name, size = 'default' }: TagPillProps) {
  const sizeClasses = size === 'small'
    ? 'px-2 py-0.5 text-[10px]'
    : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-block ${sizeClasses} bg-gray-100 text-gray-700 rounded font-semibold uppercase tracking-wide`}
    >
      {name}
    </span>
  );
}
