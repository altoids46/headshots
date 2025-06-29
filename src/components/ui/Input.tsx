import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  fullWidth?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, fullWidth = true, className = '', ...props }, ref) => {
    const baseInputClasses = 'block w-full px-4 py-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-offset-1 transition-colors';
    
    const inputClasses = error
      ? `${baseInputClasses} border-error-400 focus:border-error-500 focus:ring-error-300 text-error-900 placeholder:text-error-300`
      : `${baseInputClasses} border-gray-300 focus:border-primary-500 focus:ring-primary-300`;
    
    const widthClass = fullWidth ? 'w-full' : '';
    
    return (
      <div className={`mb-4 ${widthClass}`}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`${inputClasses} ${className}`}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-error-600 animate-fade-in">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;