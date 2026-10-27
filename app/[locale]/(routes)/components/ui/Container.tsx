import Heading from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import React from "react";
import { FeatureEmailSettingsButton } from "@/components/email/FeatureEmailSettingsButton";
import type { FeatureKey } from "@/lib/email/feature-preferences";

interface ContainerProps {
  title: string;
  description: string;
  visibility?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
  feature?: FeatureKey;
}

const Container = ({
  title,
  description,
  visibility,
  children,
  className,
  action,
  feature,
}: ContainerProps) => {
  const resolvedAction =
    action !== undefined
      ? action
      : feature
      ? <FeatureEmailSettingsButton feature={feature} />
      : null;

  return (
    <div className={cn("flex h-full w-full flex-1 flex-col", className)}>
      <Heading
        title={title}
        description={description}
        visibility={visibility}
        action={resolvedAction}
      />
      <Separator className="my-3 bg-border/60 sm:my-5" />
      <div className="flex-1 min-h-0 w-full">
        {children}
      </div>
    </div>
  );
};

export default Container;
