import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SectionCardsProps {
  data: {
    title: string;
    value: string;
    badge: string;
    trend: string;
    description: string;
    footer: string;
  }[];
  className?: string; // Added className
}

export function SectionCards({ data, className }: SectionCardsProps) {
  return (
    <div
      className={cn(
        "*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4",
        className
      )}
    >
      {data.map((item, index) => (
        <Card className="@container/card h-full">
          <CardHeader>
            <CardDescription>{item.title}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {item.value}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                {item.trend === "up" ? (
                  <IconTrendingUp />
                ) : (
                  <IconTrendingDown />
                )}
                {item.badge}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              {item.description}{" "}
              {item.trend === "up" ? (
                <IconTrendingUp className="size-4" />
              ) : (
                <IconTrendingDown className="size-4" />
              )}
            </div>
            <div className="text-muted-foreground">{item.footer}</div>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
