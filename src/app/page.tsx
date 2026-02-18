"use client";

import { useState } from "react";

const READING_LEVELS = [
  {
    value: "5th grade",
    label: "5th Grade",
    description: "Simple words, short sentences",
  },
  {
    value: "high school",
    label: "High School",
    description: "Clear language, terms defined",
  },
  {
    value: "college",
    label: "College",
    description: "Plain English, nuances kept",
  },
] as const;

export default function Home() {
  const [text, setText] = useState("");
  const [readingLevel, setReadingLevel] = useState("high school");
  const [simplified, setSimplified] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSimplify() {
    if (!text.trim()) {
      setError("Please paste some legal text first.");
      return;
    }

    setError("");
    setSimplified("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/simplify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), readingLevel }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }

      setSimplified(data.simplified);
    } catch {
      setError("Failed to connect to the server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Text Simplifier
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Paste legal text and get a plain-language version at your chosen
            reading level.
          </p>
        </div>
        {/* Controls */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-gray-700">
              Reading Level
            </legend>
            <div className="flex gap-2" role="radiogroup">
              {READING_LEVELS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  role="radio"
                  aria-checked={readingLevel === level.value}
                  onClick={() => setReadingLevel(level.value)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    readingLevel === level.value
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                  title={level.description}
                >
                  {level.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setText("");
                setSimplified("");
                setError("");
              }}
              disabled={isLoading || (!text && !simplified)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleSimplify}
              disabled={isLoading || !text.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading && (
                <svg
                  className="h-4 w-4 animate-spin"
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
              )}
              {isLoading ? "Simplifying..." : "Simplify"}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {error}
          </div>
        )}

        {/* Side-by-side panels */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Original text */}
          <div className="flex flex-col">
            <label
              htmlFor="legal-text"
              className="mb-2 text-sm font-medium text-gray-700"
            >
              Original Legal Text
            </label>
            <textarea
              id="legal-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste your legal text here — contracts, terms of service, privacy policies, lease agreements, etc."
              rows={20}
              disabled={isLoading}
              className="flex-1 resize-y rounded-lg border border-gray-300 bg-white p-4 text-sm leading-relaxed text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <p className="mt-1 text-right text-xs text-gray-400">
              {text.length.toLocaleString()} / 50,000 characters
            </p>
          </div>

          {/* Simplified text */}
          <div className="flex flex-col">
            <h2 className="mb-2 text-sm font-medium text-gray-700">
              Simplified Version
              {simplified && (
                <span className="ml-2 font-normal text-gray-400">
                  ({READING_LEVELS.find((l) => l.value === readingLevel)?.label}{" "}
                  level)
                </span>
              )}
            </h2>
            <div
              className="flex-1 rounded-lg border border-gray-300 bg-white p-4"
              style={{ minHeight: "29rem" }}
            >
              {isLoading ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <svg
                      className="mx-auto h-8 w-8 animate-spin text-blue-600"
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
                    <p className="mt-3 text-sm text-gray-500">
                      Simplifying your text...
                    </p>
                  </div>
                </div>
              ) : simplified ? (
                <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed text-gray-900">
                  {simplified}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">
                  The simplified version will appear here.
                </p>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs text-gray-400">
            This tool provides simplified paraphrases for easier reading. It
            does not provide legal advice. Always consult a qualified attorney
            for legal matters.
          </p>
        </div>
      </footer>
    </div>
  );
}
