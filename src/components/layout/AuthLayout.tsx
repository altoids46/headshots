import React from 'react';
import { Camera } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  footer?: React.ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  title,
  subtitle,
  footer,
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full animate-fade-in">
        <div className="text-center mb-8">
          <Link to="/\" className="inline-flex items-center justify-center">
            <div className="bg-primary-600 text-white p-3 rounded-full">
              <Camera size={28} />
            </div>
          </Link>
          <h1 className="mt-6 text-3xl font-bold text-gray-900">{title}</h1>
          {subtitle && (
            <p className="mt-2 text-sm text-gray-600">{subtitle}</p>
          )}
        </div>
        
        <div className="bg-white shadow-xl rounded-xl p-8 animate-slide-up">
          {children}
        </div>
        
        {footer && (
          <div className="mt-6 text-center text-sm">{footer}</div>
        )}
      </div>
    </div>
  );
};

export default AuthLayout;