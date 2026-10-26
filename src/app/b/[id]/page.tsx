import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BookmarkDetail } from "@/components/detail";
import { ThemeToggle } from "@/components/theme-toggle";
import { getBookmark } from "@/lib/data";

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bookmark = await getBookmark(id);
  if (!bookmark) notFound();
  return <BookmarkDetail b={bookmark} />;
}

export default function BookmarkPage({ params }: PageProps<"/b/[id]">) {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-20 sm:px-8">
      <div className="flex h-16 items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 text-[14px] text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-4" /> All bookmarks
        </Link>
        <ThemeToggle className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink" />
      </div>
      <div className="animate-rise mt-4 rounded-[28px] bg-surface p-5 shadow-card ring-1 ring-line sm:p-8">
        <Suspense fallback={<div className="shimmer h-80 rounded-2xl" />}>
          <Content params={params} />
        </Suspense>
      </div>
    </main>
  );
}
