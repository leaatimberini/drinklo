import { CoursePlayer } from "../../components/course-player";

export default async function CoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ courseKey: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await params;
  const sp = await searchParams;
  return <CoursePlayer courseKey={decodeURIComponent(p.courseKey)} searchParams={sp} />;
}

