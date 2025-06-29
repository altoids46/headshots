import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import LoadingScreen from '../ui/LoadingScreen';

const AuthHandler: React.FC = () => {
  const navigate = useNavigate();
  const { checkAuthStatus } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleOAuthCallback = async () => {
      // Prevent multiple simultaneous executions
      if (isProcessing) {
        console.log('🔄 AuthHandler: Already processing, skipping...');
        return;
      }

      // Check if this is an OAuth callback
      const hasOAuthHash = window.location.hash && (
        window.location.hash.includes('access_token') || 
        window.location.hash.includes('error')
      );
      
      const hasOAuthParams = window.location.search && (
        window.location.search.includes('code=') ||
        window.location.search.includes('error=')
      );

      if (!hasOAuthHash && !hasOAuthParams) {
        console.log('🔍 AuthHandler: No OAuth callback detected, skipping');
        return;
      }

      console.log('🔐 AuthHandler: OAuth callback detected');
      setIsProcessing(true);
      setError(null);

      try {
        // Add timeout to prevent hanging
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Session retrieval timeout')), 15000)
        );

        console.log('📡 AuthHandler: Processing OAuth callback...');
        const { data, error: sessionError } = await Promise.race([
          sessionPromise,
          timeoutPromise
        ]) as any;

        if (sessionError) {
          console.error('❌ AuthHandler: OAuth callback error:', sessionError);
          throw new Error(`OAuth authentication failed: ${sessionError.message}`);
        }

        if (!data?.session) {
          console.warn('⚠️ AuthHandler: No session found after OAuth callback');
          throw new Error('Authentication failed. No session created.');
        }

        const { session } = data;
        console.log('✅ AuthHandler: OAuth session retrieved successfully');
        console.log('👤 AuthHandler: User ID:', session.user.id);

        // Clean up the URL immediately
        console.log('🧹 AuthHandler: Cleaning up URL...');
        const cleanUrl = window.location.pathname;
        window.history.replaceState(null, '', cleanUrl);

        // Check if user profile exists with timeout
        console.log('🔍 AuthHandler: Checking user profile...');
        const profilePromise = supabase
          .from('users')
          .select('id, organization_id')
          .eq('id', session.user.id)
          .maybeSingle();
          
        const profileTimeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Profile check timeout')), 10000)
        );

        const { data: profileData, error: profileError } = await Promise.race([
          profilePromise,
          profileTimeoutPromise
        ]) as any;

        if (profileError) {
          console.error('❌ AuthHandler: Error checking user profile:', profileError);
          // Don't throw here - user might need to complete profile setup
          console.log('📝 AuthHandler: Profile check failed, redirecting to post-auth...');
          navigate('/post-auth', { replace: true });
          return;
        }

        if (profileData) {
          console.log('✅ AuthHandler: User profile exists');
          // Update auth context with timeout
          try {
            await Promise.race([
              checkAuthStatus(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Auth status check timeout')), 8000)
              )
            ]);
            
            console.log('🏠 AuthHandler: Redirecting to /org-home...');
            navigate('/org-home', { replace: true });
          } catch (authError) {
            console.error('⚠️ AuthHandler: Auth status check failed:', authError);
            // Still navigate to org-home, auth context will update eventually
            navigate('/org-home', { replace: true });
          }
        } else {
          console.log('📝 AuthHandler: No user profile found, redirecting to /post-auth...');
          navigate('/post-auth', { replace: true });
        }

      } catch (error: any) {
        console.error('💥 AuthHandler: Error during OAuth callback:', error);
        setError(error.message || 'Authentication failed');
        
        // Clean up URL
        const cleanUrl = window.location.pathname;
        window.history.replaceState(null, '', cleanUrl);
        
        // Delay redirect to show error briefly
        setTimeout(() => {
          navigate('/login', { 
            state: { 
              error: error.message || 'An unexpected error occurred during authentication. Please try again.' 
            } 
          });
        }, 2000);
      } finally {
        setIsProcessing(false);
      }
    };

    // Add a small delay to ensure DOM is ready
    const timer = setTimeout(handleOAuthCallback, 100);
    
    return () => {
      clearTimeout(timer);
    };
  }, [navigate, checkAuthStatus, isProcessing]);

  // Show loading screen during processing
  if (isProcessing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <LoadingScreen />
        <p className="mt-4 text-sm text-gray-600">Processing authentication...</p>
      </div>
    );
  }

  // Show error state briefly before redirect
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <div className="text-center">
            <div className="text-error-600 text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Error</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <p className="text-sm text-gray-500">Redirecting to login...</p>
          </div>
        </div>
      </div>
    );
  }

  // This component doesn't render anything during normal operation
  return null;
};

export default AuthHandler;