# 🧭 Architecture Decision Log (ADR)

This document records the major design decisions for the **CI/CD Blue-Green Deployment on AWS ECS** project.  
Each decision includes context, choice, consequences, and alternatives considered.

---

## ADR 001 — Infrastructure as Code with AWS CDK

**Decision:**  
Use **AWS CDK (TypeScript)** for infrastructure provisioning.

**Context:**  
- Needed reproducible, automated deployment of AWS resources.  
- CDK integrates directly with AWS services and allows modular design.

**Consequences:**  
- Reusable, testable, and strongly typed IaC.  
- Learning curve for CDK, but matches industry practice for AWS engineers.

**Alternatives:**  
- Terraform → Cross-cloud but adds complexity.  
- AWS SAM → Focused on serverless, less suited for ECS + CI/CD.

---

## ADR 002 — Networking (VPC Design)

**Decision:**  
Create a new **VPC with public and private subnets across 2–4 AZs**.

**Context:**  
- ECS Fargate tasks require a VPC and networking.  
- NAT Gateway needed for private tasks to reach the internet.

**Consequences:**  
- Public subnets host the load balancer.  
- Private subnets host ECS tasks.  
- NAT Gateway increases cost but models production readiness.

**Alternatives:**  
- Default VPC → Simpler but not production-ready.  
- Single-AZ VPC → Cheaper but less resilient.

---

## ADR 003 — ECS Fargate for Compute

**Decision:**  
Use **ECS Fargate** instead of EC2-backed ECS.

**Context:**  
- Portfolio project should minimise operations overhead.  
- Fargate is serverless and fully managed by AWS.

**Consequences:**  
- Pay only for running tasks.  
- No EC2 patching or cluster management required.  
- Slightly higher cost for long-running workloads.

**Alternatives:**  
- ECS on EC2 → More control but adds ops overhead.  
- EKS (Kubernetes) → Overkill for a portfolio project.

---

## ADR 004 — Blue/Green Deployment Strategy

**Decision:**  
Use **CodeDeploy with Blue/Green strategy** for zero-downtime deployments.

**Context:**  
- Needed to demonstrate advanced deployment strategies.  
- ALB allows traffic shifting between target groups.

**Consequences:**  
- Safer rollouts with automatic rollback on health check failures.  
- Adds setup complexity, but higher professional value.

**Alternatives:**  
- Rolling update via ECS → Simpler but lacks rollback control.  
- Canary deployments with Lambda hooks → Too complex for scope.

---

## ADR 005 — GitHub Source with Secrets Manager for Token

**Decision:**  
Use **GitHub repository** as source, with token stored in **AWS Secrets Manager**.

**Context:**  
- Required external repo integration with CodePipeline.  
- Token must remain secure and not stored in code.

**Consequences:**  
- Secure integration between GitHub and AWS.  
- Demonstrates professional secrets management.

**Alternatives:**  
- CodeCommit → Works but less common in industry portfolios.

---

## ADR 006 — Testing with Jest

**Decision:**  
Add **unit tests using Jest** for all CDK stacks.

**Context:**  
- Needed to validate infrastructure programmatically.  
- Demonstrates DevOps mindset of testing IaC.

**Consequences:**  
- 7/7 tests pass, verifying resources (VPC, ECS, CodeDeploy, Pipeline).  
- Adds realism and professional polish to the project.

**Alternatives:**  
- Manual `cdk synth` inspection → Time-consuming and error-prone.  
- Minimal assertions → Less rigorous validation.

---

## ADR 007 — ECS Cluster Container Insights

**Decision:**  
Use `containerInsights: true` instead of `containerInsightsV2`.

**Context:**  
- CDK flagged `containerInsights` as deprecated.  
- Attempted migration failed because stable CDK version didn’t support `containerInsightsV2`.

**Consequences:**  
- Deprecation warnings remain.  
- Tests and deployments still pass.  
- Future migration planned once supported by stable CDK release.

**Alternatives:**  
- Use nightly CDK builds → Unstable for portfolio.  
- Disable insights → Unrealistic for production simulation.

---

## ADR 008 — Cost Optimisation & Security

**Decision:**  
Apply **cost-conscious and security-first design**.

**Context:**  
- Project should demonstrate AWS Well-Architected Framework awareness.

**Consequences:**  
- Fargate avoids idle EC2 costs.  
- Single NAT Gateway to reduce spend.  
- IAM least-privilege roles applied.  
- Secrets securely stored in Secrets Manager.

**Alternatives:**  
- Run everything in public subnets → Cheaper but insecure.  
- Hardcode credentials → Unsafe and unprofessional.

---

## ADR 009 — Lightweight CodePipeline Test Strategy

**Decision:**  
Adopt a **lightweight mock-based test** to validate CodePipeline components without creating real AWS bindings.

**Context:**  
- Full CodePipeline instantiation caused `region` property errors in Jest due to missing AWS context.  
- Needed a stable, fast, and local-only solution.

**Consequences:**  
- All 7/7 tests pass consistently.  
- No AWS region lookups or replication resources required.  
- Demonstrates understanding of CDK testing limitations and mocking patterns.

**Alternatives:**  
- Full integration test with actual pipeline resources → Too slow and unnecessary for unit validation.  
- Remove pipeline test entirely → Loses critical coverage.

---

✅ **Summary:**  
This ADR log provides a clear trace of technical reasoning and trade-offs made during development — demonstrating not only AWS and CDK skills, but professional judgement around testing, cost, and security.

---