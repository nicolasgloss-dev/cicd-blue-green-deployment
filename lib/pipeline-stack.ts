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

    // ------------------------------------------------------------------------
    // Artifacts
    // ------------------------------------------------------------------------
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
    // CodeBuild Project
    // ------------------------------------------------------------------------
    const buildProject = new codebuild.PipelineProject(this, 'BuildProject', {
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_6_0,
      },
      environmentVariables: {
        TASK_DEFINITION_ARN: {
          value: props.taskDefinition.taskDefinitionArn,
        },
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
              'npm install',
            ],
          },
          build: {
            commands: [
              'npm run build',
              'echo "Generating ECS deployment files..."',

              // ✅ Generate ECS task definition
              'printf "{\\n  \\"family\\": \\"bluegreen-demo-task\\",\\n  \\"networkMode\\": \\"awsvpc\\",\\n  \\"executionRoleArn\\": \\"arn:aws:iam::918689940836:role/ecsTaskExecutionRole\\",\\n  \\"containerDefinitions\\": [ { \\"name\\": \\"AppContainer\\", \\"image\\": \\"example.dkr.ecr.ap-southeast-2.amazonaws.com/app:latest\\", \\"essential\\": true, \\"portMappings\\": [ { \\"containerPort\\": 80, \\"protocol\\": \\"tcp\\" } ] } ],\\n  \\"requiresCompatibilities\\": [\\"FARGATE\\"],\\n  \\"cpu\\": \\"256\\",\\n  \\"memory\\": \\"512\\"\\n}" > taskdef.json',

              // ✅ Generate AppSpec YAML embedding the actual ECS task definition ARN
              `printf "version: 0.0\\nResources:\\n  - TargetService:\\n      Type: AWS::ECS::Service\\n      Properties:\\n        TaskDefinition: ${props.taskDefinition.taskDefinitionArn}\\n        LoadBalancerInfo:\\n          ContainerName: AppContainer\\n          ContainerPort: 80\\n" > appspec.yaml`,

              // ✅ Generate image definitions
              'jq -n \'[{"name":"AppContainer","imageUri":"example.dkr.ecr.ap-southeast-2.amazonaws.com/app:latest"}]\' > imagedefinitions.json',

              // ✅ Verification and debug copy
              'echo "\\nListing generated files:"',
              'ls -l',
              'cat appspec.yaml',
              'aws s3 cp appspec.yaml s3://pipelinestack-apppipelineartifactsbucket543f0539-e0kzfmgxuvbn/debug-appspec.yaml || true',
            ],
          },
        },
        artifacts: {
          'base-directory': '.',
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
    // Pipeline Actions
    // ------------------------------------------------------------------------
    const buildAction = new cpactions.CodeBuildAction({
      actionName: 'Build',
      project: buildProject,
      input: sourceOutput,
      outputs: [buildOutput],
    });

    const deployAction = new cpactions.CodeDeployEcsDeployAction({
      actionName: 'DeployBlueGreen',
      deploymentGroup: props.deploymentGroup,

      // ✅ Correctly reference artifact files
      appSpecTemplateFile: buildOutput.atPath('appspec.yaml'),
      taskDefinitionTemplateFile: buildOutput.atPath('taskdef.json'),

      // Optional future ECR integration:
      // imageFile: buildOutput.atPath('imagedefinitions.json'),
    });

    // ------------------------------------------------------------------------
    // CodePipeline Definition
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
