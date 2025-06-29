import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { z } from 'zod';
import AuthLayout from '../components/layout/AuthLayout';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { signInWithEmail, signInWithGoogle } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { checkAuthStatus, error: authError, clearError } = useAuth();
  
  const from = (location.state as any)?.from?.pathname || '/org-home';
  const locationError = (location.state as any)?.error;
  
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
  });
  
  const [errors, setErrors] = useState<Partial<LoginFormData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(locationError || null);

  // Clear location state error after displaying it
  useEffect(() => {
    if (locationError) {
      window.history.replaceState({}, '', location.pathname);
    }
  }, [locationError, location.pathname]);

  // Clear auth context error when component mounts
  useEffect(() => {
    if (authError) {
      clearError();
    }
  }, [authError, clearError]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Clear errors when user types
    if (errors[name as keyof LoginFormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
    
    if (serverError) {
      setServerError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setServerError(null);
    
    try {
      // Validate form data
      loginSchema.parse(formData);
      setErrors({});
      
      setIsLoading(true);
      
      const { error, user } = await signInWithEmail(
        formData.email,
        formData.password
      );
      
      if (error) {
        setServerError(error.message);
        return;
      }
      
      if (user) {
        // Add timeout for auth status check - increased from 15s to 20s
        try {
          await Promise.race([
            checkAuthStatus(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Auth check timeout')), 20000)
            )
          ]);
        } catch (authCheckError) {
          console.warn('⚠️ Login: Auth status check timed out, proceeding anyway');
        }
        
        navigate(from);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Partial<LoginFormData> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as keyof LoginFormData] = err.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        setServerError('An unexpected error occurred');
        console.error('💥 Login: Unexpected error:', error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setServerError(null);
    setIsGoogleLoading(true);
    
    try {
      console.log('🔐 Login: Starting Google OAuth...');
      const { error } = await signInWithGoogle();
      
      if (error) {
        console.error('❌ Login: Google OAuth error:', error);
        setServerError(error.message || 'Google login failed');
        setIsGoogleLoading(false);
      }
      // Note: If successful, the user will be redirected by Google OAuth flow
      // The loading state will be cleared when the component unmounts
    } catch (error: any) {
      console.error('💥 Login: Google login error:', error);
      setServerError('Google login failed. Please try again.');
      setIsGoogleLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your account"
      footer={
        <p>
          Don't have an account?{' '}
          <Link to="/signup" className="font-medium text-primary-600 hover:text-primary-500">
            Sign up
          </Link>
        </p>
      }
    >
      {(serverError || authError) && (
        <div className="mb-6 p-3 bg-error-50 border border-error-200 text-error-700 rounded-md">
          {serverError || authError}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Email Address"
          name="email"
          type="email"
          placeholder="john@company.com"
          value={formData.email}
          onChange={handleChange}
          error={errors.email}
          required
          autoComplete="email"
        />
        
        <Input
          label="Password"
          name="password"
          type="password"
          placeholder="••••••••"
          value={formData.password}
          onChange={handleChange}
          error={errors.password}
          required
          autoComplete="current-password"
        />
        
        <div className="flex justify-end">
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-primary-600 hover:text-primary-500"
          >
            Forgot your password?
          </Link>
        </div>
        
        <Button
          type="submit"
          fullWidth
          isLoading={isLoading}
          className="mt-6"
        >
          Sign In
        </Button>
      </form>

      {/* Divider */}
      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Or continue with</span>
          </div>
        </div>
      </div>

      {/* Google Sign In Button */}
      <div className="mt-6">
        <Button
          type="button"
          variant="outline"
          fullWidth
          isLoading={isGoogleLoading}
          onClick={handleGoogleLogin}
          className="flex items-center justify-center"
        >
          {!isGoogleLoading && (
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          )}
          Sign in with Google
        </Button>
      </div>
    </AuthLayout>
  );
};

export default Login;