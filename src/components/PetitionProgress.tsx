"use client";

import { useEffect, useState } from "react";

const MILESTONES = [100, 500, 1_000, 5_000, 10_000] as const;

interface PetitionProgressProps {
  currentCount: number;
  className?: string;
}

function getGoal(current: number): number {
  for (const m of MILESTONES) {
    if (current < m) return m;
  }
  // Past all milestones — round up to next 10k
  return Math.ceil((current + 1) / 10_000) * 10_000;
}

function formatNumber(n: number): string {
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}k`;
  return n.toLocaleString();
}

export function PetitionProgress({
  currentCount,
  className = "",
}: PetitionProgressProps) {
  const goal = getGoal(currentCount);
  const percentage = Math.min((currentCount / goal) * 100, 100);
  const justHitMilestone = MILESTONES.includes(currentCount as (typeof MILESTONES)[number]);

  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (justHitMilestone && currentCount > 0) {
      setAnimate(true);
      const timeout = setTimeout(() => setAnimate(false), 2000);
      return () => clearTimeout(timeout);
    }
  }, [justHitMilestone, currentCount]);

  return (
    <div className={`rounded-lg border border-gray-200 bg-white px-5 py-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">
          Petition Signatures
        </h3>
        <span className="text-sm text-gray-500">
          {formatNumber(currentCount)} of {formatNumber(goal)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            animate ? "bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 bg-[length:200%_100%] animate-shimmer" : "bg-purple-600"
          }`}
          style={{ width: `${Math.max(percentage, currentCount > 0 ? 2 : 0)}%` }}
          role="progressbar"
          aria-valuenow={currentCount}
          aria-valuemin={0}
          aria-valuemax={goal}
        />
      </div>

      {/* Milestone markers */}
      <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
        <span>{currentCount > 0 ? `${Math.round(percentage)}% to goal` : "No signatures yet"}</span>
        {justHitMilestone && currentCount > 0 && (
          <span className={`font-semibold text-purple-600 ${animate ? "animate-bounce" : ""}`}>
            {formatNumber(currentCount)} milestone reached!
          </span>
        )}
      </div>

      {/* Next milestone hint */}
      {currentCount > 0 && !justHitMilestone && (
        <p className="mt-1 text-xs text-gray-400">
          {formatNumber(goal - currentCount)} more needed to reach{" "}
          {formatNumber(goal)}
        </p>
      )}
    </div>
  );
}
