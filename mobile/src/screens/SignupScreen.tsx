import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';
import Input from '../components/Input';
import Button from '../components/Button';
import { signUpWithEmail } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  joinCode: z.string().min(1, 'Join code is required'),
  role: z.string().optional(),
});

type SignupFormData = z.infer<typeof signupSchema>;

const SignupScreen: React.FC = () => {
  const navigation = useNavigation();
  const { checkAuthStatus } = useAuth();
  
  const [formData, setFormData] = useState<SignupFormData>({
    name: '',
    email: '',
    password: '',
    joinCode: '',
    role: '',
  });
  
  const [errors, setErrors] = useState<Partial<SignupFormData>>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (field: keyof SignupFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    
    // Clear errors when user types
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async () => {
    try {
      // Validate form data
      signupSchema.parse(formData);
      setErrors({});
      
      setIsLoading(true);
      
      const { error, user } = await signUpWithEmail(
        formData.email,
        formData.password,
        formData.name,
        formData.joinCode,
        formData.role || undefined
      );
      
      if (error) {
        Alert.alert('Signup Error', error.message);
        return;
      }
      
      if (user) {
        await checkAuthStatus();
        navigation.navigate('OrgHome' as never);
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
        Alert.alert('Error', 'An unexpected error occurred');
        console.error(error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>📷</Text>
          </View>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>Join your organization's headshot platform</Text>
        </View>
        
        <View style={styles.form}>
          <Input
            label="Full Name"
            placeholder="John Smith"
            value={formData.name}
            onChangeText={(value) => handleChange('name', value)}
            error={errors.name}
          />
          
          <Input
            label="Email Address"
            placeholder="john@company.com"
            value={formData.email}
            onChangeText={(value) => handleChange('email', value)}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          
          <Input
            label="Password"
            placeholder="••••••••"
            value={formData.password}
            onChangeText={(value) => handleChange('password', value)}
            error={errors.password}
            secureTextEntry
          />
          
          <Input
            label="Organization Join Code"
            placeholder="Enter the code provided by your organization"
            value={formData.joinCode}
            onChangeText={(value) => handleChange('joinCode', value)}
            error={errors.joinCode}
          />
          
          <Input
            label="Role (Optional)"
            placeholder="e.g. Developer, Manager, etc."
            value={formData.role || ''}
            onChangeText={(value) => handleChange('role', value)}
            error={errors.role}
          />
          
          <Button
            title="Create Account"
            onPress={handleSubmit}
            isLoading={isLoading}
            fullWidth
            style={styles.submitButton}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Already have an account?{' '}
            <Text 
              style={styles.link}
              onPress={() => navigation.navigate('Login' as never)}
            >
              Sign in
            </Text>
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
  submitButton: {
    marginTop: 8,
  },
  footer: {
    marginTop: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#6b7280',
  },
  link: {
    color: '#2563eb',
    fontWeight: '500',
  },
});

export default SignupScreen;