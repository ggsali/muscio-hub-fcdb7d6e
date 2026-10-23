import { createFileRoute } from "@tanstack/react-router";
import ChatPage from "@/pages/ChatPage";

export const Route = createFileRoute("/admin/chat")({
  head: () => ({ meta: [
    { title: "Kundenchat | 3DMuscio Admin" },
    { name: "description", content: "Kundenkonversationen und Nachrichten bei 3DMuscio verwalten." },
    { property: "og:title", content: "Kundenchat | 3DMuscio Admin" },
    { property: "og:description", content: "Kundenkonversationen und Nachrichten bei 3DMuscio verwalten." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ChatPage,
});
