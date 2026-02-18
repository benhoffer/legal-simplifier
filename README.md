# Legal Simplifier

A civic engagement platform that makes legal and policy text accessible to everyone. Browse, create, simplify, endorse, and sign community policy proposals.

## Features

- **AI-Powered Simplification** - Simplify complex policy text to different reading levels (5th grade, high school, college) using Claude AI
- **Policy Proposals** - Create, publish, and browse community-submitted policy proposals with category and jurisdiction filters
- **AI Analysis** - Automatic readability scoring, conflict detection, and affected group identification
- **Endorsements** - Endorse policies as an individual or on behalf of an organization
- **Petition Signatures** - Sign petitions with email verification
- **Comments** - Threaded comments with voting and sorting (newest, popular, controversial)
- **Organizations** - Create organizations, manage members, and publish/endorse policies collectively
- **Policy Comparison** - Side-by-side diff comparison between proposed policies and existing law text
- **Admin Dashboards** - Analytics charts (signatures over time, endorsement breakdown, geographic distribution) and CSV export for policy authors and org admins
- **Mobile Responsive** - Hamburger navigation, touch-friendly targets, responsive grids
- **Accessibility** - Skip-to-content links, ARIA labels, focus rings, proper heading hierarchy, tab roles

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) 16 (App Router, React 19)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Database**: PostgreSQL with [Prisma](https://www.prisma.io/) v7 ORM
- **Authentication**: [Clerk](https://clerk.com/)
- **AI**: [Anthropic Claude API](https://docs.anthropic.com/)
- **Charts**: [Recharts](https://recharts.org/)
- **Diffing**: [diff-match-patch](https://github.com/google/diff-match-patch)

## Prerequisites

- Node.js 18+
- PostgreSQL database
- Clerk account (for authentication)
- Anthropic API key (for AI features)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Create a `.env.local` file in the project root:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/legal_simplifier"

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Anthropic AI
ANTHROPIC_API_KEY=sk-ant-...

# Site URL (for SEO/metadata)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3. Set up the database

Generate the Prisma client and run migrations:

```bash
npx prisma generate
npx prisma migrate deploy
```

To create a new migration after schema changes:

```bash
npx prisma migrate dev --name description_of_change
```

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
  app/
    api/
      policies/         # Policy CRUD, endorsements, signatures, comments, admin
      organizations/    # Organization CRUD, members, endorsements
      simplify/         # AI simplification endpoint
      analyze/          # AI analysis endpoint
      compare/          # Policy diff comparison endpoint
    policies/           # Policy list, detail, create, compare, admin pages
    organizations/      # Organization list, detail, create, admin pages
    nav.tsx             # Navigation with mobile hamburger menu
    layout.tsx          # Root layout with metadata, skip link, toast provider
    error.tsx           # Error boundary
    not-found.tsx       # 404 page
    robots.ts           # Robots.txt generation
    sitemap.ts          # Dynamic sitemap generation
  components/
    CommentSection.tsx  # Comment list with sorting and pagination
    Comment.tsx         # Recursive comment with voting and replies
    EndorseButton.tsx   # Endorse as individual or organization
    SignPetitionButton.tsx  # Petition signing with modal form
    PetitionProgress.tsx    # Signature goal progress bar
    Skeleton.tsx        # Skeleton loading components
    Toast.tsx           # Toast notification system
  lib/
    db.ts               # Prisma client singleton
  generated/
    prisma/             # Generated Prisma client
prisma/
  schema.prisma         # Database schema
  migrations/           # Database migrations
```

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET/POST | `/api/policies` | List/create policies |
| GET/PATCH/DELETE | `/api/policies/[id]` | Get/update/delete policy |
| GET/POST/DELETE | `/api/policies/[id]/endorse` | Endorsements |
| GET/POST | `/api/policies/[id]/sign` | Petition signatures |
| GET/POST | `/api/policies/[id]/comments` | Comments |
| POST | `/api/comments/[id]/vote` | Vote on comment |
| DELETE | `/api/comments/[id]` | Delete comment |
| GET | `/api/policies/[id]/admin` | Admin analytics data |
| GET | `/api/policies/[id]/signatures/export` | Export signatures CSV |
| GET | `/api/policies/[id]/endorsements/export` | Export endorsements CSV |
| GET/POST | `/api/organizations` | List/create organizations |
| GET/PATCH | `/api/organizations/[id]` | Get/update organization |
| GET/POST/DELETE | `/api/organizations/[id]/members` | Manage members |
| POST/DELETE | `/api/organizations/[id]/endorse` | Org endorsements |
| POST | `/api/simplify` | AI simplification |
| POST | `/api/analyze` | AI analysis |
| POST | `/api/compare` | Policy diff comparison |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:push` | Push schema to database |

## Deployment

1. Set all environment variables on your hosting platform
2. Run `npx prisma generate && npx prisma migrate deploy` during the build step
3. Deploy as a standard Next.js application

The app works with any platform that supports Next.js (Vercel, Railway, Fly.io, etc.).
