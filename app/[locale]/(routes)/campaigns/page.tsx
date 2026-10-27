import { getCampaigns } from "@/actions/campaigns/get-campaigns";
import CampaignsView from "./components/CampaignsView";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FeatureEmailSettingsButton } from "@/components/email/FeatureEmailSettingsButton";

export default async function CampaignsPage() {
  const campaigns = await getCampaigns();
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <p className="text-muted-foreground">Manage your email campaigns</p>
        </div>
        <div className="flex items-center gap-2">
          <FeatureEmailSettingsButton feature="marketing" />
          <Button asChild>
            <Link href="/campaigns/new">+ New Campaign</Link>
          </Button>
        </div>
      </div>
      <CampaignsView data={campaigns} />
    </div>
  );
}
