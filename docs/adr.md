# 🧭 Architecture Decision Log (ADR)

This document records the major design decisions for the **CI/CD Blue–Green Deployment on AWS ECS** project.  
Each decision includes context, the choice made, consequences, and alternatives considered.

---

# 🧩 Core Architecture & Infrastructure Decisions

## ADR 001 — Infrastructure as Code with AWS CDK
**Decision:** Use **AWS CDK (TypeScript)** for infrastructure provisioning.

**Context:**
- Needed reproducible, automated deployment of AWS resources.
- CDK provides strong typing, modular constructs, and native AWS integration.

**Consequences:**
- Highly maintainable, testable IaC.
- Clear cross-stack relationships.
- Learning curve but reflects real AWS engineering practice.

**Alternatives:**
- **Terraform** → Cross-cloud, but adds tooling overhead.
- **AWS SAM** → More suited for Lambda/serverless-focused projects.

---

## ADR 002 — Networking (VPC Design)
**Decision:** Create a new **VPC with public and private subnets across 2–4 AZs**.

**Context:**
- ECS Fargate requires a VPC.
- Application Load Balancer needs public subnets.
- Private subnets improve security for ECS tasks.

**Consequences:**
- ALB placed in public subnets.
- ECS tasks isolated in private subnets with NAT access.

**Alternatives:**
- **Default VPC** → Too limited for professional portfolio work.
- **Single-AZ** → Cheaper but not resilient.

---

## ADR 003 — ECS Fargate for Compute
**Decision:** Use **AWS Fargate** for ECS task execution.

**Context:**
- Wanted to avoid EC2 management.
- Portfolio project should focus on architecture, not server patching.

**Consequences:**
- Serverless container execution.
- Pay-per-second billing.
- No cluster management.

**Alternatives:**
- **ECS on EC2** → More control but unnecessary operational overhead.
- **EKS** → Overkill for project scope.

---

## ADR 004 — Blue/Green Deployment Strategy with CodeDeploy
**Decision:** Use **AWS CodeDeploy** with Blue–Green deployment.

**Context:**
- Needed real production-grade deployment safety.
- Blue/Green demonstrates zero-downtime cutovers.
- CodeDeploy monitors health and supports automated rollback.

**Consequences:**
- Safer rollouts and easy rollback.
- Required creation of two ALB target groups.
- Required **injection of Task Definition ARN** into `appspec.yaml` to pass CodeDeploy validation.

**Alternatives:**
- **Rolling deployments via ECS** → Simpler but lacks safety and rollback control.
- **Canary deployments** → More complex than needed.

---

## ADR 005 — GitHub as Source with Secrets Manager
**Decision:** Integrate **GitHub** as the pipeline source, storing the OAuth token in **AWS Secrets Manager**.

**Context:**
- CodePipeline requires an authenticated source.
- Token must not be stored in plaintext.

**Consequences:**
- Secure token retrieval.
- Professional secrets management.
- Token injection into CodePipeline SourceAction.

**Alternatives:**
- **CodeCommit** → Good option but less aligned with industry reality.

---

## ADR 006 — Testing IaC with Jest
**Decision:** Use **Jest unit tests** to validate CDK stacks.

**Context:**
- Needed to demonstrate IaC testability.
- Ensures core AWS resources are configured correctly.

**Consequences:**
- Consistent pass/fail validation.
- Prevents invalid synth/deploy operations.

**Alternatives:**
- Manual CLI checks → Slow and error-prone.
- No testing → Not acceptable for professional CI/CD design.

---

## ADR 007 — ECS Cluster Container Insights
**Decision:** Use `containerInsights: true` until stable `containerInsightsV2` support arrives.

**Context:**
- CDK deprecated `containerInsights`.
- Nightly CDK builds supporting V2 were unstable.

**Consequences:**
- Mild deprecation warning but functional monitoring.

**Alternatives:**
- Disable insights → Not realistic.
- Use nightly CDK → Too unstable.

---

# 🔐 Security, Cost, and Reliability Decisions

## ADR 008 — Cost Optimisation & Security Practices
**Decision:** Apply cost-conscious and security-first choices.

**Context:** Follow AWS Well-Architected best practices.

**Consequences:**
- Fargate reduces idle costs.
- Single NAT Gateway lowers spend.
- IAM least privilege enforced.
- Secrets Manager used for credentials.

**Alternatives:**
- Public subnets for everything → Cheaper but insecure.
- Hardcoded credentials → Unacceptable.

---

## ADR 009 — Lightweight Mock-Based Pipeline Tests
**Decision:** Mock CodePipeline resources to avoid region lookup errors.

**Context:**
- Full pipeline creation required AWS region context missing during Jest tests.

**Consequences:**
- Tests run locally without AWS calls.
- All 7/7 stacks fully tested.

**Alternatives:**
- Integration tests → Too slow and complex.

---

# 🔧 CI/CD Workflow & Validation Decisions

## ADR 010 — CI Workflow Using GitHub Actions
**Decision:** Use **GitHub Actions** for CI, AWS CodePipeline for CD.

**Context:**
- Needed automated builds/tests before AWS deploy.
- GitHub Actions offers faster iteration and visibility.

**Consequences:**
- Each push runs Jest + CDK synth.
- Failures stop pipeline before deployment.

**Alternatives:**
- CodeBuild for CI → Works but slower for local repo workflows.

---

## ADR 011 — Documentation, Diagrams & Observability
**Decision:** Include detailed README, diagrams, screenshots, and troubleshooting notes.

**Context:**
- Recruiters and engineers benefit from clarity.
- Visuals show real AWS usage.

**Consequences:**
- Stronger portfolio storytelling.
- Better interview discussions.

**Alternatives:**
- Minimal documentation → Weak portfolio impression.

---

## ADR 012 — Hybrid Testing Strategy (Automation + Manual Verification)
**Decision:** Combine Jest tests with manual AWS validation via CLI and Console.

**Context:**
- Some AWS behaviours only surface during real deployments.
- CLI-based S3 artifact verification proved essential.

**Consequences:**
- Confidence in artifact correctness.
- Balanced approach reflecting real-world DevOps workflows.

**Alternatives:**
- Full automation → Misses runtime issues.
- Manual-only → Too slow, not scalable.

---

# 🆕 Additional ADRs from Debugging Insights

## ADR 013 — Artifact Output Strategy (TaskDef ARN Injection)
**Decision:** Standardise artifact output in a dedicated `output/` directory and dynamically inject **Task Definition ARN** into `appspec.yaml`.

**Context:**
- Early deployments failed due to `INVALID_REVISION` errors.
- CodeDeploy requires a fully resolved TaskDef ARN.

**Consequences:**
- Predictable artifact structure.
- Successful Blue–Green deployments.
- Easier debugging with CLI and S3 downloads.

**Alternatives:**
- Hardcode AppSpec → Not viable for dynamic deployments.
- Output artifacts into multiple directories → Harder to debug.

---

# ✅ Summary
This ADR log captures the key architecture, security, and workflow decisions behind the CI/CD Blue–Green Deployment project. It documents the rationale, trade-offs, and lessons learned throughout implementation — supporting clarity, reproducibility, and professional engineering practice.

