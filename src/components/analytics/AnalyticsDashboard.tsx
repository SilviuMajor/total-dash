import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import GridLayout, { Layout } from "react-grid-layout";
import { MetricCard, AnalyticsCardData } from "./MetricCard";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { AddCardModal, NewCardData } from "./AddCardModal";
import { useAuth } from "@/hooks/useAuth";
import debounce from "lodash.debounce";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

interface AnalyticsDashboardProps {
  tabId: string;
  metrics: any;
  isEditMode: boolean;
}

export function AnalyticsDashboard({ tabId, metrics, isEditMode }: AnalyticsDashboardProps) {
  const { profile } = useAuth();
  const [cards, setCards] = useState<AnalyticsCardData[]>([]);
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCardModal, setShowAddCardModal] = useState(false);

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (!tabId) return;
    fetchCards();

    // Setup realtime subscription
    const channel = supabase
      .channel(`analytics_cards_${tabId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "analytics_cards",
          filter: `tab_id=eq.${tabId}`
        },
        () => {
          fetchCards();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tabId]);

  const fetchCards = async () => {
    try {
      const { data, error } = await supabase
        .from("analytics_cards")
        .select("*")
        .eq("tab_id", tabId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setCards(data as AnalyticsCardData[] || []);
      
      const gridLayouts = (data || []).map((card) => {
        const pos = card.grid_position as any;
        return {
          i: card.id,
          x: pos?.x || 0,
          y: pos?.y || 0,
          w: pos?.w || 4,
          h: pos?.h || 4,
          minW: 2,
          minH: 2
        };
      });
      
      setLayouts(gridLayouts);
    } catch (error) {
      console.error("Error fetching cards:", error);
      toast.error("Failed to load analytics cards");
    } finally {
      setLoading(false);
    }
  };

  const updateCardPositions = useCallback(
    debounce(async (newLayout: Layout[]) => {
      try {
        for (const layout of newLayout) {
          await supabase
            .from("analytics_cards")
            .update({
              grid_position: {
                x: layout.x,
                y: layout.y,
                w: layout.w,
                h: layout.h
              }
            })
            .eq("id", layout.i);
        }
      } catch (error) {
        console.error("Error updating card positions:", error);
      }
    }, 500),
    []
  );

  const handleLayoutChange = (newLayout: Layout[]) => {
    setLayouts(newLayout);
  };

  const handleDragStop = (newLayout: Layout[]) => {
    updateCardPositions(newLayout);
  };

  const handleResizeStop = (newLayout: Layout[]) => {
    updateCardPositions(newLayout);
  };

  const handleToggleExpand = async (cardId: string) => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    try {
      const { error } = await supabase
        .from("analytics_cards")
        .update({ is_expanded: !card.is_expanded })
        .eq("id", cardId);

      if (error) throw error;

      setCards(cards.map(c => 
        c.id === cardId ? { ...c, is_expanded: !c.is_expanded } : c
      ));
    } catch (error) {
      console.error("Error toggling card:", error);
      toast.error("Failed to update card");
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    try {
      const { error } = await supabase
        .from("analytics_cards")
        .delete()
        .eq("id", cardId);

      if (error) throw error;

      setCards(cards.filter(c => c.id !== cardId));
      toast.success("Card deleted successfully");
    } catch (error) {
      console.error("Error deleting card:", error);
      toast.error("Failed to delete card");
    }
  };

  const handleAddCard = async (cardData: NewCardData) => {
    const maxY = layouts.length > 0 
      ? Math.max(...layouts.map(item => item.y + item.h))
      : 0;

    const newCardPosition = {
      ...cardData.grid_position,
      y: maxY,
    };

    try {
      const { data, error } = await supabase
        .from("analytics_cards")
        .insert({
          tab_id: tabId,
          title: cardData.title,
          metric_type: cardData.metric_type,
          card_type: cardData.card_type,
          chart_type: cardData.chart_type,
          grid_position: newCardPosition,
          is_expanded: false,
          config: {},
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        toast.success("Card created successfully");
      }
    } catch (error) {
      console.error("Error creating card:", error);
      toast.error("Failed to create card");
    }
  };

  const handleDuplicateCard = async (cardId: string) => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    const layout = layouts.find(l => l.i === cardId);
    if (!layout) return;

    try {
      const { error } = await supabase
        .from("analytics_cards")
        .insert({
          tab_id: tabId,
          title: `${card.title} (Copy)`,
          metric_type: card.metric_type,
          card_type: card.card_type,
          is_expanded: false,
          config: card.config,
          grid_position: {
            x: (layout.x + layout.w) % 12,
            y: layout.y,
            w: layout.w,
            h: layout.h,
          },
        });

      if (error) throw error;

      toast.success("Card duplicated successfully");
    } catch (error) {
      console.error("Error duplicating card:", error);
      toast.error("Failed to duplicate card");
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96">Loading...</div>;
  }

  return (
    <div className="p-6">
      {isAdmin && (
        <div className="mb-4 flex justify-end">
          <Button size="sm" className="gap-2" onClick={() => setShowAddCardModal(true)}>
            <Plus className="h-4 w-4" />
            Add Card
          </Button>
        </div>
      )}

      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-96 border-2 border-dashed border-border rounded-lg">
          <p className="text-muted-foreground mb-4">No cards yet. Add your first metric card!</p>
          {isAdmin && (
            <Button className="gap-2" onClick={() => setShowAddCardModal(true)}>
              <Plus className="h-4 w-4" />
              Add Card
            </Button>
          )}
        </div>
      ) : (
        <GridLayout
          className="layout"
          layout={layouts}
          cols={12}
          rowHeight={80}
          width={1200}
          onLayoutChange={handleLayoutChange}
          onDragStop={handleDragStop}
          onResizeStop={handleResizeStop}
          draggableHandle=".card-drag-handle"
          isDraggable={isEditMode}
          isResizable={isEditMode}
        >
          {cards.map(card => (
            <div key={card.id}>
              <MetricCard
                card={card}
                metrics={metrics}
                onToggleExpand={handleToggleExpand}
                onDelete={handleDeleteCard}
                onDuplicate={handleDuplicateCard}
                isEditMode={isEditMode}
              />
            </div>
          ))}
        </GridLayout>
      )}

      <AddCardModal
        isOpen={showAddCardModal}
        onClose={() => setShowAddCardModal(false)}
        onSubmit={handleAddCard}
        tabId={tabId}
      />
    </div>
  );
}
