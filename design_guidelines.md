# Design Guidelines: Student Knowledge Assessment System

## Design Approach
**Selected System:** Material Design-inspired educational platform
**References:** Google Classroom, Canvas LMS, Notion (for clean data presentation)
**Rationale:** Educational applications require clear information hierarchy, consistent patterns for repeated tasks, and accessibility for diverse user groups. Material Design's emphasis on elevation, clear states, and systematic spacing suits data-heavy interfaces.

## Core Design Elements

### A. Typography
- **Primary Font:** Inter or Roboto via Google Fonts CDN
- **Headings:** 
  - H1: 2xl (24px), font-semibold - page titles
  - H2: xl (20px), font-semibold - section headers
  - H3: lg (18px), font-medium - card titles
- **Body Text:** base (16px), font-normal
- **Secondary Text:** sm (14px) - metadata, timestamps, hints
- **Test Questions:** lg (18px), font-medium for readability during assessment

### B. Layout System
**Spacing Units:** Tailwind 4, 6, 8, 12, 16 for consistency
- Container padding: p-6 (mobile), p-8 (desktop)
- Card spacing: p-6 internal, gap-6 between cards
- Section margins: mb-8 between major sections
- Form field spacing: gap-4 in forms

**Grid System:**
- Dashboard cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Test questions: Single column max-w-3xl for focus
- Analytics: grid-cols-1 lg:grid-cols-2 for charts/stats
- Max container width: max-w-7xl mx-auto

### C. Component Library

**Navigation:**
- Top navigation bar with logo, user menu, role indicator
- Sidebar navigation for teacher panel (collapsed on mobile)
- Breadcrumbs for nested pages (test creation, results review)

**Cards:**
- Elevated cards with subtle shadow (shadow-md)
- Rounded corners: rounded-lg
- Hover state: slight shadow increase (shadow-lg transition)
- Test cards show: title, subject, duration, status badge
- Result cards show: score, date, AI feedback preview

**Forms:**
- Floating labels for input fields
- Clear validation states (success/error borders)
- Helper text below inputs (text-sm)
- Radio buttons and checkboxes with clear touch targets (min 44px)
- Toggle switches for enable/disable states

**Buttons:**
- Primary: Solid fill, rounded-lg, px-6 py-3
- Secondary: Outlined, same sizing
- Icon buttons: Circular (rounded-full), p-3 for consistent 44px touch target
- Disabled state: reduced opacity (opacity-50)

**Data Displays:**
- Tables: Full-width, striped rows, sticky headers for long lists
- Progress bars: Rounded-full, height h-2, with percentage label
- Statistics cards: Large number (text-3xl font-bold), label below (text-sm)
- Charts: Use Chart.js for line/bar graphs showing progress trends

**Test Taking Interface:**
- Question counter: Fixed top bar with progress indicator
- Timer: Prominent display (text-2xl) with warning states
- Navigation: Previous/Next buttons, question grid for quick jump
- Answer inputs: Large, comfortable touch targets
- Auto-save indicator: Subtle notification (top-right toast)

**Badges:**
- Status indicators: rounded-full, px-3 py-1, text-xs font-medium
- Role badges (Student/Teacher): In header
- Score badges: Prominent in results view

**Modals:**
- Centered overlay with backdrop blur
- Max width: max-w-2xl
- Close button (top-right), primary action (bottom-right)
- Used for: Confirm actions, view detailed feedback, create questions

**Empty States:**
- Centered icon (large, subtle)
- Helpful message and CTA button
- Used when: No tests available, no results yet

### D. Page-Specific Layouts

**Login/Registration:**
- Centered card (max-w-md)
- Logo at top
- Form fields with spacing (gap-4)
- Link to switch between login/register

**Student Dashboard:**
- Welcome header with name and stats summary (3-column grid)
- "Available Tests" section with card grid
- "Recent Results" section with list/table
- Progress chart showing performance over time

**Teacher Dashboard:**
- Analytics overview (4-column stat cards)
- Quick actions (Create Test, View Reports)
- Recent activity feed
- Class performance chart

**Test Creation:**
- Multi-step form with progress indicator
- Test details (step 1), Questions (step 2), Review (step 3)
- Question builder with type selector (radio/multiple/open)
- Add/remove question buttons
- Preview mode toggle

**Test Taking:**
- Clean, distraction-free interface
- Fixed timer and progress at top
- One question per view (large, centered)
- Clear answer submission area
- Navigation controls at bottom

**Results View:**
- Score hero section (large number, percentage)
- Breakdown by question type
- AI feedback cards with detailed analysis
- Retake button (if allowed)

## Critical Implementation Notes
- Maintain 44px minimum touch targets for all interactive elements
- Consistent card elevation throughout (shadow-md standard, shadow-lg on hover)
- Responsive breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Loading states: Skeleton screens for data-heavy views
- Icons: Heroicons via CDN for consistency with modern web apps