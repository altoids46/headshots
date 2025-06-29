import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Upload, X, RotateCcw, Check, AlertCircle } from 'lucide-react';
import Button from '../ui/Button';

interface PhotoCaptureProps {
  onCapture: (file: File) => void;
  onCancel: () => void;
  isUploading?: boolean;
}

const PhotoCapture: React.FC<PhotoCaptureProps> = ({
  onCapture,
  onCancel,
  isUploading = false,
}) => {
  const [mode, setMode] = useState<'select' | 'camera' | 'upload'>('select');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if device supports camera
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const supportsCamera = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const startCamera = useCallback(async () => {
    setError(null);
    setIsInitializing(true);
    
    try {
      console.log('📷 PhotoCapture: Starting camera...');
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user', // Front camera for selfies
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
      
      setMode('camera');
      console.log('✅ PhotoCapture: Camera started successfully');
      
    } catch (err: any) {
      console.error('❌ PhotoCapture: Camera access error:', err);
      setError('Unable to access camera. Please check permissions or use file upload instead.');
    } finally {
      setIsInitializing(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    console.log('🛑 PhotoCapture: Stopping camera...');
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stream]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    console.log('📸 PhotoCapture: Capturing photo...');
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to blob
    canvas.toBlob((blob) => {
      if (blob) {
        const imageUrl = URL.createObjectURL(blob);
        setCapturedImage(imageUrl);
        stopCamera();
        console.log('✅ PhotoCapture: Photo captured successfully');
      }
    }, 'image/jpeg', 0.8);
  }, [stopCamera]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('📁 PhotoCapture: File selected:', file.name);

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file.');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB.');
      return;
    }

    const imageUrl = URL.createObjectURL(file);
    setCapturedImage(imageUrl);
    setMode('upload');
    console.log('✅ PhotoCapture: File uploaded successfully');
  }, []);

  const confirmCapture = useCallback(() => {
    if (!capturedImage) return;

    console.log('✅ PhotoCapture: Confirming photo capture...');

    // Convert captured image to file
    if (canvasRef.current) {
      canvasRef.current.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `headshot-${Date.now()}.jpg`, {
            type: 'image/jpeg'
          });
          onCapture(file);
        }
      }, 'image/jpeg', 0.8);
    } else if (fileInputRef.current?.files?.[0]) {
      // Use uploaded file
      onCapture(fileInputRef.current.files[0]);
    }
  }, [capturedImage, onCapture]);

  const retakePhoto = useCallback(() => {
    console.log('🔄 PhotoCapture: Retaking photo...');
    setCapturedImage(null);
    setError(null);
    if (mode === 'camera') {
      startCamera();
    } else {
      setMode('select');
    }
  }, [mode, startCamera]);

  const handleCancel = useCallback(() => {
    console.log('❌ PhotoCapture: Cancelling photo capture...');
    
    // Wrap in try-catch to prevent errors from bubbling up
    try {
      stopCamera();
      if (capturedImage) {
        URL.revokeObjectURL(capturedImage);
      }
      onCancel();
    } catch (error) {
      console.error('⚠️ PhotoCapture: Error during cancel:', error);
      // Still call onCancel to ensure UI state is reset
      onCancel();
    }
  }, [stopCamera, capturedImage, onCancel]);

  // Mode selection screen
  if (mode === 'select') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-6 max-w-sm w-full">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Add Photo</h3>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-error-50 border border-error-200 text-error-700 rounded-md flex items-center">
              <AlertCircle size={16} className="mr-2 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <div className="space-y-3">
            {/* Mobile file input with camera capture */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                fullWidth
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center"
              >
                <Camera size={20} className="mr-2" />
                {isMobile ? 'Take Photo' : 'Use Camera'}
              </Button>
            </div>

            {/* Desktop camera access */}
            {!isMobile && supportsCamera && (
              <Button
                fullWidth
                onClick={startCamera}
                disabled={isInitializing}
                isLoading={isInitializing}
                className="flex items-center justify-center"
                variant="outline"
              >
                <Camera size={20} className="mr-2" />
                Use Webcam
              </Button>
            )}

            {/* File upload option */}
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                ref={fileInputRef}
              />
              <Button
                variant="outline"
                fullWidth
                onClick={() => {
                  // Create a new input for regular file upload (without capture)
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) {
                      handleFileUpload({ target: { files: [file] } } as any);
                    }
                  };
                  input.click();
                }}
                className="flex items-center justify-center"
              >
                <Upload size={20} className="mr-2" />
                Upload from Device
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Camera capture screen
  if (mode === 'camera' && !capturedImage) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col z-50">
        <div className="flex-1 relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />
          
          {/* Camera controls */}
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/50 to-transparent">
            <div className="flex items-center justify-center space-x-8">
              <button
                onClick={handleCancel}
                className="text-white hover:text-gray-300 transition-colors"
              >
                <X size={32} />
              </button>
              
              <button
                onClick={capturePhoto}
                className="bg-white rounded-full p-4 hover:bg-gray-100 transition-colors"
              >
                <Camera size={32} className="text-gray-900" />
              </button>
              
              <div className="w-8" /> {/* Spacer for symmetry */}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Preview captured image
  if (capturedImage) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-6 max-w-md w-full">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Preview Photo</h3>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <div className="mb-6">
            <img
              src={capturedImage}
              alt="Captured photo"
              className="w-full h-64 object-cover rounded-lg"
            />
          </div>

          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={retakePhoto}
              className="flex-1 flex items-center justify-center"
            >
              <RotateCcw size={16} className="mr-2" />
              Retake
            </Button>
            <Button
              onClick={confirmCapture}
              disabled={isUploading}
              isLoading={isUploading}
              className="flex-1 flex items-center justify-center"
            >
              <Check size={16} className="mr-2" />
              Use Photo
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default PhotoCapture;