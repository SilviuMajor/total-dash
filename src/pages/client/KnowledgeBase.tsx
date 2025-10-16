import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Loader2, Link } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useClientAgentContext } from "@/hooks/useClientAgentContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function KnowledgeBase() {
  const { selectedAgentId, agents } = useClientAgentContext();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUrlDialog, setShowUrlDialog] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [urlName, setUrlName] = useState("");
  const [uploadingUrl, setUploadingUrl] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  useEffect(() => {
    if (selectedAgentId) {
      loadDocuments();
    }
  }, [selectedAgentId]);

  const loadDocuments = async () => {
    if (!selectedAgentId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('voiceflow-kb', {
        body: {
          action: 'list',
          agentId: selectedAgentId,
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
    if (!selectedAgentId) return;
    
    const file = event.target.files?.[0];
    if (!file) return;

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
      const reader = new FileReader();
      reader.onload = async (e) => {
        const fileData = e.target?.result as string;

        const { data, error } = await supabase.functions.invoke('voiceflow-kb', {
          body: {
            action: 'upload',
            agentId: selectedAgentId,
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

  const handleUrlUpload = async () => {
    if (!selectedAgentId) return;

    if (!urlInput.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid URL",
        variant: "destructive",
      });
      return;
    }

    setUploadingUrl(true);
    try {
      const { data, error } = await supabase.functions.invoke('voiceflow-kb', {
        body: {
          action: 'upload-url',
          agentId: selectedAgentId,
          url: urlInput,
          urlName: urlName || urlInput,
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "URL uploaded successfully",
      });

      setShowUrlDialog(false);
      setUrlInput("");
      setUrlName("");
      loadDocuments();
    } catch (error) {
      console.error('URL upload error:', error);
      toast({
        title: "Error",
        description: "Failed to upload URL",
        variant: "destructive",
      });
    } finally {
      setUploadingUrl(false);
    }
  };

  if (!selectedAgent) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-foreground">Knowledge Base</h1>
          <p className="text-muted-foreground">View and manage your agent's knowledge base</p>
        </div>
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">Please select an agent to view its knowledge base</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-foreground">Knowledge Base</h1>
        <p className="text-muted-foreground">View and upload documents for {selectedAgent.name}</p>
      </div>

      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-2">Documents</h2>
              <p className="text-sm text-muted-foreground">
                These documents train your agent's knowledge and responses.
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button disabled={uploading || uploadingUrl}>
                    {uploading || uploadingUrl ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Add to Knowledge Base
                      </>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                    <FileText className="h-4 w-4 mr-2" />
                    Upload Document
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowUrlDialog(true)}>
                    <Link className="h-4 w-4 mr-2" />
                    Add URL
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
            <strong>Supported formats:</strong> PDF, TXT, DOCX, URLs
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
                  className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
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
              ))}
            </div>
          )}
        </div>

        <Dialog open={showUrlDialog} onOpenChange={setShowUrlDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add URL to Knowledge Base</DialogTitle>
              <DialogDescription>
                Enter a URL to add to your agent's knowledge base
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="url">URL</Label>
                <Input
                  id="url"
                  placeholder="https://example.com/page"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="url-name">Name (optional)</Label>
                <Input
                  id="url-name"
                  placeholder="Custom name for this URL"
                  value={urlName}
                  onChange={(e) => setUrlName(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUrlDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleUrlUpload} disabled={uploadingUrl}>
                {uploadingUrl ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add URL"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
    </div>
  );
}
