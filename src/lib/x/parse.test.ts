import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/bookmarks-page.json";
import { parseBookmarksPage } from "./parse";

describe("parseBookmarksPage", () => {
  const page = parseBookmarksPage(fixture);

  it("reads tweets in order, skipping tombstones, and finds the bottom cursor", () => {
    expect(page.valid).toBe(true);
    expect(page.bookmarks.map((b) => b.id)).toEqual([
      "1800000000000000001",
      "1800000000000000002",
      "1800000000000000003",
    ]);
    expect(page.nextCursor).toBe("NEXT_CURSOR");
  });

  it("cleans text: drops reply mentions and media links, expands t.co, decodes entities", () => {
    const [photo] = page.bookmarks;
    expect(photo.text).toBe("Look at this view > anything https://example.com/post");
    expect(photo.authorName).toBe("Ada & Co");
    expect(photo.authorAvatar).toBe("https://pbs.twimg.com/profile_images/1/a_bigger.jpg");
    expect(photo.authorVerified).toBe(true);
    expect(photo.kind).toBe("photo");
    expect(photo.media).toEqual([
      { type: "photo", url: "https://pbs.twimg.com/media/AAA.jpg", width: 1600, height: 900, alt: "A valley" },
    ]);
    expect(photo.metrics).toEqual({ likes: 1200, reposts: 35, replies: 12, views: 15234 });
    expect(photo.sortIndex).toBe("1829384756123456789");
  });

  it("handles visibility wrappers, legacy user fields, note tweets and quotes", () => {
    const note = page.bookmarks[1];
    expect(note.authorHandle).toBe("oldschema");
    expect(note.text).toBe("A very long note tweet that goes beyond 280 characters.");
    expect(note.kind).toBe("text");
    expect(note.quote).toMatchObject({ id: "9", authorHandle: "quoted", text: "Original thought" });
  });

  it("picks a sensible mp4 rendition for videos", () => {
    const video = page.bookmarks[2];
    expect(video.kind).toBe("video");
    expect(video.text).toBe("");
    expect(video.media[0].videoUrl).toBe("https://video.twimg.com/mid.mp4");
  });

  it("flags responses without a bookmark timeline as invalid", () => {
    expect(parseBookmarksPage({ data: {} }).valid).toBe(false);
    expect(parseBookmarksPage({ errors: [{ message: "x" }] }).valid).toBe(false);
  });
});

describe("parseBookmarksPage on the October 2026 response shape", async () => {
  const real = (await import("./__fixtures__/bookmarks-2026.json")).default;
  const page = parseBookmarksPage(real);
  const [reply, linkNote, photoNote] = page.bookmarks;

  it("reads entries and the bottom cursor", () => {
    expect(page.bookmarks).toHaveLength(3);
    expect(page.nextCursor).toBe("HBb++eWWibXUlDQAAA==");
  });

  it("hides the reply-to mention but keeps the ones X displays", () => {
    expect(reply.text).toBe("@grok Describe Revolut’s GTM in detail.");
    expect(reply.authorVerified).toBe(true);
    expect(reply.metrics.views).toBe(1410);
  });

  it("uses note text, expands links and builds the card from vanity_url", () => {
    expect(linkNote.kind).toBe("link");
    expect(linkNote.text).toContain("Apply here: https://www.rug.nl/education/scholarships/eric-bleumink-fellowship?lang=en");
    expect(linkNote.text).toContain("& get in");
    expect(linkNote.card).toMatchObject({
      title: "Eric Bleumink Fellowship",
      domain: "rug.nl",
      url: "https://www.rug.nl/education/scholarships/eric-bleumink-fellowship?lang=en",
    });
  });

  it("keeps media from legacy entities on note tweets", () => {
    expect(photoNote.kind).toBe("photo");
    expect(photoNote.media[0]).toMatchObject({ width: 1600, height: 900 });
    expect(photoNote.text).toBe("Netflix can wait.\n\n1. Life After Code\n- http://gitlab-transcend.devpost.com");
  });
});
