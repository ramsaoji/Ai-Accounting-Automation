# ENGINEERING_ARCHITECTURE_AND_CODE_QUALITY_GUIDE.md

## Purpose

This guide defines universal engineering standards for building, reviewing, refactoring, and scaling software systems.

The objective is not to enforce a specific folder structure or framework pattern. Instead, it provides a decision framework that helps maintain:

* Scalability
* Maintainability
* Readability
* Modularity
* Developer Experience
* Long-Term Sustainability

These standards should be applied to:

* React Applications
* Next.js Applications
* Node.js Services
* NestJS APIs
* Express APIs
* Microservices
* Monorepos
* Design Systems
* Internal Tools
* AI Applications
* SDKs & Libraries

---

# Core Engineering Principles

## 1. Consistency Over Cleverness

Prefer predictable and understandable code over complex abstractions.

Good engineers optimize for maintainability.

Avoid:

* Unnecessary design patterns
* Over-engineering
* Deep inheritance chains
* Clever abstractions without clear value

The easiest code to understand is usually the easiest code to maintain.

---

## 2. Optimize For Future Change

Every implementation should answer:

> Will this be easier to modify six months from now?

Prefer solutions that make future changes easier rather than solutions that appear technically impressive.

---

## 3. Single Responsibility Principle

Every module should have one clear responsibility.

Examples:

### Good

* Component renders UI
* Service handles business logic
* Repository handles database access
* Utility handles formatting

### Bad

* Component renders UI and fetches data and transforms data
* Service performs database access and API calls and validation
* Utility contains unrelated helper functions

---

## 4. High Cohesion, Low Coupling

Related functionality should remain together.

Unrelated functionality should remain independent.

Goals:

* Easier testing
* Easier refactoring
* Easier onboarding
* Better scalability

---

## 5. Avoid Premature Abstraction

Do not create:

* BaseService
* BaseController
* AbstractManager
* GenericFactory
* UniversalRepository

unless multiple real use cases exist.

Rule:

> Duplicate twice. Abstract on the third occurrence.

---

## 6. Domain-Driven Thinking

For larger applications, organize around business domains rather than technical layers.

Prefer:

```text
features/
├── auth/
├── users/
├── billing/
├── orders/
```

Over:

```text
components/
services/
utils/
hooks/
```

Domain ownership scales significantly better.

---

# Architecture Discovery (Mandatory First Step)

Before making recommendations or refactoring:

## Analyze

### Technology

* Framework
* Runtime
* Build system
* Deployment model

### Architecture

* Monorepo or single repository
* Existing folder structure
* Existing conventions
* Existing patterns

### Frontend

* State management
* Data fetching approach
* Design system approach

### Backend

* API architecture
* Database architecture
* Service structure

### AI Systems

* Model providers
* Prompt management
* Tool orchestration
* Workflow design

---

## Important Rule

Never force a new architecture onto an existing codebase without first understanding:

* Why the current architecture exists
* Team size
* Product complexity
* Existing conventions

Improve the architecture.

Do not replace it unnecessarily.

---

# Universal Project Audit Framework

Every project review should evaluate:

## Architecture

* Folder structure
* Module boundaries
* Dependency flow
* Coupling
* Cohesion
* Separation of concerns

---

## Maintainability

* Readability
* Naming consistency
* Complexity
* Dead code
* Documentation quality
* Code duplication

---

## Scalability

* Feature growth readiness
* Team growth readiness
* Monorepo readiness
* Multi-tenant readiness
* Multi-region readiness

---

## Security

* Authentication
* Authorization
* Input validation
* Secrets management
* Error exposure

---

## Performance

* Rendering performance
* API performance
* Database efficiency
* Caching opportunities
* Bundle optimization

---

## Developer Experience

* Project discoverability
* Local development simplicity
* Reusability
* Build speed
* Tooling quality

---

# Frontend Engineering Standards

## Component Responsibilities

Components should primarily focus on rendering.

Avoid:

* Complex business logic
* Heavy calculations
* Data transformation
* API orchestration

Move such logic into:

* Hooks
* Services
* Utilities

---

## Component Decomposition

Refactor when:

* Multiple responsibilities exist
* Multiple layouts exist
* Reuse opportunities exist
* Cognitive complexity becomes high

Do not refactor solely because of line count.

Line count is only a warning signal.

---

## State Management

Use the smallest scope possible.

### Local State

Use when state belongs to a single component.

### Shared State

Use when multiple components require access.

### Server State

Keep server state separate from UI state.

Examples:

* React Query
* TanStack Query
* SWR

Avoid storing server responses inside global state unless necessary.

---

## Data Fetching

Separate:

* Fetching
* Transformation
* Presentation

Avoid combining all three inside components.

---

## Design Systems

Design systems should contain:

```text
ui/
├── Button
├── Input
├── Modal
├── Badge
```

Feature logic should never live inside design system components.

---

# Backend Engineering Standards

## Layer Separation

Preferred flow:

```text
Controller
    ↓
Service
    ↓
Repository
    ↓
Database
```

Avoid:

```text
Controller
    ↓
Database
```

---

## Service Layer

Services should contain:

* Business rules
* Orchestration
* Domain workflows

Services should not:

* Render responses
* Manage routing
* Contain UI logic

---

## Repository Layer

Repositories should:

* Handle persistence
* Handle queries
* Handle transactions

Repositories should not:

* Contain business rules

---

## Validation

Validation should be centralized.

Avoid scattered validation throughout:

* Controllers
* Services
* Database logic

---

## Error Handling

Create consistent patterns for:

* User-facing errors
* Validation errors
* Infrastructure errors
* External service failures

---

## API Design

Maintain:

* Consistent response shapes
* Consistent error formats
* Clear versioning strategy
* Schema validation

---

# AI Application Standards

If the project contains AI systems:

Separate:

```text
ai/
├── providers/
├── prompts/
├── tools/
├── evaluators/
├── workflows/
```

---

## Provider Layer

Responsible for:

* Model integrations
* Retry logic
* Fallbacks

Examples:

* OpenAI
* Anthropic
* Gemini
* Groq

---

## Prompt Layer

Store prompts separately.

Avoid embedding prompts directly inside application logic.

---

## Tool Layer

Tool definitions should remain isolated from orchestration logic.

---

## Workflow Layer

Workflow orchestration should:

* Coordinate prompts
* Coordinate tools
* Coordinate models

Without embedding business logic into prompts.

---

# Monorepo Standards

Organize by responsibility.

Example:

```text
apps/
packages/
services/
shared/
```

Shared code must have clear ownership.

Avoid creating giant shared utility packages containing unrelated logic.

---

# Refactoring Decision Matrix

Refactor when:

* Multiple responsibilities exist
* Complexity becomes difficult to follow
* Reuse opportunities exist
* Testing becomes difficult
* Domain boundaries become unclear
* Dependencies become difficult to manage

Do not refactor solely because:

* File is large
* Folder count is high
* Pattern seems fashionable

Refactoring must provide measurable value.

---

# Code Health Indicators

## Warning Signals

### Architecture

* Circular dependencies
* Deep dependency chains
* Tight coupling

### Frontend

* Massive components
* Mixed rendering and business logic
* Repeated UI patterns

### Backend

* Fat controllers
* Fat services
* Database access everywhere

### General

* Duplicate logic
* Dead code
* Inconsistent naming
* Hidden side effects

---

# Audit Output Format

All engineering reviews should produce findings grouped by priority.

## P0 — Critical

Production risks.

Examples:

* Security vulnerabilities
* Data corruption risks
* Severe architectural flaws

---

## P1 — High Impact

Significant improvements.

Examples:

* Scalability bottlenecks
* Major maintainability issues

---

## P2 — Medium Impact

Quality improvements.

Examples:

* Refactoring opportunities
* Structural improvements

---

## P3 — Nice To Have

Optional enhancements.

Examples:

* Developer experience improvements
* Additional abstractions

---

# Recommendation Format

Every recommendation should include:

## Problem

What is wrong.

## Root Cause

Why it exists.

## Proposed Solution

How to fix it.

## Benefits

Expected outcome.

## Effort

Small / Medium / Large

## Risk

Low / Medium / High

---

# Golden Rule

The best architecture is not the most complex architecture.

The best architecture is the one that:

* Solves today's problems
* Allows tomorrow's changes
* Remains understandable by future engineers
* Avoids unnecessary complexity

Build systems that are easy to change, not systems that are difficult to understand.

---

# AI Assistant Prompt: Automated Refactoring Instruction

Copy and paste this section directly as a system prompt when initiating a task with an AI coding assistant to refactor any codebase automatically.

```text
You are an expert software architect specializing in code modularity and file decluttering.
Read the engineering standards in the architectural guide and apply them to the current repository:

1. CODEBASE AUDIT:
   - Identify files violating core principles (SRP, Cohesion, Domain Boundaries).
   - Identify view components or controllers rendering multiple layout variations or embedding business rules/fetching logic.
   - Identify service layer files mixing raw client calls with simulations, mocks, or template interpolation logic.
   - Identify backend scripts containing inline subclasses representing rules, strategies, or validators.

2. EXECUTE REFACTORING:
   - Decompose complex components into sub-components directories, keeping parent files declarative and thin.
   - Separate mock, fallback, or heuristic engines from network wrappers.
   - Apply the Strategy Pattern: Move inline rules, algorithms, or validator classes into standalone class modules inside a definitions/ subdirectory.
   - Centralize duplicate utility helpers into shared folders.

3. VALIDATION:
   - Verify that relative paths and imports match local ecosystem conventions.
   - Run compiler verification and local test runs to confirm zero regressions.
```

