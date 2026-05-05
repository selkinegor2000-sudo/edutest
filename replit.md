# EduTest - Student Knowledge Assessment System

## Overview
EduTest is a comprehensive student knowledge assessment platform designed for educational institutions. It enables teachers to create tests with various question types and allows students to take these tests with real-time progress tracking. The system features AI-powered evaluation of open-ended answers using Qwen 2.5 model via local Ollama integration.

## Current State
The application is fully functional with:
- User authentication (custom bcrypt-based password hashing)
- Role-based access (students vs teachers)
- Test creation with multiple question types
- Test taking with timer and auto-save
- AI evaluation of open answers via Ollama (Qwen 2.5)
- Results analytics and dashboards
- Dark mode support
- Phase 2 Features:
  - Media attachments (images/videos) for questions
  - Excel/PDF export for test results
  - AI-powered personalized recommendations for students
  - Competitive mode with leaderboards for group tests
  - Enhanced analytics with progress charts and difficulty analysis

## Tech Stack
- **Frontend**: React + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL (Neon) with Drizzle ORM
- **Authentication**: Custom session-based auth with bcrypt
- **AI Integration**: Ollama (local) with Qwen 2.5 model
- **State Management**: TanStack Query

## Project Structure
```
├── client/
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   │   ├── ui/         # shadcn/ui components
│   │   │   ├── app-sidebar.tsx
│   │   │   ├── theme-provider.tsx
│   │   │   └── theme-toggle.tsx
│   │   ├── lib/
│   │   │   ├── auth.tsx    # Authentication context
│   │   │   ├── queryClient.ts
│   │   │   └── utils.ts
│   │   ├── pages/
│   │   │   ├── login.tsx
│   │   │   ├── register.tsx
│   │   │   ├── student-dashboard.tsx
│   │   │   ├── teacher-dashboard.tsx
│   │   │   ├── test-create.tsx
│   │   │   ├── test-edit.tsx
│   │   │   ├── test-preview.tsx
│   │   │   ├── test-take.tsx
│   │   │   ├── results.tsx
│   │   │   ├── test-results.tsx
│   │   │   └── test-leaderboard.tsx
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── index.html
├── server/
│   ├── db.ts              # Database connection
│   ├── routes.ts          # API routes
│   ├── storage.ts         # Database storage layer
│   └── index.ts           # Server entry point
├── shared/
│   └── schema.ts          # Database schema + types
└── design_guidelines.md   # Frontend design rules
```

## Database Schema
- **users**: User accounts (students/teachers)
- **tests**: Test definitions
- **questions**: Questions within tests
- **question_options**: Answer options for multiple choice
- **test_attempts**: Student test attempts
- **answers**: Student answers
- **ai_evaluations**: AI-generated feedback (embedded in answers)
- **teacher_students**: Junction table for teacher-student relationships

## API Routes
### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Current user

### Tests
- `GET /api/tests/available` - Published tests (students)
- `GET /api/tests/my` - Teacher's tests
- `GET /api/tests/:id` - Test details
- `POST /api/tests` - Create test
- `PUT /api/tests/:id` - Update test
- `DELETE /api/tests/:id` - Delete test

### Test Attempts
- `POST /api/tests/:id/start` - Start test attempt
- `GET /api/attempts/my` - Student's attempts
- `PUT /api/attempts/:id/save` - Save progress
- `POST /api/attempts/:id/submit` - Submit test

### Statistics
- `GET /api/stats/student` - Student stats
- `GET /api/stats/teacher` - Teacher stats with enhanced analytics
- `GET /api/stats/students` - Teacher's students performance
- `GET /api/recommendations` - AI-powered student recommendations
- `GET /api/tests/:id/leaderboard` - Competitive test leaderboard

### Teacher-Student Management
- `GET /api/teacher/students` - Get teacher's assigned students
- `POST /api/teacher/students` - Add student to teacher's list
- `DELETE /api/teacher/students/:studentId` - Remove student from teacher's list
- `GET /api/students/available` - Get all available students for assignment

### Export
- `GET /api/tests/:id/export/excel` - Export test results to Excel
- `GET /api/tests/:id/export/pdf` - Export test results to PDF

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session encryption key
- `OLLAMA_URL` - Ollama API endpoint (default: http://localhost:11434)

## User Preferences
- Language: Russian (UI is in Russian)
- AI Integration: Local Ollama with Qwen 2.5 model (not cloud services)
- Authentication: Custom bcrypt-based (not Replit Auth)
- Design: Material Design-inspired with dark mode support

## Recent Changes
- Initial implementation of full knowledge assessment system
- PostgreSQL database with 8 tables
- Complete frontend with 10+ pages
- Backend API with authentication and authorization
- AI evaluation integration for open-ended questions
- Added teacher-student management feature (teachers can select and manage their students)
- Teachers can view only their assigned students' results in the statistics section
- Added "Мои ученики" (My Students) page with add/remove student functionality
- Test accounts: teacher/123456 and student/123456 for quick access
- Added user profile page with photo URL, hobbies, and wishes fields
- Profile button added to sidebar next to logout button
- Users table extended with photoUrl, hobbies, wishes columns

## Running the Application
1. The application runs via `npm run dev`
2. Frontend is served on port 5000
3. Database schema pushed via `npm run db:push`

## Notes for AI Integration
The Ollama API must be accessible at the OLLAMA_URL endpoint. For local development on Replit, you may need to use ngrok or similar to expose a local Ollama instance. The AI model (Qwen 2.5) evaluates open-ended answers by comparing them to reference answers and provides detailed feedback.
