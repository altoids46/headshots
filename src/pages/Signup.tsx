import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { z } from 'zod';
import AuthLayout from '../components/layout/AuthLayout';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { signUpWithEmail, signInWithGoogle } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  joinCode: z.string().min(1, 'Join code is required'),
  role: z.string().optional(),
});

type SignupFormData = z.infer<typeof signupSchema>;

const Signup: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { checkAuthStatus } = useAuth();
  
  const locationError = (location.state as any)?.error;
  
  const [formData, setFormData] = useState<SignupFormData>({
    name: '',
    email: '',
    password: '',
    joinCode: '',
    role: '',
  });
  
  const [errors, setErrors] = useState<Partial<SignupFormData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(locationError || null);

  // Clear location state error after displaying it
  useEffect(() => {
    if (locationError) {
      // Clear the error from location state
      window.history.replaceState({}, '', location.pathname);
    }
  }, [locationError, location.pathname]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Clear error when user types
    if (errors[name as keyof SignupFormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
    
    // Clear server error when user makes any changes
    if (serverError) {
      setServerError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setServerError(null);
    
    try {
      // Validate form data
      signupSchema.parse(formData);
      setErrors({});
      
      // Submit form if validation passes
      setIsLoading(true);
      
      const { error, user } = await signUpWithEmail(
        formData.email,
        formData.password,
        formData.name,
        formData.joinCode,
        formData.role || undefined
      );
      
      if (error) {
        setServerError(error.message);
        return;
      }
      
      if (user) {
        await checkAuthStatus();
        navigate('/org-home');
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Partial<SignupFormData> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as keyof SignupFormData] = err.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        setServerError('An unexpected error occurred');
        console.error(error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setServerError(null);
    setIsGoogleLoading(true);
    
    try {
      console.log('🔐 Signup: Starting Google OAuth...');
      const { error } = await signInWithGoogle();
      
      if (error) {
        console.error('❌ Signup: Google OAuth error:', error);
        setServerError(error.message || 'Google sign-up failed');
        setIsGoogleLoading(false);
      }
      // Note: If successful, the user will be redirected by Google OAuth flow to /post-auth
      // The loading state will be cleared when the component unmounts or user returns
    } catch (error) {
      console.error('💥 Signup: Google sign-up error:', error);
      setServerError('Google sign-up failed. Please try again.');
      setIsGoogleLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Join your organization's headshot platform"
      footer={
        <p>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">
            Sign in
          </Link>
        </p>
      }
    >
      {serverError && (
        <div className="mb-6 p-3 bg-error-50 border border-error-200 text-error-700 rounded-md">
          {serverError}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Full Name"
          name="name"
          type="text"
          placeholder="John Smith"
          value={formData.name}
          onChange={handleChange}
          error={errors.name}
          required
        />
        
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
          autoComplete="new-password"
        />
        
        <Input
          label="Organization Join Code"
          name="joinCode"
          type="text"
          placeholder="Enter the code provided by your organization"
          value={formData.joinCode}
          onChange={handleChange}
          error={errors.joinCode}
          required
        />
        
        <Input
          label="Role (Optional)"
          name="role"
          type="text"
          placeholder="e.g. Developer, Manager, etc."
          value={formData.role || ''}
          onChange={handleChange}
          error={errors.role}
        />
        
        <Button
          type="submit"
          fullWidth
          isLoading={isLoading}
          className="mt-6"
        >
          Create Account
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

      {/* Google Sign Up Button */}
      <div className="mt-6">
        <Button
          type="button"
          variant="outline"
          fullWidth
          isLoading={isGoogleLoading}
          onClick={handleGoogleSignup}
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
          Sign up with Google
        </Button>
      </div>
    </AuthLayout>
  );
};

export default Signup;