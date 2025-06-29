import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AuthHandler from './components/auth/AuthHandler';
import LoadingScreen from './components/ui/LoadingScreen';
import { useAuth } from './context/AuthContext';
import { supabase } from './lib/supabase';

// Lazy load pages
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const PostAuth = lazy(() => import('./pages/PostAuth'));
const OrgHome = lazy(() => import('./pages/OrgHome'));

function App() {
  const { isLoading, checkAuthStatus } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    console.log('🚀 App: Initializing auth state listener...');
    
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔔 App: Auth state change detected:', event);
      console.log('👤 App: Session user ID:', session?.user?.id || 'none');
      
      if (event === 'SIGNED_IN' && session) {
        console.log('✅ App: User signed in, updating auth status...');
        await checkAuthStatus();
        
        // Only navigate if we're not already handling an OAuth callback
        const isOAuthCallback = window.location.hash && window.location.hash.includes('access_token');
        if (!isOAuthCallback && window.location.pathname !== '/org-home') {
          console.log('🏠 App: Navigating to /org-home...');
          navigate('/org-home');
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('👋 App: User signed out, navigating to login...');
        navigate('/login');
      }
    });

    return () => {
      console.log('🧹 App: Cleaning up auth state listener...');
      subscription.unsubscribe();
    };
  }, [checkAuthStatus, navigate]);
  
  if (isLoading) {
    console.log('⏳ App: Auth loading, showing loading screen...');
    return <LoadingScreen />;
  }

  return (
    <>
      {/* OAuth callback handler - runs on every page load */}
      <AuthHandler />
      
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/post-auth" element={<PostAuth />} />
          <Route 
            path="/org-home" 
            element={
              <ProtectedRoute>
                <OrgHome />
              </ProtectedRoute>
            }
          />
          {/* Catch all route - redirect to login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default App;