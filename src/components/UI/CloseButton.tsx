interface CloseButtonProps {
  onClick: () => void;
  variant?: 'default' | 'overlay';
  className?: string;
}

export function CloseButton({ onClick, variant = 'default', className = '' }: CloseButtonProps) {
  const variantClasses = variant === 'overlay'
    ? 'bg-black/50 text-white hover:bg-black/70'
    : 'bg-gray-100 text-gray-600 hover:bg-gray-200';

  return (
    <button
      onClick={onClick}
      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${variantClasses} ${className}`}
      aria-label="Close"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  );
}
