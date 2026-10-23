"use client";

import { EmailHtmlBody } from "@/app/[locale]/(routes)/emails/components/EmailHtmlBody";
import {
  EmailBodyCard,
  EmailReadCanvas,
} from "@/app/[locale]/(routes)/emails/components/EmailReadCanvas";

type Props = {
  bodyText?: string | null;
  bodyHtml?: string | null;
  fromName?: string | null;
  fromEmail?: string | null;
  sentAt?: Date | string | null;
  toLabel?: string;
};

export function EmailConversationBody({
  bodyText,
  bodyHtml,
}: Props) {
  if (bodyHtml?.trim()) {
    return (
      <EmailReadCanvas>
        <EmailBodyCard>
          <EmailHtmlBody bodyHtml={bodyHtml} className="rounded-xl" />
        </EmailBodyCard>
      </EmailReadCanvas>
    );
  }

  const plain = bodyText?.trim() ?? "";
  if (!plain) {
    return (
      <EmailReadCanvas>
        <p className="text-sm text-muted-foreground">(No content)</p>
      </EmailReadCanvas>
    );
  }

  return (
    <EmailReadCanvas className="pb-4">
      <EmailBodyCard>
        <div className="px-5 py-5 sm:px-8 sm:py-6">
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/95">
            {plain}
          </p>
        </div>
      </EmailBodyCard>
    </EmailReadCanvas>
  );
}
