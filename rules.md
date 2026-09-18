# ArogyaSync - Engineering Rules

## Engineering
* Write modular, clean code.
* Break large functionality into small manageable components.
* Reuse components where appropriate.
* Keep responsibilities separated.
* Avoid unnecessary coupling.
* Avoid premature abstraction.
* Avoid unnecessary dependencies.
* Prefer simple solutions.
* Do not over-engineer.
* Keep business logic separate from UI logic.
* Make security-sensitive logic centralized and testable.

## Requirements
* Be an active engineering partner.
* Challenge bad requirements.
* Identify contradictions.
* Identify missing requirements.
* Never invent important product behaviour.
* Never invent medical workflows.
* Never invent permissions.
* Never silently change architecture.
* Ask the project owner when an important decision is unclear.

## Security
* Treat patient data as highly sensitive.
* Never commit patient data.
* Never commit secrets.
* Never expose service-role credentials.
* Never rely on frontend authorization.
* Validate access server-side.
* Apply least privilege.
* Minimize local sensitive data.
* Protect local storage.
* Protect network communication.
* Never expose sensitive data in logs.
* Never send patient data to external services without approval.
* Use synthetic data for development.
* Test authorization boundaries.

## Testing
* Test important functionality.
* Run tests before committing.
* Never fabricate test results.
* Never delete tests just because they fail.
* Never weaken tests merely to make them pass.

## Git
* Use meaningful Conventional Commits.
* Keep commits focused.
* Review `git diff` before committing.
* Never commit secrets.
* Never commit patient information.
* Never force-push shared branches without approval.
* Never overwrite another developer's work.

## Collaboration
* Respect ownership boundaries.
* Do not modify another agent's area unnecessarily.
* Communicate shared-contract changes.
* Update documentation when contracts change.
* Keep agents unblocked using mocks where possible.
