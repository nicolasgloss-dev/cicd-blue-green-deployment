import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as codedeploy from 'aws-cdk-lib/aws-codedeploy';
import { PipelineStack } from '../lib/pipeline-stack';

test('Pipeline with GitHub Source, Build and Deploy Stages Created', () => {
  const app = new cdk.App();

  // ------------------------------------------------------------------------
  // Base resources for testing
  // ------------------------------------------------------------------------
  // Minimal networking and compute resources required for ECS + CodeDeploy.
  const stack = new cdk.Stack(app, 'MockStack');
  const vpc = new ec2.Vpc(stack, 'TestVpc');
  const cluster = new ecs.Cluster(stack, 'TestCluster', { vpc });

  // Define a simple Fargate task definition with NGINX.
  const taskDef = new ecs.FargateTaskDefinition(stack, 'TaskDef');
  taskDef.addContainer('web', {
    image: ecs.ContainerImage.fromRegistry('nginx'),
    memoryLimitMiB: 256,
    cpu: 128,
  });

  // ECS service configured for CodeDeploy deployments.
  const service = new ecs.FargateService(stack, 'TestService', {
    cluster,
    taskDefinition: taskDef,
    deploymentController: { type: ecs.DeploymentControllerType.CODE_DEPLOY },
  });

  // ------------------------------------------------------------------------
  // Dummy CodeDeploy resources
  // ------------------------------------------------------------------------
  // The pipeline stack requires a CodeDeploy application and deployment group.
  // Listener and target groups are mocked because this test only validates
  // that the pipeline itself is created.
  const codedeployApp = new codedeploy.EcsApplication(stack, 'TestCodeDeployApp');
  const deploymentGroup = new codedeploy.EcsDeploymentGroup(stack, 'TestDeploymentGroup', {
    service,
    blueGreenDeploymentConfig: {
      listener: {} as any,
      blueTargetGroup: {} as any,
      greenTargetGroup: {} as any,
    },
  });

  // ------------------------------------------------------------------------
  // Pipeline stack under test
  // ------------------------------------------------------------------------
  // Instantiate the PipelineStack with all required props.
  // This stack creates the CI/CD pipeline that connects GitHub, CodeBuild, and ECS.
  const testStack = new PipelineStack(app, 'TestPipelineStack', {
    cluster,
    service,
    taskDefinition: taskDef,
    codedeployApp,
    deploymentGroup,
    listener: {} as any,
    blueTargetGroup: {} as any,
    greenTargetGroup: {} as any,
  });

  // ------------------------------------------------------------------------
  // Assertions
  // ------------------------------------------------------------------------
  // Confirms that a CodePipeline resource with the expected stages is created.
  const template = Template.fromStack(testStack);
  template.hasResourceProperties('AWS::CodePipeline::Pipeline', {
    Stages: [
      { Name: 'Source' },
      { Name: 'Build' },
      { Name: 'Deploy' },
    ],
  });
});
