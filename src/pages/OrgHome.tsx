import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { signOut, getOrgMembers } from '../lib/supabase';
import { uploadPhoto, getUserPhotos, deletePhoto, getOrganizationPhotos, Photo } from '../lib/photoStorage';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import PhotoCapture from '../components/photos/PhotoCapture';
import PhotoGallery from '../components/photos/PhotoGallery';
import { 
  Camera, 
  LogOut, 
  User, 
  Users, 
  Mail, 
  Briefcase, 
  Building2, 
  Loader2, 
  AlertCircle, 
  RefreshCw,
  Image,
  Plus,
  X
} from 'lucide-react';

interface OrgMember {
  id: string;
  name: string;
  email: string;
  role: string | null;
  created_at?: string;
}

const OrgHome: React.FC = () => {
  const { profile, user, isLoading: isAuthLoading, error: authError, clearError } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [memberPhotos, setMemberPhotos] = useState<Record<string, Photo[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  // Photo capture states
  const [showPhotoCapture, setShowPhotoCapture] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  // Photo gallery states
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const [galleryMemberId, setGalleryMemberId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
      
      // Increased timeout from 15s to 25s
      const membersPromise = getOrgMembers(profile.organization_id);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Members load timeout after 25s')), 25000)
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
      
      // Load photos for all members with timeout
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
        setTimeout(() => reject(new Error('Photos load timeout')), 20000) // Increased from 12000ms to 20000ms
      );
      
      const { data: photos, error: photosError } = await Promise.race([
        photosPromise,
        timeoutPromise
      ]) as any;
      
      if (photosError) {
        console.error('❌ OrgHome: Error loading member photos:', photosError);
        // Don't fail the whole operation if photos fail to load
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
      navigate('/login');
    } catch (error) {
      console.error('Sign out error:', error);
      // Force navigation even if sign out fails
      navigate('/login');
    }
  };

  const handleRetry = () => {
    loadMembers(true);
  };

  const handleClearAuthError = () => {
    clearError();
  };

  const handleTakePhoto = (memberId: string) => {
    setSelectedMemberId(memberId);
    setShowPhotoCapture(true);
    setUploadError(null);
  };

  const handlePhotoCapture = async (file: File) => {
    if (!selectedMemberId || !profile?.organization_id || !user?.id) {
      setUploadError('Missing required information for upload');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      console.log('📸 OrgHome: Uploading photo for member:', selectedMemberId);
      console.log('👤 OrgHome: Uploaded by user:', user.id);
      
      const result = await uploadPhoto(file, selectedMemberId, profile.organization_id);
      
      if (!result.success) {
        setUploadError(result.error || 'Failed to upload photo');
        return;
      }

      console.log('✅ OrgHome: Photo uploaded successfully');
      
      // Refresh photos for this member
      const { data: updatedPhotos } = await getUserPhotos(selectedMemberId);
      if (updatedPhotos) {
        setMemberPhotos(prev => ({
          ...prev,
          [selectedMemberId]: updatedPhotos
        }));
      }
      
      // Close photo capture modal
      setShowPhotoCapture(false);
      setSelectedMemberId(null);
      
    } catch (error: any) {
      console.error('💥 OrgHome: Error uploading photo:', error);
      setUploadError('An unexpected error occurred during upload');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancelPhotoCapture = () => {
    setShowPhotoCapture(false);
    setSelectedMemberId(null);
    setUploadError(null);
  };

  const handleViewPhotos = (memberId: string) => {
    setGalleryMemberId(memberId);
    setShowPhotoGallery(true);
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!galleryMemberId) return;

    setIsDeleting(true);
    
    try {
      const result = await deletePhoto(photoId);
      
      if (!result.success) {
        console.error('Failed to delete photo:', result.error);
        return;
      }

      // Refresh photos for this member
      const { data: updatedPhotos } = await getUserPhotos(galleryMemberId);
      if (updatedPhotos) {
        setMemberPhotos(prev => ({
          ...prev,
          [galleryMemberId]: updatedPhotos
        }));
      }
      
    } catch (error) {
      console.error('Error deleting photo:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClosePhotoGallery = () => {
    setShowPhotoGallery(false);
    setGalleryMemberId(null);
  };

  const getMemberPhotoCount = (memberId: string): number => {
    return memberPhotos[memberId]?.length || 0;
  };

  const getMemberThumbnail = (memberId: string): string | null => {
    const photos = memberPhotos[memberId];
    return photos && photos.length > 0 ? photos[0].imageurl : null;
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 mx-auto text-primary-600 animate-spin" />
          <p className="mt-4 text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  // Show auth error with option to retry
  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="p-8 max-w-md w-full">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-error-600 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Error</h2>
            <p className="text-gray-600 mb-4">{authError}</p>
            <div className="space-y-2">
              <Button variant="primary" onClick={handleClearAuthError} className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Button variant="outline" onClick={handleSignOut} className="w-full">
                Sign Out
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (!profile?.organization_id || !profile.organizations) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="p-8 max-w-md w-full">
          <div className="text-center">
            <Building2 className="h-12 w-12 mx-auto text-error-600 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Organization Found</h2>
            <p className="text-gray-600 mb-4">
              We couldn't find your organization details. Please check your organization settings or contact support.
            </p>
            <Button variant="outline" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <div className="bg-primary-600 text-white p-2 rounded-md">
              <Camera size={24} />
            </div>
            <h1 className="ml-3 text-xl font-semibold text-gray-900">OrganizationShots</h1>
          </div>
          
          <div className="flex items-center">
            <div className="mr-4 text-right">
              <p className="text-sm font-medium text-gray-900">{profile.name}</p>
              <p className="text-xs text-gray-500 flex items-center justify-end">
                <Building2 size={12} className="mr-1" />
                {profile.organizations.name}
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleSignOut}
              className="flex items-center"
            >
              <LogOut size={16} className="mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 flex items-center">
            <Users className="mr-2" />
            Organization Members
          </h2>
          <p className="mt-1 text-gray-500">
            Members of {profile.organizations.name} ({members.length} {members.length === 1 ? 'member' : 'members'})
          </p>
        </div>

        {isLoading ? (
          <Card className="p-8">
            <div className="flex justify-center items-center">
              <Loader2 className="h-8 w-8 text-primary-600 animate-spin" />
              <span className="ml-3 text-gray-600">Loading members...</span>
            </div>
          </Card>
        ) : error ? (
          <Card className="p-8 bg-error-50 border border-error-200">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-error-600 mb-4" />
              <h3 className="text-lg font-medium text-error-900 mb-2">Failed to Load Members</h3>
              <p className="text-error-600 mb-4">{error}</p>
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  onClick={handleRetry}
                  className="text-error-600 border-error-300 hover:bg-error-50"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again {retryCount > 0 && `(${retryCount})`}
                </Button>
                {retryCount >= 3 && (
                  <p className="text-sm text-gray-500">
                    If this problem persists, please contact support.
                  </p>
                )}
              </div>
            </div>
          </Card>
        ) : members.length === 0 ? (
          <Card className="p-8">
            <div className="text-center">
              <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Members Found</h3>
              <p className="text-gray-500 mb-2">No organization members found in the database.</p>
              <p className="text-sm text-gray-400">
                Organization ID: {profile.organization_id}
              </p>
              <Button 
                variant="outline" 
                onClick={handleRetry}
                className="mt-4"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {members.map((member) => {
              const photoCount = getMemberPhotoCount(member.id);
              const thumbnail = getMemberThumbnail(member.id);
              
              return (
                <Card key={member.id} className="p-6 hover:shadow-lg transition-shadow duration-200">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      {thumbnail ? (
                        <div className="w-12 h-12 rounded-full overflow-hidden">
                          <img
                            src={thumbnail}
                            alt={`${member.name}'s photo`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                          <User className="h-6 w-6 text-primary-600" />
                        </div>
                      )}
                    </div>
                    <div className="ml-4 flex-1 min-w-0">
                      <h3 className="text-lg font-medium text-gray-900 truncate">{member.name}</h3>
                      <div className="mt-1 flex items-center text-sm text-gray-500">
                        <Mail className="h-4 w-4 flex-shrink-0 mr-1" />
                        <span className="truncate">{member.email}</span>
                      </div>
                      {member.role && (
                        <div className="mt-1 flex items-center text-sm text-gray-500">
                          <Briefcase className="h-4 w-4 flex-shrink-0 mr-1" />
                          <span className="truncate capitalize">{member.role}</span>
                        </div>
                      )}
                      {member.created_at && (
                        <div className="mt-2 text-xs text-gray-400">
                          Joined {new Date(member.created_at).toLocaleDateString()}
                        </div>
                      )}
                      
                      {/* Photo count and actions */}
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center text-sm text-gray-500">
                          <Image className="h-4 w-4 mr-1" />
                          <span>{photoCount}/5 photos</span>
                        </div>
                        
                        <div className="flex space-x-2">
                          {photoCount > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewPhotos(member.id)}
                              className="text-xs"
                            >
                              View
                            </Button>
                          )}
                          
                          <Button
                            size="sm"
                            onClick={() => handleTakePhoto(member.id)}
                            disabled={photoCount >= 5}
                            className="text-xs flex items-center"
                          >
                            {photoCount >= 5 ? (
                              'Full'
                            ) : (
                              <>
                                <Plus className="h-3 w-3 mr-1" />
                                Add
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Photo Capture Modal */}
      {showPhotoCapture && (
        <PhotoCapture
          onCapture={handlePhotoCapture}
          onCancel={handleCancelPhotoCapture}
          isUploading={isUploading}
        />
      )}

      {/* Photo Gallery Modal */}
      {showPhotoGallery && galleryMemberId && (
        <PhotoGallery
          photos={memberPhotos[galleryMemberId] || []}
          onDelete={handleDeletePhoto}
          isDeleting={isDeleting}
          onClose={handleClosePhotoGallery}
        />
      )}

      {/* Upload Error Toast */}
      {uploadError && (
        <div className="fixed bottom-4 right-4 bg-error-600 text-white p-4 rounded-lg shadow-lg max-w-sm">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
            <span className="text-sm">{uploadError}</span>
            <button
              onClick={() => setUploadError(null)}
              className="ml-2 text-error-200 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrgHome;