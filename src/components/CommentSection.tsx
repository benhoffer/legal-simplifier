"use client";

import { useCallback, useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Comment, type CommentData } from "@/components/Comment";

const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

type SortMode = "newest" | "popular" | "controversial";

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "popular", label: "Popular" },
  { value: "controversial", label: "Controversial" },
];

interface CommentSectionProps {
  policyId: string;
  policyAuthorClerkId: string;
}

function useCurrentClerk() {
  if (!clerkEnabled) {
    return { clerkId: "demo-user", isSignedIn: true, isLoaded: true };
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { user, isSignedIn, isLoaded } = useUser();
  return { clerkId: user?.id ?? null, isSignedIn: isSignedIn ?? false, isLoaded: isLoaded ?? false };
}

export function CommentSection({
  policyId,
  policyAuthorClerkId,
}: CommentSectionProps) {
  const router = useRouter();
  const { clerkId, isSignedIn, isLoaded } = useCurrentClerk();

  const [comments, setComments] = useState<CommentData[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [sort, setSort] = useState<SortMode>("newest");
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // New comment form
  const [newComment, setNewComment] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [postError, setPostError] = useState("");

  const fetchComments = useCallback(
    async (sortMode: SortMode, cursor?: string | null) => {
      const loading = cursor ? setIsLoadingMore : setIsLoading;
      loading(true);

      try {
        const url = new URL(
          `/api/policies/${policyId}/comments`,
          window.location.origin
        );
        url.searchParams.set("sort", sortMode);
        if (cursor) url.searchParams.set("cursor", cursor);

        const res = await fetch(url.toString());
        if (!res.ok) return;

        const data = await res.json();

        if (cursor) {
          setComments((prev) => [...prev, ...data.comments]);
        } else {
          setComments(data.comments);
        }
        setTotalCount(data.totalCount);
        setHasMore(data.hasMore);
        setNextCursor(data.nextCursor);
      } catch {
        // Silently fail
      } finally {
        loading(false);
      }
    },
    [policyId]
  );

  useEffect(() => {
    fetchComments(sort);
  }, [fetchComments, sort]);

  async function handlePost() {
    if (!newComment.trim()) return;
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }

    setIsPosting(true);
    setPostError("");

    try {
      const res = await fetch(`/api/policies/${policyId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setPostError(data.error || "Failed to post comment.");
        return;
      }

      // Add new comment to top of list with empty replies
      const created: CommentData = { ...data.comment, replies: [] };
      setComments((prev) => [created, ...prev]);
      setTotalCount((c) => c + 1);
      setNewComment("");
    } catch {
      setPostError("Could not connect to the server.");
    } finally {
      setIsPosting(false);
    }
  }

  async function handleReply(parentId: string, content: string) {
    const res = await fetch(`/api/policies/${policyId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, parentId }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to post reply.");
    }

    // Add reply to parent comment
    setComments((prev) =>
      prev.map((c) =>
        c.id === parentId
          ? { ...c, replies: [...(c.replies || []), data.comment] }
          : c
      )
    );
    setTotalCount((c) => c + 1);
  }

  async function handleDelete(commentId: string) {
    const res = await fetch(`/api/comments/${commentId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to delete comment.");
    }

    // Mark as deleted in local state
    setComments((prev) =>
      prev.map((c) => {
        if (c.id === commentId) {
          return { ...c, deletedAt: new Date().toISOString() };
        }
        // Check replies
        if (c.replies) {
          return {
            ...c,
            replies: c.replies.map((r) =>
              r.id === commentId
                ? { ...r, deletedAt: new Date().toISOString() }
                : r
            ),
          };
        }
        return c;
      }).filter((c) => {
        // Remove top-level deleted comments with no replies
        if (c.deletedAt && (!c.replies || c.replies.length === 0)) return false;
        return true;
      })
    );
    setTotalCount((c) => c - 1);
  }

  async function handleVote(
    commentId: string,
    vote: "up" | "down"
  ): Promise<{ upvotes: number; downvotes: number }> {
    const res = await fetch(`/api/comments/${commentId}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vote }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to vote.");
    }

    return res.json();
  }

  return (
    <section className="mt-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Comments ({totalCount})
        </h2>

        <div className="flex items-center gap-1.5">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSort(opt.value)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                sort === opt.value
                  ? "bg-gray-900 text-white"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* New comment form */}
      {isLoaded && (
        <div className="mt-4">
          {isSignedIn ? (
            <div>
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                rows={3}
                maxLength={2000}
                disabled={isPosting}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {newComment.length}/2000
                </span>
                <button
                  type="button"
                  onClick={handlePost}
                  disabled={isPosting || !newComment.trim()}
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isPosting ? "Posting..." : "Post Comment"}
                </button>
              </div>
              {postError && (
                <p className="mt-1 text-sm text-red-600">{postError}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              <button
                type="button"
                onClick={() => router.push("/sign-in")}
                className="font-medium text-blue-600 hover:text-blue-700"
              >
                Sign in
              </button>{" "}
              to leave a comment.
            </p>
          )}
        </div>
      )}

      {/* Comments list */}
      <div className="mt-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <svg
              className="h-5 w-5 animate-spin text-gray-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </div>
        ) : comments.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">
            No comments yet. Be the first to share your thoughts!
          </p>
        ) : (
          <>
            <div className="divide-y divide-gray-100">
              {comments.map((comment) => (
                <Comment
                  key={comment.id}
                  comment={comment}
                  policyAuthorClerkId={policyAuthorClerkId}
                  currentClerkId={clerkId}
                  depth={0}
                  onReply={handleReply}
                  onDelete={handleDelete}
                  onVote={handleVote}
                />
              ))}
            </div>

            {hasMore && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => fetchComments(sort, nextCursor)}
                  disabled={isLoadingMore}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {isLoadingMore ? "Loading..." : "Load More Comments"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
