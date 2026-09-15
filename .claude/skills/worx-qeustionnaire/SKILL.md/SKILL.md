WORX Questionnaire Skill

Purpose

You are maintaining the project-discovery questionnaire for the WORX website.

The questionnaire is a client-facing intake experience whose job is to progressively discover 
what a client wants to build, when they need it, the technical direction, how to contact them, 
and their expected budget.

Treat the existing WORX implementation as the source of truth for visual language and 
architecture. Extend it rather than replacing it.

Core Principle

Preserve the work that already exists.

The default behavior is:

Inspect the existing implementation before editing.

Reuse existing components, styles, tokens, animations, utilities, and patterns.

Make the smallest maintainable change that satisfies the request.

Keep unrelated code untouched.

Avoid introducing dependencies unless they are clearly necessary.

Verify the result before declaring the task complete.

This questionnaire is a product feature, not a generic form template.

WORX Design Direction

The existing WORX visual identity is intentional.

Preserve its dark, warm, premium agency aesthetic, including its existing typography, 
cream/off-white text, orange accent treatment, spacing, borders, controls, navigation, and 
established interaction patterns.

Do not introduce a new visual language.

Do not turn the questionnaire into a generic SaaS form.

Do not introduce purple gradients, glassmorphism, excessive cards, glowing effects, 
unnecessary shadows, or unrelated component-library styling.

Do not replace existing animations or interaction patterns unless the task explicitly requires 
it.

When new UI is required, make it look as though it was designed as part of the existing WORX 
page.

Questionnaire Flow

The canonical progression is:

WHO → WHAT → WHEN → HOW → CONTACT → HOW MUCH

The questionnaire should make this progression understandable without overwhelming the user.

WHO

Collect:

companyName

industry

position

Use appropriate text inputs consistent with the existing form controls.

WHAT

The current product type is:

Website

The architecture should allow additional product types later, but do not implement unrelated 
product types unless requested.

For Website, collect:

websiteType

Initial website type options:

E-commerce

Portfolio

Informational

Catalog

Event

Corporate

Landing Page

Blog / Publication

Other

Then collect:

pages

The user may select multiple required pages.

Initial page options:

Home

About

Services

Products

Portfolio

Blog

Contact

FAQ

Events

Other

If Other is selected, provide an appropriate way to specify the additional page.

Keep page options data-driven rather than scattering strings throughout components.

WHEN

Collect:

timeline

Options:

Less than 1 month

1–3 months

3–6 months

6+ months

Flexible

Use the existing WORX selection pattern.

HOW

Collect:

technologies

Technical recommendations must depend on the selected website type.

Keep this logic configuration-driven and deterministic.

Use a typed mapping/configuration rather than spreading website-type conditionals throughout 
the UI.

Recommendations may cover:

frontend

backend

database

CMS

APIs

data storage

authentication

payments

animation / interaction

other relevant technical capabilities

Recommendations must be presented as recommendations, not mandatory requirements.

The user should be able to review and adjust the relevant technologies.

Do not build an AI recommendation engine.

Do not add a backend or external recommendation API for this feature.

Example conceptual structure:

type WebsiteRecommendation = {
  frontend?: string[]
  backend?: string[]
  database?: string[]
  integrations?: string[]
  features?: string[]
}

The exact implementation should follow the project's existing TypeScript patterns.

CONTACT

Collect:

name

email

phone

constraints

The constraints field should allow the client to describe requirements, limitations, 
preferences, or other information not captured elsewhere.

Use sensible validation.

Do not make optional information required without a clear product reason.

HOW MUCH

Collect:

budget

Use a range slider when the existing browser/framework setup supports it cleanly.

The selected budget must exist in form state as structured data, not only as presentation 
text.

Display the current budget value clearly.

Use AED for the displayed currency unless the project already establishes another currency.

Keep budget boundaries and increments easy to change later.

Do not invent a backend pricing system.

State Architecture

Keep the questionnaire answers in a single coherent form state.

Prefer a typed structure similar to:

type QuestionnaireData = {
  companyName: string
  industry: string
  position: string
  productType: string
  websiteType: string
  pages: string[]
  timeline: string
  technologies: string[]
  name: string
  email: string
  phone: string
  constraints: string
  budget: number
}

Adapt this to the project's existing architecture instead of introducing a duplicate 
state-management system.

Do not add global state libraries for a local questionnaire unless the existing application 
already uses one and it is appropriate.

Preserve answers when moving backward and forward through the questionnaire.

Progressive Disclosure

Only show information relevant to the user's current selections.

For example:

Website selected
→ show website type

Website type selected
→ show relevant page options

Website type selected
→ show relevant technical recommendations

Do not show irrelevant technology choices.

Avoid making the user answer technical questions that have no relevance to the selected 
project type.

The questionnaire should feel like a guided conversation, not a spreadsheet.

UX Rules

The user should always understand:

where they are in the questionnaire

what they are being asked

what is required

how to continue

how to go back

what they have already selected

Use concise, client-friendly wording.

Do not expose unnecessary technical jargon to the client.

When technical terms are unavoidable, provide a short plain-language explanation where 
appropriate.

Avoid asking the same question twice.

Avoid unnecessary confirmation screens.

Do not make the user re-enter information when navigating backward.

Accessibility

All controls must have proper accessible labels.

Do not rely on placeholder text as the only label.

Keyboard navigation must work.

Focus must move logically when questionnaire steps change.

Radio groups, checkbox groups, selects, and range sliders must have appropriate semantics.

Validation errors must be associated with the relevant fields.

Interactive elements must have visible focus states consistent with the existing design.

Respect prefers-reduced-motion.

Do not replace native accessible controls with custom controls unless there is a strong 
reason.

Responsive Behavior

The questionnaire must work on desktop, tablet, and mobile.

Pay particular attention to:

long company names

long constraint text

multi-select page lists

dropdowns

technology selections

range slider usability

keyboard navigation

touch targets

text wrapping

spacing between questionnaire stages

Do not allow a desktop layout to simply collapse into a cramped mobile version.

Reuse the project's existing responsive breakpoints and patterns.

Validation

Validate at the appropriate boundary rather than validating everything immediately.

Required fields should be explicit.

Optional fields should remain optional.

Email should receive sensible email validation.

Phone should accept realistic international formats rather than assuming one country's exact 
format unless the existing project requires it.

Do not over-validate ordinary user input.

Do not invent business rules that were not requested.

Engineering Standards

Investigate before modifying.

Never speculate about a file or component that has not been inspected.

Before making changes, identify:

questionnaire entry point

relevant components

state management

existing form controls

styling system

validation approach

package manager

available scripts

Prefer existing project utilities and components.

Do not create abstractions for one-time operations.

Do not refactor unrelated code.

Do not create helper scripts merely to make the task easier.

Do not hard-code logic that should be represented as data/configuration.

Keep recommendation data separate from rendering logic when practical.

Use the project's existing TypeScript conventions.

Visual Verification

For UI changes, do not consider the task fully verified merely because TypeScript compiles.

When practical, run the application and inspect the rendered questionnaire.

Check at least:

desktop

mobile

first step

middle step

final budget step

back navigation

conditional website-type behavior

technology recommendations

validation

range slider

If browser tooling is available, use it.

If screenshots are available, inspect them.

Do not claim visual correctness without actually checking the rendered result when a browser 
check is reasonably available.

Verification Commands

Use the project's existing commands.

Common commands may include:

npm run lint
npm run typecheck
npm run build

If the project has tests, run the relevant tests.

Do not invent scripts that do not exist.

A successful build does not replace visual verification for UI work.

Scope Control

Only implement what the task requests or what is directly necessary for correctness.

Do not:

redesign unrelated pages

change the navigation

replace the project's styling system

add authentication

add a database

add a CMS

add analytics

add an API

add an AI recommendation service

add a UI component library

refactor unrelated components

upgrade dependencies without a reason

If a requested feature genuinely requires one of these, explain why before expanding scope.

Git Safety

This project is worked on in a controlled feature branch.

Inspect Git status before substantial changes.

Never:

git commit

Never:

git push

Never merge branches.

Never modify Git history.

At completion, leave the working tree available for human review.

Secrets and Client Data

Never expose, print, log, commit, or push secrets.

Never intentionally send private client information to an unrelated external service.

Treat client contact information and project details as potentially sensitive.

Do not place real client credentials, API keys, passwords, tokens, or private connection 
strings into source code.

Completion Criteria

A questionnaire task is complete only when:

The requested functionality is implemented.

The existing WORX visual identity is preserved.

The questionnaire state behaves correctly.

Conditional logic works.

Validation works.

Desktop and mobile behavior are reasonable.

Relevant lint/typecheck/tests/build checks pass.

The final diff has been reviewed.

No unrelated functionality was changed.

No commit or push was performed.

At completion, report:

What changed.

What files changed.

What was tested.

Any material assumptions or limitations.

Final Git status.

Then stop.
