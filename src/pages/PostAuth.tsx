import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import AuthLayout from '../components/layout/AuthLayout';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import LoadingScreen from '../components/ui/LoadingScreen';
import { supabase, createUserProfileFromOAuth, getOrganizationByJoinCode } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { User } from '@supabase/supabase-js';

const joinOrgSchema = z.object({
  joinCode: z.string().min(1, 'Join code is required'),
  role: z.string().min(1, 'Role is required'),
});

type JoinOrgFormData = z.infer<typeof joinOrgSchema>;

const PostAuth: React.FC = () => {
  const navigate = useNavigate();
  const { checkAuthStatus } = useAuth();
  
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsOrgJoin, setNeedsOrgJoin] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<JoinOrgFormData>({
    joinCode: '',
    role: 'member',
  });
  
  const [errors, setErrors] = useState<Partial<JoinOrgFormData>>({});

  useEffect(() => {
    const handlePostAuthSetup = async () => {
      try {
        console.log('📝 PostAuth: Starting post-auth setup...');
        
        // Clean up any remaining hash fragments
        if (window.location.hash && window.location.hash.includes('access_token')) {
          console.log('🧹 PostAuth: Cleaning up remaining hash fragments...');
          window.history.replaceState(null, '', window.location.pathname);
        }

        // Get the current session
        console.log('📡 PostAuth: Getting current session...');
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('❌ PostAuth: Error getting session:', sessionError);
          setServerError('Authentication failed. Please try again.');
          setIsLoading(false);
          return;
        }

        if (!sessionData.session?.user) {
          console.log('⚠️ PostAuth: No authenticated user found, redirecting to login');
          navigate('/login');
          return;
        }

        const authenticatedUser = sessionData.session.user;
        setUser(authenticatedUser);
        console.log('✅ PostAuth: Authenticated user found:', authenticatedUser.id);
        console.log('📧 PostAuth: User email:', authenticatedUser.email);

        // Check if user already exists in the users table
        console.log('🔍 PostAuth: Checking if user profile exists...');
        const { data: existingProfile, error: profileError } = await supabase
          .from('users')
          .select('id, organization_id')
          .eq('id', authenticatedUser.id)
          .maybeSingle();

        if (profileError) {
          console.error('❌ PostAuth: Error checking user profile:', profileError);
          setServerError('Error checking user profile. Please try again.');
          setIsLoading(false);
          return;
        }

        if (existingProfile) {
          console.log('✅ PostAuth: User profile exists, redirecting to org-home');
          // User already exists, redirect to org-home
          await checkAuthStatus();
          navigate('/org-home');
        } else {
          console.log('📝 PostAuth: User profile does not exist, showing join form');
          // User doesn't exist in users table, show join form
          setNeedsOrgJoin(true);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('💥 PostAuth: Unexpected error during post-auth setup:', error);
        setServerError('An unexpected error occurred. Please try again.');
        setIsLoading(false);
      }
    };

    handlePostAuthSetup();
  }, [navigate, checkAuthStatus]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Clear error when user types
    if (errors[name as keyof JoinOrgFormData]) {
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
    
    if (!user) {
      setServerError('No authenticated user found. Please try again.');
      return;
    }
    
    try {
      console.log('📝 PostAuth: Submitting organization join form...');
      console.log('🔑 PostAuth: Join code:', formData.joinCode);
      console.log('👔 PostAuth: Role:', formData.role);
      
      // Validate form data
      joinOrgSchema.parse(formData);
      setErrors({});
      
      setIsSubmitting(true);
      
      // First, verify the join code is valid
      console.log('🔍 PostAuth: Verifying join code...');
      const { data: orgData, error: orgError } = await getOrganizationByJoinCode(formData.joinCode);
      
      if (orgError || !orgData) {
        console.error('❌ PostAuth: Invalid join code:', orgError);
        setServerError('Invalid join code. Please check and try again.');
        return;
      }
      
      console.log('✅ PostAuth: Join code valid, organization:', orgData.name);
      
      // Create user profile with organization
      console.log('👤 PostAuth: Creating user profile...');
      const { error: profileError } = await createUserProfileFromOAuth(
        user,
        formData.joinCode,
        formData.role
      );
      
      if (profileError) {
        console.error('❌ PostAuth: Failed to create user profile:', profileError);
        setServerError(profileError.message || 'Failed to join organization. Please try again.');
        return;
      }
      
      console.log('✅ PostAuth: User profile created successfully');
      
      // Success! Update auth context and redirect
      console.log('🔄 PostAuth: Updating auth context...');
      await checkAuthStatus();
      console.log('🏠 PostAuth: Redirecting to org-home...');
      navigate('/org-home');
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('❌ PostAuth: Form validation error:', error);
        const fieldErrors: Partial<JoinOrgFormData> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as keyof JoinOrgFormData] = err.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        console.error('💥 PostAuth: Unexpected error during form submission:', error);
        setServerError('An unexpected error occurred');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!needsOrgJoin) {
    return <LoadingScreen />;
  }

  return (
    <AuthLayout
      title="Join Your Organization"
      subtitle={`Welcome ${user?.user_metadata?.full_name || user?.email}! Complete your setup by joining your organization.`}
    >
      {serverError && (
        <div className="mb-6 p-3 bg-error-50 border border-error-200 text-error-700 rounded-md">
          {serverError}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-5">
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
        
        <div className="mb-4">
          <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
            Role
          </label>
          <select
            id="role"
            name="role"
            value={formData.role}
            onChange={handleChange}
            className="block w-full px-4 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:border-primary-500 focus:ring-primary-300 transition-colors"
            required
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="developer">Developer</option>
            <option value="designer">Designer</option>
            <option value="other">Other</option>
          </select>
          {errors.role && (
            <p className="mt-1 text-sm text-error-600 animate-fade-in">
              {errors.role}
            </p>
          )}
        </div>
        
        <Button
          type="submit"
          fullWidth
          isLoading={isSubmitting}
          className="mt-6"
        >
          Join Organization
        </Button>
      </form>

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => {
            console.log('👋 PostAuth: User signing out...');
            supabase.auth.signOut();
            navigate('/login');
          }}
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          Sign out and try a different account
        </button>
      </div>
    </AuthLayout>
  );
};

export default PostAuth;