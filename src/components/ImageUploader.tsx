import React, { useState, useEffect } from 'react';

interface ImageUploaderProps {
  onImageSelect?: (file: File) => void;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelect }) => {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Bloquear scroll de la página cuando el modal está abierto
  useEffect(() => {
    if (showImageModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    // Limpiar al desmontar
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showImageModal]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setUploadedImage(dataUrl);
        if (onImageSelect) {
          onImageSelect(file);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadBoxClick = () => {
    document.getElementById('imageUploadInput')?.click();
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoomLevel - 0.25, 0.5);
    setZoomLevel(newZoom);
    // Resetear posición si vuelve a zoom normal
    if (newZoom <= 1) {
      setPosition({ x: 0, y: 0 });
    }
  };

  const handleCloseModal = () => {
    setShowImageModal(false);
    setZoomLevel(1);
    setPosition({ x: 0, y: 0 });
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      // Scroll hacia arriba - hacer zoom in
      setZoomLevel(prev => Math.min(prev + 0.1, 3));
    } else {
      // Scroll hacia abajo - hacer zoom out
      const newZoom = Math.max(zoomLevel - 0.1, 0.5);
      setZoomLevel(newZoom);
      // Resetear posición si vuelve a zoom normal
      if (newZoom <= 1) {
        setPosition({ x: 0, y: 0 });
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoomLevel > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (zoomLevel > 1 && e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && zoomLevel > 1 && e.touches.length === 1) {
      const touch = e.touches[0];
      setPosition({
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y,
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const styles: { [key: string]: React.CSSProperties } = {
    uploadBox: {
      border: '2px dashed #bdc3c7',
      borderRadius: '10px',
      padding: '30px',
      textAlign: 'center',
      backgroundColor: '#fff',
      cursor: 'pointer',
      transition: 'border-color 0.3s ease',
      position: 'relative',
      minHeight: '200px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    uploadInput: {
      display: 'none',
    },
    uploadText: {
      color: '#7f8c8d',
      fontSize: '1.1em',
      marginBottom: '10px',
    },
    thumbnailContainer: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      maxWidth: '400px',
    },
    thumbnail: {
      maxWidth: '100%',
      maxHeight: '350px',
      borderRadius: '8px',
      display: 'block',
      cursor: 'pointer',
      objectFit: 'contain',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    },
    expandIcon: {
      position: 'absolute',
      top: '10px',
      right: '10px',
      backgroundColor: 'rgba(0,0,0,0.7)',
      color: 'white',
      borderRadius: '50%',
      width: '40px',
      height: '40px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '1.3em',
      cursor: 'pointer',
      transition: 'background-color 0.3s ease',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    },
    modal: {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0,0,0,0.95)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      overflow: 'hidden',
    },
    modalImageContainer: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
      padding: '20px',
    },
    modalImage: {
      maxWidth: '100%',
      maxHeight: '100%',
      objectFit: 'contain',
      transition: 'transform 0.3s ease',
      userSelect: 'none',
    },
    closeButton: {
      position: 'fixed',
      top: '20px',
      right: '20px',
      backgroundColor: '#e74c3c',
      color: 'white',
      border: 'none',
      borderRadius: '50%',
      width: '50px',
      height: '50px',
      fontSize: '1.5em',
      cursor: 'pointer',
      fontWeight: 'bold',
      transition: 'background-color 0.3s ease',
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      zIndex: 1002,
    },
    zoomControls: {
      position: 'fixed',
      bottom: '30px',
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      backgroundColor: 'rgba(0,0,0,0.8)',
      padding: '15px 25px',
      borderRadius: '15px',
      alignItems: 'center',
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      zIndex: 1002,
    },
    zoomButtonsRow: {
      display: 'flex',
      gap: '10px',
      alignItems: 'center',
    },
    zoomButton: {
      backgroundColor: '#3498db',
      color: 'white',
      border: 'none',
      borderRadius: '50%',
      width: '40px',
      height: '40px',
      fontSize: '1.3em',
      cursor: 'pointer',
      fontWeight: 'bold',
      transition: 'background-color 0.3s ease, transform 0.2s ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    zoomText: {
      color: 'white',
      fontSize: '1em',
      fontWeight: 'bold',
      minWidth: '60px',
      textAlign: 'center',
    },
    zoomHint: {
      color: '#95a5a6',
      fontSize: '0.75em',
      textAlign: 'center',
      marginTop: '5px',
    },
  } as { [key: string]: React.CSSProperties };

  return (
    <>
      <div style={styles.uploadBox} onClick={handleUploadBoxClick}>
        <input
          id="imageUploadInput"
          type="file"
          accept="image/*"
          style={styles.uploadInput}
          onChange={handleImageUpload}
        />

        {uploadedImage ? (
          <div style={styles.thumbnailContainer}>
            <img
              src={uploadedImage}
              alt="Vista previa"
              style={styles.thumbnail}
              onClick={(e) => {
                e.stopPropagation();
                setShowImageModal(true);
              }}
            />
            <div
              style={styles.expandIcon}
              onClick={(e) => {
                e.stopPropagation();
                setShowImageModal(true);
              }}
              title="Ver en grande"
            >
              🔍
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={styles.uploadText}>📁 Haz clic para seleccionar una imagen</div>
            <div style={{ color: '#95a5a6', fontSize: '0.9em' }}>
              Formatos aceptados: JPG, PNG, GIF
            </div>
          </div>
        )}
      </div>

      {showImageModal && uploadedImage && (
        <div style={styles.modal} onClick={handleCloseModal}>
          <button
            style={styles.closeButton}
            onClick={handleCloseModal}
          >
            ✕
          </button>
          
          <div 
            style={styles.modalImageContainer}
            onClick={(e) => e.stopPropagation()}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <img
              src={uploadedImage}
              alt="Imagen ampliada"
              style={{
                ...styles.modalImage,
                transform: `translate(${position.x}px, ${position.y}px) scale(${zoomLevel})`,
                cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                transition: isDragging ? 'none' : 'transform 0.3s ease',
              }}
              draggable={false}
            />
          </div>

          <div 
            style={styles.zoomControls}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.zoomButtonsRow}>
              <button
                style={styles.zoomButton}
                onClick={handleZoomOut}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2980b9'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3498db'}
                title="Alejar"
              >
                −
              </button>
              <span style={styles.zoomText}>{Math.round(zoomLevel * 100)}%</span>
              <button
                style={styles.zoomButton}
                onClick={handleZoomIn}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2980b9'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3498db'}
                title="Acercar"
              >
                +
              </button>
            </div>
            <div style={styles.zoomHint}>
              {zoomLevel > 1 ? '🖱️ Arrastra para mover | Rueda para zoom' : '🖱️ Usa la rueda del mouse'}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ImageUploader;
