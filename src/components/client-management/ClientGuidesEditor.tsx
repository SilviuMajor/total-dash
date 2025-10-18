import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Bold, Italic, List, ListOrdered, Heading2, Heading3, ImageIcon, Trash2, Plus } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';

interface GuideSection {
  id: string;
  title: string;
  content: string;
  sort_order: number;
}

interface ClientGuidesEditorProps {
  clientId: string;
}

export function ClientGuidesEditor({ clientId }: ClientGuidesEditorProps) {
  const [sections, setSections] = useState<GuideSection[]>([]);
  const [editingSection, setEditingSection] = useState<GuideSection | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
    ],
    content: editingSection?.content || '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none dark:prose-invert min-h-[200px] focus:outline-none p-4 border rounded-md',
      },
    },
  });

  useEffect(() => {
    loadSections();
  }, [clientId]);

  useEffect(() => {
    if (editor && editingSection) {
      editor.commands.setContent(editingSection.content);
    }
  }, [editingSection, editor]);

  const loadSections = async () => {
    const { data } = await supabase
      .from('client_settings')
      .select('custom_guide_sections')
      .eq('client_id', clientId)
      .single();

    if (data?.custom_guide_sections && Array.isArray(data.custom_guide_sections)) {
      setSections(data.custom_guide_sections as unknown as GuideSection[]);
    }
  };

  const handleAddSection = () => {
    const newSection: GuideSection = {
      id: uuidv4(),
      title: 'New Guide Section',
      content: '<p>Start writing your guide content here...</p>',
      sort_order: sections.length,
    };
    setEditingSection(newSection);
    setSections([...sections, newSection]);
  };

  const handleDeleteSection = (id: string) => {
    setSections(sections.filter(s => s.id !== id));
    if (editingSection?.id === id) {
      setEditingSection(null);
    }
  };

  const handleSave = async () => {
    if (!editor) return;

    // Update the editing section with current content
    if (editingSection) {
      const updatedSections = sections.map(s =>
        s.id === editingSection.id
          ? { ...s, content: editor.getHTML() }
          : s
      );
      setSections(updatedSections);

      setIsSaving(true);
      try {
        const { error } = await supabase
          .from('client_settings')
          .update({ custom_guide_sections: updatedSections as any })
          .eq('client_id', clientId);

        if (error) throw error;

        toast({
          title: "Guides saved",
          description: "Your guide sections have been updated successfully.",
          duration: 3000,
        });
        
        setEditingSection(null);
        await loadSections();
      } catch (error) {
        console.error('Error saving guides:', error);
        toast({
          title: "Error",
          description: "Failed to save guides. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleImageUpload = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image smaller than 5MB.",
          variant: "destructive",
        });
        return;
      }

      try {
        const fileName = `${uuidv4()}-${file.name}`;
        const filePath = `client-${clientId}/guides/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('widget-assets')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('widget-assets')
          .getPublicUrl(filePath);

        editor?.chain().focus().setImage({ src: publicUrl }).run();
      } catch (error) {
        console.error('Error uploading image:', error);
        toast({
          title: "Upload failed",
          description: "Failed to upload image. Please try again.",
          variant: "destructive",
        });
      }
    };
    input.click();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Custom Guide Sections</CardTitle>
        <CardDescription>
          Create custom documentation and guides for your users. These will appear in the Guides page.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Guide Sections</Label>
            <Button onClick={handleAddSection} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Section
            </Button>
          </div>
          
          {sections.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No guide sections yet. Click "Add Section" to create one.
            </div>
          ) : (
            <div className="space-y-2">
              {sections.map((section) => (
                <div
                  key={section.id}
                  className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50 cursor-pointer"
                  onClick={() => setEditingSection(section)}
                >
                  <span className="font-medium">{section.title}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSection(section.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {editingSection && editor && (
          <div className="space-y-4 border-t pt-6">
            <div className="space-y-2">
              <Label>Section Title</Label>
              <Input
                value={editingSection.title}
                onChange={(e) => {
                  const updated = { ...editingSection, title: e.target.value };
                  setEditingSection(updated);
                  setSections(sections.map(s => s.id === updated.id ? updated : s));
                }}
                placeholder="Enter section title"
              />
            </div>

            <div className="space-y-2">
              <Label>Content</Label>
              <div className="border rounded-md">
                <div className="flex items-center gap-1 p-2 border-b bg-muted/50">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={editor.isActive('bold') ? 'bg-muted' : ''}
                  >
                    <Bold className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={editor.isActive('italic') ? 'bg-muted' : ''}
                  >
                    <Italic className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    className={editor.isActive('heading', { level: 2 }) ? 'bg-muted' : ''}
                  >
                    <Heading2 className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                    className={editor.isActive('heading', { level: 3 }) ? 'bg-muted' : ''}
                  >
                    <Heading3 className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={editor.isActive('bulletList') ? 'bg-muted' : ''}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={editor.isActive('orderedList') ? 'bg-muted' : ''}
                  >
                    <ListOrdered className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleImageUpload}
                  >
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                </div>
                <EditorContent editor={editor} />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setEditingSection(null)}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
