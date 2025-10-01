import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import { CodeDeployStack } from '../lib/codedeploy-stack';

test('CodeDeploy ECS Application and Deployment Group Created', () => {
  const app = new cdk.App();

  // ------------------------------------------------------------------------
  // Base resources for testing
  // ------------------------------------------------------------------------
  // Create a minimal VPC and ECS cluster to host the service.
  const stack = new cdk.Stack(app, 'MockStack');
  const vpc = new ec2.Vpc(stack, 'TestVpc');
  const cluster = new ecs.Cluster(stack, 'TestCluster', { vpc });

  // Define a simple Fargate task definition with an NGINX container.
  const taskDef = new ecs.FargateTaskDefinition(stack, 'TaskDef');
  taskDef.addContainer('web', {
    image: ecs.ContainerImage.fromRegistry('nginx'),
  });

  // ECS service configured with CodeDeploy as the deployment controller.
  // This is required for ECS blue/green deployments via CodeDeploy.
  const service = new ecs.FargateService(stack, 'TestService', {
    cluster,
    taskDefinition: taskDef,
    deploymentController: { type: ecs.DeploymentControllerType.CODE_DEPLOY },
  });

  // ------------------------------------------------------------------------
  // CodeDeploy stack under test
  // ------------------------------------------------------------------------
  // The CodeDeployStack requires cluster, service, listener, and target groups.
  // For this test, listener and target groups can be passed as empty mocks
  // since the test only needs to validate that a DeploymentGroup resource is created.
  const testStack = new CodeDeployStack(app, 'TestCodeDeployStack', {
    cluster,
    service,
    listener: {} as any,
    blueTargetGroup: {} as any,
    greenTargetGroup: {} as any,
  });

  // ------------------------------------------------------------------------
  // Assertions
  // ------------------------------------------------------------------------
  // Confirms that a CodeDeploy DeploymentGroup is defined.
  // The deployment group manages traffic shifting between blue/green target groups.
  const template = Template.fromStack(testStack);
  template.hasResourceProperties('AWS::CodeDeploy::DeploymentGroup', {});
});
