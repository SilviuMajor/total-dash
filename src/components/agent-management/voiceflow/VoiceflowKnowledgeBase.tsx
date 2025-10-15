import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, Trash2, FileText, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface VoiceflowKnowledgeBaseProps {
  agent: {
    id: string;
    name: string;
    config: Record<string, any>;
  };
}

export function VoiceflowKnowledgeBase({ agent }: VoiceflowKnowledgeBaseProps) {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDocuments();
  }, [agent.id]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('voiceflow-kb', {
        body: {
          action: 'list',
          agentId: agent.id,
        },
      });

      if (error) throw error;
      setDocuments(data.documents.data || []);
    } catch (error) {
      console.error('Error loading documents:', error);
      toast({
        title: "Error",
        description: "Failed to load knowledge base documents",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Only PDF, TXT, and DOCX files are supported",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const fileData = e.target?.result as string;

        const { data, error } = await supabase.functions.invoke('voiceflow-kb', {
          body: {
            action: 'upload',
            agentId: agent.id,
            fileData,
            fileName: file.name,
            fileType: file.type,
          },
        });

        if (error) throw error;

        toast({
          title: "Success",
          description: `${file.name} uploaded successfully`,
        });

        loadDocuments();
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Error",
        description: "Failed to upload document",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (documentId: string, documentName: string) => {
    if (!confirm(`Are you sure you want to delete "${documentName}"?`)) return;

    try {
      const { error } = await supabase.functions.invoke('voiceflow-kb', {
        body: {
          action: 'delete',
          agentId: agent.id,
          documentId,
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Document deleted successfully",
      });

      loadDocuments();
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Error",
        description: "Failed to delete document",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold mb-2">Knowledge Base</h2>
            <p className="text-sm text-muted-foreground">
              Manage documents that train your Voiceflow agent's responses.
            </p>
          </div>
          <div>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.docx"
              onChange={handleFileUpload}
              className="hidden"
              id="kb-file-upload"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Document
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
          <strong>Supported formats:</strong> PDF, TXT, DOCX
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No documents uploaded yet</p>
            <p className="text-xs mt-1">Upload your first document to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.documentID}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      {doc.data?.name || 'Untitled Document'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-muted-foreground">
                        Updated {format(new Date(doc.updatedAt), 'PPp')}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {doc.status?.type || 'UNKNOWN'}
                      </Badge>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(doc.documentID, doc.data?.name)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
