// Componentes UI reutilizáveis

import { ReactNode } from 'react';

// Button Component
interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Button = ({ 
  children, 
  onClick, 
  disabled = false, 
  variant = 'primary', 
  size = 'md',
  className = '' 
}: ButtonProps) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variantClasses = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-500 focus:ring-indigo-500',
    secondary: 'bg-gray-600 text-white hover:bg-gray-500 focus:ring-gray-500',
    danger: 'bg-red-600 text-white hover:bg-red-500 focus:ring-red-500',
    success: 'bg-green-600 text-white hover:bg-green-500 focus:ring-green-500'
  };
  
  const sizeClasses = {
    sm: 'px-3 py-1 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };
  
  const disabledClasses = 'disabled:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50';
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${disabledClasses} ${className}`}
    >
      {children}
    </button>
  );
};

// Input Component
interface InputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'url' | 'number';
  disabled?: boolean;
  className?: string;
  min?: number;
  max?: number;
  onKeyPress?: (e: React.KeyboardEvent) => void;
}

export const Input = ({
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled = false,
  className = '',
  min,
  max,
  onKeyPress
}: InputProps) => {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      min={min}
      max={max}
      onKeyPress={onKeyPress}
      className={`bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${className}`}
    />
  );
};

// Textarea Component
interface TextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  rows?: number;
  className?: string;
  onClick?: () => void;
}

export const Textarea = ({
  value,
  onChange,
  placeholder,
  disabled = false,
  readOnly = false,
  rows = 3,
  className = '',
  onClick
}: TextareaProps) => {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      readOnly={readOnly}
      rows={rows}
      onClick={onClick}
      className={`bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none ${className}`}
    />
  );
};

// Status Indicator Component
interface StatusIndicatorProps {
  isOnline: boolean;
  size?: 'sm' | 'md';
  showText?: boolean;
}

export const StatusIndicator = ({ isOnline, size = 'md', showText = false }: StatusIndicatorProps) => {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3'
  };
  
  return (
    <div className="flex items-center gap-1">
      <div 
        className={`rounded-full ${sizeClasses[size]} ${isOnline ? 'bg-green-500' : 'bg-gray-500'}`}
        title={isOnline ? 'Online' : 'Offline'}
      />
      {showText && (
        <span className="text-xs text-gray-400">
          {isOnline ? 'Online' : 'Offline'}
        </span>
      )}
    </div>
  );
};

// Loading Spinner Component
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingSpinner = ({ size = 'md', className = '' }: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };
  
  return (
    <div className={`animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600 ${sizeClasses[size]} ${className}`} />
  );
};

// Card Component
interface CardProps {
  children: ReactNode;
  className?: string;
}

export const Card = ({ children, className = '' }: CardProps) => {
  return (
    <div className={`bg-gray-800 rounded-lg p-4 border border-gray-700 ${className}`}>
      {children}
    </div>
  );
};

// Badge Component
interface BadgeProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  className?: string;
}

export const Badge = ({ children, variant = 'primary', className = '' }: BadgeProps) => {
  const variantClasses = {
    primary: 'bg-indigo-600 text-white',
    secondary: 'bg-gray-600 text-white',
    success: 'bg-green-600 text-white', 
    warning: 'bg-yellow-600 text-white',
    danger: 'bg-red-600 text-white'
  };
  
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
};