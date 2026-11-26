import { DemoPlayground } from "@/components/demo/DemoPlayground";

export const metadata = {
  title: "Live Demo — LeaseSentinel",
  description:
    "Try LeaseSentinel's AI lease deadline extraction, calendar .ics export, and alert previews without creating an account.",
};

export default function DemoPage() {
  return <DemoPlayground />;
}
