# 🧠 CI/CD Blue-Green Deployment — Detailed Engineering Write-up

### Repository: [nicolasgloss-dev/cicd-blue-green-deployment](https://github.com/nicolasgloss-dev/cicd-blue-green-deployment)

---

## 📘 Purpose of this Document
This detailed write-up complements the main [README.md](../README.md), providing the full technical and troubleshooting narrative behind the **CI/CD Blue-Green Deployment Pipeline**.

It documents:
- The full architectural flow (CodePipeline → CodeBuild → CodeDeploy → ECS)
- Key debugging insights and solutions
- Failure scenarios and mitigations
- Technical and professional lessons learned

---

## 🧩 Overview
This project implements a **fully automated, production-style CI/CD pipeline** for ECS Fargate using **AWS CodePipeline, CodeBuild, and CodeDeploy**.

It integrates with GitHub for source control, compiles and packages CDK-defined infrastructure, and executes **Blue/Green ECS deployments** with automated traffic shifting via an Application Load Balancer.

### Why This Project Matters
Modern cloud teams demand:
- Continuous delivery with minimal downtime  
- Rollback-safe deployment strategies  
- Full IaC traceability for compliance and audit  

This pipeline demonstrates those capabilities end-to-end — built entirely with **AWS-native services** and **TypeScript CDK**.

---

## 🏗️ Architecture Deep Dive

| Stage | AWS Service | Function |
|--------|--------------|-----------|
| **Source** | CodePipeline + GitHub | Pulls latest commits from main branch using GitHub OAuth token stored in Secrets Manager. |
| **Build** | CodeBuild | Compiles CDK, synthesises CloudFormation, generates `taskdef.json`, `appspec.yaml`, and `imagedefinitions.json`. |
| **Deploy** | CodeDeploy (ECS Blue/Green) | Deploys new ECS task set and shifts ALB traffic from blue → green. |
| **Compute** | ECS Fargate | Runs the containerized application serverlessly. |
| **Networking** | VPC + ALB | Handles traffic routing, isolation, and load balancing. |
| **Storage** | S3 | Stores build and deployment artifacts between stages. |

---

## ⚙️ BuildSpec Process (CodeBuild)

### 🔧 Key Commands
```bash
npm install
npm run build
echo "Generating ECS deployment files..."
```

CodeBuild dynamically creates:

- `taskdef.json` → ECS task definition with container info  
- `appspec.yaml` → CodeDeploy AppSpec mapping for ECS service  
- `imagedefinitions.json` → Image references for ECS container update  

All outputs are stored in an `output/` directory and uploaded to S3 as part of the CodePipeline artifact set.

---

### 📦 Generated Artifacts

✅ **taskdef.json**
```json
{
  "family": "bluegreen-demo-task",
  "networkMode": "awsvpc",
  "executionRoleArn": "arn:aws:iam::<ACCOUNT_ID>:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "AppContainer",
      "image": "example.dkr.ecr.ap-southeast-2.amazonaws.com/app:latest",
      "essential": true,
      "portMappings": [{ "containerPort": 80, "protocol": "tcp" }]
    }
  ],
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512"
}
```

✅ **appspec.yaml**
```yaml
version: 0.0
Resources:
  - TargetService:
      Type: AWS::ECS::Service
      Properties:
        TaskDefinition: "TaskDef"
        LoadBalancerInfo:
          ContainerName: "AppContainer"
          ContainerPort: 80
```

✅ **imagedefinitions.json**
```json
[
  {
    "name": "AppContainer",
    "imageUri": "example.dkr.ecr.ap-southeast-2.amazonaws.com/app:latest"
  }
]
```

---

## 🚨 Common Failure Scenario: INVALID_REVISION

### ❗ The Error
**Deployment failed.**  
Error code: `INVALID_REVISION`  
The `appspec.yaml` file that specifies the deployment configuration is **missing or invalid**.

---

### 🧭 Root Cause
`appspec.yaml` originally referenced a **file name** (`taskdef.json`) instead of a **Task Definition ARN**.  
CodeDeploy validates the ECS task definition before starting deployment — and failed when it couldn’t resolve the file reference.

---

### 🛠️ Fix
The pipeline was updated so that **CodeBuild dynamically inserts the active Task Definition ARN** into the generated `appspec.yaml`, making it valid for ECS CodeDeploy.

---

### ✅ Successful Deployment Example
- **Deployment ID:** `d-U87DVPEGE`  
- **Pipeline Status:** All stages succeeded (Source → Build → Deploy).  
- **Artifact Validation:** Verified that `appspec.yaml` in S3 included a valid Task Definition ARN.  
- **Result:** CodeDeploy successfully created a **green task set** and shifted ALB traffic from **blue → green**.

---

## 💸 Cost Optimisation Highlights

| Strategy                         | Benefit                                         |
|----------------------------------|-------------------------------------------------|
| Fargate tasks only while active  | Pay-per-second billing, no idle EC2.            |
| Single NAT Gateway for VPC       | Minimizes networking cost.                      |
| Lifecycle policies for S3 artifacts | Automatic cleanup of old build files.          |
| GitHub Actions free-tier CI      | No additional build cost for unit tests.        |

---

## 🔐 Security Design

- Secrets Manager stores **GitHub OAuth token** securely.  
- **IAM roles** scoped per stage with least privilege.  
- **CodeBuild** environment isolation ensures no persistent state.  
- **HTTPS-only** ALB access *(for real-world extension)*.

---

## 🧪 Validation & Testing

### CI (GitHub Actions)
- Runs **Jest unit tests** on every push to `main`.  
- Builds **CDK project** and validates stack synthesis (`cdk synth`).  

### CD (AWS CodePipeline)
- Executes **CodeBuild** and **CodeDeploy** sequentially.  
- Fails safely if build artifacts are invalid.  
- Includes **rollback policy** on ECS task failure.  

### Local Verification
To confirm artifacts manually:
```bash
aws s3 cp s3://<artifact-bucket>/CICD-BlueGreenPipeli/BuildOutpu/<latest-id> ./artifact.zip
Expand-Archive ./artifact.zip ./unzipped -Force
cat ./unzipped/appspec.yaml
```

---

## 🧭 Failure Scenarios & Mitigations

| Scenario                       | Root Cause                               | Mitigation                                      |
|--------------------------------|------------------------------------------|-------------------------------------------------|
| INVALID_REVISION in CodeDeploy | AppSpec references invalid TaskDef       | Use valid ARN during build stage                |
| Build phase failed             | Shell syntax error in heredoc            | Switched to `printf` with escaped newlines      |
| Missing artifact files         | Incorrect base-directory in buildSpec    | Created dedicated `output/` folder              |
| Rollback triggered             | Failed container health checks           | Verified ALB + ECS health configuration         |

---

## 🎯 Expected Outcomes

✅ **Pipeline Triggered Automatically**  
Commits to GitHub start the pipeline instantly.  

✅ **All Stages Pass**  
Source → Build → Deploy succeed without manual steps.  

✅ **Blue/Green ECS Deployment**  
CodeDeploy creates new task set, validates health, and shifts ALB traffic.  

✅ **Rollback Safety**  
In case of failure, CodeDeploy restores previous (blue) version.  

✅ **Professional Demonstration**  
Shows mastery of CI/CD, ECS, IaC, and debugging in AWS-native tooling.  

---

## 🧠 Reflection / Lessons Learned

### 💭 Key Takeaways
Building and troubleshooting this pipeline highlighted the depth required for real DevOps maturity — success depends as much on understanding service interactions as on the code itself.

### 🧩 Technical Insights
- CodeDeploy requires **ARN-based TaskDef** references.  
- **S3 artifact validation** is essential before deployment.  
- Using CLI (`aws s3`, `Expand-Archive`) provides full pipeline visibility.  
- Properly structured **build artifacts (`output/`)** avoid silent CodePipeline issues.  

### 🌱 Professional Growth
This project simulated an authentic cloud debugging cycle — analyzing build logs, verifying artifact contents, and iteratively correcting IaC logic.  
It demonstrates **persistence, discipline, and confidence** with AWS tooling under real failure conditions.  

### 🔄 Future Enhancements
- Add **SNS or Slack notifications** for pipeline events.  
- Introduce **post-deployment health checks** using Lambda or CodeBuild tests.  
- Expand to **multi-environment workflows** (Dev → Staging → Prod).  
- Integrate **cost and security scanning** into the CI stage.  

---

## 🏁 Final Verification

✅ **Deployment Succeeded:**  
`d-U87DVPEGE` — confirmed successful via CodeDeploy console.  

✅ **Artifacts Validated:**  
`appspec.yaml`, `taskdef.json`, `imagedefinitions.json` present in artifact S3 bucket.  

✅ **CodePipeline State:**  
All stages succeeded in AWS Console.  

✅ **End Result:**  
Blue/Green ECS deployment operational and verifiable — **zero downtime**, full **IaC automation**.  

---

## 📚 References
- [AWS CodeDeploy ECS Blue/Green Documentation](https://docs.aws.amazon.com/codedeploy/latest/userguide/deployments-ecs.html)  
- [AWS CDK Developer Guide](https://docs.aws.amazon.com/cdk/v2/guide/home.html)  
- [AWS CI/CD Pipeline Reference Architecture](https://aws.amazon.com/architecture/)

---

**Author:** Nicolas Gloss — Cloud Engineer Portfolio Project  
**Location:** Sydney, Australia  
**Website:** [nicolasgloss.com](https://nicolasgloss.com)
