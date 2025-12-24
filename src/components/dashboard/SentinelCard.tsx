// React
import { Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// Local - Types
import { Sentinel } from "@/models/schema";

// Local - UI
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface SentinelCardProps {
  sentinel: Sentinel;
}

// ============================================================================
// Component
// ============================================================================

export function SentinelCard({ sentinel }: SentinelCardProps) {
  // Derived state
  const isPending = sentinel.status === "PENDING";
  const triggerDate = new Date(sentinel.triggerDate);
  const relativeTime = formatDistanceToNow(triggerDate, { addSuffix: true });

  // Handlers
  function handleDelete() {
    // TODO: Wire up delete action
    console.log("Delete sentinel:", sentinel.id);
  }

  // Render
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-lg font-semibold">
            {sentinel.eventName}
          </CardTitle>
          <Badge
            variant={isPending ? "default" : "secondary"}
            className={cn(
              isPending
                ? "bg-green-100 text-green-800 hover:bg-green-100"
                : "bg-gray-100 text-gray-600 hover:bg-gray-100"
            )}
          >
            {sentinel.status}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDelete}
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="space-y-2 text-sm">
          <div>
            <span className="text-muted-foreground">Trigger Date: </span>
            <span className="font-medium">{sentinel.triggerDate}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Due: </span>
            <span className="font-medium">{relativeTime}</span>
          </div>
          <p className="text-muted-foreground line-clamp-2 mt-2">
            {sentinel.originalClause}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
