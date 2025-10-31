import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BrandingUploadProps {
  label: string;
  currentUrl?: string;
  onUpload: (url: string) => void;
  bucket: string;
  acceptedTypes: string[];
  type: "logo" | "favicon";
}

export const BrandingUpload = ({
  label,
  currentUrl,
  onUpload,
  bucket,
  acceptedTypes,
  type,
}: BrandingUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | undefined>(currentUrl);
  const { toast } = useToast();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!acceptedTypes.includes(fileExtension)) {
      toast({
        title: "Invalid file type",
        description: `Please upload one of: ${acceptedTypes.join(', ')}`,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${type}_${Date.now()}.${fileExt}`;

      // Upload to storage
      const { data, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      setPreview(publicUrl);
      onUpload(publicUrl);

      toast({
        title: "Upload successful",
        description: `${label} has been uploaded.`,
      });
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleClear = () => {
    setPreview(undefined);
    onUpload('');
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      
      {preview ? (
        <div className="relative inline-block">
          <div className="border rounded-lg p-4 bg-muted/50">
            {type === 'logo' ? (
              <img 
                src={preview} 
                alt={label}
                className="max-w-[200px] max-h-[100px] object-contain"
              />
            ) : (
              <img 
                src={preview} 
                alt={label}
                className="w-8 h-8 object-contain"
              />
            )}
          </div>
          <Button
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 h-6 w-6"
            onClick={handleClear}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
          <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-4">
            {type === 'logo' ? 'Upload logo image' : 'Upload favicon'}
          </p>
          <label htmlFor={`upload-${label}`}>
            <Button
              variant="outline"
              disabled={uploading}
              asChild
            >
              <span>
                <Upload className="mr-2 h-4 w-4" />
                {uploading ? 'Uploading...' : 'Choose File'}
              </span>
            </Button>
          </label>
          <input
            id={`upload-${label}`}
            type="file"
            accept={acceptedTypes.join(',')}
            onChange={handleFileChange}
            className="hidden"
            disabled={uploading}
          />
          <p className="text-xs text-muted-foreground mt-2">
            Accepted: {acceptedTypes.join(', ')}
          </p>
        </div>
      )}
    </div>
  );
};
