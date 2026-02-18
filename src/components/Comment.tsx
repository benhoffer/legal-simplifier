"use client";

import { useState } from "react";

export interface CommentData {
  id: string;
  content: string;
  upvotes: number;
  downvotes: number;
  deletedAt: string | null;
  createdAt: string;
  user: { id: string; name: string | null; clerkId: string };
  replies?: CommentData[];
}

interface CommentProps {
  comment: CommentData;
  policyAuthorClerkId: string;
  currentClerkId: string | null;
  depth: number;
  onReply: (parentId: string, content: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onVote: (commentId: string, vote: "up" | "down") => Promise<{ upvotes: number; downvotes: number }>;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

export function Comment({
  comment,
  policyAuthorClerkId,
  currentClerkId,
  depth,
  onReply,
  onDelete,
  onVote,
}: CommentProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [upvotes, setUpvotes] = useState(comment.upvotes);
  const [downvotes, setDownvotes] = useState(comment.downvotes);
  const [voting, setVoting] = useState<"up" | "down" | null>(null);

  const isDeleted = comment.deletedAt != null;
  const isOwnComment = currentClerkId != null && comment.user.clerkId === currentClerkId;
  const isPolicyAuthor = comment.user.clerkId === policyAuthorClerkId;
  const score = upvotes - downvotes;

  async function handleVote(vote: "up" | "down") {
    if (!currentClerkId || voting) return;
    setVoting(vote);

    // Optimistic
    if (vote === "up") setUpvotes((v) => v + 1);
    else setDownvotes((v) => v + 1);

    try {
      const result = await onVote(comment.id, vote);
      setUpvotes(result.upvotes);
      setDownvotes(result.downvotes);
    } catch {
      // Rollback
      if (vote === "up") setUpvotes((v) => v - 1);
      else setDownvotes((v) => v - 1);
    } finally {
      setVoting(null);
    }
  }

  async function handleReply() {
    if (!replyContent.trim()) return;
    setIsReplying(true);
    try {
      await onReply(comment.id, replyContent.trim());
      setReplyContent("");
      setShowReplyForm(false);
    } catch {
      // Keep form open on error
    } finally {
      setIsReplying(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await onDelete(comment.id);
    } catch {
      setIsDeleting(false);
    }
  }

  return (
    <div className={depth > 0 ? "ml-8 border-l-2 border-gray-100 pl-4" : ""}>
      <div className="py-3">
        {isDeleted ? (
          <p className="text-sm italic text-gray-400">[deleted]</p>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-gray-900">
                {comment.user.name ?? "Anonymous"}
              </span>
              {isPolicyAuthor && (
                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                  Author
                </span>
              )}
              <span className="text-gray-400">
                {relativeTime(comment.createdAt)}
              </span>
            </div>

            {/* Content */}
            <p className="mt-1 text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">
              {comment.content}
            </p>

            {/* Actions */}
            <div className="mt-2 flex items-center gap-3">
              {/* Voting */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleVote("up")}
                  disabled={!currentClerkId || voting != null}
                  className="rounded p-1 text-gray-400 hover:bg-green-50 hover:text-green-600 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                  aria-label="Upvote"
                >
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                  </svg>
                </button>
                <span
                  className={`min-w-[1.5rem] text-center text-xs font-medium ${
                    score > 0
                      ? "text-green-600"
                      : score < 0
                        ? "text-red-500"
                        : "text-gray-500"
                  }`}
                >
                  {score}
                </span>
                <button
                  type="button"
                  onClick={() => handleVote("down")}
                  disabled={!currentClerkId || voting != null}
                  className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                  aria-label="Downvote"
                >
                  <svg className="h-4 w-4 rotate-180" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              {/* Reply button - only for top-level comments */}
              {depth === 0 && currentClerkId && (
                <button
                  type="button"
                  onClick={() => setShowReplyForm(!showReplyForm)}
                  className="text-xs font-medium text-gray-500 hover:text-gray-700"
                >
                  Reply
                </button>
              )}

              {/* Delete button */}
              {isOwnComment && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="text-xs font-medium text-gray-400 hover:text-red-500 disabled:opacity-50"
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              )}
            </div>

            {/* Reply form */}
            {showReplyForm && (
              <div className="mt-3">
                <textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Write a reply..."
                  rows={2}
                  maxLength={2000}
                  disabled={isReplying}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                />
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleReply}
                    disabled={isReplying || !replyContent.trim()}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isReplying ? "Posting..." : "Post Reply"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowReplyForm(false);
                      setReplyContent("");
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div>
          {comment.replies.map((reply) => (
            <Comment
              key={reply.id}
              comment={reply}
              policyAuthorClerkId={policyAuthorClerkId}
              currentClerkId={currentClerkId}
              depth={depth + 1}
              onReply={onReply}
              onDelete={onDelete}
              onVote={onVote}
            />
          ))}
        </div>
      )}
    </div>
  );
}
