import React from 'react';
import { Loader2 } from 'lucide-react';

const LoadingScreen: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <Loader2 className="h-12 w-12 text-primary-600 animate-spin" />
      <h2 className="mt-4 text-xl font-semibold text-gray-700">Loading...</h2>
      <p className="mt-2 text-sm text-gray-500">Please wait while we prepare your experience</p>
    </div>
  );
};

export default LoadingScreen;