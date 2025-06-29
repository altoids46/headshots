import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, getCurrentUser, getUserProfile } from '../lib/supabase';

type UserProfile = {
  id: string;
  name: string;
  email: string;
  organization_id: string;
  role: string | null;
  organizations?: {
    name: string;
    join_code: string;
  } | null;
};

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  checkAuthStatus: () => Promise<boolean>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isLoading: true,
  error: null,
  checkAuthStatus: async () => false,
  clearError: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Track retry attempts to prevent infinite loops
  const retryCountRef = useRef(0);
  const maxRetries = 2;

  const clearError = () => setError(null);

  // Session restore guard - validates existing token before giving up
  const validateExistingSession = async (): Promise<boolean> => {
    try {
      console.log('🔐 AuthContext: Validating existing session...');
      
      const { data: sessionData, error: sessionError } = await Promise.race([
        supabase.auth.getSession(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Session validation timeout')), 3000)
        )
      ]) as any;
      
      if (sessionError || !sessionData?.session) {
        console.log('ℹ️ AuthContext: No valid session found');
        return false;
      }
      
      // Check if token is still valid (not expired)
      const { access_token, expires_at } = sessionData.session;
      if (!access_token) {
        console.log('ℹ️ AuthContext: No access token in session');
        return false;
      }
      
      if (expires_at && expires_at * 1000 < Date.now()) {
        console.log('⚠️ AuthContext: Session token expired');
        return false;
      }
      
      console.log('✅ AuthContext: Valid session found, attempting to restore');
      return true;
      
    } catch (error) {
      console.error('💥 AuthContext: Session validation error:', error);
      return false;
    }
  };

  const checkAuthStatus = async (): Promise<boolean> => {
    try {
      console.log('🔍 AuthContext: Starting auth status check...');
      setError(null);
      
      // First attempt - try to get current user
      console.log('👤 AuthContext: Fetching current user (attempt 1)...');
      let currentUser = await getCurrentUser();
      
      // If first attempt fails and we haven't exceeded retries, try session restore
      if (!currentUser && retryCountRef.current < maxRetries) {
        console.log('⚠️ Network warning — retrying fetch...');
        retryCountRef.current++;
        
        // Check if we have a valid session that can be restored
        const hasValidSession = await validateExistingSession();
        if (hasValidSession) {
          console.log('🔄 AuthContext: Attempting session restore...');
          await new Promise(resolve => setTimeout(resolve, 1000)); // Brief delay
          currentUser = await getCurrentUser();
        }
      }
      
      console.log('👤 AuthContext: Current user result:', currentUser?.id || 'none');
      setUser(currentUser || null);

      if (currentUser) {
        console.log('📋 AuthContext: User found, fetching profile...');
        
        try {
          const { data, error: profileError } = await getUserProfile(currentUser.id);
          
          if (profileError) {
            console.error('❌ AuthContext: Profile fetch error:', profileError);
            // Don't set as critical error - show warning instead
            if (profileError.message?.includes('timeout')) {
              setError('Network delay — some data may not load. Try refreshing.');
            } else {
              setError(profileError.message || 'Failed to load user profile');
            }
            setProfile(null);
            return false;
          }
          
          console.log('📋 AuthContext: Profile fetch result:', data ? 'success' : 'not found');
          
          if (data) {
            console.log('🏢 AuthContext: Organization:', data.organizations?.name || 'none');
            console.log('👔 AuthContext: Role:', data.role || 'none');
          }
          
          setProfile(data as UserProfile);
          retryCountRef.current = 0; // Reset retry count on success
          return !!data;
          
        } catch (profileError: any) {
          console.error('💥 AuthContext: Profile fetch timeout/error:', profileError);
          setError('Network delay — some data may not load. Try refreshing.');
          setProfile(null);
          return false;
        }
      } else {
        console.log('👋 AuthContext: No user found, clearing profile');
        setProfile(null);
        
        // Only trigger logout if we've tried multiple times and have no valid session
        if (retryCountRef.current >= maxRetries) {
          const hasValidSession = await validateExistingSession();
          if (!hasValidSession) {
            console.log('❗ AuthContext: Critical session error — logging out');
            retryCountRef.current = 0;
            return false;
          } else {
            console.log('ℹ️ AuthContext: Session temporarily unavailable. Please try again.');
            setError('Session temporarily unavailable. Please try again.');
          }
        }
        
        return false;
      }
    } catch (error: any) {
      console.error('❌ AuthContext: Error checking auth status:', error);
      
      // Don't immediately logout on network errors
      if (error.message?.includes('timeout') || error.message?.includes('network')) {
        setError('Network delay — some data may not load. Try refreshing.');
      } else {
        setError(error.message || 'Authentication check failed');
      }
      
      setUser(null);
      setProfile(null);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    console.log('🚀 AuthContext: Initializing...');
    
    // Initial auth check with error handling
    const initializeAuth = async () => {
      try {
        await checkAuthStatus();
      } catch (error) {
        console.error('💥 AuthContext: Initial auth check failed:', error);
        setError('Session temporarily unavailable. Please try again.');
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Set up auth state change listener with enhanced error handling
    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔔 AuthContext: Auth state changed:', event, session?.user?.id || 'none');
      
      try {
        // Reset retry count on auth state changes
        retryCountRef.current = 0;
        
        setUser(session?.user || null);
        
        if (session?.user) {
          console.log('📋 AuthContext: Auth change - fetching profile for user:', session.user.id);
          
          try {
            const { data: profileData, error: profileError } = await getUserProfile(session.user.id);
            
            if (profileError) {
              console.error('❌ AuthContext: Profile fetch error in auth change:', profileError);
              if (profileError.message?.includes('timeout')) {
                setError('Network delay — some data may not load. Try refreshing.');
              } else {
                setError(profileError.message || 'Failed to load user profile');
              }
              setProfile(null);
            } else {
              console.log('📋 AuthContext: Auth change - profile result:', profileData ? 'success' : 'not found');
              setProfile(profileData as UserProfile);
              setError(null);
            }
          } catch (profileError: any) {
            console.error('💥 AuthContext: Profile fetch timeout in auth change:', profileError);
            setError('Network delay — some data may not load. Try refreshing.');
            setProfile(null);
          }
        } else {
          console.log('👋 AuthContext: No user session, clearing profile');
          setProfile(null);
          setError(null);
        }
        
      } catch (error: any) {
        console.error('💥 AuthContext: Error in auth state change handler:', error);
        setError('Session temporarily unavailable. Please try again.');
      } finally {
        setIsLoading(false);
      }
    });

    return () => {
      console.log('🧹 AuthContext: Cleaning up auth listener...');
      data.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      isLoading, 
      error, 
      checkAuthStatus, 
      clearError 
    }}>
      {children}
    </AuthContext.Provider>
  );
};