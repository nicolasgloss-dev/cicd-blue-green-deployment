# 🧠 CI/CD Blue-Green Deployment — Detailed Engineering Write-Up

### Repository: [nicolasgloss-dev/cicd-blue-green-deployment](https://github.com/nicolasgloss-dev/cicd-blue-green-deployment)

---

## 📘 Purpose of This Document

This document complements the main [README.md](../README.md), offering a full technical deep-dive into the design, implementation, and lessons learned from this project.

It includes:

* Full CI/CD architectural flow (CodePipeline → CodeBuild → CodeDeploy → ECS)
* ECS Blue/Green deployment mechanics
* Artifact generation and validation
* Common failure scenarios and mitigation strategies
* Technical and professional reflections

This write-up demonstrates how real-world Cloud Engineers reason through infrastructure behaviour, deployment challenges, and design trade-offs.

---

## 🧩 Project Overview

This project implements a **production-style CI/CD pipeline** for a containerised application using **Amazon ECS Fargate**, with safe **Blue/Green deployments** handled by **CodeDeploy**.

Infrastructure is defined entirely in **AWS CDK (TypeScript)**. On every push to GitHub:

1. GitHub Actions runs Jest tests and builds the CDK app
2. CodePipeline is triggered
3. CodeBuild synthesises the CDK project and generates ECS deployment files
4. CodeDeploy handles Blue/Green rollout with ALB traffic shifting
5. Automatic rollback is triggered if health checks fail

This pipeline reflects how real teams deliver with automation, safety, and zero downtime.

---

## 🛏️ Architecture Deep Dive

| Stage      | AWS Service           | Purpose                                                              |
| ---------- | --------------------- | -------------------------------------------------------------------- |
| Source     | CodePipeline + GitHub | Triggers pipeline on main-branch changes; token stored in SecretsMgr |
| Build      | CodeBuild             | Builds CDK, creates taskdef/appspec/image artifacts                  |
| Deploy     | CodeDeploy (ECS B/G)  | Spins up green task set, shifts traffic via ALB                      |
| Compute    | ECS Fargate           | Runs the containerised app (NGINX demo)                              |
| Networking | VPC + ALB             | Routes traffic and checks task health                                |
| Storage    | S3                    | Stores deployment artifacts between stages                           |

### 🔹 Why Use CodeDeploy?

CodeDeploy enables safer ECS rollouts by:

* Shifting traffic in phases
* Monitoring task health
* Rolling back automatically on failure
* Replacing error-prone rolling updates with true Blue/Green

---

## ⚙️ CodeBuild: Artifact Generation

**Key steps in `buildspec.yml`:**

```bash
npm install
npm run build
echo "Generating ECS deployment files..."
```

**Generated artifacts:**

1. `taskdef.json` — ECS task definition (container, ports, Fargate config)
2. `appspec.yaml` — CodeDeploy config, referencing a **valid TaskDef ARN**
3. `imagedefinitions.json` — Maps container name to image URI

Artifacts are placed in `output/` and uploaded to S3 for use by CodeDeploy.

---

## 🚨 Failure Case: `INVALID_REVISION`

### ❌ The Problem

Deployment failed with:

```
Error Code: INVALID_REVISION
```

Meaning: `appspec.yaml` was missing a **valid Task Definition ARN**.

### 🔎 Root Cause

CDK generated `taskdef.json`, but `appspec.yaml` referred to a **file name**, not an ARN. CodeDeploy requires an ARN to identify the ECS task definition.

### 🔧 Fix

Updated the build process so the CDK-generated **TaskDef ARN** is injected directly into `appspec.yaml`. After this fix, deployments succeeded.

---

## 📦 Successful Deployment Example

* **Deployment ID:** `d-U87DVPEGE`
* All CodePipeline stages passed: Source → Build → Deploy
* Artifacts in S3 included:

  * Valid `taskdef.json`
  * Valid `appspec.yaml` (with ARN)
  * `imagedefinitions.json`
* Result: CodeDeploy created Green task set, verified health, and shifted ALB traffic from Blue → Green

---

## 💸 Cost Optimisation

| Area       | Strategy                   | Outcome                             |
| ---------- | -------------------------- | ----------------------------------- |
| Compute    | Fargate                    | Pay-per-second; no EC2 idle cost    |
| Networking | Single NAT Gateway         | Reduced cross-AZ data transfer fees |
| CI         | GitHub Actions (free tier) | No cost for build/test CI           |
| Storage    | S3 lifecycle rules         | Auto cleanup of old artifacts       |

---

## 🔐 Security Best Practices

* **Secrets Manager** stores GitHub OAuth token
* **IAM roles** scoped per service (least privilege)
* **Private subnets** isolate ECS tasks
* **Ephemeral build environments** in CodeBuild
* **CDK enforces security boundaries** through construct scoping

---

## 📊 Validation & Testing

### CI — GitHub Actions

* Runs **Jest unit tests** on every push
* Validates CDK build and `cdk synth`
* Blocks deploy if tests or synthesis fail

### CD — AWS CodePipeline

* Executes CodeBuild and CodeDeploy stages
* Fails safely on artifact validation errors

### Manual Verification (Debugging Tool)

```bash
aws s3 cp s3://<bucket>/<path>/artifact.zip ./artifact.zip
Expand-Archive ./artifact.zip ./unzipped
cat ./unzipped/appspec.yaml
```

---

## 🗺️ Failure Scenarios & Mitigations

| Scenario                 | Root Cause                        | Mitigation                         |
| ------------------------ | --------------------------------- | ---------------------------------- |
| `INVALID_REVISION` error | AppSpec missing valid TaskDef ARN | Inject ARN during CodeBuild        |
| Build fails              | Syntax error in shell commands    | Use `printf` and escaped newlines  |
| Missing artifacts        | Wrong buildSpec output path       | Standardise `output/` directory    |
| Health check failure     | ECS/ALB misconfigured             | Validate ALB target group + health |

---

## 🌟 Expected Outcomes

* ✅ GitHub push triggers entire pipeline
* ✅ GitHub Actions runs tests + build
* ✅ CodePipeline builds, deploys via Blue/Green
* ✅ CodeDeploy rolls back if failure is detected
* ✅ Full IaC testing and automation using CDK + Jest

---

## 🤔 Lessons Learned

### Technical Insights

* **AppSpec validation** in ECS is strict; ARN is required
* **Artifact validation via S3 CLI** saved hours of guessing
* **CDK build output** should be isolated to a consistent folder

### Professional Growth

* Practised real-world debugging (build logs, artifact inspection)
* Simulated production-grade deployment design
* Gained confidence explaining **CI/CD flow in interviews**

### Future Enhancements

* Add SNS/Slack pipeline notifications
* Add Lambda post-deploy health check
* Add static analysis + security scan to CI
* Expand to multi-stage pipeline (Dev → Staging → Prod)

---

## 🏁 Final Deployment Confirmation

* ✅ Deployment ID `d-U87DVPEGE` succeeded
* ✅ All artifacts valid and present in S3
* ✅ ECS tasks deployed via Blue/Green
* ✅ Zero-downtime cutover confirmed in CodeDeploy console

---

## 📛 References

* [AWS CodeDeploy ECS Blue/Green Documentation](https://docs.aws.amazon.com/codedeploy/latest/userguide/deployments-ecs.html)
* [AWS CDK Developer Guide](https://docs.aws.amazon.com/cdk/v2/guide/home.html)
* [AWS CI/CD Reference Architectures](https://aws.amazon.com/architecture/)

---

**Author:** Nicolas Gloss
**Role:** Cloud Engineer Portfolio Project
**Location:** Sydney, Australia
**Website:** [nicolasgloss.com](https://nicolasgloss.com)
