import { Lock } from "lucide-react";
import React from "react";

interface HeadingProps {
  title: string;
  description: string;
  visibility?: string;
  action?: React.ReactNode;
}

const Heading = ({ title, description, visibility, action }: HeadingProps) => {
  const desc = description?.trim();
  const showDescription =
    Boolean(desc) && desc!.toLowerCase() !== title.trim().toLowerCase();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1.5 min-w-0 flex-1">
        <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
          {visibility === "private" ? <Lock className="h-5 w-5 text-muted-foreground" /> : null}
        </h2>
        {showDescription ? (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{desc}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0 sm:self-center">{action}</div> : null}
    </div>
  );
};

export default Heading;
