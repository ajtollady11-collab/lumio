import type { Metadata } from "next";
import { AccountSettings } from "@/components/account/account-settings";

export const metadata: Metadata = { title: "Settings" };

export default function StudentSettingsPage() {
  return <AccountSettings from="/app/settings" />;
}
