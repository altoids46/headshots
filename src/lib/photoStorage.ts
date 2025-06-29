import { supabase } from './supabase';

export interface PhotoUploadResult {
  success: boolean;
  data?: {
    id: string;
    imageurl: string;
    takenbyuserId: string;
  };
  error?: string;
}

export interface Photo {
  id: string;
  takenbyuserId: string;
  imageurl: string;
  created_at: string;
}

const STORAGE_BUCKET = 'photos'; // Using default bucket name, update if different
const MAX_PHOTOS_PER_USER = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Helper function to generate unique file name
const generateFileName = (organizationId: string, userId: string, originalName: string): string => {
  const timestamp = Date.now();
  const extension = originalName.split('.').pop() || 'jpg';
  const cleanName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${organizationId}/${userId}/${timestamp}_${cleanName}`;
};

// Resilient database operation wrapper
const withRetry = async <T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = 2
): Promise<T> => {
  let lastError: any = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 PhotoStorage: ${operationName} - Attempt ${attempt}/${maxRetries}`);
      const result = await operation();
      console.log(`✅ PhotoStorage: ${operationName} - Success on attempt ${attempt}`);
      return result;
    } catch (error: any) {
      lastError = error;
      console.warn(`⚠️ PhotoStorage: ${operationName} - Attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * attempt, 2000);
        console.log(`⏳ PhotoStorage: ${operationName} - Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
};

// Upload photo to Supabase storage and save metadata to database
export const uploadPhoto = async (
  file: File,
  userId: string,
  organizationId: string
): Promise<PhotoUploadResult> => {
  try {
    console.log('📸 PhotoStorage: Starting photo upload for user:', userId);
    
    // Validate file
    if (!file.type.startsWith('image/')) {
      return { success: false, error: 'File must be an image' };
    }
    
    if (file.size > MAX_FILE_SIZE) {
      return { success: false, error: 'File size must be less than 10MB' };
    }

    // Check current photo count with retry - FIXED: Using correct column name with capital I
    console.log('🔢 PhotoStorage: Checking current photo count...');
    
    const { data: existingPhotos, error: countError } = await withRetry(
      () => supabase
        .from('photos')
        .select('id')
        .eq('takenbyuserId', userId) // FIXED: Capital I
        .limit(10),
      'Photo count check'
    );

    if (countError) {
      console.error('❌ PhotoStorage: Error checking photo count:', countError);
      return { success: false, error: 'Failed to check existing photos' };
    }

    if (existingPhotos && existingPhotos.length >= MAX_PHOTOS_PER_USER) {
      return { 
        success: false, 
        error: `Maximum of ${MAX_PHOTOS_PER_USER} photos allowed per member` 
      };
    }

    // Generate unique file name
    const fileName = generateFileName(organizationId, userId, file.name);
    console.log('📁 PhotoStorage: Generated file name:', fileName);

    // Upload to Supabase storage with retry
    console.log('☁️ PhotoStorage: Uploading to storage...');
    const { data: uploadData, error: uploadError } = await withRetry(
      () => supabase.storage
        .from(STORAGE_BUCKET)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        }),
      'Storage upload'
    );

    if (uploadError) {
      console.error('❌ PhotoStorage: Storage upload error:', uploadError);
      return { success: false, error: 'Failed to upload photo to storage' };
    }

    console.log('✅ PhotoStorage: File uploaded to storage:', uploadData.path);

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(fileName);

    if (!urlData.publicUrl) {
      console.error('❌ PhotoStorage: Failed to get public URL');
      return { success: false, error: 'Failed to get photo URL' };
    }

    console.log('🔗 PhotoStorage: Public URL generated:', urlData.publicUrl);

    // Save metadata to database with retry - FIXED: Using correct column name with capital I
    console.log('💾 PhotoStorage: Saving metadata to database...');
    const { data: photoData, error: dbError } = await withRetry(
      () => supabase
        .from('photos')
        .insert([
          {
            takenbyuserId: userId, // FIXED: Capital I
            imageurl: urlData.publicUrl,
          }
        ])
        .select()
        .single(),
      'Database insert'
    );

    if (dbError) {
      console.error('❌ PhotoStorage: Database insert error:', dbError);
      
      // Clean up uploaded file if database insert fails
      try {
        await supabase.storage
          .from(STORAGE_BUCKET)
          .remove([fileName]);
      } catch (cleanupError) {
        console.warn('⚠️ PhotoStorage: Failed to cleanup uploaded file:', cleanupError);
      }
      
      return { success: false, error: 'Failed to save photo metadata' };
    }

    console.log('✅ PhotoStorage: Photo upload completed successfully');
    
    return {
      success: true,
      data: {
        id: photoData.id,
        imageurl: photoData.imageurl,
        takenbyuserId: photoData.takenbyuserId, // FIXED: Capital I
      }
    };

  } catch (error: any) {
    console.error('💥 PhotoStorage: Unexpected error during upload:', error);
    return { success: false, error: 'An unexpected error occurred during upload' };
  }
};

// Get all photos for a user with retry - FIXED: Using correct column name with capital I
export const getUserPhotos = async (userId: string): Promise<{ data: Photo[] | null; error: string | null }> => {
  try {
    console.log('📋 PhotoStorage: Fetching photos for user:', userId);
    
    const { data, error } = await withRetry(
      () => supabase
        .from('photos')
        .select('*')
        .eq('takenbyuserId', userId) // FIXED: Capital I
        .limit(10)
        .order('created_at', { ascending: false }),
      'User photos fetch'
    );

    if (error) {
      console.error('❌ PhotoStorage: Error fetching photos:', error);
      return { data: null, error: 'Failed to fetch photos' };
    }

    console.log('✅ PhotoStorage: Fetched photos:', data?.length || 0);
    return { data: data as Photo[], error: null };

  } catch (error: any) {
    console.error('💥 PhotoStorage: Error fetching photos:', error);
    return { data: null, error: 'Photo fetch failed. Please try again.' };
  }
};

// Delete a photo with retry
export const deletePhoto = async (photoId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('🗑️ PhotoStorage: Deleting photo:', photoId);
    
    // First, get the photo data to get the file path
    const { data: photo, error: fetchError } = await withRetry(
      () => supabase
        .from('photos')
        .select('imageurl, takenbyuserId') // FIXED: Capital I
        .eq('id', photoId)
        .single(),
      'Photo fetch for deletion'
    );

    if (fetchError || !photo) {
      console.error('❌ PhotoStorage: Error fetching photo for deletion:', fetchError);
      return { success: false, error: 'Photo not found' };
    }

    // Extract file path from URL
    const url = new URL(photo.imageurl);
    const pathParts = url.pathname.split('/');
    // Assuming the path structure is /storage/v1/object/public/bucket/org/user/filename
    const fileName = pathParts.slice(-3).join('/'); // Get organization_id/user_id/filename

    console.log('📁 PhotoStorage: Extracted file path:', fileName);

    // Delete from database first with retry
    const { error: dbError } = await withRetry(
      () => supabase
        .from('photos')
        .delete()
        .eq('id', photoId),
      'Database delete'
    );

    if (dbError) {
      console.error('❌ PhotoStorage: Error deleting from database:', dbError);
      return { success: false, error: 'Failed to delete photo record' };
    }

    // Delete from storage (don't retry storage operations as aggressively)
    try {
      const { error: storageError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove([fileName]);

      if (storageError) {
        console.warn('⚠️ PhotoStorage: Error deleting from storage (continuing):', storageError);
        // Don't fail the operation if storage deletion fails
      }
    } catch (storageError) {
      console.warn('⚠️ PhotoStorage: Storage deletion failed (continuing):', storageError);
    }

    console.log('✅ PhotoStorage: Photo deleted successfully');
    return { success: true };

  } catch (error: any) {
    console.error('💥 PhotoStorage: Unexpected error during deletion:', error);
    return { success: false, error: 'An unexpected error occurred during deletion' };
  }
};

// Get photos for multiple users (for organization view) with retry - FIXED: Using correct column name with capital I
export const getOrganizationPhotos = async (userIds: string[]): Promise<{ data: Record<string, Photo[]> | null; error: string | null }> => {
  try {
    console.log('🏢 PhotoStorage: Fetching organization photos for users:', userIds.length);
    
    if (userIds.length === 0) {
      return { data: {}, error: null };
    }
    
    const { data, error } = await withRetry(
      () => supabase
        .from('photos')
        .select('*')
        .in('takenbyuserId', userIds) // FIXED: Capital I
        .limit(250) // Limit to prevent large queries
        .order('created_at', { ascending: false }),
      'Organization photos fetch'
    );

    if (error) {
      console.error('❌ PhotoStorage: Error fetching organization photos:', error);
      return { data: null, error: 'Failed to fetch organization photos' };
    }

    // Group photos by takenbyuserId - FIXED: Capital I
    const photosByUser: Record<string, Photo[]> = {};
    userIds.forEach(userId => {
      photosByUser[userId] = [];
    });

    data?.forEach(photo => {
      if (photosByUser[photo.takenbyuserId]) { // FIXED: Capital I
        photosByUser[photo.takenbyuserId].push(photo as Photo); // FIXED: Capital I
      }
    });

    console.log('✅ PhotoStorage: Fetched organization photos successfully');
    return { data: photosByUser, error: null };

  } catch (error: any) {
    console.error('💥 PhotoStorage: Error fetching organization photos:', error);
    return { data: null, error: 'Organization photos fetch failed. Please try again.' };
  }
};