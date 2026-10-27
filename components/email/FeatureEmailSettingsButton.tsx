"use client";

import Link from "next/link";
import { Mail, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { FeatureKey } from "@/lib/email/feature-preferences";

interface FeatureEmailSettingsButtonProps {
  feature: FeatureKey;
  label?: string;
  variant?: "outline" | "ghost" | "secondary" | "default";
  size?: "sm" | "default" | "icon";
  showLabel?: boolean;
  className?: string;
}

const FEATURE_NAMES: Record<FeatureKey, string> = {
  emails: "E-mails",
  marketing: "Marketing & Campaigns",
  sales: "Sales & Deals",
  leads: "Leads",
  contacts: "Contacts",
  contracts: "Contracts",
  canva: "Canva Integration",
  linkedin: "LinkedIn Integration",
};

export function FeatureEmailSettingsButton({
  feature,
  label,
  variant = "outline",
  size = "sm",
  showLabel = true,
  className,
}: FeatureEmailSettingsButtonProps) {
  const featureLabel = label || FEATURE_NAMES[feature] || "Feature";
  const tooltipText = `Email settings for ${featureLabel}`;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            asChild
            variant={variant}
            size={size}
            className={cn(
              "relative h-9 gap-2 rounded-lg border-border/60 bg-background/80 shadow-xs transition-all hover:border-primary/40 hover:bg-muted/70",
              className
            )}
            aria-label={tooltipText}
          >
            <Link href={`/emails/settings?feature=${feature}`}>
              <div className="relative flex items-center justify-center">
                <Mail className="h-4 w-4 text-primary shrink-0" />
                <Settings className="absolute -bottom-1 -right-1 h-2.5 w-2.5 text-muted-foreground" />
              </div>
              {showLabel && (
                <span className="hidden text-xs font-medium sm:inline">
                  Email settings
                </span>
              )}
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" className="text-xs">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
