import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity, Image, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { signOut, getOrgMembers } from '../lib/supabase';
import { uploadPhoto, getUserPhotos, deletePhoto, getOrganizationPhotos, Photo } from '../lib/photoStorage';
import Button from '../components/Button';
import LoadingScreen from '../components/LoadingScreen';

interface OrgMember {
  id: string;
  name: string;
  email: string;
  role: string | null;
  created_at?: string;
}

const OrgHomeScreen: React.FC = () => {
  const { profile, user, isLoading: isAuthLoading, error: authError, clearError } = useAuth();
  const navigation = useNavigation();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [memberPhotos, setMemberPhotos] = useState<Record<string, Photo[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  // Photo states
  const [isUploading, setIsUploading] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<Photo[]>([]);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  const loadMembers = async (showRetryMessage = false) => {
    if (!profile?.organization_id) {
      console.log('No organization_id found in profile');
      setError('No organization found. Please check your organization settings.');
      setIsLoading(false);
      return;
    }

    if (showRetryMessage) {
      setError(null);
      setIsLoading(true);
    }

    try {
      console.log('👥 OrgHome: Loading members for organization:', profile.organization_id);
      
      const membersPromise = getOrgMembers(profile.organization_id);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Members load timeout after 10s')), 10000)
      );
      
      const { data, error: fetchError } = await Promise.race([
        membersPromise,
        timeoutPromise
      ]) as any;
      
      if (fetchError) {
        console.error('❌ OrgHome: Failed to fetch organization members:', fetchError);
        throw new Error(fetchError.message || 'Failed to load organization members');
      }

      console.log('✅ OrgHome: Successfully loaded members:', data?.length || 0);
      setMembers(data || []);
      
      // Load photos for all members
      if (data && data.length > 0) {
        console.log('📸 OrgHome: Loading photos for members...');
        await loadMemberPhotos(data.map((member: OrgMember) => member.id));
      }
      
      setError(null);
      setRetryCount(0);
      
    } catch (error: any) {
      console.error('💥 OrgHome: Error loading members:', error);
      setError(error.message || 'Failed to load organization members. Please try again.');
      setRetryCount(prev => prev + 1);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMemberPhotos = async (memberIds: string[]) => {
    try {
      console.log('📸 OrgHome: Loading photos for members:', memberIds.length);
      
      const photosPromise = getOrganizationPhotos(memberIds);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Photos load timeout')), 8000)
      );
      
      const { data: photos, error: photosError } = await Promise.race([
        photosPromise,
        timeoutPromise
      ]) as any;
      
      if (photosError) {
        console.error('❌ OrgHome: Error loading member photos:', photosError);
        return;
      }
      
      setMemberPhotos(photos || {});
      console.log('✅ OrgHome: Successfully loaded member photos');
      
    } catch (error) {
      console.error('💥 OrgHome: Timeout or unexpected error loading photos:', error);
    }
  };

  useEffect(() => {
    if (!isAuthLoading && profile) {
      loadMembers();
    }
  }, [profile, isAuthLoading]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigation.navigate('Login' as never);
    } catch (error) {
      console.error('Sign out error:', error);
      navigation.navigate('Login' as never);
    }
  };

  const handleTakePhoto = async (memberId: string) => {
    try {
      // Request camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is required to take photos.');
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await handlePhotoUpload(result.assets[0], memberId);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const handleSelectPhoto = async (memberId: string) => {
    try {
      // Request media library permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Photo library permission is required to select photos.');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await handlePhotoUpload(result.assets[0], memberId);
      }
    } catch (error) {
      console.error('Error selecting photo:', error);
      Alert.alert('Error', 'Failed to select photo. Please try again.');
    }
  };

  const handlePhotoUpload = async (asset: any, memberId: string) => {
    if (!profile?.organization_id || !user?.id) {
      Alert.alert('Error', 'Missing required information for upload');
      return;
    }

    setIsUploading(true);

    try {
      console.log('📸 OrgHome: Uploading photo for member:', memberId);
      
      const fileName = asset.fileName || `photo_${Date.now()}.jpg`;
      const result = await uploadPhoto(asset.uri, fileName, memberId, profile.organization_id);
      
      if (!result.success) {
        Alert.alert('Upload Error', result.error || 'Failed to upload photo');
        return;
      }

      console.log('✅ OrgHome: Photo uploaded successfully');
      
      // Refresh photos for this member
      const { data: updatedPhotos } = await getUserPhotos(memberId);
      if (updatedPhotos) {
        setMemberPhotos(prev => ({
          ...prev,
          [memberId]: updatedPhotos
        }));
      }
      
      Alert.alert('Success', 'Photo uploaded successfully!');
      
    } catch (error: any) {
      console.error('💥 OrgHome: Error uploading photo:', error);
      Alert.alert('Error', 'An unexpected error occurred during upload');
    } finally {
      setIsUploading(false);
    }
  };

  const handleViewPhotos = (memberId: string) => {
    const photos = memberPhotos[memberId] || [];
    setSelectedPhotos(photos);
    setSelectedPhotoIndex(0);
    setShowPhotoModal(true);
  };

  const handleDeletePhoto = async (photoId: string, memberId: string) => {
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await deletePhoto(photoId);
              
              if (!result.success) {
                Alert.alert('Error', result.error || 'Failed to delete photo');
                return;
              }

              // Refresh photos for this member
              const { data: updatedPhotos } = await getUserPhotos(memberId);
              if (updatedPhotos) {
                setMemberPhotos(prev => ({
                  ...prev,
                  [memberId]: updatedPhotos
                }));
              }

              // Update modal photos if currently viewing
              if (showPhotoModal) {
                const updatedModalPhotos = selectedPhotos.filter(p => p.id !== photoId);
                setSelectedPhotos(updatedModalPhotos);
                if (updatedModalPhotos.length === 0) {
                  setShowPhotoModal(false);
                } else if (selectedPhotoIndex >= updatedModalPhotos.length) {
                  setSelectedPhotoIndex(updatedModalPhotos.length - 1);
                }
              }
              
            } catch (error) {
              console.error('Error deleting photo:', error);
              Alert.alert('Error', 'Failed to delete photo');
            }
          }
        }
      ]
    );
  };

  const getMemberPhotoCount = (memberId: string): number => {
    return memberPhotos[memberId]?.length || 0;
  };

  const getMemberThumbnail = (memberId: string): string | null => {
    const photos = memberPhotos[memberId];
    return photos && photos.length > 0 ? photos[0].imageurl : null;
  };

  if (isAuthLoading) {
    return <LoadingScreen />;
  }

  if (authError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Authentication Error</Text>
          <Text style={styles.errorMessage}>{authError}</Text>
          <Button title="Try Again" onPress={clearError} style={styles.retryButton} />
          <Button title="Sign Out" onPress={handleSignOut} variant="outline" style={styles.signOutButton} />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile?.organization_id || !profile.organizations) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>No Organization Found</Text>
          <Text style={styles.errorMessage}>
            We couldn't find your organization details. Please check your organization settings or contact support.
          </Text>
          <Button title="Sign Out" onPress={handleSignOut} variant="outline" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>📷</Text>
          </View>
          <Text style={styles.headerTitle}>OrganizationShots</Text>
        </View>
        
        <View style={styles.headerRight}>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{profile.name}</Text>
            <Text style={styles.orgName}>{profile.organizations.name}</Text>
          </View>
          <Button 
            title="Sign Out"
            onPress={handleSignOut}
            variant="outline"
            size="sm"
          />
        </View>
      </View>

      {/* Main content */}
      <ScrollView style={styles.content}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Organization Members</Text>
          <Text style={styles.sectionSubtitle}>
            Members of {profile.organizations.name} ({members.length} {members.length === 1 ? 'member' : 'members'})
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <LoadingScreen />
          </View>
        ) : error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Failed to Load Members</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <Button 
              title={`Try Again ${retryCount > 0 ? `(${retryCount})` : ''}`}
              onPress={() => loadMembers(true)}
              variant="outline"
            />
          </View>
        ) : members.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No Members Found</Text>
            <Text style={styles.emptyMessage}>No organization members found in the database.</Text>
            <Button title="Refresh" onPress={() => loadMembers(true)} variant="outline" />
          </View>
        ) : (
          <View style={styles.membersGrid}>
            {members.map((member) => {
              const photoCount = getMemberPhotoCount(member.id);
              const thumbnail = getMemberThumbnail(member.id);
              
              return (
                <View key={member.id} style={styles.memberCard}>
                  <View style={styles.memberHeader}>
                    <View style={styles.memberAvatar}>
                      {thumbnail ? (
                        <Image source={{ uri: thumbnail }} style={styles.avatarImage} />
                      ) : (
                        <Text style={styles.avatarText}>👤</Text>
                      )}
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      <Text style={styles.memberEmail}>{member.email}</Text>
                      {member.role && (
                        <Text style={styles.memberRole}>{member.role}</Text>
                      )}
                    </View>
                  </View>
                  
                  <View style={styles.memberFooter}>
                    <Text style={styles.photoCount}>{photoCount}/5 photos</Text>
                    
                    <View style={styles.memberActions}>
                      {photoCount > 0 && (
                        <Button
                          title="View"
                          onPress={() => handleViewPhotos(member.id)}
                          variant="outline"
                          size="sm"
                          style={styles.actionButton}
                        />
                      )}
                      
                      {photoCount < 5 && (
                        <>
                          <Button
                            title="Camera"
                            onPress={() => handleTakePhoto(member.id)}
                            size="sm"
                            style={styles.actionButton}
                            disabled={isUploading}
                          />
                          <Button
                            title="Gallery"
                            onPress={() => handleSelectPhoto(member.id)}
                            variant="outline"
                            size="sm"
                            style={styles.actionButton}
                            disabled={isUploading}
                          />
                        </>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Photo Modal */}
      <Modal visible={showPhotoModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Photos ({selectedPhotos.length})</Text>
              <TouchableOpacity onPress={() => setShowPhotoModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {selectedPhotos.length > 0 && (
              <>
                <Image 
                  source={{ uri: selectedPhotos[selectedPhotoIndex]?.imageurl }} 
                  style={styles.modalImage}
                  resizeMode="contain"
                />
                
                <View style={styles.modalActions}>
                  <Button
                    title="Delete"
                    onPress={() => {
                      const currentPhoto = selectedPhotos[selectedPhotoIndex];
                      const memberId = currentPhoto.takenbyuserId;
                      handleDeletePhoto(currentPhoto.id, memberId);
                    }}
                    variant="outline"
                    size="sm"
                  />
                  
                  {selectedPhotos.length > 1 && (
                    <View style={styles.navigationButtons}>
                      <Button
                        title="Previous"
                        onPress={() => setSelectedPhotoIndex(prev => 
                          prev > 0 ? prev - 1 : selectedPhotos.length - 1
                        )}
                        variant="outline"
                        size="sm"
                      />
                      <Button
                        title="Next"
                        onPress={() => setSelectedPhotoIndex(prev => 
                          prev < selectedPhotos.length - 1 ? prev + 1 : 0
                        )}
                        variant="outline"
                        size="sm"
                      />
                    </View>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 32,
    height: 32,
    backgroundColor: '#2563eb',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  logoText: {
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userInfo: {
    alignItems: 'flex-end',
    marginRight: 12,
  },
  userName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  orgName: {
    fontSize: 12,
    color: '#6b7280',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    paddingVertical: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  loadingContainer: {
    height: 200,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorCard: {
    backgroundColor: '#ffffff',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#dc2626',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    marginBottom: 8,
  },
  signOutButton: {
    marginTop: 8,
  },
  emptyContainer: {
    backgroundColor: '#ffffff',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  membersGrid: {
    paddingBottom: 24,
  },
  memberCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 48,
    height: 48,
  },
  avatarText: {
    fontSize: 20,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  memberEmail: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  memberRole: {
    fontSize: 12,
    color: '#6b7280',
    textTransform: 'capitalize',
  },
  memberFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  photoCount: {
    fontSize: 14,
    color: '#6b7280',
  },
  memberActions: {
    flexDirection: 'row',
  },
  actionButton: {
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    fontSize: 24,
    color: '#6b7280',
  },
  modalImage: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navigationButtons: {
    flexDirection: 'row',
  },
});

export default OrgHomeScreen;