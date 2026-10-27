export type FeatureKey =
  | "emails"
  | "marketing"
  | "sales"
  | "leads"
  | "contacts"
  | "contracts"
  | "canva"
  | "linkedin";

export interface FeatureMeta {
  key: FeatureKey;
  label: string;
  description: string;
  iconName: string;
  defaultPath: string;
}

export const SUPPORTED_FEATURES: FeatureMeta[] = [
  {
    key: "emails",
    label: "E-mails",
    description: "Primary mailbox used for reading, composing, and replying in the Email module.",
    iconName: "Mail",
    defaultPath: "/emails",
  },
  {
    key: "leads",
    label: "Leads",
    description: "Default mailbox used for single and bulk email outreach to new leads.",
    iconName: "UserCheck",
    defaultPath: "/crm/leads",
  },
  {
    key: "contacts",
    label: "Contacts",
    description: "Default sender mailbox for direct client communication and follow-ups.",
    iconName: "Users",
    defaultPath: "/crm/contacts",
  },
  {
    key: "sales",
    label: "Sales & Opportunities",
    description: "Mailbox used when sending deal proposals, quotes, and opportunity updates.",
    iconName: "TrendingUp",
    defaultPath: "/crm/opportunities",
  },
  {
    key: "contracts",
    label: "Contracts",
    description: "Mailbox used for contract delivery, legal agreements, and signing requests.",
    iconName: "FileCheck",
    defaultPath: "/crm/contracts",
  },
  {
    key: "marketing",
    label: "Email Marketing & Campaigns",
    description: "Default sender mailbox for email campaigns, broadcasts, and audience templates.",
    iconName: "Megaphone",
    defaultPath: "/campaigns",
  },
  {
    key: "canva",
    label: "Canva Integration",
    description: "Sender mailbox associated with Canva design sharing and asset approval notifications.",
    iconName: "Palette",
    defaultPath: "/admin/canva",
  },
  {
    key: "linkedin",
    label: "LinkedIn Integration",
    description: "Mailbox used for LinkedIn lead notifications and outreach synchronizations.",
    iconName: "Linkedin",
    defaultPath: "/admin/linkedin",
  },
];

export const PREF_COOKIE_PREFIX = "crm_email_pref_";
