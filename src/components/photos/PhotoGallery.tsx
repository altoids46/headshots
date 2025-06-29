import React, { useState } from 'react';
import { X, Trash2, Eye, Calendar } from 'lucide-react';
import Button from '../ui/Button';

interface Photo {
  id: string;
  imageurl: string;
  created_at: string;
}

interface PhotoGalleryProps {
  photos: Photo[];
  onDelete: (photoId: string) => void;
  isDeleting?: boolean;
  onClose: () => void;
}

const PhotoGallery: React.FC<PhotoGalleryProps> = ({
  photos,
  onDelete,
  isDeleting = false,
  onClose,
}) => {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDelete = (photoId: string) => {
    if (deleteConfirm === photoId) {
      onDelete(photoId);
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(photoId);
      // Auto-cancel delete confirmation after 3 seconds
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  // Full-screen photo viewer
  if (selectedPhoto) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
        <div className="relative max-w-4xl max-h-full p-4">
          <button
            onClick={() => setSelectedPhoto(null)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-10"
          >
            <X size={32} />
          </button>
          
          <img
            src={selectedPhoto.imageurl}
            alt="Member photo"
            className="max-w-full max-h-full object-contain rounded-lg"
          />
          
          <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-50 text-white p-4 rounded-lg">
            <div className="flex items-center text-sm text-gray-300">
              <Calendar size={14} className="mr-1" />
              {formatDate(selectedPhoto.created_at)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b">
          <h3 className="text-xl font-semibold text-gray-900">
            Photos ({photos.length}/5)
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {photos.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <Eye size={48} className="mx-auto" />
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">No Photos Yet</h4>
              <p className="text-gray-500">Photos will appear here once uploaded.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative group bg-gray-50 rounded-lg overflow-hidden"
                >
                  <div className="aspect-square">
                    <img
                      src={photo.imageurl}
                      alt="Member photo"
                      className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-200"
                      onClick={() => setSelectedPhoto(photo)}
                    />
                  </div>
                  
                  {/* Photo overlay with actions */}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-200 flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-2">
                      <button
                        onClick={() => setSelectedPhoto(photo)}
                        className="bg-white text-gray-900 p-2 rounded-full hover:bg-gray-100 transition-colors"
                        title="View full size"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(photo.id)}
                        disabled={isDeleting}
                        className={`p-2 rounded-full transition-colors ${
                          deleteConfirm === photo.id
                            ? 'bg-error-600 text-white hover:bg-error-700'
                            : 'bg-white text-error-600 hover:bg-error-50'
                        }`}
                        title={deleteConfirm === photo.id ? 'Click again to confirm' : 'Delete photo'}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Photo info */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                    <div className="text-white text-xs">
                      <div className="text-gray-300">
                        {formatDate(photo.created_at)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {photos.length > 0 && (
          <div className="border-t p-4 bg-gray-50">
            <p className="text-sm text-gray-600 text-center">
              Click on any photo to view full size. You can upload up to 5 photos per member.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PhotoGallery;