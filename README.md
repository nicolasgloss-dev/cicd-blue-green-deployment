# 🚀 CI/CD Blue-Green Deployment on AWS  
[![CI](https://github.com/nicolasgloss-dev/cicd-blue-green-deployment/actions/workflows/ci.yml/badge.svg)](https://github.com/nicolasgloss-dev/cicd-blue-green-deployment/actions/workflows/ci.yml)

## 📖 Overview  
This project demonstrates a **fully automated CI/CD pipeline** for an ECS Fargate application with **Blue/Green deployments** on AWS.  

The workflow is:  
- **GitHub Actions (CI):** Runs Jest unit tests and CDK build on every push.  
- **AWS CodePipeline (CD):** Automatically deploys from GitHub to ECS with Blue/Green rollout and rollback.  

Infrastructure is defined using **AWS CDK (TypeScript)**, ensuring reproducible deployments.

---

## 🎯 Business Need  
Modern applications require:  
- Fast feedback (CI) before deployment.  
- Safe, automated deployments with minimal downtime.  
- Rollback capabilities if new versions fail.  

This project meets these needs with **GitHub-driven CI** and **AWS-native Blue/Green CD**.

---

## 🏗️ Architecture Diagram  
*(Placeholder for Lucidchart diagram — include in portfolio presentation)*  

**Key components:**  
- **GitHub Repo** – Application source + CI pipeline (`ci.yml`).  
- **GitHub Actions** – Builds + runs Jest unit tests on each push.  
- **AWS CodePipeline** – Orchestrates Build → Deploy.  
- **AWS CodeBuild** – Synthesises CDK + packages infrastructure.  
- **AWS CodeDeploy** – Manages ECS Blue/Green deployments.  
- **ECS Fargate Cluster** – Runs containerised workloads.  
- **ALB with Blue/Green Target Groups** – Routes traffic safely.  
- **VPC** – Networking layer with public/private subnets + NAT.  

---

## 🛠️ AWS Services Used  
- **Amazon VPC:** 2 AZ, public/private subnets, NAT.  
- **Amazon ECS Fargate:** Serverless container hosting.  
- **Application Load Balancer (ALB):** Routes between Blue/Green target groups.  
- **AWS CodePipeline:** End-to-end deployment orchestration.  
- **AWS CodeBuild:** Builds CDK and application artifacts.  
- **AWS CodeDeploy:** Blue/Green deployment control + rollback.  
- **AWS Secrets Manager:** Stores GitHub token securely for pipeline source.  
- **IAM:** Role-based access for least-privilege security.  

---

## ⚙️ Step-by-Step Implementation  
1. **VPC Stack:** Creates VPC, subnets, NAT.  
2. **ECS Stack:** ECS cluster, Fargate task definition, ALB + target groups.  
3. **Service Stack:** Deploys ECS Fargate service, registers with Blue/Green TGs.  
4. **CodeDeploy Stack:** ECS Application + Deployment Group.  
5. **Pipeline Stack:** Source (GitHub) → Build (CodeBuild) → Deploy (CodeDeploy ECS Blue/Green).  
6. **GitHub Actions CI:** `.github/workflows/ci.yml` runs unit tests + build before pipeline.  

---

## 🧪 Testing Strategy  
- **Stack-level Jest tests** (`*.test.ts`) validate resource creation.  
  - **VpcStack:** VPC, subnets, NAT.  
  - **EcsStack:** ECS cluster, ALB, TGs, task definition.  
  - **ServiceStack:** ECS Fargate service + TG registration.  
  - **CodeDeployStack:** ECS Application + Deployment Group.  
  - **PipelineStack:** Pipeline stages and GitHub source action.  

This ensures infrastructure is correct before deployment.

---

## ✅ Expected Outcomes  
- One push to GitHub triggers:  
  1. **CI (GitHub Actions):** Tests + build.  
  2. **CD (CodePipeline):** Build → Deploy to ECS.  
- Blue/Green deployments with rollback on failure.  
- Interview-ready demo of hybrid CI/CD with **GitHub + AWS-native deployment**.  

---

## 🛡️ Failure Scenarios & Mitigations  
- **Unit test failure:** GitHub Actions blocks deployment.  
- **Pipeline build failure:** CodePipeline halts before deployment.  
- **Unhealthy ECS tasks:** CodeDeploy reverts to last healthy version.  

---

## 💸 Cost Optimisation  
- 2 AZ + 1 NAT Gateway to reduce costs.  
- Fargate avoids paying for idle EC2.  
- Small demo setup keeps costs portfolio-friendly.  

---

## 🔐 Security Considerations  
- GitHub token stored in **Secrets Manager**.  
- IAM roles scoped with least privilege.  
- ECS tasks run in private subnets.  

---

## 🌱 Possible Enhancements  
- Add manual approval stage in CodePipeline.  
- Extend GitHub Actions with linting/security scans.  
- Add CloudWatch dashboards for monitoring.  
- Replace NGINX container with a real sample app.  

---

## 🧹 Clean-up Steps  
- Run `cdk destroy` for all stacks.  
- Delete Secrets Manager GitHub token.  
- Remove NAT + ALB to avoid charges.  

---

## 🧩 Challenges & Solutions  
- **Cross-stack dependencies:** Solved via CDK props (e.g. VPC, TGs, listener).  
- **Blue/Green rollout complexity:** Simplified by breaking into modular stacks.  
- **Hybrid CI/CD flow:** Achieved by combining GitHub CI with AWS-native CD.  

---

## 💡 Reflection / Lessons Learned  
- Learned how to integrate GitHub Actions with AWS CodePipeline.  
- Gained confidence in Blue/Green deployment strategies.  
- Practiced testing IaC with Jest.  
- Improved documentation and ADR storytelling for interviews.  

---
