// -----------------------------------------------------------------------------
// File: pipeline-stack.ts
// Project: CI/CD Blue-Green Deployment on AWS ECS Fargate (AWS CDK)
// Description: Defines the CI/CD pipeline including GitHub source, CodeBuild
//              stages, and CodeDeploy Blue/Green deployment integration.
// Author: Nicolas Gloss
// Last Updated: 2025-11-28
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Pipeline Overview
// -----------------------------------------------------------------------------
// This stack defines the CI/CD pipeline responsible for automating the build,
// test, and Blue/Green deployment of the ECS Fargate application.
//
// Core AWS services:
// - **AWS CodePipeline** → Orchestrates the end-to-end CI/CD workflow.
// - **AWS CodeBuild** → Builds the application and prepares deployment artifacts.
// - **AWS CodeDeploy** → Performs ECS Blue/Green deployments with traffic shifting.
// - **AWS Secrets Manager** → Stores the GitHub token securely.
// - **GitHub** → Acts as the source repository and triggers pipeline executions.
//
// Deployment flow:
// GitHub (Source) → CodePipeline → CodeBuild (Build/Test) → CodeDeploy (Blue/Green)
// → ECS Fargate (Production Service)
// -----------------------------------------------------------------------------

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  aws_ecs as ecs,
  aws_codepipeline as codepipeline,
  aws_codepipeline_actions as cpactions,
  aws_codebuild as codebuild,
  aws_elasticloadbalancingv2 as elbv2,
} from 'aws-cdk-lib';
import * as codedeploy from 'aws-cdk-lib/aws-codedeploy';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

// -----------------------------------------------------------------------------
// PipelineStackProps
// -----------------------------------------------------------------------------
// This interface defines the input properties that the pipeline stack will need.
// These props are passed from other stacks (like ECS and CodeDeploy stacks)
// to allow this pipeline to interact with existing resources such as the ECS
// service, task definition, and deployment group.
// -----------------------------------------------------------------------------
export interface PipelineStackProps extends cdk.StackProps {
  service: ecs.FargateService;
  listener: elbv2.ApplicationListener;
  blueTargetGroup: elbv2.ApplicationTargetGroup;
  greenTargetGroup: elbv2.ApplicationTargetGroup;
  cluster: ecs.Cluster;
  taskDefinition: ecs.FargateTaskDefinition;
  codedeployApp: codedeploy.EcsApplication;
  deploymentGroup: codedeploy.IEcsDeploymentGroup;
}

// -----------------------------------------------------------------------------
// PipelineStack
// -----------------------------------------------------------------------------
// This stack defines the full CI/CD pipeline using AWS CodePipeline.
// It connects GitHub (source), CodeBuild (build/test), and CodeDeploy (deploy)
// to achieve an automated Blue/Green deployment for the ECS service.
// -----------------------------------------------------------------------------
export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    // ------------------------------------------------------------------------
    // Artifacts
    // ------------------------------------------------------------------------
    // Artifacts are the files that move between stages in the pipeline.
    // Example: Source → Build → Deploy.
    const sourceOutput = new codepipeline.Artifact('SourceOutput');
    const buildOutput = new codepipeline.Artifact('BuildOutput');

    // ------------------------------------------------------------------------
    // GitHub Source Stage
    // ------------------------------------------------------------------------
    // This stage pulls the source code directly from GitHub.
    // The OAuth token is securely stored in AWS Secrets Manager.
    const githubToken = secretsmanager.Secret.fromSecretNameV2(
      this,
      'GithubToken',
      'cicd-bluegreen/github-token' // secret name in Secrets Manager
    );

    const sourceAction = new cpactions.GitHubSourceAction({
      actionName: 'GitHub_Source',
      owner: 'nicolasgloss-dev', // GitHub username
      repo: 'cicd-blue-green-deployment', // repository name
      oauthToken: githubToken.secretValue,
      output: sourceOutput,
      branch: 'main', // main branch as the source
    });

    // ------------------------------------------------------------------------
    // CodeBuild Project (Build Stage)
    // ------------------------------------------------------------------------
    // CodeBuild compiles and tests the code. Here, it also generates
    // the ECS deployment files such as taskdef.json and appspec.yaml.
    // These are required by CodeDeploy for Blue/Green deployments.
    const buildProject = new codebuild.PipelineProject(this, 'BuildProject', {
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_6_0, // Linux environment
      },
      environmentVariables: {
        TASK_DEFINITION_ARN: {
          value: props.taskDefinition.taskDefinitionArn,
        },
      },
      // ----------------------------------------------------------------------
      // BuildSpec: Defines the actual build commands
      // ----------------------------------------------------------------------
      // The buildSpec is written inline here as YAML.
      // It installs dependencies, compiles the CDK project,
      // and generates deployment descriptor files for ECS.
      buildSpec: codebuild.BuildSpec.fromObjectToYaml({
        version: '0.2',
        phases: {
          install: {
            'runtime-versions': { nodejs: 18 },
            commands: [
              'npm install -g aws-cdk',
              'apt-get update -y',
              'apt-get install -y jq',
              'npm install',
            ],
          },
          build: {
            commands: [
              'npm run build',
              'echo "Generating ECS deployment files..."',

              // ✅ Create a task definition file for ECS.
              // This defines how the container should run.
              'printf "{\\n  \\"family\\": \\"bluegreen-demo-task\\",\\n  \\"networkMode\\": \\"awsvpc\\",\\n  \\"executionRoleArn\\": \\"arn:aws:iam::918689940836:role/ecsTaskExecutionRole\\",\\n  \\"containerDefinitions\\": [ { \\"name\\": \\"AppContainer\\", \\"image\\": \\"example.dkr.ecr.ap-southeast-2.amazonaws.com/app:latest\\", \\"essential\\": true, \\"portMappings\\": [ { \\"containerPort\\": 80, \\"protocol\\": \\"tcp\\" } ] } ],\\n  \\"requiresCompatibilities\\": [\\"FARGATE\\"],\\n  \\"cpu\\": \\"256\\",\\n  \\"memory\\": \\"512\\"\\n}" > taskdef.json',

              // ✅ Generate AppSpec YAML embedding the actual ECS task definition ARN.
              // This tells CodeDeploy which ECS service and container to update.
              `printf "version: 0.0\\nResources:\\n  - TargetService:\\n      Type: AWS::ECS::Service\\n      Properties:\\n        TaskDefinition: ${props.taskDefinition.taskDefinitionArn}\\n        LoadBalancerInfo:\\n          ContainerName: AppContainer\\n          ContainerPort: 80\\n" > appspec.yaml`,

              // ✅ Create image definitions for future ECR automation.
              'jq -n \'[{"name":"AppContainer","imageUri":"example.dkr.ecr.ap-southeast-2.amazonaws.com/app:latest"}]\' > imagedefinitions.json',

              // ✅ Verification and debug copy.
              'echo "\\nListing generated files:"',
              'ls -l',
              'cat appspec.yaml',

              // Optional: Upload debug copy to S3 for verification.
              'aws s3 cp appspec.yaml s3://pipelinestack-apppipelineartifactsbucket543f0539-e0kzfmgxuvbn/debug-appspec.yaml || true',
            ],
          },
        },
        artifacts: {
          'base-directory': '.', // current working directory
          'discard-paths': 'yes',
          files: [
            'appspec.yaml',
            'taskdef.json',
            'imagedefinitions.json',
          ],
        },
      }),
    });

    // ------------------------------------------------------------------------
    // Pipeline Actions: Build & Deploy
    // ------------------------------------------------------------------------
    // These define the flow between stages in CodePipeline.
    // Build stage compiles the app and creates artifacts.
    // Deploy stage pushes the new task definition to ECS via CodeDeploy.
    const buildAction = new cpactions.CodeBuildAction({
      actionName: 'Build',
      project: buildProject,
      input: sourceOutput,
      outputs: [buildOutput],
    });

    const deployAction = new cpactions.CodeDeployEcsDeployAction({
      actionName: 'DeployBlueGreen',
      deploymentGroup: props.deploymentGroup,

      // ✅ Use generated artifact files from CodeBuild.
      appSpecTemplateFile: buildOutput.atPath('appspec.yaml'),
      taskDefinitionTemplateFile: buildOutput.atPath('taskdef.json'),

      // Optional future ECR integration:
      // imageFile: buildOutput.atPath('imagedefinitions.json'),
    });

    // ------------------------------------------------------------------------
    // CodePipeline Definition
    // ------------------------------------------------------------------------
    // The main pipeline that ties all stages together.
    // It automates: GitHub → Build → Deploy.
    new codepipeline.Pipeline(this, 'AppPipeline', {
      pipelineName: 'CICD-BlueGreenPipeline',
      stages: [
        { stageName: 'Source', actions: [sourceAction] },
        { stageName: 'Build', actions: [buildAction] },
        { stageName: 'Deploy', actions: [deployAction] },
      ],
    });
  }
}
