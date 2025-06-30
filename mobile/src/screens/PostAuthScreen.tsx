import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, Picker } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';
import Input from '../components/Input';
import Button from '../components/Button';
import LoadingScreen from '../components/LoadingScreen';
import { supabase, createUserProfileFromOAuth, getOrganizationByJoinCode } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { User } from '@supabase/supabase-js';

const joinOrgSchema = z.object({
  joinCode: z.string().min(1, 'Join code is required'),
  role: z.string().min(1, 'Role is required'),
});

type JoinOrgFormData = z.infer<typeof joinOrgSchema>;

const PostAuthScreen: React.FC = () => {
  const navigation = useNavigation();
  const { checkAuthStatus } = useAuth();
  
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsOrgJoin, setNeedsOrgJoin] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState<JoinOrgFormData>({
    joinCode: '',
    role: 'member',
  });
  
  const [errors, setErrors] = useState<Partial<JoinOrgFormData>>({});

  useEffect(() => {
    const handlePostAuthSetup = async () => {
      try {
        console.log('📝 PostAuth: Starting post-auth setup...');
        
        // Get the current session
        console.log('📡 PostAuth: Getting current session...');
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('❌ PostAuth: Error getting session:', sessionError);
          Alert.alert('Error', 'Authentication failed. Please try again.');
          setIsLoading(false);
          return;
        }

        if (!sessionData.session?.user) {
          console.log('⚠️ PostAuth: No authenticated user found, redirecting to login');
          navigation.navigate('Login' as never);
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
          Alert.alert('Error', 'Error checking user profile. Please try again.');
          setIsLoading(false);
          return;
        }

        if (existingProfile) {
          console.log('✅ PostAuth: User profile exists, redirecting to org-home');
          // User already exists, redirect to org-home
          await checkAuthStatus();
          navigation.navigate('OrgHome' as never);
        } else {
          console.log('📝 PostAuth: User profile does not exist, showing join form');
          // User doesn't exist in users table, show join form
          setNeedsOrgJoin(true);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('💥 PostAuth: Unexpected error during post-auth setup:', error);
        Alert.alert('Error', 'An unexpected error occurred. Please try again.');
        setIsLoading(false);
      }
    };

    handlePostAuthSetup();
  }, [navigation, checkAuthStatus]);

  const handleChange = (field: keyof JoinOrgFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    
    // Clear error when user types
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert('Error', 'No authenticated user found. Please try again.');
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
        Alert.alert('Error', 'Invalid join code. Please check and try again.');
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
        Alert.alert('Error', profileError.message || 'Failed to join organization. Please try again.');
        return;
      }
      
      console.log('✅ PostAuth: User profile created successfully');
      
      // Success! Update auth context and redirect
      console.log('🔄 PostAuth: Updating auth context...');
      await checkAuthStatus();
      console.log('🏠 PostAuth: Redirecting to org-home...');
      navigation.navigate('OrgHome' as never);
      
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
        Alert.alert('Error', 'An unexpected error occurred');
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
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>📷</Text>
          </View>
          <Text style={styles.title}>Join Your Organization</Text>
          <Text style={styles.subtitle}>
            Welcome {user?.user_metadata?.full_name || user?.email}! Complete your setup by joining your organization.
          </Text>
        </View>
        
        <View style={styles.form}>
          <Input
            label="Organization Join Code"
            placeholder="Enter the code provided by your organization"
            value={formData.joinCode}
            onChangeText={(value) => handleChange('joinCode', value)}
            error={errors.joinCode}
          />
          
          <View style={styles.pickerContainer}>
            <Text style={styles.label}>Role</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={formData.role}
                onValueChange={(value) => handleChange('role', value)}
                style={styles.picker}
              >
                <Picker.Item label="Member" value="member" />
                <Picker.Item label="Admin" value="admin" />
                <Picker.Item label="Manager" value="manager" />
                <Picker.Item label="Developer" value="developer" />
                <Picker.Item label="Designer" value="designer" />
                <Picker.Item label="Other" value="other" />
              </Picker>
            </View>
            {errors.role && (
              <Text style={styles.error}>{errors.role}</Text>
            )}
          </View>
          
          <Button
            title="Join Organization"
            onPress={handleSubmit}
            isLoading={isSubmitting}
            fullWidth
            style={styles.submitButton}
          />
        </View>

        <View style={styles.footer}>
          <Text 
            style={styles.link}
            onPress={() => {
              console.log('👋 PostAuth: User signing out...');
              supabase.auth.signOut();
              navigation.navigate('Login' as never);
            }}
          >
            Sign out and try a different account
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 60,
    height: 60,
    backgroundColor: '#2563eb',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  logoText: {
    fontSize: 28,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  form: {
    backgroundColor: '#ffffff',
    padding: 32,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  pickerContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 4,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    backgroundColor: '#ffffff',
  },
  picker: {
    height: 50,
  },
  error: {
    marginTop: 4,
    fontSize: 14,
    color: '#dc2626',
  },
  submitButton: {
    marginTop: 8,
  },
  footer: {
    marginTop: 24,
    alignItems: 'center',
  },
  link: {
    fontSize: 14,
    color: '#2563eb',
    textDecorationLine: 'underline',
  },
});

export default PostAuthScreen;