import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listOrders from "./tools/list-orders";
import getOrder from "./tools/get-order";
import searchCustomers from "./tools/search-customers";
import listOpenBills from "./tools/list-open-bills";
import listInquiries from "./tools/list-inquiries";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "3dmuscio-dashboard",
  title: "3dMuscio Dashboard",
  version: "0.1.0",
  instructions:
    "Werkzeuge für das 3DMuscio Dashboard (3D-Druckservice). Aufträge, Kunden, Rechnungen und Anfragen lesen. Alle Zugriffe laufen als der angemeldete Benutzer mit dessen Berechtigungen.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listOrders, getOrder, searchCustomers, listOpenBills, listInquiries],
});
