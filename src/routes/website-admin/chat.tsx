import { createFileRoute } from "@tanstack/react-router";
import ChatPage from "@/pages/ChatPage";

export const Route = createFileRoute("/website-admin/chat")({
  head: () => ({ meta: [
    { title: "Website-Chat | 3DMuscio Verwaltung" },
    { name: "description", content: "Nachrichten von Website-Besuchern bei 3DMuscio bearbeiten." },
    { property: "og:title", content: "Website-Chat | 3DMuscio Verwaltung" },
    { property: "og:description", content: "Nachrichten von Website-Besuchern bei 3DMuscio bearbeiten." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ChatPage,
});
