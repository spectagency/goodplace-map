import { ReactNode, ButtonHTMLAttributes } from 'react';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  children: ReactNode;
  href?: string;
  variant?: 'spotify' | 'youtube' | 'vimeo' | 'secondary';
  className?: string;
  fullWidth?: boolean;
}

const variantStyles = {
  spotify: 'bg-[#60977F] hover:bg-[#4a7a65] text-white',
  youtube: 'bg-[#FF0000] hover:bg-[#cc0000] text-white',
  vimeo: 'bg-[#1AB7EA] hover:bg-[#1397c2] text-white',
  secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-800',
};

export function Button({
  children,
  onClick,
  href,
  variant = 'secondary',
  className = '',
  fullWidth = false,
  ...rest
}: ButtonProps) {
  const baseClasses = `
    inline-flex items-center justify-center gap-2
    px-4 py-3 rounded-full
    font-semibold text-sm
    transition-colors
    ${fullWidth ? 'w-full' : ''}
    ${variantStyles[variant]}
    ${className}
  `;

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={baseClasses}
      >
        {children}
      </a>
    );
  }

  return (
    <button onClick={onClick} className={baseClasses} {...rest}>
      {children}
    </button>
  );
}

// Spotify icon component
export function SpotifyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}

// YouTube icon component
export function YouTubeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

// Vimeo icon component
export function VimeoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.977 6.416c-.105 2.338-1.739 5.543-4.894 9.609C15.906 19.988 13.118 22 10.814 22c-1.427 0-2.634-1.317-3.622-3.953-.659-2.418-1.317-4.835-1.977-7.252-.732-2.636-1.518-3.953-2.359-3.953-.183 0-.823.385-1.922 1.153L0 6.813c1.21-1.063 2.402-2.128 3.577-3.19C5.17 2.175 6.363 1.468 7.127 1.407c1.872-.18 3.023 1.1 3.454 3.84.465 2.955.787 4.793.97 5.516.538 2.447 1.13 3.671 1.774 3.671.502 0 1.256-.794 2.264-2.383 1.004-1.589 1.543-2.798 1.617-3.628.144-1.372-.396-2.058-1.617-2.058-.576 0-1.169.131-1.781.397 1.183-3.871 3.441-5.751 6.776-5.637 2.473.068 3.64 1.674 3.493 4.491z" />
    </svg>
  );
}
