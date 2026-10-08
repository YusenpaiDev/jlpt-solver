import { notFound } from "next/navigation";
import { HonixPreview } from "@/components/honix/HonixPreview";

export default function HonixPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <HonixPreview />;
}
