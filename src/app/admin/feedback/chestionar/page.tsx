import { redirect } from "next/navigation";

/** The questionnaire moved to its own admin section: /admin/chestionar. */
export default async function OldSurveyPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  redirect(id ? `/admin/chestionar?id=${encodeURIComponent(id)}` : "/admin/chestionar");
}
