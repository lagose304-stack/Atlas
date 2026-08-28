import React from 'react';
import PlateAnnotationViewerEditor, { MarkerLocation } from './PlateAnnotationViewerEditor';

export type { MarkerLocation };

export interface SenaladoLocationPickerProps {
  imageSrc: string;
  senaladoLabel: string;
  initialLocation?: MarkerLocation | null;
  initialBatchLocations?: MarkerLocation[];
  required?: boolean;
  batchMode?: boolean;
  batchSaveLabel?: string;
  borderMode?: boolean;
  allowBatchBorders?: boolean;
  onCancel: () => void;
  onSave: (location: MarkerLocation | null) => void;
  onBatchSave?: (locations: MarkerLocation[]) => void;
  onRemove?: () => void;
}

const SenaladoLocationPicker: React.FC<SenaladoLocationPickerProps> = ({
  imageSrc,
  senaladoLabel,
  initialLocation = null,
  initialBatchLocations = [],
  required = false,
  batchMode = false,
  borderMode = false,
  onCancel,
  onSave,
  onBatchSave,
}) => {
  return (
    <PlateAnnotationViewerEditor
      imageSrc={imageSrc}
      targetLabel={senaladoLabel}
      singlePickerMode={!batchMode}
      batchPickerMode={batchMode}
      borderPickerMode={borderMode}
      initialLocation={initialLocation}
      initialBatchLocations={initialBatchLocations}
      required={required}
      onSaveSingle={(loc) => {
        onSave(loc);
      }}
      onSaveBatch={(locs) => {
        if (onBatchSave) {
          onBatchSave(locs);
        } else if (locs.length > 0) {
          onSave(locs[0]);
        } else {
          onSave(null);
        }
      }}
      onSaveAll={(_labels, positions) => {
        if (batchMode && onBatchSave) {
          const validPos = positions.filter((p): p is MarkerLocation => p !== null);
          onBatchSave(validPos);
        } else {
          const firstValid = positions.find((p): p is MarkerLocation => p !== null) ?? null;
          onSave(firstValid);
        }
      }}
      onCancel={onCancel}
    />
  );
};

export default SenaladoLocationPicker;
