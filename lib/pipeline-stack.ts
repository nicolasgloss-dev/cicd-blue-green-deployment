// -----------------------------------------------------------------------------
// File: pipeline-stack.ts
// Project: CI/CD Blue-Green Deployment on AWS ECS Fargate (AWS CDK)
// Description: CI/CD pipeline (GitHub Source → CodeBuild → CodeDeploy ECS)
// Author: Nicolas Gloss
// Last Updated: 2025-11-28
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

export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    const sourceOutput = new codepipeline.Artifact('SourceOutput');
    const buildOutput = new codepipeline.Artifact('BuildOutput');

    // ------------------------------------------------------------------------
    // GitHub Source
    // ------------------------------------------------------------------------
    const githubToken = secretsmanager.Secret.fromSecretNameV2(
      this,
      'GithubToken',
      'cicd-bluegreen/github-token'
    );

    const sourceAction = new cpactions.GitHubSourceAction({
      actionName: 'GitHub_Source',
      owner: 'nicolasgloss-dev',
      repo: 'cicd-blue-green-deployment',
      oauthToken: githubToken.secretValue,
      output: sourceOutput,
      branch: 'main',
    });

    // ------------------------------------------------------------------------
    // CodeBuild (Build/Test + Prepare Deploy Artifacts)
    // ------------------------------------------------------------------------
    const buildProject = new codebuild.PipelineProject(this, 'BuildProject', {
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_6_0,
      },
      environmentVariables: {
        TASK_DEFINITION_ARN: { value: props.taskDefinition.taskDefinitionArn },

        // ✅ Replace this with your real ECR image later (or set it in CodeBuild)
        // For now it can be a placeholder string to prove the mechanism works.
        IMAGE_URI: { value: 'example.dkr.ecr.ap-southeast-2.amazonaws.com/app:latest' },
      },
      buildSpec: codebuild.BuildSpec.fromObjectToYaml({
        version: '0.2',
        phases: {
          install: {
            'runtime-versions': { nodejs: 18 },
            commands: [
              'npm install -g aws-cdk',
              'apt-get update -y',
              'apt-get install -y jq',
              'npm ci',
            ],
          },
          build: {
            commands: [
              'npm run build',
              'npm test',

              // ----------------------------------------------------------------
              // Prepare deployment artifacts in /deploy
              // ----------------------------------------------------------------
              // appspec.yaml is committed in the repo under deploy/appspec.yaml
              // taskdef.json is generated from the currently deployed task definition
              // to avoid hardcoding executionRoleArn, taskRoleArn, etc.
              'echo "Preparing deployment artifacts..."',
              'ls -la',

              // ✅ Generate deploy/taskdef.json from the live task definition ARN
              'aws ecs describe-task-definition --task-definition "$TASK_DEFINITION_ARN" --query taskDefinition > taskdef_full.json',
              // Strip read-only fields that ECS rejects on register-task-definition
              'cat taskdef_full.json | jq \'del(.taskDefinitionArn,.revision,.status,.requiresAttributes,.compatibilities,.registeredAt,.registeredBy)\' > deploy/taskdef.json',

              // ✅ Generate deploy/imagedefinitions.json used to update container image
              'jq -n --arg IMAGE_URI "$IMAGE_URI" \'[{"name":"AppContainer","imageUri":$IMAGE_URI}]\' > deploy/imagedefinitions.json',

              'echo "Deploy artifacts:"',
              'ls -ლა deploy',
              'echo "appspec.yaml:"',
              'cat deploy/appspec.yaml',
            ],
          },
        },
        artifacts: {
          'base-directory': 'deploy',
          files: ['appspec.yaml', 'taskdef.json'],
        },
      }),
    });

    const buildAction = new cpactions.CodeBuildAction({
      actionName: 'Build',
      project: buildProject,
      input: sourceOutput,
      outputs: [buildOutput],
    });

    // ------------------------------------------------------------------------
    // CodeDeploy ECS Deploy Action
    // ------------------------------------------------------------------------
    const deployAction = new cpactions.CodeDeployEcsDeployAction({
      actionName: 'DeployBlueGreen',
      deploymentGroup: props.deploymentGroup,
      appSpecTemplateFile: buildOutput.atPath('appspec.yaml'),
      taskDefinitionTemplateFile: buildOutput.atPath('taskdef.json'),
    });

    // ------------------------------------------------------------------------
    // Pipeline
    // ------------------------------------------------------------------------
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
