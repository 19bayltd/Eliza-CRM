import { redirect } from "next/navigation";

// Middleware routes authenticated users to /dashboard; this is the fallback.
export default function Home() {
  redirect("/login");
}
