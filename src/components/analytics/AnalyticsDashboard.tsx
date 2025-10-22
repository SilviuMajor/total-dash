import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import GridLayout, { Layout } from "react-grid-layout";
import { MetricCard, AnalyticsCardData } from "./MetricCard";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

interface AnalyticsDashboardProps {
  tabId: string;
  metrics: any;
}

export function AnalyticsDashboard({ tabId, metrics }: AnalyticsDashboardProps) {
  const [cards, setCards] = useState<AnalyticsCardData[]>([]);
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleLayoutChange = async (newLayout: Layout[]) => {
    setLayouts(newLayout);

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

  if (loading) {
    return <div className="flex items-center justify-center h-96">Loading...</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex justify-end">
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Card
        </Button>
      </div>

      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-96 border-2 border-dashed border-border rounded-lg">
          <p className="text-muted-foreground mb-4">No cards yet. Add your first metric card!</p>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Card
          </Button>
        </div>
      ) : (
        <GridLayout
          className="layout"
          layout={layouts}
          cols={12}
          rowHeight={80}
          width={1200}
          onLayoutChange={handleLayoutChange}
          draggableHandle=".card-drag-handle"
          isDraggable
          isResizable
        >
          {cards.map(card => (
            <div key={card.id} className="card-drag-handle">
              <MetricCard
                card={card}
                metrics={metrics}
                onToggleExpand={handleToggleExpand}
                onDelete={handleDeleteCard}
              />
            </div>
          ))}
        </GridLayout>
      )}
    </div>
  );
}
