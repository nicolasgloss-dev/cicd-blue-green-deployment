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
// Defines the input properties required for this stack. These allow the pipeline
// to connect to the ECS service, cluster, task definition, and CodeDeploy setup.
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
// Defines a CI/CD pipeline that automates the build and deployment workflow:
// - Source: retrieves code from GitHub
// - Build: compiles and synthesises the CDK app
// - Deploy: updates the ECS service with blue/green support
// -----------------------------------------------------------------------------
export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    // ------------------------------------------------------------------------
    // Artifacts
    // ------------------------------------------------------------------------
    // Artifacts store files passed between pipeline stages:
    // - SourceOutput: code retrieved from GitHub
    // - BuildOutput: compiled and synthesised CDK templates
    const sourceOutput = new codepipeline.Artifact('SourceOutput');
    const buildOutput = new codepipeline.Artifact('BuildOutput');

    // ------------------------------------------------------------------------
    // GitHub Source Action
    // ------------------------------------------------------------------------
    // Retrieves application code from GitHub.
    // The personal access token is stored securely in AWS Secrets Manager.
    // Secret name: cicd-bluegreen/github-token
    const githubToken = secretsmanager.Secret.fromSecretNameV2(
      this,
      'GithubToken',
      'cicd-bluegreen/github-token'
    );

    const sourceAction = new cpactions.GitHubSourceAction({
      actionName: 'GitHub_Source',
      owner: 'nicolasgloss-dev', // GitHub username
      repo: 'cicd-blue-green-deployment', // Repository name
      oauthToken: githubToken.secretValue, // Secure token reference
      output: sourceOutput,
      branch: 'main', // Tracks the main branch
    });

    // ------------------------------------------------------------------------
    // Build Project
    // ------------------------------------------------------------------------
    // Defines a CodeBuild project that builds and synthesises the CDK app:
    // - Uses Node.js 18 runtime
    // - Installs dependencies and AWS CDK
    // - Runs TypeScript build and CDK synth
    // - Outputs generated templates to cdk.out
    // Note: privileged mode is not required here because this build does not
    // perform Docker image builds.
    const buildProject = new codebuild.PipelineProject(this, 'BuildProject', {
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_6_0,
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            'runtime-versions': { nodejs: 18 },
            commands: ['npm install -g aws-cdk', 'npm install'],
          },
          build: {
            commands: ['npm run build', 'cdk synth'],
          },
        },
        artifacts: {
          'base-directory': 'cdk.out',
          files: ['**/*'],
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
    // Deploy Action
    // ------------------------------------------------------------------------
    // Updates the ECS Fargate service with the new task definition.
    // Blue/green traffic shifting is managed by ECS and CodeDeploy.
    const deployAction = new cpactions.EcsDeployAction({
      actionName: 'DeployBlueGreen',
      service: props.service,
      input: buildOutput,
    });

    // ------------------------------------------------------------------------
    // CodePipeline
    // ------------------------------------------------------------------------
    // Defines the CI/CD pipeline with three stages:
    // - Source → fetches code from GitHub
    // - Build → compiles and synthesises the CDK app
    // - Deploy → updates the ECS Fargate service
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
