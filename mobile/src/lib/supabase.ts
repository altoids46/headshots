import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Database } from '../types/supabase';

// Replace with your Supabase project URL and anon key
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Custom storage adapter for React Native
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Enhanced error handling utility
const handleDatabaseError = (error: any, operation: string) => {
  console.error(`❌ Database Error [${operation}]:`, error);
  
  // Check for common database issues
  if (error?.code === 'PGRST116') {
    return { message: 'Database table not found. Please check your database setup.' };
  }
  if (error?.code === '23505') {
    return { message: 'This email is already registered.' };
  }
  if (error?.code === '23503') {
    return { message: 'Invalid organization code.' };
  }
  
  return { message: error?.message || `Failed to ${operation}. Please try again.` };
};

// Enhanced validation utility
const validateRequiredFields = (fields: Record<string, any>) => {
  const missing = Object.entries(fields)
    .filter(([_, value]) => !value || (typeof value === 'string' && value.trim() === ''))
    .map(([key, _]) => key);
    
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
};

// Resilient session/user fetching with retry logic
const createResilientFetch = <T>(
  fetchFn: () => Promise<T>,
  operation: string,
  maxRetries: number = 2,
  timeoutMs: number = 4000
) => {
  return async (): Promise<T> => {
    let lastError: any = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 ${operation}: Attempt ${attempt}/${maxRetries}`);
        
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error(`${operation} timeout after ${timeoutMs}ms`)), timeoutMs)
        );
        
        const result = await Promise.race([fetchFn(), timeoutPromise]);
        console.log(`✅ ${operation}: Success on attempt ${attempt}`);
        return result;
        
      } catch (error: any) {
        lastError = error;
        console.warn(`⚠️ ${operation}: Attempt ${attempt} failed:`, error.message);
        
        // Don't retry on certain errors
        if (error.message?.includes('Auth session missing') || 
            error.message?.includes('Invalid JWT') ||
            attempt === maxRetries) {
          break;
        }
        
        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 3000);
          console.log(`⏳ ${operation}: Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  };
};

// Helper functions for authentication with comprehensive error handling
export const signUpWithEmail = async (
  email: string,
  password: string,
  name: string,
  joinCode: string,
  role?: string
) => {
  try {
    console.log('🚀 SignUp: Starting email signup process...');
    
    // Validate required fields
    validateRequiredFields({ email, password, name, joinCode });
    
    // First, check if the join code is valid
    console.log('🔍 SignUp: Validating join code...');
    const orgPromise = supabase
      .from('organizations')
      .select('id, name')
      .eq('join_code', joinCode)
      .limit(1)
      .maybeSingle();
      
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Organization lookup timeout after 6s')), 6000)
    );
    
    const { data: orgData, error: orgError } = await Promise.race([
      orgPromise,
      timeoutPromise
    ]) as any;

    if (orgError) {
      console.error('❌ SignUp: Organization validation failed:', orgError);
      return { 
        error: handleDatabaseError(orgError, 'validate organization'), 
        user: null 
      };
    }

    if (!orgData) {
      console.warn('⚠️ SignUp: Invalid join code provided');
      return { 
        error: { message: 'Invalid join code. Please check with your organization.' }, 
        user: null 
      };
    }

    console.log('✅ SignUp: Organization validated:', orgData.name);

    // Sign up the user with Supabase Auth
    console.log('👤 SignUp: Creating auth user...');
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
    });

    if (authError) {
      console.error('❌ SignUp: Auth signup failed:', authError);
      return { 
        error: { message: authError.message || 'Failed to create account' }, 
        user: null 
      };
    }

    if (!authData.user) {
      console.error('❌ SignUp: No user returned from auth signup');
      return { 
        error: { message: 'Failed to create user account' }, 
        user: null 
      };
    }

    console.log('✅ SignUp: Auth user created:', authData.user.id);

    // Create user profile with retry logic
    console.log('📝 SignUp: Creating user profile...');
    let profileAttempts = 0;
    const maxAttempts = 3;
    
    while (profileAttempts < maxAttempts) {
      try {
        const { error: profileError } = await supabase.from('users').insert([
          {
            id: authData.user.id,
            name: name.trim(),
            email: email.trim().toLowerCase(),
            organization_id: orgData.id,
            role: role?.trim() || 'member',
          },
        ]);

        if (!profileError) {
          console.log('✅ SignUp: User profile created successfully');
          return { error: null, user: authData.user };
        }

        console.warn(`⚠️ SignUp: Profile creation attempt ${profileAttempts + 1} failed:`, profileError);
        
        if (profileAttempts === maxAttempts - 1) {
          console.error('❌ SignUp: All profile creation attempts failed');
          return { 
            error: handleDatabaseError(profileError, 'create user profile'), 
            user: null 
          };
        }
        
        profileAttempts++;
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (profileError) {
        console.error('💥 SignUp: Unexpected error creating profile:', profileError);
        return { 
          error: { message: 'Failed to create user profile' }, 
          user: null 
        };
      }
    }

    return { error: { message: 'Failed to create user profile after multiple attempts' }, user: null };

  } catch (error: any) {
    console.error('💥 SignUp: Unexpected error during signup:', error);
    return { 
      error: { message: error.message || 'An unexpected error occurred during signup' }, 
      user: null 
    };
  }
};

export const signInWithEmail = async (email: string, password: string) => {
  try {
    console.log('🔐 SignIn: Starting email signin...');
    
    validateRequiredFields({ email, password });
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      console.error('❌ SignIn: Authentication failed:', error);
      return { 
        error: { message: error.message || 'Invalid email or password' }, 
        user: null 
      };
    }

    console.log('✅ SignIn: Authentication successful');
    return { error: null, user: data?.user || null };

  } catch (error: any) {
    console.error('💥 SignIn: Unexpected error during signin:', error);
    return { 
      error: { message: 'An unexpected error occurred during sign in' }, 
      user: null 
    };
  }
};

export const signOut = async () => {
  try {
    console.log('👋 SignOut: Signing out user...');
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('❌ SignOut: Error during signout:', error);
      return { error };
    }
    
    console.log('✅ SignOut: User signed out successfully');
    return { error: null };
    
  } catch (error: any) {
    console.error('💥 SignOut: Unexpected error:', error);
    return { error: { message: 'Failed to sign out' } };
  }
};

// Resilient getCurrentUser with retry logic and session validation
export const getCurrentUser = async () => {
  const resilientFetch = createResilientFetch(
    async () => {
      console.log('🔍 GetCurrentUser: Fetching current user...');
      
      // Try both getUser and getSession for maximum reliability
      const [userResult, sessionResult] = await Promise.allSettled([
        supabase.auth.getUser(),
        supabase.auth.getSession()
      ]);
      
      // Check getUser result first
      if (userResult.status === 'fulfilled' && !userResult.value.error && userResult.value.data?.user) {
        console.log('✅ GetCurrentUser: User found via getUser');
        return userResult.value.data.user;
      }
      
      // Fallback to session
      if (sessionResult.status === 'fulfilled' && !sessionResult.value.error && sessionResult.value.data?.session?.user) {
        console.log('✅ GetCurrentUser: User found via getSession');
        return sessionResult.value.data.session.user;
      }
      
      // Check for specific errors that shouldn't trigger retries
      const userError = userResult.status === 'fulfilled' ? userResult.value.error : null;
      const sessionError = sessionResult.status === 'fulfilled' ? sessionResult.value.error : null;
      
      if (userError?.message === 'Auth session missing!' || sessionError?.message === 'Auth session missing!') {
        console.info('ℹ️ GetCurrentUser: No active session (user not authenticated)');
        return null;
      }
      
      // Log errors but don't throw for missing sessions
      if (userError && userError.message !== 'Auth session missing!') {
        console.error('❌ GetCurrentUser: getUser error:', userError);
      }
      if (sessionError && sessionError.message !== 'Auth session missing!') {
        console.error('❌ GetCurrentUser: getSession error:', sessionError);
      }
      
      return null;
    },
    'GetCurrentUser',
    2, // Max 2 retries
    4000 // 4s timeout
  );
  
  try {
    const user = await resilientFetch();
    console.log('✅ GetCurrentUser: Final result:', user?.id || 'none');
    return user;
  } catch (error: any) {
    console.error('💥 GetCurrentUser: All attempts failed:', error);
    // Don't throw - return null to indicate no user instead of crashing
    return null;
  }
};

export const getUserProfile = async (userId: string) => {
  const resilientFetch = createResilientFetch(
    async () => {
      console.log('📋 GetUserProfile: Fetching profile for user:', userId);
      
      if (!userId) {
        throw new Error('User ID is required');
      }

      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          organizations (
            id,
            name,
            join_code
          )
        `)
        .eq('id', userId)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('❌ GetUserProfile: Database error:', error);
        throw error;
      }

      console.log('✅ GetUserProfile: Profile fetched successfully');
      return { data, error: null };
    },
    'GetUserProfile',
    2, // Max 2 retries
    5000 // 5s timeout
  );

  try {
    return await resilientFetch();
  } catch (error: any) {
    console.error('💥 GetUserProfile: All attempts failed:', error);
    return { 
      data: null, 
      error: handleDatabaseError(error, 'fetch user profile')
    };
  }
};

export const getOrgMembers = async (organization_id: string) => {
  const resilientFetch = createResilientFetch(
    async () => {
      console.log('👥 GetOrgMembers: Fetching members for organization:', organization_id);
      
      if (!organization_id) {
        throw new Error('Organization ID is required');
      }

      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, role, created_at')
        .eq('organization_id', organization_id)
        .limit(50) // Limit to prevent large queries
        .order('name');

      if (error) {
        console.error('❌ GetOrgMembers: Database error:', error);
        throw error;
      }

      console.log('✅ GetOrgMembers: Members fetched successfully:', data?.length || 0);
      return { data, error: null };
    },
    'GetOrgMembers',
    1, // Only 1 retry for member fetching
    8000 // 8s timeout
  );

  try {
    return await resilientFetch();
  } catch (error: any) {
    console.error('💥 GetOrgMembers: All attempts failed:', error);
    return { 
      data: null, 
      error: handleDatabaseError(error, 'fetch organization members')
    };
  }
};

// Enhanced helper function to create user profile after OAuth login
export const createUserProfileFromOAuth = async (
  user: any,
  joinCode: string,
  role?: string
) => {
  try {
    console.log('👤 OAuth Profile: Creating profile for user:', user?.id);
    
    if (!user?.id) {
      return { error: { message: 'Invalid user data' } };
    }
    
    if (!joinCode?.trim()) {
      return { error: { message: 'Join code is required' } };
    }
    
    console.log('🔑 OAuth Profile: Validating join code:', joinCode);
    
    // Check if the join code is valid
    const orgPromise = supabase
      .from('organizations')
      .select('id, name')
      .eq('join_code', joinCode.trim())
      .limit(1)
      .maybeSingle();
      
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Organization lookup timeout after 5s')), 5000)
    );
    
    const { data: orgData, error: orgError } = await Promise.race([
      orgPromise,
      timeoutPromise
    ]) as any;

    if (orgError) {
      console.error('❌ OAuth Profile: Organization validation failed:', orgError);
      return { error: handleDatabaseError(orgError, 'validate organization') };
    }

    if (!orgData) {
      console.error('❌ OAuth Profile: Invalid join code');
      return { error: { message: 'Invalid join code' } };
    }

    console.log('✅ OAuth Profile: Organization found:', orgData.name);

    // Check if user profile already exists
    const { data: existingProfile } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .limit(1)
      .maybeSingle();

    if (existingProfile) {
      console.log('ℹ️ OAuth Profile: Profile already exists');
      return { error: null };
    }

    // Extract name from user metadata or email
    const userName = user.user_metadata?.full_name || 
                    user.user_metadata?.name || 
                    user.email?.split('@')[0] || 
                    'Unknown User';

    console.log('👤 OAuth Profile: Creating profile with name:', userName);

    // Create user profile with retry logic
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        const { error: profileError } = await supabase.from('users').insert([
          {
            id: user.id,
            name: userName.trim(),
            email: user.email?.trim().toLowerCase() || '',
            organization_id: orgData.id,
            role: role?.trim() || 'member',
          },
        ]);

        if (!profileError) {
          console.log('✅ OAuth Profile: Profile created successfully');
          return { error: null };
        }

        console.warn(`⚠️ OAuth Profile: Creation attempt ${attempts + 1} failed:`, profileError);
        
        if (attempts === maxAttempts - 1) {
          return { error: handleDatabaseError(profileError, 'create user profile') };
        }
        
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error('💥 OAuth Profile: Unexpected error:', error);
        return { error: { message: 'Failed to create user profile' } };
      }
    }

    return { error: { message: 'Failed to create profile after multiple attempts' } };

  } catch (error: any) {
    console.error('💥 OAuth Profile: Unexpected error:', error);
    return { error: { message: 'An unexpected error occurred' } };
  }
};

// Helper function to check if organization exists by join code
export const getOrganizationByJoinCode = async (joinCode: string) => {
  try {
    console.log('🏢 GetOrganization: Looking up organization by join code');
    
    if (!joinCode?.trim()) {
      return { data: null, error: { message: 'Join code is required' } };
    }

    // Add timeout and limit
    const orgPromise = supabase
      .from('organizations')
      .select('id, name')
      .eq('join_code', joinCode.trim())
      .limit(1)
      .maybeSingle();
      
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Organization lookup timeout after 5s')), 5000)
    );

    const { data, error } = await Promise.race([orgPromise, timeoutPromise]) as any;

    if (error) {
      console.error('❌ GetOrganization: Database error:', error);
      return { 
        data: null, 
        error: handleDatabaseError(error, 'fetch organization')
      };
    }

    console.log('✅ GetOrganization: Lookup completed');
    return { data, error: null };

  } catch (error: any) {
    console.error('💥 GetOrganization: Timeout or unexpected error:', error);
    return { 
      data: null, 
      error: { message: 'Organization lookup timed out. Please try again.' }
    };
  }
};